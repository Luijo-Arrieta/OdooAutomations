function doGet(e) {
  const sheetId = e.parameter?.sheetId;//ID sheet
  const queryType = e.parameter.queryType;//Qué opción quieres realizar (data: datos de la sheet. currentWeek: obtiene el id del documento filtrando por la semana actual. lastRow: última row donde tiene registros la sheet, justNumberWeek: retorna solo el número de semana)
  const sheetName = e.parameter?.sheetName;//De qué hoja quieres sacar la información
  const documentType = e.parameter?.documentType;//Qué tipo de documento (solo se usa para consolidado)
  const formatSheetData = e.parameter?.formatSheetData;//Si, No => indica si se quiere formatear la data del sheet en un objeto
  const dateProcess = e.parameter?.dateProcess;//Si se recibe la fecha para obtener el id del documento de la semana
  const folderId = e.parameter?.folderId;//Si se recibe el id del folder

  /*const sheetId = '1goVFsLLeO5yM4m3TTNUpaZIpoinXN3-hqyJy0ieWgF8';
  const queryType = 'data'
  const sheetName = 'TD Comparativo'
  const formatSheetData = 'Oxxo'*/

  if (!queryType) {
    return ContentService.createTextOutput("Missing 'queryType'").setMimeType(ContentService.MimeType.TEXT);
  }

  try {
    let sheetData;
    let sheet;
    let last;
    if (sheetId !== undefined) {
      let sheet = SpreadsheetApp.openById(sheetId);
      sheet = sheetName == undefined ? sheet.getSheets()[0] : sheet.getSheetByName(sheetName);
      sheetData = sheet.getDataRange().getValues();
      last = sheet.getLastRow()
    }


    let data = [];
    data = { sheet: sheet, sheetId: sheetId, sheetName: sheetName, last: last }
    switch (queryType) {
      case 'data':
        // Caso para traer toda la información de la sheet
        data = sheetData;
        //Si se quiere formatear la data para que quede como un objeto
        if (formatSheetData !== undefined && formatSheetData === 'Oxxo') {
          data = getDataOxooTemplate(sheetData);
          console.log('data --- ', data)
        } else if (formatSheetData !== undefined && formatSheetData === 'D1') {
          data = getDataD1Template(sheetData);
        }
        break;
      case 'currentWeek':
        // Caso para traer la información de la DB de semanas de despacho
        const currentWeekData = searchRowByWeek(sheetData, documentType, dateProcess);
        const IDdocumento = currentWeekData == undefined ? 'No hay documento' : currentWeekData[2];
        data = IDdocumento;
        break;
      case 'lastRow':
        // Caso para traer la última row de un archivo sheet
        //const getNumberRow = sheet.getLastRow()
        data = last;
        break;
      case 'justNumberWeek':
        // Caso para obtener el número de la semana
        const date = dateProcess == undefined ? '' : dateProcess;
        data = getCurrentWeek(date);
        break;
      case 'getFolderFiles':
        // Caso para obtener los archivos de una carpeta
        data = getFolderFiles(folderId);
        break;
      default:
      // code block
    }

    const dataToReturn = {
      data: data,
      queryType: queryType
    }

    return ContentService.createTextOutput(JSON.stringify(dataToReturn))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (error) {
    return ContentService.createTextOutput(`Error: ${error.message}`)
      .setMimeType(ContentService.MimeType.TEXT);
  }
}

/**
 * Calcula el número de semana actual del año en formato ISO (semana 1 comienza el lunes de la primera semana con al menos 4 días)
 * @returns {number} Número de la semana actual (entre 1 y 53).
 */
function getCurrentWeek(dateProcess = '') {
  currentDate = new Date();
  let day, month, year = 0
  let currentFormated = new Date(Date.UTC(currentDate.getFullYear(), currentDate.getMonth(), currentDate.getDate()));
  if (dateProcess !== '') {
    const fechaOriginal = dateProcess;
    [day, month, year] = fechaOriginal.split("/");
    currentFormated = new Date(Date.UTC(year, month - 1, day));
  }

  const dayWeek = currentFormated.getUTCDay() || 7; // Si es domingo (0), se vuelve 7
  currentFormated.setUTCDate(currentFormated.getUTCDate() + 4 - dayWeek);

  // Calcula el inicio del año
  const startYear = new Date(Date.UTC(currentFormated.getUTCFullYear(), 0, 1));
  const numberWeek = (Math.ceil((((currentFormated - startYear) / 86400000) + 1) / 7) + 1);
  return numberWeek
}

/**
 * Busca la fila dentro de un arreglo de datos que contiene en su primera columna el número de la semana actual.
 * @returns {Array<any>|undefined} La primera fila que coincide con la semana actual, o `undefined` si no se encuentra.
 */
function searchRowByWeek(data, documentType, dateProcess) {
  const currentDate = new Date();
  const date = dateProcess == undefined ? '' : dateProcess;
  const weekToFilter = `semana ${getCurrentWeek(date)}`.toLowerCase();
  return data.find((fila, index) => index !== 0 && (fila[0].toLowerCase().includes(weekToFilter) && fila[1] == currentDate.getFullYear() && fila[3] == documentType));
}

/**
 * Mapear datos del consolidado de Oxoo
 */
function getDataOxooTemplate(sheetData) {
  console.log('sheetData ------------------ ', sheetData)
  const headersRowIndex = 0;
  const headers = sheetData[headersRowIndex + 2].map(h => h.trim());
  const rows = sheetData.slice(headersRowIndex + 3);
  console.log('headers --- ', headers)
  console.log('rows --- ', rows)
  data = rows.map(row => {
    const obj = {};
    row.forEach((value, i) => {
      obj[headers[i]] = value;
    });
    return obj;
  });
  return data;
}

/**
 * Mapear datos del consolidado de D1
 */
function getDataD1Template(sheetData) {
  const headersRowIndex = 6;
  const headers = sheetData[headersRowIndex].map(h => h.trim());
  const rows = sheetData.slice(headersRowIndex + 1);
  data = rows.map(row => {
    const obj = {};
    row.forEach((value, i) => {
      obj[headers[i]] = value;
    });
    return obj;
  });
  return data;
}

function getFolderFiles(folderId) {
  console.log('folderId ----- ', folderId)
  Logger.log('folderId ----- ', folderId)
  const currentWeek = getCurrentWeek();
  const folder = DriveApp.getFolderById(folderId);

  const files = folder.getFiles();
  const filesFiltrados = [];

  while (files.hasNext()) {
    const file = files.next();
    const fileName = file.getName();

    if (fileName.toLowerCase().includes(`semana ${currentWeek}`)) {
      filesFiltrados.push({
        fileName: fileName,
        id: file.getId(),
        url: file.getUrl()
      });
    }
  }

  Logger.log(filesFiltrados);
  return filesFiltrados;
}








