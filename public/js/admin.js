'use strict';

const API = '';
let datosSalas = [];
let datosMaquinas = [];
let datosOperarios = [];
let datosUsuarios = [];

let rolActual = 'admin';

// ── Simulator Roles ────────────────────────────────────────────────────────
function cambiarRolSimulado(nuevoRol) {
  rolActual = nuevoRol;
  
  // Update icon
  const iconD = { admin: '🛡️', tecnico: '🔧', usuario: '👤' };
  const icon = document.getElementById('roleIcon');
  if (icon) icon.textContent = iconD[nuevoRol] || '👤';

  // UI updates for badges and locks on sidebar
  const els = ['operarios', 'usuarios', 'qrcodes'];
  els.forEach(sect => {
    const navItem = document.getElementById('nav-' + sect);
    const badge = document.getElementById('badge-' + sect);
    if (!navItem) return;
    if (rolActual !== 'admin') {
      navItem.classList.add('locked');
      if (badge) badge.style.display = 'inline-block';
    } else {
      navItem.classList.remove('locked');
      if (badge) badge.style.display = 'none';
    }
  });

  const btnNuevaMaquina = document.getElementById('btnNuevaMaquina');
  if (btnNuevaMaquina) {
    btnNuevaMaquina.style.display = rolActual === 'admin' ? 'inline-block' : 'none';
  }

  // Re-render UI views dependent on role
  renderMaquinas(); 
  
  // Force navigation out if currently on restricted section
  const currentSection = document.querySelector('.section.active');
  if (currentSection && rolActual !== 'admin') {
    const activeId = currentSection.id;
    if (activeId === 'section-operarios' || activeId === 'section-usuarios' || activeId === 'section-qrcodes') {
      navigateTo('dashboard');
    }
  }
}


// ── Inicialización ────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
  await cargarDatosBase();
  await cargarDashboard();
  cargarInfoServidor();
  const selectRol = document.getElementById('simuladorRol');
  if (selectRol) cambiarRolSimulado(selectRol.value);
});

async function cargarDatosBase() {
  const [salas, maquinas, operarios, usuarios] = await Promise.all([
    apiFetch('/api/salas'),
    apiFetch('/api/maquinas'),
    apiFetch('/api/operarios'),
    apiFetch('/api/usuarios'),
  ]);
  datosSalas = salas.data || [];
  datosMaquinas = maquinas.data || [];
  datosOperarios = operarios.data || [];
  datosUsuarios = usuarios.data || [];

  // Poblar selects de salas
  ['filtroSalaMaquinas', 'filtroSala', 'filtroSalaQR', 'nuevoMaquinaSala'].forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    if (id !== 'nuevoMaquinaSala') {
      el.innerHTML = '<option value="">Todas las salas</option>';
    } else {
      el.innerHTML = '<option value="">Seleccione una sala...</option>';
    }
    datosSalas.forEach(s => {
      const opt = document.createElement('option');
      opt.value = s.id; opt.textContent = s.nombre;
      el.appendChild(opt);
    });
  });

  // Poblar selects operarios (historial)
  const selOp = document.getElementById('filtroOperario');
  if (selOp) {
    selOp.innerHTML = '<option value="">Todos los operarios</option>';
    datosOperarios.forEach(o => {
      const opt = document.createElement('option');
      opt.value = o.id; opt.textContent = o.nombre;
      selOp.appendChild(opt);
    });
  }

  // Actualizar badge alertas
  const alertas = datosMaquinas.filter(m =>
    m.estado_mantenimiento === 'vencido' || m.estado_mantenimiento === 'pendiente'
  ).length;
  const badge = document.getElementById('badge-alertas');
  if (alertas > 0) { badge.textContent = alertas; badge.style.display = 'inline'; }
  else badge.style.display = 'none';
}

async function cargarInfoServidor() {
  const res = await apiFetch('/api/info');
  if (res.ok) {
    document.getElementById('serverInfo').textContent = `🌐 ${res.data.ip}:${res.data.puerto}`;
  }
}

