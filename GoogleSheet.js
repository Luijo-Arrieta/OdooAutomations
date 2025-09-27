/**
 * Convierte datos de una hoja de Google Sheets a formato JSON
 * 
 * @param {string} [spreadSheetId] - ID del spreadsheet. Si no se proporciona, usa el activo
 * @param {string} [sheetName] - Nombre de la hoja. Si no se proporciona, usa la primera hoja
 * @param {number} [rowHeaders=1] - Fila que contiene los headers. Si es 0 o false, usa nombres de columnas (A, B, C...)
 * @param {number} [columnStart=1] - Columna desde donde iniciar la extracción (1 = A, 2 = B, etc.)
 * @param {Array} [filters] - Array de filtros [{column: "A", operator: "=", values: ["valor1", "valor2"]}]
 * @param {Object} [order] - Objeto de ordenamiento {column: "A", direction: true} o {column: "A", direction: false}
 * @returns {Array} Array de objetos JSON
 * 
 * @example
 * // Uso básico
 * const data = sheetToJson();
 * 
 * @example
 * // Con filtros y ordenamiento
 * const data = sheetToJson(
 *   null, // spreadsheet activo
 *   "Datos", // nombre de la hoja
 *   1, // headers en fila 1
 *   1, // desde columna A
 *   [{column: "B", operator: "=", values: ["activo"]}], // filtrar por columna B = "activo"
 *   {column: "A", direction: "desc"} // ordenar por columna A descendente
 * );
 */
function sheetToJson(spreadSheetId, sheetName, rowHeaders = 1, columnStart = 1, filters = [], order = null) {
  // Obtener el spreadsheet
  const spreadsheet = spreadSheetId ? 
    SpreadsheetApp.openById(spreadSheetId) : 
    SpreadsheetApp.getActiveSpreadsheet();
  
  // Obtener la hoja
  const sheet = sheetName ? 
    spreadsheet.getSheetByName(sheetName) : 
    spreadsheet.getSheets()[0];
  
  if (!sheet) {
    throw new Error(`Hoja "${sheetName}" no encontrada`);
  }
  
  // Obtener el rango de datos
  const lastRow = sheet.getLastRow();
  const lastColumn = sheet.getLastColumn();
  
  if (lastRow === 0 || lastColumn < columnStart) {
    return [];
  }
  
  // Calcular el rango a leer
  const startRow = rowHeaders > 0 ? 1 : 1;
  const dataStartRow = rowHeaders > 0 ? rowHeaders + 1 : 1;
  const numColumns = lastColumn - columnStart + 1;
  
  // Leer headers
  let headers;
  if (rowHeaders > 0) {
    const headerRange = sheet.getRange(rowHeaders, columnStart, 1, numColumns);
    headers = headerRange.getValues()[0];
  } else {
    // Generar headers como nombres de columnas (A, B, C...)
    headers = [];
    for (let i = 0; i < numColumns; i++) {
      headers.push(columnIndexToLetter(columnStart + i));
    }
  }
  
  // Leer datos
  if (dataStartRow > lastRow) {
    return [];
  }
  
  const dataRange = sheet.getRange(dataStartRow, columnStart, lastRow - dataStartRow + 1, numColumns);
  const rawData = dataRange.getValues();
  
  // Convertir a objetos JSON
  let jsonData = rawData.map(row => {
    const obj = {};
    headers.forEach((header, index) => {
      obj[header] = transformValue(row[index]);
    });
    return obj;
  });
  
  // Aplicar filtros
  if (filters && filters.length > 0) {
    jsonData = applyFilters(jsonData, filters);
  }
  
  // Aplicar ordenamiento
  if (order) {
    jsonData = applyOrder(jsonData, order);
  }
  
  return jsonData;
}

/**
 * Convierte un índice de columna a letra (1 = A, 2 = B, etc.)
 * @param {number} columnIndex - Índice de la columna
 * @returns {string} Letra de la columna
 */
function columnIndexToLetter(columnIndex) {
  let result = '';
  while (columnIndex > 0) {
    columnIndex--;
    result = String.fromCharCode(65 + (columnIndex % 26)) + result;
    columnIndex = Math.floor(columnIndex / 26);
  }
  return result;
}

/**
 * Transforma un valor según las reglas especificadas
 * @param {any} value - Valor a transformar
 * @returns {any} Valor transformado
 */
