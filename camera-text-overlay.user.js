// ==UserScript==
// @name         Camera Text Overlay
// @namespace    https://github.com/gekkedev/camera-text-overlay
// @version      2.2.0
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
  /**
 * Shared overlay functionality for Camera Text Overlay
 * Used by both the Chrome extension and userscript
 */

const DEFAULT_OVERLAY_SETTINGS = {
  enabled: false,
  overlayText: "be right back 😴",
  selectedFont: "Titillium Web",
  bgColor: "#101010",
  textColor: "#ffd744",
  previewBeforeToggle: false,
  elevatorStyleMusic: false,
  selectedMusicTrack: "Corporate Calm™.mp3",
  waitingMusicUrl: ""
}

class TextOverlayManager {
  constructor(options = {}) {
    const defaults = DEFAULT_OVERLAY_SETTINGS
    this.enabled = options.enabled ?? defaults.enabled
    this.overlayText = options.overlayText ?? defaults.overlayText
    this.selectedFont = options.selectedFont ?? defaults.selectedFont
    this.bgColor = options.bgColor ?? defaults.bgColor
    this.textColor = options.textColor ?? defaults.textColor
    this.previewBeforeToggle = options.previewBeforeToggle ?? defaults.previewBeforeToggle
    this.elevatorStyleMusic = options.elevatorStyleMusic ?? defaults.elevatorStyleMusic
    this.selectedMusicTrack = options.selectedMusicTrack ?? defaults.selectedMusicTrack
    this.waitingMusicUrl = options.waitingMusicUrl ?? defaults.waitingMusicUrl
    this.toggle = null
    this.mediaDevices = options.mediaDevices || navigator.mediaDevices
    this.onStateChange = options.onStateChange || (() => {})
    this.onFirstCameraRequest = options.onFirstCameraRequest || (() => {})
    this.hasCameraRequest = false
    this.patchRetryTimer = null
    this.activeAudioMixControllers = new Set()
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
    if (typeof settings.previewBeforeToggle === "boolean") {
      this.previewBeforeToggle = settings.previewBeforeToggle
    }
    if (typeof settings.elevatorStyleMusic === "boolean") {
      this.elevatorStyleMusic = settings.elevatorStyleMusic
    }
    if (typeof settings.selectedMusicTrack === "string") {
      this.selectedMusicTrack = settings.selectedMusicTrack
    }
    if (typeof settings.waitingMusicUrl === "string") {
      this.waitingMusicUrl = settings.waitingMusicUrl
    }

    this.syncManagedAudioMixers()
  }

  getSettingsSnapshot(overrides = {}) {
    return {
      enabled: typeof overrides.enabled === "boolean" ? overrides.enabled : this.enabled,
      overlayText: typeof overrides.overlayText === "string" ? overrides.overlayText : this.overlayText,
      selectedFont: typeof overrides.selectedFont === "string" ? overrides.selectedFont : this.selectedFont,
      bgColor: typeof overrides.bgColor === "string" ? overrides.bgColor : this.bgColor,
      textColor: typeof overrides.textColor === "string" ? overrides.textColor : this.textColor,
      previewBeforeToggle:
        typeof overrides.previewBeforeToggle === "boolean" ? overrides.previewBeforeToggle : this.previewBeforeToggle,
      elevatorStyleMusic:
        typeof overrides.elevatorStyleMusic === "boolean" ? overrides.elevatorStyleMusic : this.elevatorStyleMusic,
      selectedMusicTrack:
        typeof overrides.selectedMusicTrack === "string" ? overrides.selectedMusicTrack : this.selectedMusicTrack,
      waitingMusicUrl: typeof overrides.waitingMusicUrl === "string" ? overrides.waitingMusicUrl : this.waitingMusicUrl
    }
  }

  stopStream(stream) {
    if (!stream || typeof stream.getTracks !== "function") {
      return
    }

    stream.getTracks().forEach(track => {
      if (track.readyState !== "ended") {
        track.stop()
      }
    })
  }

