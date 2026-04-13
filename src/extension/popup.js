// Popup script for the Chrome extension
// Syncs settings with content script via chrome.storage

const overlayTextInput = document.getElementById("overlayText")
const selectedFontSelect = document.getElementById("selectedFont")
const bgColorInput = document.getElementById("bgColor")
const textColorInput = document.getElementById("textColor")
const previewBeforeToggleInput = document.getElementById("previewBeforeToggle")
const toggleBtn = document.getElementById("toggleBtn")
const saveBtn = document.getElementById("saveBtn")
const statusDiv = document.getElementById("status")
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

let currentState = {
  enabled: false,
  overlayText: "be right back 😴",
  selectedFont: "Titillium Web",
  bgColor: "#101010",
  textColor: "#ffd744",
  previewBeforeToggle: false
}

// Load saved settings
function loadSettings() {
  chrome.storage.local.get(
    ["overlayEnabled", "overlayText", "selectedFont", "bgColor", "textColor", "previewBeforeToggle"],
    result => {
      currentState.enabled = result.overlayEnabled === true
      currentState.overlayText = result.overlayText || "be right back 😴"
      currentState.selectedFont = result.selectedFont || "Titillium Web"
      currentState.bgColor = result.bgColor || "#101010"
      currentState.textColor = result.textColor || "#ffd744"
      currentState.previewBeforeToggle = result.previewBeforeToggle === true

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
}

function applySnapshot(settings = {}) {
  currentState.overlayText = settings.overlayText ?? currentState.overlayText
  currentState.selectedFont = settings.selectedFont ?? currentState.selectedFont
  currentState.bgColor = settings.bgColor ?? currentState.bgColor
  currentState.textColor = settings.textColor ?? currentState.textColor
  currentState.previewBeforeToggle = settings.previewBeforeToggle ?? currentState.previewBeforeToggle
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
  previewSection.hidden = !currentState.previewBeforeToggle

  if (currentState.enabled) {
    statusDiv.textContent = "✓ Overlay Enabled"
    statusDiv.className = "status enabled"
    toggleBtn.textContent = "⏹️ Disable Overlay"
    toggleBtn.className = "btn-disable"
  } else {
    statusDiv.textContent = "✗ Overlay Disabled"
    statusDiv.className = "status disabled"
    toggleBtn.textContent = "📹 Enable Overlay"
    toggleBtn.className = "btn-enable"
  }
}

function saveSettings() {
  chrome.storage.local.set({
    overlayEnabled: currentState.enabled,
    overlayText: currentState.overlayText,
    selectedFont: currentState.selectedFont,
    bgColor: currentState.bgColor,
    textColor: currentState.textColor,
    previewBeforeToggle: currentState.previewBeforeToggle
  })

  // Notify content scripts of the change
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

// Input change handlers - just update the currentState, save via Save button
overlayTextInput.addEventListener("input", () => {
  currentState.overlayText = overlayTextInput.value.trim() || "be right back 😴"
  refreshOverlayPreviewIfVisible()
})

selectedFontSelect.addEventListener("change", () => {
  currentState.selectedFont = selectedFontSelect.value
  refreshOverlayPreviewIfVisible()
})

bgColorInput.addEventListener("change", () => {
  currentState.bgColor = bgColorInput.value
  refreshOverlayPreviewIfVisible()
})

textColorInput.addEventListener("change", () => {
  currentState.textColor = textColorInput.value
  refreshOverlayPreviewIfVisible()
})

previewBeforeToggleInput.addEventListener("change", () => {
  currentState.previewBeforeToggle = previewBeforeToggleInput.checked
  updateUI()
  renderPreview()
})

// Save Settings button - saves the form configuration
saveBtn.addEventListener("click", () => {
  syncStateFromInputs()
  saveSettings()
  refreshOverlayPreviewIfVisible()
})

// Toggle button - enables/disables the overlay
toggleBtn.addEventListener("click", () => {
  syncStateFromInputs()
  const targetEnabled = !currentState.enabled

  if (targetEnabled && !currentState.overlayText.trim()) {
    alert("Please enter some text first")
    return
  }

  commitToggle(targetEnabled)
})

// Load settings when popup opens
loadSettings()

window.addEventListener("unload", () => {
  stopPreviewStream()
})

// Listen for storage changes from other windows/tabs
chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName === "local") {
    if (changes.overlayEnabled) {
      currentState.enabled = changes.overlayEnabled.newValue
    }
    if (changes.overlayText) {
      currentState.overlayText = changes.overlayText.newValue
    }
    if (changes.selectedFont) {
      currentState.selectedFont = changes.selectedFont.newValue
    }
    if (changes.bgColor) {
      currentState.bgColor = changes.bgColor.newValue
    }
    if (changes.textColor) {
      currentState.textColor = changes.textColor.newValue
    }
    if (changes.previewBeforeToggle) {
      currentState.previewBeforeToggle = changes.previewBeforeToggle.newValue === true
    }
    updateUI()
    renderPreview()
  }
})
