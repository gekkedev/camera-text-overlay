#!/usr/bin/env node

/**
 * Build script to generate both the Chrome extension and userscript
 * from the shared source code and individual wrappers
 */

const fs = require("fs")
const path = require("path")
const sharp = require("sharp")

const ROOT_DIR = __dirname
const SOURCE_DIR = path.join(ROOT_DIR, "src")
const DIST_DIR = path.join(ROOT_DIR, "dist")
const EXTENSION_DIR = path.join(DIST_DIR, "extension")
const ICON_SOURCE = path.join(ROOT_DIR, "assets", "icon.svg")
const SHARED_OVERLAY_PATH = path.join(SOURCE_DIR, "shared", "overlay.js")
const SHARED_TOKEN = "/*__OVERLAY_SHARED__*/"
const MUSIC_TRACK_FILES_TOKEN = "/*__MUSIC_TRACK_FILES__*/ []"

console.log("🔨 Building Camera Text Overlay...")

async function generateIcons() {
  if (!fs.existsSync(ICON_SOURCE)) {
    throw new Error(`Icon source not found: ${ICON_SOURCE}`)
  }

  const iconsDir = path.join(EXTENSION_DIR, "images")
  const sizes = [16, 48, 128]

  await Promise.all(
    sizes.map(size =>
      sharp(ICON_SOURCE)
        .resize(size, size)
        .png()
        .toFile(path.join(iconsDir, `icon-${size}.png`))
    )
  )

  console.log("  ✓ Icons (SVG → PNG)")
}

function removeDir(dir) {
  if (fs.existsSync(dir)) {
    fs.readdirSync(dir).forEach(file => {
      const filePath = path.join(dir, file)
      if (fs.lstatSync(filePath).isDirectory()) {
        removeDir(filePath)
      } else {
        fs.unlinkSync(filePath)
      }
    })
    fs.rmdirSync(dir)
    console.log(`✓ Removed ${dir}`)
  }
}

// Ensure directories exist
function ensureDir(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true })
  }
}

function copyDir(srcDir, destDir) {
  ensureDir(destDir)

  fs.readdirSync(srcDir, { withFileTypes: true }).forEach(entry => {
    const srcPath = path.join(srcDir, entry.name)
    const destPath = path.join(destDir, entry.name)

    if (entry.isDirectory()) {
      copyDir(srcPath, destPath)
      return
    }

    fs.copyFileSync(srcPath, destPath)
  })
}

function loadSharedOverlayInline() {
  const sharedOverlay = fs.readFileSync(SHARED_OVERLAY_PATH, "utf8")
  return sharedOverlay.replace(/^export\s+/gm, "").replace(/export\s*\{[^}]+\}\s*;?/gm, "")
}

function inlineSharedOverlay(source) {
  const sharedInline = loadSharedOverlayInline()
  if (!source.includes(SHARED_TOKEN)) {
    throw new Error("Shared overlay token not found in source file")
  }
  return source.replace(SHARED_TOKEN, sharedInline)
}

function loadMusicTrackFilesInline() {
  const extensionMusicDir = path.join(SOURCE_DIR, "extension", "music")
  if (!fs.existsSync(extensionMusicDir)) {
    return "[]"
  }

  return JSON.stringify(
    fs
      .readdirSync(extensionMusicDir, { withFileTypes: true })
      .filter(entry => entry.isFile())
      .map(entry => entry.name)
      .sort()
  )
}

function inlineMusicTrackFiles(source) {
  if (!source.includes(MUSIC_TRACK_FILES_TOKEN)) {
    return source
  }

  return source.replace(MUSIC_TRACK_FILES_TOKEN, loadMusicTrackFilesInline())
}

async function main() {
  console.log("🧹 Cleaning build artifacts...")
  removeDir(DIST_DIR)

  ensureDir(DIST_DIR)
  ensureDir(EXTENSION_DIR)
  ensureDir(path.join(EXTENSION_DIR, "images"))

  // Copy extension files
  console.log("📦 Building Chrome Extension...")

  const extensionFiles = ["manifest.json", "popup.html", "popup.js", "content.js", "background.js", "page-bridge.js"]

  extensionFiles.forEach(file => {
    const src = path.join(SOURCE_DIR, "extension", file)
    const dest = path.join(EXTENSION_DIR, file)
    if (fs.existsSync(src)) {
      if (file === "content.js" || file === "page-bridge.js") {
        const contentSource = fs.readFileSync(src, "utf8")
        const inlined = inlineMusicTrackFiles(inlineSharedOverlay(contentSource))
        fs.writeFileSync(dest, inlined)
      } else {
        fs.copyFileSync(src, dest)
      }
      console.log(`  ✓ ${file}`)
    }
  })

  const extensionMusicDir = path.join(SOURCE_DIR, "extension", "music")
  if (fs.existsSync(extensionMusicDir)) {
    copyDir(extensionMusicDir, path.join(EXTENSION_DIR, "music"))
    console.log("  ✓ music/")
  }

  await generateIcons()

  // Generate userscript
  console.log("📜 Building Userscript...")

  const userscriptSrc = fs.readFileSync(path.join(SOURCE_DIR, "userscript", "userscript.js"), "utf8")
  const userscriptInlined = inlineSharedOverlay(userscriptSrc)
  const userscriptPath = path.join(ROOT_DIR, "camera-text-overlay.user.js")

  fs.writeFileSync(userscriptPath, userscriptInlined)
  console.log("  ✓ camera-text-overlay.user.js")

  console.log("\n✅ Build complete!")
  console.log("\nOutput:")
  console.log(`  📦 Chrome Extension: ${EXTENSION_DIR}`)
  console.log(`  📜 Userscript: ${userscriptPath}`)
}

main().catch(error => {
  console.error("\n❌ Build failed")
  console.error(error.message)
  process.exit(1)
})
