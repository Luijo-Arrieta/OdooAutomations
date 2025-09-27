function pruebas() {

  LibSheetUtils.UI_showStatus("Ejecutando extracción de datos del Sheet y Odoo.")
  const allCorreosSheet = LibSheetUtils.sheetToJSON(
    "BD",
    true,
    IdBdCorreos
  );

  const bdProductosOdoo = LibSheetUtils.sheetToJSON(
    "BD_Productos",
    true,
    IdBdCorreos
  )

  let correosPendientes = allCorreosSheet.filter(f => f.facturaProveedor === "" && f["Procesar?"] === true);
  if (!correosPendientes?.length > 0) {
    throw new Error("No se encontraron facturas disponibles para trabajar. Recuerda marcar la casilla de 'Procesar' y tener la celda correspondeinte a 'FacturaCompra' vacía.")
  }

  let correosFacturasNoRecurrentes = correosPendientes.filter(f => f.oc === "");
  Logger.log(`Se extrayeron ${correosFacturasNoRecurrentes.length} facturas para procesar.`)
  let detalleFacturasSheet = correosFacturasNoRecurrentes.map(f => JSON.parse(f.data))

  let detalleFacturasSheetV2 = agregarInfoAlProducto(
    detalleFacturasSheet,
    bdProductosOdoo)

  LibSheetUtils.UI_showSuccess("Información consultada de forma certera. \nSe procede a crear las facturas.")
  
  let borradores = []

  for (const factura of detalleFacturasSheetV2) {
    let productos = construirLineasFacturaProveedor(factura);
    
    if (!productos?.length > 0){
      buscarYActualizarCelda(
        "BD",
        7,
        factura.numeroFactura,
        9,
        "No se detectaron productos para la factura. Columna 'data'"
      )
      continue;
    }

    let borrador = crearFacturaProveedor(factura, productos)

    borrador.facProveedor = factura.numeroFactura;
    borrador.proveedor = factura.proveedor.nombre;
    borrador.cliente = factura.cliente.nombre;
    borrador.fechaEmision = factura.fechaEmision;

    // Se puede enviar la confirmación de forma masiva, pero si falla uno, fallaran todos, así lo manjea Odoo internamente. Mejor se evita.
    let fueConfirmada = confirmarFacturaNoRecurrente(borrador.id);

    borrador.fueConfirmada = fueConfirmada;
    
    borrador.timeStamp = Utilities.formatDate(new Date, Session.getScriptTimeZone(), "yyyy-MM-dd HH:mm")
    borradores.push(borrador)
  }

  let idsBorradores = borradores?.map(b => b.id) ?? false;

  if (!idsBorradores) {
    throw new Error("No se evidencian Ids de Borrador para confirmar")
  }

  let detalleBorradores = getDetalleFacturaProveedor(idsBorradores, [1,2,3,4])
  
  if (detalleBorradores){
    let detalleMap = new Map(detalleBorradores.map(d => [d.id, d.name]));
    borradores.forEach(b => {
      let name = detalleMap.get(b.id) || "/";
      b.name = name;

      if (b.fueConfirmada){
        buscarYActualizarCelda(
          "BD",
          7,
          b.facProveedor,
          9,
          name 
        )
      }
    })
  }

  LibSheetUtils.jsonToSheet(
    borradores,
    "FacNoRe",
    true,
    IdBdCorreos
  )

  LibSheetUtils.UI_showSuccess("Registros históricos realizados con éxito.")

}

function actualizarBdCorreos() {
  // Consulta correos recientes que contenga archivos 
  // y los filtra por correos existebtes en la base de datos de correos
  //LibSheetUtils.UI_showStatus("Consultando correos recientes por procesar...")
  Logger.log("Consultando correos recientes por procesar...");
  const correosPorProcesar = obtenerCorreosPorProcesar()
  //LibSheetUtils.UI_showSuccess(`${correosPorProcesar?.length} por procesar. \nInicia la extracción de información de los XML`)
  Logger.log(`${correosPorProcesar?.length} por procesar. \nInicia la extracción de información de los XML`)

  // Se extrae la información los correos por procesar
  let dataCorreosProcesados = [];

  try {
    for (const correo of correosPorProcesar) {
      const resultado = procesarCorreo(correo);
      dataCorreosProcesados.push(resultado);
    }
  }
  catch (error) {
    Logger.log(`Error: ${error.message}`)
  }
  finally {
    //guardarEnSheet(data); // tu función para guardar
    Logger.log(`Se procede a registrar la data. ${dataCorreosProcesados.length} por registrar.`)
    LibSheetUtils.jsonToSheet(
      dataCorreosProcesados,
      "BD",
      true,
      IdBdCorreos
    )
  }
}

