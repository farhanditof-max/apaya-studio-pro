function setPromptMode(mode, isRender = false) {
    const prefix = isRender ? 'r-' : '';
    const promptBox = document.getElementById(prefix + 'ai-prompt');

    if(document.getElementById(prefix + 'btn-auto')) {
        document.getElementById(prefix + 'btn-auto').className = mode === 'auto' ? 'switch-btn-small active' : 'switch-btn-small';
        document.getElementById(prefix + 'btn-manual').className = mode === 'manual' ? 'switch-btn-small active' : 'switch-btn-small';
        if(document.getElementById(prefix + 'btn-ai'))
            document.getElementById(prefix + 'btn-ai').className = mode === 'ai' ? 'switch-btn-small active' : 'switch-btn-small';
    }

    if(mode === 'auto') {
        promptBox.disabled = true; promptBox.style.opacity = 0.5;
        promptBox.placeholder = "Ketik tambahan manual prompt jika mau...";
        promptBox.style.height = "80px";
    } else if(mode === 'manual') {
        promptBox.disabled = false; promptBox.style.opacity = 1;
        promptBox.placeholder = "Ketik manual prompt Anda di sini...";
        promptBox.style.height = "80px"; promptBox.focus();
    } else if(mode === 'ai') {
        promptBox.disabled = false; promptBox.style.opacity = 1;
        promptBox.value = "";
        promptBox.placeholder = "Nama Ruangan (wajib): cth. Master Bedroom, Living Room...";
        promptBox.style.height = "60px";
    }

    if(isRender) currentPromptMode = mode;
}

// =====================================
// MATERIAL BOARD DRAG & DROP LOGIC
// =====================================
document.addEventListener("DOMContentLoaded", () => {
    const dropZone = document.getElementById('ref-upload-box');
    if(dropZone) {
        dropZone.addEventListener('dragover', (e) => { e.preventDefault(); dropZone.style.borderColor = 'var(--orange)'; dropZone.style.background = 'rgba(251, 146, 60, 0.1)'; });
        dropZone.addEventListener('dragleave', (e) => { e.preventDefault(); dropZone.style.borderColor = 'var(--primary)'; dropZone.style.background = 'rgba(250, 204, 21, 0.05)'; });
        dropZone.addEventListener('drop', (e) => {
            e.preventDefault(); dropZone.style.borderColor = 'var(--primary)'; dropZone.style.background = 'rgba(250, 204, 21, 0.05)';
            if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
                const file = e.dataTransfer.files[0];
                if (file.type.startsWith('image/')) processRefFile(file); else showApayaModal("Format Tidak Didukung", "Silakan masukkan file berupa gambar (JPG/PNG).", "fa-triangle-exclamation", "var(--danger)");
            }
        });
    }

    const matDropZone = document.getElementById('mat-drop-zone');
    if(matDropZone) {
        matDropZone.addEventListener('dragover', (e) => { e.preventDefault(); matDropZone.style.borderColor = 'var(--primary)'; });
        matDropZone.addEventListener('dragleave', (e) => { e.preventDefault(); matDropZone.style.borderColor = 'var(--border)'; });
        matDropZone.addEventListener('drop', (e) => {
            e.preventDefault(); matDropZone.style.borderColor = 'var(--border)';
            if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
                const file = e.dataTransfer.files[0];
                if (file.type.startsWith('image/')) processMatLocalFile(file);
            }
        });
        document.getElementById('mat-placeholder').onclick = () => document.getElementById('mat-file-input').click();
    }
});

function loadRefImage(event) { const file = event.target.files[0]; if(!file) return; processRefFile(file); }
function processRefFile(file) {
    const reader = new FileReader();
    reader.onload = function(e) {
        document.getElementById('ref-preview').src = e.target.result; document.getElementById('ref-preview').style.display = 'block';
        document.getElementById('ref-remove').style.display = 'flex'; materialBoardBase64 = e.target.result.split(',')[1];
    };
    reader.readAsDataURL(file);
}
function removeRefImage() { document.getElementById('ref-preview').src = ""; document.getElementById('ref-preview').style.display = 'none'; document.getElementById('ref-remove').style.display = 'none'; document.getElementById('ref-file-input').value = ""; materialBoardBase64 = ""; }

