/**
 * Función optimizada que obtiene solo las columnas específicas (T, U, V, W, X) 
 * de una hoja de cálculo de Google Sheets y envía por correo electrónico como tabla HTML.
 */
function Enviarcorreo() {
  // Obtener la fecha actual y formatearla como 'yyyy-MM-dd'
  const today = new Date();
  const formattedDate = Utilities.formatDate(today, Session.getScriptTimeZone(), 'yyyy-MM-dd');

  // Obtener los datos de las columnas específicas solamente
  const data = getSpecificColumns(
    "Descuento empleados", // Nombre de la hoja
    ["T", "U", "V", "W", "X"], // Columnas específicas
    "", // ID de la hoja de cálculo
    2 // Fila de encabezados
  );

  Logger.log(data);

  // Verificar si hay datos para enviar
  if (!data || data.length === 0) {
    throw new Error("No se encontraron datos en las columnas especificadas para enviar el correo");
  }

  // Construir el cuerpo del correo en formato HTML
  const htmlBody = buildHtmlTable(data, formattedDate);

  // Crear el archivo adjunto con los datos actuales
  const attachment = createExcelAttachment(data, formattedDate);

  // Enviar el correo electrónico con los datos procesados y el archivo adjunto
  MailApp.sendEmail({
    //to: "destino10@cuenta.com",
    to: "tech@elianazaia.com, luis.arrieta@imagineapps.co",
    //to: "administrativo@elianazaia.com, alba.rodriguez@elianazaia.com, analista.tech@elianazaia.com, tech@elianazaia.com",
    subject: `Descuento de Empleados - ${formattedDate}`,
    htmlBody: htmlBody,
    attachments: [attachment]
  });
}

/**
 * Función optimizada para obtener solo columnas específicas de una hoja de cálculo
 * @param {string} sheetName - Nombre de la hoja
 * @param {Array<string>} columnLetters - Array de letras de columnas (ej: ["T", "U", "V", "W", "X"])
 * @param {string} sheetId - ID del archivo de Google Sheets (opcional)
 * @param {number} headerRow - Número de fila donde están los encabezados (por defecto: 1)
 * @return {Array<Object>} Arreglo de objetos con solo las columnas especificadas
 */
function getSpecificColumns(sheetName, columnLetters, sheetId = "", headerRow = 1) {
  const ss = sheetId.trim() !== ""
    ? SpreadsheetApp.openById(sheetId)
    : SpreadsheetApp.getActiveSpreadsheet();

  const sheet = ss.getSheetByName(sheetName);
  if (!sheet) {
    throw new Error("No se encontró la hoja: " + sheetName);
  }

  // Convertir letras de columnas a números (A=1, B=2, etc.)
  const columnNumbers = columnLetters.map(letter => letter.charCodeAt(0) - 64);
  
  // Obtener el rango completo de datos para determinar la última fila
  const lastRow = sheet.getLastRow();
  
  if (lastRow < headerRow) {
    return [];
  }

  // Obtener los encabezados de las columnas específicas
  const headerRange = sheet.getRange(headerRow, 1, 1, sheet.getLastColumn());
  const allHeaders = headerRange.getValues()[0];
  
  // Extraer solo los encabezados de las columnas que necesitamos
  const specificHeaders = columnNumbers.map(colNum => {
    const header = allHeaders[colNum - 1];
    return header ? header.toString().trim() : `Columna_${colNum}`;
  });

  // Obtener los datos de las columnas específicas
  const result = [];
  
  if (lastRow > headerRow) {
    // Para cada columna específica, obtener sus datos
    const columnsData = columnNumbers.map(colNum => {
      const range = sheet.getRange(headerRow + 1, colNum, lastRow - headerRow, 1);
      return range.getValues().flat();
    });

    // Transponer los datos para crear objetos por fila
    for (let rowIndex = 0; rowIndex < columnsData[0].length; rowIndex++) {
      const rowObj = {};
      let hasValidData = false;

      for (let colIndex = 0; colIndex < specificHeaders.length; colIndex++) {
        let value = columnsData[colIndex][rowIndex];

        // Procesar el valor según su tipo
        if (Object.prototype.toString.call(value) === "[object Date]" && !isNaN(value)) {
          const zonaHoraria = Session.getScriptTimeZone();
          value = Utilities.formatDate(value, zonaHoraria, "yyyy-MM-dd");
        } else if (typeof value === "string") {
          value = value.replace(/\n/g, "");
        }

        rowObj[specificHeaders[colIndex]] = value;

        // Verificar si hay datos válidos en esta fila
        if (value !== null && value !== undefined && value.toString().trim() !== "") {
          hasValidData = true;
        }
      }

      // Solo agregar la fila si tiene al menos un valor válido
      if (hasValidData) {
        result.push(rowObj);
      }
    }
  }

  return result;
}

/**
 * Crea un archivo Excel completo con toda la información del archivo actual
 * @param {Array<Object>} data - Los datos procesados
 * @param {string} formattedDate - La fecha formateada para el nombre del archivo
 * @return {Blob} El archivo como blob para adjuntar al correo
 */
