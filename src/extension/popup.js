// Popup script for the Chrome extension
// Syncs settings with content script via chrome.storage

const overlayTextInput = document.getElementById("overlayText")
const selectedFontSelect = document.getElementById("selectedFont")
const bgColorInput = document.getElementById("bgColor")
const textColorInput = document.getElementById("textColor")
const previewBeforeToggleInput = document.getElementById("previewBeforeToggle")
const elevatorStyleMusicInput = document.getElementById("elevatorStyleMusic")
const disableMicrophoneWhenOverlayActiveInput = document.getElementById("disableMicrophoneWhenOverlayActive")
const hearMusicLocallyInput = document.getElementById("hearMusicLocally")
const musicVolumeInput = document.getElementById("musicVolume")
const musicVolumeValue = document.getElementById("musicVolumeValue")
const selectedMusicTrackSelect = document.getElementById("selectedMusicTrack")
const musicSettingsGroup = document.getElementById("musicSettingsGroup")
const microphoneMuteGroup = document.getElementById("microphoneMuteGroup")
const settingsToggleBtn = document.getElementById("settingsToggleBtn")
const settingsPanel = document.getElementById("settingsPanel")
const statusDiv = document.getElementById("status")
const statusText = document.getElementById("statusText")
const statusHint = document.getElementById("statusHint")
const toggleSwitch = document.getElementById("toggleSwitch")
const previewSection = document.getElementById("previewSection")
const previewTitle = document.getElementById("previewTitle")
const previewHint = document.getElementById("previewHint")
const previewCanvas = document.getElementById("previewCanvas")
const previewContext = previewCanvas.getContext("2d")
const previewState = {
  stream: null,
  sourceVideo: null,
  frameHandle: null,
  renderToken: 0
}
const MUSIC_TRACKS = [
  { fileName: "Corporate Calm™.mp3", label: "Corporate Calm™" },
  { fileName: "Sky Lobby Drift.mp3", label: "Sky Lobby Drift" },
  { fileName: "Soft Floors, Slow Doors.mp3", label: "Soft Floors, Slow Doors" },
  { fileName: "Waiting Protocol.mp3", label: "Waiting Protocol" }
]
const DEFAULT_MUSIC_TRACK = MUSIC_TRACKS[0]?.fileName || ""
const AUTO_SAVE_DELAY_MS = 150
const DEFAULT_MUSIC_VOLUME = 0.2

let currentState = {
  enabled: false,
  overlayText: "be right back 😴",
  selectedFont: "Titillium Web",
  bgColor: "#101010",
  textColor: "#ffd744",
  previewBeforeToggle: false,
  elevatorStyleMusic: false,
  disableMicrophoneWhenOverlayActive: true,
  hearMusicLocally: true,
  musicVolume: DEFAULT_MUSIC_VOLUME,
  selectedMusicTrack: DEFAULT_MUSIC_TRACK
}
let pendingSaveHandle = null

