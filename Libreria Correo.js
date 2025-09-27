/**
 * SISTEMA MODULAR DE ENVÍO DE CORREOS CON HTML PERSONALIZADO
 * Permite enviar diferentes tipos de reportes con estructuras HTML completamente diferentes
 */


/**
 * Función genérica para enviar correos con diferentes configuraciones
 * @param {Object} config - Configuración del correo
 */
function enviarCorreoGenerico(config) {
  try {
    // Obtener la fecha actual formateada
    const formattedDate = obtenerFechaActual();
    
    // Obtener información de la semana anterior para producción semanal
    let weekInfo = null;
    if (config.subjectPrefix === "Producción Semanal") {
      weekInfo = LibOdooAPIs.obtenerFechasSemanaUTC(-1); // Semana anterior
    }

    // Obtener los datos filtrados
    const data = obtenerDatosFiltrados(config);

    // Verificar si hay datos para enviar
    if (!data || data.length === 0) {
      console.error(`No se encontraron datos con '${config.filterField}' para enviar por correo.`);
      throw new Error(`No hay datos disponibles para ${config.subjectPrefix}`);
    }

    // Obtener la URL del archivo
    const fileUrl = obtenerUrlArchivo(config.spreadsheetId);

    // Construir el cuerpo del correo usando la función personalizada
    const htmlBody = config.htmlGenerator(data, formattedDate, fileUrl, config, weekInfo);

    // Enviar el correo
    MailApp.sendEmail({
      to: config.recipients,
      subject: `${config.subjectPrefix} - ${formattedDate}`,
      htmlBody: htmlBody
    });

    console.log(`Correo enviado exitosamente: ${config.subjectPrefix} con ${data.length} registros - ${formattedDate}`);
    
  } catch (error) {
    console.error(`Error al procesar y enviar el correo ${config.subjectPrefix}:`, error.message);
    throw error;
  }
}

// ===== FUNCIONES AUXILIARES =====

/**
 * Obtiene la fecha actual formateada
 */
function obtenerFechaActual() {
  const today = new Date();
  return Utilities.formatDate(today, Session.getScriptTimeZone(), 'yyyy-MM-dd');
}

/**
 * Obtiene datos filtrados de una hoja de cálculo CON SOPORTE PARA DOS TABLAS
 */
function obtenerDatosFiltrados(config) {
  const rawData = LibSheetUtils.sheetToJSON(
    config.sheetName,
    true,
    config.spreadsheetId,
    config.startRow
  );

  const filteredData = rawData.filter(row =>
    row[config.filterField]?.toString().trim() !== ""
  );

  // Si existe configuración para segunda tabla, obtenerla también
  if (config.startRow2 && config.filterField2) {
    const rawData2 = LibSheetUtils.sheetToJSON(
      config.sheetName,
      true,
      config.spreadsheetId,
      config.startRow2
    );

    // Procesar datos para la segunda tabla
    const processedData2 = [];
    let currentPT = "";
    
    rawData2.forEach(row => {
      // Si la fila tiene valor en PT, actualizar el PT actual
      if (row['PT']?.toString().trim()) {
        currentPT = row['PT'];
      }
      
      // Verificar que tenga componente (no sea solo la fila de agrupación de PT)
      const componente = row['Componentes/Producto']?.toString().trim();
      if (!componente) return;
      
      // Obtener el valor de la columna "Variación %" (porcentaje de variación)
      const percentageValue = row['Variación %'];
      
      // Filtrar por variación >= 5% o <= -5%
      if (typeof percentageValue === 'number' && Math.abs(percentageValue) >= 0.05) {
        // Crear nueva fila con PT poblado y solo columnas desde PT hacia la derecha
        const newRow = {
          'PT': currentPT,
          'Componentes/Producto': row['Componentes/Producto'],
          'Cantidad Teórica': row['Cantidad Teórica'],
          'Cantidad Real': row['Cantidad Real'], 
          'Variación %': row['Variación %']
        };
        processedData2.push(newRow);
      }
    });

    return { tabla1: filteredData, tabla2: processedData2 };
  }

  return filteredData;
}

/**
 * Obtiene la URL del archivo de Google Sheets
 */
function obtenerUrlArchivo(spreadsheetId) {
  if (!spreadsheetId) {
    return SpreadsheetApp.getActiveSpreadsheet().getUrl();
  } else {
    return SpreadsheetApp.openById(spreadsheetId).getUrl();
  }
}