// ── Navegación ────────────────────────────────────────────────────────────────
const sectionTitles = {
  dashboard: ['Panel General', 'Resumen del sistema'],
  maquinas: ['Máquinas', 'Estado y gestión de todas las máquinas'],
  historial: ['Historial', 'Registro de mantenimientos realizados'],
  operarios: ['Operarios', 'Gestión del personal de mantenimiento'],
  usuarios: ['Usuarios', 'Gestión de usuarios del sistema'],
  qrcodes: ['Códigos QR', 'QR individuales para el operario móvil'],
};

function navigateTo(section) {
  // Verificación de roles
  const rutasRestringidas = ['operarios', 'usuarios', 'qrcodes'];
  let idToShow = section;
  
  if (rolActual !== 'admin' && rutasRestringidas.includes(section)) {
    idToShow = 'restringido';
  }

  document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));

  document.getElementById('section-' + idToShow).classList.add('active');
  if (idToShow !== 'restringido') {
    const navItem = document.getElementById('nav-' + section);
    if(navItem) navItem.classList.add('active');
  } else {
    document.getElementById('topbarTitle').textContent = 'Acceso Denegado';
    document.getElementById('topbarSubtitle').textContent = 'Sección restringida por permisos';
    return;
  }

  const [title, sub] = sectionTitles[section] || [section, ''];
  document.getElementById('topbarTitle').textContent = title;
  document.getElementById('topbarSubtitle').textContent = sub;

  // Cargar datos bajo demanda
  if (section === 'maquinas') renderMaquinas();
  if (section === 'historial') { cargarHistorial(); poblarFiltroMaquinasHistorial(); }
  if (section === 'operarios') renderOperarios();
  if (section === 'usuarios') renderUsuarios();
  if (section === 'qrcodes') renderQRs();
}

function toggleSidebar() {
  const sidebar = document.getElementById('sidebar');
  const backdrop = document.getElementById('sidebarBackdrop');
  sidebar.classList.toggle('open');
  if (backdrop) backdrop.classList.toggle('open');
}

// ── Dashboard ─────────────────────────────────────────────────────────────────
async function cargarDashboard() {
  const res = await apiFetch('/api/dashboard');
  if (!res.ok) return;
  const d = res.data;

  document.getElementById('kpi-hoy').textContent = d.hoy;
  document.getElementById('kpi-semana').textContent = d.semana;
  document.getElementById('kpi-pendientes').textContent = d.pendientes;
  document.getElementById('kpi-proximos').textContent = d.proximos;

  // Gráfica de días
  renderBarChart('chartDias', d.porDia.slice(-14).map(r => ({
    label: formatFechaDia(r.dia), value: r.total
  })));

  // Gráfica de máquinas
  const maqData = d.porMaquina.map(r => ({ label: r.nombre, value: r.total_sesiones }));
  renderBarChart('chartMaquinas', maqData.slice(0, 12));

  // Últimos mantenimientos
  const histRes = await apiFetch('/api/historial?');
  if (histRes.ok) renderUltimosMantenimientos(histRes.data.slice(0, 8));
}

function renderBarChart(containerId, items) {
  const container = document.getElementById(containerId);
  if (!container || !items.length) {
    container.innerHTML = '<div class="empty-state" style="padding:24px"><div class="icon">📊</div><p>Sin datos aún</p></div>';
    return;
  }
  const max = Math.max(...items.map(i => i.value), 1);
  container.innerHTML = items.map(i => `
    <div class="chart-bar-row">
      <div class="chart-bar-label" title="${i.label}">${truncate(i.label, 12)}</div>
      <div class="chart-bar-track">
        <div class="chart-bar-fill" style="width:${(i.value / max * 100).toFixed(1)}%"></div>
      </div>
      <div class="chart-bar-val">${i.value}</div>
    </div>
  `).join('');
}

function renderUltimosMantenimientos(registros) {
  const tbody = document.getElementById('dashboardUltimos');
  if (!registros.length) {
    tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;color:var(--text-muted);padding:24px">Sin mantenimientos aún</td></tr>';
    return;
  }
  tbody.innerHTML = registros.map(r => `
    <tr>
      <td data-label="Máquina"><span class="fw-600">${r.maquina}</span></td>
      <td data-label="Sala"><span class="text-muted">${r.sala}</span></td>
      <td data-label="Operario">${r.operario}</td>
      <td data-label="Fecha y hora">${formatFechaHora(r.completado_en)}</td>
      <td data-label="Estado"><span class="estado-badge ok">✅ Completado</span></td>
    </tr>
  `).join('');
}