function loadMatLocalImage(event) { const file = event.target.files[0]; if(!file) return; processMatLocalFile(file); }
function processMatLocalFile(file) {
    const reader = new FileReader();
    reader.onload = function(e) {
        document.getElementById('mat-placeholder').style.display = 'none'; document.getElementById('mat-canvas-container').style.display = 'flex';
        const matImg = document.getElementById('mat-preview-img');
        matImg.onload = function() { initCanvas(); }
        matImg.src = e.target.result; switchTab('tab-mat', document.querySelectorAll('.tab-icon')[2]);
    };
    reader.readAsDataURL(file);
}

function loadConceptThumbs(btn) {
    if(btn) { const icon = btn.querySelector('i'); icon.classList.add('fa-spin'); setTimeout(() => icon.classList.remove('fa-spin'), 800); }
    const listDiv = document.getElementById('concept-thumb-list'); listDiv.innerHTML = '';
    if(currentCameras.length === 0) { listDiv.innerHTML = '<p style="color:var(--text-muted); font-size: 11px; text-align: center;">Belum ada kamera.</p>'; return; }
    const fragment = document.createDocumentFragment();
    currentCameras.forEach(cam => {
        const isPt = cam.type.toLowerCase().includes('portrait'); const badgeColor = isPt ? 'var(--orange)' : 'var(--primary)'; const icon = isPt ? 'fa-mobile-screen' : 'fa-desktop';
        const card = document.createElement('div'); card.className = selectedConceptCam === cam.name ? 'thumb-card active' : 'thumb-card';
        card.onclick = (e) => { if(e.target.type !== 'checkbox') selectConceptCamera(cam.name, card); };
        const isCheckedStr = (typeof checkedBatchCams !== 'undefined' && checkedBatchCams.has(cam.name)) ? 'checked' : '';
        card.innerHTML = `<input type="checkbox" class="batch-cam-check" data-cam="${cam.name}" ${isCheckedStr} onchange="updateBatchSelection()" style="accent-color:var(--primary); margin-right:8px; cursor:pointer;"><div class="thumb-img-box"><i class="fa-solid ${icon}"></i></div><div class="thumb-info"><span class="thumb-name">${cam.name}</span><span style="font-size:9px; color:${badgeColor}; font-weight:bold;">${cam.type}</span></div>`;
        fragment.appendChild(card);
    });
    listDiv.appendChild(fragment);
}

function selectConceptCamera(camName, cardElement) {
    if (selectedConceptCam === camName) return;
    document.querySelectorAll('.thumb-card').forEach(c => c.classList.remove('active')); cardElement.classList.add('active'); selectedConceptCam = camName;

    if(activeProcessTab === 'concept') {
        document.getElementById('ai-placeholder').style.display = 'none';
        document.getElementById('ba-container').style.display = 'none';
        document.getElementById('ai-loading-overlay').style.display = 'flex';
        document.getElementById('loading-text').innerText = "MENGAMBIL GAMBAR SKETCHUP...";
    }
    else if (activeProcessTab === 'render') {
        const queueView = document.getElementById('batch-queue-view');
        if(queueView && queueView.style.display !== 'none' && !queueView.classList.contains('minimize-anim')) {
            minimizeRenderQueue();
        }
        document.getElementById('r-placeholder').style.display = 'none';
        document.getElementById('r-ba-container').style.display = 'none';
        document.getElementById('r-loading-overlay').style.display = 'flex';
        document.getElementById('r-loading-text').innerText = "MENGAMBIL GAMBAR SKETCHUP...";
    }

    setTimeout(() => {
        if(typeof sketchup !== 'undefined') {
            sketchup.get_scene_thumbnail(camName);
        } else {
            setTimeout(() => { setBeforeImage(DUMMY_BEFORE_IMG); }, 800);
        }
    }, 100);
}

function setBeforeImage(imgData) {
    let finalSrc = (imgData.startsWith('data:') || imgData.startsWith('file:///') || imgData.startsWith('http')) ? imgData : "data:image/png;base64," + imgData;

    if(activeProcessTab === 'concept') {
        document.getElementById('ai-loading-overlay').style.display = 'none';
        document.getElementById('ba-container').style.display = 'block';
        document.getElementById('img-before').src = finalSrc;
        document.getElementById('img-after').style.display = 'none';
        document.getElementById('ba-handle').style.display = 'none';
        document.getElementById('ba-slider').style.display = 'none';
    } else if (activeProcessTab === 'render') {
        document.getElementById('r-loading-overlay').style.display = 'none';
        document.getElementById('r-ba-container').style.display = 'block';
        document.getElementById('r-img-before').src = finalSrc;
        document.getElementById('r-img-after').style.display = 'none';
        document.getElementById('r-ba-handle').style.display = 'none';
        document.getElementById('r-ba-slider').style.display = 'none';
    }
}