  getMountTarget() {
    return document.body || document.documentElement || document.head || null
  }

  appendElement(element) {
    if (element.isConnected) return

    const mountTarget = this.getMountTarget()
    if (mountTarget) {
      mountTarget.appendChild(element)
      return
    }

    document.addEventListener(
      "DOMContentLoaded",
      () => {
        const readyMountTarget = this.getMountTarget()
        if (readyMountTarget && !element.isConnected) {
          readyMountTarget.appendChild(element)
        }
      },
      { once: true }
    )
  }

  getNativeGetUserMedia() {
    const mediaDevices = this.mediaDevices || navigator.mediaDevices
    if (!mediaDevices) return null

    const getUserMedia = mediaDevices.oldGetUserMedia || mediaDevices.getUserMedia
    return typeof getUserMedia === "function" ? getUserMedia.bind(mediaDevices) : null
  }

  scheduleGetUserMediaPatchRetry() {
    if (this.patchRetryTimer != null) {
      return
    }

    this.patchRetryTimer = window.setTimeout(() => {
      this.patchRetryTimer = null
      this.patchGetUserMedia()
    }, 100)
  }

  getTrackSettings(track) {
    if (!track || typeof track.getSettings !== "function") {
      return {}
    }
    return track.getSettings() || {}
  }

  getVideoTrackSize(track) {
    const settings = this.getTrackSettings(track)
    return {
      width: Number(settings.width) > 0 ? Number(settings.width) : 1280,
      height: Number(settings.height) > 0 ? Number(settings.height) : 720,
      frameRate: Number(settings.frameRate) > 0 ? Number(settings.frameRate) : 30
    }
  }

  syncManagedAudioMixers() {
    this.activeAudioMixControllers.forEach(controller => {
      Promise.resolve(controller.sync()).catch(() => {})
    })
  }

  updateGainNode(gainNode, value, audioContext) {
    if (!gainNode || !gainNode.gain || typeof gainNode.gain.setValueAtTime !== "function") {
      return
    }

    if (typeof gainNode.gain.cancelScheduledValues === "function") {
      gainNode.gain.cancelScheduledValues(audioContext.currentTime)
    }

    gainNode.gain.setValueAtTime(value, audioContext.currentTime)
  }

  decorateOverlayTrack({ overlayTrack, sourceTrack, resizeCanvas, cleanup }) {
    if (!overlayTrack || !sourceTrack) return

    const nativeGetSettings =
      typeof overlayTrack.getSettings === "function" ? overlayTrack.getSettings.bind(overlayTrack) : null
    const nativeGetCapabilities =
      typeof overlayTrack.getCapabilities === "function" ? overlayTrack.getCapabilities.bind(overlayTrack) : null
    const nativeGetConstraints =
      typeof overlayTrack.getConstraints === "function" ? overlayTrack.getConstraints.bind(overlayTrack) : null
    const nativeApplyConstraints =
      typeof overlayTrack.applyConstraints === "function" ? overlayTrack.applyConstraints.bind(overlayTrack) : null
    const nativeStop = typeof overlayTrack.stop === "function" ? overlayTrack.stop.bind(overlayTrack) : null

    overlayTrack.getSettings = () => ({
      ...(nativeGetSettings ? nativeGetSettings() : {}),
      ...this.getTrackSettings(sourceTrack)
    })

    if (typeof sourceTrack.getCapabilities === "function" || nativeGetCapabilities) {
      overlayTrack.getCapabilities = () => {
        if (typeof sourceTrack.getCapabilities === "function") {
          return sourceTrack.getCapabilities() || {}
        }
        return nativeGetCapabilities ? nativeGetCapabilities() : {}
      }
    }

    if (typeof sourceTrack.getConstraints === "function" || nativeGetConstraints) {
      overlayTrack.getConstraints = () => {
        if (typeof sourceTrack.getConstraints === "function") {
          return sourceTrack.getConstraints() || {}
        }
        return nativeGetConstraints ? nativeGetConstraints() : {}
      }
    }

    if (typeof sourceTrack.applyConstraints === "function" || nativeApplyConstraints) {
      overlayTrack.applyConstraints = async constraints => {
        if (typeof sourceTrack.applyConstraints === "function") {
          await sourceTrack.applyConstraints(constraints)
          resizeCanvas(this.getTrackSettings(sourceTrack))
        }

        if (nativeApplyConstraints) {
          try {
            await nativeApplyConstraints(constraints)
          } catch (error) {
            // Canvas tracks often ignore video-device constraints that the source track accepts.
          }
        }
      }
    }

    overlayTrack.stop = () => {
      cleanup()
      if (nativeStop) {
        nativeStop()
      }
    }
  }

