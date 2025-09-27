/**
 * Procesa los correos con asunto "Pruebas facturas-no", extrae archivos .zip adjuntos,
 * obtiene el número de orden desde el cuerpo del mensaje, y llama al proceso de validación y facturación.
 * Recorre cada hilo y mensaje, identificando archivos adjuntos .zip que contienen XMLs con datos de facturas.
 * @returns {Promise<void>}
 */

/**
 * Extrae el número de orden de compra de un texto dado.
 * Busca el patrón "Orden de compra:" seguido del número o código.
 * @param {string} text - Texto donde se buscará el número de orden.
 * @returns {string|null} - Retorna el número de orden si se encuentra, o null si no.
 */
function extractOrderNumber(text) {
  const match = text.match(/Orden de compra:\s*(\S+)/i);
  return match ? match[1] : null;
}

/**
 * Procesa un archivo adjunto ZIP relacionado con una orden de compra.
 * Extrae los datos del XML, consulta la orden en Odoo y decide si crear una factura
 * o dejar un comentario en la orden si hay diferencias en los totales.
 * @param {Blob} attachment - Archivo ZIP que contiene el XML con información de la factura.
 * @param {string} orderNumber - Número de la orden de compra en Odoo.
 * @returns {Promise<void>}
 */
function processData(attachment, orderNumber) {
  const dataToFormat = procesarZip(attachment);
  const orderData = getOrderDataFromOdoo(orderNumber);
  const xmlData = dataToFormat.xmlData;
  const pdfBlob = dataToFormat.pdfBlob;
  const issueDate = xmlData.issueDate;
  const nitCliente = xmlData.nitCliente;

  const getFolderCurrentYearAndMonth = validateDriveFolders(issueDate, nitCliente);
  if (getFolderCurrentYearAndMonth == null) {
    Logger.log('Aún no se ha creado la carpeta para guardar las facturas');
    return null;
  }
  console.log(`getFolderCurrentYearAndMonth.getId()  --> ${getFolderCurrentYearAndMonth.getId()}`)
  //loadPDFtoDrive(pdfBlob, getFolderCurrentYearAndMonth.getId());

  if (orderData?.amount_total != xmlData?.totalInvoice) {
    addMessageToOrdenInOdoo(orderData?.id, orderData?.amount_total, xmlData?.totalInvoice);
  } else {
    createInvoiceOnOdoo(orderData?.id);
    loadPDFtoDrive(pdfBlob, getFolderCurrentYearAndMonth.getId());
  }
}

function validateDriveFolders(invoiceDate, nitCliente) {
  const customer = getFolferName(nitCliente);
  const date = new Date(invoiceDate);
  const currentYear = date.getFullYear().toString()
  const invoiceMonth = getCurrentMonth(date.getMonth());
  const folderInvoice = `${invoiceMonth} ${customer}`
  const folderCurrentYear = getForlder('1z-z1ML-LaAEDWmfVrdpy2FrT564T97No', currentYear, false);
  console.log(`folderCurrentYear.getId() --> ${folderCurrentYear.getId()}`)
  const currentMonth = getCurrentMonth();
  const folderMonth = getForlder(folderCurrentYear.getId(), invoiceMonth);
  const folderCurrentMonth = getForlder(folderCurrentYear.getId(), date.getMonth().toString());
  console.log('folderCurrentMonth ----- ', folderCurrentMonth.getId())
  //const folderCurrentMonth = getForlder(folderCurrentYear.getId(), folderInvoice);
  if (folderCurrentYear == null || folderCurrentYear == null) {
    Logger.log(`Aún no se ha creado carpeta ${currentYear} o ${currentMonth}`);
    return null;
  }
  return folderCurrentMonth.getId();
}

function getFolferName(nitCliente) {
  switch (nitCliente) {
    case '35512662':
      return 'EZ';
    case "901646415":
      return "TUTTI";
    case "901646529":
      return "LAZZA";
    default:
      return "ATA";
  }
}

function getCurrentMonth(month = '') {
  const meses = ["ENERO", "FEBRERO", "MARZO", "ABRIL", "MAYO", "JUNIO", "JULIO", "AGOSTO", "SEPTIEMBRE", "OCTUBRE", "NOVIEMBRE", "DICIEMBRE"];
  let monthName = meses[month];
  if (month === '') {
    const currentDate = new Date();
    const monthNumber = (currentDate.getMonth() + 1).toString().padStart(2, '0'); // "05"
    monthName = `${monthNumber}. ${meses[currentDate.getMonth()]}`;
  }
  return monthName;
}

function getForlder_(parentFolderId, forderName, createFolder = false) {
  const parentFolder = DriveApp.getFolderById(parentFolderId);
  const folders = parentFolder.getFolders();

  while (folders.hasNext()) {
    const folder = folders.next();
    if (folder.getName().replace(' ', '').includes(forderName.replace(' ', ''))) {
      Logger.log(`Carpeta encontrada: ${folder.getName()}  ${folder.getId()}`);
      return folder;
    }
  }
  if (createFolder) {
    const folderCreated = parentFolder.createFolder(forderName);
  }
  Logger.log(`No se encontró una carpeta ${forderName}.`);
  return null;
}

function loadPDFtoDrive(pdfBlob, folderId) {
  const folder = DriveApp.getFolderById(folderId);
  folder.createFile(pdfBlob);
  Logger.log(`PDF guardado en Drive:`);
}

/**
 * Descomprime un archivo ZIP recibido como adjunto, busca archivos .xml dentro
 * y extrae su información usando la función getDataOfXML.
 * @param {Blob} attachment - Archivo ZIP adjunto proveniente de un correo.
 * @returns {Object|null} - Objeto con los datos extraídos del XML o null si no se encuentra o hay error.
 */