// =====================================
// GENERATE CONCEPT & RENDER (API)
// =====================================
function triggerAIGenerate(isRender = false, resolution = '2k') {
    const prefix = isRender ? 'r-' : '';
    const taskType = isRender ? (resolution === '4k' ? 'render_4k' : 'render') : 'concept';
    const cost = 1;

    if(currentCredits < cost) { showApayaModal("Kredit Habis!", `Saldo tidak mencukupi. Butuh ${cost} kredit.`, "fa-coins", "var(--orange)"); return; }
    if(!selectedConceptCam) { showApayaModal("Kamera Belum Dipilih", "Silakan pilih kamera terlebih dahulu dari daftar di sebelah kiri.", "fa-camera", "var(--orange)"); return; }

    setGeneratingState(true);

    const promptBox = document.getElementById(prefix + 'ai-prompt');
    const manualPrompt = promptBox.value; const isAuto = promptBox.disabled;

    if (!isRender && manualPrompt.trim() === "") { showApayaModal("Conceptor Prompt Kosong", "Area prompt wajib diisi!", "fa-pen", "var(--danger)"); return; }
    if (isRender && !isAuto && manualPrompt.trim() === "") { showApayaModal("Prompt Manual Kosong", "Area prompt wajib diisi jika mode MANUAL.", "fa-pen", "var(--danger)"); return; }

    document.getElementById(isRender ? 'r-placeholder' : 'ai-placeholder').style.display = 'none';
    document.getElementById(prefix + 'ba-container').style.display = 'block';
    if(!isRender) document.getElementById('concept-action-bar').style.display = 'none';

    document.getElementById(prefix + 'img-after').style.display = 'none';
    document.getElementById(prefix + 'ba-handle').style.display = 'none';
    document.getElementById(prefix + 'ba-slider').style.display = 'none';

    document.getElementById(isRender ? 'r-loading-overlay' : 'ai-loading-overlay').style.display = 'flex';

    if(isRender) {
        document.getElementById('r-loading-text').innerText = "GENERATING YOUR FINAL IDEA...";
    } else {
        document.getElementById('loading-text').innerText = "GENERATING YOUR CONCEPT IDEA...";
    }

    const style = document.getElementById(prefix + 'val-style').value;
    const denoise = 0.5;

    const currentEnv = isRender ? currentEnvR : currentEnvC;
    const waktu = document.getElementById(prefix + 'val-waktu') ? document.getElementById(prefix + 'val-waktu').value : "siang";
    const lampuToggle = document.getElementById(prefix + 'toggle-lampu');
    const lampu = lampuToggle ? lampuToggle.checked : false;
    const kendaraanDrop = document.getElementById(prefix + 'val-kendaraan');
    const kendaraan = kendaraanDrop ? kendaraanDrop.value : "";
    const vegetasiDrop = document.getElementById(prefix + 'val-vegetasi');
    const vegetasi = vegetasiDrop ? vegetasiDrop.value : "";

    const promptData = {
        manual_prompt: manualPrompt,
        waktu: waktu,
        env: currentEnv,
        lampu: lampu,
        kendaraan: kendaraan,
        vegetasi: vegetasi
    };
    const payloadString = JSON.stringify(promptData);

    setTimeout(() => {
        if(typeof sketchup !== 'undefined') {
            sketchup.generate_ai_concept([style, payloadString, denoise, selectedConceptCam, materialBoardBase64, taskType]);
        } else {
            setTimeout(() => { showAIResult(DUMMY_BEFORE_IMG, taskType); }, 2000);
        }
    }, 100);
}

