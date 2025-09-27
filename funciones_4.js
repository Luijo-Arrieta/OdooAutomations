/**
 * Devuelve un arreglo plano con todos los valores de la columna indicada,
 * desde DATA_START hasta la última fila usada en la hoja.
 */
function getColumnValues(sheet, columnIndex, startRow) {
  const lastDataRow = sheet.getLastRow();
  const numRows = Math.max(0, lastDataRow - startRow + 1);
  if (numRows === 0) return [];
  // obtiene CstartRow:C<lastDataRow> y aplana
  return sheet
    .getRange(startRow, columnIndex, numRows, 1)
    .getValues()
    .flat();
}

/**
 * Convierte datos JSON a una hoja de cálculo
 * @param {Array} jsonData - Datos en formato JSON (array de objetos)
 * @param {string} sheetName - Nombre de la hoja
 * @param {string} sheetId - Identificador de la hoja a escribir
 * @param {boolean} append - Si es verdadero, añade los datos; si es falso, reemplaza
 */
function jsonToSheet(jsonData, sheetName, append, sheetId = "") {
  if (!jsonData || jsonData.length <= 0) {
    Logger.log("No hay datos para escribir en " + sheetName);
    return;
  }

  Logger.log(`sheetId recibido: ${sheetId}`);

  var ss = (sheetId.trim() !== '')
    ? SpreadsheetApp.openById(sheetId)
    : SpreadsheetApp.getActiveSpreadsheet()

  var sheet = ss.getSheetByName(sheetName)

  if (!sheet) {
    sheet = ss.insertSheet(sheetName);
    append = false; // Si la hoja es nueva, no podemos añadir
  }

  var headers = Object.keys(jsonData[0]);
  var values = [headers];

  jsonData.forEach(function (item) {
    var row = headers.map(function (header) {
      const value = item[header];
      if (value === null || value === undefined) return "";
      if (typeof value === 'object') {
        try {
          return JSON.stringify(value);
        } catch (e) {
          return "[object error]";
        }
      }
      return value;
    });
    values.push(row);
  });

  if (append) {
    var lastRow = sheet.getLastRow();
    if (lastRow === 0) {
      sheet.getRange(1, 1, values.length, values[0].length).setValues(values);
    } else {
      // Verificar si los encabezados coinciden
      var existingHeaders = sheet.getRange(1, 1, 1, headers.length).getValues()[0];
      var headersMatch = true;

      for (var i = 0; i < headers.length; i++) {
        if (existingHeaders[i] !== headers[i]) {
          headersMatch = false;
          break;
        }
      }

      if (headersMatch) {
        // Solo añadir filas de datos, sin encabezados
        sheet.getRange(lastRow + 1, 1, values.length - 1, values[0].length).setValues(values.slice(1));
      } else {
        throw new Error("Los encabezados no coinciden. No se pueden añadir datos.");
      }
    }
  } else {
    // Borrar datos existentes y escribir nuevos
    sheet.clear();
    sheet.getRange(1, 1, values.length, values[0].length).setValues(values);
  }
}

/**
 * Escribe una lista de listas en una hoja de cálculo, con parámetros flexibles.
 *
 * @param {!Array<!Array<?>>} lista
 *    Lista de listas a insertar (obligatorio).
 * @param {bool=} append
 *    Si las filas serán agregadas o sustituiran la data existente.
 * @param {string=} spreadsheetId
 *    ID del spreadsheet. Si no se indica, se usa el activo.
 * @param {string=} sheetName
 *    Nombre de la hoja. Si no se indica, toma la primera hoja del libro.
 * @param {number=} colIndex
 *    Columna donde empieza a escribir (por defecto A = 1).
 * @param {number=} rowIndex
 *    Fila donde empieza a escribir. Si no se indica, se calcula como última fila + 1.
 * @return {void}
 */
