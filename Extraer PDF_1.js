/**
 * Muestra un cuadro de diálogo al usuario para introducir una URL de Google Drive.
 * Luego, procesa esa URL usando la función 'procesarUrlDrive'.
 * La validación de la URL de Google Drive ahora se maneja exclusivamente en 'procesarUrlDrive'.
 */
function ExtraerPDF() {
  const ui = SpreadsheetApp.getUi(); // Obtiene la interfaz de usuario de Google Sheet

  // Muestra un cuadro de diálogo con un campo de entrada y botones "Aceptar" y "Cancelar".
  const response = ui.prompt(
    'Realizar Pagos D1', // Título del popup
    'Por favor, pega aquí la URL de tu archivo PDF:', // Mensaje del popup
    ui.ButtonSet.OK_CANCEL // Botones: "Aceptar" y "Cancelar"
  );

  // Evalúa la respuesta del usuario
  if (response.getSelectedButton() == ui.Button.OK) {
    // Si el usuario hizo clic en "Aceptar"
    const urlIngresada = response.getResponseText();

    // Validar si el usuario introdujo algo antes de intentar procesar
    if (!urlIngresada) {
      throw new Error('Advertencia: No has introducido ninguna URL. La operación ha sido cancelada.');
    }

    try {
      // Llama a la función procesarUrlDrive con la URL ingresada por el usuario.
      // Las validaciones de URL de Google Drive, existencia de ID, y tipo de elemento

      let resultadoProcesarUrl = procesarUrlDrive(urlIngresada)
      let esArchivo = resultadoProcesarUrl.esArchivo
      let idPdf = resultadoProcesarUrl.idElemento

      if (!esArchivo) {
        ui.alert("Error: Para este función se debe digitar la URL de un archivo PDF")
      }

      let fullText = extraerFullTextoDeUnPdf(idPdf)
      LibSheetUtils.UI_showSuccess("Se ha extraido correctamente el texto del PDF.")
      Logger.log("Se ha extraido correctamente el texto del PDF.")

      let facturas = getFacturas(fullText)
      if (!facturas) {
        LibSheetUtils.UI_showSuccess(`Se lograron extraer ${facturas.length} facturas`)

        return;
      }

      
      let fechas = getFechas(fullText)
      console.log("Fechas: ", fechas)

      LibSheetUtils.jsonToSheet(
        facturas,
        "Facturas",
        false
      )

      LibSheetUtils.jsonToSheet(
        [fechas],
        "Fechas",
        false
      )

      marcarFilasFALA()

      ui.alert("Ejecución completada", "Recuerda que sin información de fechas no se puede proceder con el pago.", ui.ButtonSet.OK)

    } catch (e) {
      // Captura cualquier error lanzado por procesarUrlDrive (incluyendo las validaciones de URL)
      // y lo muestra al usuario a través de un alert.
      ui.alert('Error al procesar URL', e.message, ui.ButtonSet.OK);
      Logger.log('Error capturado en ExtraerPDF: ' + e.message); // Log para depuración
    }

  } else { // Si el usuario hizo clic en "Cancelar" O cerró el popup
    let message = "Operación cancelada por el usuario."
    SpreadsheetApp.getActiveSpreadsheet().toast(message, "Estado", -1);
  }
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
  const pagoM = texto.match(/Fecha\.\s*(\d{1,2}\/\d{1,2}\/\d{4})/i);
  const contM = texto.match(/Fecha Contabilizaci[oó]n[:\s]*(\d{1,2}\/\d{1,2}\/\d{4})/i);
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

    console.log("Block: ", block)

    //const rowRe = /([A-Z]{2})\s+(\d{10})\s+((?:FE(?:LA)?|FALA)\d{3,5})\s+([\d.,-]+)\s+([\d.,-]+)\s+([\d.,-]+)\s+([\d.,-]+)\s+([\d.,-]+)/g;
    const rowRe = /([A-Z]{2})\s+(\d{10})\s+((?:FEAT|FETU|FELA|FE)\d{3,5})\s+([\d.,-]+)\s+([\d.,-]+)\s+([\d.,-]+)\s+([\d.,-]+)\s+([\d.,-]+)/g;

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

  Logger.log(JSON.stringify(facturas))

  return facturas;
}

function marcarFilasFALA() {
  const sheet = SpreadsheetApp.getActiveSheet();
  const lastRow = sheet.getLastRow();

  // Obtener valores de la columna C desde la fila 2
  const rangeC = sheet.getRange(2, 3, lastRow - 1, 1);
  const values = rangeC.getValues();

  // Color azul claro pastel
  const colorAzulPastel = '#E3F2FD';

  // Revisar cada celda desde la fila 2
  for (let i = 0; i < values.length; i++) {
    const cellValue = values[i][0].toString();

    if (cellValue.startsWith('FALA')) {
      const rowNumber = i + 2; // +2 porque empezamos desde la fila 2
      const rowRange = sheet.getRange(rowNumber, 1, 1, sheet.getLastColumn());
      rowRange.setBackground(colorAzulPastel);
    }
  }
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