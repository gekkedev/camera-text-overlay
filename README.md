# 🎥 Camera Text Overlay

Replace your camera stream with a customizable text for video calls. Great for "be right back" messages, status indicators, or anything else you want to display on your camera!

![Preview](google-meet.png)

## Use Cases

- **BRB / away for a minute**: show a clear "be right back 😴" card instead of an empty chair or ceiling view.
- **Short waiting-room handoff**: leave a clean placeholder on screen while you grab water, answer the door, or switch rooms.
- **Low-friction status signaling**: display messages like "back in 2 min", "recording in progress", or "heads down, still listening".
- **Lobby-style hold screen**: pair a BRB message with looping elevator-style waiting music while the overlay is active.

## Features

### Two Installation Methods:

**Userscript:** Works with any userscript manager (TamperMonkey, GreaseMonkey, ViolentMonkey, etc.)  
**Chrome Extension:** Native installation for Chrome/Chromium browsers

### Customizable attributes

- text content
- text color
- background color
- font selection (6 included fonts)
- optional looping waiting music
- optional microphone mute while the overlay is active
- waiting music track selection

### Controls

**Userscript:** Access via userscript manager menu or on-page button
**Extension:** Click the extension icon in your toolbar

### Privacy

- no network requests (except for _Google Fonts_)
- neither tracking nor analytics
- settings stored locally

## Installation

### Method 1: Userscript (recommended for simplicity)

#### Step 1: Install a Userscript Manager

Choose one of these browser extensions:

