/**
 * Unified implementations of doGet and doPost functions
 * This file consolidates all Google Apps Script web app handlers
 */

/**
 * Main doGet function that handles all GET requests
 * Routes requests based on parameters to different functionalities
 * @param {Object} e - Event object containing request parameters
 * @returns {TextOutput} Response with JSON or text data
 */
function doGet(e) {
  try {
    // Check if this is a webhook verification request
    const mode = e.parameter["hub.mode"];
    const token = e.parameter["hub.verify_token"];
    const challenge = e.parameter["hub.challenge"];
    
    if (mode === "subscribe" && token === 'testEliana') {
      Logger.log("✅ Webhook verified correctly.");
      return ContentService
        .createTextOutput(challenge)
        .setMimeType(ContentService.MimeType.TEXT);
    }

    // Check for sheet query operations
    const queryType = e.parameter.queryType;
    if (queryType) {
      return handleSheetQuery(e);
    }

    // Check for company ID operations
    const companyId = e.parameter.company_id;
    if (companyId) {
      return handleCompanyData(e);
    }

    // Check for week-based operations
    const semana = e.parameter.semana;
    if (semana) {
      return handleWeekData(e);
    }

    // Default response for unrecognized requests
    return ContentService
      .createTextOutput("No valid operation specified")
      .setMimeType(ContentService.MimeType.TEXT);

  } catch (error) {
    Logger.log("❌ Error in doGet: " + error.message);
    return ContentService
      .createTextOutput(`Error: ${error.message}`)
      .setMimeType(ContentService.MimeType.TEXT);
  }
}

/**
 * Main doPost function that handles all POST requests
 * Routes requests based on content to different webhook handlers
 * @param {Object} e - Event object containing POST data
 * @returns {TextOutput} Response with JSON or text data
 */