// ── Máquinas ──────────────────────────────────────────────────────────────────
function renderMaquinas() {
  const salaFiltro = document.getElementById('filtroSalaMaquinas').value;
  const lista = salaFiltro
    ? datosMaquinas.filter(m => String(m.sala_id) === String(salaFiltro))
    : datosMaquinas;

  const grid = document.getElementById('gridMaquinas');
  if (!lista.length) {
    grid.innerHTML = '<div class="empty-state"><div class="icon">🖨️</div><p>No hay máquinas en esta sala</p></div>';
    return;
  }

  // Clasificar máquinas por espacio dinámicamente según la base de datos
  function tarjetaMaquina(m) {
    const estadoLabel = {
      ok: '✅ Al día',
      proximo: '⚠️ Próximo',
      vencido: '🚨 Vencido',
      pendiente: '🔴 Pendiente',
    }[m.estado_mantenimiento] || m.estado_mantenimiento;

    const ultimo = m.ultimo_mantenimiento
      ? `Último: ${formatFechaHora(m.ultimo_mantenimiento)}`
      : 'Sin mantenimiento registrado';

    return `
      <div class="maquina-card fade-in">
        <div class="maquina-header">
          <div>
            <div class="maquina-nombre">${m.nombre}</div>
            <div class="maquina-tipo">${m.tipo}</div>
          </div>
          <span class="estado-badge ${m.estado_mantenimiento}">${estadoLabel}</span>
        </div>
        <div class="maquina-info">
          <span>🏭 ${m.sala_nombre}</span>
          <span>⚙️ ${m.modelo || 'Sin modelo'}</span>
          <span>📅 Frecuencia: cada ${m.frecuencia_dias} días</span>
          <span>🕐 ${ultimo}</span>
        </div>
        <div class="maquina-actions">
          ${rolActual === 'admin' ? `
            <button class="btn btn-primary btn-sm" onclick="verQR(${m.id}, '${escapar(m.nombre)}', '${escapar(m.sala_nombre)}')">📱 QR</button>
            <button class="btn btn-outline btn-sm" onclick="editarMaquina(${m.id})">✏️ Editar</button>
            <button class="btn btn-outline btn-sm" style="color:var(--danger);border-color:var(--danger);padding:4px 8px" onclick="eliminarMaquina(${m.id})" title="Eliminar máquina">🗑️</button>
          ` : `
            <button class="btn btn-primary btn-sm" onclick="verQR(${m.id}, '${escapar(m.nombre)}', '${escapar(m.sala_nombre)}')">📱 QR</button>
          `}
        </div>
      </div>
    `;
  }

  function seccionEspacio(titulo, icono, color, maquinas) {
    if (!maquinas.length) return '';
    return `
      <div class="espacio-section" style="margin-bottom:32px">
        <div class="espacio-header" style="display:flex;align-items:center;gap:10px;margin-bottom:16px;padding:12px 16px;background:${color};border-radius:12px;border-left:4px solid var(--primary)">
          <span style="font-size:22px">${icono}</span>
          <div>
            <div style="font-size:16px;font-weight:700;color:var(--text-primary)">${titulo}</div>
            <div style="font-size:12px;color:var(--text-muted)">${maquinas.length} máquina${maquinas.length !== 1 ? 's' : ''}</div>
          </div>
        </div>
        <div class="grid-maquinas-inner">
          ${maquinas.map(tarjetaMaquina).join('')}
        </div>
      </div>
    `;
  }

  let htmlResult = '';
  const bgColors = ['rgba(79,142,247,0.08)', 'rgba(16,185,129,0.08)', 'rgba(245,158,11,0.08)', 'rgba(139,92,246,0.08)', 'rgba(236,72,153,0.08)'];
  const iconos = ['🛠️', '🤖', '🖨️', '⚙️', '🏗️'];

  datosSalas.forEach((sala, index) => {
    // Si hay un filtro y no es esta sala, la ignoramos
    if (salaFiltro && String(sala.id) !== String(salaFiltro)) return;

    const maquinasSala = lista.filter(m => m.sala_id === sala.id);
    if (maquinasSala.length > 0) {
      const color = bgColors[index % bgColors.length];
      const icono = iconos[index % iconos.length];
      htmlResult += seccionEspacio(sala.nombre, icono, color, maquinasSala);
    }
  });

  const maquinasSinSala = lista.filter(m => !m.sala_id);
  if (maquinasSinSala.length > 0) {
    htmlResult += seccionEspacio('Otras Máquinas', '🖨️', 'rgba(107,114,128,0.08)', maquinasSinSala);
  }

  grid.innerHTML = htmlResult;
}

