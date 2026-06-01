const fs = require('fs');
const targetFile = 'K:\\Project\\## PLUGINS APAYA\\APAYA-STUDIO\\ui\\dashboard.html';
let content = fs.readFileSync(targetFile, 'utf8');

// 1. Add tab-upscale
const upscaleHtml = `
        <!-- ============================================== -->
        <!-- TAB 7: UPSCALE 4K -->
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
        </div>
    </main>`;
content = content.replace('</main>', upscaleHtml);

// Navigation link for upscale
const navLinkHtml = `<div class="tab-icon" onclick="switchTab('tab-upscale', this)"><i class="fa-solid fa-maximize"></i><span>Upscale</span></div>`;
content = content.replace(/<div class="tab-icon" onclick="switchTab\('tab-motion', this\)">.*?<\/div>/, match => match + '\r\n        ' + navLinkHtml);

// SwitchTab logic for upscale
content = content.replace("else if (tabId === 'tab-swap') activeProcessTab = 'swap';", "else if (tabId === 'tab-upscale') activeProcessTab = 'upscale';\r\n            else if (tabId === 'tab-swap') activeProcessTab = 'swap';");
content = content.replace("document.getElementById('sidebar-motion').style.display = 'none';", "document.getElementById('sidebar-upscale').style.display = 'none';\r\n              document.getElementById('sidebar-motion').style.display = 'none';");
content = content.replace("else if (tabId === 'tab-motion') { document.getElementById('sidebar-motion').style.display = 'flex'; loadMotionHistory(); }", "else if (tabId === 'tab-upscale') { document.getElementById('sidebar-upscale').style.display = 'flex'; loadUpscaleHistory(); }\r\n              else if (tabId === 'tab-motion') { document.getElementById('sidebar-motion').style.display = 'flex'; loadMotionHistory(); }");


// Javascript functions for upscale
const jsUpscaleFunc = `
        function updateUpscaleBASlider(val) { document.getElementById('up-img-after').style.clipPath = \`inset(0 0 0 \${val}%)\`; document.getElementById('up-ba-handle').style.left = val + '%'; }

        function triggerUpscaleGenerate() {
            const input = document.getElementById('upscale-file-input');
            const placeholder = document.getElementById('upscale-placeholder');
            const thumb = document.getElementById('upscale-preview-thumb');
            let imgUrl = null;

            if (thumb.style.display !== 'none' && thumb.src) {
                imgUrl = thumb.src;
            } else if (placeholder.dataset.src) {
                imgUrl = placeholder.dataset.src;
            }

            if (!imgUrl) {
                showToast("Error", "Pilih atau upload gambar dulu!");
                return;
            }

            document.getElementById('upscale-loading-overlay').style.display = 'flex';
            document.getElementById('btn-generate-upscale').disabled = true;

            const before = document.getElementById('up-img-before');
            before.src = imgUrl;
            before.onload = () => { document.getElementById('up-ba-container').style.display = 'block'; };
            document.getElementById('upscale-placeholder').style.display = 'none';

            sketchup.generate_upscale(imgUrl);
        }

        function showUpscaleResult(url, type) {
            document.getElementById('upscale-loading-overlay').style.display = 'none';
            document.getElementById('btn-generate-upscale').disabled = false;
            document.getElementById('upscale-placeholder').style.display = 'none';

            var after = document.getElementById('up-img-after');
            after.src = url;
            after.style.display = 'block';
            document.getElementById('up-ba-slider').style.display = 'block';
            document.getElementById('up-ba-handle').style.display = 'block';
            document.getElementById('up-ba-slider').value = 50;
            after.style.clipPath = 'inset(0 0 0 50%)';
            document.getElementById('up-ba-handle').style.left = '50%';
            showToast('Upscale Selesai', 'Gambar berhasil di-upscale ke 4K!');
        }

        function saveUpscaleResult() {
            var after = document.getElementById('up-img-after');
            if (after.src && after.src.length > 10) {
                sketchup.save_image(after.src);
            } else {
                showToast('Error', 'Belum ada hasil upscale yang bisa disimpan.');
            }
        }

        function handleUpscaleDrop(e) {
            e.preventDefault();
            e.currentTarget.style.borderColor = 'var(--border)';
            if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                const reader = new FileReader();
                reader.onload = function(evt) {
                    const thumb = document.getElementById('upscale-preview-thumb');
                    thumb.src = evt.target.result;
                    thumb.style.display = 'block';
                    document.getElementById('upscale-drop-text').style.display = 'none';
                };
                reader.readAsDataURL(e.dataTransfer.files[0]);
            }
        }

        function handleUpscaleFileSelect(e) {
            if (e.target.files && e.target.files[0]) {
                const reader = new FileReader();
                reader.onload = function(evt) {
                    const thumb = document.getElementById('upscale-preview-thumb');
                    thumb.src = evt.target.result;
                    thumb.style.display = 'block';
                    document.getElementById('upscale-drop-text').style.display = 'none';
                };
                reader.readAsDataURL(e.target.files[0]);
            }
        }

        function loadUpscaleHistory() {
            // Placeholder history logic if any
        }
`;
content = content.replace("function updateRenderBASlider", jsUpscaleFunc + "\r\n        function updateRenderBASlider");