function listToSheet(lista, append = true, spreadsheetId = "", sheetName = "", colIndex = 1, rowIndex) {
  if (!lista || lista.length === 0) {
    Logger.log("⚠️ No hay datos para escribir.");
    return;
  }

  // Obtener el Spreadsheet
  const ss = spreadsheetId.trim()
    ? SpreadsheetApp.openById(spreadsheetId)
    : SpreadsheetApp.getActiveSpreadsheet();

  // Obtener o usar la primera hoja
  const sheet = sheetName
    ? ss.getSheetByName(sheetName) || ss.insertSheet(sheetName)
    : ss.getSheets()[0];

  // Calcular fila de inicio
  let filaInicio = (typeof rowIndex === "number")
    ? rowIndex
    : sheet.getLastRow() + 1;

  // SI no se desea agregar, se elimina la data y se agrega nueva
  if (!append) {
    sheet.clear()
    filaInicio = 1
  }

  // Calcular dimensiones
  const numFilas = lista.length;
  const numColumnas = lista[0].length;

  // Escribir los datos
  sheet.getRange(filaInicio, colIndex, numFilas, numColumnas).setValues(lista);
}


/**
 * Calcula el número de semana de una fecha dada, emulando NUM.DE.SEMANA(fecha, 2) de Google Sheets.
 * Usa el estándar donde la semana empieza en lunes.
 *
 * @param {Date} fecha - Fecha válida.
 * @returns {number} Número de semana del año (1-53).
 */
function obtenerNumeroSemana(fecha) {
  //const cal = CalendarApp.getDefaultCalendar(); // Dummy para acceder a Calendar
  const timeZone = Session.getScriptTimeZone();
  const fechaFormateada = Utilities.formatDate(fecha, timeZone, "w"); // Semana según locale y zona
  return parseInt(fechaFormateada, 10);
}

function obtenerZonaHoraria() {
  const zonaPorDefecto = "America/Lima"; // zona horaria por defecto

  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    if (ss) {
      const zona = ss.getSpreadsheetTimeZone();
      return zona || zonaPorDefecto;
    } else {
      return zonaPorDefecto;
    }
  } catch (e) {
    Logger.log("Error obteniendo la zona horaria del spreadsheet: " + e.message);
    return zonaPorDefecto;
  }
}

/**
 * Convierte los datos de una hoja de cálculo en una lista de listas
 * @param {string} sheetName - Nombre de la hoja
 * @param {string} sheetId - (Opcional) ID del documento, si no es el activo
 * @return {Array[]} Lista de listas con los datos de la hoja
 */
function sheetToList(sheetName, sheetId = "") {
  const ss = (sheetId.trim() !== '')
    ? SpreadsheetApp.openById(sheetId)
    : SpreadsheetApp.getActiveSpreadsheet();

  const sheet = ss.getSheetByName(sheetName);
  if (!sheet) {
    UI_showError("No se encontró la hoja: " + sheetName);
    return [];
  }

  const data = sheet.getDataRange().getValues();
  if (data.length === 0) return [];

  const zonaHoraria = obtenerZonaHoraria(); // Asegúrate de tener esta función definida

  // Procesar filas sin encabezado
  const result = data.map(row => {
    return row.map(cell => {
      if (Object.prototype.toString.call(cell) === "[object Date]" && !isNaN(cell)) {
        return Utilities.formatDate(cell, zonaHoraria, "yyyy-MM-dd");
      } else if (typeof cell === "string") {
        return cell.replace(/\n/g, "");
      }
      return cell;
    });
  });

  return result;
}

/**
 * Convierte datos de una hoja de cálculo a formato JSON
 * @param {string} sheetName - Nombre de la hoja
 * @param {boolean} hasHeaders - Indica si la fila de encabezados está presente
 * @param {string} sheetId - ID del archivo de Google Sheets (opcional)
 * @param {number} headerRow - Número de fila donde están los encabezados (por defecto: 1)
 * @return {Array<Object>} Arreglo de objetos
 */
