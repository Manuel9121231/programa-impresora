/* ═══════════════════════════════════════════════════════════
   MantApp — Core Application Logic // Test
   ═══════════════════════════════════════════════════════════ */

// ─── CONFIG — change this to your deployed Apps Script URL ───────────────────
const SHEETS_URL = 'https://script.google.com/macros/s/AKfycby6MV3_24-q_CWB4w2DEGleREdgrGAvGyhmjJqi-gnpEZ5Q8aZgWRsEBM06qBaNGhA/exec';
// ─────────────────────────────────────────────────────────────────────────────

// ─── Safe localStorage (Safari private mode throws DOMException) ──────────────
const safeStorage = {
  get: (k, def = null) => { try { const v = localStorage.getItem(k); return v === null ? def : v; } catch { return def; } },
  set: (k, v) => { try { localStorage.setItem(k, v); } catch { /* private mode */ } },
  del: (k) => { try { localStorage.removeItem(k); } catch { /* private mode */ } },
};
// ─────────────────────────────────────────────────────────────────────────────

/* ── DOM refs ───────────────────────────────────────────── */
const step1 = document.getElementById('step1');
const step2 = document.getElementById('step2');
const step3 = document.getElementById('step3');
const step4 = document.getElementById('step4');

const machineSelect = document.getElementById('machineSelect');
const machineHint = document.getElementById('machineHint');
const notes = document.getElementById('notes');


const typeIncidencia = document.getElementById('typeIncidencia');
const typeMantenimiento = document.getElementById('typeMantenimiento');

// Theme removed

const photoInputCamera = document.getElementById('photoInputCamera');
const photoInputGallery = document.getElementById('photoInputGallery');
const btnCamera = document.getElementById('btnCamera');
const btnGallery = document.getElementById('btnGallery');

const btnRetakePhoto = document.getElementById('btnRetakePhoto');

const summaryGrid = document.getElementById('summaryGrid');
const btnSubmit = document.getElementById('btnSubmit');
const submitText = document.getElementById('submitText');
const submitSpinner = document.getElementById('submitSpinner');

const successOverlay = document.getElementById('successOverlay');
const successIcon = document.querySelector('#successOverlay .success-icon');
const successTitle = document.querySelector('#successOverlay h2');
const successDetail = document.getElementById('successDetail');
const btnNewRecord = document.getElementById('btnNewRecord');
const statusBadge = document.getElementById('statusBadge');
const toast = document.getElementById('toast');
const clock = document.getElementById('clock');

const btnHistory = document.getElementById('btnHistory');
const historyOverlay = document.getElementById('historyOverlay');
const btnCloseHistory = document.getElementById('btnCloseHistory');
const historyList = document.getElementById('historyList');

/* ── State ──────────────────────────────────────────────── */
let state = {
  assetId: '',
  type: '',
  notes: '',
  photos: [],
};

let toastTimer = null;



/* ── Clock ──────────────────────────────────────────────── */
function updateClock() {
  const now = new Date();
  clock.textContent = now.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}
setInterval(updateClock, 1000);
updateClock();

/* ── Online/Offline banner ──────────────────────────────── */
function updateOnline() {
  if (navigator.onLine) {
    statusBadge.textContent = '● Online';
    statusBadge.className = 'badge-status online';
  } else {
    statusBadge.textContent = '○ Offline';
    statusBadge.className = 'badge-status offline';
  }
}
window.addEventListener('online', updateOnline);
window.addEventListener('offline', updateOnline);
updateOnline();

/* ── Toast helper ───────────────────────────────────────── */
function showToast(msg, type = '') {
  clearTimeout(toastTimer);
  toast.textContent = msg;
  toast.className = 'toast show ' + type;
  toastTimer = setTimeout(() => { toast.className = 'toast'; }, 3500);
}

/* ── Unlock step ────────────────────────────────────────── */
function unlock(el) {
  el.classList.remove('locked');
  el.classList.add('unlocked');
  setTimeout(() => el.scrollIntoView({ behavior: 'smooth', block: 'start' }), 80);
}

/* ══════════════════════════════════════════════════════════
   STEP 1 — Machine Picker
   ══════════════════════════════════════════════════════════ */
const btnNext1 = document.getElementById('btnNext1');
const LS_MACHINES = 'mantapp_machines';

