function getIdCompanyByNitOrName(nit = null, name = null){

  let company = null;
  let busqueda = null;
  
  // Búsqueda por NIT
  busqueda = nit.toLowerCase()
  if (!busqueda) return null;

  company =  Companies.find(c => c.nit === busqueda);
  if (company) return company.id;

  // Búsqueda por nombre
  busqueda = name.toLowerCase();
  if (!busqueda) return null;

  company = Companies.find(c => 
    busqueda.includes(c.name.toLocaleLowerCase())
  );
  if (company) return company.id;

  return null;
}

function getIdFacturaProveedorCompanyByNitOrName(companyId){

  company =  Companies.find(c => c.id === companyId);
  if (company) return company.journalFacturaProveedor;

  return null;
}

function obtenerCorreosPorProcesar() {

  const sheetBdCorreos = SpreadsheetApp.openById(IdBdCorreos).getSheetByName("BD");

  // 1. Obtener los IDs ya registrados
  const correosExistentes = new Set(
    LibSheetUtils.getColumnValues(sheetBdCorreos, 1, 2)
  );

  // 2. Obtener los mensajes recientes con adjuntos
  const mensajes = LibGmailUtils.obtenerCorreosRecientesConArchivos(60);

  // 3. Filtrar mensajes nuevos y con archivos útiles
  return mensajes.filter(msg => {
    if (correosExistentes.has(msg.getId())) return false;

    const attachments = msg.getAttachments();
    return attachments.some(att => {
      const nombre = att.getName().toLowerCase();
      const mime = att.getContentType();

      return (
        nombre.endsWith('.xml') ||
        zipMimeTypes.has(mime)
      );
    });
  });
}

function procesarCorreo(mensaje) {
  const id = mensaje.getId(); // ID único del mensaje
  Logger.log(`Procesando el correo con Id: ${id}`)

  const asunto = mensaje.getSubject();
  const remitente = mensaje.getFrom();
  const fecha = Utilities.formatDate(
    mensaje.getDate(),
    Session.getScriptTimeZone(),
    "yyyy/MM/dd");
  const body = mensaje.getPlainBody();

  const oc = extraerNumeroOrdenCompra(body)
  const fullTextXML = LibGmailUtils.obtenerContenidoXMLDeCorreo(mensaje);
  const match = fullTextXML.match(/<cac:Attachment>([\s\S]*?)<\/cac:Attachment>/);
  const xmlDescripcion = match ? match[1].trim() : null;

  const data = parseInvoiceXML(xmlDescripcion)

  Logger.log("Se completó la extracción para el correo.")

  return {
    id,
    asunto,
    remitente,
    fecha,
    resumen: body.slice(0, 300),
    oc,
    data,
    linkPDF: null,
    facturaProveedor: null
  };
}

/**
 * Extrae archivos PDF que están dentro de archivos ZIP adjuntos a múltiples mensajes de Gmail.
 * @param {string[]} listaIds - Lista de IDs de mensajes de Gmail.
 * @returns {Blob[]} Lista de archivos PDF extraídos de todos los ZIP.
 */
function extraerPdfDeZipEnMensajes(listaIds) {
  const pdfsExtraidos = [];

  for (const mensajeId of listaIds) {
    try{
      const mensaje = GmailApp.getMessageById(mensajeId);
    }catch{
      throw new Error ("NO se encontró el mensaje, recuerda que este flujo se debe ejecutar desde un correo de facturas.")
    }
    const adjuntos = mensaje.getAttachments();

    for (const adjunto of adjuntos) {
      const mime = adjunto.getContentType().toLowerCase();

      if (mime === "application/zip" || mime === "application/x-zip-compressed") {
        const archivosZip = Utilities.unzip(adjunto);

        for (const archivo of archivosZip) {
          if (archivo.getName().toLowerCase().endsWith('.pdf')) {
            pdfsExtraidos.push({
              archivo,
              mensajeId
            });
          }
        }
      }
    }
  }

  return pdfsExtraidos;
}

