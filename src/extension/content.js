// Content script for Chrome extension
// Relays saved settings into the page-context bridge.

/*__OVERLAY_SHARED__*/

const MESSAGE_SOURCE = "camera-text-overlay-extension"
let lastSettings = null

function normalizeSettings(settings = {}) {
  return {
    enabled: settings.enabled === true,
    overlayText: settings.overlayText || DEFAULT_OVERLAY_SETTINGS.overlayText,
    selectedFont: settings.selectedFont || DEFAULT_OVERLAY_SETTINGS.selectedFont,
    bgColor: settings.bgColor || DEFAULT_OVERLAY_SETTINGS.bgColor,
    textColor: settings.textColor || DEFAULT_OVERLAY_SETTINGS.textColor
  }
}

function sendSettingsToPage(settings) {
  lastSettings = normalizeSettings(settings)
  window.postMessage({ source: MESSAGE_SOURCE, type: "SETTINGS_UPDATED", settings: lastSettings }, "*")
}

chrome.storage.local.get(
  ["overlayEnabled", "overlayText", "selectedFont", "bgColor", "textColor"],
  result => {
    sendSettingsToPage({
      enabled: result.overlayEnabled === true,
      overlayText: result.overlayText,
      selectedFont: result.selectedFont,
      bgColor: result.bgColor,
      textColor: result.textColor
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