async function loadMachines(preselect = null) {
  machineSelect.innerHTML = '<option value="">Cargando impresoras\u2026</option>';
  machineHint.textContent = '';
  btnNext1.disabled = true;
  state.assetId = '';

  let machines = [];

  if (SHEETS_URL) {
    try {
      const res = await fetch(`${SHEETS_URL}?action=getMachines`, { cache: 'no-store' });
      const json = await res.json();
      if (json.status === 'ok' && json.machines.length) {
        machines = json.machines;
        safeStorage.set(LS_MACHINES, JSON.stringify(machines)); // cache
      }
    } catch (_) { /* offline */ }
  }

  // Offline fallback
  if (!machines.length) {
    machines = JSON.parse(safeStorage.get(LS_MACHINES) || '[]');
  }

  if (!machines.length) {
    machineSelect.innerHTML = '<option value="">No hay impresoras \u2014 contacta al administrador</option>';
    machineHint.textContent = '';
    return;
  }

  // Group by space
  const grouped = {};
  machines.forEach(m => {
    let space = m.space || 'Maker';
    if (space === 'true' || space === true) space = 'Maker'; // Safeguard contra datos basura en la columna C del Sheet
    
    if (!grouped[space]) grouped[space] = [];
    grouped[space].push(m);
  });

  let htmlOpts = '<option value="">Selecciona una impresora\u2026</option>';
  
  // Sort spaces to render Maker then Robot, or alphabetical
  const orderedSpaces = Object.keys(grouped).sort();
  orderedSpaces.forEach(space => {
    htmlOpts += `<optgroup label="Espacio ${space}">`;
    htmlOpts += grouped[space].map(m => {
      let mark = '';
      if (m.status === 'Inactiva') mark = ' (INACTIVA)';
      return `<option value="${m.id}">${m.id}${mark}</option>`;
    }).join('');
    htmlOpts += `</optgroup>`;
  });
  
  machineSelect.innerHTML = htmlOpts;

  if (preselect) {
    const optIndex = [...machineSelect.options].findIndex(o => o.value === preselect);
    if (optIndex > -1) {
      // Set visually native behavior
      machineSelect.selectedIndex = optIndex;
      machineSelect.value = preselect;
      machineSelect.options[optIndex].selected = true;
      machineSelect.dispatchEvent(new Event('change'));
    }
  }
}

machineSelect.addEventListener('change', () => {
  state.assetId = machineSelect.value;
  btnNext1.disabled = !machineSelect.value;
});

btnNext1.addEventListener('click', () => {
  if (state.assetId) unlock(step2);
});

// Initial load is now handled at the bottom of the file in initDeepLinks()


/* ══════════════════════════════════════════════════════════
   STEP 2 — Type + Notes
   ══════════════════════════════════════════════════════════ */
const btnNext2 = document.getElementById('btnNext2');

function checkStep2() {
  let isValid = !!state.type;
  if (notes.value.trim().length === 0) isValid = false;
  btnNext2.disabled = !isValid;
}

function updateStep4IfOpen() {
  if (step4.classList.contains('unlocked')) {
    buildSummary();
    btnSubmit.disabled = btnNext3.disabled || !state.type;
  }
}

[typeIncidencia, typeMantenimiento].forEach(btn => {
  btn.addEventListener('click', () => {
    // Reset photos if type actually changes
    if (state.type && state.type !== btn.dataset.type) {
      state.photos = [];
      if (photoInputCamera) photoInputCamera.value = '';
      if (photoInputGallery) photoInputGallery.value = '';
    }

    typeIncidencia.classList.remove('selected');
    typeMantenimiento.classList.remove('selected');
    btn.classList.add('selected');
    state.type = btn.dataset.type;

    checkStep2();
    renderPhotoGrid(); // Update photo requirement live
    updateStep4IfOpen(); // Seamlessly update summary and submit button
  });
});

notes.addEventListener('input', () => {
  state.notes = notes.value.trim();
  checkStep2();
  updateStep4IfOpen();
});

btnNext2.addEventListener('click', () => {
  state.notes = notes.value.trim();
  renderPhotoGrid(); // Re-evaluate optional vs mandatory based on state.type
  unlock(step3);
});

