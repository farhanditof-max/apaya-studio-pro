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

function showApayaModal(title, desc, iconClass, iconColor) {
    document.getElementById('cam-modal-title').innerText = title;
    document.getElementById('cam-modal-desc').innerText = desc;
    const icon = document.getElementById('cam-modal-icon');
    icon.className = "fa-solid " + iconClass;
    icon.style.color = iconColor || "var(--primary)";
    document.getElementById('custom-apaya-modal').style.display = 'flex';
    setGeneratingState(false);
}

function updateBASlider(val) { document.getElementById('img-after').style.clipPath = `inset(0 0 0 ${val}%)`; document.getElementById('ba-handle').style.left = val + '%'; }
function updateRenderBASlider(val) { document.getElementById('r-img-after').style.clipPath = `inset(0 0 0 ${val}%)`; document.getElementById('r-ba-handle').style.left = val + '%'; }
