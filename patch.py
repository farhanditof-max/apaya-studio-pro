import re

with open("APAYA-STUDIO/ui/dashboard.html", "r", encoding="utf-8") as f:
    content = f.read()

# 1. Replace UI components
ui_from = """                    <span class="sidebar-title">Mode Magic Swap</span>
                    <div style="display: flex; gap: 10px; margin-bottom: 20px;">
                        <div class="env-box active" id="swap-env-obj" onclick="setSwapMode('object')" style="flex: 1; padding: 10px;">
                            <i class="fa-solid fa-couch" style="margin-bottom: 5px;"></i> Object
                        </div>
                        <div class="env-box" id="swap-env-mat" onclick="setSwapMode('material')" style="flex: 1; padding: 10px;">
                            <i class="fa-solid fa-chess-board" style="margin-bottom: 5px;"></i> Material
                        </div>
                    </div>"""
ui_to = """                    <span class="sidebar-title">Deskripsi Object</span>
                    <input type="text" id="swap-prompt" class="apaya-input" placeholder="Contoh: Kursi di tengah ruangan" style="margin-bottom: 20px;">"""
content = content.replace(ui_from, ui_to)

ui_brush_from = """                    <span class="sidebar-title">Brush Size (Masking)</span>
                    <input type="range" id="swap-brush-size" min="10" max="150" value="40" style="display:block; width:100%; margin-bottom: 20px; accent-color: var(--primary); cursor: pointer;" oninput="if(swapCtx) swapCtx.lineWidth = this.value;">

                    <button class="btn-sidebar" onclick="clearSwapCanvas()"><i class="fa-solid fa-eraser"></i> Clear Masking</button>"""
content = content.replace(ui_brush_from, "")

# 2. Fix JS function start
js1_from = """        function triggerSwapGenerate() {
            const refImg = document.getElementById('swap-ref-preview');
            const mainImg = document.getElementById('swap-img-before');
            if(!refImg.src || refImg.src === window.location.href) {"""
js1_to = """        function triggerSwapGenerate() {
            const refImg = document.getElementById('swap-ref-preview');
            const mainImg = document.getElementById('swap-img-before');
            const promptInput = document.getElementById('swap-prompt').value.trim();
            if(!refImg.src || refImg.src === window.location.href) {"""
content = content.replace(js1_from, js1_to)

# 3. Add prompt check
js2_from = """            if(mainImg.src.startsWith('file:///')) { showToast("Error", "Gambar cache lokal tidak bisa diswap langsung. Kirim dari Concept/Render tab."); return; }
            if(currentCredits < 1) {"""
js2_to = """            if(mainImg.src.startsWith('file:///')) { showToast("Error", "Gambar cache lokal tidak bisa diswap langsung. Kirim dari Concept/Render tab."); return; }
            if(!promptInput) {
                showToast("Error", "Tulis deskripsi object yang mau diganti (contoh: Kursi).");
                return;
            }
            if(currentCredits < 1) {"""
content = content.replace(js2_from, js2_to)

# 4. Replace mask logic with stitching
js3_from = """            if(!swapCanvas) { showToast("Error", "Canvas belum siap."); return; }

            // 1. Buat BINARY MASK (hitam-putih sempurna) untuk model inpainting
            const maskCanvas = document.createElement('canvas');
            maskCanvas.width = swapCanvas.width; maskCanvas.height = swapCanvas.height;
            const mCtx = maskCanvas.getContext('2d');
            mCtx.drawImage(swapCanvas, 0, 0);
            const imgData = mCtx.getImageData(0, 0, maskCanvas.width, maskCanvas.height);
            for (let i = 0; i < imgData.data.length; i += 4) {
                if (imgData.data[i+3] > 0) { // Jika ada coretan (alpha > 0) -> jadi putih
                    imgData.data[i] = 255;
                    imgData.data[i+1] = 255;
                    imgData.data[i+2] = 255;
                    imgData.data[i+3] = 255;
                } else { // Jika kosong -> jadi hitam
                    imgData.data[i] = 0;
                    imgData.data[i+1] = 0;
                    imgData.data[i+2] = 0;
                    imgData.data[i+3] = 255;
                }
            }
            mCtx.putImageData(imgData, 0, 0);
            const maskData = maskCanvas.toDataURL('image/png');

            document.getElementById('swap-loading-overlay').style.display = 'flex';
            document.getElementById('btn-generate-swap').disabled = true;

            const prompt = swapMode === 'object' ? 'object' : 'material';
            sketchup.generate_magic_swap([mainImg.src, maskData, refImg.src, prompt]);
        }"""
js3_to = """            // Gabung 2 gambar (side-by-side)
            const stitchedCanvas = document.createElement('canvas');
            const targetHeight = Math.max(mainImg.naturalHeight, refImg.naturalHeight);
            const ratioMain = targetHeight / mainImg.naturalHeight;
            const ratioRef = targetHeight / refImg.naturalHeight;
            const wMain = mainImg.naturalWidth * ratioMain;
            const wRef = refImg.naturalWidth * ratioRef;
            
            stitchedCanvas.width = wMain + wRef;
            stitchedCanvas.height = targetHeight;
            
            const ctx = stitchedCanvas.getContext('2d');
            ctx.drawImage(mainImg, 0, 0, wMain, targetHeight);
            ctx.drawImage(refImg, wMain, 0, wRef, targetHeight);
            
            const stitchedData = stitchedCanvas.toDataURL('image/jpeg', 0.9);

            document.getElementById('swap-loading-overlay').style.display = 'flex';
            document.getElementById('btn-generate-swap').disabled = true;

            sketchup.generate_magic_swap([stitchedData, promptInput]);
        }"""
content = content.replace(js3_from, js3_to)

# 5. Prevent JS error if brush slider is removed
init_from = """swapCtx.lineWidth = document.getElementById('swap-brush-size').value;"""
init_to = """swapCtx.lineWidth = 40; // Default brush"""
content = content.replace(init_from, init_to)

with open("APAYA-STUDIO/ui/dashboard.html", "w", encoding="utf-8") as f:
    f.write(content)

print("HTML Patched!")
