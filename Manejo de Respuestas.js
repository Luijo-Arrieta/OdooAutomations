function recepcionRespuesta(jsonWH) {
  try {
    LibDocUtils.writeLogToDoc(logs, 'WebHook Hackaton: ' + JSON.stringify(jsonWH))
    
      
    // Line de prueba
    const value = jsonWH.entry?.[0].changes?.[0]?.value;

    // Verificar si es un evento de actualización de plantilla (no procesar)
    if (value?.event === "APPROVED" && value?.message_template_name) {
      LibDocUtils.writeLogToDoc(logs, `Plantilla aprobada: ${value.message_template_name}`)
      return; // No procesar estos eventos
    }

    const falied = value?.statuses?.[0].status;
    if (falied == "failed") {
      sendToChat(`Erro:
        ${JSON.stringify(value, null, 2)}`)
    }

    const message = value?.messages?.[0];

    if (!message) {
      // Registra los mensajes que no son respuesta
      const statuses = value?.statuses?.[0];

      // Si no hay statuses, terminar el flujo
      if (!statuses) {
        LibDocUtils.writeLogToDoc(logs, `No hay statuses para procesar`)
        return;
      }

      LibDocUtils.writeLogToDoc(logs, `statuses`)

      let dm = { ...DataHistoryModel };

      dm.sender_phone = value?.metadata?.display_phone_number;
      dm.recipient_phone = statuses.recipient_id;
      dm.message = "Mensaje Plantilla. " + JSON.stringify(statuses?.conversation || '');
      dm.status = statuses.status;
      dm.timestamp = statuses.timestamp;
      dm.wam_id_message = statuses.id;

      addMessageToHistory(dm);

      LibDocUtils.writeLogToDoc(logs, `Finaliza el flujo`)
      return;
    }

    const wam_id_response = message?.context?.id;

    const orderData = getOrderDataByWaId(wam_id_response);

    message.fromCompany = orderData?.supplier_name || "";
    message.order = orderData?.order_name || "";
    message.products = orderData?.order_products_detail || "";

    const typeMessage = value.messages?.[0]?.type;

    LibDocUtils.writeLogToDoc(logs, `typeMessage: ${JSON.stringify(typeMessage)}
  contactCompanyName: ${JSON.stringify(orderData?.supplier_name)}`)

    switch (typeMessage) {
      case 'button': return handleButtonResponse(message);
      case 'interactive': return handleInteractiveResponse(message);
      default: return handleInvalidResponse(message)
    }

  } catch (e) {
    LibDocUtils.writeLogToDoc(logs, "Error al ejecutar el manejo de webHook \n" + `${JSON.stringify(e.message)}`)
    sendToChat(`Erro: ${e.message}
    ${JSON.stringify(jsonWH, null, 2)}`)
  }
}

function callWebhookN8N(body, logs) {
var url = 'https://n8n-develop.imagineapps.co/webhook/wh-hackaton';

const options = {
  method: "post", // También puede ser "put" o "delete" según el caso
  contentType: "application/json", // Indicamos que enviamos JSON
  payload: body, // Convertimos el objeto a JSON
  muteHttpExceptions: true // Para capturar errores en la respuesta
};
LibDocUtils.writeLogToDoc(logs, 'body--------', body)
try {
  // Hacemos la petición
  const response = UrlFetchApp.fetch(url, options);
  LibDocUtils.writeLogToDoc(logs, 'response--------', body)
  // Mostramos la respuesta en los logs
  Logger.log("Código de estado: " + response.getResponseCode());
  Logger.log("Respuesta: " + response.getContentText());
} catch (error) {
  Logger.log("Error en la petición: " + error);
  }
}

function handleButtonResponse(message) {
const messageTest = jsonRespuestaButton.entry?.[0].changes?.[0]?.value.messages?.[0];

const supplierPhone = message?.from;
const supplierName = message?.fromCompany;
const buttonMessage = message.button.text;

sendWhatsAppTemplateMessage(
  PurchasingPhone,
  'button_response_confirmation',
  [supplierName, supplierPhone, buttonMessage, message.order, message.products]
)

LibDocUtils.writeLogToDoc(logs, `Finaliza el flujo`)

}

