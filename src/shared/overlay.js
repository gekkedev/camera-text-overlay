/**
 * Shared overlay functionality for Camera Text Overlay
 * Used by both the Chrome extension and userscript
 */

export const DEFAULT_OVERLAY_SETTINGS = {
  enabled: false,
  overlayText: "be right back 😴",
  selectedFont: "Titillium Web",
  bgColor: "#101010",
  textColor: "#ffd744"
}

export class TextOverlayManager {
  constructor(options = {}) {
    const defaults = DEFAULT_OVERLAY_SETTINGS
    this.enabled = options.enabled ?? defaults.enabled
    this.overlayText = options.overlayText ?? defaults.overlayText
    this.selectedFont = options.selectedFont ?? defaults.selectedFont
    this.bgColor = options.bgColor ?? defaults.bgColor
    this.textColor = options.textColor ?? defaults.textColor
    this.video = null
    this.toggle = null
    this.onStateChange = options.onStateChange || (() => {})
    this.onFirstCameraRequest = options.onFirstCameraRequest || (() => {})
    this.hasCameraRequest = false
  }

  applySettings(settings = {}) {
    if (typeof settings.enabled === "boolean") {
      this.enabled = settings.enabled
    }
    if (typeof settings.overlayText === "string") {
      this.overlayText = settings.overlayText
    }
    if (typeof settings.selectedFont === "string") {
      this.selectedFont = settings.selectedFont
    }
    if (typeof settings.bgColor === "string") {
      this.bgColor = settings.bgColor
    }
    if (typeof settings.textColor === "string") {
      this.textColor = settings.textColor
    }
  }

  initializeVideo() {
    if (this.video) return
    this.video = document.createElement("video")
    this.video.style = "display:none"
    this.video.setAttribute("playsinline", "")
    this.video.setAttribute("autoplay", "")
    document.body.appendChild(this.video)
  }

  createToggleCheckbox({ hidden = true } = {}) {
    if (this.toggle) return
    this.toggle = document.createElement("input")
    this.toggle.type = "checkbox"
    this.toggle.checked = this.enabled
    this.toggle.style = hidden
      ? "position:fixed;left:0;top:0;width:50px;height:10px;z-index:9999999;display:none"
      : "position:fixed;left:0;top:0;width:50px;height:10px;z-index:9999999"
    document.body.appendChild(this.toggle)
  }

  createTextOverlayMediaStream(oldStream) {
    this.initializeVideo()
    const camera = document.createElement("canvas")
    const comp = document.createElement("canvas")

    this.video.srcObject = oldStream

    const oldStreamSettings = oldStream.getVideoTracks()[0].getSettings()
    const w = oldStreamSettings.width
    const h = oldStreamSettings.height
    comp.width = w
    comp.height = h
    camera.width = w
    camera.height = h

    const cameraCtx = camera.getContext("2d")
    const compCtx = comp.getContext("2d")

    const draw = () => {
      compCtx.clearRect(0, 0, w, h)
      cameraCtx.drawImage(this.video, 0, 0, w, h)

      if (this.enabled && this.overlayText) {
        compCtx.fillStyle = this.bgColor
        compCtx.fillRect(0, 0, w, h)
        compCtx.font = `50px "${this.selectedFont}", sans-serif`
        compCtx.fillStyle = this.textColor
        compCtx.textAlign = "center"
        compCtx.textBaseline = "middle"
        compCtx.fillText(this.overlayText, w / 2, h / 2)
      } else {
        compCtx.drawImage(this.video, 0, 0, w, h)
      }

      requestAnimationFrame(draw)
    }

    draw()
    return comp.captureStream(30)
  }

  createPreviewModal() {
    const modalOverlay = document.createElement("div")
    modalOverlay.style.position = "fixed"
    modalOverlay.style.top = "0"
    modalOverlay.style.left = "0"
    modalOverlay.style.width = "100%"
    modalOverlay.style.height = "100%"
    modalOverlay.style.backgroundColor = "rgba(0, 0, 0, 0.5)"
    modalOverlay.style.display = "flex"
    modalOverlay.style.justifyContent = "center"
    modalOverlay.style.alignItems = "center"
    modalOverlay.style.zIndex = "10001"

    const modal = document.createElement("div")
    modal.style.backgroundColor = "#fff"
    modal.style.borderRadius = "8px"
    modal.style.padding = "30px"
    modal.style.boxShadow = "0 4px 20px rgba(0, 0, 0, 0.3)"
    modal.style.maxWidth = "500px"
    modal.style.width = "90%"
    modal.style.fontFamily = "system-ui, -apple-system, sans-serif"

    const title = document.createElement("h2")
    title.textContent = "Take one last look - are you camera-ready?"
    title.style.margin = "0 0 20px 0"
    title.style.fontSize = "20px"
    title.style.color = "#333"
    modal.appendChild(title)

    const previewVideo = document.createElement("video")
    previewVideo.style.width = "100%"
    previewVideo.style.borderRadius = "4px"
    previewVideo.style.marginBottom = "15px"
    previewVideo.style.backgroundColor = "#000"
    previewVideo.setAttribute("autoplay", "")
    previewVideo.setAttribute("playsinline", "")
    modal.appendChild(previewVideo)

    const confirmBtn = document.createElement("button")
    confirmBtn.textContent = "Yes, Disable Overlay"
    confirmBtn.style.width = "100%"
    confirmBtn.style.padding = "10px"
    confirmBtn.style.backgroundColor = "#d32f2f"
    confirmBtn.style.color = "white"
    confirmBtn.style.border = "none"
    confirmBtn.style.borderRadius = "4px"
    confirmBtn.style.fontSize = "14px"
    confirmBtn.style.fontWeight = "600"
    confirmBtn.style.cursor = "pointer"
    confirmBtn.style.transition = "background-color 0.2s"
    confirmBtn.onmouseover = () => (confirmBtn.style.backgroundColor = "#f44336")
    confirmBtn.onmouseout = () => (confirmBtn.style.backgroundColor = "#d32f2f")
    modal.appendChild(confirmBtn)

    modalOverlay.appendChild(modal)

    return {
      overlay: modalOverlay,
      previewVideo,
      confirmBtn
    }
  }

