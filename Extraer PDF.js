/**
 * Extrae el texto completo de todos los archivos PDF dentro de una carpeta de Google Drive,
 * aplicando OCR (Reconocimiento Óptico de Caracteres) en español. Devuelve una lista con el texto
 * plano de cada archivo, eliminando el documento temporal creado para el OCR.
 *
 * @param {string} idFolder - ID de la carpeta de Drive que contiene los archivos PDF.
 * @returns {Array<Object>} Lista de objetos con el nombre del archivo y su texto extraído.
 * 
 * Cada objeto tiene la forma:
 * {
 *   name: 'nombre-del-archivo.pdf',
 *   fullText: 'texto extraído y normalizado'
 * }
 *
 * @example
 * const resultados = extraerFullTextoDePDFsEnUnaCarpetaDeDrive("1abcDEFghijkXYZ...");
 * Logger.log(resultados);
 */
function extraerFullTextoDePDFsEnUnaCarpetaDeDrive(idFolder) {
  const folder = DriveApp.getFolderById(idFolder);
  const pdfs = folder.getFilesByType(MimeType.PDF);

  let archivos = [];

  while (pdfs.hasNext()) {
    const pdf = pdfs.next();
    Logger.log(`Procesando archivo: ${pdf.getName()}`);

    // Obtiene el archivo PDF como blob y crea un nuevo documento de Google Docs aplicando OCR
    const pdfBlob = pdf.getBlob();
    const newDoc = Drive.Files.insert(
      { title: pdf.getName().replace(/\.pdf$/i, '') }, // Asigna un título sin la extensión .pdf
      pdfBlob, // Archivo original en formato binario
      { ocr: true, ocrLanguage: 'es' } // Aplica OCR en español
    );

    // Extrae el texto del documento generado con OCR
    let fullText = DocumentApp.openById(newDoc.id).getBody().getText();

    // Normaliza el texto eliminando caracteres no deseados y espacios redundantes
    fullText = fullText
      .replace(/\*+/g, '')           // Elimina asteriscos repetidos
      .replace(/\r/g, '')            // Elimina retornos de carro
      .replace(/[ ]{2,}/g, ' ');     // Reemplaza múltiples espacios por uno solo

    // Elimina el documento temporal creado para el OCR
    DriveApp.getFileById(newDoc.id).setTrashed(true);
    Logger.log(`Temporal ${newDoc.title} eliminado.`);

    // Agrega el resultado al arreglo final
    archivos.push({
      name: pdf.getName(),
      fullText
    });
  }

  return archivos;
}

function extraerFullTextoDeUnPdf(id_pdf) {

  const pdf = DriveApp.getFileById(id_pdf);
  Logger.log(`Procesando archivo: ${pdf.getName()}`);

  // Obtiene el archivo PDF como blob y crea un nuevo documento de Google Docs aplicando OCR
  const pdfBlob = pdf.getBlob();
  const newDoc = Drive.Files.insert(
    { title: pdf.getName().replace(/\.pdf$/i, '') }, // Asigna un título sin la extensión .pdf
    pdfBlob, // Archivo original en formato binario
    { ocr: true, ocrLanguage: 'es' } // Aplica OCR en español
  );

  // Extrae el texto del documento generado con OCR
  let fullText = DocumentApp.openById(newDoc.id).getBody().getText();

  // Normaliza el texto eliminando caracteres no deseados y espacios redundantes
  fullText = fullText
    .replace(/\*+/g, '')           // Elimina asteriscos repetidos
    .replace(/\r/g, '')            // Elimina retornos de carro
    .replace(/[ ]{2,}/g, ' ');     // Reemplaza múltiples espacios por uno solo

  // Elimina el documento temporal creado para el OCR
  DriveApp.getFileById(newDoc.id).setTrashed(true);
  Logger.log(`Temporal ${newDoc.title} eliminado.`);

  return fullText;
}

/**
 * Extrae nombre del proveedor y NIT desde el texto OCR.
 * @param {string} fullText - Texto completo normalizado.
 * @returns {{nombre: string, nit: string}}
 */
function getProveedor(fullText) {
  const proveedor = { nombre: '', nit: '' };

  // Buscar NIT con al menos 9 dígitos
  const nitMatch = fullText.match(/NIT[:\s]*([0-9]{9,})/i);
  if (nitMatch) {
    proveedor.nit = nitMatch[1];
  }

  // Buscar línea que contiene "Proveedor" y una línea siguiente con el nombre
  const provRegex = /Proveedor\s*\n([^\n]+)/i;
  const nameMatch = fullText.match(provRegex);
  if (nameMatch) {
    proveedor.nombre = nameMatch[1].trim();
  }

  return proveedor;
}

