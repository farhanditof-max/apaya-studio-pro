const fs = require('fs');
const TARGET = 'K:\\Project\\## PLUGINS APAYA\\APAYA-STUDIO\\ui\\dashboard.html';
let src = fs.readFileSync(TARGET, 'utf8');

// 1. Replace the brush UI with the text input
const brushHTML = `<span class="sidebar-title">Brush Size (Masking)</span>
                    <input type="range" id="swap-brush-size" min="10" max="150" value="40" style="display:block; width:100%; margin-bottom: 20px; accent-color: var(--primary); cursor: pointer;" oninput="if(swapCtx) swapCtx.lineWidth = this.value;">

                    <button class="btn-sidebar" onclick="clearSwapCanvas()"><i class="fa-solid fa-eraser"></i> Clear Masking</button>`;
const promptHTML = `<span class="sidebar-title">Object to Swap (Ketik Nama Objek)</span>
                    <input type="text" id="swap-object-prompt" placeholder="Misal: sofa, meja, lantai..." style="width: 100%; padding: 12px; background: rgba(0,0,0,0.2); border: 1px solid var(--primary); border-radius: 6px; color: white; font-family: 'Inter', sans-serif; font-size: 13px; margin-bottom: 20px; outline: none; transition: 0.3s;" onfocus="this.style.boxShadow='0 0 8px rgba(250, 204, 21, 0.4)'" onblur="this.style.boxShadow='none'">`;

if(src.includes('swap-brush-size')) {
    src = src.replace(brushHTML, promptHTML);
    console.log("Replaced brush UI with prompt input");
}

// 2. Hide/remove the swap-canvas
const canvasHTML = `<canvas id="swap-canvas" style="position: absolute; cursor: crosshair; z-index: 10; opacity: 0.6;" onmousedown="startDrawSwap(event)" onmousemove="drawSwap(event)" onmouseup="stopDrawSwap()" onmouseout="stopDrawSwap()"></canvas>`;
const canvasHTMLHidden = `<canvas id="swap-canvas" style="display: none;"></canvas>`;
if(src.includes('id="swap-canvas"')) {
    src = src.replace(canvasHTML, canvasHTMLHidden);
    console.log("Hid swap canvas");
}

// 3. Update triggerSwapGenerate
const triggerStart = `        function triggerSwapGenerate() {
            const refImg = document.getElementById('swap-ref-preview');
            const mainImg = document.getElementById('swap-img-before');
            if(!refImg.src || refImg.src === window.location.href) {
                showToast("Error", "Pilih gambar referensi pengganti dulu.");
                return;
            }
            if(!mainImg.src || mainImg.src === window.location.href) {
                showToast("Error", "Kirim gambar ke kanvas dulu.");
                return;
            }
            if(parseInt(document.getElementById('ui-credit-balance').innerText.replace(/[^0-9]/g, '')) < 1) {
                showToast("Kredit Habis", "Kredit tidak cukup (Butuh 1 Cr). Silakan Top Up.");
                return;
            }`;

const oldTriggerEnd = `
            const maskCanvas = document.createElement('canvas');
            maskCanvas.width = swapCanvas.width; maskCanvas.height = swapCanvas.height;
            const mCtx = maskCanvas.getContext('2d');
            mCtx.fillStyle = '#000000'; mCtx.fillRect(0, 0, maskCanvas.width, maskCanvas.height);
            mCtx.drawImage(swapCanvas, 0, 0); 

            const maskData = maskCanvas.toDataURL('image/png');
            document.getElementById('swap-loading-overlay').style.display = 'flex';
            document.getElementById('btn-generate-swap').disabled = true;

            const prompt = swapMode === 'object' ? 'ganti object yang dilingkari menjadi image B' : 'ganti material pada object yang dilingkari user menjadi image B';
            sketchup.generate_magic_swap(mainImg.src, maskData, refImg.src, prompt);
        }`;

const newTriggerEnd = `
            const objName = document.getElementById('swap-object-prompt').value.trim();
            if (!objName) {
                showToast("Error", "Masukkan nama objek yang ingin diganti!");
                document.getElementById('swap-object-prompt').focus();
                return;
            }

            document.getElementById('swap-loading-overlay').style.display = 'flex';
            document.getElementById('btn-generate-swap').disabled = true;

            const prompt = swapMode === 'object' ? 'Ganti objek ' + objName + ' menjadi sesuai dengan referensi.' : 'Ubah material pada ' + objName + ' menjadi sesuai referensi.';
            sketchup.generate_magic_swap(mainImg.src, refImg.src, prompt);
        }`;

const oldTriggerBlock = triggerStart + oldTriggerEnd;
const newTriggerBlock = triggerStart + newTriggerEnd;

if(src.includes('function triggerSwapGenerate()')) {
    // try to do a substring replacement manually if exact string matching fails
    let s = src;
    const searchIdx = s.indexOf('function triggerSwapGenerate()');
    const endIdx = s.indexOf('}', s.indexOf('sketchup.generate_magic_swap', searchIdx)) + 1;
    if (searchIdx !== -1 && endIdx !== -1) {
        src = s.substring(0, searchIdx) + newTriggerBlock + s.substring(endIdx);
        console.log("Updated triggerSwapGenerate logic");
    }
}

fs.writeFileSync(TARGET, src, 'utf8');
console.log('Update complete.');
