const fs = require('fs');

const lines = fs.readFileSync('K:\\Project\\## PLUGINS APAYA\\APAYA-STUDIO\\ui\\dashboard.html.recovered.html', 'utf8').split(/\r?\n/);

const upscaleStart = lines.findIndex(l => l.includes('<div id="tab-upscale"'));
const upscaleEnd = lines.findIndex((l, i) => i > upscaleStart && l.includes('</main>'));

if (upscaleStart !== -1 && upscaleEnd !== -1) {
    fs.writeFileSync('K:\\Project\\## PLUGINS APAYA\\APAYA-STUDIO\\ui\\tab_upscale.html', lines.slice(upscaleStart, upscaleEnd).join('\n'));
    console.log("Extracted tab-upscale");
} else {
    console.log("tab-upscale not found");
}

// Also extract the javascript that was added for upscale
const jsStart = lines.findIndex(l => l.includes('function loadUpscaleHistory'));
const jsEnd = lines.findIndex((l, i) => i > jsStart && l.includes('function loadMotionHistory'));

if (jsStart !== -1 && jsEnd !== -1) {
    fs.writeFileSync('K:\\Project\\## PLUGINS APAYA\\APAYA-STUDIO\\ui\\js_upscale.js', lines.slice(jsStart, jsEnd).join('\n'));
    console.log("Extracted js upscale");
} else {
    console.log("js upscale not found");
}