/**
 * Extrae el NIT del cliente desde un texto dado.
 * 
 * Esta función busca el patrón del NIT en el texto, que es un número de 10 dígitos
 * comenzando con 8 o 9, y que generalmente va precedido por la palabra "NIT" seguida
 * de dos puntos o espacios.
 * 
 * Debido a la dificultad para obtener el nombre correctamente, esta función
 * retorna solo el NIT y deja el nombre vacío.
 * 
 * @param {string} texto - El texto completo del cual se extraerá el NIT.
 * @returns {string | null} NIT del cliente en formato texto,
 *          o null si no se encuentra ningún NIT válido.
 * 
 * @example
 * const texto = "NIT: 9002769621 \n Cliente: D1 S.A.S";
 * const cliente = extraerClienteSoloNit(texto);
 * // cliente = { nombre: "", nit: "9002769621" }
 */
function getClienteNIT(texto) {
  // Expresión regular para buscar el NIT: empieza con 8 o 9 y tiene 10 dígitos en total
  const regexNIT = /NIT[:\s]*:?[\s]*([89]\d{9})/;

  // Ejecuta la búsqueda en el texto
  const match = texto.match(regexNIT);

  // Si se encontró el NIT, retorna el objeto con nombre vacío y el NIT capturado
  if (match) {
    return match[1];
  }

  // Retorna null si no se encontró NIT válido
  return null;
}

function getFechas(texto) {
  const pagoM = texto.match(/Fecha\.[ ]*(\d{2}\/\d{2}\/\d{4})/i);
  const contM = texto.match(/Fecha Contabilizaci[oó]n[:\s]*(\d{2}\/\d{2}\/\d{4})/i);
  return {
    fechaPago: pagoM ? pagoM[1] : '',
    fechaContabilizacion: contM ? contM[1] : ''
  };
}

function getBanco(texto) {
  const resultados = [];

  // Buscar ocurrencias donde estén juntos banco, cuenta, moneda y neto pagado
  const bancoRegex = /([A-ZÁÉÍÓÚÑ\s\.]{4,})\s+(\d{8,20})\s+(COP)\s+\1\s+([\d.]{7,})/g;
  let match;

  while ((match = bancoRegex.exec(texto)) !== null) {
    resultados.push({
      Banco: match[1].trim(),
      ALaCuenta: match[2],
      Moneda: match[3],
      AlBanco: match[1].trim(), // asumimos mismo banco
      NetoPagado: match[4].replace(/\./g, '').replace(/,/g, '.'),
    });
  }

  return resultados;
}


function getFacturas(texto) {
  const factM = texto.match(/Facturas Pagadas([\s\S]*?)(?=Retenciones Efectuadas|$)/i);
  const facturas = [];

  if (factM) {
    const block = factM[1];
    const rowRe = /([A-Z]{2})\s+(\d{10})\s+(FELA\d{3,4})\s+([\d.,-]+)\s+([\d.,-]+)\s+([\d.,-]+)\s+([\d.,-]+)\s+([\d.,-]+)/g;
    let m;
    while ((m = rowRe.exec(block))) {
      facturas.push({
        TD: m[1],
        DocInterno: m[2],
        NroFactura: m[3],
        ValorBruto: m[4].replace(/\./g, '').replace(/,/g, '.'),
        Retenciones: m[5].replace(/\./g, '').replace(/,/g, '.'),
        IVA: m[6].replace(/\./g, '').replace(/,/g, '.'),
        DescRec: m[7].replace(/\./g, '').replace(/,/g, '.'),
        NetoPagado: m[8].replace(/\./g, '').replace(/,/g, '.')
      });
    }
  }

  return facturas;
}

function getRetenciones(texto) {
  const retM = texto.match(/Retenciones Efectuadas([\s\S]*?)(?=$)/i);
  const retenciones = [];

  if (retM) {
    const rowRe = /(RI-KA|RR-KM)\s+(.+?)\s+(FELA\d{3,4})\s+([\d.,-]+)/g;
    let m;
    while ((m = rowRe.exec(retM[1]))) {
      retenciones.push({
        Tipo: m[1],
        Descripcion: m[2].trim(),
        NroFactura: m[3],
        Importe: m[4].replace(/\./g, '').replace(/,/g, '.')
      });
    }
  }

  return retenciones;
}
