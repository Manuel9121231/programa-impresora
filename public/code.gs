/**
 * MantApp — Google Apps Script Backend
 * Deploy as Web App → Execute as: Me → Who has access: Anyone
 */

/**
 * TEST: Select this function from the dropdown above and click ▶️ Run.
 * It will ask for permissions the first time, then send a test email
 * to the notification_email saved in the Config tab.
 */
function testEmail() {
  const ss = SpreadsheetApp.openById(SHEET_ID);
  const configSheet = ss.getSheetByName(CONFIG_TAB);
  if (!configSheet) { Logger.log('No Config tab found'); return; }

  const data = configSheet.getDataRange().getValues();
  let email = '';
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][0]).trim() === 'notification_email') {
      email = String(data[i][1]).trim();
      break;
    }
  }

  if (!email) { Logger.log('No notification_email in Config tab'); return; }

  MailApp.sendEmail({
    to: email,
    subject: '✅ MantApp — Test de notificaciones',
    htmlBody: '<div style="font-family:Arial,sans-serif;padding:24px;"><h2>✅ Funciona!</h2><p>Las notificaciones por email están configuradas correctamente.</p><p style="color:#888;font-size:12px;">Enviado desde MantApp</p></div>',
  });

  Logger.log('Test email sent to: ' + email);
}

// ─── Configure these ──────────────────────────────────────
const SHEET_ID    = '1QTewMeSHO6VUP8MZ7MLIUTZSKGbq_muWnKYO7c3REhw'; // from the Sheet URL
const SHEET_TAB   = 'Registros';             // tab for maintenance records
const MACHINES_TAB = 'Equipos';             // tab for machine list
const CONFIG_TAB   = 'Config';               // tab for app configuration (password etc.)
const FOLDER_ID   = '18c6vhVs_u3K86QY5GwLM4DehGl47Dgb4';                      // Drive folder ID for photos (leave '' to skip)
// ─────────────────────────────────────────────────────────

