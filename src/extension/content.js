// Content script for Chrome extension
// Relays saved settings into the page-context bridge.

/*__OVERLAY_SHARED__*/

const MESSAGE_SOURCE = "camera-text-overlay-extension"
const MUSIC_TRACK_FILES = [
  "Corporate Calm™.mp3",
  "Sky Lobby Drift.mp3",
  "Soft Floors, Slow Doors.mp3",
  "Waiting Protocol.mp3"
]
const DEFAULT_MUSIC_TRACK = MUSIC_TRACK_FILES[0] || ""
let lastSettings = null

function normalizeSelectedMusicTrack(selectedMusicTrack) {
  if (MUSIC_TRACK_FILES.includes(selectedMusicTrack)) {
    return selectedMusicTrack
  }

  return DEFAULT_MUSIC_TRACK
}

function getWaitingMusicUrl(selectedMusicTrack) {
  if (!selectedMusicTrack) {
    return ""
  }

  return new URL(`music/${selectedMusicTrack}`, chrome.runtime.getURL("/")).toString()
}

function normalizeSettings(settings = {}) {
  const selectedMusicTrack = normalizeSelectedMusicTrack(settings.selectedMusicTrack)

  return {
    enabled: settings.enabled === true,
    overlayText: settings.overlayText || DEFAULT_OVERLAY_SETTINGS.overlayText,
    selectedFont: settings.selectedFont || DEFAULT_OVERLAY_SETTINGS.selectedFont,
    bgColor: settings.bgColor || DEFAULT_OVERLAY_SETTINGS.bgColor,
    textColor: settings.textColor || DEFAULT_OVERLAY_SETTINGS.textColor,
    previewBeforeToggle: settings.previewBeforeToggle === true,
    elevatorStyleMusic: settings.elevatorStyleMusic === true && MUSIC_TRACK_FILES.length > 0,
    selectedMusicTrack,
    waitingMusicUrl: getWaitingMusicUrl(selectedMusicTrack)
  }
}

function sendSettingsToPage(settings) {
  lastSettings = normalizeSettings(settings)
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
    "selectedMusicTrack"
  ],
  result => {
    sendSettingsToPage({
      enabled: result.overlayEnabled === true,
      overlayText: result.overlayText,
      selectedFont: result.selectedFont,
      bgColor: result.bgColor,
      textColor: result.textColor,
      previewBeforeToggle: result.previewBeforeToggle === true,
      elevatorStyleMusic: result.elevatorStyleMusic === true,
      selectedMusicTrack: result.selectedMusicTrack
    })
  }
)

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === "SETTINGS_UPDATED") {
    sendSettingsToPage(request.settings || {})
    sendResponse({ success: true })
  }
})

window.addEventListener("message", event => {
  const data = event && event.data
  if (!data || data.source !== MESSAGE_SOURCE) return

  if (data.type === "OVERLAY_READY" && lastSettings) {
    sendSettingsToPage(lastSettings)
  }
})
