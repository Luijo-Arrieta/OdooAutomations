/**
 * ************************************************************************************************
 * Flujo de actualizar análisis de ventas
 * ************************************************************************************************
 */

/**
 * Obtiene los IDs de facturas de hace dos días hasta ahora (account.move) desde Odoo, usando los mismos
 * parámetros que tenías en Make.com, pero en Google Apps Script.
 *
 * @param {string} sessionId   El valor de cookie "session_id"
 * @param {string} fromDate    Fecha de inicio del filtro en "yyyy-MM-dd"
 * @return {number[]}          Lista de IDs de account.move encontrados
 */
function apiContabilidadGetIdsFacturas(sessionId) {

  const url = odooBaseUrl + '/web/dataset/call_kw/account.move/web_search_read';
  // Antes de llamar al API, definiendo fecha de hace dos días:
  const today = new Date();
  const twoDaysAgo = new Date(today);
  twoDaysAgo.setDate(today.getDate() - 2);
  const formattedTwoDaysAgo = Utilities.formatDate(twoDaysAgo, "GMT-5", "yyyy-MM-dd");

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
          "uid": 14,
          "allowed_company_ids": [1, 2, 3, 4],
          "bin_size": true,
          "default_move_type": "out_invoice",
          "display_account_trust": true,
          "current_company_id": 1
        },
        "count_limit": 10001,
        "domain": [
          "&",
          ["move_type", "=", "out_invoice"],
          "&",
          ["state", "=", "posted"],
          ["partner_id", "not in", [19, 1, 961, 960]],
          ["date", ">=", formattedTwoDaysAgo]
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

function apiContabilidadGetIdsNotasCredito(sessionId) {

  const url = odooBaseUrl + '/web/dataset/call_kw/account.move/web_search_read';
  // Antes de llamar al API, definiendo fecha de hace dos días:
  const today = new Date();
  const twoDaysAgo = new Date(today);
  twoDaysAgo.setDate(today.getDate() - 2);
  const formattedTwoDaysAgo = Utilities.formatDate(twoDaysAgo, "GMT-5", "yyyy-MM-dd");

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
          "uid": 14,
          "allowed_company_ids": [1, 2, 3, 4],
          "bin_size": true,
          "default_move_type": "out_refund",
          "display_account_trust": true,
          "current_company_id": 1
        },
        "count_limit": 10001,
        "domain": [
          "&",
          ["move_type", "=", "out_refund"],
          "&",
          ["state", "=", "posted"],
          ["partner_id", "not in", [19, 1, 961, 960]],
          ["date", ">=", formattedTwoDaysAgo]
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

/**
 * Obtiene el detalle de uno o varios account.move desde Odoo.
 *
 * @param {string} sessionId   El valor de cookie "session_id"
 * @param {number[]} ids       Array de IDs de account.move a leer
 * @return {Object[]}          Lista de objetos con los campos solicitados
 */
function apiContabilidadGetDetalleFacturas(sessionId, ids) {

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
          "bin_size": true,
          "default_move_type": "out_invoice"
        },
        "specification": {
          "id": {},
          "name": {},
          "invoice_date": {},
          "company_id": { "fields": { "display_name": {} } },
          "partner_id": { "fields": { "display_name": {} } },
          "invoice_line_ids": {
            "fields": {
              "product_id": { "fields": { "display_name": {} } },
              "quantity": {},
              "product_uom_id": { "fields": { "display_name": {} } },
              "price_subtotal": {}
            }
          }
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

  if (!json?.result) {
    throw new Error("Error al leer invoices: " + response.getContentText());
  }

  // json.result es un array de objetos con los campos solicitados
  return json.result;
}