/**
 * Sube archivos a una carpeta de Google Drive.
 * @param {Blob[]} archivos - Lista de archivos (blobs) a subir.
 * @param {string} folderId - ID de la carpeta de destino en Drive.
 * @returns {string[]} Lista de URLs de los archivos subidos.
 */
function subirArchivosADrive(archivos, folderId) {
  const carpeta = DriveApp.getFolderById(folderId);
  const urls = [];

  archivos.forEach(archivo => {
    const archivoSubido = carpeta.createFile(archivo);
    urls.push(archivoSubido.getUrl());
  });

  return urls;
}

/**
 * Obtiene (o valida) la carpeta Drive donde se debe almacenar un PDF de factura.
 * @param {string} invoiceDate - Fecha de emisión de la factura (formato "YYYY-MM-DD").
 * @param {string} nitCliente - Nombre del cliente o registro, usado para identificar la carpeta.
 * @returns {Promise<string|null>} ID de la carpeta correspondiente o null si no existe.
 */
function getDriveFolders(invoiceDate, nitCliente) {
  const customer = getFolferName(nitCliente); // Asume que devuelve un nombre de carpeta válido
  const date = new Date(invoiceDate);
  const currentYear = date.getFullYear().toString();
  const invoiceMonth = getCurrentMonth(date.getMonth()); // Asume que devuelve "Enero", "Febrero", etc.

  const folderYear = getForlder('1z-z1ML-LaAEDWmfVrdpy2FrT564T97No', currentYear, false);
  if (!folderYear) {
    Logger.log(`Carpeta de año ${currentYear} no encontrada.`);
    return null;
  }

  const folderMonth = getForlder(folderYear.getId(), invoiceMonth);
  if (!folderMonth) {
    Logger.log(`Carpeta del mes ${invoiceMonth} no encontrada en año ${currentYear}.`);
    return null;
  }

  const folderFinal = getForlder(folderMonth.getId(), customer);
  if (!folderFinal) {
    Logger.log(`Carpeta del cliente ${customer} no encontrada en ${invoiceMonth}/${currentYear}.`);
    return null;
  }

  return folderFinal.getId();
}

function getForlder(parentFolderId, forderName, createFolder = false) {
  const parentFolder = DriveApp.getFolderById(parentFolderId);
  const folders = parentFolder.getFolders();

  while (folders.hasNext()) {
    const folder = folders.next();
    if (folder.getName().replace(' ', '').includes(forderName.replace(' ', ''))) {
      Logger.log("Carpeta encontrada: " + folder.getId());
      return folder;
    }
  }
  if (createFolder) {
    const folderCreated = parentFolder.createFolder(forderName);
  }
  Logger.log(`No se encontró una carpeta ${forderName}.`);
  return null;
}

/**
 * Busca un valor en una columna específica y actualiza otra celda en esa misma fila.
 *
 * @param {string} hojaNombre - Nombre de la hoja donde buscar y escribir.
 * @param {number} indiceColBusqueda - Número de columna donde buscar (comienza en 1).
 * @param {string} valorBusqueda - Valor que se desea encontrar.
 * @param {number} indiceColEscritura - Número de columna donde se escribirá el nuevo valor (comienza en 1).
 * @param {any} nuevoValor - El valor que se escribirá en la celda.
 */
function buscarYActualizarCelda(hojaNombre, indiceColBusqueda, valorBusqueda, indiceColEscritura, nuevoValor) {
  const hoja = SpreadsheetApp.openById("1t0_mXPp3VWwYKor1uR57dAlF__IqCLWdHIg5mUtzKrw").getSheetByName(hojaNombre);
  if (!hoja) throw new Error(`❌ La hoja "${hojaNombre}" no existe.`);

  const datos = hoja.getDataRange().getValues();
  for (let i = 1; i < datos.length; i++) { // comienza desde 1 para omitir encabezado

    let celda = datos[i][indiceColBusqueda - 1];
    if (celda.includes(valorBusqueda)) {
      hoja.getRange(i + 1, indiceColEscritura).setValue(nuevoValor);
      Logger.log(`✅ Celda actualizada en fila ${i + 1}, columna ${indiceColEscritura}`);
      return;
    }
  }

  Logger.log(`⚠️ No se encontró el valor "${valorBusqueda}" en la columna ${indiceColBusqueda}`);
}