function transformValue(value) {
  // Si es null o undefined, retornar null
  if (value === null || value === undefined || value === '') {
    return null;
  }
  
  // Si es una fecha, convertir a formato ISO
  if (value instanceof Date) {
    return Utilities.formatDate(value, Session.getScriptTimeZone(), "yyyy-MM-dd HH:mm:ss");
  }
  
  // Si es un número, redondear a 2 decimales
  if (typeof value === 'number') {
    return Math.round(value * 100) / 100;
  }
  
  // Si es string, intentar conversiones
  if (typeof value === 'string') {
    const trimmed = value.trim();
    
    // Convertir booleanos
    if (trimmed.toLowerCase() === 'true' || trimmed.toLowerCase() === 'verdadero') {
      return true;
    }
    if (trimmed.toLowerCase() === 'false' || trimmed.toLowerCase() === 'falso') {
      return false;
    }
    
    // Intentar convertir a número
    if (!isNaN(trimmed) && trimmed !== '') {
      const num = parseFloat(trimmed);
      return Math.round(num * 100) / 100;
    }
    
    // Intentar convertir a JSON (lista o diccionario)
    if ((trimmed.startsWith('[') && trimmed.endsWith(']')) || 
        (trimmed.startsWith('{') && trimmed.endsWith('}'))) {
      try {
        return JSON.parse(trimmed);
      } catch (e) {
        // Si falla, mantener como string
      }
    }
    
    return trimmed;
  }
  
  return value;
}

/**
 * Aplica filtros a los datos
 * @param {Array} data - Datos a filtrar
 * @param {Array} filters - Array de filtros
 * @returns {Array} Datos filtrados
 */
function applyFilters(data, filters) {
  return data.filter(row => {
    return filters.every(filter => {
      const { column, operator, values } = filter;
      const cellValue = row[column];
      
      switch (operator) {
        case '=':
        case '==':
          return values.includes(cellValue);
        case '!=':
        case '<>':
          return !values.includes(cellValue);
        case '>':
          return values.some(val => cellValue > val);
        case '>=':
          return values.some(val => cellValue >= val);
        case '<':
          return values.some(val => cellValue < val);
        case '<=':
          return values.some(val => cellValue <= val);
        case 'contains':
          return values.some(val => String(cellValue).includes(val));
        case 'not_contains':
          return !values.some(val => String(cellValue).includes(val));
        case 'starts_with':
          return values.some(val => String(cellValue).startsWith(val));
        case 'ends_with':
          return values.some(val => String(cellValue).endsWith(val));
        default:
          return true;
      }
    });
  });
}

/**
 * Aplica ordenamiento a los datos
 * @param {Array} data - Datos a ordenar
 * @param {Object} order - Configuración de ordenamiento
 * @returns {Array} Datos ordenados
 */
function applyOrder(data, order) {
  const { column, direction } = order;
  
  return data.sort((a, b) => {
    const valueA = a[column];
    const valueB = b[column];
    
    // Manejar valores null/undefined
    if (valueA === null || valueA === undefined) return 1;
    if (valueB === null || valueB === undefined) return -1;
    
    let comparison = 0;
    
    if (typeof valueA === 'number' && typeof valueB === 'number') {
      comparison = valueA - valueB;
    } else if (valueA instanceof Date && valueB instanceof Date) {
      comparison = valueA.getTime() - valueB.getTime();
    } else {
      comparison = String(valueA).localeCompare(String(valueB));
    }
    
    return direction ? -comparison : comparison;
  });
}

// Ejemplos de uso:

/**
 * Ejemplo 1: Uso básico
 */
function ejemplo1() {
  const data = sheetToJson();
  console.log('Datos básicos:', data);
}

/**
 * Ejemplo 2: Con filtros múltiples
 */
function ejemplo2() {
  const filters = [
    {
      column: 'Estado',
      operator: '=',
      values: ['Activo', 'Pendiente']
    },
    {
      column: 'Precio',
      operator: '>',
      values: [100]
    }
  ];
  
  const data = sheetToJson(null, 'Productos', 1, 1, filters);
  console.log('Datos filtrados:', data);
}

/**
 * Ejemplo 3: Con ordenamiento
 */
function ejemplo3() {
  const order = {
    column: 'Fecha',
    direction: 'desc'
  };
  
  const data = sheetToJson(null, 'Ventas', 1, 1, [], order);
  console.log('Datos ordenados:', data);
}

/**
 * Ejemplo 4: Completo con todos los parámetros
 */
function ejemplo4() {
  const filters = [
    {
      column: 'B', // Si no hay headers, usar letras de columna
      operator: 'contains',
      values: ['texto']
    }
  ];
  
  const order = {
    column: 'A',
    direction: 'asc'
  };
  
  const data = sheetToJson(
    'tu_spreadsheet_id',
    'MiHoja',
    0, // Sin headers
    2, // Desde columna B
    filters,
    order
  );
  
  console.log('Datos completos:', data);
}

/**
 * Actualiza una fila de la hoja buscando por order_Id en columna A.
 *
 * @param {Object} updateData — Debe incluir al menos { order_Id: XXX } 
 *                              y cualquier otra key de las permitidas a actualizar.
 * @param {Object} [opts]    — Opciones:
 *    • spreadSheetId {string} — ID del spreadsheet (por defecto el activo).
 *    • sheetName     {string} — Nombre de la hoja (por defecto la primera).
 *    • headerRow     {number} — Fila de encabezados (por defecto 1).
 * @return {boolean} True si encontró y actualizó, false si no encontró order_Id.
 */
