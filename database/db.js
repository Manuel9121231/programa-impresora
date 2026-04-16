'use strict';

const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const DB_PATH = path.join(__dirname, 'gestion.db');

let db;

function getDb() {
  if (!db) {
    db = new Database(DB_PATH);
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
    inicializarEsquema();
  }
  return db;
}

function inicializarEsquema() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS salas (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nombre TEXT NOT NULL,
      descripcion TEXT,
      creado_en DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS maquinas (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      sala_id INTEGER NOT NULL,
      nombre TEXT NOT NULL,
      tipo TEXT DEFAULT 'Impresora 3D',
      modelo TEXT,
      numero_serie TEXT,
      estado TEXT DEFAULT 'activa',
      ultimo_mantenimiento DATETIME,
      frecuencia_dias INTEGER DEFAULT 7,
      creado_en DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (sala_id) REFERENCES salas(id)
    );

    CREATE TABLE IF NOT EXISTS operarios (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nombre TEXT NOT NULL,
      pin TEXT NOT NULL UNIQUE,
      activo INTEGER DEFAULT 1,
      creado_en DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS usuarios (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nombre TEXT NOT NULL,
      email TEXT UNIQUE,
      rol TEXT DEFAULT 'usuario',
      activo INTEGER DEFAULT 1,
      creado_en DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS sesiones_mantenimiento (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      maquina_id INTEGER NOT NULL,
      operario_id INTEGER NOT NULL,
      estado TEXT DEFAULT 'en_progreso',
      observaciones TEXT,
      iniciado_en DATETIME DEFAULT CURRENT_TIMESTAMP,
      completado_en DATETIME,
      FOREIGN KEY (maquina_id) REFERENCES maquinas(id),
      FOREIGN KEY (operario_id) REFERENCES operarios(id)
    );

    CREATE TABLE IF NOT EXISTS incidencias (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      maquina_nombre TEXT NOT NULL,
      maquina_id INTEGER,
      tipo TEXT NOT NULL,
      notas TEXT,
      fotos TEXT DEFAULT '[]',
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (maquina_id) REFERENCES maquinas(id)
    );
  `);

  // Insertar datos de ejemplo si la base está vacía
  const salasCount = db.prepare('SELECT COUNT(*) as c FROM salas').get();
  if (salasCount.c === 0) {
    insertarDatosIniciales();
  }
}

function insertarDatosIniciales() {
  const insertSala = db.prepare('INSERT INTO salas (nombre, descripcion) VALUES (?, ?)');
  const sala1 = insertSala.run('Espacio Maker', 'Espacio Maker – Impresoras A-01 a A-10');
  const sala2 = insertSala.run('Espacio Robot', 'Espacio Robot – Impresoras B-01 a B-04');

  const maquinas = [
    // Espacio Maker (A-01 a A-10)
    { sala: sala1.lastInsertRowid, nombre: 'Impresora A-01', tipo: 'Impresora FDM', modelo: 'Prusa MK4', estado: 'activa' },
    { sala: sala1.lastInsertRowid, nombre: 'Impresora A-02', tipo: 'Impresora FDM', modelo: 'Prusa MK4', estado: 'activa' },
    { sala: sala1.lastInsertRowid, nombre: 'Impresora A-03', tipo: 'Impresora FDM', modelo: 'Prusa MK4', estado: 'activa' },
    { sala: sala1.lastInsertRowid, nombre: 'Impresora A-04', tipo: 'Impresora FDM', modelo: 'Prusa MK4', estado: 'activa' },
    { sala: sala1.lastInsertRowid, nombre: 'Impresora A-05', tipo: 'Impresora FDM', modelo: 'Prusa MK4', estado: 'activa' },
    { sala: sala1.lastInsertRowid, nombre: 'Impresora A-06', tipo: 'Impresora FDM', modelo: 'Prusa MK4', estado: 'activa' },
    { sala: sala1.lastInsertRowid, nombre: 'Impresora A-07', tipo: 'Impresora FDM', modelo: 'Prusa MK4', estado: 'activa' },
    { sala: sala1.lastInsertRowid, nombre: 'Impresora A-08', tipo: 'Impresora FDM', modelo: 'Prusa MK4', estado: 'activa' },
    { sala: sala1.lastInsertRowid, nombre: 'Impresora A-09', tipo: 'Impresora FDM', modelo: 'Prusa MK4', estado: 'inactiva' },
    { sala: sala1.lastInsertRowid, nombre: 'Impresora A-10', tipo: 'Impresora FDM', modelo: 'Prusa MK4', estado: 'inactiva' },
    
    // Espacio Robot (B-01 a B-04)
    { sala: sala2.lastInsertRowid, nombre: 'Impresora B-01', tipo: 'Impresora FDM', modelo: 'Bambu Lab X1', estado: 'activa' },
    { sala: sala2.lastInsertRowid, nombre: 'Impresora B-02', tipo: 'Impresora FDM', modelo: 'Bambu Lab X1', estado: 'activa' },
    { sala: sala2.lastInsertRowid, nombre: 'Impresora B-03', tipo: 'Impresora FDM', modelo: 'Bambu Lab X1', estado: 'activa' },
    { sala: sala2.lastInsertRowid, nombre: 'Impresora B-04', tipo: 'Impresora FDM', modelo: 'Bambu Lab X1', estado: 'inactiva' },
  ];

  const insertMaquina = db.prepare(
    'INSERT INTO maquinas (sala_id, nombre, tipo, modelo, estado) VALUES (?, ?, ?, ?, ?)'
  );

  for (const m of maquinas) {
    insertMaquina.run(m.sala, m.nombre, m.tipo, m.modelo, m.estado);
  }

  // Operarios de ejemplo
  const insertOperario = db.prepare('INSERT INTO operarios (nombre, pin) VALUES (?, ?)');
  insertOperario.run('Admin', '0000');
  insertOperario.run('Carlos García', '1234');
  insertOperario.run('María López', '5678');
  insertOperario.run('Juan Martínez', '9012');

  // Usuarios de prueba
  const insertUsuario = db.prepare('INSERT INTO usuarios (nombre, email, rol) VALUES (?, ?, ?)');
  insertUsuario.run('Administrador', 'admin@estacion.es', 'admin');
  insertUsuario.run('Carlos García', 'carlos@estacion.es', 'usuario');
  insertUsuario.run('María López', 'maria@estacion.es', 'usuario');
  insertUsuario.run('Juan Martínez', 'juan@estacion.es', 'usuario');

  console.log('✅ Base de datos inicializada con datos de ejemplo');
}

// ─── Funciones de consulta ────────────────────────────────────────────────────

function getSalas() {
  return getDb().prepare('SELECT * FROM salas ORDER BY nombre').all();
}

function getMaquinas(salaId) {
  const db = getDb();
  let query = `
    SELECT m.*, s.nombre as sala_nombre,
      CASE
        WHEN m.ultimo_mantenimiento IS NULL THEN 'pendiente'
        WHEN julianday('now') - julianday(m.ultimo_mantenimiento) > m.frecuencia_dias THEN 'vencido'
        WHEN julianday('now') - julianday(m.ultimo_mantenimiento) > m.frecuencia_dias * 0.8 THEN 'proximo'
        ELSE 'ok'
      END as estado_mantenimiento
    FROM maquinas m
    JOIN salas s ON s.id = m.sala_id
  `;
  if (salaId) {
    return db.prepare(query + ' WHERE m.sala_id = ? ORDER BY m.nombre').all(salaId);
  }
  return db.prepare(query + ' ORDER BY s.nombre, m.nombre').all();
}

function getMaquinaById(id) {
  return getDb().prepare(`
    SELECT m.*, s.nombre as sala_nombre,
      CASE
        WHEN m.ultimo_mantenimiento IS NULL THEN 'pendiente'
        WHEN julianday('now') - julianday(m.ultimo_mantenimiento) > m.frecuencia_dias THEN 'vencido'
        WHEN julianday('now') - julianday(m.ultimo_mantenimiento) > m.frecuencia_dias * 0.8 THEN 'proximo'
        ELSE 'ok'
      END as estado_mantenimiento
    FROM maquinas m
    JOIN salas s ON s.id = m.sala_id
    WHERE m.id = ?
  `).get(id);
}



function verificarPin(pin) {
  return getDb().prepare('SELECT * FROM operarios WHERE pin = ? AND activo = 1').get(pin);
}

function iniciarSesion(maquinaId, operarioId) {
  const db = getDb();
  // Cerrar sesiones en progreso viejas de la misma máquina
  db.prepare(`
    UPDATE sesiones_mantenimiento SET estado = 'abandonada'
    WHERE maquina_id = ? AND estado = 'en_progreso'
  `).run(maquinaId);

  const result = db.prepare(
    'INSERT INTO sesiones_mantenimiento (maquina_id, operario_id) VALUES (?, ?)'
  ).run(maquinaId, operarioId);

  return result.lastInsertRowid;
}



function completarSesion(sesionId, observaciones) {
  const db = getDb();

  const sesion = db.prepare('SELECT * FROM sesiones_mantenimiento WHERE id = ?').get(sesionId);
  if (!sesion) throw new Error('Sesión no encontrada');

  if (!observaciones || observaciones.trim() === '') {
    throw new Error('El reporte del problema es obligatorio');
  }

  db.prepare(`
    UPDATE sesiones_mantenimiento
    SET estado = 'completada', observaciones = ?, completado_en = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(observaciones.trim(), sesionId);

  db.prepare(
    'UPDATE maquinas SET ultimo_mantenimiento = CURRENT_TIMESTAMP WHERE id = ?'
  ).run(sesion.maquina_id);

  return true;
}

function getDashboard() {
  const db = getDb();
  const hoy = db.prepare(`
    SELECT COUNT(*) as total FROM sesiones_mantenimiento
    WHERE estado = 'completada' AND date(completado_en) = date('now')
  `).get();

  const semana = db.prepare(`
    SELECT COUNT(*) as total FROM sesiones_mantenimiento
    WHERE estado = 'completada' AND completado_en >= datetime('now', '-7 days')
  `).get();

  const pendientes = db.prepare(`
    SELECT COUNT(*) as total FROM maquinas
    WHERE estado = 'activa' AND (
      ultimo_mantenimiento IS NULL OR
      julianday('now') - julianday(ultimo_mantenimiento) > frecuencia_dias
    )
  `).get();

  const proximos = db.prepare(`
    SELECT COUNT(*) as total FROM maquinas
    WHERE estado = 'activa' AND ultimo_mantenimiento IS NOT NULL AND
      julianday('now') - julianday(ultimo_mantenimiento) > frecuencia_dias * 0.8 AND
      julianday('now') - julianday(ultimo_mantenimiento) <= frecuencia_dias
  `).get();

  const porDia = db.prepare(`
    SELECT date(completado_en) as dia, COUNT(*) as total
    FROM sesiones_mantenimiento
    WHERE estado = 'completada' AND completado_en >= datetime('now', '-30 days')
    GROUP BY dia ORDER BY dia
  `).all();

  const porMaquina = db.prepare(`
    SELECT m.nombre, m.tipo, s.nombre as sala, COUNT(sm.id) as total_sesiones,
      MAX(sm.completado_en) as ultimo_mantenimiento
    FROM maquinas m
    LEFT JOIN salas s ON s.id = m.sala_id
    LEFT JOIN sesiones_mantenimiento sm ON sm.maquina_id = m.id AND sm.estado = 'completada'
    GROUP BY m.id ORDER BY s.nombre, m.nombre
  `).all();

  return { hoy: hoy.total, semana: semana.total, pendientes: pendientes.total, proximos: proximos.total, porDia, porMaquina };
}

function getHistorial(filtros = {}) {
  const db = getDb();
  let conditions = ["sm.estado = 'completada'"];
  const params = [];

  if (filtros.sala_id) {
    conditions.push('m.sala_id = ?');
    params.push(filtros.sala_id);
  }
  if (filtros.maquina_id) {
    conditions.push('sm.maquina_id = ?');
    params.push(filtros.maquina_id);
  }
  if (filtros.operario_id) {
    conditions.push('sm.operario_id = ?');
    params.push(filtros.operario_id);
  }
  if (filtros.desde) {
    conditions.push("date(sm.completado_en) >= ?");
    params.push(filtros.desde);
  }
  if (filtros.hasta) {
    conditions.push("date(sm.completado_en) <= ?");
    params.push(filtros.hasta);
  }

  const where = conditions.length ? 'WHERE ' + conditions.join(' AND ') : '';

  return db.prepare(`
    SELECT sm.id, sm.iniciado_en, sm.completado_en, sm.observaciones,
      m.nombre as maquina, m.tipo as tipo_maquina, s.nombre as sala,
      o.nombre as operario
    FROM sesiones_mantenimiento sm
    JOIN maquinas m ON m.id = sm.maquina_id
    JOIN salas s ON s.id = m.sala_id
    JOIN operarios o ON o.id = sm.operario_id
    ${where}
    ORDER BY sm.completado_en DESC
    LIMIT 200
  `).all(...params);
}

function getOperarios() {
  return getDb().prepare('SELECT id, nombre, activo, creado_en FROM operarios WHERE activo = 1 ORDER BY nombre').all();
}

function crearOperario(nombre, pin) {
  const db = getDb();
  const existe = db.prepare('SELECT id FROM operarios WHERE pin = ?').get(pin);
  if (existe) throw new Error('Ya existe un operario con ese PIN');
  const result = db.prepare('INSERT INTO operarios (nombre, pin) VALUES (?, ?)').run(nombre, pin);
  return result.lastInsertRowid;
}

function getUsuarios() {
  return getDb().prepare('SELECT id, nombre, email, rol, activo, creado_en FROM usuarios ORDER BY nombre').all();
}

function crearUsuario(nombre, email, rol) {
  const db = getDb();
  // Asegurar que la tabla existe (por si la BD ya estaba creada antes de este campo)
  db.exec(`
    CREATE TABLE IF NOT EXISTS usuarios (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nombre TEXT NOT NULL,
      email TEXT UNIQUE,
      rol TEXT DEFAULT 'usuario',
      activo INTEGER DEFAULT 1,
      creado_en DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);
  if (email) {
    const existe = db.prepare('SELECT id FROM usuarios WHERE email = ?').get(email);
    if (existe) throw new Error('Ya existe un usuario con ese email');
  }
  const result = db.prepare('INSERT INTO usuarios (nombre, email, rol) VALUES (?, ?, ?)').run(nombre, email || null, rol || 'usuario');
  return result.lastInsertRowid;
}

function eliminarUsuario(id) {
  const db = getDb();
  db.prepare('UPDATE usuarios SET activo = 0 WHERE id = ?').run(id);
  return true;
}

function actualizarMaquina(id, datos) {
  const db = getDb();
  db.prepare(`
    UPDATE maquinas SET nombre = ?, tipo = ?, modelo = ?, frecuencia_dias = ?, estado = ?
    WHERE id = ?
  `).run(datos.nombre, datos.tipo, datos.modelo, datos.frecuencia_dias, datos.estado, id);
  return true;
}

function getSesionDetalle(sesionId) {
  const db = getDb();
  const sesion = db.prepare(`
    SELECT sm.*, m.nombre as maquina, o.nombre as operario, s.nombre as sala
    FROM sesiones_mantenimiento sm
    JOIN maquinas m ON m.id = sm.maquina_id
    JOIN salas s ON s.id = m.sala_id
    JOIN operarios o ON o.id = sm.operario_id
    WHERE sm.id = ?
  `).get(sesionId);

  if (!sesion) return null;

  return { sesion, items: [] };
}

function crearMaquina(datos) {
  const db = getDb();
  const result = db.prepare(
    'INSERT INTO maquinas (sala_id, nombre, tipo, modelo, estado, frecuencia_dias) VALUES (?, ?, ?, ?, ?, ?)'
  ).run(datos.sala_id, datos.nombre, datos.tipo || 'Impresora 3D', datos.modelo || '', datos.estado || 'activa', datos.frecuencia_dias || 7);
  return result.lastInsertRowid;
}

function eliminarMaquina(id) {
  const db = getDb();
  db.prepare('DELETE FROM sesiones_mantenimiento WHERE maquina_id = ?').run(id);
  db.prepare('DELETE FROM maquinas WHERE id = ?').run(id);
  return true;
}

// ─── Incidencias (nueva interfaz operario) ───────────────────────────────────

function crearIncidencia(maquinaNombre, tipo, notas, fotos) {
  const db = getDb();
  // Buscar maquina_id por nombre para mantener la relación
  const maquina = db.prepare('SELECT id FROM maquinas WHERE nombre = ? LIMIT 1').get(maquinaNombre);
  const fotosJson = JSON.stringify(fotos || []);
  const result = db.prepare(
    'INSERT INTO incidencias (maquina_nombre, maquina_id, tipo, notas, fotos) VALUES (?, ?, ?, ?, ?)'
  ).run(maquinaNombre, maquina ? maquina.id : null, tipo, notas || '', fotosJson);
  return result.lastInsertRowid;
}

function getIncidencias(filtros = {}) {
  const db = getDb();
  let conditions = [];
  const params = [];

  if (filtros.maquina_nombre) {
    conditions.push('maquina_nombre LIKE ?');
    params.push('%' + filtros.maquina_nombre + '%');
  }
  if (filtros.tipo) {
    conditions.push('tipo = ?');
    params.push(filtros.tipo);
  }
  if (filtros.desde) {
    conditions.push('date(timestamp) >= ?');
    params.push(filtros.desde);
  }
  if (filtros.hasta) {
    conditions.push('date(timestamp) <= ?');
    params.push(filtros.hasta);
  }

  const where = conditions.length ? 'WHERE ' + conditions.join(' AND ') : '';
  return db.prepare(`
    SELECT id, maquina_nombre, maquina_id, tipo, notas, fotos, timestamp
    FROM incidencias
    ${where}
    ORDER BY timestamp DESC
    LIMIT 200
  `).all(...params);
}

module.exports = {
  getDb, getSalas, getMaquinas, getMaquinaById,
  verificarPin, iniciarSesion, completarSesion,
  getDashboard, getHistorial, getOperarios, crearOperario,
  actualizarMaquina, crearMaquina, eliminarMaquina, getSesionDetalle,
  getUsuarios, crearUsuario, eliminarUsuario,
  crearIncidencia, getIncidencias
};