  decorateAudioTrack({ mixedTrack, sourceTrack, cleanup }) {
    if (!mixedTrack) return

    const nativeGetSettings = typeof mixedTrack.getSettings === "function" ? mixedTrack.getSettings.bind(mixedTrack) : null
    const nativeGetCapabilities =
      typeof mixedTrack.getCapabilities === "function" ? mixedTrack.getCapabilities.bind(mixedTrack) : null
    const nativeGetConstraints =
      typeof mixedTrack.getConstraints === "function" ? mixedTrack.getConstraints.bind(mixedTrack) : null
    const nativeApplyConstraints =
      typeof mixedTrack.applyConstraints === "function" ? mixedTrack.applyConstraints.bind(mixedTrack) : null
    const nativeStop = typeof mixedTrack.stop === "function" ? mixedTrack.stop.bind(mixedTrack) : null

    mixedTrack.getSettings = () => ({
      ...(nativeGetSettings ? nativeGetSettings() : {}),
      ...this.getTrackSettings(sourceTrack)
    })

    if ((sourceTrack && typeof sourceTrack.getCapabilities === "function") || nativeGetCapabilities) {
      mixedTrack.getCapabilities = () => {
        if (sourceTrack && typeof sourceTrack.getCapabilities === "function") {
          return sourceTrack.getCapabilities() || {}
        }
        return nativeGetCapabilities ? nativeGetCapabilities() : {}
      }
    }

    if ((sourceTrack && typeof sourceTrack.getConstraints === "function") || nativeGetConstraints) {
      mixedTrack.getConstraints = () => {
        if (sourceTrack && typeof sourceTrack.getConstraints === "function") {
          return sourceTrack.getConstraints() || {}
        }
        return nativeGetConstraints ? nativeGetConstraints() : {}
      }
    }

    if ((sourceTrack && typeof sourceTrack.applyConstraints === "function") || nativeApplyConstraints) {
      mixedTrack.applyConstraints = async constraints => {
        if (sourceTrack && typeof sourceTrack.applyConstraints === "function") {
          await sourceTrack.applyConstraints(constraints)
        }

        if (nativeApplyConstraints) {
          try {
            await nativeApplyConstraints(constraints)
          } catch (error) {
            // Destination tracks often ignore device-level constraints that the source track accepts.
          }
        }
      }
    }

    mixedTrack.stop = () => {
      cleanup()
      if (nativeStop) {
        nativeStop()
      }
    }
  }

