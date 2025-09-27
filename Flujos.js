function flujoActualizarAnalisisDeVentas() {

  const spreadsheet_id = "1bV3zA5XX_kFuA5v_0CoE-FFqOsUvxV7TJ9PCOoIep64";
  const sheet_name = "Raw Data";
  const column_check = "C";         // Columna donde están los nombres de facturas existentes
  const header_row = 5;                                   // fila de cabecera
  const data_start = header_row + 1;                      // donde empiezan los registros
  const column_check_INDEX = column_check.charCodeAt(0) - 64;     // C → 3

  const ss = SpreadsheetApp.openById(spreadsheet_id);
  const sheet = ss.getSheetByName(sheet_name);

  let session_id = LibOdooUtils.odooGetSessionId("EZ")
  
  let facturasIds = LibOdooAPIs.apiContabilidadGetIdsFacturas(session_id)
  let notasCreditosIds = LibOdooAPIs.apiContabilidadGetIdsNotasCredito(session_id)

  let allIds = [...facturasIds, ...notasCreditosIds]
  allIds.sort((a, b) => a - b);

  Logger.log("Facturas: " + facturasIds.length)
  Logger.log("Notas Crédito: " + notasCreditosIds.length)
  Logger.log("Todos: " + allIds.length)

  let facturasDetalle = LibOdooAPIs.apiContabilidadGetDetalleFacturas(session_id, allIds)

  let data_c = LibSheetUtils.getColumnValues(sheet, column_check_INDEX, data_start)

  // Armo las filas nuevas
  const filasConstruidas = LibAnlisisDeVentas.utilsConstruirFilasParaRegistrar(facturasDetalle, data_c);

  Logger.log("Filas a registrar : " + filasConstruidas.length)
  Logger.log(JSON.stringify(filasConstruidas))

  if (filasConstruidas.length > 0) {
    
    // Inserto todo de una vez con USER_ENTERED para respetar fórmulas
    const rango = sheet.getRange(
      sheet.getLastRow() + 1,
      1,
      filasConstruidas.length,
      filasConstruidas[0].length
    );

    rango.setValues(filasConstruidas);
    SpreadsheetApp.flush()
  }

}