function showAIResult(imageUrl, taskType = 'concept') {
    try {
        setGeneratingState(false);
        const isRender = taskType === 'render' || taskType === 'render_4k';
        const prefix = isRender ? 'r-' : '';
        const actionId = isRender ? 'r-action-bar' : 'concept-action-bar';

        document.getElementById(isRender ? 'r-loading-overlay' : 'ai-loading-overlay').style.display = 'none';
        document.getElementById(prefix + 'ba-container').style.display = 'block';

        const imgAfter = document.getElementById(prefix + 'img-after');

        let trimmed = imageUrl.trim().replace(/^"|"$/g, '');
        let finalSrc;
        if (trimmed.startsWith('http') || trimmed.startsWith('file:') || trimmed.startsWith('data:')) {
            finalSrc = trimmed;
        } else {
            finalSrc = "data:image/png;base64," + trimmed.replace(/\s/g, '');
        }

        imgAfter.src = finalSrc;
        imgAfter.style.filter = "contrast(1.1) brightness(1.05)";
        imgAfter.style.display = 'block';

        document.getElementById(prefix + 'ba-slider').value = 50;
        if(isRender) updateRenderBASlider(50); else updateBASlider(50);

        document.getElementById(prefix + 'ba-handle').style.display = 'block';
        document.getElementById(prefix + 'ba-slider').style.display = 'block';

        if(document.getElementById(actionId)) {
            document.getElementById(actionId).style.display = 'flex';
        }

        // Realtime History Append
        const historyLabel = isRender ? `Render_${new Date().toLocaleTimeString().replace(/:/g,'')}` : `Concept_${new Date().toLocaleTimeString().replace(/:/g,'')}`;
        if(finalSrc && finalSrc.length > 100 && !finalSrc.includes('localhost')) {
            const listDiv = document.getElementById('material-thumb-list');
            const p = listDiv.querySelector('p');
            if (p) p.remove();
            listDiv.insertBefore(createMatThumbCard(historyLabel, finalSrc), listDiv.firstChild);
        }
    } catch(err) {
        console.error("Error di showAIResult: ", err);
        alert("Layar gagal ngerender karena: " + err.message);
    }
}

function setRenderRes(res) {
    document.getElementById('r-res-2k').classList.remove('active');
    document.getElementById('r-res-4k').classList.remove('active');
    document.getElementById('r-res-' + res).classList.add('active');
    document.getElementById('btn-render-single').dataset.res = res;
    if(typeof updateBatchSelection === 'function') updateBatchSelection();
    else document.getElementById('r-btn-text').innerText = res === '4k' ? 'START RENDER (2 Cr)' : 'START RENDER (1 Cr)';
}

function saveGallery(tabType) {
    const imgId = tabType === 'render' ? 'r-img-after' : 'img-after';
    const srcRaw = document.getElementById(imgId).src;
    const base64 = srcRaw.includes(',') ? srcRaw.split(',')[1] : srcRaw;
    showApayaModal("Simpan Hasil Render", "Silakan tentukan nama file dan folder tujuan pada jendela sistem Windows.", "fa-folder-open", "var(--orange)");
    setTimeout(() => { if(typeof sketchup !== 'undefined') sketchup.save_to_gallery(base64); }, 1000);
}

// =====================================
// MATERIAL ALCHEMIST KE API
// =====================================
function loadMaterialThumbs(btn) {
    if(btn) { const icon = btn.querySelector('i'); icon.classList.add('fa-spin'); setTimeout(() => icon.classList.remove('fa-spin'), 800); }
    const listDiv = document.getElementById('material-thumb-list'); listDiv.innerHTML = '';
    const conceptImg = document.getElementById('img-after').src; const renderImg = document.getElementById('r-img-after').src; let added = false;
    if(renderImg && renderImg.length > 500 && !renderImg.includes('localhost')) { listDiv.appendChild(createMatThumbCard('Final_Render_Current', renderImg)); added = true; }
    if(conceptImg && conceptImg.length > 500 && !conceptImg.includes('localhost')) { listDiv.appendChild(createMatThumbCard('Concept_Current', conceptImg)); added = true; }
    if(!added) listDiv.innerHTML = '<p style="color:var(--text-muted); font-size: 11px; text-align: center; margin-top: 20px;">Belum ada hasil render. Generate dulu di Tab Concept / Render.</p>';
}

function createMatThumbCard(name, src) {
    const card = document.createElement('div'); card.className = 'thumb-card';
    card.onclick = () => {
        document.querySelectorAll('#material-thumb-list .thumb-card').forEach(c => c.classList.remove('active')); card.classList.add('active');
        document.getElementById('mat-placeholder').style.display = 'none'; document.getElementById('mat-canvas-container').style.display = 'flex';
        const matImg = document.getElementById('mat-preview-img'); matImg.onload = function() { initCanvas(); }; matImg.src = src;
    };
    card.innerHTML = `<div class="thumb-img-box" style="overflow:hidden;"><img src="${src}" style="width:100%; height:100%; object-fit:cover;"></div><div class="thumb-info"><span class="thumb-name">${name}</span><span style="font-size:9px; color:var(--primary); font-weight:bold;">Ready to Extract</span></div>`;
    return card;
}

