/* ═══════════════════════════════════════════════════════════
   Reporte de Impresoras — Interfaz Operario
   Adaptado para usar la API local del servidor Node.js
   ═══════════════════════════════════════════════════════════ */

// ─── API LOCAL (servidor Node.js) ───────────────────────────────────────────
// Detectar automáticamente la URL base del servidor
const API_BASE = window.location.origin;
// ─────────────────────────────────────────────────────────────────────────────

/* ── DOM refs ───────────────────────────────────────────── */
const step1 = document.getElementById('step1');
const step2 = document.getElementById('step2');
const step3 = document.getElementById('step3');
const step4 = document.getElementById('step4');

const machineSelect = document.getElementById('machineSelect');
const machineHint   = document.getElementById('machineHint');
const notes         = document.getElementById('notes');

const typeIncidencia   = document.getElementById('typeIncidencia');
const typeMantenimiento = document.getElementById('typeMantenimiento');

const photoInputCamera = document.getElementById('photoInputCamera');
const photoInputGallery = document.getElementById('photoInputGallery');
const btnCamera  = document.getElementById('btnCamera');
const btnGallery = document.getElementById('btnGallery');

const summaryGrid   = document.getElementById('summaryGrid');
const btnSubmit     = document.getElementById('btnSubmit');
const submitText    = document.getElementById('submitText');
const submitSpinner = document.getElementById('submitSpinner');

const successOverlay = document.getElementById('successOverlay');
const successIcon    = document.querySelector('#successOverlay .success-icon');
const successTitle   = document.querySelector('#successOverlay h2');
const successDetail  = document.getElementById('successDetail');
const btnNewRecord   = document.getElementById('btnNewRecord');
const statusBadge    = document.getElementById('statusBadge');
const toast          = document.getElementById('toast');
const clock          = document.getElementById('clock');

const btnHistory      = document.getElementById('btnHistory');
const historyOverlay  = document.getElementById('historyOverlay');
const btnCloseHistory = document.getElementById('btnCloseHistory');
const historyList     = document.getElementById('historyList');

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

async function loadMachines(preselect = null) {
  machineSelect.innerHTML = '<option value="">Cargando impresoras…</option>';
  machineHint.textContent = '';
  btnNext1.disabled = true;
  state.assetId = '';

  let machines = [];

  try {
    // Carga desde la API local del servidor Node.js
    const res  = await fetch(`${API_BASE}/api/maquinas/lista`, { cache: 'no-store' });
    const json = await res.json();
    if (json.status === 'ok' && json.machines.length) {
      machines = json.machines;
    }
  } catch (_) { /* servidor no disponible */ }

  if (!machines.length) {
    machineSelect.innerHTML = '<option value="">No hay impresoras — contacta al administrador</option>';
    machineHint.textContent = '';
    return;
  }

  // Agrupar por espacio/sala
  const grouped = {};
  machines.forEach(m => {
    let space = m.space || 'Maker';
    if (!grouped[space]) grouped[space] = [];
    grouped[space].push(m);
  });

  let htmlOpts = '<option value="">Selecciona una impresora…</option>';
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
    renderPhotoGrid();
    updateStep4IfOpen();
  });
});

notes.addEventListener('input', () => {
  state.notes = notes.value.trim();
  checkStep2();
  updateStep4IfOpen();
});

btnNext2.addEventListener('click', () => {
  state.notes = notes.value.trim();
  renderPhotoGrid();
  unlock(step3);
});

/* ══════════════════════════════════════════════════════════
   STEP 3 — Photos (multi)
   ══════════════════════════════════════════════════════════ */
const btnNext3         = document.getElementById('btnNext3');
const photoGrid        = document.getElementById('photoGrid');
const photoAddContainer = document.getElementById('photoAddContainer');
const photoHint        = document.getElementById('photoHint');
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

  if (state.type === 'Mantenimiento') {
    btnNext3.disabled = false;
  } else {
    btnNext3.disabled = state.photos.length === 0;
  }
}

