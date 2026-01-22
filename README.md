# System Information & Monitor Chrome Extension

COGext is a lightweight, high-performance system monitor extension for the Chrome browser. It provides a real-time, glanceable overview of your system's health (CPU, RAM, Battery, Network) wrapped in a modern, native-feeling interface.

<img width="128" height="128" alt="Logo COGext" src="./src/assets/icon128.png" />

## 🧠 V2.0 Design Philosophy: From List to Dashboard

The architecture of Version 2.0 was driven by a major shift in the UX paradigm: moving away from a simple list to a comprehensive **Dashboard**.

- **Immediate Visibility:** The UI is strictly constrained to the viewport—no scrolling required. A **Grid Layout** is used to manage screen real-estate efficiently, giving you the big picture instantly.
- **Interactive Layers:** To balance simplicity and detail, we use an **Overlay System**:
  - _State 1 (Card):_ Displays aggregated, essential data (e.g., Total CPU Load).
  - _State 2 (Overlay):_ Reveals granular data on demand (e.g., Per-core Load).
- **Smart Performance:** This design dictated a strict decoupling between the **DataStore** and **Renderer**. Heavy granular data is fetched _only_ when an overlay is requested, keeping the main monitoring loop lightweight (5Hz) and responsive.

## ✨ Features

### 📦 The Cards

The dashboard is organized around key system metrics:

- **CPU Usage**: Real-time processor load monitoring.
- **Temperature**: Thermal sensor readings (Average & Zones).
- **Memory**: RAM capacity and usage visualization.
- **Battery**: Charge level, power status, and time estimates.
- **Network**: Connection status and public IP.
- **Display**: Screen resolution, primary display status, and GPU name.
- **Storage**: Disk usage overview.
- **System**: Software details including Chrome version, OS platform, languages and active extensions.

### 🎨 User Experience (UX)

- **Grid Layout**: A clean, fixed interface with no scrolling required.
- **Interactive Overlays**: Click on any card to reveal deep-dive metrics and detailed lists, keeping the main dashboard clean.
- **Native Integration**: Dark/Light mode support, custom "Inter" font, and smooth animations.

## History

This extension is a wild hack from the ChromeApp "COG" coded by François Beaufort, Chrome expert at Google, to demonstrate the capabilities of the Chrome system API.

Help was provided by Jules & Gemini by Google.

## 🛠 Changelog

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
- `src/main.js`: Main controller (Game Loop, Event handling).
- `src/data-store.js`: Data fetching layer (Chrome APIs abstraction).
- `src/renderer.js`: UI Rendering engine (DOM manipulation & Caching).
- `src/style.css`: All visual styles, variables, and animations.
- `src/_locales/`: Internationalization files (en/fr).
- `src/assets/`: Icons and Fonts.

## 🔐 Permissions Used

COGext runs entirely locally and respects your privacy. It requires the following permissions to function:

- `system.cpu`: To visualize processor load and model information.
- `system.memory`: To display available RAM.
- `system.storage`: To list storage partitions and usage (Dashboard & Overlay).
- `system.display`: To detect screen resolution and multi-monitor setups.
- `storage`: To save your preferences (Dark Mode, Unit C°/F°).
- `management`: To display the list of installed extensions (Chrome Overlay).

## 🤝 Feedback

Please share your thoughts or report bugs in the Issues tab: [https://github.com/tchoa91/cog-ext/issues](https://github.com/tchoa91/cog-ext/issues)

## Testing tool

This project is tested with BrowserStack
