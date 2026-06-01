const fs = require('fs');
const TARGET = 'K:\\Project\\## PLUGINS APAYA\\APAYA-STUDIO\\ui\\dashboard.html';
let src = fs.readFileSync(TARGET, 'utf8');
const lines = src.split(/\r?\n/);

function findLine(str) {
    return lines.findIndex(l => l.includes(str));
}

// FIX 3: updateSwapBASlider
let idx3 = findLine('function updateBASlider(');
if (idx3 !== -1 && !lines.find(l => l.includes('updateSwapBASlider'))) {
    lines[idx3] += `\n        function updateSwapBASlider(val) { document.getElementById('swap-img-after').style.clipPath = \`inset(0 0 0 \${val}%)\`; document.getElementById('swap-ba-handle').style.left = val + '%'; }`;
    console.log('Fix 3 applied');
}

// FIX 8: Upscale JS functions
let idx8 = findLine('function updateBASlider(');
if(idx8 !== -1 && !lines.find(l => l.includes('triggerUpscaleGenerate'))) {
    const upscaleJs = `        function updateUpscaleBASlider(val) { document.getElementById('up-img-after').style.clipPath = \`inset(0 0 0 \${val}%)\`; document.getElementById('up-ba-handle').style.left = val + '%'; }

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
        }\n`;
    lines.splice(idx8, 0, upscaleJs);
    console.log('Fix 8 applied');
}

fs.writeFileSync(TARGET, lines.join('\n'), 'utf8');
console.log('All remaining fixes processed.');