function filtrarMaquinas() { renderMaquinas(); }

async function editarMaquina(id) {
  const maq = datosMaquinas.find(m => m.id === id);
  if (!maq) return;
  document.getElementById('editMaquinaId').value = id;
  document.getElementById('editNombre').value = maq.nombre;
  document.getElementById('editTipo').value = maq.tipo;
  document.getElementById('editModelo').value = maq.modelo || '';
  document.getElementById('editFrecuencia').value = maq.frecuencia_dias;
  document.getElementById('editEstado').value = maq.estado;
  abrirModal('modalMaquina');
}

async function guardarMaquina() {
  const id = document.getElementById('editMaquinaId').value;
  const datos = {
    nombre: document.getElementById('editNombre').value.trim(),
    tipo: document.getElementById('editTipo').value,
    modelo: document.getElementById('editModelo').value.trim(),
    frecuencia_dias: parseInt(document.getElementById('editFrecuencia').value),
    estado: document.getElementById('editEstado').value,
  };
  if (!datos.nombre) return;
  showLoader(true);
  const res = await apiFetch(`/api/maquina/${id}`, { method: 'PUT', body: datos });
  showLoader(false);
  if (res.ok) {
    cerrarModal('modalMaquina');
    await cargarDatosBase();
    renderMaquinas();
  }
}

function abrirModalNuevaMaquina() {
  document.getElementById('nuevoMaquinaNombre').value = '';
  document.getElementById('nuevoMaquinaModelo').value = '';
  document.getElementById('nuevoMaquinaTipo').value = 'Impresora FDM';
  document.getElementById('nuevoMaquinaFrecuencia').value = '7';
  document.getElementById('msgNuevaMaquina').innerHTML = '';
  abrirModal('modalNuevaMaquina');
}

async function crearMaquina() {
  const nombre = document.getElementById('nuevoMaquinaNombre').value.trim();
  const sala_id = document.getElementById('nuevoMaquinaSala').value;
  const tipo = document.getElementById('nuevoMaquinaTipo').value;
  const frecuencia_dias = document.getElementById('nuevoMaquinaFrecuencia').value;
  const modelo = document.getElementById('nuevoMaquinaModelo').value.trim();
  const msg = document.getElementById('msgNuevaMaquina');

  if (!nombre || !sala_id) {
    msg.innerHTML = '<div class="alert alert-warning">⚠️ Nombre y Sala son obligatorios</div>';
    return;
  }

  showLoader(true);
  const res = await apiFetch('/api/maquinas', { 
    method: 'POST', 
    body: { nombre, sala_id, tipo, frecuencia_dias, modelo } 
  });
  showLoader(false);

  if (res.ok) {
    cerrarModal('modalNuevaMaquina');
    await cargarDatosBase();
    renderMaquinas();
  } else {
    msg.innerHTML = `<div class="alert alert-danger">❌ ${res.error}</div>`;
  }
}

async function eliminarMaquina(id) {
  if (!confirm('¿Estás seguro de que deseas eliminar esta máquina por completo? Se borrarán también sus registros de mantenimiento.')) return;
  showLoader(true);
  const res = await apiFetch(`/api/maquina/${id}`, { method: 'DELETE' });
  showLoader(false);
  if (res.ok) {
    await cargarDatosBase();
    renderMaquinas();
  } else {
    alert('Error al eliminar: ' + res.error);
  }
}