| Manager                                               | Chrome | Firefox | Edge | Opera |
| ----------------------------------------------------- | ------ | ------- | ---- | ----- |
| [**TamperMonkey**](https://www.tampermonkey.net/)     | ✅     | ✅      | ✅   | ✅    |
| [**Greasemonkey**](https://www.greasespot.net/)       | ✅     | ✅      | ✅   | ✅    |
| [**ViolentMonkey**](https://violentmonkey.github.io/) | ✅     | ✅      | ✅   | ✅    |

#### Step 2: Install the Userscript

Click this link to install:

**[📥 Install the Camera Text Overlay Userscript](https://github.com/gekkedev/camera-text-overlay/raw/main/camera-text-overlay.user.js)**

Or manually:

1. Open the [raw userscript file](https://github.com/gekkedev/camera-text-overlay/raw/main/camera-text-overlay.user.js)
2. Your userscript manager should automatically detect it
3. Click "Install" or "Confirm Installation"

#### Using the script

The userscript works through your userscript manager's menu:

1. **Access the menu:**
   - Click your **userscript manager icon** (TamperMonkey, GreaseMonkey, etc.) in the browser toolbar
   - Find **"Camera Text Overlay"** in the menu

2. **First time setup:**
   - Click **"⚙️ Configure Settings"**
   - Enter your overlay text (e.g., "be right back 😴")
   - Pick your colors and font (optional)
   - Settings are saved automatically

3. **Enable the overlay:**
   - Menu → **"🟢 Enable Text Overlay"**
   - The button changes to show **"🔴 Disable Text Overlay"** when active

4. **On a video call:**
   - Start your camera as usual in Google Meet, Zoom, Teams, etc.
   - Others will see your overlay text instead of your real camera

5. **Disable the overlay:**
   - Menu → **"🔴 Disable Text Overlay"**
   - Your camera feed returns to normal

**Reset settings:**

- Menu → "🔄 Reset Settings" to restore defaults

**Note:** Different userscript managers have different menu styles, but all provide access to the same commands.

### Method 2: Chrome Extension

#### Step 1: Download the Extension

Option A: **Download from source**

1. Clone or download this repository
2. Navigate to the root folder
3. Run `npm install && npm run build`
4. The extension will be in the `dist/extension` folder

Option B: **Download the pre-built extension**

- Each release includes `camera-text-overlay-extension.zip`
- Extract it somewhere safe (e.g., `~/Extensions/camera-text-overlay/`)

#### Step 2: Install in Chrome

1. Open Chrome and go to **`chrome://extensions/`**
2. Enable **"Developer mode"** (toggle in top right)
3. Click **"Load unpacked"**
4. Select the `extension` folder (or the extracted folder from Option B)
5. The extension should now appear in your toolbar

#### Using the Extension

**First time setup:**

1. Click the **Camera Text Overlay icon** in your toolbar
2. A settings popup appears
3. Enter your overlay text (e.g., "be right back 😴")
4. Pick your colors and font (optional)
5. Click **"Enable Overlay"**

**On a video call:**

- Start your camera as usual in Google Meet, Zoom, Teams, etc.
- Others will see your overlay text instead of your real camera
- Click the icon anytime to toggle overlay on/off

Settings are saved automatically and sync across all tabs.

#### Audio Notes

The extension tampers only with your system's default microphone. Pick the microphone you actually want to use as the OS-level default input device outside the extension first.

If you use looping waiting music in Google Meet, disable Meet's **Studio sound** option. It may be enabled by default and can suppress or distort the music because Meet treats it as non-speech audio.

![Google Meet Studio sound should be disabled](assets/google-meet-studio-sound-off.svg)

If you debug Google Meet with two windows open at the same time, disable Meet's **Adaptive audio** option as well. That setting can merge nearby-device audio paths and make debugging the tampered mic stream confusing.

![Google Meet Adaptive audio should be disabled for two-window debugging](assets/google-meet-adaptive-audio-off.svg)

## Building from Source

### Requirements

- Node.js 14+
- pnpm

### Build Commands

```bash
# Install dependencies
pnpm install

# Build both userscript and extension (cleans dist first)
pnpm run build
```

**Output:**

- **Userscript**: `camera-text-overlay.user.js` (root directory)
- **Extension**: `dist/extension/` folder

### Project Structure

```
camera-text-overlay/
├── 📄 build.js                      # Cleans and builds both methods
├── 📄 camera-text-overlay.user.js   # Built userscript (committed to repo)
│
├── 📁 src/
│   ├── 📁 shared/
│   │   └── overlay.js                # Shared logic (reference only)
│   ├── 📁 extension/                 # Chrome extension wrapper
│   └── 📁 userscript/
│       └── userscript.js             # Userscript wrapper
│
├── 📁 assets/
│   └── icon.svg                      # Source icon used to generate PNG sizes
│
└── 📁 dist/                          # Generated (not committed)
   └── extension/                    # Chrome extension (ready to load)
```

## How It Works

The script intercepts your browser's `getUserMedia()` API call (used by video apps) and:

1. **Captures** the camera stream
2. **Draws** your custom text on a canvas if enabled
3. **Switches** outgoing audio between your real microphone, silence, and the selected looping waiting track based on your overlay audio settings
4. **Returns** the modified stream to the webpage

Since the modification happens at the browser level, video calling apps (Google Meet, Zoom, Teams, etc.) see your overlay stream instead of your real camera.

For audio, the extension tampers with the default system microphone stream exposed to the browser. It does not pick a microphone device on its own.

## Waiting Music Asset Guidance

If you add or replace waiting-music assets, use small web-friendly files. High bitrate is unnecessary for hold music.

- **Recommended format**: `MP3`
- **Sample rate**: `44.1-48 kHz`
- **Bitrate target**: `64-96 kbps` stereo or `48-64 kbps` mono
- **Length**: short seamless loop, ideally `15-60 seconds`
- **Editing goal**: avoid abrupt starts or ends so the loop can repeat cleanly

The bundled waiting tracks are already lightweight `MP3` files at `64 kbps` stereo / `48 kHz`, which is adequate for this extension.

## Known Limitations

1. **No Firefox extension** - Extension only works on Chrome/Chromium (Firefox uses different manifest)
1. **Single font size** - Currently hardcoded to 50px
1. **No toggle keyboard shortcut** - Could be added via Chrome commands API
1. **Userscript waiting music is not wired up yet** - bundled music asset loading currently works only in the Chrome extension

## Contributing

Found a bug or have a feature idea?

1. Check the [Issues](https://github.com/gekkedev/camera-text-overlay/issues) page
2. Create a new issue or pull request
3. Include details about your browser, OS, and the video calling website

### Future Enhancements

Potential improvements:

- [ ] more fonts
- [ ] custom fonts via file upload
- [ ] preset overlays (clock, message templates)
- [ ] local custom preconfigured overlays for fast switching
- [ ] multiple overlay styles (corners, borders, etc.)
- [ ] video blur/blur modes instead of text
- [ ] firefox extension version (requires XPI build)
- [ ] chrome Web Store publishing
- [ ] keyboard shortcuts to toggle
- [ ] settings import/export
- [ ] animated overlays

## FAQ

**Q: Will this work with Zoom/Google Meet/Microsoft Teams?**  
A: Yes, it works with any video website that uses your camera.

**Q: Can I share different overlays for different calls?**  
A: Not simultaneously, but you can change settings at any time.

**Q: Does this work on mobile?**  
A: Mobile browsers don't support userscripts/extensions in the same way. This is designed for the desktop.

**Q: Can I use custom fonts?**  
A: Currently limited to 6 built-in fonts. Custom fonts are a potential future feature.

**Q: Does the waiting music loop?**  
A: Yes. When elevator-style music is enabled, the selected track loops for as long as the overlay stays active.

**Q: Which microphone does the extension modify?**  
A: It tampers with the browser's default system microphone input. Set the microphone you want to use as your OS default before joining the call.

**Q: What if I want to go back to showing my real camera?**  
A:

- **Userscript**: Click userscript manager icon → "Camera Text Overlay" → "🔴 Disable Text Overlay"
- **Extension**: Click the extension icon and click "Disable Overlay"

---

If you find this useful, consider [starring on GitHub](https://github.com/gekkedev/camera-text-overlay) or sharing with a friend!