function handleInteractiveResponse(message) {
const messageTest = jsonRespuestaForm.entry?.[0].changes?.[0]?.value.messages?.[0];

const supplierPhone = message?.from;

const supplierName = message?.fromCompany;

const jsonResponse = JSON.parse(message?.interactive?.nfm_reply?.response_json);
LibDocUtils.writeLogToDoc(logs, `jsonResponse: ${JSON.stringify(jsonResponse)} `);

sendWhatsAppTemplateMessage(
  PurchasingPhone,
  'button_response_confirmation',
  [supplierName, supplierPhone, `"${jsonResponse?.option}" Comentario: ${jsonResponse?.comment}`, message.order, message.products]
)

const messageToBeAnswered = message?.context?.id;
const messageReplay = message?.id;

const filterDB = [
  {
    column: 'template_order_confirmation_message_id',
    operator: '=',
    values: [messageToBeAnswered]
  }
]

const row = sheetToJson(SheetDB, "Data", 1, 1, filterDB)?.[0]

if (!row) throw new Error("No se encontró el mensaje en la hoja Data");

const option = jsonResponse?.option?.toLowerCase();

let updateData = {
  order_Id: row.order_Id,
  on_time_delivery: option.startsWith("si"),
  alert_sent: true
}

updateOrderRow(updateData, updateOpt)

updateMessageHistoryRow(messageToBeAnswered, messageReplay);

LibDocUtils.writeLogToDoc(logs, `Finaliza el flujo`)

}

function handleInvalidResponse(message) {
const messageTest = jsonRespuestaText.entry?.[0].changes?.[0]?.value.messages?.[0];

const supplierPhone = message?.from;

if (supplierPhone == PurchasingPhone) return;

const responseMessage = "No se pueden procesa mensajes que no sean opciones predeterminadas." // SE QUEDA

sendWhatsAppTextMessage(
  supplierPhone,
  responseMessage
)

}

/**
* Se recibe el número en string, luego se pasa a INT debido a como funciona sheetToJson para hacer las comparaciones.
*/
function getOrderDataByWaId(wa_id) {

let filterDB = [
  {
    column: "template_order_notification_message_id",
    operator: '=',
    values: [wa_id]
  }
]

const dataDB_Notification = sheetToJson(SheetDB, null, 1, 1, filterDB);

if (dataDB_Notification?.length){
  return dataDB_Notification?.[0];
}

filterDB = [
  {
    column: "template_order_confirmation_message_id",
    operator: '=',
    values: [wa_id]
  }
]

const dataDB_confirmation = sheetToJson(SheetDB, null, 1, 1, filterDB);

return dataDB_confirmation?.[0];
}

function pruebas() {
const wh = {"object":"whatsapp_business_account","entry":[{"id":"3827440200905116","changes":[{"value":{"messaging_product":"whatsapp","metadata":{"display_phone_number":"573138867064","phone_number_id":"614145445111849"},"contacts":[{"profile":{"name":"Luis J"},"wa_id":"573104751978"}],"messages":[{"context":{"from":"573138867064","id":"wamid.HBgMNTczMTA0NzUxOTc4FQIAERgSNzkyNzkzMUJFOEQ0RUE2NzAyAA=="},"from":"573104751978","id":"wamid.HBgMNTczMTA0NzUxOTc4FQIAEhgUM0Y3RDk4QjREQkRGN0YzQkU2NjYA","timestamp":"1754503059","type":"button","button":{"payload":"Si","text":"Si"}}]},"field":"messages"}]}]};

recepcionRespuesta(wh)

}

/**
* Recibe un objeto DataHistoryModel
*/
function addMessageToHistory(dataHistoryModel) {
try {

  LibDocUtils.writeLogToDoc(logs, `addMessageToHistory: 
  ${JSON.stringify(dataHistoryModel)}`)

  LibSheetUtils.jsonToSheet(
    [dataHistoryModel],
    SheetNameHistory,
    true,
    SheetDB
  )
} catch (e) {
  LibDocUtils.writeLogToDoc(logs, `Error: ${e.message}`)
}
}