// ── QR Codes ──────────────────────────────────────────────────────────────────
function renderQRs() {
  const salaFiltro = document.getElementById('filtroSalaQR').value;
  const lista = salaFiltro
    ? datosMaquinas.filter(m => String(m.sala_id) === String(salaFiltro))
    : datosMaquinas;

  const grid = document.getElementById('gridQRs');
  grid.innerHTML = lista.map(m => `
    <div class="maquina-card fade-in" style="cursor:pointer" onclick="verQR(${m.id}, '${escapar(m.nombre)}', '${escapar(m.sala_nombre)}')">
      <div class="maquina-header">
        <div>
          <div class="maquina-nombre">${m.nombre}</div>
          <div class="maquina-tipo">${m.sala_nombre} · ${m.tipo}</div>
        </div>
        <span style="font-size:32px">📱</span>
      </div>
      <div style="text-align:center;padding:8px 0;color:var(--text-muted);font-size:13px">
        Haz clic para ver el código QR
      </div>
    </div>
  `).join('');
}

function filtrarQRs() { renderQRs(); }

async function verQR(id, nombre, sala) {
  document.getElementById('qrNombre').textContent = nombre;
  document.getElementById('qrSala').textContent = sala;
  document.getElementById('qrImg').src = '';
  document.getElementById('qrUrl').textContent = 'Generando QR...';
  abrirModal('modalQR');

  const res = await apiFetch(`/api/maquina/${id}/qr`);
  if (res.ok) {
    document.getElementById('qrImg').src = res.data.qr;
    document.getElementById('qrUrl').textContent = res.data.url;
  }
}

function imprimirQR() {
  const nombre = document.getElementById('qrNombre').textContent;
  const sala = document.getElementById('qrSala').textContent;
  const img = document.getElementById('qrImg').src;
  const url = document.getElementById('qrUrl').textContent;
  const w = window.open('', '_blank');
  w.document.write(`<!DOCTYPE html><html><head><title>QR - ${nombre}</title>
    <style>body{font-family:sans-serif;text-align:center;padding:40px}
    h2{margin-bottom:4px}p{color:#666;font-size:14px;margin-bottom:20px}
    img{border:3px solid #000;border-radius:8px;width:220px}
    .url{font-size:11px;color:#999;margin-top:16px;word-break:break-all}
    </style></head><body>
    <h2>${nombre}</h2><p>${sala}</p>
    <img src="${img}">
    <div class="url">${url}</div>
    </body></html>`);
  w.document.close();
  setTimeout(() => w.print(), 500);
}

// ── Historial ─────────────────────────────────────────────────────────────────
async function poblarFiltroMaquinasHistorial() {
  const sel = document.getElementById('filtroMaquina');
  sel.innerHTML = '<option value="">Todas las máquinas</option>';
  datosMaquinas.forEach(m => {
    const opt = document.createElement('option');
    opt.value = m.id; opt.textContent = `${m.nombre} (${m.sala_nombre})`;
    sel.appendChild(opt);
  });
}

async function cargarHistorial() {
  const params = new URLSearchParams();
  const sala = document.getElementById('filtroSala').value;
  const maquina = document.getElementById('filtroMaquina').value;
  const operario = document.getElementById('filtroOperario').value;
  const desde = document.getElementById('filtroDesde').value;
  const hasta = document.getElementById('filtroHasta').value;

  if (sala) params.set('sala_id', sala);
  if (maquina) params.set('maquina_id', maquina);
  if (operario) params.set('operario_id', operario);
  if (desde) params.set('desde', desde);
  if (hasta) params.set('hasta', hasta);

  const res = await apiFetch('/api/historial?' + params.toString());
  const tbody = document.getElementById('tablaHistorial');
  const empty = document.getElementById('historialEmpty');

  if (!res.ok || !res.data.length) {
    tbody.innerHTML = '';
    empty.style.display = 'block';
    return;
  }
  empty.style.display = 'none';

  tbody.innerHTML = res.data.map(r => `
    <tr>
      <td data-label="#" class="text-muted">#${r.id}</td>
      <td data-label="Máquina"><span class="fw-600">${r.maquina}</span><br><span class="text-muted" style="font-size:11px">${r.tipo_maquina}</span></td>
      <td data-label="Sala">${r.sala}</td>
      <td data-label="Operario">${r.operario}</td>
      <td data-label="Inicio" style="font-size:12px">${formatFechaHora(r.iniciado_en)}</td>
      <td data-label="Fin" style="font-size:12px">${formatFechaHora(r.completado_en)}</td>
      <td data-label="Observ." style="font-size:12px;color:var(--text-muted)">${r.observaciones || '–'}</td>
      <td data-label="Acciones"><button class="btn btn-outline btn-sm" onclick="verDetalleSesion(${r.id})">Detalle</button></td>
    </tr>
  `).join('');
}