/* ══════════════════════════════════════════════════════════
   STEP 3 — Photos (multi)
   ══════════════════════════════════════════════════════════ */
const btnNext3 = document.getElementById('btnNext3');
const photoGrid = document.getElementById('photoGrid');
const photoAddContainer = document.getElementById('photoAddContainer');
const photoHint = document.getElementById('photoHint');
const MAX_PHOTOS = 5;

function renderPhotoGrid() {
  photoGrid.innerHTML = '';

  state.photos.forEach((b64, idx) => {
    const tile = document.createElement('div');
    tile.className = 'photo-thumb-tile';
    tile.innerHTML = `
      <img src="${b64}" alt="Foto ${idx + 1}" />
      <button class="photo-remove" data-idx="${idx}" title="Eliminar">✕</button>
    `;
    photoGrid.appendChild(tile);
  });

  const atMax = state.photos.length >= MAX_PHOTOS;
  if (photoAddContainer) photoAddContainer.style.display = atMax ? 'none' : 'flex';

  if (state.photos.length === 0) {
    photoHint.textContent = state.type === 'Mantenimiento'
      ? 'Puedes añadir hasta 5 fotos (opcional)'
      : 'Añade al menos 1 foto (máx 5)';
  } else if (atMax) {
    photoHint.textContent = 'Máximo de fotos alcanzado';
  } else {
    photoHint.textContent = `${state.photos.length}/${MAX_PHOTOS} fotos — puedes añadir más`;
  }

  // Mandatory for Incidencia, Optional for Mantenimiento
  if (state.type === 'Mantenimiento') {
    btnNext3.disabled = false;
  } else {
    btnNext3.disabled = state.photos.length === 0;
  }
}

const cameraOverlay = document.getElementById('cameraOverlay');
const camVideo = document.getElementById('camVideo');
const btnCamClose = document.getElementById('btnCamClose');
const btnCamCapture = document.getElementById('btnCamCapture');
const camCanvas = document.getElementById('camCanvas');
let stream = null;

if (btnCamera) {
  btnCamera.addEventListener('click', async () => {
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    if (isMobile) {
      photoInputCamera.click();
      return;
    }

    try {
      stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      if (camVideo) camVideo.srcObject = stream;
      if (cameraOverlay) {
        cameraOverlay.style.display = 'flex';
        cameraOverlay.classList.remove('hidden');
      }
    } catch (err) {
      showToast('No se pudo usar la cámara, mostrando explorador', 'warning');
      photoInputCamera.click();
    }
  });
}

function stopCamera() {
  if (stream) {
    stream.getTracks().forEach(t => t.stop());
    stream = null;
  }
  if (cameraOverlay) {
    cameraOverlay.style.display = 'none';
    cameraOverlay.classList.add('hidden');
  }
}

if (btnCamClose) btnCamClose.addEventListener('click', stopCamera);

if (btnCamCapture) {
  btnCamCapture.addEventListener('click', () => {
    if (!stream) return;

    if (state.photos.length >= MAX_PHOTOS) {
      showToast('Límite de fotos alcanzado', 'error');
      stopCamera();
      return;
    }

    const maxWidth = 1024;
    let width = camVideo.videoWidth || maxWidth;
    let height = camVideo.videoHeight || 768;

    if (width > maxWidth) {
      height = Math.round((height * maxWidth) / width);
      width = maxWidth;
    }

    camCanvas.width = width;
    camCanvas.height = height;
    const ctx = camCanvas.getContext('2d');
    ctx.drawImage(camVideo, 0, 0, width, height);

    const b64 = camCanvas.toDataURL('image/jpeg', 0.8);
    state.photos.push(b64);

    renderPhotoGrid();
    updateStep4IfOpen();
    stopCamera();
  });
}
if (btnGallery) btnGallery.addEventListener('click', () => photoInputGallery.click());

photoGrid.addEventListener('click', e => {
  const btn = e.target.closest('.photo-remove');
  if (!btn) return;
  state.photos.splice(Number(btn.dataset.idx), 1);
  renderPhotoGrid();
  updateStep4IfOpen();
});

