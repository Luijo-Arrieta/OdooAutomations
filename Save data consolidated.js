//const urlAPI = 'https://script.google.com/macros/s/AKfycby0psz3ljheXnbWxy2iAN08nWN3AShXIDUNMetfMqXO3skBl7hS6pNqvgLWGLJlNd0d/exec';
const urlAPI = 'https://script.google.com/macros/s/AKfycbw4sdZMRvOj3ztrx9mo6p53PQ_cWh5mAgL8vNEThHkByfJjrZuakbTSat804-cg6gEV/exec';
const sheetIdConsolidatedOrdersComparative = '17cQr-WMUGyvJ80Mg-WZe4ahJkfKfJ0vh3Rvlbt6ncf8'
const FolderIdDespachos = "1KClLCu6i3CqcSRurX9mfohNuKFbFbGUE"
const sheetName = 'Comparativo 2025';
let columnNumerWeek = 0;
let columnsToSave = [];
let columnToStart = 0;

function getDataConsolidatedOrdersComparative(variacionSemana = 0) {
  const dataWeeks = doCallEndpointSheetAPI(`sheetId=${sheetIdConsolidatedOrdersComparative}&queryType=data&sheetName=${sheetName}`);
  const date = new Date;
  const numSemana = LibSheetUtils.obtenerNumeroSemana(date, 2) + variacionSemana;
  Logger.log(`Semana: ${numSemana}`)

  const getDataColumns = getPositionNumSemana(dataWeeks[0], numSemana);
  columnsToSave = getDataColumns[0];
  const dataToTour = getDataOfRange(getDataColumns[1]);
  saveD1Data(dataToTour, numSemana);
}


function doCallEndpointSheetAPI(extraData) {
  const url = `${urlAPI}?${extraData}`;
  console.log(url)

  const options = {
    method: "get",
    muteHttpExceptions: true,
  };

  try {
    const response = UrlFetchApp.fetch(url, options);
    const mainData = JSON.parse(response);
    const dataWeeks = mainData['data'];
    return dataWeeks;
  } catch (error) {
    Logger.log("Error al llamar al endpoint: " + error);
  }
}

function getPositionNumSemana(dataWeeks, numSemana) {
  columnNumerWeek = dataWeeks.findIndex(celda => celda.trim().startsWith(`Semana: ${numSemana}`));

  function getLetterColumn(n) {
    let letra = '';
    while (n >= 0) {
      letra = String.fromCharCode((n % 26) + 65) + letra;
      n = Math.floor(n / 26) - 1;
    }
    return letra;
  }

  const startColumn = getLetterColumn(columnNumerWeek);
  const endColumn = getLetterColumn(columnNumerWeek + 14);
  const colums = [];
  for (let i = (columnNumerWeek + 2); i <= (columnNumerWeek + 14); i++) {
    colums.push({ letter: getLetterColumn(i), number: i });
  }
  return [colums, `${startColumn}2:${endColumn}74`];
}

function getDataOfRange(range) {
  const ss = SpreadsheetApp.openById(sheetIdConsolidatedOrdersComparative);
  const sheet = ss.getSheetByName(sheetName);

  const rangeData = sheet.getRange(range);
  const data = rangeData.getValues();

  const headers = data[0].slice(1).map(h => h.trim());
  headers.unshift("Empresa")
  const values = data.slice(1);

  let dataFormated = []
  values.forEach((row, i) => {
    let obj = {};
    row.forEach((value, j) => {
      obj[headers[j]] = value;
    });
    dataFormated.push(obj);
  });
  return dataFormated;
}

function tourData(company, dataToTour) {
  let row = 3;
  let start = false;
  const dataToSave = [];
  dataToTour.forEach((data) => {
    if (data["Empresa"] === company) {
      if (!start) {
        columnToStart = row;
      }
      start = true;
      dataToSave.push({ data: data, row: row });
    }
    row++;
  });
  return dataToSave;
}

function getDataToSaveOxxo(dataCompany, oxxoFile) {
  const titles = getTitlesConsolidatedOrdersComparative(dataCompany);
  let finalData = [];
  oxxoFile.forEach((item) => {
    data = [];
    for (let title in titles) {
      let valueToSave = getValuesOxxo(item, title);
      valueToSave = valueToSave === "NO" ? "" : valueToSave;
      data.push(valueToSave);
    }
    finalData.push(data);
  });
  return finalData;
}