async function verDetalleSesion(id) {
  const res = await apiFetch(`/api/sesion/${id}/detalle`);
  if (!res.ok) return;
  const { sesion, items } = res.data;
  const content = document.getElementById('detalleContenido');

  content.innerHTML = `
    <div style="background:var(--bg-secondary);border-radius:8px;padding:14px;margin-bottom:16px;font-size:13px">
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
        <div><span class="text-muted">Máquina:</span> <strong>${sesion.maquina}</strong></div>
        <div><span class="text-muted">Sala:</span> ${sesion.sala}</div>
        <div><span class="text-muted">Operario:</span> ${sesion.operario}</div>
        <div><span class="text-muted">Inicio:</span> ${formatFechaHora(sesion.iniciado_en)}</div>
        <div><span class="text-muted">Fin:</span> ${formatFechaHora(sesion.completado_en)}</div>
      </div>
      ${sesion.observaciones ? `<div style="margin-top:8px"><span class="text-muted">Observaciones:</span> ${sesion.observaciones}</div>` : ''}
    </div>
  `;
  abrirModal('modalDetalle');
}

function exportarCSV() {
  apiFetch('/api/historial').then(res => {
    if (!res.ok) return;
    const rows = [['ID', 'Máquina', 'Sala', 'Operario', 'Inicio', 'Fin', 'Observaciones']];
    res.data.forEach(r => {
      rows.push([r.id, r.maquina, r.sala, r.operario, r.iniciado_en, r.completado_en, r.observaciones || '']);
    });
    const csv = rows.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `historial_mantenimiento_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
  });
}

// ── Operarios ─────────────────────────────────────────────────────────────────
function renderOperarios() {
  const tbody = document.getElementById('tablaOperarios');
  tbody.innerHTML = datosOperarios.map(o => `
    <tr>
      <td data-label="ID" class="text-muted">#${o.id}</td>
      <td data-label="Nombre"><span class="fw-600">${o.nombre}</span></td>
      <td data-label="PIN">
        <span style="background:var(--bg-secondary);padding:4px 10px;border-radius:6px;font-family:monospace;font-size:13px;letter-spacing:0.1em">****</span>
      </td>
      <td data-label="Estado"><span class="estado-badge ok">✅ Activo</span></td>
      <td data-label="Alta" style="font-size:12px;color:var(--text-muted)">${formatFechaHora(o.creado_en)}</td>
    </tr>
  `).join('');
}

function abrirModalOperario() {
  document.getElementById('nuevoNombre').value = '';
  document.getElementById('nuevoPin').value = '';
  document.getElementById('msgOperario').innerHTML = '';
  abrirModal('modalOperario');
}

async function crearOperario() {
  const nombre = document.getElementById('nuevoNombre').value.trim();
  const pin = document.getElementById('nuevoPin').value.trim();
  const msg = document.getElementById('msgOperario');

  if (!nombre || !pin) {
    msg.innerHTML = '<div class="alert alert-warning">⚠️ Completa todos los campos</div>';
    return;
  }
  if (!/^\d{4,6}$/.test(pin)) {
    msg.innerHTML = '<div class="alert alert-danger">❌ El PIN debe ser numérico de 4-6 dígitos</div>';
    return;
  }

  showLoader(true);
  const res = await apiFetch('/api/operarios', { method: 'POST', body: { nombre, pin } });
  showLoader(false);

  if (res.ok) {
    cerrarModal('modalOperario');
    await cargarDatosBase();
    renderOperarios();
  } else {
    msg.innerHTML = `<div class="alert alert-danger">❌ ${res.error}</div>`;
  }
}

// ── Usuarios ──────────────────────────────────────────────────────────────────
const ROL_BADGES = {
  admin:   { label: '🛡️ Administrador', cls: 'azul' },
  tecnico: { label: '🔧 Técnico', cls: 'verde' },
  usuario: { label: '👤 Usuario', cls: '' },
};

function renderUsuarios() {
  const tbody = document.getElementById('tablaUsuarios');
  const empty = document.getElementById('usuariosEmpty');
  const lista = datosUsuarios.filter(u => u.activo);
  if (!lista.length) {
    tbody.innerHTML = '';
    empty.style.display = 'block';
    return;
  }
  empty.style.display = 'none';
  tbody.innerHTML = lista.map(u => {
    const rol = ROL_BADGES[u.rol] || { label: u.rol, cls: '' };
    return `
    <tr>
      <td data-label="ID" class="text-muted">#${u.id}</td>
      <td data-label="Nombre"><span class="fw-600">${u.nombre}</span></td>
      <td data-label="Email" style="font-size:13px;color:var(--text-secondary)">${u.email || '–'}</td>
      <td data-label="Rol"><span class="estado-badge ${rol.cls}">${rol.label}</span></td>
      <td data-label="Estado"><span class="estado-badge ok">✅ Activo</span></td>
      <td data-label="Alta" style="font-size:12px;color:var(--text-muted)">${formatFechaHora(u.creado_en)}</td>
      <td data-label="Acciones"><button class="btn btn-outline btn-sm" onclick="eliminarUsuarioAdmin(${u.id})" title="Desactivar usuario">🗑️</button></td>
    </tr>
  `;
  }).join('');
}

function abrirModalUsuario() {
  document.getElementById('nuevoUsuarioNombre').value = '';
  document.getElementById('nuevoUsuarioEmail').value = '';
  document.getElementById('nuevoUsuarioRol').value = 'usuario';
  document.getElementById('msgUsuario').innerHTML = '';
  abrirModal('modalUsuario');
}

async function crearUsuario() {
  const nombre = document.getElementById('nuevoUsuarioNombre').value.trim();
  const email = document.getElementById('nuevoUsuarioEmail').value.trim();
  const rol = document.getElementById('nuevoUsuarioRol').value;
  const msg = document.getElementById('msgUsuario');

  if (!nombre) {
    msg.innerHTML = '<div class="alert alert-warning">⚠️ El nombre es obligatorio</div>';
    return;
  }

  showLoader(true);
  const res = await apiFetch('/api/usuarios', { method: 'POST', body: { nombre, email, rol } });
  showLoader(false);

  if (res.ok) {
    cerrarModal('modalUsuario');
    await cargarDatosBase();
    renderUsuarios();
  } else {
    msg.innerHTML = `<div class="alert alert-danger">❌ ${res.error}</div>`;
  }
}

async function eliminarUsuarioAdmin(id) {
  if (!confirm('¿Desactivar este usuario?')) return;
  showLoader(true);
  const res = await apiFetch(`/api/usuario/${id}`, { method: 'DELETE' });
  showLoader(false);
  if (res.ok) {
    await cargarDatosBase();
    renderUsuarios();
  }
}

// ── Utilidades ────────────────────────────────────────────────────────────────
async function apiFetch(url, options = {}) {
  try {
    const opts = { method: options.method || 'GET', headers: { 'Content-Type': 'application/json' } };
    if (options.body) opts.body = JSON.stringify(options.body);
    const res = await fetch(url, opts);
    return await res.json();
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

function abrirModal(id) { document.getElementById(id).classList.add('open'); }
function cerrarModal(id) { document.getElementById(id).classList.remove('open'); }

function showLoader(show) {
  document.getElementById('loaderOverlay').classList.toggle('show', show);
}

function formatFechaHora(str) {
  if (!str) return '–';
  const d = new Date(str);
  return d.toLocaleDateString('es-ES') + ' ' + d.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
}

function formatFechaDia(str) {
  if (!str) return '–';
  const [y, m, d] = str.split('-');
  return `${d}/${m}`;
}

function truncate(str, len) {
  return str.length > len ? str.slice(0, len) + '…' : str;
}

function escapar(str) {
  return String(str).replace(/'/g, "\\'");
}

async function recargarTodo() {
  showLoader(true);
  await cargarDatosBase();
  await cargarDashboard();
  showLoader(false);
}

// Cerrar modal al hacer clic fuera
document.querySelectorAll('.overlay').forEach(ov => {
  ov.addEventListener('click', e => {
    if (e.target === ov) ov.classList.remove('open');
  });
});

// Responsive
if (window.innerWidth < 768) {
  document.getElementById('btnMenuMobile').style.display = 'flex';
}
