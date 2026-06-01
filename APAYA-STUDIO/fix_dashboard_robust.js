const fs = require('fs');
const TARGET = 'K:\\Project\\## PLUGINS APAYA\\APAYA-STUDIO\\ui\\dashboard.html';
let src = fs.readFileSync(TARGET, 'utf8');
const lines = src.split(/\r?\n/);

function findLine(str) {
    return lines.findIndex(l => l.includes(str));
}

// FIX 1: setBeforeImage
let idx1 = findLine('function setBeforeImage(base64Image)');
if (idx1 !== -1) {
    lines[idx1] = `        function setBeforeImage(imgData) {`;
    lines[idx1+1] = `            let finalSrc = (imgData.startsWith('data:') || imgData.startsWith('file:///') || imgData.startsWith('http')) ? imgData : "data:image/png;base64," + imgData;`;
    console.log('Fix 1 applied');
}

// FIX 2: Swap slider HTML
let idx2 = findLine('<img id="swap-img-after"');
if (idx2 !== -1) {
    lines[idx2] = `                        <img id="swap-img-after" style="position: absolute; max-width: 100%; max-height: 100%; object-fit: contain; display: none; z-index: 20; box-shadow: 0 0 20px rgba(0,0,0,0.8); pointer-events: none;">
                        <input type="range" min="0" max="100" value="50" class="ba-slider" id="swap-ba-slider" style="display:none; z-index:25; width:100%; height:100%; position:absolute; margin:0; background:transparent; -webkit-appearance:none; appearance:none; outline:none;" oninput="updateSwapBASlider(this.value)">
                        <div class="ba-handle" id="swap-ba-handle" style="left:50%; display:none; z-index:25; position:absolute; top:0; bottom:0; width:4px; background:white; pointer-events:none; transform:translateX(-50%); box-shadow:0 0 10px rgba(0,0,0,0.5);"><div style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);width:24px;height:24px;background:white;border-radius:50%;box-shadow:0 0 10px rgba(0,0,0,0.5);display:flex;align-items:center;justify-content:center;"><i class="fa-solid fa-left-right" style="color:var(--primary);font-size:12px;"></i></div></div>`;
    console.log('Fix 2 applied');
}

// FIX 3: updateSwapBASlider
let idx3 = findLine('function updateRenderBASlider');
if (idx3 !== -1 && !lines.find(l => l.includes('updateSwapBASlider'))) {
    lines[idx3] += `\n        function updateSwapBASlider(val) { document.getElementById('swap-img-after').style.clipPath = \`inset(0 0 0 \${val}%)\`; document.getElementById('swap-ba-handle').style.left = val + '%'; }`;
    console.log('Fix 3 applied');
}

// FIX 4: onSwapSuccess
let idx4 = findLine('function onSwapSuccess(imgUrl)');
if (idx4 !== -1) {
    let target = findLine('showToast("Magic Swap Selesai"');
    if(target !== -1) {
        lines.splice(target, 0, 
            `            afterImg.style.clipPath = 'inset(0 0 0 50%)';`,
            `            document.getElementById('swap-ba-slider').value = 50;`,
            `            document.getElementById('swap-ba-slider').style.display = 'block';`,
            `            document.getElementById('swap-ba-handle').style.left = '50%';`,
            `            document.getElementById('swap-ba-handle').style.display = 'block';`,
            `            document.getElementById('swap-canvas').style.display = 'none';`
        );
        console.log('Fix 4 applied');
    }
}

