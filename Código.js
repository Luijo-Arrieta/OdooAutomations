function doPost(e) {
  try {

    // Intentamos parsear el JSON que llega por POST
    const payloadObj = JSON.parse(e.postData.contents);

    const resultado = LibPedidos.manejarWebhook(payloadObj);

    return ContentService
      .createTextOutput(JSON.stringify(resultado))
      .setMimeType(ContentService.MimeType.JSON);
  }
  catch (error) {
    // Si falla el JSON.parse o tu lógica, devolvemos error estructurado
    return ContentService
      .createTextOutput(JSON.stringify({
        status: "error",
        mensaje: "Error al procesar el webhook",
        detalle: error.message
      }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}


function probarWebhookLocalmenteConPost() {
  const url = "https://script.google.com/macros/s/AKfycbzc2CG8fKL-E8WuilLe-pmEzKuTiddV-lM5aeK99kEom_IuydAEx4TVDKiOkkh8PdL9/exec";
  
  // Construimos el mismo payload que maneja manejarWebhook()
  const payload = {
    token: "c#pFg2xGDf*f*wz",
    negocio: "d1",
    datos: [["Hola"], ["Archivo"], ["De"], ["prueba"]]
  };
  
  // Opciones para enviar el JSON crudo
  const options = {
    method: "post",
    headers: {
      "Content-Type": "application/json"
    },
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  };
  
  const response = UrlFetchApp.fetch(url, options);
  
  Logger.log("🔁 Código de respuesta: " + response.getResponseCode());
  Logger.log("📄 Cuerpo de respuesta: " + response.getContentText());
}

function _forzarAutorizacion() {
  // Estas líneas forzarán a que Apps Script nos pida autorización de Sheets y Docs
  SpreadsheetApp.openById("1CoOTOF7DgCKJcHWKPVpInzQqzB_zj-NqBAcm4N07dRc");
  DocumentApp.create("Prueba de permisos");
}

