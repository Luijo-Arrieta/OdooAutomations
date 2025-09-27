function apiCrearNC_v3(sessionId, data) {
  const url = odooBaseUrl + '/web/dataset/call_kw/account.move/web_search_read';

  const payload = {
    "jsonrpc": "2.0",
    "method": "call",
    "params": {
      "model": "account.move",
      "method": "web_save",
      "args": [
        [],
        data
      ],
      "kwargs": {
        "context": {
          "lang": "es_CO",
          "tz": "America/Lima",
          "allowed_company_ids": [1, 2, 3, 4],
          "default_move_type": "out_refund"
        },
        "specification": {
          "id": {},
          "name": {},
          "narration": {},
          "invoice_line_ids": {
            "fields": {
              "id": {},
              "product_id": {},
              "name": {},
              "account_id": {}
            }
          }
        }
      }
    }
  };
  Logger.log("Payload:")
  Logger.log(JSON.stringify(payload))

  const options = {
    method: "post",
    contentType: "application/json",
    headers: {
      "Cookie": sessionId
    },
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  };

  const response = UrlFetchApp.fetch(url, options);
  const json = JSON.parse(response.getContentText());

  // Comprueba que haya resultado y devuelve el primer objeto
  if (!json.result || !Array.isArray(json.result) || json.result.length === 0) {
    throw new Error(`Error al crear la nota crédito: ${JSON.stringify(json)}`);
  }

  // Aquí está tu objeto limpio:
  return json.result[0];
}

function apiConfirmarNC_V1(sessionId, id_nc) {
  const url = odooBaseUrl + '/web/dataset/call_button';

  const payload = {
    "jsonrpc": "2.0",
    "method": "call",
    "params": {
      "args": [[id_nc]],
      "kwargs": {
        "context": {
          "default_move_type": "out_refund",
          "lang": "es_CO",
          "tz": "America/Lima",
          "allowed_company_ids": [1, 2, 3, 4]
        }
      },
      "method": "action_post",
      "model": "account.move"
    }
  };

  Logger.log("Payload:")
  Logger.log(JSON.stringify(payload))

  const options = {
    method: "post",
    contentType: "application/json",
    headers: {
      "Cookie": sessionId
    },
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  };

  const response = UrlFetchApp.fetch(url, options);
  const statusCode = response.getResponseCode();

  // 1. Aceptar cualquier código de estado entre 200 y 299
  if (statusCode < 200 || statusCode >= 300) {
    throw new Error("Error HTTP: " + statusCode + "\n" + responseText);
  }
}

function apiProcesarNC_V1(sessionId, id_nc) {
  const url = odooBaseUrl + '/web/dataset/call_button';

  const payload = {
    "jsonrpc": "2.0",
    "method": "call",
    "params": {
      "args": [[id_nc]],
      "kwargs": {
        "context": {
          "default_move_type": "out_refund",
          "lang": "es_CO",
          "tz": "America/Lima",
          "allowed_company_ids": [1, 2, 3, 4]
        }
      },
      "method": "button_process_edi_web_services",
      "model": "account.move"
    }
  };

  Logger.log("Payload:")
  Logger.log(JSON.stringify(payload))

  const options = {
    method: "post",
    contentType: "application/json",
    headers: {
      "Cookie": sessionId
    },
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  };

  const response = UrlFetchApp.fetch(url, options);
  const statusCode = response.getResponseCode();


  // 1. Aceptar cualquier código de estado entre 200 y 299
  if (statusCode < 200 || statusCode >= 300) {
    throw new Error("Error HTTP: " + statusCode + "\n" + responseText);
  }

}

function apiObtenerDetalleImportesNC(sessionId, ids) {
  const url = odooBaseUrl + '/web/dataset/call_kw/account.move/web_read'; // Ajusta esta URL según corresponda

  const payload = {
    "jsonrpc": "2.0",
    "method": "call",
    "params": {
      "model": "account.move",
      "method": "web_read",
      "args": [ids],
      "kwargs": {
        "specification": {
          "name": {},
          "amount_residual": {}
        }
      }
    }
  };

  const options = {
    method: "post",
    contentType: "application/json",
    headers: {
      "Cookie": sessionId
    },
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  };

  // Llamada al API
  const response = UrlFetchApp.fetch(url, options);
  const json = JSON.parse(response.getContentText());

  if (!json.result) {
    throw new Error("Error al leer notas de crédito: " + response.getContentText());
  }

  // Retornar solo los campos "name"
  return json.result
}

