function CrearFactoring() {
  const sessio_id = LibOdooUtils.odooGetSessionId("EZ");

  /**
   * Se extrae la información de facturas y fechas.
   * Información dispuesta en el SpreadSheet y previamente extraidas del PDF
   */
  const facturasSheetRaw = LibSheetUtils.sheetToJSON(
    "Facturas",
    true
  );
  if(facturasSheetRaw.length <= 0){
    throw new Error(`No se encontró información en la hoja "Factura"`)
  };

  const fechasSheetRaw = LibSheetUtils.sheetToJSON(
    "Fechas",
    true
  )[0]; // La indicación [0] es obligatoria debido a que la función devuelve [{nameHeaderCol:valor}]
  if(!fechasSheetRaw?.fechaPago != "" ){
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
  const facturasSheetRawNC = facturasSheetRawAgrupadas?.NC;
  if (!facturasSheetRawNC || facturasSheetRawNC.length <= 0){
    throw new Error(`No se encontraron facturas clasificadas como NC o Factoring: ${fechasSheetRaw}`)
  };
  Logger.log(`Facturas Sheet Raw NC: ${JSON.stringify(facturasSheetRawNC)}`);

  const facturasSheetProcesadas = procesarNcD1(facturasSheetRawNC, fechaPago);
  const facturasNcSheet = facturasSheetProcesadas?.facturas;
  const descuentoTotal = facturasSheetProcesadas?.importeTotal;
  if (descuentoTotal <= 0) {
    throw new Error(
      `El importante total para la creación del Factoring no cuenta con el valor suficiente. ${JSON.stringify(facturasSheetProcesadas)}`);
  };
  Logger.log(`Descuento total: ${descuentoTotal}`);

  const nameFacturasSheet = facturasNcSheet.map(f => f.numero);
  if (!nameFacturasSheet || nameFacturasSheet.length <= 0){
    throw new Error(`Error al estraer la lista de nombres de facturas a buscar en Odoo: ${
      JSON.stringify(nameFacturasSheet)}`)
  };
  Logger.log(`Lista de nombres de facturas a buscar en Odoo: ${JSON.stringify(nameFacturasSheet)}`);

  const idFacturas = OdooWithGAS.apiFacturasPorPagarGetIdsByNameV2(sessio_id, nameFacturasSheet);
  if (!idFacturas || idFacturas.length <= 0){
    throw new Error(`No se encontraron las facturas ${
      JSON.stringify(nameFacturasSheet)} en Odoo. ${JSON.stringify(idFacturas)}`)
  };
  Logger.log(`IdFacturas: ${JSON.stringify(idFacturas)}`);

  const detalleFacturasByOdoo = OdooWithGAS.clientesFacturasGetDetalleV4(sessio_id, idFacturas);
  if (!detalleFacturasByOdoo || detalleFacturasByOdoo.length <= 0){
    throw new Error(`Error al consultar el detalle de facturas en Odoo: ${JSON.stringify(detalleFacturasByOdoo)}`)
  };

  const detalleFacturas = completarDetalleFacturaD1(detalleFacturasByOdoo, facturasNcSheet);
  if (!detalleFacturas || detalleFacturas.length <= 0){
    throw new Error(`Error al completar el detalle de facturas: ${JSON.stringify(detalleFacturas)}`)
  };
  Logger.log(`Detalle de facturas en Odoo: ${JSON.stringify(detalleFacturas)}`);

  /**
   * Se Definen variables necesarias para el resto del desarrollo
   */
  const company_id = detalleFacturas[0].company_id;
  const currency_id = detalleFacturas[0].currency_id;

  /**
   * Inicia el proceso de creación luego de preparar la infomación
   */
  SpreadsheetApp.getActiveSpreadsheet().toast(
    "Creando Factoring..."
  );
  const dataPayloadFactoring = OdooWithGAS.generarDataPayloadFactoring(
    fechaPago,
    company_id,
    currency_id,
    descuentoTotal,
    detalleFacturas);

  /**
   * Se crea un asiento contable tipo factoring como borrador
   */
  const idFactoring = OdooWithGAS.apiAsientosContablesCrearFactoring(
    sessio_id, 
    dataPayloadFactoring);
  
  Logger.log(`ID Factoring: ${idFactoring}`);

  /**
   * Se confirma y pasa a publicado el asiento contable de tipo factoring
   */
  OdooWithGAS.apiAsientosContablesConfirmarFactoring(sessio_id, idFactoring);

  /**
   * Se consulta el detalle del factoring, principalmente para obtener los IDs de las lineas agregas.
   * Los IDs de las lineas agregadas son necesarios para realizar el cruce.
   */
  const detalleFactoring =  OdooWithGAS.apiContabilidadGetDetalleV1(sessio_id, [idFactoring]);
  Logger.log(`Detalle de Factoring: ${JSON.stringify(detalleFactoring)}`);

  let ui_ = SpreadsheetApp.getUi()
  let respuesta = ui_.alert(
    "Factoring creado con exito",
    `Nombre: ${detalleFactoring.name} \n
    Valor: ${detalleFactoring.debit} \n
    Acepta para proceder con los cruces o cancela la operación.`,
    ui_.ButtonSet.OK_CANCEL
  )

  if (respuesta === ui_.Button.CANCEL) {
    SpreadsheetApp.getActiveSpreadsheet().toast("Operación cancelada por el usuario.")
    return;
  }

  /**
   * Se inicia el cruce de facturas con las lineas del asiento contable tipo factoring
  **/
  SpreadsheetApp.getActiveSpreadsheet().toast(
    "Cruzando Factoring..."
  );
  OdooWithGAS.cruzarFacturasConFactoring(
    sessio_id, 
    detalleFacturas, 
    detalleFactoring);

}