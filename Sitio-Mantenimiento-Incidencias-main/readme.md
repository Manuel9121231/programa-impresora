# Mantenimiento ECYT

PWA (Progressive Web App) para registro de incidencias y mantenimientos en planta. Permite escanear un ID de equipo (QR/código de barras o manual), elegir el tipo de registro, adjuntar una foto y enviar todo a Google Sheets con timestamp automático.

---

## Características

| Feature | Detalle |
|---|---|
| 📷 Escáner QR / Barras | Usa ZXing — escanea con la cámara trasera |
| ⚠ Incidencia / 🔧 Mantenimiento | Selector visual de tipo |
| 🖼 Captura de foto | Cámara directa o galería |
| 📊 Google Sheets | Fila automática con timestamp |
| 🌐 PWA offline-first | Cola local si no hay red, envío al reconectar |
| 📱 Mobile-ready | Optimizado para smartphone de fábrica |

---

## Estructura de archivos

```
v2/
├── index.html          # UI principal (4 pasos)
├── style.css           # Diseño dark industrial premium
├── app.js              # Lógica de la app
├── service-worker.js   # Cache offline
├── manifest.json       # PWA manifest
├── Code.gs             # Google Apps Script (backend)
└── README.md           # Este archivo
```

---

## Configuración en 4 pasos

### 1. Crear la Google Sheet

1. Ve a [sheets.google.com](https://sheets.google.com) y crea una nueva hoja.
2. Copia la **ID de la hoja** desde la URL:  
   `https://docs.google.com/spreadsheets/d/`**`TU_SHEET_ID`**`/edit`

### 2. Desplegar el Apps Script

1. Ve a [script.google.com](https://script.google.com) → **Nuevo proyecto**
2. Borra el código por defecto y pega el contenido de **`Code.gs`**
3. Rellena las constantes en la parte superior:
   ```javascript
   const SHEET_ID  = 'TU_GOOGLE_SHEET_ID';
   const SHEET_TAB = 'Registros';    // nombre de la pestaña
   const FOLDER_ID = '';             // ID carpeta Drive para fotos (opcional)
   ```
4. Clic en **Implementar → Nueva implementación**:
   - Tipo: **Aplicación web**
   - Ejecutar como: **Yo**
   - Quién tiene acceso: **Cualquier persona**
5. Copia la **URL de la App Web** (termina en `/exec`)

> [!IMPORTANT]
> Guarda la URL del Apps Script — la necesitas en el siguiente paso.

### 3. Conectar la app

Abre **`app.js`** y reemplaza la primera constante:

```javascript
const SHEETS_URL = 'https://script.google.com/macros/s/AKfycby6MV3_24-q_CWB4w2DEGleREdgrGAvGyhmjJqi-gnpEZ5Q8aZgWRsEBM06qBaNGhA/exec';
```

### 4. Servidor local (desarrollo)

Puedes abrir el `index.html` directamente o usar un servidor simple:

```bash
# Python
python -m http.server 8080

# Node.js (npx)
npx serve .
```

Luego abre `http://localhost:8080` en el navegador.

---

## Columnas en Google Sheets

| Timestamp | ID Activo | Tipo | Operario | Notas | URL Foto |
|---|---|---|---|---|---|
| 23/03/2026 10:32:45 | EJ-0042 | Incidencia | Juan García | Ruido en rodamiento | https://drive.google.com/... |

---

## Modo offline

Si el dispositivo pierde red al enviar:
- El registro se guarda en `localStorage` en una cola de pendientes.
- Al recuperar la conexión, la app envía automáticamente todos los registros pendientes.

---

## Notas

- Las fotos se convierten a **base64** antes de enviarse. Para imágenes grandes activa la carpeta Drive en el script.
- El escáner QR requiere **HTTPS** o `localhost` (restricción del navegador para acceso a cámara).
- Para producción, despliega en cualquier hosting estático (GitHub Pages, Netlify, etc.).
