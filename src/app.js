// Initialize Fabric canvas
const canvas = new fabric.Canvas('c', {
    preserveObjectStacking: true, // Prevents objects from jumping to front when selected
    selection: false // Disable group selection by drag
});

// State
let bgImage = null;
let canvasScale = 1; // Viewport scale (zoom level)

// DOM Elements
const bgInput = document.getElementById('bgInput');
const overlayInput = document.getElementById('overlayInput'); // Used for any overlay
const overlayControls = document.getElementById('overlayControls');
const overlaySizeInput = document.getElementById('overlaySize');
const whitePaddingCheckbox = document.getElementById('whitePadding');
const paddingSizeInput = document.getElementById('paddingSize');
const paddingControlDiv = document.querySelector('.padding-size-control');
const downloadBtn = document.getElementById('downloadBtn');
const deleteBtn = document.getElementById('deleteBtn');
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
            enableOverlayControlsIfReady();
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

// 2. Overlay Upload (SVG/PNG)
overlayInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    
    // Check if SVG
    if (file.type === 'image/svg+xml') {
        reader.onload = (f) => {
            const svgStr = f.target.result;
            // Rasterize SVG logic
            loadSvgAsImage(svgStr, (imgObj) => {
                addOverlayToCanvas(imgObj);
            });
        };
        reader.readAsText(file); // Read SVG as text first
    } else {
        // PNG/JPG
        reader.onload = (f) => {
            fabric.Image.fromURL(f.target.result, (img) => {
                addOverlayToCanvas(img);
            });
        };
        reader.readAsDataURL(file);
    }
    // Reset input
    e.target.value = '';
});

// 3. Selection Controls
overlaySizeInput.addEventListener('input', (e) => {
    const activeObject = canvas.getActiveObject();
    if (activeObject && activeObject !== bgImage) {
        const scale = parseFloat(e.target.value);
        activeObject.scale(scale);
        canvas.renderAll();
    }
});

whitePaddingCheckbox.addEventListener('change', (e) => {
    const isChecked = e.target.checked;
    paddingControlDiv.style.display = isChecked ? 'block' : 'none';
    updateOverlayPadding();
});

paddingSizeInput.addEventListener('input', () => {
    updateOverlayPadding();
});

deleteBtn.addEventListener('click', () => {
    const activeObject = canvas.getActiveObject();
    if (activeObject && activeObject !== bgImage) {
        canvas.remove(activeObject);
        canvas.discardActiveObject();
        canvas.renderAll();
    }
});

// Sync UI with selection
canvas.on('selection:created', updateControlsFromSelection);
canvas.on('selection:updated', updateControlsFromSelection);
canvas.on('selection:cleared', () => {
    overlayControls.style.opacity = '0.5';
    overlayControls.style.pointerEvents = 'none';
});

// Update size slider on manual scale
canvas.on('object:scaling', (e) => {
    if (e.target) {
        overlaySizeInput.value = e.target.scaleX;
    }
});

function updateControlsFromSelection() {
    const activeObject = canvas.getActiveObject();
    if (!activeObject || activeObject === bgImage) {
        overlayControls.style.opacity = '0.5';
        overlayControls.style.pointerEvents = 'none';
        return;
    }

    overlayControls.style.opacity = '1';
    overlayControls.style.pointerEvents = 'auto';

    // Sync slider
    overlaySizeInput.value = activeObject.scaleX;

    // Check if it's a padded group
    const isPadded = activeObject.type === 'group' && activeObject._objects.length > 1;
    whitePaddingCheckbox.checked = isPadded;
    paddingControlDiv.style.display = isPadded ? 'block' : 'none';
    
    if (isPadded) {
        const rect = activeObject._objects[0];
        const img = activeObject._objects[1];
        // Padding was (rectWidth - imgWidth) / 2
        paddingSizeInput.value = (rect.width - img.width) / 2;
    }
}