  createSettingsModal(isEnabling = false) {
    const modalOverlay = document.createElement("div")
    modalOverlay.style.position = "fixed"
    modalOverlay.style.top = "0"
    modalOverlay.style.left = "0"
    modalOverlay.style.width = "100%"
    modalOverlay.style.height = "100%"
    modalOverlay.style.backgroundColor = "rgba(0, 0, 0, 0.5)"
    modalOverlay.style.display = "flex"
    modalOverlay.style.justifyContent = "center"
    modalOverlay.style.alignItems = "center"
    modalOverlay.style.zIndex = "10001"

    const modal = document.createElement("div")
    modal.style.backgroundColor = "#fff"
    modal.style.borderRadius = "8px"
    modal.style.padding = "30px"
    modal.style.boxShadow = "0 4px 20px rgba(0, 0, 0, 0.3)"
    modal.style.maxWidth = "400px"
    modal.style.width = "90%"
    modal.style.fontFamily = "system-ui, -apple-system, sans-serif"

    const title = document.createElement("h2")
    title.textContent = "Camera Overlay Settings"
    title.style.margin = "0 0 20px 0"
    title.style.fontSize = "20px"
    title.style.color = "#333"
    modal.appendChild(title)

    const textLabel = document.createElement("label")
    textLabel.textContent = "Overlay Text"
    textLabel.style.display = "block"
    textLabel.style.marginBottom = "8px"
    textLabel.style.fontSize = "14px"
    textLabel.style.fontWeight = "500"
    textLabel.style.color = "#555"
    modal.appendChild(textLabel)

    const textInput = document.createElement("input")
    textInput.type = "text"
    textInput.value = this.overlayText
    textInput.style.width = "100%"
    textInput.style.padding = "10px"
    textInput.style.marginBottom = "15px"
    textInput.style.border = "1px solid #ddd"
    textInput.style.borderRadius = "4px"
    textInput.style.boxSizing = "border-box"
    textInput.style.fontSize = "14px"
    modal.appendChild(textInput)

    const fontLabel = document.createElement("label")
    fontLabel.textContent = "Font"
    fontLabel.style.display = "block"
    fontLabel.style.marginBottom = "8px"
    fontLabel.style.fontSize = "14px"
    fontLabel.style.fontWeight = "500"
    fontLabel.style.color = "#555"
    modal.appendChild(fontLabel)

    const fontSelect = document.createElement("select")
    fontSelect.style.width = "100%"
    fontSelect.style.padding = "10px"
    fontSelect.style.marginBottom = "15px"
    fontSelect.style.border = "1px solid #ddd"
    fontSelect.style.borderRadius = "4px"
    fontSelect.style.boxSizing = "border-box"
    fontSelect.style.fontSize = "14px"

    const fonts = ["Titillium Web", "Arial", "Verdana", "Times New Roman", "Courier New", "Georgia"]
    fonts.forEach(font => {
      const option = document.createElement("option")
      option.value = font
      option.textContent = font
      if (font === this.selectedFont) {
        option.selected = true
      }
      fontSelect.appendChild(option)
    })
    modal.appendChild(fontSelect)

    const bgColorLabel = document.createElement("label")
    bgColorLabel.textContent = "Background Color"
    bgColorLabel.style.display = "block"
    bgColorLabel.style.marginBottom = "8px"
    bgColorLabel.style.fontSize = "14px"
    bgColorLabel.style.fontWeight = "500"
    bgColorLabel.style.color = "#555"
    modal.appendChild(bgColorLabel)

    const bgColorInput = document.createElement("input")
    bgColorInput.type = "color"
    bgColorInput.value = this.bgColor
    bgColorInput.style.width = "100%"
    bgColorInput.style.height = "40px"
    bgColorInput.style.marginBottom = "15px"
    bgColorInput.style.border = "1px solid #ddd"
    bgColorInput.style.borderRadius = "4px"
    bgColorInput.style.cursor = "pointer"
    modal.appendChild(bgColorInput)

    const textColorLabel = document.createElement("label")
    textColorLabel.textContent = "Text Color"
    textColorLabel.style.display = "block"
    textColorLabel.style.marginBottom = "8px"
    textColorLabel.style.fontSize = "14px"
    textColorLabel.style.fontWeight = "500"
    textColorLabel.style.color = "#555"
    modal.appendChild(textColorLabel)

    const textColorInput = document.createElement("input")
    textColorInput.type = "color"
    textColorInput.value = this.textColor
    textColorInput.style.width = "100%"
    textColorInput.style.height = "40px"
    textColorInput.style.marginBottom = "15px"
    textColorInput.style.border = "1px solid #ddd"
    textColorInput.style.borderRadius = "4px"
    textColorInput.style.cursor = "pointer"
    modal.appendChild(textColorInput)

    const buttonContainer = document.createElement("div")
    buttonContainer.style.display = "flex"
    buttonContainer.style.gap = "10px"
    buttonContainer.style.marginTop = "20px"

    const enableBtn = document.createElement("button")
    enableBtn.textContent = isEnabling ? "Enable Overlay" : "Save Settings"
    enableBtn.style.flex = "1"
    enableBtn.style.padding = "10px"
    enableBtn.style.backgroundColor = "#6200ea"
    enableBtn.style.color = "white"
    enableBtn.style.border = "none"
    enableBtn.style.borderRadius = "4px"
    enableBtn.style.fontSize = "14px"
    enableBtn.style.fontWeight = "600"
    enableBtn.style.cursor = "pointer"
    enableBtn.style.transition = "background-color 0.2s"
    enableBtn.onmouseover = () => (enableBtn.style.backgroundColor = "#7c3aed")
    enableBtn.onmouseout = () => (enableBtn.style.backgroundColor = "#6200ea")

    const cancelBtn = document.createElement("button")
    cancelBtn.textContent = "Cancel"
    cancelBtn.style.flex = "1"
    cancelBtn.style.padding = "10px"
    cancelBtn.style.backgroundColor = "#999"
    cancelBtn.style.color = "white"
    cancelBtn.style.border = "none"
    cancelBtn.style.borderRadius = "4px"
    cancelBtn.style.fontSize = "14px"
    cancelBtn.style.fontWeight = "600"
    cancelBtn.style.cursor = "pointer"
    cancelBtn.style.transition = "background-color 0.2s"
    cancelBtn.onmouseover = () => (cancelBtn.style.backgroundColor = "#aaa")
    cancelBtn.onmouseout = () => (cancelBtn.style.backgroundColor = "#999")

    buttonContainer.appendChild(enableBtn)
    buttonContainer.appendChild(cancelBtn)
    modal.appendChild(buttonContainer)

    modalOverlay.appendChild(modal)

    return {
      overlay: modalOverlay,
      textInput,
      fontSelect,
      bgColorInput,
      textColorInput,
      enableBtn,
      cancelBtn
    }
  }