function sendTo(tabType, destination) {
    const imgId = tabType === 'render' ? 'r-img-after' : 'img-after';
    const base64 = document.getElementById(imgId).src;

    if(destination === 'tab-mat') {
        switchTab('tab-mat', document.querySelectorAll('.tab-icon')[2]);
        document.getElementById('mat-placeholder').style.display = 'none';
        document.getElementById('mat-canvas-container').style.display = 'flex';
        const matImg = document.getElementById('mat-preview-img');
        matImg.onload = function() { initCanvas(); }; matImg.src = base64;
    } else if(destination === 'tab-swap') {
        switchTab('tab-swap', document.querySelectorAll('.tab-icon')[4]);
        document.getElementById('swap-placeholder').style.display = 'none';
        document.getElementById('swap-canvas-container').style.display = 'flex';
        const matImg = document.getElementById('swap-img-before');
        matImg.onload = function() { initSwapCanvas(); }; matImg.src = base64;
    } else if(destination === 'tab-motion') {
        switchTab('tab-motion', document.querySelectorAll('.tab-icon')[5]);
        document.getElementById('motion-drop-text').style.display = 'none';
        document.getElementById('motion-drop-zone').querySelector('i').style.display = 'none';
        const mImg = document.getElementById('motion-preview-img');
        mImg.style.display = 'block';
        mImg.src = base64;
    }
}

let isDrawing = false;
let matCanvas = document.getElementById('mat-canvas');
let matCtx = matCanvas.getContext('2d');
let mouseX = 0;
let mouseY = 0;
let needsDraw = false;

function initCanvas() {
    const img = document.getElementById('mat-preview-img');
    if (!img || img.clientWidth === 0) return;

    matCanvas.width = img.clientWidth;
    matCanvas.height = img.clientHeight;

    matCanvas.style.width = img.clientWidth + 'px';
    matCanvas.style.height = img.clientHeight + 'px';
    matCanvas.style.left = img.offsetLeft + 'px';
    matCanvas.style.top = img.offsetTop + 'px';

    matCtx.strokeStyle = 'rgba(250, 204, 21, 0.5)';
    matCtx.lineWidth = document.getElementById('brush-size').value;
    matCtx.lineCap = 'round';
    matCtx.lineJoin = 'round';
}

window.addEventListener('resize', () => {
    if (document.getElementById('mat-canvas-container').style.display !== 'none') {
        initCanvas();
    }
});

function startDraw(e) {
    isDrawing = true;
    const rect = matCanvas.getBoundingClientRect();
    mouseX = e.clientX - rect.left;
    mouseY = e.clientY - rect.top;
    matCtx.beginPath();
    matCtx.moveTo(mouseX, mouseY);
    drawLoop();
}

function draw(e) {
    if (!isDrawing) return;
    const rect = matCanvas.getBoundingClientRect();
    mouseX = e.clientX - rect.left;
    mouseY = e.clientY - rect.top;
    needsDraw = true;
}

function drawLoop() {
    if (!isDrawing) return;
    if (needsDraw) {
        matCtx.lineTo(mouseX, mouseY);
        matCtx.stroke();
        matCtx.beginPath();
        matCtx.moveTo(mouseX, mouseY);
        needsDraw = false;
    }
    requestAnimationFrame(drawLoop);
}

function stopDraw() {
    isDrawing = false;
    needsDraw = false;
}

function clearMask() {
    matCtx.clearRect(0, 0, matCanvas.width, matCanvas.height);
}