// Primary robust compression (Fixes Xiaomi/MIUI black/white gallery issues)
function compressImage(file, maxWidth = 1024, quality = 0.7) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    // Using objectURL avoids the massive RAM spike of FileReader base64
    const url = URL.createObjectURL(file);

    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Image decode failed'));
    };

    img.onload = () => {
      URL.revokeObjectURL(url); // Free memory immediately

      let width = img.naturalWidth || img.width;
      let height = img.naturalHeight || img.height;

      if (width > maxWidth) {
        height = Math.round((height * maxWidth) / width);
        width = maxWidth;
      }

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;

      // Disable alpha to prevent transparent pixel tearing on hardware composers
      const ctx = canvas.getContext('2d', { alpha: false });
      // Force a solid white background in case the image has transparency
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, width, height);
      // Draw the decoded image over the white background
      ctx.drawImage(img, 0, 0, width, height);

      const dataUrl = canvas.toDataURL('image/jpeg', quality);

      // Explicitly clear canvas to free GPU memory on Android WebViews immediately
      canvas.width = 0;
      canvas.height = 0;

      resolve(dataUrl);
    };

    img.src = url;
  });
}

async function handlePhotos(filesGroup, inputElement) {
  const files = [...filesGroup];
  inputElement.value = '';

  const remaining = MAX_PHOTOS - state.photos.length;
  if (files.length > remaining) showToast(`Solo se añadieron ${remaining} foto(s) — máximo ${MAX_PHOTOS}`, 'error');

  const toAdd = files.slice(0, remaining);
  if (!toAdd.length) return;

  // Prevent UI freezing on weak devices
  document.getElementById('btnGallery').disabled = true;
  document.getElementById('btnCamera').disabled = true;

  for (const file of toAdd) {
    if (!file.type.startsWith('image/')) {
      showToast('Por favor selecciona solo imágenes', 'error');
      continue;
    }
    if (file.size > 15 * 1024 * 1024) {
      showToast('Una foto es demasiado grande (máx 15 MB)', 'error');
      continue;
    }

    // Tiny delay to let the GPU/Browser UI thread breathe between heavy canvas operations
    await new Promise(r => setTimeout(r, 60));

    try {
      const compressedB64 = await compressImage(file, 1024, 0.7);
      state.photos.push(compressedB64);
    } catch (e) {
      showToast('Error al leer una imagen', 'error');
    }
  }

  document.getElementById('btnGallery').disabled = false;
  document.getElementById('btnCamera').disabled = false;
  renderPhotoGrid();
  updateStep4IfOpen();
}

if (photoInputCamera) photoInputCamera.addEventListener('change', () => handlePhotos(photoInputCamera.files, photoInputCamera));
if (photoInputGallery) photoInputGallery.addEventListener('change', () => handlePhotos(photoInputGallery.files, photoInputGallery));

btnNext3.addEventListener('click', () => {
  buildSummary();
  unlock(step4);
});


/* ══════════════════════════════════════════════════════════
   STEP 4 — Summary & Submit
   ══════════════════════════════════════════════════════════ */
function buildSummary() {
  const now = new Date();
  const ts = now.toLocaleString('es-ES', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit', second: '2-digit'
  });

  // Persist timestamp for submission
  state.timestamp = now.toISOString();

  const rows = [
    { key: 'ID Activo', val: state.assetId, mono: true },
    { key: 'Tipo', val: state.type, mono: false },
    { key: 'Timestamp', val: ts, mono: true },
    { key: 'Notas', val: state.notes || '—', mono: false },
  ];

  summaryGrid.innerHTML = rows.map(r => `
    <div class="summary-row">
      <span class="summary-key">${r.key}</span>
      <span class="summary-val ${r.mono ? 'mono' : ''}">${r.val}</span>
    </div>
  `).join('');

  // Add photo thumbnails row
  if (state.photos.length > 0) {
    const thumbs = state.photos
      .map((b, i) => `<img src="${b}" class="summary-thumb" alt="Foto ${i + 1}" />`)
      .join('');
    summaryGrid.innerHTML += `
      <div class="summary-row">
        <span class="summary-key">Fotos</span>
        <div style="display:flex;flex-wrap:wrap;gap:6px">${thumbs}</div>
      </div>
    `;
  }
}

/* ── Submit to Google Sheets ────────────────────────────── */
btnSubmit.addEventListener('click', submitToSheets);

