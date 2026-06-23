let checkedBatchCams = new Set();

function updateBatchSelection() {
    const checkboxes = document.querySelectorAll('.batch-cam-check');
    checkedBatchCams.clear();
    checkboxes.forEach(cb => { if(cb.checked) checkedBatchCams.add(cb.dataset.cam); });
    const count = checkedBatchCams.size;
    const res = document.getElementById('btn-render-single') ? document.getElementById('btn-render-single').dataset.res || '2k' : '2k';
    const resMultiplier = res === '4k' ? 2 : 1;
    const totalCost = count > 0 ? (count * resMultiplier) : resMultiplier;
    const batchCountEl = document.getElementById('batch-count');
    if(batchCountEl) batchCountEl.innerText = count + ' dipilih';
    const btnTextEl = document.getElementById('r-btn-text');
    if(btnTextEl) {
        if(count <= 1) btnTextEl.innerText = `START RENDER (${resMultiplier} Cr)`;
        else btnTextEl.innerText = `BATCH RENDER (${totalCost} Cr)`;
    }
}

function toggleSelectAllCams(isChecked) {
    document.querySelectorAll('.batch-cam-check').forEach(cb => cb.checked = isChecked);
    updateBatchSelection();
}

function handleRenderClick() {
    const promptBox = document.getElementById('r-ai-prompt');
    const manualPrompt = promptBox.value;
    const isAuto = currentPromptMode === 'auto';
    const isAi = currentPromptMode === 'ai';
    const checkedCams = Array.from(checkedBatchCams);

    if(checkedCams.length === 0) {
        if(selectedConceptCam) checkedCams.push(selectedConceptCam);
        else { showApayaModal("Kamera Belum Dipilih", "Silakan centang/pilih kamera dari daftar di sebelah kiri.", "fa-camera", "var(--orange)"); return; }
    }

    if(isAi && manualPrompt.trim() === "") {
        showApayaModal("Nama Ruangan Kosong", "Saat mode AI aktif, Anda wajib mengisi Nama Ruangan di kolom text.", "fa-pen", "var(--danger)"); return;
    }
    if(!isAuto && !isAi && manualPrompt.trim() === "") {
        showApayaModal("Prompt Manual Kosong", "Area prompt wajib diisi jika mode MANUAL.", "fa-pen", "var(--danger)"); return;
    }

    const res = document.getElementById('btn-render-single').dataset.res || '2k';
    const resMultiplier = res === '4k' ? 2 : 1;
    const totalCost = checkedCams.length * resMultiplier;

    if(currentCredits < totalCost) {
        showApayaModal("Kredit Habis!", `Saldo tidak mencukupi. Butuh ${totalCost} kredit.`, "fa-coins", "var(--orange)"); return;
    }

    if(checkedCams.length > 1) showBatchWarning(checkedCams.length, totalCost, checkedCams);
    else triggerBatchAIGenerate(checkedCams);
}

function showBatchWarning(totalCams, totalCost, checkedCams) {
    const html = `
        <div style="text-align:center;">
            <div style="text-align:left; background:rgba(255,165,0,0.1); border:1px solid var(--orange); border-radius:8px; padding:15px; margin-bottom:15px; font-size:11px; color:var(--text-main); line-height:1.6;">
                <p style="margin-top:0;"><i class="fa-solid fa-circle-info" style="color:var(--orange);"></i> <b>Perhatian sebelum memulai:</b></p>
                <ul style="margin:8px 0; padding-left:18px;">
                    <li>Batch render <b>tidak menjamin konsistensi</b> antar view, terutama jika menggunakan Manual Prompt.</li>
                    <li>Disarankan menggunakan <b>AI Auto Prompt</b> untuk hasil maksimal dan konsisten.</li>
                    <li>Untuk konsistensi terbaik, lakukan batch render <b>per ruangan</b>.</li>
                    <li><b>Tidak ada refund kredit</b> jika hasil tidak sesuai ekspektasi.</li>
                </ul>
            </div>
            <div style="display:flex; gap:10px; justify-content:center;">
                <button onclick="closeApayaModal()" class="btn-sidebar" style="padding:10px 25px; margin:0; background:var(--danger); color:white; border:none; font-weight:bold;">Batal</button>
                <button onclick="closeApayaModal(); setTimeout(() => triggerBatchAIGenerate(${JSON.stringify(checkedCams).replace(/"/g, '&quot;')}), 300);" class="btn-export" style="padding:10px 25px; margin:0;">Lanjutkan</button>
            </div>
        </div>`;

    document.getElementById('cam-modal-icon').className = "fa-solid fa-triangle-exclamation";
    document.getElementById('cam-modal-icon').style.color = "var(--orange)";
    document.getElementById('cam-modal-title').innerText = `Batch Render — ${totalCams} View (${totalCost} Cr)`;
    document.getElementById('cam-modal-desc').innerHTML = html;
    document.getElementById('default-modal-btn').style.display = 'none';
    document.getElementById('custom-apaya-modal').style.display = 'flex';
}

