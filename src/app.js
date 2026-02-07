// Initialize Fabric canvas
const canvas = new fabric.Canvas('c', {
    preserveObjectStacking: true, // Prevents objects from jumping to front when selected
    selection: false // Disable group selection by drag
});

// State
let bgImage = null;
let qrObject = null; // Can be Image or Group (if padding is enabled)
let qrOriginalImage = null; // Keep reference to the raw image for toggling padding
let canvasScale = 1; // Viewport scale (zoom level)

// DOM Elements
const bgInput = document.getElementById('bgInput');
const qrInput = document.getElementById('qrInput');
const qrControls = document.getElementById('qrControls');
const qrSizeInput = document.getElementById('qrSize');
const whitePaddingCheckbox = document.getElementById('whitePadding');
const paddingSizeInput = document.getElementById('paddingSize');
const paddingControlDiv = document.querySelector('.padding-size-control');
const downloadBtn = document.getElementById('downloadBtn');
const exportDpiSelect = document.getElementById('exportDpi');
const canvasDimensions = document.getElementById('canvasDimensions');
const canvasArea = document.querySelector('.canvas-area'); // Container for fitting

// --- Event Listeners ---

// 1. Background Upload
bgInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (f) => {
        const data = f.target.result;
        fabric.Image.fromURL(data, (img) => {
            bgImage = img;
            
            // Auto-fit to screen
            fitCanvasToScreen();

            // Set as background
            canvas.setBackgroundImage(bgImage, canvas.renderAll.bind(canvas));
            
            updateCanvasInfo();
            enableQrControlsIfReady();
        });
    };
    reader.readAsDataURL(file);
});

// Resize observer to handle window resizing
window.addEventListener('resize', () => {
    if (bgImage) {
        fitCanvasToScreen();
        // Re-center QR if it was center-aligned? 
        // For now, we just re-fit the view.
    }
});

// 2. QR Upload (SVG/PNG)
qrInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    
    // Check if SVG
    if (file.type === 'image/svg+xml') {
        reader.onload = (f) => {
            const svgStr = f.target.result;
            // Rasterize SVG logic
            loadSvgAsImage(svgStr, (imgObj) => {
                addQrToCanvas(imgObj);
            });
        };
        reader.readAsText(file); // Read SVG as text first
    } else {
        // PNG/JPG
        reader.onload = (f) => {
            fabric.Image.fromURL(f.target.result, (img) => {
                addQrToCanvas(img);
            });
        };
        reader.readAsDataURL(file);
    }
});

// 3. QR Controls
qrSizeInput.addEventListener('input', (e) => {
    if (qrObject) {
        const scale = parseFloat(e.target.value);
        qrObject.scale(scale);
        canvas.renderAll();
    }
});

whitePaddingCheckbox.addEventListener('change', (e) => {
    const isChecked = e.target.checked;
    paddingControlDiv.style.display = isChecked ? 'block' : 'none';
    updateQrPadding();
});

paddingSizeInput.addEventListener('input', () => {
    updateQrPadding();
});

// 4. Export
downloadBtn.addEventListener('click', () => {
    if (!bgImage) {
        alert('Please upload a background image first.');
        return;
    }
    
    // Deselect everything so selection handles don't show up in export
    canvas.discardActiveObject();
    canvas.renderAll();

    const userMultiplier = parseFloat(exportDpiSelect.value);
    // Compensate for the view zoom (canvasScale)
    // If zoom is 0.5 (view is half size), we need 2x multiplier just to get back to 1x original
    const effectiveMultiplier = userMultiplier * (1 / canvasScale);
    
    const dataURL = canvas.toDataURL({
        format: 'png',
        quality: 1,
        multiplier: effectiveMultiplier
    });

    const link = document.createElement('a');
    link.download = 'flyer-qr-overlay.png';
    link.href = dataURL;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
});

// --- Helper Functions ---

