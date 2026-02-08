# Image Overlay Tool

A simple, client-side web tool to overlay multiple images (like QR codes, logos, or stickers) onto a background image. Built with [Fabric.js](http://fabricjs.com/).

## Features

- **Multi-Image Support**: Overlay as many images as you want.
- **No Server Uploads**: Runs entirely in your browser. Your images stay private.
- **SVG Support**: Automatically rasterizes SVG files for high-quality placement.
- **Print Ready**: Add a white "quiet zone" padding behind overlays and export at high DPI.
- **Easy Adjustments**: Drag, drop, resize, and delete overlays visually.

## How to Use

1. **Open `index.html`** in your browser.
2. **Upload Background**: Select your main image (JPG/PNG).
3. **Add Overlays**: Select your overlay images. SVG is recommended for best quality.
4. **Position & Resize**: Click an image to select it. Drag to move, or use the "Size" slider to adjust.
5. **Add Padding**: Check "Add White Padding" for any selected overlay to add a white border.
6. **Export**: Choose a quality multiplier (e.g., Print 4x) and click "Download PNG".

## Print Size Presets & Guidance

When printing—especially for QR codes—sizing matters. A common rule of thumb for QR codes is **minimum 2cm (0.8 inches)** wide.

If you are exporting at **300 DPI**, here are the pixel dimensions for common physical sizes:

| Physical Size | @ 300 DPI | Recommended Use |
|Data | Pixel Size | Note |
|---|---|---|
| **0.8 inch (2 cm)** | ~240 px | **Minimum** for reliable QR scanning |
| **1.0 inch (2.5 cm)** | ~300 px | Standard flyers |
| **1.5 inch (3.8 cm)** | ~450 px | Large posters |
| **2.0 inch (5 cm)** | ~600 px | Distant scanning |

**Tip**: Always test print your design before mass production!

## Technical Details

- **Fabric.js**: Handles the canvas interactivity.
- **SVG Handling**: SVGs are converted to blobs and loaded as standard images to avoid cross-origin taint and ensure consistent rendering.
- **Export Multiplier**: The tool uses Fabric's `multiplier` feature to scale up the canvas output, ensuring high resolution without needing a massive screen.

## Development

No build step required. Just serve the files:

```bash
# Example with Python
python3 -m http.server
```
![walkthrough](./assets/walkthrough.mp4)

## Testing

A test suite is available to verify core functionality (like high-res downloads and zoom compensation) in isolation.

To run the tests:

### Method 1: Local Server (Recommended)
If you have the server running:
Open `http://localhost:8000/tests/test_download.html` in your browser.

### Method 2: Direct Open
Open the file directly from your file manager or via terminal:
```bash
open tests/test_download.html
```

