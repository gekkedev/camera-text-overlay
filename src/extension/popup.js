// Popup script for the Chrome extension
// Syncs settings with content script via chrome.storage

const overlayTextInput = document.getElementById("overlayText")
const selectedFontSelect = document.getElementById("selectedFont")
const bgColorInput = document.getElementById("bgColor")
const textColorInput = document.getElementById("textColor")
const toggleBtn = document.getElementById("toggleBtn")
const saveBtn = document.getElementById("saveBtn")
const statusDiv = document.getElementById("status")

let currentState = {
  enabled: false,
  overlayText: "be right back 😴",
  selectedFont: "Titillium Web",
  bgColor: "#101010",
  textColor: "#ffd744"
}

// Load saved settings
function loadSettings() {
  chrome.storage.local.get(
    ["overlayEnabled", "overlayText", "selectedFont", "bgColor", "textColor"],
    result => {
      currentState.enabled = result.overlayEnabled || false
      currentState.overlayText = result.overlayText || "be right back 😴"
      currentState.selectedFont = result.selectedFont || "Titillium Web"
      currentState.bgColor = result.bgColor || "#101010"
      currentState.textColor = result.textColor || "#ffd744"

      updateUI()
    }
  )
}

function updateUI() {
  overlayTextInput.value = currentState.overlayText
  selectedFontSelect.value = currentState.selectedFont
  bgColorInput.value = currentState.bgColor
  textColorInput.value = currentState.textColor

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
    textColor: currentState.textColor
  })

  // Notify content scripts of the change
  chrome.tabs.query({}, tabs => {
    tabs.forEach(tab => {
      chrome.tabs.sendMessage(tab.id, {
        type: "SETTINGS_UPDATED",
        settings: currentState
      }).catch(() => {
        // Tab doesn't have content script, ignore
      })
    })
  })
}

// Input change handlers - just update the currentState, save via Save button
overlayTextInput.addEventListener("change", () => {
  currentState.overlayText = overlayTextInput.value.trim() || "be right back 😴"
})

selectedFontSelect.addEventListener("change", () => {
  currentState.selectedFont = selectedFontSelect.value
})

bgColorInput.addEventListener("change", () => {
  currentState.bgColor = bgColorInput.value
})

textColorInput.addEventListener("change", () => {
  currentState.textColor = textColorInput.value
})

// Save Settings button - saves the form configuration
saveBtn.addEventListener("click", () => {
  currentState.overlayText = overlayTextInput.value.trim() || "be right back 😴"
  currentState.selectedFont = selectedFontSelect.value
  currentState.bgColor = bgColorInput.value
  currentState.textColor = textColorInput.value
  saveSettings()
})

// Toggle button - enables/disables the overlay
toggleBtn.addEventListener("click", () => {
  if (currentState.enabled) {
    currentState.enabled = false
    saveSettings()
    updateUI()
  } else {
    // Enable overlay
    if (!currentState.overlayText.trim()) {
      alert("Please enter some text first")
      return
    }
    currentState.enabled = true
    saveSettings()
    updateUI()
  }
})

// Load settings when popup opens
loadSettings()

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
    updateUI()
  }
})