function procesarZip(attachment) {
  try {
    const rawBytes = attachment.getBytes();
    const fixedZipBlob = Utilities.newBlob(rawBytes, 'application/zip', attachment.getName());

    const blobs = Utilities.unzip(fixedZipBlob);
    let xmlData = null;
    let pdfBlob = null;
    for (const b of blobs) {
      const fileName = b.getName().toLowerCase();
      if (fileName.endsWith('.xml')) {
        xmlData = getDataOfXML(b.getDataAsString());
      }

      if (fileName.endsWith('.pdf')) {
        pdfBlob = Utilities.newBlob(b.getBytes(), b.getContentType(), b.getName());
      }
    }
    return { xmlData: xmlData, pdfBlob: pdfBlob };
  } catch (e) {
    Logger.log("Error al descomprimir el archivo: " + e);
  }
}


/**
 * Extrae la información total de la factura y los productos contenidos en un XML.
 * @param {string} value - Cadena completa en formato XML que representa una factura electrónica.
 * @returns {Object} - Objeto con el total de la factura (`totalInvoice`) y un arreglo de productos (`products`)
 *                     con la información individual parseada por `parseInvoiceData`.
 */
function getDataOfXML(value) {
  const data = value.split('<cbc:Description>');
  const totalInvoice = value.match(/<cbc:PayableAmount[^>]*>(.*?)<\/cbc:PayableAmount>/);
  const acquirerAndDate = getAcquirerAndDate(value);

  data.shift()
  let arrayData = { totalInvoice: totalInvoice[1], products: [], issueDate: acquirerAndDate.issueDate, nitCliente: acquirerAndDate.nitCliente };
  for (let d of data) {
    const objData = parseInvoiceData(d);
    arrayData.products.push(objData)
  }
  return arrayData;
}

function getAcquirerAndDate(value) {
  const issueDate = value.match(/<cbc:IssueDate[^>]*>(.*?)<\/cbc:IssueDate>/);
  const receiverSection = value.match(/<cac:ReceiverParty[^>]*>([\s\S]*?)<\/cac:ReceiverParty>/);
  let nitCliente = null;

  if (receiverSection && receiverSection[1]) {
    const match = receiverSection[1].match(/<cbc:nitCliente[^>]*>(.*?)<\/cbc:nitCliente>/);
    if (match && match[1]) {
      nitCliente = match[1].trim();
    }
  }
  return { issueDate: issueDate[1], nitCliente: nitCliente };
}


/**
 * Parsea un string XML de una factura para extraer datos relevantes de producto, cantidad, precio, impuestos y empresa.
 * @param {string} xmlString - Cadena XML que contiene la información de la factura.
 * @returns {Object} - Objeto con los valores extraídos del XML: producto, codVendedor, cantidades, montos, impuestos, y companyID.
 *                     Si algún valor no se encuentra, se retorna como null.
 */
function parseInvoiceData(xmlString) {
  const productoMatch = xmlString.match(/(.*?)<\/cbc:Description>/);
  const codVendedorMatch = xmlString.match(/<cac:StandardItemIdentification>\s*<cbc:ID>(.*?)<\/cbc:ID>/);
  const baseQuantityMatch = xmlString.match(/<cbc:BaseQuantity[^>]*>(.*?)<\/cbc:BaseQuantity>/);
  const priceAmountMatch = xmlString.match(/<cbc:PriceAmount[^>]*>(.*?)<\/cbc:PriceAmount>/);
  const invoicedQuantityMatch = xmlString.match(/<cbc:InvoicedQuantity[^>]*>(.*?)<\/cbc:InvoicedQuantity>/);
  const lineExtensionAmountMatch = xmlString.match(/<cbc:LineExtensionAmount[^>]*>(.*?)<\/cbc:LineExtensionAmount>/);
  const taxAmountMatch = xmlString.match(/<cbc:TaxAmount[^>]*>(.*?)<\/cbc:TaxAmount>/);
  const roundingAmount = xmlString.match(/<cbc:RoundingAmount[^>]*>(.*?)<\/cbc:RoundingAmount>/);
  const percent = xmlString.match(/<cbc:Percent[^>]*>(.*?)<\/cbc:Percent>/);
  const companyID = xmlString.match(/<cbc:CompanyID[^>]*>(.*?)<\/cbc:CompanyID>/);

  return {
    producto: productoMatch ? productoMatch[1].trim() : null,
    codVendedor: codVendedorMatch ? codVendedorMatch[1].trim() : null,
    baseQuantity: baseQuantityMatch ? parseFloat(baseQuantityMatch[1]) : null,
    priceAmount: priceAmountMatch ? parseFloat(priceAmountMatch[1]) : null,
    invoicedQuantity: invoicedQuantityMatch ? parseFloat(invoicedQuantityMatch[1]) : null,
    lineExtensionAmount: lineExtensionAmountMatch ? parseFloat(lineExtensionAmountMatch[1]) : null,
    taxAmount: taxAmountMatch ? parseFloat(taxAmountMatch[1]) : null,
    roundingAmount: roundingAmount ? parseFloat(roundingAmount[1]) : null,
    percent: percent ? parseFloat(percent[1]) : null,
    companyID: companyID ? parseFloat(companyID[1]) : null,
  };
}


function loadPDFileToDrive() {
  const folderId = '1tP2GqxwHDuVq9CRNfaOT8g7Nxb0YJR6I';
  const folder = DriveApp.getFolderById(folderId);
}
