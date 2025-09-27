const ID_FOLDER = "1sglRK0VSgvFyGMIRvryQAjJlt7sCV8n2"

/**
 * Procesa una URL de Google Drive para extraer información y mostrarla.
 * Lanza errores si las validaciones críticas fallan.
 *
 * @param {string} url La URL obligatoria de Google Drive (archivo o carpeta).
 * @returns {Object} Un objeto con el ID del elemento y un booleano indicando si es archivo o carpeta.
 * @throws {Error} Si la URL no es válida o no se puede extraer un ID de Drive.
 */
function procesarUrlDrive(url) {
  // 1. Validar parámetro
  if (!url) {
    throw new Error('La URL es un parámetro obligatorio. La ejecución ha sido detenida.');
  }

  // 2. Expresiones regulares para detectar tipo y extraer ID
  const filePattern = /\/file\/d\/([a-zA-Z0-9_-]{25,})/;
  const folderPattern = /\/folders\/([a-zA-Z0-9_-]{25,})/;

  let idMatch, idElemento, esArchivo, nombreElemento, tipoDeElemento;

  if (filePattern.test(url)) {
    // Es un archivo
    idMatch = url.match(filePattern);
    idElemento = idMatch[1];
    esArchivo = true;
    tipoDeElemento = 'archivo';
  }
  else if (folderPattern.test(url)) {
    // Es una carpeta
    idMatch = url.match(folderPattern);
    idElemento = idMatch[1];
    esArchivo = false;
    tipoDeElemento = 'carpeta';
  }
  else {
    throw new Error('El texto proporcionado no parece ser una URL válida de Google Drive (archivo o carpeta).');
  }

  // 3. Intentar recuperar el nombre del elemento
  try {
    if (esArchivo) {
      nombreElemento = DriveApp.getFileById(idElemento).getName();
    } else {
      nombreElemento = DriveApp.getFolderById(idElemento).getName();
    }
  } catch (e) {
    throw new Error(
      `No se pudo acceder al ${tipoDeElemento} con ID "${idElemento}". ` +
      `Verifica que exista y tengas permisos de visualización.`
    );
  }

  // 4. Mostrar al usuario
  SpreadsheetApp.getActiveSpreadsheet().toast(
    `Has compartido un ${tipoDeElemento} de nombre "${nombreElemento}".`
  )

  // 5. Devolver detalles
  return {
    idElemento,
    esArchivo
  };
}


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

  // Validar si el PDF es principalmente imagen
  if (esPdfImagen(id_pdf)) {
    throw new Error('El PDF es una imagen. Por favor, valide el formato y vuelva a intentarlo.');
  }

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

function esPdfImagen(id_pdf) {
  try {
    const pdf = DriveApp.getFileById(id_pdf);
    const pdfBlob = pdf.getBlob();
    
    // Crear documento temporal para extraer texto sin OCR
    const tempDoc = Drive.Files.insert(
      { 
        title: 'temp_validation_' + Date.now(),
        mimeType: 'application/vnd.google-apps.document'
      },
      pdfBlob,
      { 
        convert: true,
        ocr: false
      }
    );
    
    const textoNativo = DocumentApp.openById(tempDoc.id).getBody().getText().trim();
    
    // Eliminar documento temporal
    DriveApp.getFileById(tempDoc.id).setTrashed(true);
    
    // Analizar el patrón del texto
    const lineas = textoNativo.split('\n');
    const lineasCortas = lineas.filter(linea => linea.trim().length > 0 && linea.trim().length < 30).length;
    const totalLineas = lineas.filter(linea => linea.trim().length > 0).length;
    
    // Si hay muchas líneas cortas vs el total, es probable que sea imagen
    // También validar si el texto es muy corto
    const porcentajeLineasCortas = totalLineas > 0 ? (lineasCortas / totalLineas) : 0;
    
    return textoNativo.length < 100 || porcentajeLineasCortas > 0.7;
    
  } catch (error) {
    Logger.log(`Error en validación: ${error.toString()}`);
    // Si hay error en la validación, asumimos que es texto y continuamos
    return false;
  }
}

function extraerDatosDePdfConParseoV10() {
  const folder = DriveApp.getFolderById(ID_FOLDER);
  const pdfs = folder.getFilesByType(MimeType.PDF);

  while (pdfs.hasNext()) {
    const pdf = pdfs.next();
    Logger.log(`Procesando archivo: ${pdf.getName()}`);

    // OCR al PDF
    const pdfBlob = pdf.getBlob();
    const newDoc = Drive.Files.insert(
      { title: pdf.getName().replace(/\.pdf$/i, '') },
      pdfBlob,
      { ocr: true, ocrLanguage: 'es' }
    );
    let fullText = DocumentApp.openById(newDoc.id).getBody().getText();

    // Normalización previa
    fullText = fullText
      .replace(/\*+/g, '')
      .replace(/\r/g, '')
      .replace(/[ ]{2,}/g, ' ');
    Logger.log('--- TEXTO NORMALIZADO ---');
    Logger.log(JSON.stringify(fullText));

    // Eliminar temporal
    DriveApp.getFileById(newDoc.id).setTrashed(true);
    Logger.log(`Temporal ${newDoc.title} eliminado.`);

    // Transformar el texto plano obtenido
    const resultado = parseTextoV1(fullText);

    // Muestra el objeto resultante en los logs
    Logger.log(JSON.stringify(resultado));

  }
}

/**
 * Agrupa un array de facturas por tipo de documento: NC y FE
 * @param {Array<Object>} registros - Lista de objetos con los campos TD, NroFactura, etc.
 * @returns {{ NC: Array, FE: Array }} Objeto con dos listas agrupadas
 */