function updateOrderRow(updateData, opts) {
  if (!updateData.order_Id) {
    throw new Error('Tienes que pasar al menos updateData.order_Id');
  }
  opts = opts || {};
  
  // 1. Cargar spreadsheet y hoja
  var ss    = opts.spreadSheetId
            ? SpreadsheetApp.openById(opts.spreadSheetId)
            : SpreadsheetApp.getActiveSpreadsheet();
  var sheet = opts.sheetName
            ? ss.getSheetByName(opts.sheetName)
            : ss.getSheets()[0];
  
  // 2. Leer encabezados para saber en qué columna va cada key
  var headerRow = opts.headerRow || 1;
  var lastCol   = sheet.getLastColumn();
  var headers   = sheet.getRange(headerRow, 1, 1, lastCol)
                       .getValues()[0];
  var headerMap = {};
  headers.forEach(function(h, i) {
    headerMap[h] = i;  // ej. headerMap['order_name'] = 1 (0-based)
  });
  
  // 3. Leer todos los valores de la columna A (order_Id)
  var lastRow = sheet.getLastRow();
  var idRange = sheet.getRange(headerRow + 1, 1, lastRow - headerRow, 1);
  var idValues = idRange.getValues();  // [[3000], [2999], ...]
  
  // 4. Buscar la fila que coincida con updateData.order_Id
  for (var i = 0; i < idValues.length; i++) {
    if (idValues[i][0] === updateData.order_Id) {
      var rowNum = headerRow + 1 + i;
      
      // 5. Leer la fila completa para preservar los campos no tocados
      var rowValues = sheet
        .getRange(rowNum, 1, 1, lastCol)
        .getValues()[0];
      
      // 6. Para cada propiedad de updateData (menos order_Id):
      Object.keys(updateData).forEach(function(key) {
        if (key === 'order_Id') return;
        if (headerMap[key] != null) {
          var colIndex = headerMap[key];
          var value    = updateData[key];
          // Si es objeto/array, lo convierto a JSON
          if (typeof value === 'object' && value !== null) {
            value = JSON.stringify(value);
          }
          rowValues[colIndex] = value;
        }
      });
      
      // 7. Escribir la fila actualizada de una sola vez
      sheet
        .getRange(rowNum, 1, 1, lastCol)
        .setValues([ rowValues ]);
      
      Logger.log("Fila actualizada Exitosamente.");
      return;
    }
  }
  
  // no lo encontré
  Logger.log("No se encontró la fila.");
}

/**
 * Actualiza una celda en la columna 8 basándose en una key de la columna 7
 * @param {string} keyBuscada - La key que se va a buscar en la columna 7
 * @param {string} nuevoValor - El nuevo valor que se asignará en la columna 8
 * @param {string} nombreHoja - (Opcional) Nombre de la hoja. Si no se especifica, usa la hoja activa
 */
function updateMessageHistoryRow(keyBuscada, nuevoValor, nombreHoja = "MessageHistory") {
  try {
    // Obtener la hoja de cálculo
    const spreadsheet = SpreadsheetApp.openById(SheetDB);
    const hoja = nombreHoja ? spreadsheet.getSheetByName(nombreHoja) : spreadsheet.getActiveSheet();
    
    if (!hoja) {
      throw new Error(`No se encontró la hoja: ${nombreHoja}`);
    }
    
    // Obtener el rango de datos de la columna 7 (columna de keys)
    const ultimaFila = hoja.getLastRow();
    
    if (ultimaFila < 1) {
      console.log("La hoja está vacía");
      return false;
    }
    
    // Obtener todos los valores de la columna 7
    const rangoKeys = hoja.getRange(1, 6, ultimaFila, 1);
    const valoresKeys = rangoKeys.getValues();
    
    // Buscar la key en la columna 7
    for (let i = 0; i < valoresKeys.length; i++) {
      if (valoresKeys[i][0] === keyBuscada) {
        // Key encontrada, actualizar la celda correspondiente en columna 8
        const filaEncontrada = i + 1; // +1 porque las filas empiezan en 1
        hoja.getRange(filaEncontrada, 7).setValue(nuevoValor);
        
        console.log(`Key "${keyBuscada}" encontrada en fila ${filaEncontrada}. Celda actualizada con: "${nuevoValor}"`);
        return true;
      }
    }
    
    // Si llegamos aquí, la key no fue encontrada
    console.log(`Key "${keyBuscada}" no encontrada en la columna 7`);
    return false;
    
  } catch (error) {
    console.error(`Error al actualizar celda: ${error.message}`);
    return false;
  }
}


