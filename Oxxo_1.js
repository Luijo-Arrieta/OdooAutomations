/**
 * Está incompleto
 */
function flujoPagosOxxo() {
  //const sessio_id = "session_id=f3edf790d8d5b39ca0b10a920a86840725d15080"
  const sessio_id = LibOdooUtils.odooGetSessionId('EZ')

  /**
   * Se efectua la extracción y tratamiento de la data.
   */
  const dataRaw = LibSheetUtils.sheetToJSON("Data", true)
  const data = clasificarDataRawPorTipoFactura(dataRaw)
  const factruasSheet = data.facturas
  const ncSheet = data.notasCredito
  Logger.log(`Extracción exitosa de la data.`)
  LibSheetUtils.UI_showSuccess(`Extracción exitosa de la data.`)
  const nameFacturas = factruasSheet.map(f => f.numero)

  /**
   * Se crea la nota crédito dispuesta en el archivo
   */
  if (ncSheet.length > 0) {
    const NC = crearPayloadNCEspecial(ncSheet)
    const resultCreateNC = apiCrearNC_v3(sessio_id, NC)
    const idNC = resultCreateNC.id
    // Se confirma y procesa la NC para que se le asigne un nombre y pase a estado publicado
    apiConfirmarNC_V1(sessio_id, idNC)
    apiProcesarNC_V1(sessio_id, idNC)
    // Se consulta el detalle de la nota crédito creada
    const detalleImportesNC = apiObtenerDetalleImportesNC(sessio_id, [idNC])[0]
    const cantidadResidualNC = detalleImportesNC.amount_residual
    Logger.log("Cantidad residual de la NC: " + JSON.stringify(cantidadResidualNC))
    UI_showSuccess("Cantidad residual de la NC: " + JSON.stringify(cantidadResidualNC))

    /**
     * Se asignan facturas a la nota crédito en tanto sea posible
     */
    const idFacturas = apiObtenerIdsFacturasPorPagarPorNombre(sessio_id, nameFacturas)
    const detalleRawFacturas = apiObtenerDetalleFacturas_V3(sessio_id, idFacturas)
    const detalleFacturas = procesarDetalleFacturaParaPagos(detalleRawFacturas)
    Logger.log(`Se procesarán ${detalleFacturas.length} facturas.`)
    UI_showSuccess(`Se procesarán ${detalleFacturas.length} facturas.`)

    cruzarFeConNc(sessio_id, detalleFacturas, cantidadResidualNC, idNC)
  }
  
  /**
   * Se realiza el pago con aquellas facturas dispuetas para pagar.
   */
  Logger.log(`Inicia la creación del pago.`)
  UI_showSuccess(`Inicia la creación del pago.`)

  var importeFacturas = factruasSheet.reduce(function (suma, factura) {
    return suma + factura.importe;
  }, 0);
  var importeNotasCredito = ncSheet.reduce(function (suma, factura) {
    return suma + factura.importe;
  }, 0);
  // Restar y redondear hacia arriba
  const importeTotal = Math.ceil(importeFacturas - importeNotasCredito);

  Logger.log(`El importe total del pago redondeado hacia arriba es de: ${importeTotal}`)
  UI_showSuccess(`El importe total del pago redondeado hacia arriba es de: ${importeTotal}`)

  const idFacturasPorPagar = clientesFacturasPorPagarGetIdsByName(sessio_id, nameFacturas)
  const active_ids = clientesPagosIniciarPago(sessio_id, idFacturasPorPagar)
  const preInformacion = clientesPagosGetPreInformacion(sessio_id, active_ids)
  const idBorrador = clientesPagosCrearBorradorDePago(sessio_id, active_ids, importeTotal, preInformacion)
  const idPago = clientesPagosConfirmarPago(sessio_id, idBorrador)

  const detallePago = clientesPagosGetInformacionPago(sessio_id, idPago)[0]

  try {
    const dataOutputPago = {
      Pago_name: detallePago.name
    }

    Utils_jsonToSheet([dataOutputPago], "OutPut Pagos", true)

  } finally {
    Logger.log(`Se creó con exito el pago ${detallePago.name}`)
    UI_showSuccess(`Se creó con exito el pago ${detallePago.name}`)
  }

}