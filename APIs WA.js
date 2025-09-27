/**
 * Envía una plantilla de WhatsApp vía Meta Business Cloud API.
 *
 * @param {string} toPhone            Número destino en formato E.164 (solo dígitos, p.ej. "573123882224").
 * @param {string} templateName       El nombre técnico de la plantilla registrada (p.ej. "confirm_delivery").
 * @param {Array.<string>} params     Array con los placeholders en orden:
 *                                     [ pedido, referencia, fechaEntrega, nombreCliente ]
 * @returns {Object}                  La respuesta JSON de la API.
 */
function sendWhatsAppTemplateMessage(toPhone, templateName, params) {
  // Construir componentes del body de la plantilla
  let bodyParams = params.map(function (p) {
    // Convertimos el parámetro a string y lo truncamos a 30 chars
    const rawText = p == null ? '' : p.toString();
    const text = truncate(rawText);

    return {
      type: 'text',
      text: text
    };
  });

  let payload = {
    messaging_product: 'whatsapp',
    to: toPhone,
    type: 'template',
    template: {
      name: templateName,
      language: { code: "en" },
      components: [{
        type: 'body',
        parameters: bodyParams
      }]
    }
  };

  let url = 'https://graph.facebook.com/v15.0/' + BUSINESS_PHONE + '/messages';
  let options = {
    method: 'post',
    contentType: 'application/json',
    headers: {
      Authorization: 'Bearer ' + API_TOKEN
    },
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  };

  try {
    let resp = UrlFetchApp.fetch(url, options);
    let code = resp.getResponseCode();
    let txt = resp.getContentText();
    if (code >= 200 && code < 300) {
      return JSON.parse(txt);
    } else {
      throw new Error('HTTP ' + code + ': ' + txt);
    }
  } catch (e) {
    sendToChat(`Error enviando WhatsApp template
    Erro: ${e.message}
    Template: ${templateName}
    Enviado a: ${toPhone}`)
  }
}

/**
 * Envía un template de WhatsApp que mezcla parámetros de body y un botón de flow.
 *
 * @param {string} toPhone             Número de destino (incluyendo código de país).
 * @param {string} templateName        Nombre del template configurado en WhatsApp.
 * @param {string[]} bodyParamsTexts   Array de textos para los parámetros del body.
 * @param {string} flowToken           El token del flujo (flow_token) obtenido al iniciar el Flow.
 * @returns {Object}                   Respuesta JSON de la API de WhatsApp.
 */
function sendWhatsAppTemplateWithFlow(toPhone, templateName, templateParams) {

  // Construir Parámetros del body
  let bodyParams = templateParams.map(function (p) {
    // Convertimos el parámetro a string y lo truncamos a 30 chars
    const rawText = p == null ? '' : p.toString();
    const text = truncate(rawText);

    return {
      type: 'text',
      text: text
    };
  });

  const flowToken = `${toPhone}-${templateName}-${new Date().getTime()}`

  // Componentes: Primero el body de la plantilla, luego el botón flow
  const components = [
    {
      type: 'body',
      parameters: bodyParams
    },
    {
      type: 'button',
      sub_type: 'flow',
      index: '0',
      parameters: [
        {
          type: 'action',
          action: {
            flow_token: flowToken,//flowToken,
            flow_action_data: {}  // si tu Flow no necesita datos adicionales, lo dejas vacío
          }
        }
      ]
    }
  ];

  const payload = {
    messaging_product: 'whatsapp',
    to: toPhone,
    type: 'template',
    template: {
      name: templateName,
      language: { code: "en" },
      components: components
    }
  }

  let url = 'https://graph.facebook.com/v15.0/' + BUSINESS_PHONE + '/messages';
  let options = {
    method: 'post',
    contentType: 'application/json',
    headers: {
      Authorization: 'Bearer ' + API_TOKEN
    },
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  };

  try {
    let resp = UrlFetchApp.fetch(url, options);
    let code = resp.getResponseCode();
    let txt = resp.getContentText();
    if (code >= 200 && code < 300) {
      return JSON.parse(txt);
    } else {
      throw new Error('HTTP ' + code + ': ' + txt);
    }
  } catch (e) {
    sendToChat(`Error enviando WhatsApp template con formularo/flujo: 
    Erro: ${e.message}
    FlowToken: ${flowToken}`)
  }
}

/**
 * Send Template
 */

function sendTemplate_orden_notification(toPhone, supplierName, compania, orderName, productsDetail, deliveryDate,) {
  const templateName = 'order_notification';

  let respuesta = sendWhatsAppTemplateMessage(
    toPhone,
    templateName,
    [supplierName, compania, orderName, productsDetail, deliveryDate]
  );

  Logger.log(JSON.stringify(respuesta));

  return respuesta;
}

function sendTemplate_orden_creada4(toPhone, supplierName, orderName, productsDetail, deliveryDate, compania) {
  const templateName = 'orden_creada4';

  let respuesta = sendWhatsAppTemplateWithFlow(
    toPhone,
    templateName,
    [supplierName, orderName, productsDetail, deliveryDate, compania]
  );

  Logger.log(JSON.stringify(respuesta));

  return respuesta;
}

/**
 * Envía un mensaje de texto simple por WhatsApp Cloud API.
 *
 * @param {string} toPhone         Número destino en formato E.164 (solo dígitos, p.ej. "573123882224").
 * @param {string} phoneNumberId   Tu WhatsApp Business Phone Number ID.
 * @param {string} accessToken     Token Bearer de la API (tus credenciales).
 * @param {string} message         Texto a enviar (puede incluir saltos de línea).
 * @returns {Object}               Respuesta JSON de la API.
 * @throws {Error}                Si la API responde con un código >= 300.
 */
function sendWhatsAppTextMessage(toPhone, message) {
  try {
    const url = `https://graph.facebook.com/v15.0/${BUSINESS_PHONE}/messages`;
    const payload = {
      messaging_product: 'whatsapp',
      to: toPhone,
      type: 'text',
      text: {
        body: message,
        preview_url: false
      }
    };

    const options = {
      method: 'post',
      contentType: 'application/json',
      headers: {
        Authorization: `Bearer ${API_TOKEN}`
      },
      payload: JSON.stringify(payload),
      muteHttpExceptions: true
    };

    const response = UrlFetchApp.fetch(url, options);
    const code = response.getResponseCode();
    const txt = response.getContentText();

    if (code >= 200 && code < 300) {
      return JSON.parse(txt);
    }

    throw new Error(`HTTP ${code}: ${txt}`);
  } catch (e) {
    sendToChat(`Error al enviar un mensaje de texto por WhatsApp.
    Mensaje: ${message}
    Para: ${toPhone}
    Error: ${e.message}`)
  }

}

/**
 * Trunca un string a maxLength caracteres,
 * añadiendo "..." si tuvo que recortar.
 *
 * @param {string} str – el texto original
 * @param {number} maxLength – longitud máxima permitida
 * @return {string} texto truncado o original
 */
function truncate(str, maxLength = 30) {
  if (!str) return '';
  return (str.length > maxLength)
    ? str.substring(0, maxLength - 3) + '...'
    : str;
}
