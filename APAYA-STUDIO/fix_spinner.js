const fs = require('fs');
const TARGET = 'K:\\Project\\## PLUGINS APAYA\\APAYA-STUDIO\\ui\\dashboard.html';
let src = fs.readFileSync(TARGET, 'utf8');

// Add CSS
const cssToAdd = `
        .spin-logo {
            width: 50px;
            height: 50px;
            margin-bottom: 15px;
            animation: pulse-spin 2s infinite ease-in-out;
        }
        @keyframes pulse-spin {
            0% { transform: scale(0.8) rotate(0deg); opacity: 0.5; }
            50% { transform: scale(1.1) rotate(180deg); opacity: 1; }
            100% { transform: scale(0.8) rotate(360deg); opacity: 0.5; }
        }
`;
if (!src.includes('.spin-logo {')) {
    src = src.replace('</style>', cssToAdd + '    </style>');
}

// Replace loading spinner in overlays
const overlayBlocks = [
    'id="r-loading-overlay"',
    'id="ai-loading-overlay"',
    'id="mat-loading-overlay"',
    'id="swap-loading-overlay"',
    'id="motion-loading-overlay"'
];

for(const overlay of overlayBlocks) {
    const idx = src.indexOf(overlay);
    if(idx !== -1) {
        const nextI = src.indexOf('<i class="fa-solid fa-circle-notch fa-spin"></i>', idx);
        // Only replace if it's within the next 200 chars to be safe
        if(nextI !== -1 && nextI < idx + 200) {
            src = src.substring(0, nextI) + '<img src="../assets/logo_apaya.png" class="spin-logo">' + src.substring(nextI + 50);
        }
    }
}

fs.writeFileSync(TARGET, src, 'utf8');
console.log('Fixed loading spinner in dashboard.html');