const cameraOverlay = document.getElementById('cameraOverlay');
const camVideo      = document.getElementById('camVideo');
const btnCamClose   = document.getElementById('btnCamClose');
const btnCamCapture = document.getElementById('btnCamCapture');
const camCanvas     = document.getElementById('camCanvas');
let stream = null;

if (btnCamera) {
  btnCamera.addEventListener('click', async () => {
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    if (isMobile) { photoInputCamera.click(); return; }

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
  if (stream) { stream.getTracks().forEach(t => t.stop()); stream = null; }
  if (cameraOverlay) { cameraOverlay.style.display = 'none'; cameraOverlay.classList.add('hidden'); }
}

if (btnCamClose)   btnCamClose.addEventListener('click', stopCamera);

if (btnCamCapture) {
  btnCamCapture.addEventListener('click', () => {
    if (!stream) return;
    if (state.photos.length >= MAX_PHOTOS) { showToast('Límite de fotos alcanzado', 'error'); stopCamera(); return; }

    const maxWidth = 1024;
    let width  = camVideo.videoWidth  || maxWidth;
    let height = camVideo.videoHeight || 768;
    if (width > maxWidth) { height = Math.round((height * maxWidth) / width); width = maxWidth; }

    camCanvas.width = width; camCanvas.height = height;
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

function compressImage(file, maxWidth = 1024, quality = 0.7) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Image decode failed')); };
    img.onload  = () => {
      URL.revokeObjectURL(url);
      let width = img.naturalWidth || img.width;
      let height = img.naturalHeight || img.height;
      if (width > maxWidth) { height = Math.round((height * maxWidth) / width); width = maxWidth; }
      const canvas = document.createElement('canvas');
      canvas.width = width; canvas.height = height;
      const ctx = canvas.getContext('2d', { alpha: false });
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, width, height);
      ctx.drawImage(img, 0, 0, width, height);
      const dataUrl = canvas.toDataURL('image/jpeg', quality);
      canvas.width = 0; canvas.height = 0;
      resolve(dataUrl);
    };
    img.src = url;
  });
}

async function handlePhotos(filesGroup, inputElement) {
  const files    = [...filesGroup];
  inputElement.value = '';
  const remaining = MAX_PHOTOS - state.photos.length;
  if (files.length > remaining) showToast(`Solo se añadieron ${remaining} foto(s) — máximo ${MAX_PHOTOS}`, 'error');
  const toAdd = files.slice(0, remaining);
  if (!toAdd.length) return;

  document.getElementById('btnGallery').disabled = true;
  document.getElementById('btnCamera').disabled  = true;

  for (const file of toAdd) {
    if (!file.type.startsWith('image/')) { showToast('Por favor selecciona solo imágenes', 'error'); continue; }
    if (file.size > 15 * 1024 * 1024)   { showToast('Una foto es demasiado grande (máx 15 MB)', 'error'); continue; }
    await new Promise(r => setTimeout(r, 60));
    try {
      const compressedB64 = await compressImage(file, 1024, 0.7);
      state.photos.push(compressedB64);
    } catch (e) { showToast('Error al leer una imagen', 'error'); }
  }

  document.getElementById('btnGallery').disabled = false;
  document.getElementById('btnCamera').disabled  = false;
  renderPhotoGrid();
  updateStep4IfOpen();
}

if (photoInputCamera) photoInputCamera.addEventListener('change', () => handlePhotos(photoInputCamera.files, photoInputCamera));
if (photoInputGallery) photoInputGallery.addEventListener('change', () => handlePhotos(photoInputGallery.files, photoInputGallery));

btnNext3.addEventListener('click', () => { buildSummary(); unlock(step4); });

/* ══════════════════════════════════════════════════════════
   STEP 4 — Summary & Submit
   ══════════════════════════════════════════════════════════ */
function buildSummary() {
  const now = new Date();
  const ts  = now.toLocaleString('es-ES', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit', second: '2-digit'
  });
  state.timestamp = now.toISOString();

  const rows = [
    { key: 'Impresora', val: state.assetId, mono: true },
    { key: 'Tipo',      val: state.type,    mono: false },
    { key: 'Timestamp', val: ts,            mono: true  },
    { key: 'Notas',     val: state.notes || '—', mono: false },
  ];

  summaryGrid.innerHTML = rows.map(r => `
    <div class="summary-row">
      <span class="summary-key">${r.key}</span>
      <span class="summary-val ${r.mono ? 'mono' : ''}">${r.val}</span>
    </div>
  `).join('');

  if (state.photos.length > 0) {
    const thumbs = state.photos.map((b, i) => `<img src="${b}" class="summary-thumb" alt="Foto ${i + 1}" />`).join('');
    summaryGrid.innerHTML += `
      <div class="summary-row">
        <span class="summary-key">Fotos</span>
        <div style="display:flex;flex-wrap:wrap;gap:6px">${thumbs}</div>
      </div>
    `;
  }
}