async function submitToSheets() {
  const payload = {
    timestamp: state.timestamp,
    assetId: state.assetId,
    type: state.type,
    notes: state.notes,
    photos: state.photos,
  };

  if (!navigator.onLine) {
    saveOffline(payload);
    successIcon.style.display = '';
    successTitle.style.display = '';
    btnNewRecord.style.display = '';
    successDetail.textContent = `Sin conexión.\nGuardado localmente, se enviará automáticamente.`;
    successOverlay.classList.remove('hidden');
    return;
  }

  // Mostrar "Enviando..." sin chulito ni botón
  btnSubmit.disabled = true;
  submitText.classList.add('hidden');
  submitSpinner.classList.remove('hidden');

  successIcon.style.display = 'none';
  successTitle.style.display = 'none';
  btnNewRecord.style.display = 'none';
  successDetail.innerHTML = '<span class="spinner" style="display:inline-block;margin-right:10px;border-color:var(--accent);border-top-color:transparent;"></span> Enviando\u2026 por favor espera';
  successOverlay.classList.remove('hidden');

  try {
    await fetch(SHEETS_URL, {
      method: 'POST',
      mode: 'no-cors',
      headers: { 'Content-Type': 'text/plain' },
      body: JSON.stringify(payload),
    });

    // Guardar en el historial local una vez enviado con éxito
    saveToHistory(payload, 'sent');

    // Mostrar UI de éxito completa
    successIcon.style.display = '';
    successTitle.style.display = '';
    btnNewRecord.style.display = '';
    successDetail.textContent = `Registro enviado correctamente a la nube.`;
  } catch (error) {
    saveOffline(payload);
    successIcon.style.display = '';
    successTitle.style.display = '';
    btnNewRecord.style.display = '';
    successDetail.textContent = `Error de red. Guardado localmente.\nSe enviará cuando recuperes la conexión.`;
    flushOfflineQueue();
  } finally {
    btnSubmit.disabled = false;
    submitText.classList.remove('hidden');
    submitSpinner.classList.add('hidden');
  }
}

/* ── New record ─────────────────────────────────────────── */
btnNewRecord.addEventListener('click', () => {
  successOverlay.classList.add('hidden');
  resetApp();
});

function resetApp() {
  // Reset state
  state = { assetId: '', type: '', notes: '', photos: [] };

  // Reset UI inputs
  notes.value = '';
  typeIncidencia.classList.remove('selected');
  typeMantenimiento.classList.remove('selected');
  machineSelect.value = '';

  // Reset photo grid
  renderPhotoGrid();

  // Reset dropdown and reload machine list
  state.assetId = '';
  loadMachines();

  if (photoInputCamera) photoInputCamera.value = '';
  if (photoInputGallery) photoInputGallery.value = '';

  summaryGrid.innerHTML = '';

  btnNext1.disabled = true;
  btnNext2.disabled = true;
  btnNext3.disabled = true;

  step2.classList.remove('unlocked'); step2.classList.add('locked');
  step3.classList.remove('unlocked'); step3.classList.add('locked');
  step4.classList.remove('unlocked'); step4.classList.add('locked');

  // Reset submit button state
  btnSubmit.disabled = false;
  submitText.classList.remove('hidden');
  submitSpinner.classList.add('hidden');

  // Return to top
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

/* ── Offline queue ──────────────────────────────────────── */
function saveOffline(payload) {
  const queue = JSON.parse(safeStorage.get('mantapp_queue') || '[]');
  queue.push(payload);
  safeStorage.set('mantapp_queue', JSON.stringify(queue));
}

let isFlushing = false;
async function flushOfflineQueue() {
  if (isFlushing || !navigator.onLine) return;
  isFlushing = true;

  let queue = JSON.parse(safeStorage.get('mantapp_queue') || '[]');
  if (!queue.length) { isFlushing = false; return; }

  safeStorage.set('mantapp_queue', '[]'); // Take ownership

  const failed = [];
  let sentCount = 0;
  for (const payload of queue) {
    try {
      await fetch(SHEETS_URL, {
        method: 'POST',
        mode: 'no-cors',
        headers: { 'Content-Type': 'text/plain' },
        body: JSON.stringify(payload),
      });
      // Legacy local save (optional)
      saveToHistory(payload, 'sent');
      sentCount++;
    } catch (_) {
      failed.push(payload);
    }
  }

  const currentQueue = JSON.parse(safeStorage.get('mantapp_queue') || '[]');
  safeStorage.set('mantapp_queue', JSON.stringify([...failed, ...currentQueue]));

  if (sentCount > 0) {
    showToast(`${sentCount} registro(s) sincronizado(s) con la nube.`, 'ok');
  }

  isFlushing = false;
  if (currentQueue.length > 0 && navigator.onLine) {
    setTimeout(flushOfflineQueue, 1500);
  }
}

window.addEventListener('online', flushOfflineQueue);
flushOfflineQueue(); // attempt on load if reconnected

/* ── Service Worker registration ────────────────────────── */
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('service-worker.js')
    .catch(e => console.warn('SW registration failed:', e));
}

