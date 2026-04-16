'use strict';

const express = require('express');
const cors = require('cors');
const path = require('path');
const QRCode = require('qrcode');
const os = require('os');
const db = require('./database/db');

const app = express();
const PORT = 3000;

// URL del Webhook de Google Apps Script (Dejar vacío si no se usa)
const GOOGLE_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbwKp8a44WAD3prlKUFS2uZYU9ND8kKbaaWPUYnJZdBrUVYM9Vl2CfT4TdWz4DqCgVh7/exec";

app.use(cors());
app.use(express.json({ limit: '50mb' })); // Límite ampliado para fotos en base64
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(express.static(path.join(__dirname, 'public')));
// Servir la nueva interfaz de incidencias en /reporte/
app.use('/reporte', express.static(path.join(__dirname, 'public', 'reporte')));


// ── Helper: obtener IP local ────────────────────────────────────────────────
function getLocalIP() {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        return iface.address;
      }
    }
  }
  return 'localhost';
}

// ── API: Salas ──────────────────────────────────────────────────────────────
app.get('/api/salas', (req, res) => {
  try {
    res.json({ ok: true, data: db.getSalas() });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

// ── API: Máquinas ───────────────────────────────────────────────────────────
app.get('/api/maquinas', (req, res) => {
  try {
    const { sala_id } = req.query;
    res.json({ ok: true, data: db.getMaquinas(sala_id) });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

app.get('/api/maquina/:id', (req, res) => {
  try {
    const maquina = db.getMaquinaById(req.params.id);
    if (!maquina) return res.status(404).json({ ok: false, error: 'Máquina no encontrada' });
    res.json({ ok: true, data: maquina });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

app.post('/api/maquinas', (req, res) => {
  try {
    const { sala_id, nombre, tipo, modelo, frecuencia_dias, estado } = req.body;
    if (!sala_id || !nombre) return res.status(400).json({ ok: false, error: 'Sala y nombre son obligatorios' });
    const id = db.crearMaquina(req.body);
    res.json({ ok: true, data: { id } });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

app.put('/api/maquina/:id', (req, res) => {
  try {
    db.actualizarMaquina(req.params.id, req.body);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

app.delete('/api/maquina/:id', (req, res) => {
  try {
    db.eliminarMaquina(req.params.id);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

// ── API: Lista de máquinas (formato compatible nueva interfaz) ───────────────
app.get('/api/maquinas/lista', (req, res) => {
  try {
    const maquinas = db.getMaquinas();
    const lista = maquinas.map(m => ({
      id: m.nombre,
      space: m.sala_nombre ? m.sala_nombre.replace('Espacio ', '') : 'Maker',
      type: m.tipo,
      status: m.estado === 'activa' ? 'Activa' : 'Inactiva'
    }));
    res.json({ status: 'ok', machines: lista });
  } catch (e) {
    res.status(500).json({ status: 'error', error: e.message });
  }
});

// ── API: Incidencias (nueva interfaz operario) ──────────────────────────────
app.post('/api/incidencias', async (req, res) => {
  try {
    const { assetId, tipo, type, notas, notes, fotos, photos } = req.body;
    const maquinaNombre = assetId || '';
    const tipoFinal = tipo || type || 'Mantenimiento';
    const notasFinal = notas || notes || '';
    const fotosFinal = fotos || photos || [];
    if (!maquinaNombre) return res.status(400).json({ ok: false, error: 'El nombre de la máquina es obligatorio' });
    const id = db.crearIncidencia(maquinaNombre, tipoFinal, notasFinal, fotosFinal);
    res.json({ ok: true, data: { id } });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

app.get('/api/incidencias', (req, res) => {
  try {
    const filtros = {
      maquina_nombre: req.query.maquina_nombre || null,
      tipo: req.query.tipo || null,
      desde: req.query.desde || null,
      hasta: req.query.hasta || null,
    };
    const registros = db.getIncidencias(filtros);
    const history = registros.map(r => ({
      assetId: r.maquina_nombre,
      type: r.tipo,
      notes: r.notas,
      timestamp: new Date(r.timestamp).toLocaleString('es-ES'),
      photoUrls: [],
      hasPhotos: (() => { try { return JSON.parse(r.fotos || '[]').length > 0; } catch { return false; } })()
    }));
    res.json({ status: 'ok', history });
  } catch (e) {
    res.status(500).json({ status: 'error', error: e.message });
  }
});

// ── API: QR ────────────────────────────────────────────────────────────────
app.get('/api/maquina/:id/qr', async (req, res) => {
  try {
    const ip = getLocalIP();
    const maquina = db.getMaquinaById(req.params.id);
    if (!maquina) return res.status(404).json({ ok: false, error: 'Máquina no encontrada' });
    // QR apunta a la nueva interfaz de incidencias, pre-cargando la máquina por nombre
    const url = `http://${ip}:${PORT}/reporte/?id=${encodeURIComponent(maquina.nombre)}`;
    const qr = await QRCode.toDataURL(url, {
      width: 300,
      margin: 2,
      color: { dark: '#1a1a2e', light: '#ffffff' }
    });
    res.json({ ok: true, data: { qr, url } });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

// ── API: Operarios ──────────────────────────────────────────────────────────
app.get('/api/operarios', (req, res) => {
  try {
    res.json({ ok: true, data: db.getOperarios() });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

app.post('/api/operarios', (req, res) => {
  try {
    const { nombre, pin } = req.body;
    if (!nombre || !pin) return res.status(400).json({ ok: false, error: 'Nombre y PIN son obligatorios' });
    if (pin.length < 4) return res.status(400).json({ ok: false, error: 'El PIN debe tener al menos 4 dígitos' });
    const id = db.crearOperario(nombre, pin);
    res.json({ ok: true, data: { id } });
  } catch (e) {
    res.status(400).json({ ok: false, error: e.message });
  }
});

app.post('/api/operarios/verificar-pin', (req, res) => {
  try {
    const { pin } = req.body;
    const operario = db.verificarPin(pin);
    if (!operario) return res.status(401).json({ ok: false, error: 'PIN incorrecto o inactivo' });
    res.json({ ok: true, data: { id: operario.id, nombre: operario.nombre } });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

// ── API: Usuarios ────────────────────────────────────────────────────────────
app.get('/api/usuarios', (req, res) => {
  try {
    res.json({ ok: true, data: db.getUsuarios() });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

app.post('/api/usuarios', (req, res) => {
  try {
    const { nombre, email, rol } = req.body;
    if (!nombre) return res.status(400).json({ ok: false, error: 'El nombre es obligatorio' });
    const id = db.crearUsuario(nombre, email, rol);
    res.json({ ok: true, data: { id } });
  } catch (e) {
    res.status(400).json({ ok: false, error: e.message });
  }
});

app.delete('/api/usuario/:id', (req, res) => {
  try {
    db.eliminarUsuario(req.params.id);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

// ── API: Sesiones ───────────────────────────────────────────────────────────
app.post('/api/sesion/iniciar', (req, res) => {
  try {
    const { maquina_id, operario_id } = req.body;
    if (!maquina_id || !operario_id) return res.status(400).json({ ok: false, error: 'Faltan datos' });
    const sesionId = db.iniciarSesion(maquina_id, operario_id);
    res.json({ ok: true, data: { sesion_id: sesionId } });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});



app.post('/api/sesion/:id/completar', (req, res) => {
  try {
    const { observaciones } = req.body;
    db.completarSesion(req.params.id, observaciones);
    
    // Enviar datos en tiempo real a Google Sheets (Si está configurado)
    if (GOOGLE_SCRIPT_URL) {
      try {
        const detalle = db.getSesionDetalle(req.params.id);
        if (detalle && detalle.sesion) {
          const payload = {
            idsesion: detalle.sesion.id,
            fecha: detalle.sesion.completado_en,
            maquina: detalle.sesion.maquina,
            sala: detalle.sesion.sala,
            operario: detalle.sesion.operario,
            observaciones: detalle.sesion.observaciones
          };
          
          fetch(GOOGLE_SCRIPT_URL, {
            method: 'POST',
            body: JSON.stringify(payload),
            headers: { 'Content-Type': 'application/json' }
          }).catch(err => console.error('Error enviando a Google Scripts:', err.message));
        }
      } catch (err) {
        console.error('Error al preparar envío a Google Scripts:', err.message);
      }
    }

    res.json({ ok: true, message: 'Mantenimiento registrado correctamente' });
  } catch (e) {
    res.status(400).json({ ok: false, error: e.message });
  }
});

app.get('/api/sesion/:id/detalle', (req, res) => {
  try {
    const detalle = db.getSesionDetalle(req.params.id);
    if (!detalle) return res.status(404).json({ ok: false, error: 'Sesión no encontrada' });
    res.json({ ok: true, data: detalle });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

// ── API: Dashboard ──────────────────────────────────────────────────────────
app.get('/api/dashboard', (req, res) => {
  try {
    res.json({ ok: true, data: db.getDashboard() });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

// ── API: Historial ──────────────────────────────────────────────────────────
app.get('/api/historial', (req, res) => {
  try {
    const filtros = {
      sala_id: req.query.sala_id || null,
      maquina_id: req.query.maquina_id || null,
      operario_id: req.query.operario_id || null,
      desde: req.query.desde || null,
      hasta: req.query.hasta || null,
    };
    res.json({ ok: true, data: db.getHistorial(filtros) });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

// ── API: Info del servidor ──────────────────────────────────────────────────
app.get('/api/info', (req, res) => {
  const ip = getLocalIP();
  res.json({ ok: true, data: { ip, puerto: PORT, url: `http://${ip}:${PORT}` } });
});

// ── Rutas HTML ──────────────────────────────────────────────────────────────
app.get('/operario.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'operario.html'));
});

// ── Arranque ─────────────────────────────────────────────────────────────────
app.listen(PORT, '0.0.0.0', () => {
  const ip = getLocalIP();
  console.log('\n╔══════════════════════════════════════════════════╗');
  console.log('║  SISTEMA DE GESTIÓN DE IMPRESORAS Y MÁQUINAS 3D  ║');
  console.log('╚══════════════════════════════════════════════════╝');
  console.log(`\n  🖥️  Panel de administración: http://localhost:${PORT}`);
  console.log(`  📱  Nueva interfaz operario:  http://${ip}:${PORT}/reporte/?id=<NOMBRE>`);
  console.log(`  📋  Interfaz clásica (PIN):   http://${ip}:${PORT}/operario.html?id=<ID>`);
  console.log(`\n  La base de datos se guarda en: gestion.db`);
  console.log(`\n  Pulsa Ctrl+C para detener el servidor\n`);
});
