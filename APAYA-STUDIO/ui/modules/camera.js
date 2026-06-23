function syncRatios() { const pt = document.getElementById('inp-pt').value; const ls = document.getElementById('inp-ls').value; if(typeof sketchup !== 'undefined') sketchup.update_stored_ratios([pt, ls]); updateSummary(); }
function makeCam(type) { const ratio = document.getElementById(type === 'portrait' ? 'inp-pt' : 'inp-ls').value; if(typeof sketchup !== 'undefined') sketchup.create_camera([type, ratio]); }
function updateCameraList(data) { currentCameras = data; if (!hasLoadedFirstTime && data.length > 0) { data.forEach(c => selectedCameras.add(c.name)); hasLoadedFirstTime = true; } renderTable(); }
function toggleCamCb(cb) { if(cb.checked) selectedCameras.add(cb.value); else selectedCameras.delete(cb.value); updateSummary(); }

function toggleClearBtn() {
    const btn = document.getElementById('clear-search');
    const hasText = document.getElementById('search-input').value.length > 0;
    if (hasText && btn.style.display !== 'block') {
        btn.style.display = 'block';
        btn.classList.remove('spin-out');
        btn.classList.add('spin-in');
    } else if (!hasText && btn.style.display === 'block' && !btn.classList.contains('spin-out')) {
        btn.classList.remove('spin-in');
        btn.classList.add('spin-out');
        setTimeout(() => {
            if (document.getElementById('search-input').value.length === 0) {
                btn.style.display = 'none';
            }
        }, 300);
    }
}

let searchTimeout = null;
function filterTable() {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => { renderTable(); }, 250);
}

function clearSearch() {
    document.getElementById('search-input').value = '';
    toggleClearBtn();
    clearTimeout(searchTimeout);
    renderTable();
}

function renderTable() {
    const tbody = document.getElementById('camera-list');
    const search = document.getElementById('search-input').value.toLowerCase();
    tbody.innerHTML = '';

    const fragment = document.createDocumentFragment();
    let maxPx = (activeRes === '2K') ? 1920 : (activeRes === '5K') ? 5000 : (activeRes === '8K') ? 7680 : 3840;

    currentCameras.forEach((s) => {
        if(search && !s.name.toLowerCase().includes(search)) return;
        const tr = document.createElement('tr');
        const badgeClass = s.type.toLowerCase().includes('portrait') ? 'portrait' : 'landscape';
        const isChecked = selectedCameras.has(s.name) ? 'checked' : '';
        let r = parseFloat(s.aspect);
        let w = r >= 1 ? maxPx : Math.round(maxPx * r);
        let h = r >= 1 ? Math.round(maxPx / r) : maxPx;

        tr.innerHTML = `<td><input type="checkbox" class="cam-cb" value="${s.name}" ${isChecked} onchange="toggleCamCb(this)"></td><td style="font-weight:bold; font-size:13px;">${s.name}</td><td><span class="badge ${badgeClass}">${s.type}</span></td><td>${s.aspect}</td><td style="color:var(--text-muted); font-size:11px;">${w} x ${h}</td><td><button class="icon-btn" onclick="sketchup.activate_camera('${s.name}')"><i class="fa-solid fa-play"></i></button><button class="icon-btn" onclick="openRenameModal('${s.name}')"><i class="fa-solid fa-pen"></i></button><button class="icon-btn delete" onclick="openDeleteModal(['${s.name}'])"><i class="fa-solid fa-trash"></i></button></td>`;
        fragment.appendChild(tr);
    });

    tbody.appendChild(fragment);
    const visibleCbs = document.querySelectorAll('.cam-cb');
    document.getElementById('master-cb').checked = (visibleCbs.length > 0 && Array.from(visibleCbs).every(cb => cb.checked));
    updateSummary();
}

function setRes(res) { activeRes = res; document.querySelectorAll('.res-card').forEach(c => c.classList.remove('active')); document.getElementById('res-' + res).classList.add('active'); renderTable(); }

