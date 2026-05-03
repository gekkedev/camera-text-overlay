// Runs in the page context via the manifest `MAIN` world content script.

/*__OVERLAY_SHARED__*/

const MESSAGE_SOURCE = "camera-text-overlay-extension"
const manager = new TextOverlayManager({
  onFirstCameraRequest: () => injectGoogleFonts()
})

function normalizeSettings(settings = {}) {
  return {
    enabled: settings.enabled === true,
    overlayText: settings.overlayText || DEFAULT_OVERLAY_SETTINGS.overlayText,
    selectedFont: settings.selectedFont || DEFAULT_OVERLAY_SETTINGS.selectedFont,
    bgColor: settings.bgColor || DEFAULT_OVERLAY_SETTINGS.bgColor,
    textColor: settings.textColor || DEFAULT_OVERLAY_SETTINGS.textColor,
    previewBeforeToggle: settings.previewBeforeToggle === true,
    elevatorStyleMusic: settings.elevatorStyleMusic === true,
    disableMicrophoneWhenOverlayActive: settings.disableMicrophoneWhenOverlayActive === true,
    hearMusicLocally: settings.hearMusicLocally !== false,
    musicVolume:
      typeof settings.musicVolume === "number" && Number.isFinite(settings.musicVolume)
        ? Math.min(1, Math.max(0, settings.musicVolume))
        : DEFAULT_OVERLAY_SETTINGS.musicVolume,
    selectedMusicTrack: settings.selectedMusicTrack || DEFAULT_OVERLAY_SETTINGS.selectedMusicTrack,
    waitingMusicUrl: settings.waitingMusicUrl || ""
  }
}

function applySettings(settings = {}) {
  const normalizedSettings = normalizeSettings(settings)
  manager.applySettings(normalizedSettings)
  manager.setEnabled(manager.enabled)
}

manager.initializeCore({ hideToggle: true })

window.addEventListener("message", event => {
  const data = event && event.data
  if (!data || data.source !== MESSAGE_SOURCE) return
  if (data.type === "SETTINGS_UPDATED") {
    applySettings(data.settings || {})
  }
})

window.postMessage({ source: MESSAGE_SOURCE, type: "OVERLAY_READY" }, "*")