  setEnabled(enabled) {
    this.enabled = enabled
    if (this.toggle) {
      this.toggle.checked = enabled
    }
    this.onStateChange({ enabled: this.enabled })
  }

  patchGetUserMedia() {
    const manager = this

    async function newGetUserMedia(constraints) {
      if (constraints && constraints.video) {
        if (!manager.hasCameraRequest) {
          manager.hasCameraRequest = true
          manager.onFirstCameraRequest()
        }
      }

      if (constraints && constraints.video) {
        const oldStream = await navigator.mediaDevices.oldGetUserMedia(constraints)
        const overlayStream = manager.createTextOverlayMediaStream(oldStream)

        if (constraints.audio) {
          const combined = new MediaStream()
          overlayStream.getVideoTracks().forEach(track => combined.addTrack(track))
          oldStream.getAudioTracks().forEach(track => combined.addTrack(track))
          return combined
        }

        return overlayStream
      }

      return navigator.mediaDevices.oldGetUserMedia(constraints)
    }

    if (!navigator.mediaDevices.oldGetUserMedia) {
      navigator.mediaDevices.oldGetUserMedia = navigator.mediaDevices.getUserMedia
      navigator.mediaDevices.getUserMedia = newGetUserMedia
    }
  }

  initializeCore({ hideToggle = true } = {}) {
    this.initializeVideo()
    this.createToggleCheckbox({ hidden: hideToggle })
    this.patchGetUserMedia()
  }
}

export function injectGoogleFonts() {
  const link = document.createElement("link")
  link.href = "https://fonts.googleapis.com/css2?family=Titillium+Web:wght@400;600&display=swap"
  link.rel = "stylesheet"
  document.head.appendChild(link)
}
