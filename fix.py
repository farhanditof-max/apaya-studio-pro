import re

with open("APAYA-STUDIO/ui/dashboard.html", "r", encoding="utf-8") as f:
    content = f.read()

missing_code = """
            const img = document.getElementById('motion-preview-img');
            if(!img.src || img.src === window.location.href) {
                showToast("Error", "Pilih atau drag & drop gambar dulu.");
                return;
            }
            if(currentCredits < 3) {
                showToast("Kredit Habis", "Kredit tidak cukup (Butuh 3 Cr). Silakan Top Up.");
                return;
            }
            const prompt = document.getElementById('motion-prompt').value;
            const btnText = document.getElementById('btn-motion-text');
            document.getElementById('motion-loading-overlay').style.display = 'flex';
            document.getElementById('btn-generate-motion').disabled = true;
            btnText.innerText = 'GENERATING...';

            sketchup.generate_motion([img.src, prompt]);
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
            if(mainImg.src.startsWith('file:///')) { showToast("Error", "Gambar cache lokal tidak bisa diswap langsung. Kirim dari Concept/Render tab."); return; }
            if(currentCredits < 1) {
                showToast("Kredit Habis", "Kredit tidak cukup (Butuh 1 Cr). Silakan Top Up.");
                return;
            }
            if(!swapCanvas) { showToast("Error", "Canvas belum siap."); return; }

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
"""

target = '''            if(key.startsWith('FREE-') || key.startsWith('TRIAL-')) {
                showApayaModal('Akses Ditolak', 'Fitur Motion (Video) eksklusif untuk lisensi Premium (Starter/Pro/Studio). Silakan Top Up untuk mengaktifkan.', 'fa-lock', 'var(--danger)');
                return;
            }


        function handleUpscaleFileSelect(e) {'''

replacement = '''            if(key.startsWith('FREE-') || key.startsWith('TRIAL-')) {
                showApayaModal('Akses Ditolak', 'Fitur Motion (Video) eksklusif untuk lisensi Premium (Starter/Pro/Studio). Silakan Top Up untuk mengaktifkan.', 'fa-lock', 'var(--danger)');
                return;
            }

''' + missing_code + '''

        function handleUpscaleFileSelect(e) {'''

new_content = content.replace(target, replacement)

with open("APAYA-STUDIO/ui/dashboard.html", "w", encoding="utf-8") as f:
    f.write(new_content)

print("FIXED dashboard.html")