function ExtraerYCargarFacturaPDF() {
  const registros = LibSheetUtils.sheetToJSON(
    "BD",
    true,
    "1t0_mXPp3VWwYKor1uR57dAlF__IqCLWdHIg5mUtzKrw"
  );

  const registrosFiltrados = registros.filter(r => r.linkPDF === "");

  if (!registrosFiltrados) {
    LibSheetUtils.UI_showStatus("No se evidenciaron registros con falta de 'linkPDF'")
    
    return;
  }

  const facturas = registrosFiltrados
    .map(r => {
      try {
        const dataObj = JSON.parse(r.data);
        return {
          id: r.id, // asumir que este es el ID del mensaje Gmail (ajusta si es otro campo)
          fecha: dataObj.fechaEmision,
          cliente: dataObj.cliente?.identificacion
        };
      } catch (e) {
        console.warn(`❌ Error al parsear data en id ${r.id}`);
        return null;
      }
    })
    .filter(Boolean);

  // 1. Extraer PDFs desde los mensajes
  const listaIds = facturas.map(f => f.id);
  Logger.log(`Lista de IDs para extraer PDFs: ${listaIds}`)

  const pdfsConMensaje = extraerPdfDeZipEnMensajes(listaIds); // [{ archivo, id }]

  for (const factura of facturas) {
    const folderId = getDriveFolders(factura.fecha, factura.cliente);
    if (!folderId) {
      console.warn(`📭 No se encontró carpeta para ${factura.cliente} / ${factura.fecha}`);
      continue;
    }

    // 2. Buscar el archivo PDF correspondiente a este mensaje
    const pdf = pdfsConMensaje.find(p => p.id === factura.id);
    if (!pdf) {
      console.warn(`📎 No se encontró PDF para mensaje ${factura.id}`);
      continue;
    }

    // 3. Subir PDF a Drive
    const urls = subirArchivosADrive([pdf.archivo], folderId);
    console.log(`✅ PDF subido para ${factura.cliente}: ${urls[0]}`);

    // 4. (opcional) Actualizar la hoja con el link
    buscarYActualizarCelda(
      "BD",
      1,
      factura.id,
      8,
      urls
    )
  }
}