/* ── Initialization (Deep-links & Setup) ────────────────── */
(function initDeepLinks() {
  const params = new URLSearchParams(window.location.search);
  const urlId = params.get('id') || params.get('ID');
  const machinesPayload = params.get('machines');

  if (machinesPayload) {
    try {
      const machines = JSON.parse(decodeURIComponent(escape(atob(machinesPayload))));
      if (!Array.isArray(machines) || !machines.length) throw new Error();
      safeStorage.set('mantapp_machines', JSON.stringify(machines));
      showToast(`✓ ${machines.length} impresoras importadas`, 'ok');
    } catch (_) {
      showToast('Error al importar la configuración', 'error');
    }
    const url = new URL(window.location);
    url.searchParams.delete('machines');
    window.history.replaceState({}, '', url);
  }

  if (urlId && urlId.trim().length > 0) {
    const clean = urlId.trim().toUpperCase();
    loadMachines(clean).then(() => {
      if (state.assetId) {
        // Unlock step2 without scrolling (QR pre-select should be silent)
        step2.classList.remove('locked');
        step2.classList.add('unlocked');
        showToast(`Impresora ${clean} seleccionada desde QR`, 'ok');
      } else {
        showToast(`Impresora ${clean} no encontrada en la lista`, 'error');
      }
      const url = new URL(window.location);
      url.searchParams.delete('id');
      url.searchParams.delete('ID');
      window.history.replaceState({}, '', url);
    });
  } else {
    loadMachines();
  }
})();

/* ── Admin button: navigate to generator (password gate is on that page) ── */
document.getElementById('btnAdmin')
  .addEventListener('click', () => { window.location.href = 'ajustes.html'; });

/* ── History ────────────────────────────────────────────── */
function saveToHistory(payload, status) {
  // Keeps local sent history as backup, but global overrides
  const history = JSON.parse(safeStorage.get('mantapp_history') || '[]');
  history.unshift({ ...payload, status });
  if (history.length > 50) history.pop();
  safeStorage.set('mantapp_history', JSON.stringify(history));
}

let globalHistoryCache = [];

async function fetchGlobalHistory() {
  historyList.innerHTML = '<div class="history-empty"><span class="spinner" style="display:inline-block; border-color:var(--accent); border-top-color:transparent;"></span> Cargando de internet...</div>';

  if (!navigator.onLine) {
    showToast("Sin conexión. Usando caché/locales.", "error");
    renderGlobalHistory(); // Will just show pending + old cache
    return;
  }

  try {
    const res = await fetch(`${SHEETS_URL}?action=getHistory`, { cache: 'no-store' });
    const json = await res.json();
    if (json.status === 'ok') {
      if (!json.history) {
        throw new Error("El backend no devolvió el historial. Para que funcione, ve a Apps Script > Implementar > Gestionar implementaciones, edita la actual (ícono lápiz) y crea una 'Nueva versión'.");
      }
      globalHistoryCache = json.history || [];
      renderGlobalHistory();
    } else {
      throw new Error(json.error);
    }
  } catch (err) {
    globalHistoryCache = []; // reset to prevent iterable errors
    historyList.innerHTML = `<div class="history-empty" style="color:var(--danger)">Error: ${err.message}</div>`;
  }
}

