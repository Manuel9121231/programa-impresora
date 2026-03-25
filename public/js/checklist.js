'use strict';

// ── Estado global ─────────────────────────────────────────────────────────────
let maquinaId = null;
let maquinaData = null;
let operarioData = null;
let sesionId = null;
let checklistData = null;
let pinBuffer = '';
let estadoItems = {}; // { item_id: { completado, valor_texto } }

// ── Arranque ──────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
  const params = new URLSearchParams(window.location.search);
  maquinaId = params.get('id');

  if (!maquinaId) {
    showError('No se especificó una máquina. Escanea el QR directamente desde la máquina.');
    return;
  }

  try {
    const [maqRes, checkRes] = await Promise.all([
      apiFetch(`/api/maquina/${maquinaId}`),
      apiFetch(`/api/maquina/${maquinaId}/checklist`),
    ]);

    if (!maqRes.ok) { showError('Máquina no encontrada (ID: ' + maquinaId + ')'); return; }
    if (!checkRes.ok) { showError('Esta máquina no tiene un checklist configurado. Contacta con el administrador.'); return; }

    maquinaData = maqRes.data;
    checklistData = checkRes.data;

    // Poblar pantalla PIN
    document.getElementById('pinMaquinaNombre').textContent = maquinaData.nombre;
    document.getElementById('pinMaquinaSala').textContent = maquinaData.sala_nombre + ' · ' + maquinaData.tipo;

    showScreen('pin');
  } catch (e) {
    showError('Error de conexión con el servidor: ' + e.message);
  }
});

// ── Navegación de pantallas ───────────────────────────────────────────────────
function showScreen(name) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById('screen-' + name).classList.add('active');
}

function showError(msg) {
  document.getElementById('errorMsg').textContent = msg;
  showScreen('error');
}

// ── PIN ───────────────────────────────────────────────────────────────────────
function pinKey(digit) {
  if (pinBuffer.length >= 6) return;
  pinBuffer += digit;
  actualizarDotsPIN();
  if (pinBuffer.length >= 4) verificarPIN();
}

function pinDelete() {
  pinBuffer = pinBuffer.slice(0, -1);
  actualizarDotsPIN();
  // Limpiar error si existía
  document.getElementById('pinError').innerHTML = '';
}

function actualizarDotsPIN() {
  for (let i = 0; i < 6; i++) {
    const dot = document.getElementById('d' + i);
    if (!dot) continue;
    dot.classList.toggle('filled', i < pinBuffer.length);
  }
}

async function verificarPIN() {
  // Esperar un frame para que el usuario vea el último punto rellenado
  await new Promise(r => setTimeout(r, 200));

  const res = await apiFetch('/api/operarios/verificar-pin', {
    method: 'POST',
    body: { pin: pinBuffer },
  });

  if (res.ok) {
    operarioData = res.data;
    await iniciarSesionMantenimiento();
  } else {
    // PIN incorrecto
    document.getElementById('pinError').innerHTML =
      '<div class="error-msg">❌ PIN incorrecto. Inténtalo de nuevo.</div>';
    pinBuffer = '';
    actualizarDotsPIN();
    // Auto-limpiar el error
    setTimeout(() => { document.getElementById('pinError').innerHTML = ''; }, 2500);
  }
}

async function iniciarSesionMantenimiento() {
  const res = await apiFetch('/api/sesion/iniciar', {
    method: 'POST',
    body: { maquina_id: maquinaId, operario_id: operarioData.id },
  });

  if (!res.ok) { showError('Error al iniciar la sesión de mantenimiento.'); return; }
  sesionId = res.data.sesion_id;

  // Preparar checklist
  renderChecklist();
  showScreen('checklist');
}

// ── Checklist ─────────────────────────────────────────────────────────────────
function renderChecklist() {
  document.getElementById('checkMaquinaNombre').textContent = maquinaData.nombre;
  document.getElementById('checkSalaNombre').textContent = maquinaData.sala_nombre;
  document.getElementById('operarioNombreLabel').textContent = operarioData.nombre;

  const container = document.getElementById('checklistItems');
  const items = checklistData.items;

  // Inicializar estado
  estadoItems = {};
  items.forEach(item => {
    estadoItems[item.id] = { completado: false, valor_texto: '' };
  });

  container.innerHTML = items.map((item, i) => {
    const esCritico = item.es_critico === 1;
    const esOtros = item.categoria === 'otros';
    return `
      <div class="checklist-item ${esCritico ? 'critico' : ''} fade-up" id="item-wrap-${item.id}" style="animation-delay:${i * 0.04}s">
        <div class="item-main" onclick="toggleItem(${item.id}, ${esCritico ? 1 : 0}, ${esOtros ? 1 : 0})">
          <div class="item-check" id="item-check-${item.id}">
            <span id="item-check-icon-${item.id}"></span>
          </div>
          <div class="item-texto">
            <div class="item-desc">${item.descripcion}</div>

          </div>
        </div>
        ${esOtros ? `
          <div class="item-extras" id="item-extra-${item.id}">
            <textarea
              class="item-textarea"
              id="item-texto-${item.id}"
              placeholder="Describe aquí lo realizado o cualquier incidencia..."
              rows="3"
              oninput="guardarTextoItem(${item.id})"
            ></textarea>
          </div>
        ` : ''}
      </div>
    `;
  }).join('');

  actualizarProgreso();
}

