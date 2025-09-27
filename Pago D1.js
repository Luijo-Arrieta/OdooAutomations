function RealizarPagosD1() {

  const diarioID = getDiario();

  if(!diarioID) throw new Error("Problemas para obtener el diario.");

  const sessio_id = LibOdooUtils.odooGetSessionId("EZ");

  /**
   * Se extrae la información de facturas y fechas.
   * Información dispuesta en el SpreadSheet y previamente extraidas del PDF
   */
  const facturasSheetRaw = LibSheetUtils.sheetToJSON(
    "Facturas",
    true
  );
  if (facturasSheetRaw.length <= 0) {
    throw new Error(`No se encontró información en la hoja "Factura"`)
  };

  const fechasSheetRaw = LibSheetUtils.sheetToJSON(
    "Fechas",
    true
  )[0]; // La indicación [0] es obligatoria debido a que la función devuelve [{nameHeaderCol:valor}]
  if (!fechasSheetRaw?.fechaPago != "") {
    throw new Error(`No se encontró información en la hoja "Fechas"`)
  };

  /**
   * Se selecciona únicamente la fecha de pago y se lanza un error en caso de no exitir
   */
  const fechaPago = fechasSheetRaw.fechaPago;
  if (!fechaPago || fechaPago == null || fechaPago == "") {
    throw new Error(`No se encontró "fecha de pago". FechasSheetRaw: ${JSON.stringify(fechasSheetRaw)}`)
  };
  Logger.log(`Fecha de pago: ${fechaPago}`);


  const facturasSheetRawAgrupadas = agruparFacturasPorTipo(facturasSheetRaw);

  /**
   * FE es la clave para diferenciar este flujo del de crear factoting
   * Y por supuesto la función final.
   */
  if (!facturasSheetRawAgrupadas?.FE || facturasSheetRawAgrupadas?.FE.length <= 0) {
    throw new Error(`No se encontraron facturas clasificadas como NC o Factoring: ${fechasSheetRaw}`)
  };
  Logger.log(`Facturas Sheet Raw FE: ${JSON.stringify(facturasSheetRawAgrupadas?.FE)}`);

  const facturasSheetProcesadas = procesarFacturasD1(facturasSheetRawAgrupadas, fechaPago);
  const facturasFeSheet = facturasSheetProcesadas?.facturas;

  const nameFacturasSheet = facturasFeSheet.map(f => f.numero);
  if (!nameFacturasSheet || nameFacturasSheet.length <= 0) {
    throw new Error(`Error al estraer la lista de nombres de facturas a buscar en Odoo: ${JSON.stringify(nameFacturasSheet)}`)
  };
  Logger.log(`Lista de nombres de facturas a buscar en Odoo: ${JSON.stringify(nameFacturasSheet)}`);
  Logger.log(`Facturas procesadas: ${JSON.stringify(facturasFeSheet)}`);

  const idFacturas = OdooWithGAS.apiFacturasPorPagarGetIdsByNameV2(sessio_id, nameFacturasSheet);
  if (!idFacturas || idFacturas.length <= 0) {
    throw new Error(`No se encontraron facturas por pagar, se buscó por: ${JSON.stringify(nameFacturasSheet)} en Odoo. ${JSON.stringify(idFacturas)}`)
  };
  Logger.log(`IdFacturas: ${JSON.stringify(idFacturas)}`);

  const detalleFacturasByOdoo = OdooWithGAS.clientesFacturasGetDetalleV4(sessio_id, idFacturas);
  if (!detalleFacturasByOdoo || detalleFacturasByOdoo.length <= 0) {
    throw new Error(`Error al consultar el detalle de facturas en Odoo: ${JSON.stringify(detalleFacturasByOdoo)}`)
  };

  const detalleFacturas = completarDetalleFacturaD1(detalleFacturasByOdoo, facturasFeSheet);
  if (!detalleFacturas || detalleFacturas.length <= 0) {
    throw new Error(`Error al completar el detalle de facturas: ${JSON.stringify(detalleFacturas)}`)
  };
  Logger.log(`Detalle de facturas: ${JSON.stringify(detalleFacturas)}`);

  /**
   * Inicia el proceso de creación luego de preparar la infomación
   */
  SpreadsheetApp.getActiveSpreadsheet().toast(
    "Creando Pago para cada Factura..."
  );

  /**
   * Se realiza un pago agrupado como en Oxxo
   * Falta agregar la elección de la cuenta de ajuste al peso
   */

  OdooWithGAS.pagoD1Factura(sessio_id, detalleFacturas, diarioID)


}

function getDiario() {
  try {

    const ui = SpreadsheetApp.getUi();

    const response = ui.prompt(
      'Consulta de diario', // Título del popup
      'Por favor, ingrese los 4 últimos dígitos del diario por le que desea filtrar:', // Mensaje del popup
      ui.ButtonSet.OK_CANCEL // Botones: "Aceptar" y "Cancelar"
    );

    if (response.getSelectedButton() == ui.Button.OK_CANCEL) {
      let message = "Operación cancelada por el usuario."
      SpreadsheetApp.getActiveSpreadsheet().toast(message, "Estado", -1);
      return
    }

    let diario = response.getResponseText()

    // Si viene con información
    if (!diario) {
      let message = "Operación cancelada por el usuario."
      SpreadsheetApp.getActiveSpreadsheet().toast(message, "Estado", -1);
      throw new Error('Advertencia: No has introducido ningun diario. La operación ha sido cancelada.');
    }

    Logger.log(`let Diario: ${diario}`)

    let diarioID = LibConciliacionBancaria.getAccountJournalId(diario);

    Logger.log(`let DiarioID: ${JSON.stringify (diarioID)}`)

    return diarioID;

  } catch (error) {
    Logger.log(`Ha ocurrido un error al obtener el diario. ${error}`)
  }
}