/** Handle POST from MantApp */
function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);

    // ── Save machine list ──────────────────────────────────
    if (data.action === 'saveMachines') {
      return saveMachines(data.machines || []);
    }

    // ── Save config key-value ──────────────────────────────
    if (data.action === 'saveConfig') {
      return saveConfig(data.key, data.value);
    }

    // ── Save maintenance record ────────────────────────────
    const timestamp  = data.timestamp  || new Date().toISOString();
    const assetId    = data.assetId    || '';
    const type       = data.type       || '';
    const notesText  = data.notes      || '';
    const photos     = Array.isArray(data.photos) ? data.photos : (data.photoB64 ? [data.photoB64] : []);

    const tsFormatted = Utilities.formatDate(
      new Date(timestamp),
      Session.getScriptTimeZone(),
      'dd/MM/yyyy HH:mm:ss'
    );

    // Save photos to Drive (if folder is configured)
    const photoUrls = [];
    let folderUrl = '';

    if (FOLDER_ID && photos.length > 0) {
      const parentFolder = DriveApp.getFolderById(FOLDER_ID);
      const folderName = `${type} - Máquina ${assetId} - ${tsFormatted.replace(/[\/:\s]/g, '-')}`;
      const incidentFolder = parentFolder.createFolder(folderName);
      
      // Make folder visible to anyone with link
      incidentFolder.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
      folderUrl = incidentFolder.getUrl();

      photos.forEach((b64, i) => {
        const url = saveImageToFolder(b64, assetId + '_' + (i + 1), type, tsFormatted, incidentFolder);
        if (url) photoUrls.push(url);
      });
    }

    const ss    = SpreadsheetApp.openById(SHEET_ID);
    let sheet   = ss.getSheetByName(SHEET_TAB);

    if (!sheet) {
      sheet = ss.insertSheet(SHEET_TAB);
      sheet.appendRow(['Timestamp', 'ID Activo', 'Tipo', 'Notas', 'URLs Fotos']);
      sheet.setFrozenRows(1);
      const hr = sheet.getRange(1, 1, 1, 5);
      hr.setFontWeight('bold');
      hr.setBackground('#1a73e8');
      hr.setFontColor('#ffffff');
    }

    sheet.appendRow([tsFormatted, assetId, type, notesText, ""]);
    const rowNumber = sheet.getLastRow();

    // Use RichTextValue so multiple URLs in one cell become clickable hyperlinks
    if (photoUrls.length > 0) {
      const cell = sheet.getRange(rowNumber, 5); // Column 5 is 'URLs Fotos'
      let lines = [`📁 Ver Carpeta: ${folderUrl}`, ...photoUrls];
      let text = lines.join('\n');
      let richText = SpreadsheetApp.newRichTextValue().setText(text);
      
      let start = 0;
      lines.forEach(line => {
        let end = start + line.length;
        // link the folder URL for the first item, and the image URL for the rest
        let urlTarget = line.startsWith('📁') ? folderUrl : line;
        richText.setLinkUrl(start, end, urlTarget);
        start = end + 1; // +1 to account for newline
      });
      cell.setRichTextValue(richText.build());
    }

    // Send email notification (if configured)
    sendNotificationEmail(assetId, type, notesText, tsFormatted, folderUrl, photoUrls);

    return ContentService
      .createTextOutput(JSON.stringify({ status: 'ok', row: rowNumber }))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (err) {
    return ContentService
      .createTextOutput(JSON.stringify({ status: 'error', error: err.message }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

/** Save machine list to the Equipos tab */
function saveMachines(machines) {
  try {
    const ss = SpreadsheetApp.openById(SHEET_ID);
    let sheet = ss.getSheetByName(MACHINES_TAB);

    if (!sheet) {
      sheet = ss.insertSheet(MACHINES_TAB);
    }

    sheet.clearContents();
    sheet.getRange(1, 1, 1, 4).setValues([['ID', 'Espacio', 'Tipo', 'Estado']]);
    sheet.setFrozenRows(1);
    const hr = sheet.getRange(1, 1, 1, 4);
    hr.setFontWeight('bold');
    hr.setBackground('#34a853');
    hr.setFontColor('#ffffff');

    if (machines.length > 0) {
      sheet.getRange(2, 1, machines.length, 4)
        .setValues(machines.map(m => [m.id, m.space || 'Maker', m.type || 'Impresora 3D', m.status || 'Activa']));
    }

    return ContentService
      .createTextOutput(JSON.stringify({ status: 'ok', saved: machines.length }))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (err) {
    return ContentService
      .createTextOutput(JSON.stringify({ status: 'error', error: err.message }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

/** Save (upsert) a config key-value pair in the Config tab */
function saveConfig(key, value) {
  try {
    const ss = SpreadsheetApp.openById(SHEET_ID);
    let sheet = ss.getSheetByName(CONFIG_TAB);

    if (!sheet) {
      sheet = ss.insertSheet(CONFIG_TAB);
      sheet.getRange(1, 1, 1, 2).setValues([['Key', 'Value']]);
      sheet.setFrozenRows(1);
    }

    // Check if key exists and update in-place
    const data = sheet.getDataRange().getValues();
    for (let i = 1; i < data.length; i++) {
      if (String(data[i][0]).trim() === key) {
        sheet.getRange(i + 1, 2).setValue(value);
        return ContentService
          .createTextOutput(JSON.stringify({ status: 'ok' }))
          .setMimeType(ContentService.MimeType.JSON);
      }
    }

    // Key not found — append new row
    sheet.appendRow([key, value]);
    return ContentService
      .createTextOutput(JSON.stringify({ status: 'ok' }))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (err) {
    return ContentService
      .createTextOutput(JSON.stringify({ status: 'error', error: err.message }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}


/** Save base64 image to a specific Google Drive folder, return public URL */
function saveImageToFolder(dataUrl, assetId, type, ts, targetFolder) {
  try {
    const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
    if (!match) return '';

    const mimeType = match[1];
    const base64   = match[2];
    const blob     = Utilities.newBlob(Utilities.base64Decode(base64), mimeType);
    const ext      = mimeType.split('/')[1] || 'jpg';
    const filename = `${type}_${assetId}_${ts.replace(/[:/\s]/g, '-')}.${ext}`;
    blob.setName(filename);

    const file   = targetFolder.createFile(blob);
    // Ensure the individual file is also viewable in case they share the picture link
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    return file.getUrl();
  } catch (err) {
    Logger.log('Drive error: ' + err.message);
    return '';
  }
}

/** Send email notification for new records */
function sendNotificationEmail(assetId, type, notes, timestamp, folderUrl, photoUrls) {
  try {
    // Read notification email from Config tab
    const ss = SpreadsheetApp.openById(SHEET_ID);
    const configSheet = ss.getSheetByName(CONFIG_TAB);
    if (!configSheet) return;

    const configData = configSheet.getDataRange().getValues();
    let notifEmail = '';
    for (let i = 1; i < configData.length; i++) {
      if (String(configData[i][0]).trim() === 'notification_email') {
        notifEmail = String(configData[i][1]).trim();
        break;
      }
    }
    if (!notifEmail) return; // No email configured, skip silently

    const isIncidencia = type === 'Incidencia';
    const emoji = isIncidencia ? '⚠️' : '🔧';
    const color = isIncidencia ? '#f59e0b' : '#2563eb';
    const subject = `${emoji} ${type} — ${assetId} — ${timestamp}`;

    let photosHtml = '';
    if (folderUrl) {
      photosHtml = `<p><a href="${folderUrl}" style="color:#2563eb;">📁 Ver fotos en Drive</a></p>`;
    }
    if (photoUrls && photoUrls.length > 0) {
      photosHtml += photoUrls.map(url => {
        const thumbId = url.match(/\/d\/([a-zA-Z0-9-_]+)/);
        if (thumbId) {
          return `<img src="https://drive.google.com/thumbnail?id=${thumbId[1]}&sz=w200" style="border-radius:4px;margin:4px;max-width:200px;" />`;
        }
        return `<a href="${url}" style="color:#2563eb;">Ver foto</a>`;
      }).join('');
    }

    const html = `
      <div style="font-family:'Inter',Helvetica,Arial,sans-serif;max-width:500px;margin:0 auto;background:#f8f9fb;padding:24px;">
        <div style="background:#fff;border:1px solid #e5e7eb;border-radius:8px;padding:24px;">
          <div style="display:inline-block;background:${color};color:#fff;font-size:12px;font-weight:700;padding:4px 10px;border-radius:4px;margin-bottom:16px;">
            ${emoji} ${type.toUpperCase()}
          </div>
          <h2 style="margin:0 0 4px;font-size:20px;color:#111;">Máquina ${assetId}</h2>
          <p style="margin:0 0 16px;font-size:13px;color:#6b7280;">${timestamp}</p>
          <div style="background:#f3f4f6;border-radius:6px;padding:14px;margin-bottom:16px;">
            <p style="margin:0;font-size:14px;color:#374151;font-weight:600;">Observaciones</p>
            <p style="margin:6px 0 0;font-size:14px;color:#111;white-space:pre-wrap;">${notes || '—'}</p>
          </div>
          ${photosHtml ? '<div style="margin-bottom:16px;">' + photosHtml + '</div>' : ''}
          <hr style="border:none;border-top:1px solid #e5e7eb;margin:16px 0;" />
          <p style="font-size:12px;color:#9ca3af;margin:0;">Enviado automáticamente por MantApp</p>
        </div>
      </div>
    `;

    MailApp.sendEmail({
      to: notifEmail,
      subject: subject,
      htmlBody: html,
    });
  } catch (err) {
    Logger.log('Email notification error: ' + err.message);
  }
}

/**
 * Handle GET requests
 *  ?action=getMachines  → return machine list as JSON
 *  (no action)          → health check
 */
function doGet(e) {
  const action = e && e.parameter && e.parameter.action;

  if (action === 'getConfig') {
    try {
      const ss    = SpreadsheetApp.openById(SHEET_ID);
      const sheet = ss.getSheetByName(CONFIG_TAB);
      if (!sheet) {
        return ContentService.createTextOutput(JSON.stringify({ status: 'ok', config: {} }))
          .setMimeType(ContentService.MimeType.JSON);
      }
      const rows   = sheet.getDataRange().getValues();
      const allConfig = {};
      rows.forEach(r => { if (r[0]) allConfig[String(r[0]).trim()] = String(r[1] || '').trim(); });

      // Only return NON-SENSITIVE config to the frontend
      const safeConfig = {
        sheet_url: 'https://docs.google.com/spreadsheets/d/' + SHEET_ID + '/edit',
      };
      // notification_email is only returned if the request includes the correct password
      const pw = e && e.parameter && e.parameter.pw;
      if (pw && pw === allConfig['admin_password']) {
        safeConfig.notification_email = allConfig['notification_email'] || '';
        safeConfig.authenticated = true;
      }

      return ContentService.createTextOutput(JSON.stringify({ status: 'ok', config: safeConfig }))
        .setMimeType(ContentService.MimeType.JSON);
    } catch (err) {
      return ContentService.createTextOutput(JSON.stringify({ status: 'error', error: err.message }))
        .setMimeType(ContentService.MimeType.JSON);
    }
  }

  // Server-side password verification (no password ever sent to the browser)
  if (action === 'verifyPassword') {
    try {
      const pw = e && e.parameter && e.parameter.pw;
      if (!pw) return ContentService.createTextOutput(JSON.stringify({ status: 'error', error: 'No password' }))
        .setMimeType(ContentService.MimeType.JSON);

      const ss    = SpreadsheetApp.openById(SHEET_ID);
      const sheet = ss.getSheetByName(CONFIG_TAB);
      if (!sheet) return ContentService.createTextOutput(JSON.stringify({ status: 'ok', valid: false }))
        .setMimeType(ContentService.MimeType.JSON);

      const rows = sheet.getDataRange().getValues();
      let storedPass = '';
      for (let i = 0; i < rows.length; i++) {
        if (String(rows[i][0]).trim() === 'admin_password') {
          storedPass = String(rows[i][1]).trim();
          break;
        }
      }

      return ContentService.createTextOutput(JSON.stringify({ status: 'ok', valid: pw === storedPass }))
        .setMimeType(ContentService.MimeType.JSON);
    } catch (err) {
      return ContentService.createTextOutput(JSON.stringify({ status: 'error', error: err.message }))
        .setMimeType(ContentService.MimeType.JSON);
    }
  }

  if (action === 'getMachines') {
    try {
      const ss    = SpreadsheetApp.openById(SHEET_ID);
      const sheet = ss.getSheetByName(MACHINES_TAB);

      if (!sheet || sheet.getLastRow() < 2) {
        return ContentService
          .createTextOutput(JSON.stringify({ status: 'ok', machines: [] }))
          .setMimeType(ContentService.MimeType.JSON);
      }

      const rows = sheet.getRange(2, 1, sheet.getLastRow() - 1, 4).getValues();
      const machines = rows
        .filter(r => String(r[0]).trim())
        .map(r => ({
          id:   String(r[0]).trim().toUpperCase(),
          space: String(r[1] || 'Maker').trim(),
          type: String(r[2] || 'Impresora 3D').trim(),
          status: String(r[3] || 'Activa').trim(),
        }));

      return ContentService
        .createTextOutput(JSON.stringify({ status: 'ok', machines }))
        .setMimeType(ContentService.MimeType.JSON);

    } catch (err) {
      return ContentService
        .createTextOutput(JSON.stringify({ status: 'error', error: err.message }))
        .setMimeType(ContentService.MimeType.JSON);
    }
  }

  if (action === 'getHistory') {
    try {
      const ss    = SpreadsheetApp.openById(SHEET_ID);
      const sheet = ss.getSheetByName(SHEET_TAB);
      
      if (!sheet || sheet.getLastRow() < 2) {
        return ContentService
          .createTextOutput(JSON.stringify({ status: 'ok', history: [] }))
          .setMimeType(ContentService.MimeType.JSON);
      }

      const dataRange = sheet.getDataRange();
      const rows = dataRange.getDisplayValues(); // use DisplayValues for formatted timestamps
      const richText = dataRange.getRichTextValues();
      
      const history = [];
      const headers = rows[0].map(h => String(h).trim().toLowerCase());
      
      const idxTimestamp = headers.indexOf('timestamp') !== -1 ? headers.indexOf('timestamp') : 0;
      let idxAsset = headers.findIndex(h => h.includes('id') || h.includes('activo') || h.includes('máquina') || h.includes('maquina'));
      if (idxAsset === -1) idxAsset = 1; // Fallback B
      const idxType = headers.indexOf('tipo') !== -1 ? headers.indexOf('tipo') : 2; // Fallback C
      const idxNotes = headers.indexOf('notas') !== -1 ? headers.indexOf('notas') : 3; // Fallback D
      let idxUrls = headers.findIndex(h => h.includes('url') || h.includes('foto'));
      if (idxUrls === -1) idxUrls = 4; // Fallback E

      for (let i = 1; i < rows.length; i++) {
        const r = rows[i];
        if (!r[idxTimestamp] && !r[idxAsset]) continue; // skip completely empty rows

        const record = {
          timestamp: idxTimestamp >= 0 ? String(r[idxTimestamp]) : '',
          assetId:   idxAsset >= 0 ? String(r[idxAsset]) : '',
          type:      idxType >= 0 ? String(r[idxType]) : '',
          notes:     idxNotes >= 0 ? String(r[idxNotes]) : '',
          folderUrl: '',
          photoUrls: []
        };

        if (idxUrls >= 0) {
           const rt = richText[i][idxUrls];
           if (rt) {
             const runs = rt.getRuns();
             for (let j = 0; j < runs.length; j++) {
               let runText = runs[j].getText();
               let link = runs[j].getLinkUrl();
               if (link) {
                 if (runText.includes('📁')) {
                   record.folderUrl = link;
                 } else {
                   record.photoUrls.push(link);
                 }
               }
             }
           }
           
           // Fallback if no rich text but text has http
           if (!record.folderUrl && record.photoUrls.length === 0) {
             const plainText = String(r[idxUrls]);
             const links = plainText.match(/(https?:\/\/[^\s]+)/g);
             if (links && links.length > 0) {
               record.folderUrl = links[0];
               if (links.length > 1) {
                 record.photoUrls = links.slice(1);
               }
             }
           }
        }
        
        history.push(record);
      }

      history.reverse(); // Newest first

      return ContentService
        .createTextOutput(JSON.stringify({ status: 'ok', history }))
        .setMimeType(ContentService.MimeType.JSON);

    } catch (err) {
      return ContentService
        .createTextOutput(JSON.stringify({ status: 'error', error: err.message }))
        .setMimeType(ContentService.MimeType.JSON);
    }
  }

  // Health check
  return ContentService
    .createTextOutput(JSON.stringify({ status: 'ok', message: 'MantApp backend activo.' }))
    .setMimeType(ContentService.MimeType.JSON);
}