function renderGlobalHistory() {
  const filterAsset = document.getElementById('histFilterAsset').value;
  const filterType = document.getElementById('histFilterType').value;

  const queue = JSON.parse(localStorage.getItem('mantapp_queue') || '[]');
  const pendingItems = queue.map(q => ({
    assetId: q.assetId, type: q.type, notes: q.notes,
    timestamp: new Date(q.timestamp).toLocaleString('es-ES'),
    isPending: true,
    photoUrls: [] // Pending photos not URL-d yet
  }));

  const allItems = [...pendingItems, ...(globalHistoryCache || [])];

  let filtered = allItems.filter(item => {
    if (filterAsset && item.assetId.trim().toUpperCase() !== filterAsset.trim().toUpperCase()) {
      if (!item.assetId.trim().toUpperCase().includes(filterAsset.trim().toUpperCase())) {
        return false;
      }
    }
    if (filterType) {
      if (item.type !== filterType && !item.type.startsWith(filterType)) return false;
    }
    return true;
  });

  historyList.innerHTML = '';
  if (!filtered.length) {
    historyList.innerHTML = '<div class="history-empty">No hay registros que coincidan</div>';
    return;
  }

  filtered.forEach(item => {
    const timeColor = 'var(--text-3)';

    let photosHtml = '';
    let fallbackHtml = '';

    if (item.photoUrls && item.photoUrls.length > 0) {
      const fileIds = item.photoUrls.map(url => {
        const match = url.match(/\/d\/([a-zA-Z0-9-_]+)/);
        return match ? match[1] : null;
      }).filter(Boolean);

      if (fileIds.length > 0) {
        // Build thumbnail URLs list for lightbox (passed as JSON attribute)
        const thumbUrls = fileIds.map(id => `https://drive.google.com/thumbnail?id=${id}&sz=w1600`);
        const thumbUrlsAttr = encodeURIComponent(JSON.stringify(thumbUrls));
        photosHtml = `
            <button class="btn-ghost btn-sm" style="margin-top:8px; width:100%; border-color:var(--border);" onclick="this.nextElementSibling.style.display='flex'; this.style.display='none';">📎 Ver ${fileIds.length} foto(s)</button>
            <div style="display:none; margin-top:8px; flex-direction:column; gap:8px;" data-lb-urls="${thumbUrlsAttr}">
              ${fileIds.map((id, i) => `
                <img src="https://drive.google.com/thumbnail?id=${id}&sz=w400"
                     referrerpolicy="no-referrer"
                     class="hist-photo-img"
                     alt="Foto ${i + 1}"
                     style="width:100%; max-height:300px; object-fit:cover; background:#111; border-radius:8px; border:1px solid var(--border);"
                     loading="lazy"
                     data-lb-index="${i}"
                     data-lb-urls="${thumbUrlsAttr}"
                     onerror="this.onerror=null; this.src='https://lh3.googleusercontent.com/d/${id}=w400';" />
              `).join('')}
            </div>
          `;
      }
    }

    if (!photosHtml && item.folderUrl) {
      fallbackHtml = `<a href="${item.folderUrl}" target="_blank" style="font-size:0.8rem; color:var(--accent); margin-top:4px; display:inline-block; text-decoration:none;">📁 Abrir carpeta Drive</a>`;
    }

    const div = document.createElement('div');
    div.className = `history-item sent`;
    div.innerHTML = `
      <div class="history-item-header">
        <span class="history-item-id">${item.assetId}</span>
      </div>
      <div class="history-item-type ${item.type.startsWith('Incidencia') ? 'type-incidencia' : 'type-mantenimiento'}">${item.type}</div>
      <div class="history-item-time" style="margin-bottom:4px; color:${timeColor}">${item.timestamp}</div>
      ${item.notes ? `<div style="font-size:0.8rem; color:var(--text-2); margin-top:4px;">💬 ${item.notes}</div>` : ''}
      ${photosHtml}
      ${fallbackHtml}
    `;
    historyList.appendChild(div);
  });
}

document.getElementById('histFilterAsset').addEventListener('input', renderGlobalHistory);
document.getElementById('histFilterType').addEventListener('change', renderGlobalHistory);

btnHistory.addEventListener('click', () => {
  // Populate the machine filter
  const histFilterAsset = document.getElementById('histFilterAsset');
  const machines = JSON.parse(safeStorage.get('mantapp_machines') || '[]');

  const currentVal = histFilterAsset.value;
  histFilterAsset.innerHTML = '<option value="">Todas las máquinas...</option>' +
    machines.map(m => `<option value="${m.id}">${m.id}</option>`).join('');
  if (machines.some(m => m.id === currentVal)) histFilterAsset.value = currentVal;

  historyOverlay.classList.remove('hidden');
  fetchGlobalHistory();
});
btnCloseHistory.addEventListener('click', () => {
  historyOverlay.classList.add('hidden');
});

