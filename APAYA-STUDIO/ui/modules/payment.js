function openTopupModal() { document.getElementById('topup-overlay').style.display = 'flex'; }
function closeTopupModal() { document.getElementById('topup-overlay').style.display = 'none'; }

function updatePaygPrice() {
    const qty = parseInt(document.getElementById('payg-credit-select').value);
    const price = qty * 5000;
    const el = document.getElementById('payg-price-display') || document.getElementById('payg-price');
    if(el) el.innerText = 'Rp ' + price.toLocaleString('id-ID');
}

function payPayg() {
    const qty = parseInt(document.getElementById('payg-credit-select').value);
    const price = qty * 5000;
    payKredit(qty, price);
}

let _pendingPayAmount = 0;
let _pendingLicenseKey = '';

function payKredit(amount, price) {
    const licenseKey = document.getElementById('license-key-input').value.trim();

    if (!licenseKey && currentCredits > 0) {
        showApayaModal(
            "License Key Kosong",
            "Kamu memiliki kredit aktif tapi License Key dihapus. Isi kembali License Key sebelum topup agar kredit tidak terputus.",
            "fa-triangle-exclamation",
            "var(--danger)"
        );
        return;
    }

    _pendingPayAmount = amount;
    _pendingLicenseKey = licenseKey;

    const savedEmail = localStorage.getItem('apaya_user_email') || '';

    if (licenseKey && savedEmail) {
        closeTopupModal();
        execPayment(amount, savedEmail, licenseKey);
    } else if (licenseKey && !savedEmail) {
        closeTopupModal();
        showEmailPrompt(true);
    } else {
        closeTopupModal();
        showEmailPrompt(false);
    }
}

function showEmailPrompt(isTopup) {
    const title = isTopup
        ? 'Email untuk konfirmasi topup'
        : 'Kemana kirim license key?';
    const desc = isTopup
        ? 'Konfirmasi kredit dikirim ke email ini setelah pembayaran berhasil.'
        : 'License key dikirim ke email ini setelah pembayaran berhasil.';
    const warning = isTopup
        ? ''
        : '<p style="font-size:11px; color:var(--danger); margin-bottom:20px;"><i class="fa-solid fa-triangle-exclamation"></i> Pastikan email benar — key tidak bisa dipulihkan tanpa email ini.</p>';

    document.getElementById('email-prompt-title').textContent = title;
    document.getElementById('email-prompt-desc').textContent = desc;
    document.getElementById('email-prompt-warning').innerHTML = warning;
    document.getElementById('email-prompt-input').value = localStorage.getItem('apaya_user_email') || '';
    document.getElementById('email-prompt-modal').style.display = 'flex';
}

function closeEmailPrompt() {
    document.getElementById('email-prompt-modal').style.display = 'none';
}

function confirmEmailAndPay() {
    const email = document.getElementById('email-prompt-input').value.trim();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email || !emailRegex.test(email)) {
        document.getElementById('email-prompt-input').style.borderColor = 'var(--danger)';
        setTimeout(() => { document.getElementById('email-prompt-input').style.borderColor = 'var(--border)'; }, 1500);
        return;
    }
    localStorage.setItem('apaya_user_email', email);
    closeEmailPrompt();
    execPayment(_pendingPayAmount, email, _pendingLicenseKey);
}

async function execPayment(amount, email, licenseKey) {
    showToast("Processing", "Membuat invoice pembayaran...");
    closeTopupModal();

    try {
        const response = await fetch('https://adnhrddsleheanayszbc.supabase.co/functions/v1/payment/create-payment', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ license_key: licenseKey, amount: amount, customer_email: email })
        });

        const data = await response.json();
        if (data.error) {
            showApayaModal("Gagal", data.error + (data.detail ? ' — ' + JSON.stringify(data.detail) : ''), "fa-circle-xmark", "var(--danger)");
            return;
        }

        if (data.redirect_url) {
            window.open(data.redirect_url, '_blank');

            const overlayContainer = document.createElement('div');
            overlayContainer.id = 'midtrans-iframe-container';
            overlayContainer.style.cssText = 'position:fixed;top:0;left:0;width:100vw;height:100vh;background:rgba(0,0,0,0.85);z-index:999999;display:flex;flex-direction:column;align-items:center;justify-content:center;color:white;text-align:center;padding:20px;box-sizing:border-box;';

            overlayContainer.innerHTML = `
                <i class="fa-solid fa-arrow-up-right-from-square" style="font-size:40px; color:var(--primary); margin-bottom:20px;"></i>
                <h2 style="margin-bottom:10px;">Lanjutkan Pembayaran</h2>
                <p style="margin-bottom:30px; font-size:14px; color:var(--text-muted); max-width:400px;">
                    Halaman pembayaran Midtrans telah dibuka di browser Anda.<br>
                    Silakan selesaikan pembayaran di sana.<br><br>
                    Status pembayaran sedang kami pantau secara otomatis.
                </p>
            `;

            const closeBtn = document.createElement('button');
            closeBtn.innerHTML = '<i class="fa-solid fa-xmark"></i> Batal / Tutup';
            closeBtn.style.cssText = 'background:var(--danger);color:white;border:none;padding:12px 24px;border-radius:5px;cursor:pointer;font-weight:bold;';
            closeBtn.onclick = () => {
                document.body.removeChild(overlayContainer);
                showToast("Info", "Pemantauan pembayaran ditutup.");
            };

            overlayContainer.appendChild(closeBtn);
            document.body.appendChild(overlayContainer);

            showToast("Menunggu Pembayaran", "Selesaikan pembayaran di browser eksternal.");
            pollPaymentStatus(data.order_id);
        } else {
            showToast("Gagal", "Tidak ada link pembayaran dari server.");
        }
    } catch(err) {
        console.error(err);
        showToast("Error", "Gagal menghubungi server pembayaran.");
    }
}

function pollPaymentStatus(orderId) {
    const SUPABASE_URL = 'https://adnhrddsleheanayszbc.supabase.co';
    const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFkbmhyZGRzbGVoZWFuYXlzemJjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg4NDI0OTUsImV4cCI6MjA5NDQxODQ5NX0.VIqzviMFG_XbeQ_Tpq2Sfv3KNjGuUSIdp7ZLlzDe3lo';

    let pollAttempts = 0;
    const maxPollAttempts = 60;

    const pollInterval = setInterval(async () => {
        pollAttempts++;

        if (pollAttempts >= maxPollAttempts) {
            clearInterval(pollInterval);
            showApayaModal(
                "Status Belum Terkonfirmasi",
                `Jika kamu sudah bayar, tunggu hingga 1x24 jam atau hubungi support.\nOrder ID: ${orderId}`,
                "fa-clock",
                "var(--primary)"
            );
            return;
        }

        try {
            const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/check_transaction_status`, {
                method: 'POST',
                headers: {
                    'apikey': SUPABASE_ANON_KEY,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ p_order_id: orderId })
            });

            const txData = await res.json();

            if (txData && txData.status === 'settled') {
                clearInterval(pollInterval);

                const iframeContainer = document.getElementById('midtrans-iframe-container');
                if (iframeContainer) document.body.removeChild(iframeContainer);

                const finalKey = txData.final_license_key;
                const currentKey = document.getElementById('license-key-input').value.trim();

                if (finalKey && finalKey !== currentKey) {
                    showNewLicenseModal(finalKey);
                } else {
                    showToast("Sukses!", "Kredit berhasil ditambahkan.");
                    if (typeof sketchup !== 'undefined') sketchup.get_init_data();
                }
            }
        } catch(e) { /* silent — retry di interval berikutnya */ }
    }, 5000);
}
