const fs = require('fs');
const TARGET = 'K:\\Project\\## PLUGINS APAYA\\APAYA-STUDIO\\ui\\dashboard.html';
let src = fs.readFileSync(TARGET, 'utf8');

const oldPromptStr = "const prompt = swapMode === 'object' ? 'Ganti objek ' + objName + ' menjadi sesuai dengan referensi.' : 'Ubah material pada ' + objName + ' menjadi sesuai referensi.';";
const newPromptStr = "const prompt = swapMode === 'object' ? 'change ' + objName + ' in image A to ' + objName + ' in Image B' : 'change material of ' + objName + ' in image A to material in Image B';";

if(src.includes(oldPromptStr)) {
    src = src.replace(oldPromptStr, newPromptStr);
    fs.writeFileSync(TARGET, src, 'utf8');
    console.log('Prompt updated in dashboard.html');
} else {
    console.log('Old prompt string not found');
}