// 4. Export
downloadBtn.addEventListener('click', () => {
    try {
        if (!bgImage) {
            alert('Please upload a background image first.');
            return;
        }

        // Feedback to user
        const originalText = downloadBtn.textContent;
        downloadBtn.textContent = 'Processing...';
        downloadBtn.disabled = true;
        
        // Use setTimeout to allow UI to update before heavy processing
        setTimeout(() => {
            try {
                // Deselect everything so selection handles don't show up in export
                canvas.discardActiveObject();
                canvas.renderAll();

                const userMultiplier = parseFloat(exportDpiSelect.value) || 1;
                // Compensate for the view zoom (canvasScale)
                const effectiveMultiplier = userMultiplier * (1 / canvasScale);
                
                console.log(`Export debug: Scale=${canvasScale}, UserMult=${userMultiplier}, EffMult=${effectiveMultiplier}`);
                console.log(`Est. Size: ${canvas.width * effectiveMultiplier} x ${canvas.height * effectiveMultiplier}`);

                const dataURL = canvas.toDataURL({
                    format: 'png',
                    quality: 1,
                    multiplier: effectiveMultiplier
                });

                const link = document.createElement('a');
                link.download = 'image-overlay.png';
                link.href = dataURL;
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
            } catch (innerErr) {
                console.error('Export error:', innerErr);
                alert('Failed to export image. The resolution might be too high for your browser. Try a lower quality setting.');
            } finally {
                downloadBtn.textContent = originalText;
                downloadBtn.disabled = false;
            }
        }, 50);

    } catch (err) {
        console.error('Setup error:', err);
        alert('An unexpected error occurred: ' + err.message);
        downloadBtn.disabled = false;
    }
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

function enableOverlayControlsIfReady() {
    if (bgImage) {
        overlayControls.style.opacity = '1';
        overlayControls.style.pointerEvents = 'auto';
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
        fImg.set('originalImage', fImg); // Store reference
        URL.revokeObjectURL(url);
        callback(fImg);
    };
    img.src = url;
}

function addOverlayToCanvas(fabricImg) {
    if (canvas.width) {
        fabricImg.set({
            originX: 'center',
            originY: 'center',
            left: (canvas.width / canvasScale) / 2,
            top: (canvas.height / canvasScale) / 2
        });
        
        // Initial scale - make it reasonable relative to background
        const targetWidth = Math.min(bgImage ? bgImage.width * 0.2 : 200, 200); 
        const scale = targetWidth / fabricImg.width;
        fabricImg.scale(scale);
    }

    // Ensure metadata is carried
    if (!fabricImg.get('originalImage')) {
        fabricImg.set('originalImage', fabricImg);
    }

    canvas.add(fabricImg);
    canvas.setActiveObject(fabricImg);
    canvas.renderAll();
    
    enableOverlayControlsIfReady();
}

function updateOverlayPadding() {
    const activeObject = canvas.getActiveObject();
    if (!activeObject || activeObject === bgImage) return;

    // Save current state
    const currentScale = activeObject.scaleX;
    const currentLeft = activeObject.left;
    const currentTop = activeObject.top;
    const currentAngle = activeObject.angle;

    // Identify the base image
    let baseImage = activeObject.get('originalImage');
    if (!baseImage && activeObject.type === 'group') {
        // Fallback for groups
        baseImage = activeObject._objects.find(obj => obj.type === 'image')?.get('originalImage');
    }

    if (!baseImage) return;

    canvas.remove(activeObject);

    let newObject;
    if (whitePaddingCheckbox.checked) {
        const padding = parseInt(paddingSizeInput.value) || 10;
        
        const rect = new fabric.Rect({
            fill: 'white',
            width: baseImage.width + (padding * 2),
            height: baseImage.height + (padding * 2),
            originX: 'center',
            originY: 'center'
        });

        baseImage.set({
            originX: 'center',
            originY: 'center',
            left: 0,
            top: 0
        });

        newObject = new fabric.Group([rect, baseImage], {
            originX: 'center',
            originY: 'center',
            left: currentLeft,
            top: currentTop,
            scaleX: currentScale,
            scaleY: currentScale,
            angle: currentAngle
        });
    } else {
        baseImage.set({
            originX: 'center',
            originY: 'center',
            left: currentLeft,
            top: currentTop,
            scaleX: currentScale,
            scaleY: currentScale,
            angle: currentAngle
        });
        newObject = baseImage;
    }

    newObject.set('originalImage', baseImage);
    canvas.add(newObject);
    canvas.setActiveObject(newObject);
    canvas.renderAll();
}