/* ── Submit al servidor local ────────────────────────────── */
btnSubmit.addEventListener('click', submitToServer);

async function submitToServer() {
  const payload = {
    assetId:   state.assetId,
    type:      state.type,
    notas:     state.notes,
    photos:    state.photos,
    timestamp: state.timestamp,
  };

  btnSubmit.disabled = true;
  submitText.classList.add('hidden');
  submitSpinner.classList.remove('hidden');

  successIcon.style.display  = 'none';
  successTitle.style.display = 'none';
  btnNewRecord.style.display = 'none';
  successDetail.innerHTML = '<span class="spinner" style="display:inline-block;margin-right:10px;border-color:var(--accent);border-top-color:transparent;"></span> Enviando… por favor espera';
  successOverlay.classList.remove('hidden');

  try {
    const res = await fetch(`${API_BASE}/api/incidencias`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(payload),
    });
    const json = await res.json();

    if (json.ok) {
      successIcon.style.display  = '';
      successTitle.style.display = '';
      btnNewRecord.style.display = '';
      successDetail.textContent  = `Reporte guardado en el sistema (ID: ${json.data?.id || '—'})`;
    } else {
      throw new Error(json.error || 'Error desconocido');
    }
  } catch (error) {
    successIcon.style.display  = '';
    successTitle.style.display = '';
    btnNewRecord.style.display = '';
    successDetail.textContent  = `Error al enviar: ${error.message}`;
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
  state = { assetId: '', type: '', notes: '', photos: [] };

  notes.value = '';
  typeIncidencia.classList.remove('selected');
  typeMantenimiento.classList.remove('selected');
  machineSelect.value = '';

  renderPhotoGrid();
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

  btnSubmit.disabled = false;
  submitText.classList.remove('hidden');
  submitSpinner.classList.add('hidden');

  window.scrollTo({ top: 0, behavior: 'smooth' });
}

/* ── Historial desde la API local ───────────────────────── */
let globalHistoryCache = [];

async function fetchGlobalHistory() {
  historyList.innerHTML = '<div class="history-empty"><span class="spinner" style="display:inline-block; border-color:var(--accent); border-top-color:transparent;"></span> Cargando historial...</div>';

  try {
    const res  = await fetch(`${API_BASE}/api/incidencias`, { cache: 'no-store' });
    const json = await res.json();
    if (json.status === 'ok') {
      globalHistoryCache = json.history || [];
      renderGlobalHistory();
    } else {
      throw new Error(json.error);
    }
  } catch (err) {
    globalHistoryCache = [];
    historyList.innerHTML = `<div class="history-empty" style="color:var(--danger)">Error al cargar historial: ${err.message}</div>`;
  }
}