function doPost(e) {
  try {
    const payloadObj = JSON.parse(e.postData.contents);
    
    // Check if this is a WhatsApp webhook
    if (payloadObj && typeof payloadObj === 'object') {
      // Try WhatsApp webhook handler first
      try {
        LibDocUtils.writeLogToDoc(logs, 'WhatsApp webhook received');
        LibDocUtils.writeLogToDoc(logs, "📩 Webhook received:\n" + JSON.stringify(payloadObj, null, 2));
        LibWhatsApp.recepcionRespuesta(payloadObj);
        
        return ContentService
          .createTextOutput("OK")
          .setMimeType(ContentService.MimeType.TEXT);
      } catch (whatsappError) {
        Logger.log("Not a WhatsApp webhook, trying order webhook...");
      }
    }

    // Try order webhook handler
    try {
      const resultado = LibPedidos.manejarWebhook(payloadObj);
      return ContentService
        .createTextOutput(JSON.stringify(resultado))
        .setMimeType(ContentService.MimeType.JSON);
    } catch (orderError) {
      Logger.log("Not an order webhook either...");
    }

    // If neither handler works, return error
    return ContentService
      .createTextOutput(JSON.stringify({
        status: "error",
        message: "Unknown webhook type",
        detail: "Could not process the received payload"
      }))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (error) {
    Logger.log("❌ Error in doPost: " + error.message);
    return ContentService
      .createTextOutput(JSON.stringify({
        status: "error",
        message: "Error processing webhook",
        detail: error.message
      }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

/**
 * Handles sheet query operations
 * Supports various query types: data, currentWeek, lastRow, justNumberWeek, getFolderFiles
 * @param {Object} e - Event object with sheet query parameters
 * @returns {TextOutput} Response with sheet data
 */
function handleSheetQuery(e) {
  const sheetId = e.parameter?.sheetId;
  const queryType = e.parameter.queryType;
  const sheetName = e.parameter?.sheetName;
  const documentType = e.parameter?.documentType;
  const formatSheetData = e.parameter?.formatSheetData;
  const dateProcess = e.parameter?.dateProcess;
  const folderId = e.parameter?.folderId;

  if (!queryType) {
    return ContentService.createTextOutput("Missing 'queryType'").setMimeType(ContentService.MimeType.TEXT);
  }

  try {
    let sheetData;
    let sheet;
    let last;
    
    if (sheetId !== undefined) {
      sheet = SpreadsheetApp.openById(sheetId);
      sheet = sheetName == undefined ? sheet.getSheets()[0] : sheet.getSheetByName(sheetName);
      sheetData = sheet.getDataRange().getValues();
      last = sheet.getLastRow();
    }

    let data = { sheet: sheet, sheetId: sheetId, sheetName: sheetName, last: last };
    
    switch (queryType) {
      case 'data':
        // Get all sheet information
        data = sheetData;
        // Format data if requested
        if (formatSheetData !== undefined && formatSheetData === 'Oxxo') {
          data = getDataOxooTemplate(sheetData);
        } else if (formatSheetData !== undefined && formatSheetData === 'D1') {
          data = getDataD1Template(sheetData);
        }
        break;
        
      case 'currentWeek':
        // Get current week information from dispatch weeks DB
        const currentWeekData = searchRowByWeek(sheetData, documentType, dateProcess);
        const IDdocumento = currentWeekData == undefined ? 'No document found' : currentWeekData[2];
        data = IDdocumento;
        break;
        
      case 'lastRow':
        // Get last row of sheet file
        data = last;
        break;
        
      case 'justNumberWeek':
        // Get current week number
        const date = dateProcess == undefined ? '' : dateProcess;
        data = getCurrentWeek(date);
        break;
        
      case 'getFolderFiles':
        // Get files from folder
        data = getFolderFiles(folderId);
        break;
        
      default:
        data = "Unknown query type";
    }

    const dataToReturn = {
      data: data,
      queryType: queryType
    };

    return ContentService.createTextOutput(JSON.stringify(dataToReturn))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (error) {
    return ContentService.createTextOutput(`Error: ${error.message}`)
      .setMimeType(ContentService.MimeType.TEXT);
  }
}

/**
 * Handles company data operations
 * Processes company IDs and returns DIAN bot data
 * @param {Object} e - Event object with company_id parameter
 * @returns {TextOutput} Response with company data
 */
function handleCompanyData(e) {
  const raw = e.parameter.company_id;
  // Convert to array of numbers (empty if not provided)
  const companyIds = raw
    ? raw.split(',')
         .map(s => Number(s.trim()))
         .filter(n => !isNaN(n))
    : [];

  try {
    const dataToReturn = OdooWithMake.flujoCrearDataParaBotDIAN(companyIds);
    Logger.log(JSON.stringify(dataToReturn));
    return ContentService.createTextOutput(JSON.stringify(dataToReturn))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (error) {
    return ContentService.createTextOutput(`Error: ${error.message}`)
      .setMimeType(ContentService.MimeType.TEXT);
  }
}

/**
 * Handles week-based data operations
 * Processes week parameter and returns consolidated order information
 * @param {Object} e - Event object with semana parameter
 * @returns {TextOutput} Response with week data
 */
function handleWeekData(e) {
  const textoBuscado = e.parameter.semana;

  try {
    const dataToReturn = OdooWithMake.flujoObtenerRangoInfoCosolidadoPedidos(textoBuscado);
    Logger.log(JSON.stringify(dataToReturn));
    return ContentService.createTextOutput(JSON.stringify(dataToReturn))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (error) {
    return ContentService.createTextOutput(`Error: ${error.message}`)
      .setMimeType(ContentService.MimeType.TEXT);
  }
}

/**
 * Calculates current week number of the year in ISO format
 * Week 1 begins on Monday of the first week with at least 4 days
 * @param {string} dateProcess - Optional date to process in DD/MM/YYYY format
 * @returns {number} Current week number (between 1 and 53)
 */
function getCurrentWeek(dateProcess = '') {
  let currentDate = new Date();
  let day, month, year = 0;
  let currentFormated = new Date(Date.UTC(currentDate.getFullYear(), currentDate.getMonth(), currentDate.getDate()));
  
  if (dateProcess !== '') {
    const fechaOriginal = dateProcess;
    [day, month, year] = fechaOriginal.split("/");
    currentFormated = new Date(Date.UTC(year, month - 1, day));
  }

  const dayWeek = currentFormated.getUTCDay() || 7; // If Sunday (0), becomes 7
  currentFormated.setUTCDate(currentFormated.getUTCDate() + 4 - dayWeek);

  // Calculate start of year
  const startYear = new Date(Date.UTC(currentFormated.getUTCFullYear(), 0, 1));
  const numberWeek = (Math.ceil((((currentFormated - startYear) / 86400000) + 1) / 7) + 1);
  return numberWeek;
}

/**
 * Searches for row in data array that contains current week number in first column
 * @param {Array} data - Array of data to search
 * @param {string} documentType - Type of document to filter
 * @param {string} dateProcess - Optional date to process
 * @returns {Array|undefined} First row matching current week, or undefined if not found
 */
function searchRowByWeek(data, documentType, dateProcess) {
  const currentDate = new Date();
  const date = dateProcess == undefined ? '' : dateProcess;
  const weekToFilter = `week ${getCurrentWeek(date)}`.toLowerCase();
  return data.find((fila, index) => 
    index !== 0 && 
    (fila[0].toLowerCase().includes(weekToFilter) && 
     fila[1] == currentDate.getFullYear() && 
     fila[3] == documentType)
  );
}

/**
 * Maps Oxxo consolidated data
 * @param {Array} sheetData - Raw sheet data
 * @returns {Array} Formatted data objects
 */
function getDataOxooTemplate(sheetData) {
  const headersRowIndex = 0;
  const headers = sheetData[headersRowIndex + 2].map(h => h.trim());
  const rows = sheetData.slice(headersRowIndex + 3);
  
  const data = rows.map(row => {
    const obj = {};
    row.forEach((value, i) => {
      obj[headers[i]] = value;
    });
    return obj;
  });
  return data;
}

/**
 * Maps D1 consolidated data
 * @param {Array} sheetData - Raw sheet data
 * @returns {Array} Formatted data objects
 */
function getDataD1Template(sheetData) {
  const headersRowIndex = 6;
  const headers = sheetData[headersRowIndex].map(h => h.trim());
  const rows = sheetData.slice(headersRowIndex + 1);
  
  const data = rows.map(row => {
    const obj = {};
    row.forEach((value, i) => {
      obj[headers[i]] = value;
    });
    return obj;
  });
  return data;
}

/**
 * Gets files from a folder filtered by current week
 * @param {string} folderId - ID of the folder to search
 * @returns {Array} Array of file objects with name, id, and url
 */
function getFolderFiles(folderId) {
  const currentWeek = getCurrentWeek();
  const folder = DriveApp.getFolderById(folderId);
  const files = folder.getFiles();
  const filesFiltrados = [];

  while (files.hasNext()) {
    const file = files.next();
    const fileName = file.getName();

    if (fileName.toLowerCase().includes(`week ${currentWeek}`)) {
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

/**
 * Test function for local webhook testing with POST
 * Sends a test payload to the webhook URL
 */
function probarWebhookLocalmenteConPost() {
  const url = "https://script.google.com/macros/s/AKfycbzc2CG8fKL-E8WuilLe-pmEzKuTiddV-lM5aeK99kEom_IuydAEx4TVDKiOkkh8PdL9/exec";
  
  // Build same payload that manejarWebhook() handles
  const payload = {
    token: "c#pFg2xGDf*f*wz",
    negocio: "d1",
    datos: [["Hello"], ["File"], ["Test"], ["data"]]
  };
  
  // Options for sending raw JSON
  const options = {
    method: "post",
    headers: {
      "Content-Type": "application/json"
    },
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  };
  
  const response = UrlFetchApp.fetch(url, options);
  
  Logger.log("🔁 Response code: " + response.getResponseCode());
  Logger.log("📄 Response body: " + response.getContentText());
}

/**
 * Forces authorization for Sheets and Docs
 * These lines will force Apps Script to request authorization
 */
function _forzarAutorizacion() {
  SpreadsheetApp.openById("1CoOTOF7DgCKJcHWKPVpInzQqzB_zj-NqBAcm4N07dRc");
  DocumentApp.create("Permission test");
}
