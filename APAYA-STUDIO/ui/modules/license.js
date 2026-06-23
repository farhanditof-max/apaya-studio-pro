function verifyLicense() {
    const key = document.getElementById('license-key-input').value.trim();
    if(!key) { showApayaModal('Error', 'Masukkan License Key!', 'fa-key', 'var(--danger)'); return; }
    document.getElementById('ui-credit-balance').innerHTML = `<i class="fa-solid fa-circle-notch fa-spin"></i>`;
    if(typeof sketchup !== 'undefined') sketchup.verify_license(key);
}

function setInitLicense(key, credits) {
    document.getElementById('license-key-input').value = key;
    updateCreditDisplay(credits);
    checkAndStartTour();
}

function updateCreditDisplay(amount) {
    currentCredits = amount;
    const el = document.getElementById('ui-credit-balance');
    if (el) {
        el.innerHTML = `<i class="fa-solid fa-coins"></i> ${amount}`;
        el.classList.remove('credit-pulse');
        void el.offsetWidth;
        el.classList.add('credit-pulse');
    }
}

function showNewLicenseModal(key) {
    document.getElementById('new-license-display').value = key;
    document.getElementById('new-license-modal').style.display = 'flex';
}

function copyNewLicense() {
    const key = document.getElementById('new-license-display').value;
    if (navigator.clipboard) {
        navigator.clipboard.writeText(key);
    } else {
        const el = document.getElementById('new-license-display');
        el.select();
        document.execCommand('copy');
    }
    showToast("Tersalin!", "License key disalin ke clipboard.");
}

function applyNewLicense() {
    const key = document.getElementById('new-license-display').value;
    document.getElementById('license-key-input').value = key;
    document.getElementById('new-license-modal').style.display = 'none';
    if (typeof sketchup !== 'undefined') sketchup.apply_license(key);
}
