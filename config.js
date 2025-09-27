/**
 * Unified Environment Configuration
 * This file consolidates all environment variables and configurations from multiple env*.js files
 */

// ===========================================
// WHATSAPP API CONFIGURATION
// ===========================================
const WEBHOOK_VERIFY_TOKEN = 'testEliana';
const WABAID = 3827440200905116;
const API_TOKEN = 'EAANfoxhmrjoBOxYpGR4vEnDdQ7x2DsSu7f3XFOytxjFxOQKsUP7Sxm57f6lC5VwwiBtZBDNHNZAKuifEENuj04WYrPwNDIlaj5LGnby4j5TpZBFzltkVKSF0CqZAkMI0H3ZC8At7F6rqwK2YwWThoyTQ0wzPYSE1qQiZAokrUqshXVYfz3WZCM5YHOzY11NYKmrvwZDZD';
const PORT = 3000;
const BUSINESS_PHONE = 614145445111849;
const API_VERSION = 'v22.0';
const logs = '1ZrZT_MVNVWjVekpzKClEFxU_YkvQ5_Gjj-JnxbUUveA';
const PurchasingPhone = "51922993386";

// ===========================================
// GOOGLE SHEETS CONFIGURATION
// ===========================================
const SheetDB = "1geFb9xUeoimuiFO87hr9pRD0pT1Yic3_WGkE7U37oq8";
const SheetNameBD = "Data";
const SheetNameHistory = "MessageHistory";

// Google Sheets IDs for various databases
const IdCosolidadoComparativoPedidos = "17cQr-WMUGyvJ80Mg-WZe4ahJkfKfJ0vh3Rvlbt6ncf8";
const NameCosolidadoComparativoPedidos = "Comparativo 2025";
const LogDocId = "1QS_mZvOhH6xM3PZEIA1OvVZkvQA3kK5YkKUVEc5GFwI";
const BdArchivosId = "1iJEuc-xSwfba2KPDn38xSpjA-3TKiONQ-VgsVSUZODQ";
const BdOrdenesId = "1CoOTOF7DgCKJcHWKPVpInzQqzB_zj-NqBAcm4N07dRc";
const IdBdCorreos = "1t0_mXPp3VWwYKor1uR57dAlF__IqCLWdHIg5mUtzKrw";
const IdBdLeyendasProductos = "18uchuLoNDj8w8h08e5FWaBbgEHFAqYkuxhJfCelq1-k";
const IdDocLog = "1u98Xrxj5pcFM-Pv25BKwghXUufNwXYF9DUOWSMxIJqs";

// ===========================================
// ODOO CONFIGURATION
// ===========================================
// Production and Test URLs
const odooBaseUrlTest = "https://ezerptest.odoo.com";
const odooBaseUrl = "https://ezerp.odoo.com";

// Default limit for records (can be overridden per operation)
const odooRegistrosLimite = 30000;

// Odoo session for testing
const odooSessionId = "session_id=47bd2e2aba0afb57a32cc484092a294b298f5383";

// ===========================================
// GENERAL CONFIGURATION
// ===========================================
const MS_PER_DAY = 1000 * 60 * 60 * 24;
const TZ = Session.getScriptTimeZone();

// ZIP file MIME types
const zipMimeTypes = new Set([
  'application/zip',
  'application/x-zip-compressed',
  'application/octet-stream'
]);

// ===========================================
// COMPANY CONFIGURATION
// ===========================================
const Companies = [
  {id: 1, nit: "35512662", name: "Eliana", journalFacturaProveedor: 12},
  {id: 2, nit: "901646300", name: "Artesanal", journalFacturaProveedor: 21},
  {id: 3, nit: "901646415", name: "Tutti", journalFacturaProveedor: 29},
  {id: 4, nit: "901646529", name: "Lazza", journalFacturaProveedor: 37},
];