  createManagedAudioStream(oldStream) {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext
    if (!AudioContextClass) {
      return oldStream
    }

    const sourceTrack = oldStream.getAudioTracks()[0] || null
    const audioContext = new AudioContextClass()
    const mixedDestination = audioContext.createMediaStreamDestination()
    const mixedTrack = mixedDestination.stream.getAudioTracks()[0]
    const micGain = audioContext.createGain()
    const musicGain = audioContext.createGain()
    let micSource = null
    let activeMusicSource = null
    let isCleanedUp = false
    let activeMusicUrl = ""
    let loadedMusicUrl = ""
    let loadedMusicBuffer = null
    let loadToken = 0

    if (typeof audioContext.resume === "function") {
      audioContext.resume().catch(() => {})
    }

    if (sourceTrack) {
      const micStream = new MediaStream()
      oldStream.getAudioTracks().forEach(track => micStream.addTrack(track))
      micSource = audioContext.createMediaStreamSource(micStream)
      micSource.connect(micGain)
    }

    micGain.connect(mixedDestination)
    musicGain.connect(mixedDestination)

    const stopActiveMusicSource = () => {
      if (!activeMusicSource) {
        return
      }

      const source = activeMusicSource
      activeMusicSource = null
      activeMusicUrl = ""

      if (typeof source.disconnect === "function") {
        source.disconnect()
      }

      try {
        source.stop()
      } catch (error) {
        // Ignore stop calls on already-ended buffer sources.
      }
    }

    const decodeAudioBuffer = arrayBuffer =>
      new Promise((resolve, reject) => {
        const bufferCopy = arrayBuffer.slice(0)
        const maybePromise = audioContext.decodeAudioData(bufferCopy, resolve, reject)
        if (maybePromise && typeof maybePromise.then === "function") {
          maybePromise.then(resolve).catch(reject)
        }
      })

    const loadWaitingMusicBuffer = async waitingMusicUrl => {
      if (!waitingMusicUrl) {
        return null
      }

      if (loadedMusicUrl === waitingMusicUrl && loadedMusicBuffer) {
        return loadedMusicBuffer
      }

      const currentLoadToken = ++loadToken
      const response = await fetch(waitingMusicUrl)
      if (!response.ok) {
        throw new Error(`Could not load waiting music: ${response.status}`)
      }

      const arrayBuffer = await response.arrayBuffer()
      if (isCleanedUp || currentLoadToken !== loadToken) {
        return null
      }

      const decodedBuffer = await decodeAudioBuffer(arrayBuffer)
      if (isCleanedUp || currentLoadToken !== loadToken) {
        return null
      }

      loadedMusicUrl = waitingMusicUrl
      loadedMusicBuffer = decodedBuffer
      return decodedBuffer
    }

    const cleanup = () => {
      if (isCleanedUp) return
      isCleanedUp = true
      this.activeAudioMixControllers.delete(controller)
      loadToken += 1
      stopActiveMusicSource()

      oldStream.getAudioTracks().forEach(track => {
        if (track.readyState !== "ended") {
          track.stop()
        }
      })

      if (micSource && typeof micSource.disconnect === "function") {
        micSource.disconnect()
      }
      if (typeof micGain.disconnect === "function") {
        micGain.disconnect()
      }
      if (typeof musicGain.disconnect === "function") {
        musicGain.disconnect()
      }
      if (typeof audioContext.close === "function") {
        audioContext.close().catch(() => {})
      }
    }

    const controller = {
      sync: async () => {
        if (isCleanedUp) {
          return
        }

        const targetMusicUrl = this.waitingMusicUrl
        const shouldUseMusic = Boolean(this.enabled && this.elevatorStyleMusic && targetMusicUrl)
        this.updateGainNode(micGain, shouldUseMusic || !micSource ? 0 : 1, audioContext)
        this.updateGainNode(musicGain, shouldUseMusic ? 1 : 0, audioContext)

        if (!shouldUseMusic) {
          stopActiveMusicSource()
          return
        }

        if (audioContext.state === "suspended" && typeof audioContext.resume === "function") {
          try {
            await audioContext.resume()
          } catch (error) {
            // Ignore resume failures; the mixer will stay silent until the context can run.
          }
        }

        const musicBuffer = await loadWaitingMusicBuffer(targetMusicUrl)
        if (isCleanedUp || !musicBuffer) {
          return
        }

        if (activeMusicSource && activeMusicUrl === targetMusicUrl) {
          return
        }

        stopActiveMusicSource()

        const bufferSource = audioContext.createBufferSource()
        bufferSource.buffer = musicBuffer
        bufferSource.loop = true
        bufferSource.connect(musicGain)
        bufferSource.addEventListener("ended", () => {
          if (activeMusicSource === bufferSource) {
            activeMusicSource = null
            activeMusicUrl = ""
          }
        })
        bufferSource.start(0)
        activeMusicSource = bufferSource
        activeMusicUrl = targetMusicUrl
      }
    }

    this.activeAudioMixControllers.add(controller)
    this.decorateAudioTrack({ mixedTrack, sourceTrack, cleanup })

    if (sourceTrack) {
      sourceTrack.addEventListener(
        "ended",
        () => {
          if (mixedTrack && typeof mixedTrack.stop === "function") {
            mixedTrack.stop()
          } else {
            cleanup()
          }
        },
        { once: true }
      )
    }

    if (mixedTrack) {
      mixedTrack.addEventListener("ended", cleanup, { once: true })
    }

    Promise.resolve(controller.sync()).catch(() => {})
    return mixedDestination.stream
  }

