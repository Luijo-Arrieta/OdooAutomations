/**
 * Función principal para ejecutar el proceso completo desde la librería.
 * Se ejecuta en el archivo actual, no requiere SheetID.
 * 
 * @param {number} mesPersonalizado - Mes específico (opcional, 1-12).
 */
function flujoOrdenesProduccion(mesPersonalizado = null) {
  try {
    // Obtener session_id de Odoo
    let session_id = LibOdooUtils.odooGetSessionId("EZ");

    // Obtener órdenes de producción de Odoo
    const ordenesProduccion = LibOdooAPIs.getOrdenesProduccionCompletadas(session_id, mesPersonalizado);
    Logger.log("Órdenes de producción encontradas: " + ordenesProduccion.length);

    // Valores de Sheets: Hoja, ID, Archivo
    const sheetName = "Data Consumos";
    const sheetId = SpreadsheetApp.getActiveSpreadsheet().getId();

    escribirOrdenesProduccionEnSheet(ordenesProduccion, sheetId, sheetName);
    Logger.log("Órdenes de producción correctamente actualizadas");

  } catch (error) {
    Logger.log("Error al actualizar órdenes de producción: " + error.message);
    throw error;
  }
}

/**
 * Función para ejecutar la consulta de movimientos de stock.
 * 
 * @param {number} mes - Mes específico (1-12). Si no se proporciona, usa el mes actual.
 */
function flujoHistorialMovimientos(mes = null) {
  try {
    // Obtener session_id de Odoo
    let session_id = LibOdooUtils.odooGetSessionId("EZ");

    // Obtener movimientos de stock
    console.log("Obteniendo movimientos de stock...");
    const movimientos = LibOdooAPIs.getMovimientosStock(session_id, mes);

    // Valores de Sheets: Hoja, ID, Archivo
    const sheetName = "Data Inventarios";
    const sheetId = SpreadsheetApp.getActiveSpreadsheet().getId();

    // Escribir en Google Sheets del archivo actual
    console.log("Escribiendo movimientos en Google Sheets...");
    escribirMovimientosStockEnSheet(movimientos, sheetId, sheetName);

    console.log("Proceso completado exitosamente.");

  } catch (error) {
    console.error("Error en la consulta de movimientos de stock:", error);
    throw error;
  }
}


/**
 * Función principal para ejecutar el proceso completo de órdenes de producción por semana.
 * Se ejecuta en el archivo actual, no requiere SheetID.
 * 
 * @param {number} semanaOffset - Offset de semanas (0 = semana actual, -1 = semana anterior, etc.)
 */
function flujoOrdenesProduccionSemanal(semanaOffset = -1) {
  try {
    // Obtener session_id de Odoo
    let session_id = LibOdooUtils.odooGetSessionId("EZ");

    // Obtener órdenes de producción de la semana especificada
    const ordenesProduccion = LibOdooAPIs.getOrdenesProduccionCompletadasSemana(session_id, semanaOffset);
    Logger.log("Órdenes de producción encontradas: " + ordenesProduccion.length);

    // Mostrar información de la semana consultada
    const infoSemanas = LibOdooAPIs.obtenerInfoSemanas();
    const semanaSeleccionada = semanaOffset === 0 ? infoSemanas.actual : 
                              semanaOffset === -1 ? infoSemanas.anterior : 
                              `Semana con offset ${semanaOffset}`;
    
    Logger.log("Semana consultada: " + (semanaSeleccionada.descripcion || semanaSeleccionada));

    // Valores de Sheets: Hoja, ID, Archivo
    const sheetName = "Consumo Semanal";
    const sheetId = SpreadsheetApp.getActiveSpreadsheet().getId();

    // Escribir en Google Sheets del archivo actual
    escribirOrdenesProduccionEnSheet(ordenesProduccion, sheetId, sheetName);
    Logger.log("Órdenes de producción semanales correctamente actualizadas");

  } catch (error) {
    Logger.log("Error al actualizar órdenes de producción semanales: " + error.message);
    throw error;
  }
}


/**
 * Función principal para enviar correo de Análisis de Consumo
 */
function enviarCorreoAnalisisConsumo() {
  enviarCorreoGenerico(CONFIG_ANALISIS_CONSUMO);
}

/**
 * Función principal para enviar reporte de ventas
 */
function enviarCorreoProdSemanal() {
  enviarCorreoGenerico(CONFIG_PROD_SEMANAL);
}