function triggerBatchAIGenerate(camNames) {
    const resolution = document.getElementById('btn-render-single').dataset.res || '2k';
    const promptBox = document.getElementById('r-ai-prompt');
    const manualPrompt = promptBox.value;
    const style = document.getElementById('r-val-style').value;
    const waktu = document.getElementById('r-val-waktu') ? document.getElementById('r-val-waktu').value : "siang";

    // Build prompt payload same format as triggerAIGenerate so apaya-generate Edge Function
    // receives the expected {manual_prompt, waktu, env, ...} JSON string (not raw text)
    const promptPayload = JSON.stringify({
        manual_prompt: currentPromptMode === 'manual' ? manualPrompt : "",
        waktu: waktu,
        env: currentEnvR,
        lampu: false,
        kendaraan: '',
        vegetasi: ''
    });

    const payloadData = {
        cameras: camNames,
        room_name: currentPromptMode === 'ai' ? manualPrompt : "",
        prompt_mode: currentPromptMode,
        manual_prompt: currentPromptMode !== 'ai' ? promptPayload : "",
        style: style,
        resolution: resolution,
        env: currentEnvR,
        waktu: waktu
    };

    document.getElementById('r-placeholder').style.display = 'none';
    document.getElementById('r-ba-container').style.display = 'none';
    const queueView = document.getElementById('batch-queue-view');
    queueView.style.display = 'flex';
    queueView.classList.remove('minimize-anim');

    const btnToggle = document.getElementById('btn-toggle-queue');
    if(btnToggle) { btnToggle.style.display = 'inline-block'; btnToggle.classList.remove('btn-blink'); }

    const qList = document.getElementById('batch-queue-list');
    camNames.forEach(cam => {
        if(!document.getElementById('q-item-' + cam)) {
            const item = document.createElement('div');
            item.id = 'q-item-' + cam;
            item.className = 'batch-item';
            item.style.cssText = 'display:flex; align-items:center; padding:10px; background:var(--bg-panel); border:1px solid var(--border); border-radius:8px;';
            item.innerHTML = `
                <i class="fa-solid fa-clock" style="color:var(--text-muted); margin-right:10px;"></i>
                <div style="flex:1;">
                    <span style="color:white; font-size:12px; font-weight:600;">${cam}</span>
                    <span style="color:var(--text-muted); font-size:10px; display:block;">${currentPromptMode === 'ai' ? manualPrompt : 'Queued'}</span>
                </div>
                <button onclick="cancelBatchItem('${cam}')" style="background:none; border:none; color:var(--danger); cursor:pointer; font-size:16px; padding:5px;">
                    <i class="fa-solid fa-xmark"></i>
                </button>`;
            qList.appendChild(item);
        }
    });

    setTimeout(() => {
        if(typeof sketchup !== 'undefined') {
            sketchup.start_batch_render(JSON.stringify(payloadData));
        } else {
            camNames.forEach((cam, i) => {
                setTimeout(() => updateBatchStatus(cam, 'processing'), 1000 + (i * 2000));
                setTimeout(() => updateBatchStatus(cam, 'done', dummyImages ? dummyImages.realistic : ''), 3000 + (i * 2000));
            });
        }
    }, 500);
}

function updateBatchStatus(camName, status, resultUrl, beforeUrl) {
    const item = document.getElementById('q-item-' + camName);
    if(!item) return;

    if(status === 'processing') {
        item.style.borderColor = 'var(--primary)';
        const spinIcon = item.querySelector('i');
        if (spinIcon) { spinIcon.className = 'fa-solid fa-circle-notch fa-spin'; spinIcon.style.color = 'var(--primary)'; }
        const cancelBtn = item.querySelector('button');
        if (cancelBtn) cancelBtn.style.display = 'none';
    } else if(status === 'done') {
        item.style.borderColor = 'var(--success)';
        item.style.cursor = 'pointer';
        item.onclick = () => viewBatchResult(camName, resultUrl, beforeUrl);
        item.innerHTML = `
            <i class="fa-solid fa-check-circle" style="color:var(--success); margin-right:10px;"></i>
            <div style="flex:1;">
                <span style="color:white; font-size:12px; font-weight:600;">${camName}</span>
                <span style="color:var(--success); font-size:10px; display:block;">Selesai ✓</span>
            </div>
            ${resultUrl ? `<img src="${resultUrl}" style="width:40px; height:30px; border-radius:4px; object-fit:cover;">` : ''}`;
    } else if(status === 'failed' || status === 'cancelled') {
        const color = status === 'failed' ? 'var(--danger)' : 'var(--orange)';
        item.style.borderColor = color;
        item.innerHTML = `
            <i class="fa-solid fa-exclamation-triangle" style="color:${color}; margin-right:10px;"></i>
            <div style="flex:1;">
                <span style="color:white; font-size:12px; font-weight:600;">${camName}</span>
                <span style="color:${color}; font-size:10px; display:block;">${status.charAt(0).toUpperCase() + status.slice(1)}</span>
            </div>`;
    }
}

