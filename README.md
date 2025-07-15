# System Information Chrome Extension

This Chrome extension displays basic system information, including CPU, memory, and battery.

## Feedback

Please share your thoughts here in the Issues tab : https://github.com/tchoa91/cog-ext/issues

## History

This extension is a wild hack from the ChromeApp "COG" coded by François Beaufort, Chrome expert at Google, to demonstrate the capabilities of the Chrome system API.

Help was provided by Jules : https://jules.google.com/


## Features

- Shows OS, version & platform.
- Shows CPU model, architecture, number of cores, processor usage and temperatures.
- Displays system memory capacity and usage.
- Displays battery level, staus and time left/to full charge.
- Lists available (external) storage units with their capacity and available space.
- Lists the displays, languages and plugins.

## How to Install and Use

### Chrome Web Store (recommended)

Link (to come)

### Github (only for advanced users, coders and other hackers)

1.  **Download or Clone:** Download the extension files or clone this repository to your local machine.
2.  **Open Chrome Extensions:** Open Google Chrome, type `chrome://extensions` in the address bar, and press Enter.
3.  **Enable Developer Mode:** Ensure that "Developer mode" (usually a toggle switch in the top right corner) is enabled.
4.  **Load Unpacked:** Click on the "Load unpacked" button.
5.  **Select Extension Directory:** Navigate to the directory where you downloaded or cloned the extension files (the directory containing `manifest.json`) and select it.
6.  **View Information:** The System Info Viewer extension icon should now appear in your Chrome toolbar. Click on it to view your system information.

## Files

-   `manifest.json`: Defines the extension's properties and permissions.
-   `popup.html`: The HTML structure for the popup window.
-   `main.js`, `util.js`: Contains the JavaScript logic to fetch and display system information.
-   `style.css`: Styling for the popup window.
-   `assets/`: Directory containing the extension icons (`icon16.png`, `icon48.png`, `icon128.png`).

## Permissions Used

-   `system.cpu`: To access CPU information.
-   `system.memory`: To access memory information.
-   `system.storage`: To access storage information.
