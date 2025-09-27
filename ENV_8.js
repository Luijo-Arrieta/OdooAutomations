const WEBHOOK_VERIFY_TOKEN = 'testEliana';
const WABAID = 3827440200905116;
const API_TOKEN = 'EAANfoxhmrjoBOxYpGR4vEnDdQ7x2DsSu7f3XFOytxjFxOQKsUP7Sxm57f6lC5VwwiBtZBDNHNZAKuifEENuj04WYrPwNDIlaj5LGnby4j5TpZBFzltkVKSF0CqZAkMI0H3ZC8At7F6rqwK2YwWThoyTQ0wzPYSE1qQiZAokrUqshXVYfz3WZCM5YHOzY11NYKmrvwZDZD';
const PORT = 3000;
const BUSINESS_PHONE = 614145445111849;
const API_VERSION = 'v22.0';
const logs = '1ZrZT_MVNVWjVekpzKClEFxU_YkvQ5_Gjj-JnxbUUveA'; // '1coAASIb_fnrfbQC7lMSXD8BZLMgXXq9V_ovC50lsIsA';
const SheetDB = "1geFb9xUeoimuiFO87hr9pRD0pT1Yic3_WGkE7U37oq8";
const SheetNameBD = "Data";
const SheetNameHistory = "MessageHistory";
const MS_PER_DAY = 1000 * 60 * 60 * 24;
const TZ = Session.getScriptTimeZone();
const PurchasingPhone = "51922993386";

const jsonRespuestaButton = { "object": "whatsapp_business_account", "entry": [{ "id": "3827440200905116", "changes": [{ "value": { "messaging_product": "whatsapp", "metadata": { "display_phone_number": "573138867064", "phone_number_id": "614145445111849" }, "contacts": [{ "profile": { "name": "Luis J" }, "wa_id": "573104751978" }], "messages": [{ "context": { "from": "573138867064", "id": "wamid.HBgMNTczMTA0NzUxOTc4FQIAERgSNDJCNzU5NjczQUNGRTU2ODg2AA==" }, "from": "573104751978", "id": "wamid.HBgMNTczMTA0NzUxOTc4FQIAEhgUM0ZFQTIxMTM3MUFBNjlDNzI1ODMA", "timestamp": "1752612473", "type": "button", "button": { "payload": "NO", "text": "NO" } }] }, "field": "messages" }] }] }

const jsonRespuestaText = { "object": "whatsapp_business_account", "entry": [{ "id": "3827440200905116", "changes": [{ "value": { "messaging_product": "whatsapp", "metadata": { "display_phone_number": "573138867064", "phone_number_id": "614145445111849" }, "contacts": [{ "profile": { "name": "Luis J" }, "wa_id": "573104751978" }], "messages": [{ "from": "573104751978", "id": "wamid.HBgMNTczMTA0NzUxOTc4FQIAEhgUM0ZGMUVBM0FEOTZCRDIyNDJFRUEA", "timestamp": "1752612498", "text": { "body": "Hola WebHoock" }, "type": "text" }] }, "field": "messages" }] }] }

const jsonRespuestaForm = {"object":"whatsapp_business_account","entry":[{"id":"3827440200905116","changes":[{"value":{"messaging_product":"whatsapp","metadata":{"display_phone_number":"573138867064","phone_number_id":"614145445111849"},"contacts":[{"profile":{"name":"Luis J"},"wa_id":"573104751978"}],"messages":[{"context":{"from":"573138867064","id":"wamid.HBgMNTczMTA0NzUxOTc4FQIAERgSODEzQzVBNUMwMTYwQjdBNDJFAA=="},"from":"573104751978","id":"wamid.HBgMNTczMTA0NzUxOTc4FQIAEhggN0Q0MzU2NzY3RDE0RDEyMTZBODA0OTRBNkYzNzk1QTkA","timestamp":"1754068283","type":"interactive","interactive":{"type":"nfm_reply","nfm_reply":{"response_json":"{\"screen_0_Elige_una_opcin_0\":\"1_Si\",\"screen_0_Deja_un_comentario_1\":\"2 leches asadas menos\",\"flow_token\":\"unused\"}","body":"Sent","name":"flow"}}}]},"field":"messages"}]}]}