function renderGlobalHistory() {
  const filterAsset = document.getElementById('histFilterAsset').value;
  const filterType  = document.getElementById('histFilterType').value;

  let filtered = (globalHistoryCache || []).filter(item => {
    if (filterAsset && !item.assetId.toLowerCase().includes(filterAsset.toLowerCase())) return false;
    if (filterType  && item.type !== filterType) return false;
    return true;
  });

  historyList.innerHTML = '';
  if (!filtered.length) {
    historyList.innerHTML = '<div class="history-empty">No hay registros que coincidan</div>';
    return;
  }

  filtered.forEach(item => {
    const div = document.createElement('div');
    div.className = 'history-item sent';
    div.innerHTML = `
      <div class="history-item-header">
        <span class="history-item-id">${item.assetId}</span>
      </div>
      <div class="history-item-type ${item.type && item.type.startsWith('Incidencia') ? 'type-incidencia' : 'type-mantenimiento'}">${item.type || '—'}</div>
      <div class="history-item-time" style="margin-bottom:4px;color:var(--text-3)">${item.timestamp}</div>
      ${item.notes ? `<div style="font-size:0.8rem; color:var(--text-2); margin-top:4px;">💬 ${item.notes}</div>` : ''}
      ${item.hasPhotos ? `<div style="font-size:0.75rem; color:var(--accent); margin-top:4px;">📷 Con fotos adjuntas</div>` : ''}
    `;
    historyList.appendChild(div);
  });
}

document.getElementById('histFilterAsset').addEventListener('input',  renderGlobalHistory);
document.getElementById('histFilterType').addEventListener('change', renderGlobalHistory);

btnHistory.addEventListener('click', () => {
  const histFilterAsset = document.getElementById('histFilterAsset');
  // Poblar el select de filtro con las máquinas cargadas
  const opts = [...machineSelect.options]
    .filter(o => o.value)
    .map(o => `<option value="${o.value}">${o.value}</option>`)
    .join('');
  histFilterAsset.innerHTML = '<option value="">Todas las máquinas...</option>' + opts;

  historyOverlay.classList.remove('hidden');
  fetchGlobalHistory();
});

btnCloseHistory.addEventListener('click', () => {
  historyOverlay.classList.add('hidden');
});

/* ── Lightbox ────────────────────────────────────────────── */
(function initLightbox() {
  const lightbox  = document.getElementById('lightbox');
  const lbImg     = document.getElementById('lightboxImg');
  const lbClose   = document.getElementById('lightboxClose');
  const lbPrev    = document.getElementById('lightboxPrev');
  const lbNext    = document.getElementById('lightboxNext');
  const lbCounter = document.getElementById('lightboxCounter');
  let lbUrls = [], lbIndex = 0;

  function openLightbox(urls, index) {
    lbUrls = urls; lbIndex = index;
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
  lightbox.addEventListener('click', e => { if (e.target === lightbox) closeLightbox(); });
  lbPrev.addEventListener('click', e => { e.stopPropagation(); if (lbIndex > 0) { lbIndex--; showCurrent(); } });
  lbNext.addEventListener('click', e => { e.stopPropagation(); if (lbIndex < lbUrls.length - 1) { lbIndex++; showCurrent(); } });
  document.addEventListener('keydown', e => {
    if (lightbox.classList.contains('hidden')) return;
    if (e.key === 'Escape') closeLightbox();
    if (e.key === 'ArrowLeft'  && lbIndex > 0) { lbIndex--; showCurrent(); }
    if (e.key === 'ArrowRight' && lbIndex < lbUrls.length - 1) { lbIndex++; showCurrent(); }
  });
})();

/* ── Inicialización con deep-link (?id=) ────────────────── */
(function initDeepLinks() {
  const params = new URLSearchParams(window.location.search);
  const urlId  = params.get('id') || params.get('ID');

  if (urlId && urlId.trim().length > 0) {
    const clean = urlId.trim();
    loadMachines(clean).then(() => {
      if (state.assetId) {
        step2.classList.remove('locked');
        step2.classList.add('unlocked');
        showToast(`Impresora ${clean} seleccionada`, 'ok');
      } else {
        showToast(`Impresora "${clean}" no encontrada en la lista`, 'error');
      }
      // Limpiar el parámetro de la URL
      const url = new URL(window.location);
      url.searchParams.delete('id');
      url.searchParams.delete('ID');
      window.history.replaceState({}, '', url);
    });
  } else {
    loadMachines();
  }
})();
