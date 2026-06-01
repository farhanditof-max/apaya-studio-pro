
        let activeProcessTab = 'camera';
        let currentCredits = 0; 
        const DUMMY_BEFORE_IMG = "data:image/svg+xml;charset=UTF-8,%3Csvg xmlns='http://www.w3.org/2000/svg' width='800' height='600' style='background:%232a2d3d'%3E%3Ctext x='50%25' y='50%25' fill='%23FACC15' font-size='24' font-family='Arial' text-anchor='middle' dy='.3em'%3EDummy Preview (Belum Render)%3C/text%3E%3C/svg%3E";

        function verifyLicense() {
            const key = document.getElementById('license-key-input').value.trim();
            if(!key) { showApayaModal('Error', 'Masukkan License Key!', 'fa-key', 'var(--danger)'); return; }
            document.getElementById('ui-credit-balance').innerHTML = `<i class="fa-solid fa-circle-notch fa-spin"></i>`;
            if(typeof sketchup !== 'undefined') sketchup.verify_license(key);
        }
        function setInitLicense(key, credits) {
            document.getElementById('license-key-input').value = key; 
            updateCreditDisplay(credits);
            
            const isFree = key.toUpperCase().startsWith('FREE-') || key.toUpperCase().startsWith('TRIAL-');
            const elements = [
                document.getElementById('btn-generate-motion'),
                document.getElementById('btn-generate-upscale'),
                document.getElementById('r-res-4k')
            ];
            
            elements.forEach(el => {
                if (el) {
                    if (isFree) el.classList.add('locked-feature');
                    else el.classList.remove('locked-feature');
                }
            });
        }
        function updateCreditDisplay(amount) {
            currentCredits = amount;
            const el = document.getElementById('ui-credit-balance');
            if (el) {
                el.innerHTML = `<i class="fa-solid fa-coins"></i> ${amount}`;
                el.classList.remove('credit-pulse');
                void el.offsetWidth; // Trigger reflow to restart animation
                el.classList.add('credit-pulse');
            }
        }

        function showToast(title, desc, icon = 'fa-circle-info', color = 'var(--primary)') {
            const container = document.getElementById('toast-container');
            if (!container) return;
            const toast = document.createElement('div');
            toast.className = 'toast';
            toast.style.borderLeft = `4px solid ${color}`;
            toast.innerHTML = `
                <i class="fa-solid ${icon}" style="color: ${color}"></i>
                <div class="toast-body">
                    <div class="toast-title">${title}</div>
                    <div class="toast-desc">${desc}</div>
                </div>
            `;
            container.appendChild(toast);
            setTimeout(() => {
                toast.classList.add('toast-out');
                toast.addEventListener('animationend', () => {
                    toast.remove();
                });
            }, 4000);
        }

        function setGeneratingState(isGenerating) {
            const btnRender = document.getElementById('btn-render-single');
            const btnConcept = document.getElementById('btn-concept');
            const btnExtract = document.getElementById('btn-extract');
            if (isGenerating) {
                if (btnRender) btnRender.disabled = true;
                if (btnConcept) btnConcept.disabled = true;
                if (btnExtract) btnExtract.disabled = true;
            } else {
                if (btnRender) btnRender.disabled = false;
                if (btnConcept) btnConcept.disabled = false;
                if (btnExtract) btnExtract.disabled = false;
            }
        }

        function openTopupModal() { document.getElementById('topup-overlay').style.display = 'flex'; document.getElementById('topup-amount').focus(); }
        function closeTopupModal() { document.getElementById('topup-overlay').style.display = 'none'; }
        
        // --- Fungsi Buka/Tutup Pricelist
        function sendTopupWA(packageName) {
            window.open(`https://wa.me/6281383831435?text=${encodeURIComponent(`Halo Admin Apaya Studio, saya mau order *${packageName}* nih. Tolong info pembayarannya ya!`)}`, '_blank');
            closeTopupModal();
        }

        function showApayaModal(title, desc, iconClass, iconColor) {
            document.getElementById('cam-modal-title').innerText = title;
            document.getElementById('cam-modal-desc').innerText = desc;
            const icon = document.getElementById('cam-modal-icon');
            icon.className = "fa-solid " + iconClass;
            icon.style.color = iconColor || "var(--primary)";
            document.getElementById('custom-apaya-modal').style.display = 'flex';
            setGeneratingState(false);
        }

        function switchTab(tabId, iconEl) {
            document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
            document.querySelectorAll('.tab-icon').forEach(i => i.classList.remove('active'));
            document.getElementById(tabId).classList.add('active'); iconEl.classList.add('active');

            activeProcessTab = tabId === 'tab-concept' ? 'concept' : (tabId === 'tab-render' ? 'render' : (tabId === 'tab-mat' ? 'material' : 'camera'));
            document.getElementById('sidebar-manager').style.display = 'none';
            document.getElementById('sidebar-concept').style.display = 'none';
            document.getElementById('sidebar-material').style.display = 'none';
            document.getElementById('sidebar-upscale').style.display = 'none';
            document.getElementById('sidebar-motion').style.display = 'none';

            if(tabId === 'tab-concept' || tabId === 'tab-render') { document.getElementById('sidebar-concept').style.display = 'flex'; loadConceptThumbs(); } 
            else if (tabId === 'tab-mat') { document.getElementById('sidebar-material').style.display = 'flex'; loadMaterialThumbs(); } 
            else if (tabId === 'tab-upscale') { document.getElementById('sidebar-upscale').style.display = 'flex'; loadUpscaleHistory(); }
            else if (tabId === 'tab-motion') { document.getElementById('sidebar-motion').style.display = 'flex'; loadMotionHistory(); }
            else if (tabId === 'tab-swap') { /* No sidebar needed */ }
            else { document.getElementById('sidebar-manager').style.display = 'flex'; }
        }

        let currentEnvC = "interior"; let currentEnvR = "interior";
        function setEnv(env, isRender = false) {
            const prefix = isRender ? 'r-' : '';
            if(isRender) currentEnvR = env; else currentEnvC = env;
            document.getElementById(prefix + 'env-int').className = (env === 'interior' ? 'env-box active' : 'env-box');
            document.getElementById(prefix + 'env-ext').className = (env === 'exterior' ? 'env-box active' : 'env-box');
            document.getElementById(prefix + 'panel-exterior').style.display = (env === 'exterior') ? 'flex' : 'none';
        }

        function toggleDD(e, listId) {
            e.stopPropagation();
            document.querySelectorAll('.dropdown-list').forEach(l => { if(l.id !== listId) l.classList.remove('show'); });
            const list = document.getElementById(listId); list.classList.toggle('show');
            if(list.classList.contains('show')) list.parentElement.classList.add('active'); else list.parentElement.classList.remove('active');
        }
        function selectDD(e, parentId, inputId, textId, val, text) {
            e.stopPropagation(); document.getElementById(textId).innerText = text; document.getElementById(inputId).value = val;
            document.getElementById(parentId).querySelector('.dropdown-list').classList.remove('show'); document.getElementById(parentId).classList.remove('active');
        }
        window.addEventListener('click', () => { document.querySelectorAll('.dropdown-list').forEach(l => l.classList.remove('show')); document.querySelectorAll('.custom-select').forEach(s => s.classList.remove('active')); });

        function setPromptMode(mode, isRender = false) {
            const prefix = isRender ? 'r-' : ''; const isAuto = mode === 'auto';
            if(document.getElementById(prefix + 'btn-auto')) {
                document.getElementById(prefix + 'btn-auto').className = isAuto ? 'switch-btn-small active' : 'switch-btn-small';
                document.getElementById(prefix + 'btn-manual').className = isAuto ? 'switch-btn-small' : 'switch-btn-small active';
            }
            const promptBox = document.getElementById(prefix + 'ai-prompt');
            promptBox.disabled = isAuto; promptBox.style.opacity = isAuto ? 0.5 : 1; if(!isAuto) promptBox.focus();
        }

        // =====================================
        // MATERIAL BOARD DRAG & DROP LOGIC
        // =====================================
        let materialBoardBase64 = "";
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

        let selectedConceptCam = "";
        function loadConceptThumbs(btn) {
            if(btn) { const icon = btn.querySelector('i'); icon.classList.add('fa-spin'); setTimeout(() => icon.classList.remove('fa-spin'), 800); }
            const listDiv = document.getElementById('concept-thumb-list'); listDiv.innerHTML = '';
            if(currentCameras.length === 0) { listDiv.innerHTML = '<p style="color:var(--text-muted); font-size: 11px; text-align: center;">Belum ada kamera.</p>'; return; }
            const fragment = document.createDocumentFragment();
            currentCameras.forEach(cam => {
                const isPt = cam.type.toLowerCase().includes('portrait'); const badgeColor = isPt ? 'var(--orange)' : 'var(--primary)'; const icon = isPt ? 'fa-mobile-screen' : 'fa-desktop';
                const card = document.createElement('div'); card.className = selectedConceptCam === cam.name ? 'thumb-card active' : 'thumb-card'; card.onclick = () => selectConceptCamera(cam.name, card);
                card.innerHTML = `<div class="thumb-img-box"><i class="fa-solid ${icon}"></i></div><div class="thumb-info"><span class="thumb-name">${cam.name}</span><span style="font-size:9px; color:${badgeColor}; font-weight:bold;">${cam.type}</span></div>`;
                fragment.appendChild(card);
            });
            listDiv.appendChild(fragment);
        }

        function selectConceptCamera(camName, cardElement) {
            document.querySelectorAll('.thumb-card').forEach(c => c.classList.remove('active')); cardElement.classList.add('active'); selectedConceptCam = camName;
            
            if(activeProcessTab === 'concept') { 
                document.getElementById('ai-placeholder').style.display = 'none'; 
                document.getElementById('ba-container').style.display = 'none'; 
                document.getElementById('ai-loading-overlay').style.display = 'flex';
                document.getElementById('loading-text').innerText = "MENGAMBIL GAMBAR SKETCHUP...";
            } 
            else if (activeProcessTab === 'render') { 
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

        function setBeforeImage(base64Image) {
            let finalSrc = base64Image.startsWith('data:') ? base64Image : "data:image/png;base64," + base64Image;
            
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

        function updateBASlider(val) { document.getElementById('img-after').style.clipPath = `inset(0 0 0 ${val}%)`; document.getElementById('ba-handle').style.left = val + '%'; }
        function updateRenderBASlider(val) { document.getElementById('r-img-after').style.clipPath = `inset(0 0 0 ${val}%)`; document.getElementById('r-ba-handle').style.left = val + '%'; }

        // =====================================
        // GENERATE CONCEPT & RENDER (API)
        // =====================================
        function triggerAIGenerate(isRender = false, resolution = '2k') {
            const key = document.getElementById('license-key-input').value.trim().toUpperCase();
            if(isRender && resolution === '4k' && (key.startsWith('FREE-') || key.startsWith('TRIAL-'))) {
                showApayaModal('Akses Ditolak', 'Fitur Render 4K eksklusif untuk lisensi Premium (Starter/Pro/Studio). Silakan Top Up untuk mengaktifkan.', 'fa-lock', 'var(--danger)');
                return;
            }
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
            document.getElementById(isRender ? 'r-action-bar' : 'concept-action-bar').style.display = 'none';
            
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
            const denoise = 0.5; // Removed from UI
            
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
                
                let cleanUrl = imageUrl.trim().replace(/^"|"$/g, '').replace(/\s/g, '');
                let finalSrc = cleanUrl;
                if (!cleanUrl.startsWith('http') && !cleanUrl.startsWith('data:')) {
                    finalSrc = "data:image/png;base64," + cleanUrl;
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
            document.getElementById('r-btn-text').innerText = res === '4k' ? 'START RENDER (2 Cr)' : 'START RENDER (1 Cr)';
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
            
            // Align canvas precisely on top of the image
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

        // --- FUNGSI EXTRACT SAKTI (AUTO-CROP JS) ---
        function extractMaterial() {
            const cost = 1; 
            if(currentCredits < cost) { showApayaModal("Kredit Habis!", "Saldo kredit Anda tidak mencukupi.", "fa-coins", "var(--orange)"); return; }

            // 1. SCAN AREA: Cari koordinat dari coretan kuning lu
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

            // 2. TENTUKAN AREA POTONGAN (Kasih padding dikit biar aman)
            const padding = 10;
            let finalMinX = Math.max(0, minX - padding);
            let finalMinY = Math.max(0, minY - padding);
            let finalMaxX = Math.min(matCanvas.width, maxX + padding);
            let finalMaxY = Math.min(matCanvas.height, maxY + padding);

            const cropWidth = finalMaxX - finalMinX;
            const cropHeight = finalMaxY - finalMinY;

            // 3. AMBIL GAMBAR ASLI BERSIH HIGH-RES (Tanpa Coretan Kuning)
            const img = document.getElementById('mat-preview-img');
            
            // Hitung skala koordinat display ke koordinat resolusi asli gambar
            const scaleX = img.naturalWidth / matCanvas.width;
            const scaleY = img.naturalHeight / matCanvas.height;

            const natMinX = finalMinX * scaleX;
            const natMinY = finalMinY * scaleY;
            const natCropWidth = cropWidth * scaleX;
            const natCropHeight = cropHeight * scaleY;
            const natSize = Math.max(natCropWidth, natCropHeight);

            // Buat canvas untuk potongan (selalu bujur sangkar / square)
            const cropCanvas = document.createElement('canvas');
            cropCanvas.width = natSize;
            cropCanvas.height = natSize;
            const cropCtx = cropCanvas.getContext('2d');

            // Hitung offset agar hasil potongan di-center di dalam canvas bujur sangkar
            const natOffsetX = (natSize - natCropWidth) / 2;
            const natOffsetY = (natSize - natCropHeight) / 2;

            // Draw crop directly from the high-res image
            cropCtx.drawImage(img, natMinX, natMinY, natCropWidth, natCropHeight, natOffsetX, natOffsetY, natCropWidth, natCropHeight);

            const cleanCroppedBase64 = cropCanvas.toDataURL('image/jpeg', 0.95);

            // 4. PROMPT OTOMATIS (Tanpa Butuh Ketikan User)
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
            
            let cleanUrl = imageUrl.trim().replace(/^"|"$/g, '').replace(/\s/g, '');
            let finalSrc = cleanUrl;
            if (!cleanUrl.startsWith('http') && !cleanUrl.startsWith('data:')) finalSrc = "data:image/png;base64," + cleanUrl;
            
            finalImg.src = finalSrc; 
            finalImg.style.objectFit = 'cover'; finalImg.style.width = '350px'; finalImg.style.height = '350px'; 
            document.getElementById('material-result-modal').style.display = 'flex';

            updateCreditDisplay(currentCredits - 1);
        }

        function downloadMaterial() {
            showApayaModal("Simpan Textures", "Silakan tentukan folder untuk menyimpan file tekstur PBR (Albedo, Normal, Roughness).", "fa-folder-open", "var(--orange)");
            setTimeout(() => { document.getElementById('custom-apaya-modal').style.display = 'none'; document.getElementById('material-result-modal').style.display = 'none'; }, 1500);
        }

        // =====================================
        // CAMERA MANAGER INIT
        // =====================================
        let currentCameras = []; let activeRes = '4K'; let selectedCameras = new Set(); let hasLoadedFirstTime = false; let cameraToRename = ""; let camerasToDelete = [];
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
            searchTimeout = setTimeout(() => {
                renderTable();
            }, 250);
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

        document.addEventListener("DOMContentLoaded", () => { if(typeof sketchup !== 'undefined') sketchup.get_init_data(); syncRatios(); });
    
        // NEW TABS LOGIC
        let swapMode = 'object';
        function setSwapMode(mode) {
            swapMode = mode;
            document.getElementById('swap-env-obj').className = (mode === 'object' ? 'env-box active' : 'env-box');
            document.getElementById('swap-env-mat').className = (mode === 'material' ? 'env-box active' : 'env-box');
        }

        function handleFileSelect(e, type) {
            const file = e.target.files[0];
            if(!file) return;
            processFile(file, type);
        }

        function handleDrop(e, type) {
            e.preventDefault();
            let el = document.getElementById('swap-ref-drop-zone');
            if(type === 'motion') el = document.getElementById('motion-placeholder'); // since both drop zones point to the same now
            if(type === 'swap-main') el = document.getElementById('swap-placeholder');
            if(el) el.style.borderColor = 'var(--border)';
            const file = e.dataTransfer.files[0];
            if(file && file.type.startsWith('image/')) {
                processFile(file, type);
            }
        }

        function processFile(file, type) {
            const reader = new FileReader();
            reader.onload = function(e) {
                if(type === 'motion') {
                    const img = document.getElementById('motion-preview-img');
                    img.src = e.target.result;
                    img.style.display = 'block';
                    document.getElementById('motion-drop-text').style.display = 'none';
                    document.getElementById('motion-drop-zone').querySelector('i').style.display = 'none';
                } else if(type === 'swap-ref') {
                    const img = document.getElementById('swap-ref-preview');
                    img.src = e.target.result;
                    img.style.display = 'block';
                    document.getElementById('swap-ref-text').style.display = 'none';
                    document.getElementById('swap-ref-drop-zone').querySelector('i').style.display = 'none';
                } else if(type === 'swap-main') {
                    document.getElementById('swap-placeholder').style.display = 'none';
                    document.getElementById('swap-canvas-container').style.display = 'flex';
                    const mainImg = document.getElementById('swap-img-before');
                    mainImg.onload = function() { initSwapCanvas(); };
                    mainImg.src = e.target.result;
                }
            };
            reader.readAsDataURL(file);
        }

        let isDrawingSwap = false;
        let swapCanvas = null;
        let swapCtx = null;
        
        function initSwapCanvas() {
            const img = document.getElementById('swap-img-before');
            if(!img || img.clientWidth === 0) return;
            swapCanvas = document.getElementById('swap-canvas');
            swapCtx = swapCanvas.getContext('2d');
            swapCanvas.width = img.clientWidth;
            swapCanvas.height = img.clientHeight;
            swapCanvas.style.width = img.clientWidth + 'px';
            swapCanvas.style.height = img.clientHeight + 'px';
            swapCtx.lineCap = 'round';
            swapCtx.lineJoin = 'round';
            swapCtx.strokeStyle = 'rgba(255, 255, 255, 0.8)';
            swapCtx.lineWidth = document.getElementById('swap-brush-size').value;
        }

        function startDrawSwap(e) {
            if(!swapCtx) return;
            isDrawingSwap = true;
            swapCtx.beginPath();
            swapCtx.moveTo(e.offsetX, e.offsetY);
        }

        function drawSwap(e) {
            if(!isDrawingSwap || !swapCtx) return;
            swapCtx.lineTo(e.offsetX, e.offsetY);
            swapCtx.stroke();
        }

        function stopDrawSwap() {
            isDrawingSwap = false;
        }

        function clearSwapCanvas() {
            if(swapCtx && swapCanvas) swapCtx.clearRect(0, 0, swapCanvas.width, swapCanvas.height);
        }

        function saveSwapResult() {
            const img = document.getElementById('swap-img-after');
            if(!img || !img.src || img.style.display === 'none') {
                showToast("Belum Ada Hasil", "Generate Magic Swap dulu sebelum save.");
                return;
            }
            const a = document.createElement('a');
            a.href = img.src;
            a.download = 'apaya-swap-result.png';
            a.click();
        }

        function saveMotionResult() {
            const vid = document.getElementById('motion-video');
            if(!vid || !vid.src || vid.style.display === 'none') {
                showToast("Belum Ada Hasil", "Generate Motion dulu sebelum save.");
                return;
            }
            const a = document.createElement('a');
            a.href = vid.src;
            a.download = 'apaya-motion-result.mp4';
            a.click();
        }

        function triggerMotionGenerate() {
            const key = document.getElementById('license-key-input').value.trim().toUpperCase();
            if(key.startsWith('FREE-') || key.startsWith('TRIAL-')) {
                showApayaModal('Akses Ditolak', 'Fitur Motion (Video) eksklusif untuk lisensi Premium (Starter/Pro/Studio). Silakan Top Up untuk mengaktifkan.', 'fa-lock', 'var(--danger)');
                return;
            }

            const img = document.getElementById('motion-preview-img');
            if(!img.src || img.src === window.location.href) {
                showToast("Error", "Pilih atau drag & drop gambar dulu.");
                return;
            }
            if(parseInt(document.getElementById('ui-credit-balance').innerText.replace(/[^0-9]/g, '')) < 3) {
                showToast("Kredit Habis", "Kredit tidak cukup (Butuh 3 Cr). Silakan Top Up.");
                return;
            }
            const prompt = document.getElementById('motion-prompt').value;
            const btnText = document.getElementById('btn-motion-text');
            document.getElementById('motion-loading-overlay').style.display = 'flex';
            document.getElementById('btn-generate-motion').disabled = true;
            btnText.innerText = 'GENERATING...';

            sketchup.generate_motion(img.src, prompt);
        }

        function triggerSwapGenerate() {
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
            }

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
        }

        function onMotionSuccess(videoUrl) {
            document.getElementById('motion-loading-overlay').style.display = 'none';
            document.getElementById('btn-generate-motion').disabled = false;
            document.getElementById('btn-motion-text').innerText = 'GENERATE HD 5s (3 Cr)';
            document.getElementById('motion-placeholder').style.display = 'none';
            
            const vid = document.getElementById('motion-video');
            vid.src = videoUrl;
            vid.style.display = 'block';
            vid.load();
            vid.play().catch(e => console.log("Autoplay prevented:", e));
            showToast("Motion Selesai", "Video berhasil digenerate!");
            if(typeof sketchup !== 'undefined') sketchup.get_init_data();
        }

        function onSwapSuccess(imgUrl) {
            document.getElementById('swap-loading-overlay').style.display = 'none';
            document.getElementById('btn-generate-swap').disabled = false;
            
            const afterImg = document.getElementById('swap-img-after');
            afterImg.src = imgUrl;
            afterImg.style.display = 'block';
            showToast("Magic Swap Selesai", "Gambar berhasil diubah!");
            if(typeof sketchup !== 'undefined') sketchup.get_init_data();
        }

        function onMotionSwapFailed(errorMsg) {
            document.getElementById('motion-loading-overlay').style.display = 'none';
            document.getElementById('swap-loading-overlay').style.display = 'none';
            document.getElementById('btn-generate-motion').disabled = false;
            document.getElementById('btn-motion-text').innerText = 'GENERATE HD 5s (3 Cr)';
            document.getElementById('btn-generate-swap').disabled = false;
            showToast("Error", errorMsg || "Gagal menggenerate.");
        }

        // ==========================================
        // UPSCALE TAB LOGIC
        // ==========================================
        var upscaleSourceB64 = '';

        function handleUpscaleFileSelect(e) {
            var file = e.target.files[0];
            if(!file) return;
            var reader = new FileReader();
            reader.onload = function(ev) {
                upscaleSourceB64 = ev.target.result.split(',')[1];
                document.getElementById('upscale-preview-thumb').src = ev.target.result;
                document.getElementById('upscale-preview-thumb').style.display = 'block';
                document.getElementById('upscale-drop-text').style.display = 'none';
                document.getElementById('up-img-before').src = ev.target.result;
                document.getElementById('up-img-before').style.display = 'block';
                document.getElementById('upscale-placeholder').style.display = 'none';
                document.getElementById('up-ba-container').style.display = 'block';
            };
            reader.readAsDataURL(file);
        }

        function handleUpscaleDrop(e) {
            e.preventDefault();
            document.getElementById('upscale-drop-zone').style.borderColor = 'var(--border)';
            var file = e.dataTransfer.files[0];
            if(file && file.type.startsWith('image/')) {
                var reader = new FileReader();
                reader.onload = function(ev) {
                    upscaleSourceB64 = ev.target.result.split(',')[1];
                    document.getElementById('upscale-preview-thumb').src = ev.target.result;
                    document.getElementById('upscale-preview-thumb').style.display = 'block';
                    document.getElementById('upscale-drop-text').style.display = 'none';
                    document.getElementById('up-img-before').src = ev.target.result;
                    document.getElementById('up-img-before').style.display = 'block';
                    document.getElementById('upscale-placeholder').style.display = 'none';
                    document.getElementById('up-ba-container').style.display = 'block';
                };
                reader.readAsDataURL(file);
            }
        }

        function triggerUpscaleGenerate() {
            const key = document.getElementById('license-key-input').value.trim().toUpperCase();
            if(key.startsWith('FREE-') || key.startsWith('TRIAL-')) {
                showApayaModal('Akses Ditolak', 'Fitur Upscale 4K eksklusif untuk lisensi Premium (Starter/Pro/Studio). Silakan Top Up untuk mengaktifkan.', 'fa-lock', 'var(--danger)');
                return;
            }
            if(!upscaleSourceB64) {
                showApayaModal('Gambar Kosong', 'Upload gambar atau pilih dari Render History terlebih dahulu.', 'fa-image', 'var(--orange)');
                return;
            }
            document.getElementById('btn-generate-upscale').disabled = true;
            document.getElementById('upscale-loading-overlay').style.display = 'flex';
            document.getElementById('upscale-placeholder').style.display = 'none';
            if(typeof sketchup !== 'undefined') sketchup.generate_upscale(upscaleSourceB64);
        }

        function showUpscaleResult(url) {
            document.getElementById('upscale-loading-overlay').style.display = 'none';
            document.getElementById('btn-generate-upscale').disabled = false;
            document.getElementById('upscale-placeholder').style.display = 'none';
            document.getElementById('up-ba-container').style.display = 'block';
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

        function updateUpscaleBASlider(val) {
            document.getElementById('up-img-after').style.clipPath = 'inset(0 0 0 ' + val + '%)';
            document.getElementById('up-ba-handle').style.left = val + '%';
        }

        function saveUpscaleResult() {
            var afterImg = document.getElementById('up-img-after');
            if(!afterImg.src || afterImg.style.display === 'none') { showToast('Error', 'Belum ada hasil upscale.'); return; }
            if(typeof sketchup !== 'undefined') sketchup.save_to_gallery(afterImg.src);
        }

                function loadMotionHistory(btn) {
            if(btn) { const icon = btn.querySelector('i'); icon.classList.add('fa-spin'); setTimeout(() => icon.classList.remove('fa-spin'), 800); }
            const listDiv = document.getElementById('motion-thumb-list'); listDiv.innerHTML = '';
            const conceptImg = document.getElementById('img-after').src; const renderImg = document.getElementById('r-img-after').src; let added = false;
            if(renderImg && renderImg.length > 500 && !renderImg.includes('localhost')) { listDiv.appendChild(createMotionThumbCard('Final_Render_Current', renderImg)); added = true; }
            if(conceptImg && conceptImg.length > 500 && !conceptImg.includes('localhost')) { listDiv.appendChild(createMotionThumbCard('Concept_Current', conceptImg)); added = true; }
            if(!added) listDiv.innerHTML = '<p style="color:var(--text-muted); font-size: 11px; text-align: center; margin-top: 20px;">Belum ada hasil render. Generate dulu di Tab Concept / Render.</p>';
        }

        function createMotionThumbCard(name, src) {
            const card = document.createElement('div'); card.className = 'thumb-card';
            card.onclick = () => {
                document.querySelectorAll('#motion-thumb-list .thumb-card').forEach(c => c.classList.remove('active')); card.classList.add('active');
                document.getElementById('motion-drop-text').style.display = 'none';
                document.getElementById('motion-drop-zone').querySelector('i').style.display = 'none';
                const mImg = document.getElementById('motion-preview-img');
                mImg.style.display = 'block';
                mImg.src = src;
            };
            card.innerHTML = `<div class="thumb-img-box" style="overflow:hidden;"><img src="${src}" style="width:100%; height:100%; object-fit:cover;"></div><div class="thumb-info"><span class="thumb-name">${name}</span><span style="font-size:9px; color:var(--primary); font-weight:bold;">Ready to Animate</span></div>`;
            return card;
        }

        function loadUpscaleHistory(btn) {
            if(btn) { var icon = btn.querySelector('i'); icon.classList.add('fa-spin'); setTimeout(function(){ icon.classList.remove('fa-spin'); }, 800); }
            var listDiv = document.getElementById('upscale-thumb-list');
            listDiv.innerHTML = '<p style="color:var(--text-muted); font-size: 11px; text-align: center;">Gunakan tombol upload atau drag gambar.</p>';
        }

    