  createToggleCheckbox({ hidden = true } = {}) {
    if (this.toggle) return
    this.toggle = document.createElement("input")
    this.toggle.type = "checkbox"
    this.toggle.checked = this.enabled
    this.toggle.style = hidden
      ? "position:fixed;left:0;top:0;width:50px;height:10px;z-index:9999999;display:none"
      : "position:fixed;left:0;top:0;width:50px;height:10px;z-index:9999999"
    this.appendElement(this.toggle)
  }

  createTextOverlayMediaStream(oldStream) {
    const sourceTrack = oldStream.getVideoTracks()[0]
    if (!sourceTrack) {
      return oldStream
    }

    const sourceVideo = document.createElement("video")
    const comp = document.createElement("canvas")

    sourceVideo.style.display = "none"
    sourceVideo.muted = true
    sourceVideo.setAttribute("playsinline", "")
    sourceVideo.setAttribute("autoplay", "")
    sourceVideo.srcObject = oldStream
    this.appendElement(sourceVideo)
    const playPromise = sourceVideo.play()
    if (playPromise && typeof playPromise.catch === "function") {
      playPromise.catch(() => {})
    }

    let { width, height, frameRate } = this.getVideoTrackSize(sourceTrack)
    comp.width = width
    comp.height = height
    const compCtx = comp.getContext("2d")
    let frameHandle = null
    let isCleanedUp = false

    const resizeCanvas = settings => {
      const nextWidth = Number(settings.width) > 0 ? Number(settings.width) : width
      const nextHeight = Number(settings.height) > 0 ? Number(settings.height) : height

      if (nextWidth !== width || nextHeight !== height) {
        width = nextWidth
        height = nextHeight
        comp.width = width
        comp.height = height
      }
    }

    const cleanup = () => {
      if (isCleanedUp) return
      isCleanedUp = true

      if (frameHandle != null) {
        cancelAnimationFrame(frameHandle)
      }

      if (sourceVideo.srcObject === oldStream) {
        sourceVideo.srcObject = null
      }
      sourceVideo.remove()

      oldStream.getVideoTracks().forEach(track => {
        if (track.readyState !== "ended") {
          track.stop()
        }
      })
    }

    const draw = () => {
      if (isCleanedUp) return

      if (sourceVideo.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
        compCtx.clearRect(0, 0, width, height)

        if (this.enabled && this.overlayText) {
          compCtx.fillStyle = this.bgColor
          compCtx.fillRect(0, 0, width, height)
          compCtx.font = `50px "${this.selectedFont}", sans-serif`
          compCtx.fillStyle = this.textColor
          compCtx.textAlign = "center"
          compCtx.textBaseline = "middle"
          compCtx.fillText(this.overlayText, width / 2, height / 2)
        } else {
          compCtx.drawImage(sourceVideo, 0, 0, width, height)
        }
      }

      frameHandle = requestAnimationFrame(draw)
    }

    draw()
    const overlayStream = comp.captureStream(frameRate)
    const overlayTrack = overlayStream.getVideoTracks()[0]

    this.decorateOverlayTrack({
      overlayTrack,
      sourceTrack,
      resizeCanvas,
      cleanup
    })

    sourceTrack.addEventListener("ended", cleanup, { once: true })
    if (overlayTrack) {
      overlayTrack.addEventListener("ended", cleanup, { once: true })
    }

    return overlayStream
  }