// ===========================================
// WHATSAPP TEMPLATES AND EXAMPLES
// ===========================================
/**
 * Template for order confirmation:
 * 
 * Buen día, 
 * Se quiere confirmar la entrega del pedido *{{1}}*, el cual hace referencia a: {{2}} ...
 * Con fecha de entrega el *{{3}}* a nombre de *{{4}}*. 
 * No olvidar enviar el formato de lotes.
 * ¿Confirman fecha de entrega y cantidades?
 * 
 * Example:
 * Orden de compra generada
 * Buen día, 
 * Se quiere confirmar la entrega del pedido S07435, el cual hace referencia a: 
 * Leche Colanta 1000L
 * ...
 * Con fecha de entrega el 13/07/2025 a nombre de Eliana Zaia. 
 * No olvidar enviar el formato de lotes.
 * ¿Confirman fecha de entrega y cantidades?
 */

// ===========================================
// WHATSAPP WEBHOOK EXAMPLES
// ===========================================
const jsonRespuestaButton = { 
  "object": "whatsapp_business_account", 
  "entry": [{ 
    "id": "3827440200905116", 
    "changes": [{ 
      "value": { 
        "messaging_product": "whatsapp", 
        "metadata": { 
          "display_phone_number": "573138867064", 
          "phone_number_id": "614145445111849" 
        }, 
        "contacts": [{ 
          "profile": { "name": "Luis J" }, 
          "wa_id": "573104751978" 
        }], 
        "messages": [{ 
          "context": { 
            "from": "573138867064", 
            "id": "wamid.HBgMNTczMTA0NzUxOTc4FQIAERgSNDJCNzU5NjczQUNGRTU2ODg2AA==" 
          }, 
          "from": "573104751978", 
          "id": "wamid.HBgMNTczMTA0NzUxOTc4FQIAEhgUM0ZFQTIxMTM3MUFBNjlDNzI1ODMA", 
          "timestamp": "1752612473", 
          "type": "button", 
          "button": { 
            "payload": "NO", 
            "text": "NO" 
          } 
        }] 
      }, 
      "field": "messages" 
    }] 
  }] 
};

const jsonRespuestaText = { 
  "object": "whatsapp_business_account", 
  "entry": [{ 
    "id": "3827440200905116", 
    "changes": [{ 
      "value": { 
        "messaging_product": "whatsapp", 
        "metadata": { 
          "display_phone_number": "573138867064", 
          "phone_number_id": "614145445111849" 
        }, 
        "contacts": [{ 
          "profile": { "name": "Luis J" }, 
          "wa_id": "573104751978" 
        }], 
        "messages": [{ 
          "from": "573104751978", 
          "id": "wamid.HBgMNTczMTA0NzUxOTc4FQIAEhgUM0ZGMUVBM0FEOTZCRDIyNDJFRUEA", 
          "timestamp": "1752612498", 
          "text": { "body": "Hola WebHoock" }, 
          "type": "text" 
        }] 
      }, 
      "field": "messages" 
    }] 
  }] 
};

const jsonRespuestaForm = {
  "object": "whatsapp_business_account",
  "entry": [{
    "id": "3827440200905116",
    "changes": [{
      "value": {
        "messaging_product": "whatsapp",
        "metadata": {
          "display_phone_number": "573138867064",
          "phone_number_id": "614145445111849"
        },
        "contacts": [{
          "profile": {"name": "Luis J"},
          "wa_id": "573104751978"
        }],
        "messages": [{
          "context": {
            "from": "573138867064",
            "id": "wamid.HBgMNTczMTA0NzUxOTc4FQIAERgSODEzQzVBNUMwMTYwQjdBNDJFAA=="
          },
          "from": "573104751978",
          "id": "wamid.HBgMNTczMTA0NzUxOTc4FQIAEhggN0Q0MzU2NzY3RDE0RDEyMTZBODA0OTRBNkYzNzk1QTkA",
          "timestamp": "1754068283",
          "type": "interactive",
          "interactive": {
            "type": "nfm_reply",
            "nfm_reply": {
              "response_json": "{\"screen_0_Elige_una_opcin_0\":\"1_Si\",\"screen_0_Deja_un_comentario_1\":\"2 leches asadas menos\",\"flow_token\":\"unused\"}",
              "body": "Sent",
              "name": "flow"
            }
          }
        }]
      },
      "field": "messages"
    }]
  }]
};