// FIX 5: Upscale HTML
let idx5 = findLine('</main>');
if (idx5 !== -1 && !lines.find(l => l.includes('id="tab-upscale"'))) {
    const upscaleHtml = `        <!-- ============================================== -->
        <!-- TAB: UPSCALE 4K -->
        <!-- ============================================== -->
        <div id="tab-upscale" class="tab-content">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:15px;">
                <h3 style="margin:0;"><i class="fa-solid fa-maximize" style="color:var(--primary); margin-right:8px;"></i> APAYA UPSCALE 4K</h3>
                <div class="ai-action-bar"><button class="btn-action-top" onclick="saveUpscaleResult()" title="Save Image"><i class="fa-solid fa-download"></i></button></div>
            </div>
            <div style="display: flex; gap: 20px; height: 100%;">
                <div style="width: 320px; display: flex; flex-direction: column; background: var(--bg-panel); border: 1px solid var(--border); border-radius: 12px; padding: 20px; box-shadow: 0 4px 20px rgba(0,0,0,0.2); flex-shrink: 0;">
                    <span class="sidebar-title">Upload Gambar Eksternal</span>
                    <div id="upscale-drop-zone" style="border: 2px dashed var(--border); border-radius: 8px; height: 150px; display: flex; flex-direction: column; align-items: center; justify-content: center; cursor: pointer; background: rgba(255,255,255,0.02); transition: 0.2s; position: relative; overflow: hidden; margin-bottom: 20px;" onclick="document.getElementById('upscale-file-input').click()" ondragover="event.preventDefault(); this.style.borderColor='var(--primary)'" ondragleave="this.style.borderColor='var(--border)'" ondrop="handleUpscaleDrop(event)">
                        <i class="fa-solid fa-cloud-arrow-up" style="font-size: 20px; color: var(--text-muted); margin-bottom: 5px; pointer-events: none;"></i>
                        <span id="upscale-drop-text" style="color: var(--text-muted); font-size: 12px; font-weight: bold; pointer-events: none; text-align: center;">DRAG GAMBAR KE SINI<br>Atau Klik Untuk Upload</span>
                        <img id="upscale-preview-thumb" style="position: absolute; width: 100%; height: 100%; object-fit: cover; display: none; pointer-events: none;">
                    </div>
                    <input type="file" id="upscale-file-input" style="display:none;" accept="image/*" onchange="handleUpscaleFileSelect(event)">
                    <div style="background: rgba(250, 204, 21, 0.05); padding: 10px; border-radius: 6px; border: 1px dashed var(--primary); margin-bottom: 20px;"><span style="font-size: 10px; color: var(--text-muted);"><i class="fa-solid fa-circle-info" style="color:var(--primary);"></i> <b>INFO:</b><br>Upscale akan memperbesar gambar ke resolusi 4K dengan kualitas ultra-detail.</span></div>
                    <button class="btn-export" id="btn-generate-upscale" style="margin-top:auto;" onclick="triggerUpscaleGenerate()"><i class="fa-solid fa-maximize"></i> START UPSCALE 4K (2 Cr)</button>
                </div>
                <div class="ai-preview-box" id="upscale-preview-container">
                    <div id="upscale-placeholder" style="display:flex; flex-direction:column; align-items:center;">
                        <i class="fa-solid fa-maximize" style="font-size: 60px; color: var(--border); margin-bottom: 15px;"></i>
                        <p style="color: var(--text-muted); font-size: 13px; text-align: center;">Upload gambar atau pilih dari Render History,<br>lalu tekan Start Upscale 4K.</p>
                    </div>
                    <div class="ba-container" id="up-ba-container">
                        <img id="up-img-before" class="ba-img" src="" alt="Before">
                        <img id="up-img-after" class="ba-img" src="" alt="After" style="clip-path: inset(0 0 0 50%); display:none;">
                        <input type="range" min="0" max="100" value="50" class="ba-slider" id="up-ba-slider" style="display:none;" oninput="updateUpscaleBASlider(this.value)">
                        <div class="ba-handle" id="up-ba-handle" style="left: 50%; display:none;"></div>
                    </div>
                    <div class="loading-overlay" id="upscale-loading-overlay">
                        <img src="../assets/logo_apaya.png" class="spin-logo">
                        <span id="upscale-loading-text">UPSCALING TO 4K...</span>
                    </div>
                </div>
            </div>
        </div>`;
    lines.splice(idx5, 0, upscaleHtml);
    console.log('Fix 5 applied');
}

// FIX 6: Upscale tab icon
let idx6 = findLine(`switchTab('tab-motion', this)`);
if (idx6 !== -1 && !lines.find(l => l.includes(`switchTab('tab-upscale'`))) {
    lines.splice(idx6 + 1, 0, `        <div class="tab-icon" onclick="switchTab('tab-upscale', this)"><i class="fa-solid fa-maximize"></i><span>Upscale</span></div>`);
    console.log('Fix 6 applied');
}

