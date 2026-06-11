// js/browser-adapter.js
// Mocks SketchUp Ruby API for browser context (GitHub Pages).
// Must load BEFORE dashboard inline script.
(function () {
  'use strict';

  // --- CONFIG ---
  const SUPABASE_URL = 'https://adnhrddsleheanayszbc.supabase.co';
  const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFkbmhyZGRzbGVoZWFuYXlzemJjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg4NDI0OTUsImV4cCI6MjA5NDQxODQ5NX0.VIqzviMFG_XbeQ_Tpq2Sfv3KNjGuUSIdp7ZLlzDe3lo';

  // --- MOCK CAMERAS ---
  const MOCK_CAMERAS = [
    { name: 'Scene 1',     aspect: '1.78', type: 'Landscape' },
    { name: 'Scene 2',     aspect: '0.56', type: 'Portrait'  },
    { name: 'Demo Camera', aspect: '1.33', type: 'Landscape' },
  ];

  const SKETCHUP_ONLY_MSG = 'Fitur ini hanya tersedia di plugin SketchUp. Download di Extension Warehouse.';

  function toast(msg) {
    if (typeof showToast === 'function') {
      showToast('SketchUp Only', msg, 'fa-cube', 'var(--text-muted)');
    }
  }

  function resetLoadingOverlays() {
    ['ai-loading-overlay', 'r-loading-overlay', 'mat-loading-overlay',
     'motion-loading-overlay', 'swap-loading-overlay'].forEach(function(id) {
      var el = document.getElementById(id);
      if (el) el.style.display = 'none';
    });
    if (typeof setGeneratingState === 'function') setGeneratingState(false);
    ['btn-generate-motion', 'btn-generate-swap'].forEach(function(id) {
      var btn = document.getElementById(id);
      if (btn) btn.disabled = false;
    });
  }

  function sketchupOnlyGate() {
    resetLoadingOverlays();
    toast(SKETCHUP_ONLY_MSG);
  }

  async function browserVerifyLicense(key) {
    try {
      var res = await fetch(SUPABASE_URL + '/rest/v1/rpc/get_license_credits', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + SUPABASE_KEY,
          'apikey': SUPABASE_KEY,
        },
        body: JSON.stringify({ p_key: key }),
      });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      var raw = await res.json();
      var credits = raw !== null ? parseInt(raw, 10) : 0;
      localStorage.setItem('apaya_license_key', key);
      localStorage.setItem('apaya_credits', credits);
      if (typeof setInitLicense === 'function') setInitLicense(key, credits);
    } catch (e) {
      console.error('[BROWSER] License verify error:', e.message);
      if (typeof setInitLicense === 'function') setInitLicense(key, 0);
    }
  }

  async function browserInit() {
    var savedKey   = localStorage.getItem('apaya_license_key') || '';
    var cachedCr   = parseInt(localStorage.getItem('apaya_credits') || '0', 10);

    if (typeof setInitLicense   === 'function') setInitLicense(savedKey, cachedCr);
    if (typeof updateCameraList === 'function') updateCameraList(MOCK_CAMERAS);

    if (savedKey) await browserVerifyLicense(savedKey);
  }

  window.sketchup = {
    get_init_data:       function()    { browserInit(); },
    verify_license:      function(key) { browserVerifyLicense(key); },
    activate_camera:     function()    {},
    rename_camera:       function()    {},
    delete_cameras:      function()    {},
    get_scene_thumbnail: function()    {},
    export_cameras:      function()    { sketchupOnlyGate(); },
    open_export_folder:  function()    { sketchupOnlyGate(); },
    open_cache_folder:   function()    { sketchupOnlyGate(); },
    save_to_gallery:     function()    {},
    generate_ai_concept: function()    { sketchupOnlyGate(); },
    request_alchemist:   function()    { sketchupOnlyGate(); },
    generate_motion:     function()    { sketchupOnlyGate(); },
    generate_magic_swap: function()    { sketchupOnlyGate(); },
  };

  window.applyLicenseBrowser = function(key) {
    localStorage.setItem('apaya_license_key', key);
    browserInit();
    if (typeof showToast === 'function') {
      showToast('License Disimpan', 'Copy key ini dan paste ke kolom License Key di plugin SketchUp.', 'fa-check', 'var(--primary)');
    }
  };
})();
