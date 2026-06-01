const fs = require('fs');
const TARGET = 'K:\\Project\\## PLUGINS APAYA\\APAYA-STUDIO\\ui\\dashboard.html';
let src = fs.readFileSync(TARGET, 'utf8');

// Function to replace `reader.readAsDataURL(file);` with a downscaling canvas logic in `processFile`
const oldReaderStr = `            reader.onload = function(e) {
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
            reader.readAsDataURL(file);`;

const newReaderStr = `            reader.onload = function(e) {
                const tempImg = new Image();
                tempImg.onload = function() {
                    let w = tempImg.width;
                    let h = tempImg.height;
                    const MAX_SIZE = (type === 'swap-ref' || type === 'motion') ? 1024 : 1920;
                    if(w > MAX_SIZE || h > MAX_SIZE) {
                        const ratio = Math.min(MAX_SIZE / w, MAX_SIZE / h);
                        w = Math.round(w * ratio);
                        h = Math.round(h * ratio);
                    }
                    const canvas = document.createElement('canvas');
                    canvas.width = w; canvas.height = h;
                    const ctx = canvas.getContext('2d');
                    ctx.drawImage(tempImg, 0, 0, w, h);
                    const finalB64 = canvas.toDataURL('image/jpeg', 0.85);

                    if(type === 'motion') {
                        const img = document.getElementById('motion-preview-img');
                        img.src = finalB64;
                        img.style.display = 'block';
                        document.getElementById('motion-drop-text').style.display = 'none';
                        document.getElementById('motion-drop-zone').querySelector('i').style.display = 'none';
                    } else if(type === 'swap-ref') {
                        const img = document.getElementById('swap-ref-preview');
                        img.src = finalB64;
                        img.style.display = 'block';
                        document.getElementById('swap-ref-text').style.display = 'none';
                        document.getElementById('swap-ref-drop-zone').querySelector('i').style.display = 'none';
                    } else if(type === 'swap-main') {
                        document.getElementById('swap-placeholder').style.display = 'none';
                        document.getElementById('swap-canvas-container').style.display = 'flex';
                        const mainImg = document.getElementById('swap-img-before');
                        mainImg.onload = function() { initSwapCanvas(); };
                        mainImg.src = finalB64;
                    }
                };
                tempImg.src = e.target.result;
            };
            reader.readAsDataURL(file);`;

if (src.includes("reader.readAsDataURL(file);")) {
    src = src.replace(oldReaderStr, newReaderStr);
    fs.writeFileSync(TARGET, src, 'utf8');
    console.log("Updated processFile to downscale images before base64 encoding.");
} else {
    console.log("Could not find processFile logic.");
}
