const fs = require('fs');
const file = 'K:/Project/## PLUGINS APAYA/APAYA-STUDIO/ui/dashboard.html';
let content = fs.readFileSync(file, 'utf8');

const searchString = 'let currentEnvC = "interior"; let currentEnvR = "interior";';
if(content.includes(searchString)) {
    const replacement = `        function switchTab(tabId, iconEl) {
            document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
            document.querySelectorAll('.tab-icon').forEach(i => i.classList.remove('active'));
            document.getElementById(tabId).classList.add('active'); iconEl.classList.add('active');

            activeProcessTab = tabId === 'tab-concept' ? 'concept' : (tabId === 'tab-render' ? 'render' : (tabId === 'tab-mat' ? 'material' : (tabId === 'tab-upscale' ? 'upscale' : (tabId === 'tab-swap' ? 'swap' : 'camera'))));
            document.getElementById('sidebar-manager').style.display = 'none';
            document.getElementById('sidebar-concept').style.display = 'none';
            document.getElementById('sidebar-material').style.display = 'none';

            if(tabId === 'tab-concept' || tabId === 'tab-render') { document.getElementById('sidebar-concept').style.display = 'flex'; loadConceptThumbs(); } 
            else if (tabId === 'tab-mat') { document.getElementById('sidebar-material').style.display = 'flex'; loadMaterialThumbs(); } 
            else if (tabId === 'tab-swap' || tabId === 'tab-motion' || tabId === 'tab-upscale') { /* No sidebar needed — controls are inline */ }
            else { document.getElementById('sidebar-manager').style.display = 'flex'; }
        }

        let currentEnvC = "interior"; let currentEnvR = "interior";`;
    content = content.replace(searchString, replacement);
    fs.writeFileSync(file, content);
    console.log('Restored switchTab successfully');
} else {
    console.log('Could not find anchor point');
}