function getTitlesConsolidatedOrdersComparative(dataCompany) {
  const titlesConsolidated = dataCompany[0].data;

  const keys = Object.keys(titlesConsolidated);
  const titles = {};

  for (let i = 2; i < keys.length; i++) {
    titles[keys[i]] = titlesConsolidated[keys[i]];
  }
  return titles;
}

function getValuesOxxo(obj, key) {
  if (key in obj) {
    return obj[key];
  } else {
    return "NO";
  }
}

function saveD1Data(dataToTour, numSemana) {
  const dataCompany = tourData('D1 SAS', dataToTour);
  const getDocumentID = LibComparativoDePedidos.getFileDespachoBySemana(FolderIdDespachos, numSemana);
  const d1Data = doCallEndpointSheetAPI(`sheetId=${getDocumentID}&queryType=data&sheetName=Consolidado Despachos&formatSheetData=D1`);


  const logRGOffices = ['D1 SAS', 'Isimo', 'Kokoriko']
  const companiesPositions = [];
  let cont = 3;
  dataToTour.forEach((item) => {
    const exist = companiesPositions.find(company => company.Empresa == item.Empresa);
    if (exist === undefined && item.Empresa != '') {
      companiesPositions.push({ Empresa: item.Empresa, column: cont });
    }
    cont++;
  });

  const d1FinalData = [];
  d1Data.forEach((item) => {
    const positionStarted = companiesPositions.find(itemCompany => typeof itemCompany.Empresa === 'string' && item.Cliente.toLowerCase().includes(itemCompany.Empresa.toLowerCase()));
    if (item.Cliente !== '' && !item.Cliente.includes('TOTAL')) {
      const cliente = item.Cliente.toLowerCase().includes('kokoriko') ? 'Kokoriko' : item.Cliente
      const yaExiste = d1FinalData.some(obj => obj.Empresa === cliente) && ['D1 SAS', 'Isimo', 'Kokoriko'].includes(cliente);
      d1FinalData.push({
        Empresa: cliente,
        REGIONAL: item.REGIONAL,
        'Leche Asada': item['Leche Asada Objetivo'],
        'Gelatina Mosaico': item['Gelatina Mosaico Objetivo'],
        'Arroz con Leche': item['Arroz con Leche Objetivo'],
        'Galletas Chips de Chocolate Objetivo': item['Galletas Chips de Chocolate Objetivo'],
        'Postre de Natas': item['Postres de Natas Objetivo'] ?? item['Postre de Natas Objetivo'],
        'Tres Leches': item['Tres Leches Objetivo'],
        'Gelitas': item['Gelitas Objetivo'],
        'Gelicloud': item['Gelicloud Objetivo'],
        'Gelifitt': item['Gelifitt Objetivo'],
        'Tiramisu': item['Tiramisu Objetivo'],
        'Cheesecake Frutos Rojos': '',
        'Arcoiris': '',
        'VALOR': item['Valor'],
        positionStarted: positionStarted?.column,
        yaExiste: yaExiste
      })
    }

  });

  const titles = getTitlesConsolidatedOrdersComparative(dataCompany);
  let finalData = [];
  d1FinalData.forEach((item) => {
    data = [];
    for (let title in titles) {
      let valueToSave = getValuesOxxo(item, title);
      valueToSave = valueToSave === "NO" ? "" : valueToSave;
      data.push(valueToSave);
    }
    finalData.push({ data: data, positionStarted: item.positionStarted, exist: item.yaExiste });
  });

  Logger.log("Data Final: ")
  Logger.log(JSON.stringify(finalData))

  const sheet = SpreadsheetApp.openById(sheetIdConsolidatedOrdersComparative);
  const sheetName = sheet.getSheetByName("Comparativo 2025");

  let contPosition = 0;
  finalData.forEach((data) => {
    const dataSheet = [data.data];
    contPosition = data.exist == false ? contPosition = 0 : contPosition;
    if (data.positionStarted !== undefined) {
      sheetName.getRange(data.positionStarted + contPosition, (columnNumerWeek + 3), 1, dataSheet[0].length).setValues(dataSheet);
    }
    contPosition++
  })
}