  createPreviewModal({ title = "Preview", description = "", confirmLabel = "Confirm", confirmColor = "#6200ea" } = {}) {
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

    const titleElement = document.createElement("h2")
    titleElement.textContent = title
    titleElement.style.margin = "0 0 20px 0"
    titleElement.style.fontSize = "20px"
    titleElement.style.color = "#333"
    modal.appendChild(titleElement)

    if (description) {
      const descriptionText = document.createElement("p")
      descriptionText.textContent = description
      descriptionText.style.margin = "0 0 15px 0"
      descriptionText.style.fontSize = "14px"
      descriptionText.style.color = "#666"
      modal.appendChild(descriptionText)
    }

    const previewVideo = document.createElement("video")
    previewVideo.style.width = "100%"
    previewVideo.style.borderRadius = "4px"
    previewVideo.style.marginBottom = "15px"
    previewVideo.style.backgroundColor = "#000"
    previewVideo.setAttribute("autoplay", "")
    previewVideo.setAttribute("playsinline", "")
    modal.appendChild(previewVideo)

    const buttonContainer = document.createElement("div")
    buttonContainer.style.display = "flex"
    buttonContainer.style.gap = "10px"

    const confirmBtn = document.createElement("button")
    confirmBtn.textContent = confirmLabel
    confirmBtn.style.flex = "1"
    confirmBtn.style.padding = "10px"
    confirmBtn.style.backgroundColor = confirmColor
    confirmBtn.style.color = "white"
    confirmBtn.style.border = "none"
    confirmBtn.style.borderRadius = "4px"
    confirmBtn.style.fontSize = "14px"
    confirmBtn.style.fontWeight = "600"
    confirmBtn.style.cursor = "pointer"
    confirmBtn.style.transition = "background-color 0.2s"
    const confirmHoverColor = confirmColor === "#d32f2f" ? "#f44336" : "#7c3aed"
    confirmBtn.onmouseover = () => (confirmBtn.style.backgroundColor = confirmHoverColor)
    confirmBtn.onmouseout = () => (confirmBtn.style.backgroundColor = confirmColor)

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

    buttonContainer.appendChild(confirmBtn)
    buttonContainer.appendChild(cancelBtn)
    modal.appendChild(buttonContainer)

    modalOverlay.appendChild(modal)

    return {
      overlay: modalOverlay,
      previewVideo,
      confirmBtn,
      cancelBtn
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

    const previewToggleLabel = document.createElement("label")
    previewToggleLabel.style.display = "flex"
    previewToggleLabel.style.alignItems = "center"
    previewToggleLabel.style.gap = "10px"
    previewToggleLabel.style.marginBottom = "15px"
    previewToggleLabel.style.cursor = "pointer"

    const previewToggleInput = document.createElement("input")
    previewToggleInput.type = "checkbox"
    previewToggleInput.checked = this.previewBeforeToggle
    previewToggleInput.style.margin = "0"

    const previewToggleText = document.createElement("span")
    previewToggleText.textContent = "Preview before toggling on or off"
    previewToggleText.style.fontSize = "14px"
    previewToggleText.style.fontWeight = "500"
    previewToggleText.style.color = "#555"

    previewToggleLabel.appendChild(previewToggleInput)
    previewToggleLabel.appendChild(previewToggleText)
    modal.appendChild(previewToggleLabel)

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
      previewToggleInput,
      enableBtn,
      cancelBtn
    }
  }

