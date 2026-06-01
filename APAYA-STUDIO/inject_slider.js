const fs = require('fs');

const targetFile = 'K:\\Project\\## PLUGINS APAYA\\APAYA-STUDIO\\ui\\dashboard.html';
let content = fs.readFileSync(targetFile, 'utf8');

// 1. Add slider HTML after swap-img-after
const targetHtml = '<img id="swap-img-after" style="position: absolute; max-width: 100%; max-height: 100%; object-fit: contain; display: none; z-index: 20; box-shadow: 0 0 20px rgba(0,0,0,0.8);">';
const replacementHtml = targetHtml + '\r\n                        <input type="range" min="0" max="100" value="50" class="ba-slider" id="swap-ba-slider" style="display:none; z-index: 25;" oninput="updateSwapBASlider(this.value)">\r\n                        <div class="ba-handle" id="swap-ba-handle" style="left: 50%; display:none; z-index: 25;"></div>';

if (content.includes(targetHtml)) {
    content = content.replace(targetHtml, replacementHtml);
    console.log("Slider HTML injected.");
} else {
    console.log("targetHtml not found!");
}

// 2. Add updateSwapBASlider JS
const jsTarget = "function updateRenderBASlider(val) { document.getElementById('r-img-after').style.clipPath = `inset(0 0 0 ${val}%)`; document.getElementById('r-ba-handle').style.left = val + '%'; }";
const jsReplacement = jsTarget + "\r\n        function updateSwapBASlider(val) { document.getElementById('swap-img-after').style.clipPath = `inset(0 0 0 ${val}%)`; document.getElementById('swap-ba-handle').style.left = val + '%'; }";

if (content.includes(jsTarget)) {
    content = content.replace(jsTarget, jsReplacement);
    console.log("JS updateSwapBASlider injected.");
} else {
    console.log("jsTarget not found!");
}

// 3. Update triggerSwapGenerate
const triggerTarget = "document.getElementById('swap-loading-overlay').style.display = 'flex';\r\n            document.getElementById('btn-generate-swap').disabled = true;\r\n            sketchup.generate_swap([mainImg.src, refImg.src, promptInput]);";
const triggerReplacement = "document.getElementById('swap-loading-overlay').style.display = 'flex';\r\n            document.getElementById('btn-generate-swap').disabled = true;\r\n            \r\n            document.getElementById('swap-img-after').style.display = 'none';\r\n            document.getElementById('swap-ba-slider').style.display = 'none';\r\n            document.getElementById('swap-ba-handle').style.display = 'none';\r\n            document.getElementById('swap-canvas').style.display = 'block';\r\n\r\n            sketchup.generate_swap([mainImg.src, refImg.src, promptInput]);";

if (content.includes(triggerTarget)) {
    content = content.replace(triggerTarget, triggerReplacement);
    console.log("triggerSwapGenerate updated.");
} else {
    // try a more fuzzy approach for triggerSwapGenerate
    const idx = content.indexOf("sketchup.generate_swap([mainImg.src, refImg.src, promptInput]);");
    if (idx !== -1) {
        content = content.slice(0, idx) + "document.getElementById('swap-img-after').style.display = 'none'; document.getElementById('swap-ba-slider').style.display = 'none'; document.getElementById('swap-ba-handle').style.display = 'none'; document.getElementById('swap-canvas').style.display = 'block';\r\n            " + content.slice(idx);
        console.log("triggerSwapGenerate fuzzy updated.");
    } else {
        console.log("triggerSwapGenerate not found!");
    }
}

// 4. Update onSwapSuccess
const successTarget = "const afterImg = document.getElementById('swap-img-after');\r\n            afterImg.src = imgUrl;\r\n            afterImg.style.display = 'block';";
const successReplacement = "const afterImg = document.getElementById('swap-img-after');\r\n            afterImg.src = imgUrl;\r\n            afterImg.style.display = 'block';\r\n            afterImg.style.clipPath = 'inset(0 0 0 50%)';\r\n            document.getElementById('swap-ba-slider').value = 50;\r\n            document.getElementById('swap-ba-slider').style.display = 'block';\r\n            document.getElementById('swap-ba-handle').style.left = '50%';\r\n            document.getElementById('swap-ba-handle').style.display = 'block';\r\n            document.getElementById('swap-canvas').style.display = 'none';";

if (content.includes(successTarget)) {
    content = content.replace(successTarget, successReplacement);
    console.log("onSwapSuccess updated.");
} else {
    const idx2 = content.indexOf("afterImg.src = imgUrl;\r\n            afterImg.style.display = 'block';");
    if (idx2 !== -1) {
        content = content.replace("afterImg.src = imgUrl;\r\n            afterImg.style.display = 'block';", "afterImg.src = imgUrl;\r\n            afterImg.style.display = 'block';\r\n            afterImg.style.clipPath = 'inset(0 0 0 50%)';\r\n            document.getElementById('swap-ba-slider').value = 50;\r\n            document.getElementById('swap-ba-slider').style.display = 'block';\r\n            document.getElementById('swap-ba-handle').style.left = '50%';\r\n            document.getElementById('swap-ba-handle').style.display = 'block';\r\n            document.getElementById('swap-canvas').style.display = 'none';");
        console.log("onSwapSuccess fuzzy updated.");
    } else {
        console.log("onSwapSuccess not found!");
    }
}

fs.writeFileSync(targetFile, content, 'utf8');
console.log("dashboard.html patched successfully!");