// ⚡ FUNGSI EXTRACT SAKTI (AUTO-CROP JS) ⚡
function extractMaterial() {
    const cost = 1;
    if(currentCredits < cost) { showApayaModal("Kredit Habis!", "Saldo kredit Anda tidak mencukupi.", "fa-coins", "var(--orange)"); return; }

    const maskData = matCtx.getImageData(0, 0, matCanvas.width, matCanvas.height);
    let minX = matCanvas.width, minY = matCanvas.height, maxX = 0, maxY = 0;
    let hasPixels = false;

    for (let y = 0; y < matCanvas.height; y++) {
        for (let x = 0; x < matCanvas.width; x++) {
            const alpha = maskData.data[(y * matCanvas.width + x) * 4 + 3];
            if (alpha > 0) {
                if (x < minX) minX = x;
                if (x > maxX) maxX = x;
                if (y < minY) minY = y;
                if (y > maxY) maxY = y;
                hasPixels = true;
            }
        }
    }

    if (!hasPixels) {
        showApayaModal("Marker Kosong!", "Silakan coret/tandai area material terlebih dahulu.", "fa-paintbrush", "var(--orange)");
        return;
    }

    document.getElementById('mat-loading-overlay').style.display = 'flex';
    setGeneratingState(true);

    const padding = 10;
    let finalMinX = Math.max(0, minX - padding);
    let finalMinY = Math.max(0, minY - padding);
    let finalMaxX = Math.min(matCanvas.width, maxX + padding);
    let finalMaxY = Math.min(matCanvas.height, maxY + padding);

    const cropWidth = finalMaxX - finalMinX;
    const cropHeight = finalMaxY - finalMinY;

    const img = document.getElementById('mat-preview-img');

    const scaleX = img.naturalWidth / matCanvas.width;
    const scaleY = img.naturalHeight / matCanvas.height;

    const natMinX = finalMinX * scaleX;
    const natMinY = finalMinY * scaleY;
    const natCropWidth = cropWidth * scaleX;
    const natCropHeight = cropHeight * scaleY;
    const natSize = Math.max(natCropWidth, natCropHeight);

    const cropCanvas = document.createElement('canvas');
    cropCanvas.width = natSize;
    cropCanvas.height = natSize;
    const cropCtx = cropCanvas.getContext('2d');

    const natOffsetX = (natSize - natCropWidth) / 2;
    const natOffsetY = (natSize - natCropHeight) / 2;

    cropCtx.drawImage(img, natMinX, natMinY, natCropWidth, natCropHeight, natOffsetX, natOffsetY, natCropWidth, natCropHeight);

    const cleanCroppedBase64 = cropCanvas.toDataURL('image/jpeg', 0.95);

    const matHint = document.getElementById('mat-prompt').value.trim();
    const materialName = matHint !== "" ? matHint : "this material texture";

    const alchemistPrompt = `Create a high-quality, front-facing, macro detail, perfectly flat, seamless, tileable PBR diffuse basecolor texture of: ${materialName}.
CRITICAL INSTRUCTIONS FOR COLOR & TEXTURE FIDELITY:
- Match the EXACT colors, color tones, grain direction, pattern scale, and tactile details from the uploaded cropped reference image.
- Preserve the precise color palette of the reference image; do not change the hue or saturation.
- If the reference shows wood, generate a corresponding seamless wood texture matching that specific color and grain.
- Uniform flat lighting, no reflections, no shadows, no specular highlights, no gloss, no background, no perspective.`;

    const taskType = 'alchemist';

    setTimeout(() => {
        if(typeof sketchup !== 'undefined') {
            sketchup.request_alchemist([cleanCroppedBase64, alchemistPrompt, taskType]);
        } else {
            setTimeout(() => { showAlchemistResult(cleanCroppedBase64); }, 3000);
        }
    }, 100);
}

function showAlchemistResult(imageUrl) {
    document.getElementById('mat-loading-overlay').style.display = 'none';
    setGeneratingState(false);
    const finalImg = document.getElementById('mat-final-result');

    let cleanedUrl = imageUrl.trim().replace(/^"|"$/g, '').replace(/\s/g, '');
    let finalSrc = cleanedUrl;
    if (!cleanedUrl.startsWith('http') && !cleanedUrl.startsWith('data:')) finalSrc = "data:image/png;base64," + cleanedUrl;

    finalImg.src = finalSrc;
    finalImg.style.objectFit = 'cover'; finalImg.style.width = '350px'; finalImg.style.height = '350px';
    document.getElementById('material-result-modal').style.display = 'flex';

    updateCreditDisplay(currentCredits - 1);
}

function downloadMaterial() {
    showApayaModal("Simpan Textures", "Silakan tentukan folder untuk menyimpan file tekstur PBR (Albedo, Normal, Roughness).", "fa-folder-open", "var(--orange)");
    setTimeout(() => { document.getElementById('custom-apaya-modal').style.display = 'none'; document.getElementById('material-result-modal').style.display = 'none'; }, 1500);
}