function viewBatchResult(camName, resultUrl, beforeUrl) {
    document.getElementById('batch-queue-view').style.display = 'none';
    setBeforeImage(beforeUrl || DUMMY_BEFORE_IMG);
    showAIResult(resultUrl, 'render');
}

function cancelBatchItem(camName) {
    updateBatchStatus(camName, 'cancelled');
    if(typeof sketchup !== 'undefined') sketchup.cancel_batch_item(camName);
}

function cancelAllPendingBatch() {
    document.querySelectorAll('.batch-item').forEach(item => {
        const borderColor = item.style.borderColor;
        if(!borderColor.includes('success') && !borderColor.includes('danger') && !borderColor.includes('orange') || borderColor.includes('primary') || borderColor.includes('border')) {
            const camName = item.id.replace('q-item-', '');
            cancelBatchItem(camName);
        }
    });
}

function clearRenderQueue() {
    document.getElementById('batch-queue-list').innerHTML = '';
    const queueView = document.getElementById('batch-queue-view');
    queueView.style.display = 'none';
    queueView.classList.remove('minimize-anim');
    const btnToggle = document.getElementById('btn-toggle-queue');
    if(btnToggle) { btnToggle.style.display = 'none'; btnToggle.classList.remove('btn-blink'); }
    document.getElementById('r-placeholder').style.display = 'flex';
}

function toggleRenderQueue() {
    const queueView = document.getElementById('batch-queue-view');
    const toggleBtn = document.getElementById('btn-toggle-queue');
    toggleBtn.classList.remove('btn-blink');
    if(queueView.style.display === 'none') {
        queueView.classList.remove('minimize-anim');
        queueView.style.display = 'flex';
        document.getElementById('r-placeholder').style.display = 'none';
        document.getElementById('r-ba-container').style.display = 'none';
    } else {
        minimizeRenderQueue();
    }
}

function minimizeRenderQueue() {
    const queueView = document.getElementById('batch-queue-view');
    const toggleBtn = document.getElementById('btn-toggle-queue');
    queueView.classList.add('minimize-anim');
    setTimeout(() => {
        queueView.style.display = 'none';
        queueView.classList.remove('minimize-anim');
        toggleBtn.classList.add('btn-blink');
    }, 400);
}

// Ruby → JS callbacks
function onBatchComplete(totalSuccess, totalFailed) {
    const btnToggle = document.getElementById('btn-toggle-queue');
    if(btnToggle) btnToggle.classList.remove('btn-blink');
    showToast("Batch Selesai", `${totalSuccess} berhasil, ${totalFailed} gagal.`, "fa-check-circle", totalFailed > 0 ? "var(--orange)" : "var(--success)");
}

function onGeminiAnalysisComplete(camName, status) {
    if(status === 'success') showToast("AI Prompt Ready", `Prompt untuk ${camName} sudah dianalisa.`, "fa-brain", "var(--primary)");
    else showToast("AI Prompt Gagal", `Gagal analisa ${camName}. Gunakan mode MANUAL.`, "fa-triangle-exclamation", "var(--danger)");
}

function appendBatchQueueItems(camNames) {
    const qList = document.getElementById('batch-queue-list');
    if(!qList) return;
    camNames.forEach(cam => {
        if(!document.getElementById('q-item-' + cam)) {
            const item = document.createElement('div');
            item.id = 'q-item-' + cam;
            item.className = 'batch-item';
            item.style.cssText = 'display:flex; align-items:center; padding:10px; background:var(--bg-panel); border:1px solid var(--border); border-radius:8px;';
            item.innerHTML = `
                <i class="fa-solid fa-clock" style="color:var(--text-muted); margin-right:10px;"></i>
                <div style="flex:1;"><span style="color:white; font-size:12px; font-weight:600;">${cam}</span><span style="color:var(--text-muted); font-size:10px; display:block;">Queued</span></div>
                <button onclick="cancelBatchItem('${cam}')" style="background:none; border:none; color:var(--danger); cursor:pointer; font-size:16px; padding:5px;"><i class="fa-solid fa-xmark"></i></button>`;
            qList.appendChild(item);
        }
    });
}