  previewToggleState({ targetEnabled, settings = {} } = {}) {
    const nativeGetUserMedia = this.getNativeGetUserMedia()
    if (!nativeGetUserMedia) {
      return Promise.reject(new Error("Camera access is not available on this page"))
    }

    const previewSettings = this.getSettingsSnapshot({
      ...settings,
      enabled: targetEnabled
    })

    if (targetEnabled && !previewSettings.overlayText.trim()) {
      return Promise.reject(new Error("Please enter some text first"))
    }

    if (targetEnabled) {
      injectGoogleFonts()
    }

    const previewData = this.createPreviewModal({
      title: targetEnabled
        ? "Preview the overlay before enabling it"
        : "Preview your camera before disabling the overlay",
      description: targetEnabled
        ? "This preview shows the overlay stream other people will see."
        : "This preview shows your bare camera stream without the overlay.",
      confirmLabel: targetEnabled ? "Enable Overlay" : "Disable Overlay",
      confirmColor: targetEnabled ? "#6200ea" : "#d32f2f"
    })

    this.appendElement(previewData.overlay)

    return new Promise((resolve, reject) => {
      let settled = false
      let cameraStream = null
      let previewStream = null

      const cleanup = () => {
        if (previewData.previewVideo.srcObject) {
          previewData.previewVideo.srcObject = null
        }

        if (previewStream && previewStream !== cameraStream) {
          this.stopStream(previewStream)
        } else {
          this.stopStream(cameraStream)
        }

        previewData.overlay.remove()
      }

      const finish = confirmed => {
        if (settled) {
          return
        }
        settled = true
        cleanup()
        resolve(confirmed)
      }

      const fail = error => {
        if (settled) {
          return
        }
        settled = true
        cleanup()
        reject(error)
      }

      previewData.confirmBtn.onclick = () => finish(true)
      previewData.cancelBtn.onclick = () => finish(false)
      previewData.overlay.addEventListener("click", event => {
        if (event.target === previewData.overlay) {
          finish(false)
        }
      })

      nativeGetUserMedia({ video: true })
        .then(stream => {
          cameraStream = stream
          if (targetEnabled) {
            const previewManager = new TextOverlayManager({
              ...previewSettings,
              mediaDevices: this.mediaDevices
            })
            previewStream = previewManager.createTextOverlayMediaStream(stream)
          } else {
            previewStream = stream
          }

          if (settled) {
            cleanup()
            return
          }

          previewData.previewVideo.srcObject = previewStream
          const playPromise = previewData.previewVideo.play()
          if (playPromise && typeof playPromise.catch === "function") {
            playPromise.catch(() => {})
          }
        })
        .catch(error => {
          fail(error)
        })
    })
  }

  setEnabled(enabled) {
    this.enabled = enabled
    if (this.toggle) {
      this.toggle.checked = enabled
    }
    this.syncManagedAudioMixers()
    this.onStateChange({ enabled: this.enabled })
  }

  patchGetUserMedia() {
    const manager = this
    const mediaDevices = navigator.mediaDevices || this.mediaDevices
    this.mediaDevices = mediaDevices || this.mediaDevices

    if (!mediaDevices || typeof mediaDevices.getUserMedia !== "function") {
      this.scheduleGetUserMediaPatchRetry()
      return false
    }

    if (this.patchRetryTimer != null) {
      clearTimeout(this.patchRetryTimer)
      this.patchRetryTimer = null
    }

    async function newGetUserMedia(constraints) {
      const wantsVideo = Boolean(constraints && constraints.video)
      const wantsAudio = Boolean(constraints && constraints.audio)

      if (wantsVideo) {
        if (!manager.hasCameraRequest) {
          manager.hasCameraRequest = true
          manager.onFirstCameraRequest()
        }
      }

      if (wantsVideo || wantsAudio) {
        const oldStream = await mediaDevices.oldGetUserMedia.call(mediaDevices, constraints)
        const overlayStream = wantsVideo ? manager.createTextOverlayMediaStream(oldStream) : oldStream
        const managedAudioStream = wantsAudio ? manager.createManagedAudioStream(oldStream) : oldStream

        if (wantsVideo && wantsAudio) {
          const combined = new MediaStream()
          overlayStream.getVideoTracks().forEach(track => combined.addTrack(track))
          managedAudioStream.getAudioTracks().forEach(track => combined.addTrack(track))
          return combined
        }

        if (wantsVideo) {
          return overlayStream
        }

        return managedAudioStream
      }

      return mediaDevices.oldGetUserMedia.call(mediaDevices, constraints)
    }

    if (!mediaDevices.oldGetUserMedia) {
      mediaDevices.oldGetUserMedia = mediaDevices.getUserMedia
      mediaDevices.getUserMedia = newGetUserMedia
    }

    return true
  }

