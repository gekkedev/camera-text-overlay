// Content script for Chrome extension
// Relays saved settings into the page-context bridge.

/*__OVERLAY_SHARED__*/

const MESSAGE_SOURCE = "camera-text-overlay-extension"
const MUSIC_TRACK_FILES = Object.freeze(/*__MUSIC_TRACK_FILES__*/ [])
const DEFAULT_MUSIC_TRACK = MUSIC_TRACK_FILES[0] || ""
const DEFAULT_MUSIC_VOLUME = 0.2
let lastSettings = null
const waitingMusicBlobUrls = new Map()
const waitingMusicLoadPromises = new Map()
const LOCAL_WAITING_MUSIC_UNLOCK_EVENTS = ["pointerdown", "mousedown", "touchstart", "keydown"]
const isTopLevelFrame = (() => {
  try {
    return window.top === window
  } catch {
    return true
  }
})()
let localWaitingMusicAudio = null

function normalizeSelectedMusicTrack(selectedMusicTrack) {
  if (MUSIC_TRACK_FILES.includes(selectedMusicTrack)) {
    return selectedMusicTrack
  }

  return DEFAULT_MUSIC_TRACK
}

function normalizeMusicVolume(musicVolume) {
  const numericVolume = Number(musicVolume)
  if (!Number.isFinite(numericVolume)) {
    return DEFAULT_MUSIC_VOLUME
  }

  return Math.min(1, Math.max(0, numericVolume))
}

function revokeWaitingMusicUrls() {
  waitingMusicBlobUrls.forEach(url => {
    URL.revokeObjectURL(url)
  })
  waitingMusicBlobUrls.clear()
}

function getMountTarget() {
  return document.body || document.documentElement || document.head || null
}

function appendElement(element) {
  if (element.isConnected) {
    return
  }

  const mountTarget = getMountTarget()
  if (mountTarget) {
    mountTarget.appendChild(element)
    return
  }

  document.addEventListener(
    "DOMContentLoaded",
    () => {
      const readyMountTarget = getMountTarget()
      if (readyMountTarget && !element.isConnected) {
        readyMountTarget.appendChild(element)
      }
    },
    { once: true }
  )
}

function getLocalWaitingMusicAudio() {
  if (!isTopLevelFrame) {
    return null
  }

  if (localWaitingMusicAudio) {
    return localWaitingMusicAudio
  }

  const audio = document.createElement("audio")
  audio.loop = true
  audio.preload = "auto"
  audio.hidden = true
  audio.muted = false
  audio.volume = 1
  audio.setAttribute("playsinline", "")
  appendElement(audio)
  localWaitingMusicAudio = audio
  return localWaitingMusicAudio
}

function shouldPlayWaitingMusicLocally(settings = lastSettings) {
  return Boolean(
    isTopLevelFrame &&
    settings &&
    settings.enabled === true &&
    settings.elevatorStyleMusic === true &&
    settings.hearMusicLocally === true &&
    settings.waitingMusicUrl
  )
}

async function attemptLocalWaitingMusicPlayback() {
  if (!shouldPlayWaitingMusicLocally()) {
    return
  }

  const audio = getLocalWaitingMusicAudio()
  if (!audio) {
    return
  }

  if (audio.dataset.waitingMusicUrl !== lastSettings.waitingMusicUrl) {
    audio.pause()
    audio.src = lastSettings.waitingMusicUrl
    audio.dataset.waitingMusicUrl = lastSettings.waitingMusicUrl
    audio.currentTime = 0
  }

  audio.volume = normalizeMusicVolume(lastSettings.musicVolume)

  try {
    await audio.play()
  } catch {}
}

function syncLocalWaitingMusicPlayback(settings = lastSettings) {
  if (!isTopLevelFrame) {
    return
  }

  const audio = getLocalWaitingMusicAudio()
  if (!audio) {
    return
  }

  if (!shouldPlayWaitingMusicLocally(settings)) {
    audio.pause()
    audio.currentTime = 0
    return
  }

  attemptLocalWaitingMusicPlayback()
}