// FIX 7: switchTab JS
let idx7 = findLine('function switchTab(tabId, iconEl)');
if(idx7 !== -1) {
    let t1 = findLine(`activeProcessTab = tabId === 'tab-concept'`);
    if(t1 !== -1) lines[t1] = `            activeProcessTab = tabId === 'tab-concept' ? 'concept' : (tabId === 'tab-render' ? 'render' : (tabId === 'tab-mat' ? 'material' : (tabId === 'tab-upscale' ? 'upscale' : (tabId === 'tab-swap' ? 'swap' : 'camera'))));`;
    
    let t2 = findLine(`else if (tabId === 'tab-swap' || tabId === 'tab-motion')`);
    if(t2 !== -1) lines[t2] = `            else if (tabId === 'tab-swap' || tabId === 'tab-motion' || tabId === 'tab-upscale') { /* No sidebar needed — controls are inline */ }`;
    console.log('Fix 7 applied');
}

// FIX 8: Upscale JS functions
let idx8 = findLine('function updateRenderBASlider');
if(idx8 !== -1 && !lines.find(l => l.includes('triggerUpscaleGenerate'))) {
    const upscaleJs = `function updateUpscaleBASlider(val) { document.getElementById('up-img-after').style.clipPath = \`inset(0 0 0 \${val}%)\`; document.getElementById('up-ba-handle').style.left = val + '%'; }

        function triggerUpscaleGenerate() {
            const thumb = document.getElementById('upscale-preview-thumb');
            let imgUrl = null;
            if (thumb && thumb.style.display !== 'none' && thumb.src) { imgUrl = thumb.src; }
            if (!imgUrl) { showToast("Error", "Pilih atau upload gambar dulu!"); return; }
            document.getElementById('upscale-loading-overlay').style.display = 'flex';
            document.getElementById('btn-generate-upscale').disabled = true;
            const before = document.getElementById('up-img-before');
            before.src = imgUrl;
            before.onload = () => { document.getElementById('up-ba-container').style.display = 'block'; };
            document.getElementById('upscale-placeholder').style.display = 'none';
            sketchup.generate_upscale(imgUrl);
        }

        function showUpscaleResult(url) {
            document.getElementById('upscale-loading-overlay').style.display = 'none';
            document.getElementById('btn-generate-upscale').disabled = false;
            document.getElementById('upscale-placeholder').style.display = 'none';
            var after = document.getElementById('up-img-after');
            after.src = url; after.style.display = 'block';
            document.getElementById('up-ba-slider').style.display = 'block';
            document.getElementById('up-ba-handle').style.display = 'block';
            document.getElementById('up-ba-slider').value = 50;
            after.style.clipPath = 'inset(0 0 0 50%)';
            document.getElementById('up-ba-handle').style.left = '50%';
            showToast('Upscale Selesai', 'Gambar berhasil di-upscale ke 4K!');
            if(typeof sketchup !== 'undefined') sketchup.get_init_data();
        }

        function saveUpscaleResult() {
            var after = document.getElementById('up-img-after');
            if (after.src && after.src.length > 10) { sketchup.save_to_gallery(after.src); }
            else { showToast('Error', 'Belum ada hasil upscale.'); }
        }

        function handleUpscaleDrop(e) {
            e.preventDefault(); e.currentTarget.style.borderColor = 'var(--border)';
            if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                const reader = new FileReader();
                reader.onload = function(evt) { const t = document.getElementById('upscale-preview-thumb'); t.src = evt.target.result; t.style.display = 'block'; document.getElementById('upscale-drop-text').style.display = 'none'; };
                reader.readAsDataURL(e.dataTransfer.files[0]);
            }
        }

        function handleUpscaleFileSelect(e) {
            if (e.target.files && e.target.files[0]) {
                const reader = new FileReader();
                reader.onload = function(evt) { const t = document.getElementById('upscale-preview-thumb'); t.src = evt.target.result; t.style.display = 'block'; document.getElementById('upscale-drop-text').style.display = 'none'; };
                reader.readAsDataURL(e.target.files[0]);
            }
        }\n\n`;
    lines.splice(idx8, 0, upscaleJs);
    console.log('Fix 8 applied');
}

fs.writeFileSync(TARGET, lines.join('\n'), 'utf8');
console.log('All fixes processed.');