function updateSummary() {
    const selMode = document.querySelectorAll('.style-cb:checked').length; let ratio = 1.0;
    if(selectedCameras.size > 0) { const cam = currentCameras.find(c => c.name === Array.from(selectedCameras)[0]); if(cam) ratio = parseFloat(cam.aspect); } else { ratio = parseFloat(document.getElementById('inp-ls').value) || 1.43; }
    const sizes = { '2K': 1920, '4K': 3840, '5K': 5000, '8K': 7680 };
    for (let key in sizes) { let w = ratio >= 1 ? sizes[key] : Math.round(sizes[key] * ratio); let h = ratio >= 1 ? Math.round(sizes[key] / ratio) : sizes[key]; document.getElementById('px-' + key).innerText = w + ' x ' + h; }
    document.getElementById('sum-cam').innerText = selectedCameras.size; document.getElementById('sum-mode').innerText = selMode; let totalImg = selectedCameras.size * selMode; document.getElementById('sum-total').innerText = totalImg;
    let mb = (activeRes === '2K') ? 2 : (activeRes === '5K') ? 12 : (activeRes === '8K') ? 25 : 6; document.getElementById('sum-size').innerText = `~ ${totalImg * mb} MB`;
}

function toggleMode(el) { const cb = el.querySelector('input'); cb.checked = !cb.checked; el.classList.toggle('active', cb.checked); updateSummary(); }
function selectAll(state) { const search = document.getElementById('search-input').value.toLowerCase(); currentCameras.forEach(c => { if(search && !c.name.toLowerCase().includes(search)) return; if(state) selectedCameras.add(c.name); else selectedCameras.delete(c.name); }); renderTable(); }
function toggleMaster(el) { selectAll(el.checked); }

function openRenameModal(oldName) { cameraToRename = oldName; document.getElementById('rename-input').value = oldName; document.getElementById('rename-overlay').style.display = 'flex'; document.getElementById('rename-input').focus(); }
function closeRenameModal() { document.getElementById('rename-overlay').style.display = 'none'; }
function confirmRename() { const newName = document.getElementById('rename-input').value.trim(); if(newName && newName !== cameraToRename) sketchup.rename_camera([cameraToRename, newName]); closeRenameModal(); }
function openDeleteModal(cams) { camerasToDelete = cams; document.getElementById('delete-desc').innerText = cams.length === 1 ? `Apakah Anda yakin ingin menghapus kamera ${cams[0]}?` : `Hapus ${cams.length} kamera yang dipilih?`; document.getElementById('delete-overlay').style.display = 'flex'; }
function closeDeleteModal() { document.getElementById('delete-overlay').style.display = 'none'; }
function confirmDelete() { if(typeof sketchup !== 'undefined') sketchup.delete_cameras(camerasToDelete); camerasToDelete.forEach(c => selectedCameras.delete(c)); closeDeleteModal(); }
function deleteSelected() { const arr = Array.from(selectedCameras); if(arr.length > 0) openDeleteModal(arr); else { showApayaModal("Peringatan", "Pilih minimal 1 kamera terlebih dahulu!", "fa-triangle-exclamation", "var(--danger)"); } }

function executeExport() {
    const arr = Array.from(selectedCameras); const styles = Array.from(document.querySelectorAll('.style-cb:checked')).map(cb => cb.value);
    if(arr.length === 0 || styles.length === 0) { showApayaModal("Peringatan", "Pilih minimal 1 kamera dan 1 preset style sebelum melakukan export!", "fa-triangle-exclamation", "var(--orange)"); return; }
    document.getElementById('progress-overlay').style.display = 'flex'; document.getElementById('progress-fill').style.width = '0%'; document.getElementById('progress-text').innerText = '0%';
    if(typeof sketchup !== 'undefined') sketchup.export_cameras([arr, styles, activeRes, document.getElementById('export-aa').checked]);
}

function updateProgress(pct) { document.getElementById('progress-fill').style.width = pct + '%'; document.getElementById('progress-text').innerText = pct + '%'; }
function exportComplete(count, path) { document.getElementById('progress-overlay').style.display = 'none'; document.getElementById('success-overlay').style.display = 'flex'; document.getElementById('success-desc').innerText = `${count} Image berhasil diexport.`; }

document.addEventListener("DOMContentLoaded", () => {
    if(typeof sketchup !== 'undefined') sketchup.get_init_data();
    syncRatios();
});