const jsonWHSent = {
  "object": "whatsapp_business_account",
  "entry": [{
    "id": "3827440200905116",
    "changes": [{
      "value": {
        "messaging_product": "whatsapp",
        "metadata": {
          "display_phone_number": "573138867064",
          "phone_number_id": "614145445111849"
        },
        "statuses": [{
          "id": "wamid.HBgMNTczMTA0NzUxOTc4FQIAERgSNjVCOTlGM0I0REFERjU1OTlEAA==",
          "status": "delivered",
          "timestamp": "1754073919",
          "recipient_id": "573104751978",
          "conversation": {
            "id": "fd33b595a83889530b2778c53d4c2445",
            "origin": {"type": "utility"}
          },
          "pricing": {
            "billable": false,
            "pricing_model": "PMP",
            "category": "utility",
            "type": "free_customer_service"
          }
        }]
      },
      "field": "messages"
    }]
  }]
};

// ===========================================
// ODOO CONTEXT CONFIGURATION
// ===========================================
const contextGeneral = {
  "lang": "es_CO",
  "tz": "America/Lima",
  "allowed_company_ids": [1, 3, 4, 2]
};

// ===========================================
// DATA MODELS
// ===========================================
const updateOpt = {
  spreadSheetId: SheetDB,
  sheetName: 'Data',
  headerRow: 1
};

const DataModel = {
  "order_Id": null,
  "order_name": null,
  "order_products_detail": null,
  "order_date": null,
  "order_date_approve": null,
  "order_date_planned": null,
  "order_notes": null,

  "company_id": null,
  "company_name": null,

  "supplier_id": null,
  "supplier_name": null,
  "supplier_phone": null,
  "supplier_email": null,

  "template_sent_order_notification": null,
  "template_sent_order_notification_date": null,
  "template_order_notification_message_id": null,

  "template_sent_order_confirmation": null,
  "template_sent_order_confirmation_date": null,
  "template_order_confirmation_message_id": null,
  
  "pending": null,
  "next_follow_up": null,
  
  "on_time_delivery": null,
  "alert_sent": null
};

const DataHistoryModel = {
  "sender_phone": null,
  "recipient_phone": null,
  "message": null,
  "status": null,
  "timestamp": null,
  "wam_id_message": null,
  "wam_id_response": null
};

// ===========================================
// UTILITY FUNCTIONS
// ===========================================

/**
 * Realiza una petición POST a un endpoint de Odoo usando session_id para autenticación.
 * @param {Object} payload - Datos que se enviarán en el cuerpo de la solicitud.
 * @param {string} extraURL - Ruta que se agregará a la URL base del servidor Odoo.
 * @param {boolean} useTest - Si usar el servidor de prueba (default: false).
 * @returns {any|null} - Devuelve la propiedad `result` de la respuesta si es exitosa, o null si ocurre un error.
 */
function consumeEndpoint(payload, extraURL, useTest = false) {
  const url = useTest ? odooBaseUrlTest : odooBaseUrl;
  const session_id = odooSessionId;
  const endpoint = `${url}/${extraURL}`;

  const options = {
    method: "post",
    contentType: "application/json",
    headers: {
      "Cookie": session_id
    },
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  };

  const response = UrlFetchApp.fetch(endpoint, options);
  const data = JSON.parse(response.getContentText());
  
  if (data?.error) {
    Logger.log("Error obteniendo órdenes de compra: ");
    Logger.log(JSON.stringify(payload));
    Logger.log(JSON.stringify(data.error.data.debug));
    return null;
  }

  return data.result;
}

/**
 * Envía un mensaje al webhook de Google Chat.
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
    method: 'post',
    contentType: 'application/json; charset=UTF-8',
    payload: JSON.stringify(payload),
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