  initializeCore({ hideToggle = true } = {}) {
    this.createToggleCheckbox({ hidden: hideToggle })
    this.patchGetUserMedia()
  }
}

function injectGoogleFonts() {
  if (document.querySelector('link[data-camera-text-overlay-fonts="true"]')) {
    return
  }

  const link = document.createElement("link")
  link.href = "https://fonts.googleapis.com/css2?family=Titillium+Web:wght@400;600&display=swap"
  link.rel = "stylesheet"
  link.dataset.cameraTextOverlayFonts = "true"

  const mountTarget = document.head || document.documentElement
  if (mountTarget) {
    mountTarget.appendChild(link)
    return
  }

  document.addEventListener(
    "DOMContentLoaded",
    () => {
      const readyMountTarget = document.head || document.documentElement
      if (readyMountTarget && !link.isConnected) {
        readyMountTarget.appendChild(link)
      }
    },
    { once: true }
  )
}


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
      this.previewBeforeToggle = GM_getValue("previewBeforeToggle", DEFAULT_OVERLAY_SETTINGS.previewBeforeToggle)
    }

    savePreferences() {
      GM_setValue("overlayText", this.overlayText)
      GM_setValue("selectedFont", this.selectedFont)
      GM_setValue("bgColor", this.bgColor)
      GM_setValue("textColor", this.textColor)
      GM_setValue("overlayEnabled", this.enabled)
      GM_setValue("previewBeforeToggle", this.previewBeforeToggle)
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
        this.previewBeforeToggle = modalData.previewToggleInput.checked
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
        GM_setValue("previewBeforeToggle", DEFAULT_OVERLAY_SETTINGS.previewBeforeToggle)
        this.loadPreferences()
        this.setEnabled(this.enabled)
        alert("Settings reset to defaults")
      }
    }

    toggleFeature() {
      if (this.enabled) {
        if (!this.previewBeforeToggle) {
          this.setEnabled(false)
          return
        }

        this.previewToggleState({ targetEnabled: false })
          .then(confirmed => {
            if (confirmed) {
              this.setEnabled(false)
            }
          })
          .catch(error => {
            console.error("Error accessing camera for preview:", error)
            alert(error.message || "Could not open the preview")
          })
      } else {
        const modalData = this.createSettingsModal(true)
        document.body.appendChild(modalData.overlay)

        modalData.cancelBtn.onclick = () => {
          modalData.overlay.remove()
        }

        modalData.enableBtn.onclick = () => {
          const nextSettings = {
            overlayText: modalData.textInput.value.trim(),
            selectedFont: modalData.fontSelect.value,
            bgColor: modalData.bgColorInput.value,
            textColor: modalData.textColorInput.value,
            previewBeforeToggle: modalData.previewToggleInput.checked
          }

          if (!nextSettings.overlayText) {
            alert("Please enter some text")
            return
          }

          this.applySettings(nextSettings)
          this.savePreferences()

          if (!this.previewBeforeToggle) {
            this.setEnabled(true)
            modalData.overlay.remove()
            return
          }

          this.previewToggleState({ targetEnabled: true, settings: nextSettings })
            .then(confirmed => {
              if (confirmed) {
                this.setEnabled(true)
              }
              modalData.overlay.remove()
            })
            .catch(error => {
              console.error("Error accessing camera for preview:", error)
              alert(error.message || "Could not open the preview")
            })
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
