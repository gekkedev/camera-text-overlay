// Background service worker for Chrome extension
// Minimal implementation - just needed for manifest v3

chrome.runtime.onInstalled.addListener(() => {
  console.log("Camera Text Overlay extension installed")
})