function fitCanvasToScreen() {
    if (!bgImage) return;

    // Get available size from container
    // Subtract some padding (e.g. 40px)
    const availWidth = canvasArea.clientWidth - 40;
    const availHeight = canvasArea.clientHeight - 40;

    const imgWidth = bgImage.width;
    const imgHeight = bgImage.height;

    // Calculate scale to fit
    const scaleX = availWidth / imgWidth;
    const scaleY = availHeight / imgHeight;
    
    // Use the smaller scale to fit entire image
    // If image is smaller than screen, we can opt to keep it at 1 (Math.min(1, ...)) 
    // or zoom in. Let's strictly "fit" so it's fully visible.
    let scale = Math.min(scaleX, scaleY);
    
    // Don't zoom in if image is tiny? (Optional). 
    // Let's cap max zoom at 1.0 for now to prevent blurriness on small images, 
    // unless user explicitly zooms (future feature).
    if (scale > 1) scale = 1;

    canvasScale = scale;
    
    // Resize canvas element
    canvas.setWidth(imgWidth * canvasScale);
    canvas.setHeight(imgHeight * canvasScale);
    
    // Set Zoom for Fabric
    canvas.setZoom(canvasScale);
    
    // Update background if needed (though setBackgroundImage usually handles it if already set)
    // Note: Fabric's background image might need explicit scale reset if not handled by zoom
    // But typically setZoom handles the viewport.
    
    updateCanvasInfo();
}

function updateCanvasInfo() {
    if (bgImage) {
        const percent = Math.round(canvasScale * 100);
        canvasDimensions.textContent = `Image: ${bgImage.width} x ${bgImage.height} px | View: ${percent}%`;
    } else {
        canvasDimensions.textContent = 'No canvas loaded';
    }
}

function enableQrControlsIfReady() {
    if (bgImage) {
        qrControls.style.opacity = '1';
        qrControls.style.pointerEvents = 'auto';
    }
}

/**
 * Loads an SVG string, creates a Blob URL, and loads it as a Fabric Image.
 * This effectively rasterizes it so we can treat it like a PNG.
 */
function loadSvgAsImage(svgString, callback) {
    const blob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    
    const img = new Image();
    img.onload = () => {
        const fImg = new fabric.Image(img);
        URL.revokeObjectURL(url);
        callback(fImg);
    };
    img.src = url;
}

function addQrToCanvas(fabricImg) {
    // Remove existing QR if any
    if (qrObject) {
        canvas.remove(qrObject);
    }
    
    qrOriginalImage = fabricImg;
    
    // Reset controls
    whitePaddingCheckbox.checked = false;
    paddingControlDiv.style.display = 'none';
    
    // Default positioning logic
    // Place roughly in bottom right or center
    if (canvas.width) {
        fabricImg.set({
            originX: 'center',
            originY: 'center',
            left: canvas.width / 2,
            top: canvas.height / 2
        });
        
        // Initial scale - make it reasonable relative to canvas
        const targetWidth = Math.min(canvas.width * 0.2, 200); 
        const scale = targetWidth / fabricImg.width;
        fabricImg.scale(scale);
        qrSizeInput.value = scale;
    }

    qrObject = fabricImg;
    canvas.add(qrObject);
    canvas.setActiveObject(qrObject);
    canvas.renderAll();
    
    enableQrControlsIfReady();
}

function updateQrPadding() {
    if (!qrOriginalImage) return;

    // Save current state (position, scale)
    const currentScale = qrObject.scaleX; // Assuming uniform scaling
    const currentLeft = qrObject.left;
    const currentTop = qrObject.top;
    const currentAngle = qrObject.angle;

    // Remove current object from canvas
    canvas.remove(qrObject);

    if (whitePaddingCheckbox.checked) {
        const padding = parseInt(paddingSizeInput.value) || 10;
        
        // Create a white rectangle
        // The rect needs to be slightly larger than the image
        const imgWidth = qrOriginalImage.width;
        const imgHeight = qrOriginalImage.height;
        
        const rect = new fabric.Rect({
            fill: 'white',
            width: imgWidth + (padding * 2),
            height: imgHeight + (padding * 2),
            originX: 'center',
            originY: 'center'
        });

        // Ensure image is centered
        qrOriginalImage.set({
            originX: 'center',
            originY: 'center',
            left: 0,
            top: 0
        });

        // Create a Group
        const group = new fabric.Group([rect, qrOriginalImage], {
            originX: 'center',
            originY: 'center',
            left: currentLeft,
            top: currentTop,
            scaleX: currentScale,
            scaleY: currentScale,
            angle: currentAngle
        });

        qrObject = group;
    } else {
        // Restore raw image
        qrOriginalImage.set({
            originX: 'center',
            originY: 'center',
            left: currentLeft,
            top: currentTop,
            scaleX: currentScale,
            scaleY: currentScale,
            angle: currentAngle
        });
        qrObject = qrOriginalImage;
    }

    canvas.add(qrObject);
    canvas.setActiveObject(qrObject);
    canvas.renderAll();
}