function facturasVsOrdenes(facturas, ordenes) {
  const iguales = [];

  for (let orden of ordenes) {
    const factura = facturas.find(f => f.oc === orden.name);
    if (!factura) {
      Logger.log(`No se encontró orden para factura OC: ${orden?.oc}`);
      continue;
    }

    const totalFactura = parseFloat(factura.totales.total);
    const totalOrden = parseFloat(orden.amount_total);

    const diferencia = Math.abs(totalFactura - totalOrden);

    if (diferencia > 1) { // tolerancia de 1 peso
      Logger.log(`Diferencia detectada en OC ${factura.oc}: ${totalFactura} vs ${totalOrden}`);
      buscarYActualizarCelda(
        "BD",
        7,
        factura.numeroFactura,
        11,
        `Diferencia detectada en OC ${factura.oc}: ${totalFactura} vs ${totalOrden}`
      )

      addMessageToOrdenInOdoo(orden.id, orden.amount_total, factura.totales.total);
      continue;
    }

    iguales.push(orden);

  }

  return iguales;
}

function asignarNombreProducto(detalleFacturasSheet, bdProductosOdoo) {
  detalleFacturasSheet.forEach(factura => {
    factura.items.forEach(item => {
      const desc = normalizar(item.descripcion);

      // 1. Buscar coincidencia exacta
      let producto = bdProductosOdoo.find(p =>
        normalizar(p.product_tag) === desc
      );

      // 2. Si no se encuentra, buscar inclusión más confiable
      if (!producto) {
        producto = bdProductosOdoo.find(p => {
          const tag = normalizar(p.product_tag);
          return (
            (tag.includes(desc) && desc.length >= 5) ||
            (desc.includes(tag) && tag.length >= 5)
          );
        });
      }

      // 3. Asignar nombre
      let nombre = producto ? producto.product_name : "Varios";
      item.nombre = nombre;

      let idOdoo = getIdProductoByName(nombre, factura.cliente.idOdoo)
      item.idOdoo = idOdoo;
    });
  });

  return detalleFacturasSheet;
}

function agregarInfoAlProducto(detalleFacturasSheet, bdProductosOdoo) {
  detalleFacturasSheet.forEach(factura => {

    let cuentaDiario = getIdFacturaProveedorCompanyByNitOrName(factura.cliente.idOdoo)
    factura.cuentaDiario = cuentaDiario;

    let infoFechas = getFechaContablePorFechaFacturacion(
      factura.cliente.idOdoo,
       factura.proveedor.idOdoo,
       factura.fechaEmision
    )
    factura.fechaContable = infoFechas.date;
    factura.referencia = infoFechas.highest_name;

    /*let analyticDistribution = getAnaliticasProveedor(
      factura.proveedor.idOdoo,
      factura.cliente.idOdoo
    )
    factura.analiticas = analyticDistribution;*/

    factura.items.forEach(item => {

      // 1. Definimos el valor a buscar // Descripción del producto // Tag en Odoo
      const desc = item.descripcion;

      // 2. Obtenemos el nombre producto buscando en la BD del archivo 
      let producto = buscarProductoPorEtiquetaX(desc, bdProductosOdoo)
      
      // 3. Asignar nombre
      let nombre = producto ? producto.product_name : "Varios";
      let cuenta = producto ? producto.account_name : "Producto en Transito";
      let analiticas = producto ? producto.analytic : false;
      analiticas = analiticas ? JSON.parse(analiticas) : false;

      item.nombre = nombre;
      item.cuenta = cuenta;
      item.analiticas = analiticas;

      let idOdoo = getIdProductoByName(nombre, factura.cliente.idOdoo);
      item.idOdoo = idOdoo;

      let idCuentaOdoo = getIdCuentaProductoByName(cuenta, factura.cliente.idOdoo, factura.proveedor.idOdoo);
      item.idCuentaOdoo = idCuentaOdoo;

      let detalleProducto = getDetalleProducto(idOdoo, factura.cliente.idOdoo)
      item.unidadMedida = detalleProducto?.uom_id;
    });
  });

  return detalleFacturasSheet;
}


