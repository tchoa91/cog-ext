# **System monitor \- Chrome extension**

COGext is a highly optimized and accessible system monitor extension for the Chrome browser. It exposes the data provided by the chrome system API plus a little more, in the most effective way for all, including CPU load & temp, RAM, Battery, Network and much more.

<img width="128" height="128" alt="Logo COGext" src="./src/assets/icon128.png" />

## **Features**

**4 Monitors & 9 Cards :**

- **CPU Usage:** Real-time processor load, plus arch, model & instruction set.\*+
- **Memory:** RAM capacity and usage.
- **Battery:** Charge level, power status, and time estimates.\*
- **Network:** Connection status, public IP and latency.
- Chip Temperature: Thermal sensors.+
- Display: Screen resolution, primary display status, and GPU name.+
- Storage: Disk usage overview. \*+
- System: OS & platform,
- Chrome: version, system languages and active extensions.+

(\* OS restrictions apply) (+ Has overlay for details)

Customisation: Temp unit, Dark/Light mode and 5 color moods.  
Accessibility: Engineered for universal access (aiming WCAG 2.2 AAA). Includes curated semantic audio, multi-modal navigation, and native support for 17 languages.

## **Code history**

This extension started as a wild hack of the ChromeApp "COG" coded by François Beaufort, Chrome expert at Google, that demonstrated the capabilities of the Chrome system API. As the ChromeApps got deprecated in 2025 and no option available fed my needs, I used Jules & Gemini from Google to port it in an extension, nearly as it was. But I was not happy, because it was far from optimal in a long page to scroll. So I made some plans to rewrite it from scratch with a few objectifs :

- Be useful, like complete, but still simple & clear.
- Be light in Ko and on ressources, but still solid & fast.
- Be secure, respectful of privacy and transparent.

## **Technologies used**

- Vanilla HTML, CSS & JS. Chrome extension MANIFEST V3.
- MVC: a resilient API data provider, a main controller/tranformer & a dumb & secure renderer.
- Optimisations: Scoping, Throttling, Caching.
- Data/UI design in config (and more).
- One hue value for all UI.
- ChromeVox testing.

## **Data usage**

The data exposed by this extension and its usage are NOT recorded nor transmitted in any way. All but your preferences is deleted as soon as you close the extension. The extension works well off-line or behind a firewall, but it will not display your IP nor the latency.

## 🛠 Changelog

### **V 2.2 \- Accessibility & Reliability**

- Optimization of ARIA tree: semantic grouping, punctuation for pacing, label expansion (acronyms), and noise pruning for a cleaner audio interface.
- Hardened XSS security.
- Added pings (0.2Hz) to `clients3.google.com/generate\_204` to get “real” latency.
- Bug fixes : GPU display & Storage on Windows.

### V 2.1 - Refinement & Personalization

- Code cleanup and optimizations.
- Bug fixes.
- Added "Moods" (color themes), Sparklines, and latency tracking.
- Added support for 15 additional languages.

### V 2.0 - The "Dashboard" Update (2026-01-21)

- **Architecture Rewrite**: Complete separation of concerns (MVC pattern) with `DataStore` (Logic), `Renderer` (View), and `Main` (Controller).
- **UI Overhaul**: New Grid Layout with overlays replacing the old list view.
- **Performance**: Implementation of a Virtual DOM-like caching system and Scope-based Fetching.
- **New Metrics**: GPU, changed Chrome Plugins for Chrome Extensions, Network Status.
- **Accessibility**: Full control with Keyboard, Mouse or Touchscreen.
- **Internationalization**: Contributions are welcome! Feel free to submit a Pull Request to add or improve translations.

### V 1.2

- tried again to fix windows only bugs on Storage display
- new icons ok on dark background

### V 1.1

- tried to fix windows only bugs that I can not test: CPU Temp & Storage display
- removed README & LICENCE from package, only needed here
- added font in package, no donwload from the web any more

## How to Install and Use

### Chrome Web Store (recommended)

Link : https://chromewebstore.google.com/detail/cogext-system-info-viewer/bkgdbdaidbamkkbhkopfcebglbjfalei

### Github (only for advanced users, coders and other hackers)

1.  **Download or Clone:** Download the extension files or clone this repository to your local machine.
2.  **Open Chrome Extensions:** Open Google Chrome, type `chrome://extensions` in the address bar, and press Enter.
3.  **Enable Developer Mode:** Ensure that "Developer mode" (usually a toggle switch in the top right corner) is enabled.
4.  **Load Unpacked:** Click on the "Load unpacked" button.
5.  **Select Extension Directory:** Navigate to the directory where you downloaded or cloned the extension files (the directory containing `manifest.json`) and select it.
6.  **View Information:** The System Info Viewer extension icon should now appear in your Chrome toolbar. Click on it to view your system information.

## 📂 Project Structure

- `src/manifest.json`: Extension configuration and permissions.
- `src/popup.html`: The main entry point and skeleton.
- `src/config.js`: The configuration file for the layout, the colors and the thresholds.
- `src/main.js`: Main controller (Game Loop, Event handling).
- `src/data-store.js`: Data fetching layer (Chrome APIs abstraction).
- `src/renderer.js`: UI Rendering engine (DOM manipulation & Caching).
- `src/style.css`: All visual styles, variables, and animations.
- `src/_locales/`: Internationalization files.
- `src/assets/`: Icons and Fonts.

## 🔐 Permissions Used

COGext runs entirely locally and respects your privacy. It requires the following permissions to function:

- `system.cpu`: To visualize processor load and model information.
- `system.memory`: To display available RAM.
- `system.storage`: To list storage partitions and usage (Dashboard & Overlay).
- `system.display`: To detect screen resolution and multi-monitor setups.
- `storage`: To save your preferences (Dark Mode, Unit C°/F°).
- `management`: To display the list of installed extensions (Chrome Overlay).
- `clients3.google.com`: To calculate the latency.
- `api.ipify.org`: To get IP.

## 🤝 Feedback

Please share your thoughts or report bugs in the Issues tab: [https://github.com/tchoa91/cog-ext/issues](https://github.com/tchoa91/cog-ext/issues)

## Testing tool

This project is tested with BrowserStack