/**
 * Obtiene los IDs de facturas de hace dos días hasta ahora (account.move) desde Odoo, usando los mismos
 * parámetros que tenías en Make.com, pero en Google Apps Script.
 *
 * @param {string} sessionId   El valor de cookie "session_id"
 * @param {list} listNames    Lista de facturas ["FE20375","FE20375"]
 * @return {number[]}          Lista de IDs de account.move encontrados
 */
function apiObtenerIdsFacturasPorPagarPorNombre(sessionId, listNames) {
  const url = odooBaseUrl + '/web/dataset/call_kw/account.move/web_search_read';

  const payload = {
    "jsonrpc": "2.0",
    "method": "call",
    "params": {
      "model": "account.move",
      "method": "web_search_read",
      "args": [],
      "kwargs": {
        "specification": {},
        "offset": 0,
        "order": "invoice_date ASC",
        "limit": odooRegistrosLimite,
        "context": {
          "lang": "es_CO",
          "tz": "America/Lima",
          "allowed_company_ids": [1, 2, 3, 4],
          "default_move_type": "out_invoice",
        },
        "count_limit": 10001,
        "domain": [
          "&",
          ["move_type", "=", "out_invoice"],
          "&",
          ["state", "=", "posted"],
          "&",
          ["payment_state", "in", ["not_paid", "partial"]],
          "&",
          ["partner_id", "in", [1418]],
          ["name", "in", listNames]
        ]
      }
    }
  };

  const options = {
    method: "post",
    contentType: "application/json",
    headers: {
      "Cookie": sessionId
    },
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  };

  const response = UrlFetchApp.fetch(url, options);
  const json = JSON.parse(response.getContentText());

  if (!json.result || !json.result.records) {
    throw new Error("No se obtuvieron registros: " + response.getContentText());
  }

  // 4) Extraigo y retorno solo los IDs
  return json.result.records.map(function (rec) {
    return rec.id;
  });
}

function apiObtenerDetalleFacturas_V3(sessionId, ids) {
  const url = odooBaseUrl + '/web/dataset/call_kw/account.move/web_read';

  const payload = {
    "jsonrpc": "2.0",
    "method": "call",
    "params": {
      "model": "account.move",
      "method": "web_read",
      "args": [ids],
      "kwargs": {
        "context": {
          "lang": "es_CO",
          "tz": "America/Lima",
          "allowed_company_ids": [1, 2, 3, 4],
          "default_move_type": "out_invoice"
        },
        "specification": {
          "id": {},
          "name": {},
          "invoice_origin": {},
          "line_ids": {
            "fields": {
              "id": {},
              "name": {},
              "debit": {}
            }
          }
        }
      }
    }
  }

  const options = {
    method: "post",
    contentType: "application/json",
    headers: {
      "Cookie": sessionId
    },
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  };

  // Llamada al API
  const response = UrlFetchApp.fetch(url, options);
  const json = JSON.parse(response.getContentText());

  if (!json.result) {
    throw new Error("Error al leer invoices: " + response.getContentText());
  }

  // json.result es un array de objetos con los campos solicitados
  return json.result;
}

function apiCruzarFeConNc(sessionId, id_asignador, id_asignado) {
  const url = odooBaseUrl + '/web/dataset/call_kw/account.move/js_assign_outstanding_line';

  const payload = {
    "jsonrpc": "2.0",
    "method": "call",
    "params": {
      "model": "account.move",
      "method": "js_assign_outstanding_line",
      "args": [id_asignador, id_asignado],
      "kwargs": {
        "context": {
          "lang": "es_CO",
          "tz": "America/Lima",
          "allowed_company_ids": [1, 2, 3, 4]
        }
      }
    }
  };

  const options = {
    method: "post",
    contentType: "application/json",
    headers: {
      "Cookie": sessionId
    },
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  };

  // Llamada al API
  const response = UrlFetchApp.fetch(url, options);
  const statusCode = response.getResponseCode();


  // 1. Aceptar cualquier código de estado entre 200 y 299
  if (statusCode < 200 || statusCode >= 300) {
    throw new Error("Error HTTP: " + statusCode + "\n" + responseText);
  }

  return true
}