function agruparFacturasPorTipo(registros) {
  const resultado = {
    NC: [], // Notas de crédito (TD === 'KF')
    FE: []  // Facturas electrónicas (TD === 'RE')
  };

  registros.forEach(reg => {
    const tipo = reg.TD.toUpperCase();
    if (tipo === 'KF') {
      resultado.NC.push(reg);
    } else if (tipo === 'RE') {
      resultado.FE.push(reg);
    }
  });

  return resultado;
}

function procesarNcD1(data, fecha) {

  const transformarNumero = (numeroFactura) => {
    const match = numeroFactura.match(/^([A-Za-z]+)(\d+)$/);
    if (!match) throw new Error(`Formato inválido: ${numeroFactura}`);

    const letras = match[1];
    const numeros = parseInt(match[2], 10); // Quita ceros a la izquierda

    return { letras, numeros, original: numeroFactura };
  };

  const invertirPrefijo = (prefijo) => {
    if (prefijo.startsWith('FEBR')) return 'FELA' + prefijo.slice(4);
    if (prefijo.startsWith('FELA')) return 'FEBR' + prefijo.slice(4);
    return prefijo; // por si hay otras variantes
  };

  const procesados = data.map((item) => {
    const { letras, numeros } = transformarNumero(item.NroFactura);
    return {
      numero: `${letras}${numeros}`, // sin guion, sin ceros
      fecha,
      descuento: convertirNumeroAPositivo(item.NetoPagado),
      importe: convertirNumeroAPositivo(item.NetoPagado)
    };
  });

  const copias = procesados.map((original) => {
    const letras = original.numero.slice(0, 4);
    const numeros = original.numero.slice(4); // parte numérica como string
    const nuevoPrefijo = invertirPrefijo(letras);
    return {
      ...original,
      numero: `${nuevoPrefijo}${numeros}`,
    };
  });

  // Combinar y ordenar
  const facturas = [...procesados, ...copias].sort((a, b) => a.numero.localeCompare(b.numero));

  // Calcular el descuento total solo de los originales
  const descuentoTotal = procesados.reduce((acc, curr) => acc + curr.descuento, 0);

  return {
    facturas,
    importeTotal: parseFloat(descuentoTotal.toFixed(2)),
    fecha
  };
}

function procesarFacturasD1(facturasSheetRawAgrupadas, fecha) {
  // 1. Helpers existentes
  const transformarNumero = (numeroFactura) => {
    const match = numeroFactura.match(/^([A-Za-z]+)(\d+)$/);
    if (!match) throw new Error(`Formato inválido: ${numeroFactura}`);
    return {
      letras: match[1],
      numeros: parseInt(match[2], 10), // Quita ceros iniciales
      original: numeroFactura,
    };
  };

  const invertirPrefijo = (prefijo) => {
    if (prefijo.startsWith('FEBR')) return 'FELA' + prefijo.slice(4);
    if (prefijo.startsWith('FELA')) return 'FEBR' + prefijo.slice(4);
    return prefijo;
  };

  const convertirNumeroAPositivo = (n) => Math.abs(n);

  // 2. Construir mapa de NC por NroFactura
  //    Si hay múltiples NC para una FE, aquí se conservará solo la última.
  const ncMap = (facturasSheetRawAgrupadas.NC || []).reduce((map, nc) => {
    map[nc.NroFactura] = nc;
    return map;
  }, {});

  // 3. Procesar facturas FE
  const procesados = (facturasSheetRawAgrupadas.FE || []).map((item) => {
    const { letras, numeros } = transformarNumero(item.NroFactura);
    // Si existe NC para esta FE, uso su NetoPagado; si no, uso el de la FE
    const nc = ncMap[item.NroFactura];
    const descuentoNC = nc
      ? convertirNumeroAPositivo(nc.NetoPagado)
      : 0;

    return {
      numero: `${letras}${numeros}`,
      fecha,
      descuento: descuentoNC,
      importe: convertirNumeroAPositivo(item.NetoPagado) - descuentoNC,
    };
  });

  // 4. Generar copias con prefijos invertidos
  const copias = procesados.map((orig) => {
    const prefijo = orig.numero.slice(0, 4);
    const resto = orig.numero.slice(4);
    return {
      ...orig,
      numero: invertirPrefijo(prefijo) + resto,
    };
  });

  // 5. Combinar y ordenar
  const facturas = [...procesados, ...copias].sort((a, b) =>
    a.numero.localeCompare(b.numero)
  );

  return { facturas, fecha };
}


function completarDetalleFacturaD1(detalleFacturas, facturas) {
  const mapFacturas = {};

  // Crear un mapa para acceso rápido por número de factura
  facturas.forEach(factura => {
    mapFacturas[factura.numero] = {
      descuento: factura.descuento || 0,
      fecha: factura.fecha,
      importe: factura.importe || 0
    };
  });

  // Enriquecer cada factura del detalle con datos desde data.facturas
  const detalleEnriquecido = detalleFacturas.map(factura => {
    const infoExtra = mapFacturas[factura.name];
    return {
      ...factura,
      ...(infoExtra ? infoExtra : {}) // Agrega solo si existe información relacionada
    };
  });

  return detalleEnriquecido;
}

function convertirNumeroAPositivo(valor) {
  if (typeof valor !== 'number') {
    throw new Error(`Valor inválido: se esperaba un número, se recibió ${typeof valor}`);
  }

  return Math.abs(valor);
}


