// Background service worker for Chrome extension
// Minimal implementation - just needed for manifest v3

chrome.runtime.onInstalled.addListener(() => {
  console.log("Camera Text Overlay extension installed")
})

const injectedTabs = new Set()

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request && request.type === "INJECT_OVERLAY" && sender.tab?.id != null) {
    const tabId = sender.tab.id
    if (injectedTabs.has(tabId)) {
      sendResponse({ injected: true })
      return
    }

    chrome.scripting
      .executeScript({
        target: { tabId, allFrames: true },
        files: ["page-bridge.js"],
        world: "MAIN"
      })
      .then(() => {
        injectedTabs.add(tabId)
        sendResponse({ injected: true })
      })
      .catch(error => {
        console.warn("Overlay injection failed", error)
        sendResponse({ injected: false })
      })

    return true
  }
})

chrome.tabs.onRemoved.addListener(tabId => {
  injectedTabs.delete(tabId)
})