function sheetToJSON(sheetName, hasHeaders = true, sheetId = "", headerRow = 1) {
  const ss = sheetId.trim() !== ""
    ? SpreadsheetApp.openById(sheetId)
    : SpreadsheetApp.getActiveSpreadsheet();

  const sheet = ss.getSheetByName(sheetName);
  if (!sheet) {
    UI_showError("No se encontró la hoja: " + sheetName);
    return [];
  }

  const data = sheet.getDataRange().getValues();
  if (data.length < headerRow) return [];

  const headerIndex = headerRow - 1;
  const headers = hasHeaders
    ? data[headerIndex]
    : data[0].map((_, i) => "col" + i);

  const validHeaders = headers.map(h => h?.toString().trim() || null);
  const startRow = hasHeaders ? headerIndex + 1 : 1;

  const result = [];

  for (let i = startRow; i < data.length; i++) {
    const row = data[i];
    const obj = {};

    for (let j = 0; j < validHeaders.length; j++) {
      if (validHeaders[j] !== null) {
        let value = row[j];

        if (Object.prototype.toString.call(value) === "[object Date]" && !isNaN(value)) {
          const zonaHoraria = obtenerZonaHoraria(); // Asegúrate de tener esta función definida
          value = Utilities.formatDate(value, zonaHoraria, "yyyy-MM-dd");
        } else if (typeof value === "string") {
          value = value.replace(/\n/g, "");
        }

        obj[validHeaders[j]] = value;
      }
    }

    result.push(obj);
  }

  return result;
}

/**
 * Convierte un número de columna a su letra en formato A1 (por ejemplo: 1 => "A", 28 => "AB")
 * 
 * @param {number} num - Número de columna (comenzando en 1).
 * @return {string} - Letra de columna en formato A1.
 */
function columnaA1(num) {
  let columna = '';
  while (num > 0) {
    let resto = (num - 1) % 26;
    columna = String.fromCharCode(65 + resto) + columna;
    num = Math.floor((num - 1) / 26);
  }
  return columna;
}

/**
 * Busca una celda que coincida con un texto dentro de un rango de filas en una hoja específica y retorna el numero de la columna y el de la fila. Retorna {{col: string, numCol: number, fila: number} | null}
 * 
 * @param {string} sheetId - ID del libro de Google Sheets.
 * @param {string} sheetName - Nombre de la hoja a buscar.
 * @param {string} textoBuscado - Texto a buscar (ej: "Semana: 20").
 * @param {number} filaInicio - Número de fila inicial para la búsqueda (ej: 1).
 * @param {number} filaFin - Número de fila final para la búsqueda (ej: 4).
 * @param {number} [colInicio=1] - Columna inicial (opcional)
 * @param {number} [colFin=última columna] - Columna final (opcional)
 */
function sheetBuscarTextoEnRango(sheetId, sheetName, textoBuscado, filaInicio, filaFin, colInicio = 1, colFin) {
  const ss = SpreadsheetApp.openById(sheetId);
  const sheet = ss.getSheetByName(sheetName);

  if (!sheet) {
    throw new Error("Hoja no encontrada: " + sheetName);
  }

  // Obtener última columna si no se especificó
  const ultimaColumna = sheet.getLastColumn();
  colFin = colFin || ultimaColumna;

  const numFilas = filaFin - filaInicio + 1;
  const numColumnas = colFin - colInicio + 1;

  const rango = sheet.getRange(filaInicio, colInicio, numFilas, numColumnas).getDisplayValues();

  for (let i = 0; i < rango.length; i++) {
    for (let j = 0; j < rango[i].length; j++) {
      if (rango[i][j].toLowerCase().trim() === textoBuscado.toLowerCase().trim()) {
        return {
          col: columnaA1(colInicio + j),
          numCol: colInicio + j,
          fila: filaInicio + i
        };
      }
    }
  }

  return null;
}

function modalConfirmacion(accion) {
  let uiSheet = SpreadsheetApp.getUi();
  let respuesta = uiSheet.alert("Confirmación requerida", "Al confirmar inciará la ejecución del script.",uiSheet.ButtonSet.OK_CANCEL);

  if (respuesta === uiSheet.Button.OK) {
    accion();
  } else {
    SpreadsheetApp.getActiveSpreadsheet().toast("Acción cancelada por el usuario.")
  }
}
