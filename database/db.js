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

    CREATE TABLE IF NOT EXISTS plantillas_checklist (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      maquina_id INTEGER NOT NULL,
      nombre TEXT NOT NULL,
      activa INTEGER DEFAULT 1,
      FOREIGN KEY (maquina_id) REFERENCES maquinas(id)
    );

    CREATE TABLE IF NOT EXISTS items_checklist (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      plantilla_id INTEGER NOT NULL,
      descripcion TEXT NOT NULL,
      es_critico INTEGER DEFAULT 0,
      orden INTEGER DEFAULT 0,
      categoria TEXT DEFAULT 'general',
      FOREIGN KEY (plantilla_id) REFERENCES plantillas_checklist(id)
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

    CREATE TABLE IF NOT EXISTS registros_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      sesion_id INTEGER NOT NULL,
      item_id INTEGER NOT NULL,
      completado INTEGER DEFAULT 0,
      valor_texto TEXT,
      completado_en DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (sesion_id) REFERENCES sesiones_mantenimiento(id),
      FOREIGN KEY (item_id) REFERENCES items_checklist(id)
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
  const sala1 = insertSala.run('Espacio Maker', 'Espacio Maker – Impresoras A-01 a A-05');
  const sala2 = insertSala.run('Espacio Robot', 'Espacio Robot – Impresoras B-01 a B-05');

  const maquinas = [
    // Espacio Maker (A-01 a A-05)
    { sala: sala1.lastInsertRowid, nombre: 'Impresora A-01', tipo: 'Impresora FDM', modelo: 'Prusa MK4' },
    { sala: sala1.lastInsertRowid, nombre: 'Impresora A-02', tipo: 'Impresora FDM', modelo: 'Prusa MK4' },
    { sala: sala1.lastInsertRowid, nombre: 'Impresora A-03', tipo: 'Impresora FDM', modelo: 'Prusa MK4' },
    { sala: sala1.lastInsertRowid, nombre: 'Impresora A-04', tipo: 'Impresora FDM', modelo: 'Prusa MK4' },
    { sala: sala1.lastInsertRowid, nombre: 'Impresora A-05', tipo: 'Impresora FDM', modelo: 'Prusa MK4' },
    // Espacio Robot (B-01 a B-05)
    { sala: sala2.lastInsertRowid, nombre: 'Impresora B-01', tipo: 'Impresora FDM', modelo: 'Bambu Lab X1' },
    { sala: sala2.lastInsertRowid, nombre: 'Impresora B-02', tipo: 'Impresora FDM', modelo: 'Bambu Lab X1' },
    { sala: sala2.lastInsertRowid, nombre: 'Impresora B-03', tipo: 'Impresora FDM', modelo: 'Bambu Lab X1' },
    { sala: sala2.lastInsertRowid, nombre: 'Impresora B-04', tipo: 'Impresora FDM', modelo: 'Bambu Lab X1' },
    { sala: sala2.lastInsertRowid, nombre: 'Impresora B-05', tipo: 'Impresora FDM', modelo: 'Bambu Lab X1' },
  ];

  const insertMaquina = db.prepare(
    'INSERT INTO maquinas (sala_id, nombre, tipo, modelo) VALUES (?, ?, ?, ?)'
  );

  const insertPlantilla = db.prepare(
    'INSERT INTO plantillas_checklist (maquina_id, nombre) VALUES (?, ?)'
  );

  const insertItem = db.prepare(
    'INSERT INTO items_checklist (plantilla_id, descripcion, es_critico, orden, categoria) VALUES (?, ?, ?, ?, ?)'
  );

  for (const m of maquinas) {
    const maq = insertMaquina.run(m.sala, m.nombre, m.tipo, m.modelo);
    const plt = insertPlantilla.run(maq.lastInsertRowid, 'Mantenimiento Preventivo Estándar');

    const items = [
      { desc: 'Nivel de aceite correcto', critico: 1, orden: 1, cat: 'lubricacion' },
      { desc: 'Tensión de cadena/correa correcta', critico: 1, orden: 2, cat: 'mecanico' },
      { desc: 'Limpieza del cabezal/extrusor', critico: 1, orden: 3, cat: 'limpieza' },
      { desc: 'Verificar que no hay filamento obstruido', critico: 0, orden: 4, cat: 'mecanico' },
      { desc: 'Limpieza general de la cama de impresión', critico: 0, orden: 5, cat: 'limpieza' },
      { desc: 'Comprobar conexiones eléctricas', critico: 0, orden: 6, cat: 'electrico' },
      { desc: 'Otros (campo libre)', critico: 0, orden: 7, cat: 'otros' },
    ];

    for (const item of items) {
      insertItem.run(plt.lastInsertRowid, item.desc, item.critico, item.orden, item.cat);
    }
  }

  // Operarios de ejemplo
  const insertOperario = db.prepare('INSERT INTO operarios (nombre, pin) VALUES (?, ?)');
  insertOperario.run('Admin', '0000');
  insertOperario.run('Carlos García', '1234');
  insertOperario.run('María López', '5678');
  insertOperario.run('Juan Martínez', '9012');

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

function getChecklistDeMaquina(maquinaId) {
  const db = getDb();
  const plantilla = db.prepare(
    'SELECT * FROM plantillas_checklist WHERE maquina_id = ? AND activa = 1 ORDER BY id DESC LIMIT 1'
  ).get(maquinaId);

  if (!plantilla) return null;

  const items = db.prepare(
    'SELECT * FROM items_checklist WHERE plantilla_id = ? ORDER BY orden, id'
  ).all(plantilla.id);

  return { plantilla, items };
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

function marcarItem(sesionId, itemId, completado, valorTexto) {
  const db = getDb();
  // Upsert: actualizar si ya existe, insertar si no
  const existe = db.prepare(
    'SELECT id FROM registros_items WHERE sesion_id = ? AND item_id = ?'
  ).get(sesionId, itemId);

  if (existe) {
    db.prepare(
      'UPDATE registros_items SET completado = ?, valor_texto = ?, completado_en = CURRENT_TIMESTAMP WHERE sesion_id = ? AND item_id = ?'
    ).run(completado ? 1 : 0, valorTexto || null, sesionId, itemId);
  } else {
    db.prepare(
      'INSERT INTO registros_items (sesion_id, item_id, completado, valor_texto) VALUES (?, ?, ?, ?)'
    ).run(sesionId, itemId, completado ? 1 : 0, valorTexto || null);
  }
  return true;
}

function completarSesion(sesionId, observaciones) {
  const db = getDb();

  const sesion = db.prepare('SELECT * FROM sesiones_mantenimiento WHERE id = ?').get(sesionId);
  if (!sesion) throw new Error('Sesión no encontrada');

  // Verificar críticos
  const checklist = getChecklistDeMaquina(sesion.maquina_id);
  const criticos = checklist.items.filter(i => i.es_critico);
  const registros = db.prepare(
    'SELECT * FROM registros_items WHERE sesion_id = ?'
  ).all(sesionId);

  const criticosSinCompletar = criticos.filter(c => {
    const reg = registros.find(r => r.item_id === c.id);
    return !reg || !reg.completado;
  });

  if (criticosSinCompletar.length > 0) {
    throw new Error(`Hay ${criticosSinCompletar.length} punto(s) crítico(s) sin completar`);
  }

  db.prepare(`
    UPDATE sesiones_mantenimiento
    SET estado = 'completada', observaciones = ?, completado_en = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(observaciones || null, sesionId);

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
      o.nombre as operario,
      (SELECT COUNT(*) FROM registros_items ri WHERE ri.sesion_id = sm.id AND ri.completado = 1) as items_completados,
      (SELECT COUNT(*) FROM registros_items ri WHERE ri.sesion_id = sm.id) as items_total
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

  const items = db.prepare(`
    SELECT ic.descripcion, ic.es_critico, ic.categoria, ic.orden,
      ri.completado, ri.valor_texto, ri.completado_en
    FROM items_checklist ic
    JOIN plantillas_checklist pc ON pc.id = ic.plantilla_id
    LEFT JOIN registros_items ri ON ri.item_id = ic.id AND ri.sesion_id = ?
    WHERE pc.maquina_id = (SELECT maquina_id FROM sesiones_mantenimiento WHERE id = ?)
    ORDER BY ic.orden
  `).all(sesionId, sesionId);

  return { sesion, items };
}

module.exports = {
  getDb, getSalas, getMaquinas, getMaquinaById, getChecklistDeMaquina,
  verificarPin, iniciarSesion, marcarItem, completarSesion,
  getDashboard, getHistorial, getOperarios, crearOperario,
  actualizarMaquina, getSesionDetalle
};