/* ── Lightbox ────────────────────────────────────────────── */
(function initLightbox() {
  const lightbox = document.getElementById('lightbox');
  const lbImg = document.getElementById('lightboxImg');
  const lbClose = document.getElementById('lightboxClose');
  const lbPrev = document.getElementById('lightboxPrev');
  const lbNext = document.getElementById('lightboxNext');
  const lbCounter = document.getElementById('lightboxCounter');

  let lbUrls = [];
  let lbIndex = 0;

  function openLightbox(urls, index) {
    lbUrls = urls;
    lbIndex = index;
    showCurrent();
    lightbox.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
  }

  function closeLightbox() {
    lightbox.classList.add('hidden');
    document.body.style.overflow = '';
    lbImg.src = '';
  }

  function showCurrent() {
    lbImg.src = lbUrls[lbIndex];
    lbCounter.textContent = lbUrls.length > 1 ? `${lbIndex + 1} / ${lbUrls.length}` : '';
    lbPrev.classList.toggle('hidden', lbUrls.length <= 1 || lbIndex === 0);
    lbNext.classList.toggle('hidden', lbUrls.length <= 1 || lbIndex === lbUrls.length - 1);
  }

  lbClose.addEventListener('click', closeLightbox);

  // Click on backdrop to close
  lightbox.addEventListener('click', e => {
    if (e.target === lightbox) closeLightbox();
  });

  lbPrev.addEventListener('click', e => {
    e.stopPropagation();
    if (lbIndex > 0) { lbIndex--; showCurrent(); }
  });

  lbNext.addEventListener('click', e => {
    e.stopPropagation();
    if (lbIndex < lbUrls.length - 1) { lbIndex++; showCurrent(); }
  });

  // Keyboard navigation
  document.addEventListener('keydown', e => {
    if (lightbox.classList.contains('hidden')) return;
    if (e.key === 'Escape') closeLightbox();
    if (e.key === 'ArrowLeft' && lbIndex > 0) { lbIndex--; showCurrent(); }
    if (e.key === 'ArrowRight' && lbIndex < lbUrls.length - 1) { lbIndex++; showCurrent(); }
  });

  // Delegate click on history photo images
  document.getElementById('historyList').addEventListener('click', e => {
    const img = e.target.closest('.hist-photo-img');
    if (!img) return;
    const urls = JSON.parse(decodeURIComponent(img.dataset.lbUrls));
    const index = Number(img.dataset.lbIndex);
    openLightbox(urls, index);
  });
})();

/* ── QR Site Button ─────────────────────────────────────── */
(function initQRButton() {
  const btnQR = document.getElementById('btnQR');
  const qrPopover = document.getElementById('qrPopover');
  const qrImg = document.getElementById('qrPopoverImg');
  const qrUrl = document.getElementById('qrPopoverUrl');
  if (!btnQR || !qrPopover) return;

  let generated = false;

  function generateQR() {
    if (generated) return;
    // Clean URL — strip query params and hash so the QR always points to the root app
    const url = window.location.origin + window.location.pathname.replace(/\/[^/]*\.html$/, '/');
    qrUrl.textContent = url;

    const qr = qrcode(0, 'M');
    qr.addData(url);
    qr.make();
    qrImg.innerHTML = qr.createImgTag(4, 6);
    generated = true;
  }

  function openQR() {
    generateQR();
    qrPopover.style.display = 'block';
    btnQR.classList.add('active');
  }

  function closeQR() {
    qrPopover.style.display = 'none';
    btnQR.classList.remove('active');
  }

  btnQR.addEventListener('click', e => {
    e.stopPropagation();
    qrPopover.style.display === 'none' ? openQR() : closeQR();
  });

  // Close when clicking anywhere outside the popover
  document.addEventListener('click', e => {
    if (!qrPopover.contains(e.target) && e.target !== btnQR) closeQR();
  });

  // Close on Escape
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') closeQR();
  });
})();