function toggleItem(itemId, esCritico, esOtros) {
  const actual = estadoItems[itemId].completado;
  const nuevoEstado = !actual;
  estadoItems[itemId].completado = nuevoEstado;

  // Actualizar UI del ítem
  const wrap = document.getElementById('item-wrap-' + itemId);
  const check = document.getElementById('item-check-' + itemId);
  const icon = document.getElementById('item-check-icon-' + itemId);

  if (nuevoEstado) {
    wrap.classList.add('completado');
    icon.textContent = '✓';
    // Si es "Otros", mostrar campo de texto
    if (esOtros) {
      const extra = document.getElementById('item-extra-' + itemId);
      if (extra) extra.classList.add('visible');
    }
  } else {
    wrap.classList.remove('completado');
    icon.textContent = '';
    if (esOtros) {
      const extra = document.getElementById('item-extra-' + itemId);
      if (extra) extra.classList.remove('visible');
    }
  }

  // Enviar al servidor en tiempo real
  guardarItemEnServidor(itemId, nuevoEstado, estadoItems[itemId].valor_texto);

  actualizarProgreso();
}

function guardarTextoItem(itemId) {
  const textarea = document.getElementById('item-texto-' + itemId);
  if (!textarea) return;
  estadoItems[itemId].valor_texto = textarea.value;
  guardarItemEnServidor(itemId, estadoItems[itemId].completado, textarea.value);
}

async function guardarItemEnServidor(itemId, completado, valorTexto) {
  // Fire-and-forget: no bloqueamos la UI
  apiFetch(`/api/sesion/${sesionId}/item`, {
    method: 'POST',
    body: { item_id: itemId, completado, valor_texto: valorTexto || null },
  }).catch(() => {});
}

function actualizarProgreso() {
  const items = checklistData.items;
  const totalCompletos = items.filter(i => estadoItems[i.id]?.completado).length;

  const pct = items.length ? (totalCompletos / items.length * 100) : 0;
  document.getElementById('progressCount').textContent = `${totalCompletos} / ${items.length}`;
  document.getElementById('progressFill').style.width = pct.toFixed(1) + '%';

  const infoEl = document.getElementById('criticosInfo');
  infoEl.className = 'criticos-info ok';
  infoEl.textContent = totalCompletos === items.length
    ? '✅ Todos los puntos completados'
    : `📋 ${totalCompletos} de ${items.length} puntos completados`;

  // Botón siempre activo
  const btn = document.getElementById('btnEnviar');
  btn.className = 'btn-enviar activo';
  btn.textContent = '✅ Enviar mantenimiento';
  document.getElementById('btnWarning').classList.remove('visible');
  document.getElementById('obsSection').style.display = 'block';
}

async function enviarChecklist() {

  const btn = document.getElementById('btnEnviar');
  btn.disabled = true;
  btn.textContent = '⏳ Enviando...';

  const observaciones = document.getElementById('obsTextarea').value.trim();

  const res = await apiFetch(`/api/sesion/${sesionId}/completar`, {
    method: 'POST',
    body: { observaciones },
  });

  if (res.ok) {
    // Mostrar pantalla de éxito
    const totalCompletos = checklistData.items.filter(i => estadoItems[i.id]?.completado).length;
    document.getElementById('exitoMaquina').textContent = maquinaData.nombre;
    document.getElementById('exitoOperario').textContent = operarioData.nombre;
    document.getElementById('exitoFecha').textContent = new Date().toLocaleString('es-ES');
    document.getElementById('exitoPuntos').textContent = `${totalCompletos} de ${checklistData.items.length}`;
    showScreen('exito');
  } else {
    btn.disabled = false;
    btn.className = 'btn-enviar activo';
    btn.textContent = '⚠️ Error al enviar. Reintentar';
    alert('Error: ' + (res.error || 'Error al enviar el mantenimiento'));
  }
}

function reiniciar() {
  // Volver a pantalla de PIN para nuevo mantenimiento
  pinBuffer = '';
  actualizarDotsPIN();
  operarioData = null;
  sesionId = null;
  estadoItems = {};
  document.getElementById('pinError').innerHTML = '';
  showScreen('pin');
}

// ── Utilidad API ──────────────────────────────────────────────────────────────
async function apiFetch(url, options = {}) {
  const opts = {
    method: options.method || 'GET',
    headers: { 'Content-Type': 'application/json' },
  };
  if (options.body) opts.body = JSON.stringify(options.body);
  const res = await fetch(url, opts);
  return await res.json();
}