function normalizar(str) {
  return (str || "")
    .toString()
    .replace(/\s+/g, ' ')     // múltiples espacios → uno solo
    .replace(/\r?\n|\r/g, '') // elimina saltos de línea
    .trim()                   // elimina espacios al inicio y final
    .toLowerCase();           // opcional: si no importa mayúsculas
}

function obtenerTagProducto(nombreProducto) {
  if (typeof nombreProducto !== 'string') return nombreProducto;

  const partes = nombreProducto.split(":");

  if (partes.length > 1) {
    const posibleCodigo = partes[0].trim();
    const posibleTag = partes.slice(1).join(":").trim();

    // Si comienza por "P" y hay algo después del ":"
    if (posibleCodigo.startsWith("P") && posibleTag.length > 0) {
      return posibleTag;
    }
  }

  // Si no cumple las condiciones, retornar el nombre completo
  return nombreProducto;
}


function obtenerNumeroCuenta(accountDisplayName) {
  if (typeof accountDisplayName !== 'string') return null;
  const match = accountDisplayName.trim().match(/^(\d+)/);
  return match ? match[1] : null;
}

function eliminarDuplicadosProductos(productos) {
  const vistos = new Set();

  const unicos = productos.filter(item => {
    const clave = `${item.product_name}||${item.product_tag}`; // clave compuesta
    if (vistos.has(clave)) return false;
    vistos.add(clave);
    return true;
  });

  return unicos;
}

function filtrarNuevosProductos(productosUnicos, productosExistentes) {
  if (!productosExistentes?.length || productosExistentes <= 1) return productosUnicos;
  if (!productosUnicos?.length) return null;

  const clavesExistentes = new Set(
    productosExistentes.map(p =>
      `${p.product_name?.trim()}||${p.product_tag?.trim()}`
    )
  );

  return productosUnicos.filter(p => {
    const clave = `${p.product_name?.trim()}||${p.product_tag?.trim()}`;
    
    return !clavesExistentes.has(clave);
  });
}

function construirLineasFacturaProveedor(factura) {
  return factura.items.map((item, index) => {
    const impuestos = item.impuestos?.map(i => [4, i.idOdoo]) || [];

    return [
      0,
      "virtual_" + index,  // "virtual_15" si así lo requiere tu integración
      {
        sequence: 100,
        product_id: item.idOdoo,
        name: item.descripcion,
        account_id: item.idCuentaOdoo,
        analytic_distribution: item?.analiticas ?? false, // si aplica
        quantity: Number(item.cantidad) || 0,
        product_uom_id: item.unidadMedida || 13, // UOM fijo, ajusta según necesidad
        price_unit: Number(item.precioUnitario) || 0,
        discount: 0,
        tax_ids: impuestos,
        partner_id: factura.proveedor.idOdoo,
        currency_id: 8, // asumiendo COP
        display_type: "product"
      }
    ];

    /**
     * [
            [
              0,
              "virtual_15",
              {
                "sequence": 100,
                "product_id": 1053,
                "name": "SHIELD HPH 10DU (SHIELD HPH 10DU)",
                "account_id": 2586,
                "analytic_distribution": {
                  "12": 5.7700000000000005,
                  "17": 36.2,
                  "19": 53.61,
                  "20": 0.5700000000000001,
                  "41": 0.76,
                  "42": 3.09
                },
                "quantity": 8,
                "product_uom_id": 13,
                "price_unit": 37702,
                "discount": 0,
                "tax_ids": [
                  [
                    4,
                    130
                  ]
                ],
                "partner_id": 1167,
                "currency_id": 8,
                "display_type": "product"
              }
            ]
          ]
     */
  });
}

