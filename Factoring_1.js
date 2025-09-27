function CrearCruzarFactoringIsimo() {
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
  const company_id = Facturas[0].company_id;
  const currency_id = Facturas[0].currency_id;

  const DescuentoTotal = Facturas.reduce((total, factura) => total + (factura.descuento || 0), 0);
  LibSheetUtils.UI_showSuccess(`Se encontraron ${Facturas?.length} en Odoo. Descuento total ${DescuentoTotal}`)

  /**
   * Se valida el descuento, se crea y cruza el factoring (es un especie de NC)
   */
  if (DescuentoTotal <= 0) {
    throw new Error("No se encontró un descuento total mayor a cero.")
   }
  
  const dataPayloadFactoring = OdooWithGAS.generarDataPayloadFactoring(
    Fecha,
    company_id,
    currency_id,
    DescuentoTotal,
    Facturas)

  /**
   * Se crea un asiento contable tipo factoring como borrador
   */
  const idFactoring = OdooWithGAS.apiAsientosContablesCrearFactoring(sessio_id, dataPayloadFactoring)
  Logger.log("Id factoring: " + idFactoring)

  /**
   * Se confirma y pasa a publicado el asiento contable de tipo factoring
   */
  OdooWithGAS.apiAsientosContablesConfirmarFactoring(sessio_id, idFactoring)

  /**
   * Se consulta el detalle del factoring, principalmente para obtener los IDs de las lineas agregas.
   * Los IDs de las lineas agregadas son necesarios para realizar el cruce.
   */
  const detalleFactoring =  OdooWithGAS.apiContabilidadGetDetalleV1(sessio_id, [idFactoring])
  Logger.log("Detalle de factoring")
  Logger.log(JSON.stringify(detalleFactoring))
  Logger.log("Detalle Facturas")
  Logger.log(JSON.stringify(Facturas))
  LibSheetUtils.UI_showSuccess(`Factoring ${detalleFactoring.name} creado con éxito. Iniciando proceso de cruce...`)

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
   */
  OdooWithGAS.cruzarFacturasConFactoring(sessio_id, Facturas, detalleFactoring)

}