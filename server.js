'use strict';

const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const QRCode = require('qrcode');
const os = require('os');
const db = require('./database/db');

const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json({ limit: '50mb' })); // Support base64 photos
app.use(express.static(path.join(__dirname, 'public')));

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

app.put('/api/maquina/:id', (req, res) => {
  try {
    db.actualizarMaquina(req.params.id, req.body);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

// ── API: Checklist ──────────────────────────────────────────────────────────
app.get('/api/maquina/:id/checklist', (req, res) => {
  try {
    const checklist = db.getChecklistDeMaquina(req.params.id);
    if (!checklist) return res.status(404).json({ ok: false, error: 'Sin checklist configurado' });
    res.json({ ok: true, data: checklist });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

// ── API: QR ────────────────────────────────────────────────────────────────
app.get('/api/maquina/:id/qr', async (req, res) => {
  try {
    const ip = getLocalIP();
    const url = `http://${ip}:${PORT}/operario.html?id=${req.params.id}`;
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

app.post('/api/sesion/:id/item', (req, res) => {
  try {
    const { item_id, completado, valor_texto } = req.body;
    db.marcarItem(req.params.id, item_id, completado, valor_texto);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

app.post('/api/sesion/:id/completar', (req, res) => {
  try {
    const { observaciones } = req.body;
    db.completarSesion(req.params.id, observaciones);
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

// ── API V2 (Para frontend MantApp) ──────────────────────────────────────────
app.get('/api/v2/machines', (req, res) => {
  try {
    const maquinas = db.getMaquinas();
    const formatted = maquinas.map(m => ({
      id: m.id,
      space: m.sala_id || 'Maker',
      type: m.tipo,
      status: m.estado === 'activa' ? 'Activa' : 'Inactiva'
    }));
    res.json({ ok: true, data: formatted });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

app.post('/api/v2/records', (req, res) => {
  try {
    const { timestamp, assetId, type, notes, photos, pin } = req.body;
    
    // 1. Validar PIN
    const operario = db.verificarPin(pin);
    if (!operario) return res.status(401).json({ ok: false, error: 'PIN incorrecto o inactivo' });

    // 2. Iniciar sesión
    const sesionId = db.iniciarSesion(assetId, operario.id);

    // 3. Guardar fotos localmente en public/uploads
    if (photos && photos.length > 0) {
      photos.forEach((b64Str, i) => {
        const match = b64Str.match(/^data:image\/([a-zA-Z+]+);base64,(.+)$/);
        if (match && match.length === 3) {
          const buffer = Buffer.from(match[2], 'base64');
          const ext = match[1] === 'jpeg' ? 'jpg' : match[1];
          const fileName = `sesion_${sesionId}_photo_${i+1}.${ext}`;
          fs.writeFileSync(path.join(__dirname, 'public', 'uploads', fileName), buffer);
        }
      });
    }

    // 4. Completar sesión con las observaciones
    const finalObserver = `[${type.toUpperCase()}] ${notes} (Enviado vía App v2)`;
    db.completarSesion(sesionId, finalObserver);

    res.json({ ok: true, data: { id: sesionId } });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

app.get('/api/v2/history', (req, res) => {
  try {
    // Adapter to transform internal local history to v2 expected format
    const historial = db.getHistorial({}).slice(0, 100);
    const formatted = historial.map(h => ({
      id: h.id,
      assetId: h.maquina_id,
      type: h.observaciones && h.observaciones.includes('[INCIDENCIA]') ? 'Incidencia' : 'Mantenimiento',
      notes: h.observaciones || 'Sin detalles',
      timestamp: h.fecha_fin ? new Date(h.fecha_fin).toLocaleString('es-ES') : h.fecha_inicio,
      operator: h.operario_nombre,
      photoUrls: [] // Can be populated if reading from uploads directory later
    }));
    res.json({ ok: true, data: formatted });
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
  console.log(`  📱  URL para QR de operario:  http://${ip}:${PORT}/operario.html?id=<ID>`);
  console.log(`\n  La base de datos se guarda en: gestion.db`);
  console.log(`\n  Pulsa Ctrl+C para detener el servidor\n`);
});
