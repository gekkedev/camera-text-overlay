// ==UserScript==
// @name         Camera Text Overlay
// @namespace    https://github.com/gekkedev/camera-text-overlay
// @version      1.0
// @description  Replaces the camera stream with specified text for others to see
// @author       gekkedev
// @match        *://*/*
// @grant        none
// ==/UserScript==

;(async function () {
  "use strict"

  let enabled = false
  let overlayText = ""
  let selectedFont = "Titillium Web"
  let bgColor = "#101010"
  let textColor = "#ffd744"

  // Load preferences from localStorage
  function loadPreferences() {
    overlayText = localStorage.getItem("overlayText") || "be right back 😴"
    selectedFont = localStorage.getItem("selectedFont") || "Titillium Web"
    bgColor = localStorage.getItem("bgColor") || "#101010"
    textColor = localStorage.getItem("textColor") || "#ffd744"
    enabled = localStorage.getItem("overlayEnabled") === "true"
  }

  function savePreferences() {
    localStorage.setItem("overlayText", overlayText)
    localStorage.setItem("selectedFont", selectedFont)
    localStorage.setItem("bgColor", bgColor)
    localStorage.setItem("textColor", textColor)
    localStorage.setItem("overlayEnabled", enabled)
  }

  loadPreferences()

  const video = document.createElement("video")
  video.style = "display:none"
  video.setAttribute("playsinline", "")
  video.setAttribute("autoplay", "")

  const toggle = document.createElement("input")
  toggle.type = "checkbox"
  toggle.checked = enabled
  toggle.style = "position:fixed;left:0;top:0;width:50px;height:10px;z-index:9999999"

  document.body.appendChild(video)

  class TextOverlayMediaStream extends MediaStream {
    constructor(old_stream) {
      super(old_stream)

      const camera = document.createElement("canvas")
      const comp = document.createElement("canvas")

      video.srcObject = old_stream

      const old_stream_settings = old_stream.getVideoTracks()[0].getSettings()

      const w = old_stream_settings.width
      const h = old_stream_settings.height
      const aspect_ratio = w / h
      const r = w / 64
      comp.width = w
      comp.height = h
      camera.width = w
      camera.height = h

      const camera_ctx = camera.getContext("2d")
      const comp_ctx = comp.getContext("2d")

      function draw() {
        comp_ctx.clearRect(0, 0, w, h)
        camera_ctx.drawImage(video, 0, 0, w, h)

        if (toggle.checked && overlayText) {
          // Draw the dark background
          comp_ctx.fillStyle = bgColor
          comp_ctx.fillRect(0, 0, w, h)
          // Draw the text overlay
          comp_ctx.font = `50px "${selectedFont}", sans-serif`
          comp_ctx.fillStyle = textColor
          comp_ctx.textAlign = "center"
          comp_ctx.textBaseline = "middle"
          comp_ctx.fillText(overlayText, w / 2, h / 2)
        } else {
          // Show the camera feed directly
          comp_ctx.drawImage(video, 0, 0, w, h)
        }

        requestAnimationFrame(draw)
      }

      draw()

      return comp.captureStream(30)
    }
  }



  function createPreviewModal() {
    // Create modal overlay
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

    // Create modal content
    const modal = document.createElement("div")
    modal.style.backgroundColor = "#fff"
    modal.style.borderRadius = "8px"
    modal.style.padding = "30px"
    modal.style.boxShadow = "0 4px 20px rgba(0, 0, 0, 0.3)"
    modal.style.maxWidth = "500px"
    modal.style.width = "90%"
    modal.style.fontFamily = "system-ui, -apple-system, sans-serif"

    // Title
    const title = document.createElement("h2")
    title.textContent = "Take one last look - are you camera-ready?"
    title.style.margin = "0 0 20px 0"
    title.style.fontSize = "20px"
    title.style.color = "#333"
    modal.appendChild(title)

    // Video preview
    const previewVideo = document.createElement("video")
    previewVideo.style.width = "100%"
    previewVideo.style.borderRadius = "4px"
    previewVideo.style.marginBottom = "15px"
    previewVideo.style.backgroundColor = "#000"
    previewVideo.setAttribute("autoplay", "")
    previewVideo.setAttribute("playsinline", "")
    modal.appendChild(previewVideo)

    // Confirm button
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

  function createModal() {
    // Create modal overlay
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

    // Create modal content
    const modal = document.createElement("div")
    modal.style.backgroundColor = "#fff"
    modal.style.borderRadius = "8px"
    modal.style.padding = "30px"
    modal.style.boxShadow = "0 4px 20px rgba(0, 0, 0, 0.3)"
    modal.style.maxWidth = "400px"
    modal.style.width = "90%"
    modal.style.fontFamily = "system-ui, -apple-system, sans-serif"

    // Title
    const title = document.createElement("h2")
    title.textContent = "Camera Overlay Settings"
    title.style.margin = "0 0 20px 0"
    title.style.fontSize = "20px"
    title.style.color = "#333"
    modal.appendChild(title)

    // Text input
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
    textInput.value = overlayText
    textInput.style.width = "100%"
    textInput.style.padding = "10px"
    textInput.style.marginBottom = "15px"
    textInput.style.border = "1px solid #ddd"
    textInput.style.borderRadius = "4px"
    textInput.style.boxSizing = "border-box"
    textInput.style.fontSize = "14px"
    modal.appendChild(textInput)

    // Font selector
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
      if (font === selectedFont) {
        option.selected = true
      }
      fontSelect.appendChild(option)
    })
    modal.appendChild(fontSelect)

    // BG Color picker
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
    bgColorInput.value = bgColor
    bgColorInput.style.width = "100%"
    bgColorInput.style.height = "40px"
    bgColorInput.style.marginBottom = "15px"
    bgColorInput.style.border = "1px solid #ddd"
    bgColorInput.style.borderRadius = "4px"
    bgColorInput.style.cursor = "pointer"
    modal.appendChild(bgColorInput)

    // Text Color picker
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
    textColorInput.value = textColor
    textColorInput.style.width = "100%"
    textColorInput.style.height = "40px"
    textColorInput.style.marginBottom = "15px"
    textColorInput.style.border = "1px solid #ddd"
    textColorInput.style.borderRadius = "4px"
    textColorInput.style.cursor = "pointer"
    modal.appendChild(textColorInput)

    // Buttons container
    const buttonContainer = document.createElement("div")
    buttonContainer.style.display = "flex"
    buttonContainer.style.gap = "10px"
    buttonContainer.style.marginTop = "20px"

    // Enable button
    const enableBtn = document.createElement("button")
    enableBtn.textContent = "Enable Overlay"
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

    // Cancel button
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

  function updateButtonText() {
    if (toggleButton) {
      toggleButton.innerText = enabled ? "⏹️ Disable Overlay" : "📹 Enable Overlay"
    }
  }

  async function toggleFeature() {
    if (enabled) {
      // Show preview modal to confirm disable
      const previewData = createPreviewModal()
      document.body.appendChild(previewData.overlay)

      // Get user media and show preview
      try {
        const stream = await navigator.mediaDevices.oldGetUserMedia({ video: true })
        previewData.previewVideo.srcObject = stream

        previewData.confirmBtn.onclick = async () => {
          // Stop the preview stream
          stream.getTracks().forEach(track => track.stop())

          // Disable overlay
          enabled = false
          toggle.checked = false
          localStorage.setItem("overlayEnabled", "false")
          updateButtonText()

          previewData.overlay.remove()
        }
      } catch (e) {
        console.error("Error accessing camera for preview:", e)
        previewData.overlay.remove()
      }
    } else {
      // Show modal to enable overlay
      const modalData = createModal()
      document.body.appendChild(modalData.overlay)

      modalData.cancelBtn.onclick = () => {
        modalData.overlay.remove()
      }

      modalData.enableBtn.onclick = async () => {
        overlayText = modalData.textInput.value.trim()
        selectedFont = modalData.fontSelect.value
        bgColor = modalData.bgColorInput.value
        textColor = modalData.textColorInput.value

        if (!overlayText) {
          alert("Please enter some text")
          return
        }

        enabled = true
        toggle.checked = true
        savePreferences()
        updateButtonText()

        modalData.overlay.remove()
      }

      // Focus on text input
      modalData.textInput.focus()
      modalData.textInput.select()
    }
  }

  let toggleButton = null

  function addToggleButton() {
    const button = document.createElement("button")
    button.innerText = enabled ? "⏹️ Disable Overlay" : "📹 Enable Overlay"
    button.style.position = "fixed"
    button.style.top = "50vh"
    button.style.right = "10px"
    button.style.zIndex = "10000"
    button.style.padding = "12px 16px"
    button.style.backgroundColor = "#6200ea"
    button.style.color = "white"
    button.style.border = "none"
    button.style.borderRadius = "6px"
    button.style.cursor = "pointer"
    button.style.fontSize = "14px"
    button.style.fontWeight = "600"
    button.style.boxShadow = "0 2px 8px rgba(0, 0, 0, 0.2)"
    button.style.transition = "all 0.2s ease"
    button.style.fontFamily = "system-ui, -apple-system, sans-serif"

    button.onmouseover = () => {
      button.style.backgroundColor = "#7c3aed"
      button.style.boxShadow = "0 4px 12px rgba(98, 0, 234, 0.3)"
      button.style.transform = "scale(1.05)"
    }

    button.onmouseout = () => {
      button.style.backgroundColor = "#6200ea"
      button.style.boxShadow = "0 2px 8px rgba(0, 0, 0, 0.2)"
      button.style.transform = "scale(1)"
    }

    button.onclick = toggleFeature
    document.body.appendChild(button)
    toggleButton = button
  }

  // Load additional fonts
  const link = document.createElement("link")
  link.href = "https://fonts.googleapis.com/css2?family=Titillium+Web:wght@400;600&display=swap"
  link.rel = "stylesheet"
  document.head.appendChild(link)

  async function newGetUserMedia(constraints) {
    if (constraints && constraints.video && !constraints.audio) {
      const old_stream = await navigator.mediaDevices.oldGetUserMedia(constraints)
      return new TextOverlayMediaStream(old_stream)
    } else {
      return navigator.mediaDevices.oldGetUserMedia(constraints)
    }
  }

  MediaDevices.prototype.oldGetUserMedia = MediaDevices.prototype.getUserMedia
  MediaDevices.prototype.getUserMedia = newGetUserMedia

  // Wait for the document to be fully loaded before adding the button
  window.addEventListener("load", function () {
    addToggleButton()
  })
})()