const jsonWHSent = {"object":"whatsapp_business_account","entry":[{"id":"3827440200905116","changes":[{"value":{"messaging_product":"whatsapp","metadata":{"display_phone_number":"573138867064","phone_number_id":"614145445111849"},"statuses":[{"id":"wamid.HBgMNTczMTA0NzUxOTc4FQIAERgSNjVCOTlGM0I0REFERjU1OTlEAA==","status":"delivered","timestamp":"1754073919","recipient_id":"573104751978","conversation":{"id":"fd33b595a83889530b2778c53d4c2445","origin":{"type":"utility"}},"pricing":{"billable":false,"pricing_model":"PMP","category":"utility","type":"free_customer_service"}}]},"field":"messages"}]}]}


/**
 * Plantilla: 
 * 
 * Buen día, 
 * Se quiere confirmar la entrega del pedido *{{1}}*, el cual hace referencia a: {{2}} ...
 * Con fecha de entrega el *{{3}}* a nombre de *{{4}}*. 
 * No olvidar enviar el formato de lotes.
 * ¿Confirman fecha de entrega y cantidades?
 * 
 * 
 * Ejemplo:
 * 
 * Orden de compra generada
 * Buen día, 
 * Se quiere confirmar la entrega del pedido S07435, el cual hace referencia a: 
 * Leche Colanta 1000L
 * ...
 * Con fecha de entrega el 13/07/2025 a nombre de Eliana Zaia. 
 * No olvidar enviar el formato de lotes.
 * ¿Confirman fecha de entrega y cantidades?
 */

const contextGeneral = {
  "lang": "es_CO",
  "tz": "America/Lima",
  "allowed_company_ids": [1,3,4,2]
}

const updateOpt = {
    spreadSheetId: SheetDB,
    sheetName: 'Data',
    headerRow: 1
  }

const DataModel = {
   "order_Id": null,
   "order_name": null,
   "order_products_detail": null,
   "order_date": null,
   "order_date_approve":null,
   "order_date_planned":null,
   "order_notes": null,

   "company_id": null,
   "company_name": null,

   "supplier_id": null,
   "supplier_name": null,
   "supplier_phone":null,
   "supplier_email":null,

   "template_sent_order_notification":null,
   "template_sent_order_notification_date": null,
   "template_order_notification_message_id": null,

   "template_sent_order_confirmation":null,
   "template_sent_order_confirmation_date": null,
   "template_order_confirmation_message_id": null,
   
   "pending": null,
   "next_follow_up": null,
   
   "on_time_delivery": null,
   "alert_sent": null
  }

                              						
const DataHistoryModel = {
    "sender_phone" : null,
    "recipient_phone": null,
    "message": null,
    "status": null,
    "timestamp" : null,
    "wam_id_message": null,
    "wam_id_response": null
  }

/**
 * Envía un mensaje al webhook de Google Chat.
 *
 * @param {string} text El contenido del mensaje a enviar.
 */
function sendToChat(text) {
  // URL del webhook (incluye key y token)
  const url = "https://chat.googleapis.com/v1/spaces/AAQAanu32dM/messages?key=AIzaSyDdI0hCZtE6vySjMm-WEfRq3CPzqKqqsHI&token=KrLtR4vmHRZ8CjEK7q-S1WDEg2lPIHfsjnAWKKrlkMQ";

  // Payload con el texto
  const payload = {
    text: text
  };

  // Opciones de la petición
  const options = {
    method:      'post',
    contentType: 'application/json; charset=UTF-8',
    payload:     JSON.stringify(payload),
    muteHttpExceptions: true  // para que no lance excepción en 4xx/5xx
  };

  // Ejecuta la llamada HTTP
  const response = UrlFetchApp.fetch(url, options);

  // Logging y manejo de errores sencillo
  const code = response.getResponseCode();
  const body = response.getContentText();
  if (code >= 200 && code < 300) {
    Logger.log('✅ Mensaje enviado correctamente: %s', text);
  } else {
    Logger.log('❌ Error %s al enviar mensaje: %s', code, body);
  }
}
