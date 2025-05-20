# System Information Chrome Extension

This Chrome extension displays basic system information, including CPU, memory, and storage details.

## Features

- Shows CPU model, architecture, number of cores, and processor usage.
- Displays total and available system memory.
- Lists available storage units with their capacity and available space.

## How to Install and Use

1.  **Download or Clone:** Download the extension files or clone this repository to your local machine.
2.  **Open Chrome Extensions:** Open Google Chrome, type `chrome://extensions` in the address bar, and press Enter.
3.  **Enable Developer Mode:** Ensure that "Developer mode" (usually a toggle switch in the top right corner) is enabled.
4.  **Load Unpacked:** Click on the "Load unpacked" button.
5.  **Select Extension Directory:** Navigate to the directory where you downloaded or cloned the extension files (the directory containing `manifest.json`) and select it.
6.  **View Information:** The System Info Viewer extension icon should now appear in your Chrome toolbar. Click on it to view your system information.

## Files

-   `manifest.json`: Defines the extension's properties and permissions.
-   `popup.html`: The HTML structure for the popup window.
-   `popup.js`: Contains the JavaScript logic to fetch and display system information.
-   `style.css`: Basic styling for the popup window.
-   `images/`: Directory containing the extension icons (`icon16.png`, `icon48.png`, `icon128.png`).

## Permissions Used

-   `system.cpu`: To access CPU information.
-   `system.memory`: To access memory information.
-   `system.storage`: To access storage information.