async function getWaitingMusicUrl(selectedMusicTrack) {
  if (!selectedMusicTrack) {
    return ""
  }

  const cachedUrl = waitingMusicBlobUrls.get(selectedMusicTrack)
  if (cachedUrl) {
    return cachedUrl
  }

  const pendingLoad = waitingMusicLoadPromises.get(selectedMusicTrack)
  if (pendingLoad) {
    return pendingLoad
  }

  const loadPromise = fetch(chrome.runtime.getURL(`music/${selectedMusicTrack}`))
    .then(response => {
      if (!response.ok) {
        throw new Error(`Could not load waiting music: ${response.status}`)
      }

      return response.blob()
    })
    .then(blob => {
      const blobUrl = URL.createObjectURL(blob)
      waitingMusicBlobUrls.set(selectedMusicTrack, blobUrl)
      waitingMusicLoadPromises.delete(selectedMusicTrack)
      return blobUrl
    })
    .catch(() => {
      waitingMusicLoadPromises.delete(selectedMusicTrack)
      return ""
    })

  waitingMusicLoadPromises.set(selectedMusicTrack, loadPromise)
  return loadPromise
}

async function normalizeSettings(settings = {}) {
  const selectedMusicTrack = normalizeSelectedMusicTrack(settings.selectedMusicTrack)
  const waitingMusicUrl = await getWaitingMusicUrl(selectedMusicTrack)

  return {
    enabled: settings.enabled === true,
    overlayText: settings.overlayText || DEFAULT_OVERLAY_SETTINGS.overlayText,
    selectedFont: settings.selectedFont || DEFAULT_OVERLAY_SETTINGS.selectedFont,
    bgColor: settings.bgColor || DEFAULT_OVERLAY_SETTINGS.bgColor,
    textColor: settings.textColor || DEFAULT_OVERLAY_SETTINGS.textColor,
    previewBeforeToggle: settings.previewBeforeToggle === true,
    elevatorStyleMusic: settings.elevatorStyleMusic === true && MUSIC_TRACK_FILES.length > 0,
    hearMusicLocally: settings.hearMusicLocally !== false,
    musicVolume: normalizeMusicVolume(settings.musicVolume),
    selectedMusicTrack,
    waitingMusicUrl
  }
}

let settingsUpdateToken = 0

async function sendSettingsToPage(settings) {
  const updateToken = ++settingsUpdateToken
  const normalizedSettings = await normalizeSettings(settings)
  if (updateToken !== settingsUpdateToken) {
    return
  }

  lastSettings = normalizedSettings
  syncLocalWaitingMusicPlayback(lastSettings)
  window.postMessage({ source: MESSAGE_SOURCE, type: "SETTINGS_UPDATED", settings: lastSettings }, "*")
}

chrome.storage.local.get(
  [
    "overlayEnabled",
    "overlayText",
    "selectedFont",
    "bgColor",
    "textColor",
    "previewBeforeToggle",
    "elevatorStyleMusic",
    "hearMusicLocally",
    "musicVolume",
    "selectedMusicTrack"
  ],
  async result => {
    await sendSettingsToPage({
      enabled: result.overlayEnabled === true,
      overlayText: result.overlayText,
      selectedFont: result.selectedFont,
      bgColor: result.bgColor,
      textColor: result.textColor,
      previewBeforeToggle: result.previewBeforeToggle === true,
      elevatorStyleMusic: result.elevatorStyleMusic === true,
      hearMusicLocally: result.hearMusicLocally !== false,
      musicVolume: normalizeMusicVolume(result.musicVolume),
      selectedMusicTrack: result.selectedMusicTrack
    })
  }
)

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === "SETTINGS_UPDATED") {
    sendSettingsToPage(request.settings || {})
      .then(() => {
        sendResponse({ success: true })
      })
      .catch(error => {
        sendResponse({ success: false, error: error?.message || String(error) })
      })
    return true
  }
})

if (isTopLevelFrame) {
  LOCAL_WAITING_MUSIC_UNLOCK_EVENTS.forEach(eventName => {
    window.addEventListener(
      eventName,
      () => {
        attemptLocalWaitingMusicPlayback()
      },
      true
    )
  })
}

window.addEventListener("message", event => {
  const data = event && event.data
  if (!data || data.source !== MESSAGE_SOURCE) return

  if (data.type === "OVERLAY_READY" && lastSettings) {
    sendSettingsToPage(lastSettings)
  }
})

window.addEventListener("unload", () => {
  if (localWaitingMusicAudio) {
    localWaitingMusicAudio.pause()
    localWaitingMusicAudio.removeAttribute("src")
    localWaitingMusicAudio.load()
    localWaitingMusicAudio.remove()
    localWaitingMusicAudio = null
  }

  revokeWaitingMusicUrls()
})