function createExcelAttachment(data, formattedDate) {
  // Obtener la hoja de cálculo actual
  const currentSpreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  
  // ========== CONFIGURACIÓN DE CARPETA ==========
  // Simplemente cambia este ID por el de tu carpeta de destino
  // Si lo dejas vacío "", el archivo se guardará en Mi Drive
  const FOLDER_ID = "14o5VQH7hEiEcd7NjOOjeaHpsVSVco640"; // Reemplaza con tu ID de carpeta real
  // ============================================
  
  // Crear una copia del archivo actual completo
  const copiedFile = DriveApp.getFileById(currentSpreadsheet.getId())
    .makeCopy(`Descuento_Empleados_${formattedDate}`);
  
  // Mover el archivo a la carpeta especificada (si se proporcionó un ID)
  if (FOLDER_ID && FOLDER_ID.trim() !== "") {
    try {
      const targetFolder = DriveApp.getFolderById(FOLDER_ID);
      copiedFile.moveTo(targetFolder);
      console.log(`Archivo movido exitosamente a la carpeta especificada`);
    } catch (error) {
      console.log(`Error al mover archivo a carpeta: ${error.message}`);
      console.log("Archivo creado en Mi Drive por defecto.");
    }
  } else {
    console.log("No se especificó FOLDER_ID. Archivo creado en Mi Drive.");
  }
  
  // Obtener el archivo como blob
  const blob = copiedFile.getBlob();
  blob.setName(`Descuento_Empleados_${formattedDate}.xlsx`);
  
  return blob;
}

// ===== HTML PERSONALIZADOS =====
/**
 * Generador HTML para Descuento Empleados - Columnas específicas
 */
function buildHtmlTable(data, formattedDate) {
  let html = `
    <div style="max-width: 800px; margin: 0 auto; font-family: 'Segoe UI', sans-serif; line-height: 1.6; color: #333;">
      
      <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 20px; border-radius: 12px; text-align: center; margin-bottom: 20px;">
        <h1 style="margin: 0; font-size: 28px; font-weight: 300;">
          📝 DESCUENTO EMPLEADOS
        </h1>
        <p style="margin: 10px 0 0 0; font-size: 16px; opacity: 0.9;">
          Fecha: ${formattedDate}
        </p>
      </div>
      
      <div style="background: white; padding: 25px; border-radius: 12px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); margin-bottom: 25px;">
        <p style="margin: 0 0 15px 0; font-size: 16px;">
          Hola,
        </p>
        <p style="margin: 0; color: #666; font-size: 14px;">
          A continuación se envía detalle de la venta a empleados:
        </p>
        <div style="background: #e3f2fd; padding: 15px; border-radius: 8px; margin-top: 15px; border-left: 4px solid #2196f3;">
          <p style="margin: 0; font-size: 14px; color: #1976d2;">
            📎 <strong>Nota:</strong> Se adjunta archivo con los datos actuales para trazabilidad.
          </p>
        </div>
      </div>
  `;
  
  // Tabla principal
  const headers = Object.keys(data[0]);
  
  html += `
    <table style="width: 100%; border-collapse: collapse; background: white; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
  `;

  // Headers
  html += `<tr style="background: #f8f9fa;">`;
  headers.forEach(header => {
    html += `<th style="padding: 15px; text-align: left; font-weight: 600; color: #495057; border-bottom: 2px solid #dee2e6; font-size: 14px;">${header}</th>`;
  });
  html += `</tr>`;

  // Filas de datos
  data.forEach((row, index) => {
    const firstCellValue = row[headers[0]]?.toString().trim().toLowerCase();
    const isTotalRow = firstCellValue === "suma total" || firstCellValue === "total";
    
    const bgColor = isTotalRow ? '#e6f3ff' : (index % 2 === 0 ? '#f8f9fa' : 'white');
    const fontWeight = isTotalRow ? 'bold' : 'normal';
    
    html += `<tr style="background: ${bgColor}; font-weight: ${fontWeight};">`;
    
    headers.forEach((header, headerIndex) => {
      const value = row[header];
      
      // Verificar si es un número (incluyendo valores que parezcan números)
      const numericValue = parseFloat(value);
      const isNumeric = !isNaN(numericValue) && isFinite(numericValue) && typeof value !== 'boolean';
      
      if (isNumeric) {
        // Si es la primera columna (headerIndex === 0), no agregar el signo $
        const formattedValue = headerIndex === 0 
          ? numericValue.toLocaleString("es-CO", { maximumFractionDigits: 0 })
          : `$${numericValue.toLocaleString("es-CO", { maximumFractionDigits: 0 })}`;
        html += `<td style="padding: 12px 15px; border-bottom: 1px solid #dee2e6; text-align: right; font-size: 13px;">${formattedValue}</td>`;
      } else {
        const displayValue = isTotalRow && headerIndex === 0 ? "SUMA TOTAL" : (value ?? "");
        html += `<td style="padding: 12px 15px; border-bottom: 1px solid #dee2e6; font-size: 13px;">${displayValue}</td>`;
      }
    });
    
    html += `</tr>`;
  });

  html += `</table>`;

  // Footer con enlace al Google Sheets
  const sheetsUrl = SpreadsheetApp.getActiveSpreadsheet().getUrl();
  
  html += `
      <div style="text-align: center; margin-top: 30px; padding: 20px; background: #f8f9fa; border-radius: 8px;">
        <a href="${sheetsUrl}" target="_blank" style="text-decoration: none;">
          <button style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; border: none; padding: 12px 24px; border-radius: 8px; font-size: 16px; font-weight: 600; cursor: pointer; box-shadow: 0 4px 6px rgba(0,0,0,0.1); transition: all 0.3s ease;">
            📋 Ver Reporte Completo
          </button>
        </a>
        <div style="border-top: 1px solid #dee2e6; padding-top: 15px; margin-top: 15px;">
          <p style="margin: 0; font-size: 12px; color: #6c757d; font-style: italic;">
            *Este reporte fue generado automáticamente el ${formattedDate}*
          </p>
          <p style="margin: 5px 0 0 0; font-size: 14px; font-weight: 600; color: #495057;">
            Equipo de Desarrollo - Imagine Apps
          </p>
        </div>
      </div>
      
    </div>
  `;

  return html;
}