// 2. Add slider HTML after swap-img-after
const targetHtml = '<img id="swap-img-after" style="position: absolute; max-width: 100%; max-height: 100%; object-fit: contain; display: none; z-index: 20; box-shadow: 0 0 20px rgba(0,0,0,0.8); pointer-events: none;">';
const replacementHtml = targetHtml + '\r\n                        <input type="range" min="0" max="100" value="50" class="ba-slider" id="swap-ba-slider" style="display:none; z-index: 25; width: 100%; height: 100%; position: absolute; margin: 0; background: transparent; -webkit-appearance: none; appearance: none; outline: none;" oninput="updateSwapBASlider(this.value)">\r\n                        <div class="ba-handle" id="swap-ba-handle" style="left: 50%; display:none; z-index: 25; position: absolute; top: 0; bottom: 0; width: 4px; background: white; pointer-events: none; transform: translateX(-50%); box-shadow: 0 0 10px rgba(0,0,0,0.5);"><div style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); width: 24px; height: 24px; background: white; border-radius: 50%; box-shadow: 0 0 10px rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center;"><i class="fa-solid fa-left-right" style="color: var(--primary); font-size: 12px;"></i></div></div>';
content = content.replace(targetHtml, replacementHtml);

// 3. Add updateSwapBASlider JS
const jsTarget = "function updateRenderBASlider(val) { document.getElementById('r-img-after').style.clipPath = `inset(0 0 0 ${val}%)`; document.getElementById('r-ba-handle').style.left = val + '%'; }";
const jsReplacement = jsTarget + "\r\n        function updateSwapBASlider(val) { document.getElementById('swap-img-after').style.clipPath = `inset(0 0 0 ${val}%)`; document.getElementById('swap-ba-handle').style.left = val + '%'; }";
content = content.replace(jsTarget, jsReplacement);

// 4. Update triggerSwapGenerate
const triggerTarget = "document.getElementById('swap-loading-overlay').style.display = 'flex';\r\n            document.getElementById('btn-generate-swap').disabled = true;\r\n\r\n            const prompt = swapMode === 'object'";
const triggerReplacement = "document.getElementById('swap-loading-overlay').style.display = 'flex';\r\n            document.getElementById('btn-generate-swap').disabled = true;\r\n            \r\n            document.getElementById('swap-img-after').style.display = 'none';\r\n            document.getElementById('swap-ba-slider').style.display = 'none';\r\n            document.getElementById('swap-ba-handle').style.display = 'none';\r\n            document.getElementById('swap-canvas').style.display = 'block';\r\n\r\n            const prompt = swapMode === 'object'";
content = content.replace(triggerTarget, triggerReplacement);

// 5. Update onSwapSuccess
const successTarget = "const afterImg = document.getElementById('swap-img-after');\r\n            afterImg.src = imgUrl;\r\n            afterImg.style.display = 'block';\r\n            showToast(\"Magic Swap Selesai\", \"Gambar berhasil diubah!\");";
const successReplacement = "const afterImg = document.getElementById('swap-img-after');\r\n            afterImg.src = imgUrl;\r\n            afterImg.style.display = 'block';\r\n            afterImg.style.clipPath = 'inset(0 0 0 50%)';\r\n            document.getElementById('swap-ba-slider').value = 50;\r\n            document.getElementById('swap-ba-slider').style.display = 'block';\r\n            document.getElementById('swap-ba-handle').style.left = '50%';\r\n            document.getElementById('swap-ba-handle').style.display = 'block';\r\n            document.getElementById('swap-canvas').style.display = 'none';\r\n            showToast(\"Magic Swap Selesai\", \"Gambar berhasil diubah!\");";
content = content.replace(successTarget, successReplacement);

fs.writeFileSync(targetFile, content, 'utf8');
console.log("dashboard.html fully patched with upscale and swap sliders!");