function CrearYConfirmarFacturasRecurrentesProveedor() {

  let allfacturasSheet = LibSheetUtils.sheetToJSON(
    "BD",
    true,
    IdBdCorreos
  );

  let facturasPendientes = allfacturasSheet.filter(f => f.facturaProveedor == "" && f["Procesar?"] == true);
  if (!facturasPendientes?.length > 0) {
    throw new Error("No se encontraron facturas disponibles para trabajar. Recuerda marcar la casilla de 'Procesar' y tener la celda correspondeinte a 'FacturaCompra' vacía.")
  }

  let facturasRecurrentes = facturasPendientes.filter(f => f.oc != "");
  LibSheetUtils.UI_showSuccess(`Se extrayeron ${facturasRecurrentes.length} facturas para procesar.`)
  //let facturasNoRecurrentes = facturasPendientes.filter(f => f.oc == "");

  /*LibSheetUtils.UI_showSuccess(`${facturasPendientes.length} Pendientes.\n ${facturasRecurrentes.length} Recurrentes. ${facturasNoRecurrentes.length} No recurrentes.`)*/

  let detalleFacturasPendientesSheet;
  let ordenesConFacturasPorConfirmar = [];

  if (!facturasRecurrentes?.length > 0) {
    throw new Error("No se encontraron facturas disponibles para trabajar. Recuerda marcar la casilla de 'Procesar' y tener la celda correspondeinte a 'FacturaCompra' vacía.")
  }

  detalleFacturasPendientesSheet = facturasRecurrentes.map(f => {
    const parsed = JSON.parse(f.data);
    return {
      oc: f.oc,
      ...parsed
    };
  });

  let ocs = detalleFacturasPendientesSheet.map(f => f.oc)

  let detalleOrdenesFromOdoo = getOrderDataFromOdoo(ocs)
  if (!detalleOrdenesFromOdoo?.length > 0) {
    throw new Error("No se encontraron las órdenes al buscarlas en Odoo.")
  }

  ordenesConFacturasPorConfirmar = detalleOrdenesFromOdoo
    .filter(f => f.invoice_count > 0)
    .map(f => (
      { id: f.id, nameOrder: f.name, invoice_id: Math.max(...f.invoice_ids) })
    );

  LibSheetUtils.UI_showSuccess(`Se encontraron en Odoo ${detalleOrdenesFromOdoo.length} órdenes, de las cuales ${ordenesConFacturasPorConfirmar.length} cuentan con facturas en borrador.`)

  Logger.log(`Ordenes con facturas sin confirmar: ${ordenesConFacturasPorConfirmar?.length} \n ${JSON.stringify(ordenesConFacturasPorConfirmar)}`)

  try {

    // Se mantienen solo aquellas órdenes que no tengan facturas creadas
    detalleOrdenesFromOdoo = detalleOrdenesFromOdoo.filter(f => f.invoice_count < 1)
    if (!detalleOrdenesFromOdoo?.length > 0) {
      Logger.log("Error: No se encontraron las órdenes al buscarlas en Odoo.")
      return;
    }
    Logger.log("Ordenes sin borradores de factura: " + detalleOrdenesFromOdoo?.length)

    let ordenesPorFacturar = facturasVsOrdenes(
      detalleFacturasPendientesSheet,
      detalleOrdenesFromOdoo)

    LibSheetUtils.UI_showSuccess(`${ordenesPorFacturar.length} son aptas para facturar.`)

    if (!ordenesPorFacturar?.length > 0) {
      Logger.log("No hay ordenes por facturar, revidar los mensajes en las ordenes.")
      return
    }
    Logger.log("Ordenes a facturar: " + ordenesPorFacturar.length)

    let idsOrdenesPorFacturar = ordenesPorFacturar.map(o => o.id)
    Logger.log(JSON.stringify(ordenesPorFacturar.map(f => f.name)))

    createInvoiceOnOdoo(idsOrdenesPorFacturar);

    detalleOrdenesFromOdoo = getOrderDataFromOdoo(ocs)
    if (!detalleOrdenesFromOdoo?.length > 0) {
      Logger.log("No se encontraron las órdenes al buscarlas en Odoo.");
      return;
    }

    ordenesConFacturasPorConfirmar = detalleOrdenesFromOdoo
      .filter(f => f.invoice_count > 0)
      .map(f => (
        { id: f.id, nameOrder: f.name, invoice_id: Math.max(...f.invoice_ids) })
      );

  } finally {
    LibSheetUtils.UI_showSuccess(`Se pasaran a confirmar ${ordenesConFacturasPorConfirmar.length} facturas.`)

    if (ordenesConFacturasPorConfirmar.length < 1) {
      return;
    }

    for (const orden of ordenesConFacturasPorConfirmar) {

      Logger.log(`Confirmado: ${JSON.stringify(orden)}`)

      const facturaDian = detalleFacturasPendientesSheet.find(f => f.oc === orden.nameOrder)

      const fecha = facturaDian?.fechaEmision;
      if (!fecha) {
        Logger.log("No se cuenta con fecha para confirmar la factura.")
        continue
      }
      Logger.log("Fecha: " + fecha)

      let updateFecha = actualizarFechaFactura(orden.invoice_id, orden.id, fecha)
      if (updateFecha === null) {
        Logger.log("Error al actualziar la fecha. Continua con el siguiente regstro.")
        continue;
      }
      Logger.log("Fecha de factura actualizada.")

      const facturaData = confirmarInvoiceOnOdoo(orden.invoice_id, orden.id);

      if (facturaData === null) {
        Logger.log("Fallo al confirmar la factura.");
        continue;
      }

      Logger.log("Se confirmó la factura")

      buscarYActualizarCelda(
        "BD",
        7,
        facturaDian.numeroFactura,
        9,
        orden.invoice_id)
    }
  }
}

function actualizarBdProductos() {
  const companiesId = Companies.map(c => c.id)

  companiesId.forEach(company => {
    const ids = getIdFacturasProveedor(company);
    const facturas = getDetalleFacturaProveedor(ids, [company]);


    const productosExistentes = LibSheetUtils.sheetToJSON(
      "BD_Productos",
      true,
      IdBdCorreos)

    const productosOdoo = [];

    facturas.forEach(factura => {
      const { name, invoice_date, invoice_line_ids } = factura;

      invoice_line_ids.forEach(linea => {
        const producto = {
          product_name: normalizar(linea.product_id?.display_name ?? null),
          product_tag: normalizar(obtenerTagProducto(linea.name)),
          account_number: obtenerNumeroCuenta(linea.account_id?.display_name),
          account_name: linea.account_id?.display_name ?? null,
          analytic: linea?.analytic_distribution ?? false,
          name,
          invoice_date
        };

        productosOdoo.push(producto);
      });
    });

    Logger.log(`Productos Odoo: ${productosOdoo.length}`);

    const productosUnicosOdoo = eliminarDuplicadosProductos(productosOdoo)
    Logger.log(`Productos únicos: ${productosUnicosOdoo.length}`)

    const productosPorRegistra = filtrarNuevosProductos(productosUnicosOdoo, productosExistentes)
    Logger.log(`Productos por registrar: ${productosPorRegistra?.length} Compañia: ${company}`)

    LibSheetUtils.jsonToSheet(
      productosPorRegistra,
      "BD_Productos",
      true,
      IdBdCorreos
    )
  })
}
