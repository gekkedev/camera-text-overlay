// ==UserScript==
// @name         Camera Text Overlay
// @namespace    https://github.com/gekkedev/camera-text-overlay
// @version      2.0.1
// @description  Replaces the camera stream with specified text for others to see
// @author       gekkedev
// @updateURL    https://raw.githubusercontent.com/gekkedev/camera-text-overlay/main/camera-text-overlay.user.js
// @downloadURL  https://raw.githubusercontent.com/gekkedev/camera-text-overlay/main/camera-text-overlay.user.js
// @match        *://*/*
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_registerMenuCommand
// @grant        GM_unregisterMenuCommand
// @grant        unsafeWindow
// @run-at       document-start
// ==/UserScript==

;(function () {
  "use strict"
  /*__OVERLAY_SHARED__*/

  const pageWindow = typeof unsafeWindow !== "undefined" ? unsafeWindow : window

  class UserscriptOverlayManager extends TextOverlayManager {
    constructor() {
      super({
        mediaDevices: pageWindow?.navigator?.mediaDevices || navigator.mediaDevices
      })
      this.menuCommandIds = []
      this.canRefreshMenuCommands = typeof GM_unregisterMenuCommand === "function"
      this.menuCommandsRegistered = false
      this.onFirstCameraRequest = () => injectGoogleFonts()
    }

    loadPreferences() {
      this.overlayText = GM_getValue("overlayText", DEFAULT_OVERLAY_SETTINGS.overlayText)
      this.selectedFont = GM_getValue("selectedFont", DEFAULT_OVERLAY_SETTINGS.selectedFont)
      this.bgColor = GM_getValue("bgColor", DEFAULT_OVERLAY_SETTINGS.bgColor)
      this.textColor = GM_getValue("textColor", DEFAULT_OVERLAY_SETTINGS.textColor)
      this.enabled = GM_getValue("overlayEnabled", DEFAULT_OVERLAY_SETTINGS.enabled)
    }

    savePreferences() {
      GM_setValue("overlayText", this.overlayText)
      GM_setValue("selectedFont", this.selectedFont)
      GM_setValue("bgColor", this.bgColor)
      GM_setValue("textColor", this.textColor)
      GM_setValue("overlayEnabled", this.enabled)
    }

    updateMenuCommands() {
      // Try to clean up old commands if possible
      if (this.canRefreshMenuCommands) {
        this.menuCommandIds.forEach(id => {
          if (id == null) return
          try {
            GM_unregisterMenuCommand(id)
          } catch (error) {
            this.canRefreshMenuCommands = false
          }
        })
        this.menuCommandIds = []
      }

      // Register commands with current state
      const register = (label, callback) => {
        const id = GM_registerMenuCommand(label, callback)
        if (this.canRefreshMenuCommands && id != null) {
          this.menuCommandIds.push(id)
        }
      }

      // Always use stateful labels based on current enabled state
      if (this.enabled) {
        register("🔴 Disable Text Overlay", () => this.toggleFeature())
      } else {
        register("🟢 Enable Text Overlay", () => this.toggleFeature())
      }
      
      register("⚙️ Configure Settings", () => this.showSettingsModal())
      register("🔄 Reset Settings", () => this.resetSettings())

      this.menuCommandsRegistered = true
    }

    showSettingsModal() {
      const modalData = this.createSettingsModal(false)
      document.body.appendChild(modalData.overlay)

      modalData.enableBtn.onclick = () => {
        this.overlayText = modalData.textInput.value
        this.selectedFont = modalData.fontSelect.value
        this.bgColor = modalData.bgColorInput.value
        this.textColor = modalData.textColorInput.value
        this.savePreferences()
        this.setEnabled(this.enabled)
        document.body.removeChild(modalData.overlay)
      }

      modalData.cancelBtn.onclick = () => {
        document.body.removeChild(modalData.overlay)
      }
    }

    resetSettings() {
      if (confirm("Reset all settings to defaults?")) {
        GM_setValue("overlayText", DEFAULT_OVERLAY_SETTINGS.overlayText)
        GM_setValue("selectedFont", DEFAULT_OVERLAY_SETTINGS.selectedFont)
        GM_setValue("bgColor", DEFAULT_OVERLAY_SETTINGS.bgColor)
        GM_setValue("textColor", DEFAULT_OVERLAY_SETTINGS.textColor)
        GM_setValue("overlayEnabled", DEFAULT_OVERLAY_SETTINGS.enabled)
        this.loadPreferences()
        this.setEnabled(this.enabled)
        alert("Settings reset to defaults")
      }
    }

    toggleFeature() {
      const nativeGetUserMedia = this.getNativeGetUserMedia()
      if (!nativeGetUserMedia) {
        alert("Camera access is not available on this page")
        return
      }

      if (this.enabled) {
        const previewData = this.createPreviewModal()
        document.body.appendChild(previewData.overlay)

        nativeGetUserMedia({ video: true })
          .then(stream => {
            previewData.previewVideo.srcObject = stream

            previewData.confirmBtn.onclick = () => {
              stream.getTracks().forEach(track => track.stop())
              this.setEnabled(false)
              previewData.overlay.remove()
            }
          })
          .catch(e => {
            console.error("Error accessing camera for preview:", e)
            previewData.overlay.remove()
          })
      } else {
        const modalData = this.createSettingsModal(true)
        document.body.appendChild(modalData.overlay)

        modalData.cancelBtn.onclick = () => {
          modalData.overlay.remove()
        }

        modalData.enableBtn.onclick = () => {
          this.overlayText = modalData.textInput.value.trim()
          this.selectedFont = modalData.fontSelect.value
          this.bgColor = modalData.bgColorInput.value
          this.textColor = modalData.textColorInput.value

          if (!this.overlayText) {
            alert("Please enter some text")
            return
          }

          this.setEnabled(true)
          modalData.overlay.remove()
        }

        modalData.textInput.focus()
        modalData.textInput.select()
      }
    }

    setEnabled(enabled) {
      super.setEnabled(enabled)
      this.savePreferences()
      this.updateMenuCommands()
    }

    initialize() {
      this.loadPreferences()
      this.updateMenuCommands()
      this.patchGetUserMedia()
    }
  }

  const manager = new UserscriptOverlayManager()
  manager.initialize()
})()