function normalizeSelectedMusicTrack(selectedMusicTrack) {
  if (MUSIC_TRACKS.some(track => track.fileName === selectedMusicTrack)) {
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

function formatMusicVolume(musicVolume) {
  return `${Math.round(normalizeMusicVolume(musicVolume) * 100)}%`
}

function populateMusicTrackOptions() {
  selectedMusicTrackSelect.textContent = ""

  MUSIC_TRACKS.forEach(track => {
    const option = document.createElement("option")
    option.value = track.fileName
    option.textContent = track.label
    selectedMusicTrackSelect.appendChild(option)
  })
}

// Load saved settings
function loadSettings() {
  chrome.storage.local.get(
    [
      "overlayEnabled",
      "overlayText",
      "selectedFont",
      "bgColor",
      "textColor",
      "previewBeforeToggle",
      "elevatorStyleMusic",
      "disableMicrophoneWhenOverlayActive",
      "hearMusicLocally",
      "musicVolume",
      "selectedMusicTrack"
    ],
    result => {
      currentState.enabled = result.overlayEnabled === true
      currentState.overlayText = result.overlayText || "be right back 😴"
      currentState.selectedFont = result.selectedFont || "Titillium Web"
      currentState.bgColor = result.bgColor || "#101010"
      currentState.textColor = result.textColor || "#ffd744"
      currentState.previewBeforeToggle = result.previewBeforeToggle === true
      currentState.elevatorStyleMusic = result.elevatorStyleMusic === true && MUSIC_TRACKS.length > 0
      currentState.disableMicrophoneWhenOverlayActive = result.disableMicrophoneWhenOverlayActive === true
      currentState.hearMusicLocally = result.hearMusicLocally !== false
      currentState.musicVolume = normalizeMusicVolume(result.musicVolume)
      currentState.selectedMusicTrack = normalizeSelectedMusicTrack(result.selectedMusicTrack)

      updateUI()
      renderPreview()
    }
  )
}

function syncStateFromInputs() {
  currentState.overlayText = overlayTextInput.value.trim() || "be right back 😴"
  currentState.selectedFont = selectedFontSelect.value
  currentState.bgColor = bgColorInput.value
  currentState.textColor = textColorInput.value
  currentState.previewBeforeToggle = previewBeforeToggleInput.checked
  currentState.elevatorStyleMusic = elevatorStyleMusicInput.checked && MUSIC_TRACKS.length > 0
  currentState.disableMicrophoneWhenOverlayActive = disableMicrophoneWhenOverlayActiveInput.checked
  currentState.hearMusicLocally = hearMusicLocallyInput.checked
  currentState.musicVolume = normalizeMusicVolume(Number(musicVolumeInput.value) / 100)
  currentState.selectedMusicTrack = normalizeSelectedMusicTrack(selectedMusicTrackSelect.value)
}

function applySnapshot(settings = {}) {
  currentState.overlayText = settings.overlayText ?? currentState.overlayText
  currentState.selectedFont = settings.selectedFont ?? currentState.selectedFont
  currentState.bgColor = settings.bgColor ?? currentState.bgColor
  currentState.textColor = settings.textColor ?? currentState.textColor
  currentState.previewBeforeToggle = settings.previewBeforeToggle ?? currentState.previewBeforeToggle
  currentState.elevatorStyleMusic = settings.elevatorStyleMusic ?? currentState.elevatorStyleMusic
  currentState.disableMicrophoneWhenOverlayActive =
    settings.disableMicrophoneWhenOverlayActive ?? currentState.disableMicrophoneWhenOverlayActive
  currentState.hearMusicLocally = settings.hearMusicLocally ?? currentState.hearMusicLocally
  currentState.musicVolume = normalizeMusicVolume(settings.musicVolume ?? currentState.musicVolume)
  currentState.selectedMusicTrack = normalizeSelectedMusicTrack(
    settings.selectedMusicTrack ?? currentState.selectedMusicTrack
  )
}

function resizePreviewCanvas(width = 640, height = 360) {
  const nextWidth = Number(width) > 0 ? Number(width) : 640
  const nextHeight = Number(height) > 0 ? Number(height) : 360
  previewCanvas.width = nextWidth
  previewCanvas.height = nextHeight
}

function stopPreviewStream() {
  if (previewState.frameHandle != null) {
    cancelAnimationFrame(previewState.frameHandle)
    previewState.frameHandle = null
  }

  if (previewState.sourceVideo) {
    previewState.sourceVideo.pause()
    previewState.sourceVideo.srcObject = null
    previewState.sourceVideo = null
  }

  if (previewState.stream) {
    previewState.stream.getTracks().forEach(track => {
      if (track.readyState !== "ended") {
        track.stop()
      }
    })
    previewState.stream = null
  }
}

function drawOverlayPreview(settings) {
  resizePreviewCanvas()
  previewContext.clearRect(0, 0, previewCanvas.width, previewCanvas.height)
  previewContext.fillStyle = settings.bgColor
  previewContext.fillRect(0, 0, previewCanvas.width, previewCanvas.height)
  previewContext.fillStyle = settings.textColor
  previewContext.textAlign = "center"
  previewContext.textBaseline = "middle"
  previewContext.font = `42px "${settings.selectedFont}", sans-serif`
  previewContext.fillText(settings.overlayText, previewCanvas.width / 2, previewCanvas.height / 2)
}

function drawPreviewUnavailable() {
  resizePreviewCanvas()
  previewContext.clearRect(0, 0, previewCanvas.width, previewCanvas.height)
  previewContext.fillStyle = "#101010"
  previewContext.fillRect(0, 0, previewCanvas.width, previewCanvas.height)
  previewContext.fillStyle = "#ffffff"
  previewContext.textAlign = "center"
  previewContext.textBaseline = "middle"
  previewContext.font = '20px "Titillium Web", sans-serif'
  previewContext.fillText("Preview unavailable", previewCanvas.width / 2, previewCanvas.height / 2)
}

async function startBareCameraPreview(renderToken) {
  if (!navigator.mediaDevices || typeof navigator.mediaDevices.getUserMedia !== "function") {
    return false
  }

  try {
    const stream = await navigator.mediaDevices.getUserMedia({ video: true })

    if (previewState.renderToken !== renderToken || !currentState.previewBeforeToggle || !currentState.enabled) {
      stream.getTracks().forEach(track => track.stop())
      return false
    }

    const sourceVideo = document.createElement("video")
    sourceVideo.muted = true
    sourceVideo.setAttribute("playsinline", "")
    sourceVideo.setAttribute("autoplay", "")
    sourceVideo.srcObject = stream

    previewState.stream = stream
    previewState.sourceVideo = sourceVideo

    const track = stream.getVideoTracks()[0]
    const settings = (track && typeof track.getSettings === "function" && track.getSettings()) || {}
    resizePreviewCanvas(settings.width, settings.height)

    const playPromise = sourceVideo.play()
    if (playPromise && typeof playPromise.catch === "function") {
      playPromise.catch(() => {})
    }

    const draw = () => {
      if (
        previewState.renderToken !== renderToken ||
        !currentState.previewBeforeToggle ||
        !currentState.enabled ||
        previewState.sourceVideo !== sourceVideo
      ) {
        return
      }

      if (sourceVideo.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
        previewContext.clearRect(0, 0, previewCanvas.width, previewCanvas.height)
        previewContext.drawImage(sourceVideo, 0, 0, previewCanvas.width, previewCanvas.height)
      }

      previewState.frameHandle = requestAnimationFrame(draw)
    }

    draw()
    return true
  } catch {
    stopPreviewStream()
    return false
  }
}

async function renderPreview() {
  const renderToken = ++previewState.renderToken
  stopPreviewStream()

  if (!currentState.previewBeforeToggle) {
    previewSection.hidden = true
    return
  }

  previewSection.hidden = false

  if (currentState.enabled) {
    previewTitle.textContent = "Bare Camera Preview"
    previewHint.textContent = "This is your real camera feed with the overlay turned off."
  } else {
    previewTitle.textContent = "Overlay Preview"
    previewHint.textContent = "This is what other people will see when the overlay is enabled."
    drawOverlayPreview(currentState)
    return
  }

  const started = await startBareCameraPreview(renderToken)
  if (previewState.renderToken !== renderToken) {
    return
  }

  if (!started) {
    previewHint.textContent = "Bare camera preview unavailable here."
    drawPreviewUnavailable()
  }
}

function updateUI() {
  overlayTextInput.value = currentState.overlayText
  selectedFontSelect.value = currentState.selectedFont
  bgColorInput.value = currentState.bgColor
  textColorInput.value = currentState.textColor
  previewBeforeToggleInput.checked = currentState.previewBeforeToggle
  elevatorStyleMusicInput.checked = currentState.elevatorStyleMusic
  elevatorStyleMusicInput.disabled = MUSIC_TRACKS.length === 0
  disableMicrophoneWhenOverlayActiveInput.checked = currentState.disableMicrophoneWhenOverlayActive
  const showMusicSettings = MUSIC_TRACKS.length > 0 && currentState.elevatorStyleMusic
  musicSettingsGroup.hidden = !showMusicSettings
  microphoneMuteGroup.hidden = showMusicSettings
  hearMusicLocallyInput.checked = currentState.hearMusicLocally
  hearMusicLocallyInput.disabled = MUSIC_TRACKS.length === 0 || !currentState.elevatorStyleMusic
  musicVolumeInput.value = String(Math.round(currentState.musicVolume * 100))
  musicVolumeValue.textContent = formatMusicVolume(currentState.musicVolume)
  musicVolumeInput.disabled = MUSIC_TRACKS.length === 0 || !currentState.elevatorStyleMusic
  selectedMusicTrackSelect.value = normalizeSelectedMusicTrack(currentState.selectedMusicTrack)
  selectedMusicTrackSelect.disabled = MUSIC_TRACKS.length === 0 || !currentState.elevatorStyleMusic
  previewSection.hidden = !currentState.previewBeforeToggle

  if (currentState.enabled) {
    statusText.textContent = "Overlay Enabled"
    statusHint.textContent = "Others will receive the generated overlay stream."
    statusDiv.className = "status enabled"
    toggleSwitch.checked = true
    toggleSwitch.setAttribute("aria-checked", "true")
  } else {
    statusText.textContent = "Overlay Disabled"
    statusHint.textContent = "Your normal camera stays active until you switch it on."
    statusDiv.className = "status disabled"
    toggleSwitch.checked = false
    toggleSwitch.setAttribute("aria-checked", "false")
  }
}

function setSettingsMenuOpen(isOpen) {
  settingsPanel.hidden = !isOpen
  settingsToggleBtn.setAttribute("aria-expanded", String(isOpen))
}

function notifyContentScripts() {
  chrome.tabs.query({}, tabs => {
    tabs.forEach(tab => {
      chrome.tabs
        .sendMessage(tab.id, {
          type: "SETTINGS_UPDATED",
          settings: currentState
        })
        .catch(() => {
          // Tab doesn't have content script, ignore
        })
    })
  })
}

function saveSettings() {
  if (pendingSaveHandle != null) {
    clearTimeout(pendingSaveHandle)
    pendingSaveHandle = null
  }

  chrome.storage.local.set({
    overlayEnabled: currentState.enabled,
    overlayText: currentState.overlayText,
    selectedFont: currentState.selectedFont,
    bgColor: currentState.bgColor,
    textColor: currentState.textColor,
    previewBeforeToggle: currentState.previewBeforeToggle,
    elevatorStyleMusic: currentState.elevatorStyleMusic,
    disableMicrophoneWhenOverlayActive: currentState.disableMicrophoneWhenOverlayActive,
    hearMusicLocally: currentState.hearMusicLocally,
    musicVolume: currentState.musicVolume,
    selectedMusicTrack: currentState.selectedMusicTrack
  })

  notifyContentScripts()
}

function scheduleSettingsSave() {
  if (pendingSaveHandle != null) {
    clearTimeout(pendingSaveHandle)
  }

  pendingSaveHandle = setTimeout(() => {
    pendingSaveHandle = null
    saveSettings()
  }, AUTO_SAVE_DELAY_MS)
}

function commitToggle(targetEnabled, settings = currentState) {
  applySnapshot(settings)
  currentState.enabled = targetEnabled
  saveSettings()
  updateUI()
  renderPreview()
}

function refreshOverlayPreviewIfVisible() {
  if (currentState.previewBeforeToggle && !currentState.enabled) {
    renderPreview()
  }
}

// Input change handlers - update the currentState and persist automatically
overlayTextInput.addEventListener("input", () => {
  currentState.overlayText = overlayTextInput.value.trim() || "be right back 😴"
  scheduleSettingsSave()
  refreshOverlayPreviewIfVisible()
})

selectedFontSelect.addEventListener("change", () => {
  currentState.selectedFont = selectedFontSelect.value
  saveSettings()
  refreshOverlayPreviewIfVisible()
})

bgColorInput.addEventListener("change", () => {
  currentState.bgColor = bgColorInput.value
  saveSettings()
  refreshOverlayPreviewIfVisible()
})

textColorInput.addEventListener("change", () => {
  currentState.textColor = textColorInput.value
  saveSettings()
  refreshOverlayPreviewIfVisible()
})

previewBeforeToggleInput.addEventListener("change", () => {
  currentState.previewBeforeToggle = previewBeforeToggleInput.checked
  saveSettings()
  updateUI()
  renderPreview()
})

elevatorStyleMusicInput.addEventListener("change", () => {
  currentState.elevatorStyleMusic = elevatorStyleMusicInput.checked && MUSIC_TRACKS.length > 0
  saveSettings()
  updateUI()
})

disableMicrophoneWhenOverlayActiveInput.addEventListener("change", () => {
  currentState.disableMicrophoneWhenOverlayActive = disableMicrophoneWhenOverlayActiveInput.checked
  saveSettings()
})

hearMusicLocallyInput.addEventListener("change", () => {
  currentState.hearMusicLocally = hearMusicLocallyInput.checked
  saveSettings()
  updateUI()
})

musicVolumeInput.addEventListener("input", () => {
  currentState.musicVolume = normalizeMusicVolume(Number(musicVolumeInput.value) / 100)
  musicVolumeValue.textContent = formatMusicVolume(currentState.musicVolume)
  scheduleSettingsSave()
})

selectedMusicTrackSelect.addEventListener("change", () => {
  currentState.selectedMusicTrack = normalizeSelectedMusicTrack(selectedMusicTrackSelect.value)
  saveSettings()
})

// Toggle switch - enables/disables the overlay
toggleSwitch.addEventListener("change", () => {
  syncStateFromInputs()
  const targetEnabled = toggleSwitch.checked

  if (targetEnabled && !currentState.overlayText.trim()) {
    alert("Please enter some text first")
    toggleSwitch.checked = currentState.enabled
    return
  }

  commitToggle(targetEnabled)
})

// Load settings when popup opens
populateMusicTrackOptions()
loadSettings()

window.addEventListener("unload", () => {
  if (pendingSaveHandle != null) {
    saveSettings()
  }

  stopPreviewStream()
})

settingsToggleBtn.addEventListener("click", event => {
  event.stopPropagation()
  setSettingsMenuOpen(settingsPanel.hidden)
})

settingsPanel.addEventListener("click", event => {
  event.stopPropagation()
})

document.addEventListener("click", event => {
  if (settingsPanel.hidden) {
    return
  }

  if (event.target !== settingsToggleBtn && !settingsPanel.contains(event.target)) {
    setSettingsMenuOpen(false)
  }
})

document.addEventListener("keydown", event => {
  if (event.key === "Escape" && !settingsPanel.hidden) {
    setSettingsMenuOpen(false)
    settingsToggleBtn.focus()
  }
})

// Listen for storage changes from other windows/tabs
chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName === "local") {
    let hasExternalUpdate = false

    if (changes.overlayEnabled) {
      const enabled = changes.overlayEnabled.newValue === true
      if (currentState.enabled !== enabled) {
        currentState.enabled = enabled
        hasExternalUpdate = true
      }
    }
    if (changes.overlayText) {
      const overlayText = changes.overlayText.newValue || "be right back 😴"
      if (currentState.overlayText !== overlayText) {
        currentState.overlayText = overlayText
        hasExternalUpdate = true
      }
    }
    if (changes.selectedFont) {
      const selectedFont = changes.selectedFont.newValue || "Titillium Web"
      if (currentState.selectedFont !== selectedFont) {
        currentState.selectedFont = selectedFont
        hasExternalUpdate = true
      }
    }
    if (changes.bgColor) {
      const bgColor = changes.bgColor.newValue || "#101010"
      if (currentState.bgColor !== bgColor) {
        currentState.bgColor = bgColor
        hasExternalUpdate = true
      }
    }
    if (changes.textColor) {
      const textColor = changes.textColor.newValue || "#ffd744"
      if (currentState.textColor !== textColor) {
        currentState.textColor = textColor
        hasExternalUpdate = true
      }
    }
    if (changes.previewBeforeToggle) {
      const previewBeforeToggle = changes.previewBeforeToggle.newValue === true
      if (currentState.previewBeforeToggle !== previewBeforeToggle) {
        currentState.previewBeforeToggle = previewBeforeToggle
        hasExternalUpdate = true
      }
    }
    if (changes.elevatorStyleMusic) {
      const elevatorStyleMusic = changes.elevatorStyleMusic.newValue === true && MUSIC_TRACKS.length > 0
      if (currentState.elevatorStyleMusic !== elevatorStyleMusic) {
        currentState.elevatorStyleMusic = elevatorStyleMusic
        hasExternalUpdate = true
      }
    }
    if (changes.disableMicrophoneWhenOverlayActive) {
      const disableMicrophoneWhenOverlayActive = changes.disableMicrophoneWhenOverlayActive.newValue === true
      if (currentState.disableMicrophoneWhenOverlayActive !== disableMicrophoneWhenOverlayActive) {
        currentState.disableMicrophoneWhenOverlayActive = disableMicrophoneWhenOverlayActive
        hasExternalUpdate = true
      }
    }
    if (changes.hearMusicLocally) {
      const hearMusicLocally = changes.hearMusicLocally.newValue !== false
      if (currentState.hearMusicLocally !== hearMusicLocally) {
        currentState.hearMusicLocally = hearMusicLocally
        hasExternalUpdate = true
      }
    }
    if (changes.musicVolume) {
      const musicVolume = normalizeMusicVolume(changes.musicVolume.newValue)
      if (currentState.musicVolume !== musicVolume) {
        currentState.musicVolume = musicVolume
        hasExternalUpdate = true
      }
    }
    if (changes.selectedMusicTrack) {
      const selectedMusicTrack = normalizeSelectedMusicTrack(changes.selectedMusicTrack.newValue)
      if (currentState.selectedMusicTrack !== selectedMusicTrack) {
        currentState.selectedMusicTrack = selectedMusicTrack
        hasExternalUpdate = true
      }
    }

    if (!hasExternalUpdate) {
      return
    }

    updateUI()
    renderPreview()
  }
})
