function RealizarPagosIsimo() {
  const sessio_id = LibOdooUtils.odooGetSessionId('EZ')
  //const sessio_id = "session_id=47bd2e2aba0afb57a32cc484092a294b298f5383"

  /**
   * Se Extrae la información del Google Sheet y se procesa
   * Se genera una copia de las facturas para variar el prefijo y se unen para no dejar escapar facturas viejas.
   */
  const dataRaw = LibSheetUtils.sheetToJSON("Facturas", true)
  if(!dataRaw?.length > 0){
    throw new Error("No se encontraron facturas en la hoja 'Facturas'")
  }

  const Data = procesarFacturasIsimo(dataRaw)
  const Fecha = Data.fecha
  Logger.log(`Fecha: ${Fecha}`)
  // Información extraida con éxito
  LibSheetUtils.UI_showSuccess(`Data Extraida con éxito. Fecha: ${Fecha}`)

  /**
   * Se consultan las facturas en Odoo usuando su numero para terminar obteniendo el detalle.
   * Se usan prefijos antiguos y nuevos para no dejar escapar facturas.
   */
  const nameFacturasSheet = Data.facturas.map(f => f.numero)
  if (!nameFacturasSheet?.length > 0){
    throw new Error("Problemas para extraer los nombres de las facturas.")
  }

  const idFacturas = OdooWithGAS.apiFacturasPorPagarGetIdsByNameV2(sessio_id, nameFacturasSheet)
  if (!idFacturas?.length > 0){
    throw new Error("No se encontraron facturas por pagar.")
  }

  const detalleFacturas = OdooWithGAS.clientesFacturasGetDetalleV4(sessio_id, idFacturas)

  /**
   * Se enriquese el detalle de la factura sumandole al detalle de Odoo el detalle de la Google Sheet.
   * Además se toman solo las facturas por pagar.
   */
  const Facturas = completarDetalleFacturaIsimo(detalleFacturas, Data.facturas)
  const NameFacturas = Facturas.map(f => f.name)
  Logger.log(`Listado de facturas encontradas: ${JSON.stringify(NameFacturas)}`)
  // Listado de facturas encontradas: 

  /**
   * Se Definen variables necesarias para el resto del desarrollo
   */
  const company_id = detalleFacturas[0].company_id;
  const currency_id = detalleFacturas[0].currency_id;

  LibSheetUtils.UI_showSuccess(`Se encontraron ${Facturas?.length} en Odoo. Iniciando pago por factura...`)
  /**
   * Se procede con la realización de los pagos.
   * Para este negocio se debe hacer pago por factura y no se debe agrupar como con Oxxo
   */
  OdooWithGAS.pagoPorCadaFactura(sessio_id, Facturas, company_id)

}