function testApi() {
  const orderIds = getOrderId("2025-07-15");
  const ordersDetail = getOrderDetail(orderIds);
  const supplierIds = ordersDetail.map(d => d.partner_id);
  const suppliersDetail = getSupplierContactDetails(supplierIds);

}

/**
* Obtiene los IDs de las órdenes de compra que cumplen con los criterios especificados
* 
* @param {string} [dateFrom] - Fecha desde la cual buscar (formato yyyy-MM-dd). 
*                             Si no se proporciona, usa la fecha actual
* @returns {number[]|null} Array de IDs de órdenes de compra o null si no se encuentran
* 
* @description
* Busca órdenes de compra que cumplan con los siguientes criterios:
* - Estado: 'purchase' o 'done'
* - Estado de recepción: 'pending'
* - Fecha de aprobación mayor o igual a la fecha especificada
* 
* @example
* // Obtener órdenes desde hoy
* const orderIds = getOrderId();
* // returns: [3000, 2999] o null
* 
* @example
* // Obtener órdenes desde una fecha específica
* const orderIds = getOrderId("2025-07-15");
* // returns: [3000, 2999] o null
* 
* @example
* // No se encuentran órdenes
* const orderIds = getOrderId("2025-12-31");
* // returns: null
*/
function getOrderId(dateFrom) {
  const date = dateFrom || Utilities.formatDate(
    new Date(),
    Session.getScriptTimeZone(),
    "yyyy-MM-dd"
  );

  const params = {
    "model": "purchase.order",
    "method": "web_search_read",
    "args": [],
    "kwargs": {
      "specification": {
        "id": {}
      },
      "context": contextGeneral,
      "count_limit": 10001,
      "domain": [
        "&",
        ["state", "in", [ "purchase", "done" ]],
        "&",
        ["partner_id",
          "not in",
          [ 1, // Eliana Zaia
            19, // Alimentos tradición 
            960, // Tutti
            961, // Lazza
            818 // Chamboursy
          ]
        ],
        "&",
        [
          "receipt_status",
          "=",
          "pending"
        ],
        [
          "date_approve",
          ">=",
          date
        ]
      ]
    }
  }

  /**
   * {"length":2,"records":[{"id":3000},{"id":2999}]}
   * {"length":0,"records":[]}
   */
  const result = hacer_peticion("purchase.order/web_search_read", params)

  return result?.length ? result.records.map(r => r.id) : null;
}


/**
* Obtiene los detalles de una orden de compra específica
* 
* @param {number|number[]} orderId - ID de la orden de compra o array de IDs de órdenes
* @returns {Object[]|null} Array de objetos con los detalles de la orden o null si no se encuentra
* @returns {number} returns[].id - ID único de la orden
* @returns {string} returns[].name - Nombre/código de la orden
* @returns {number} returns[].partner_id - ID del proveedor
* @returns {number} returns[].company_id - ID de la empresa
* @returns {string} returns[].date_order - Fecha de la orden
* @returns {string} returns[].date_approve - Fecha de aprobación
* @returns {string} returns[].date_planned - Fecha planeada
* @returns {Object[]} returns[].order_line - Líneas de la orden
* @returns {number} returns[].order_line[].id - ID de la línea
* @returns {string} returns[].order_line[].name - Nombre del producto
* @returns {Object} returns[].order_line[].product_id - Información del producto
* @returns {number} returns[].order_line[].product_qty - Cantidad del producto
* @returns {Object} returns[].order_line[].product_uom - Unidad de medida
* @returns {number} returns[].order_line[].price_unit - Precio unitario
* @returns {string} returns[].notes - Notas de la orden
* 
* @example
* // Obtener detalles de una orden específica
* const order = getOrderDetail(3000);
* // returns: [{"id":3000,"name":"P02982","partner_id":651,...}]
* 
* @example
* // Obtener detalles de múltiples órdenes
* const orders = getOrderDetail([3000, 3001]);
* // returns: [{"id":3000,"name":"P02982",...}, {"id":3001,"name":"P02983",...}]
* 
* @example
* // Orden no encontrada
* const order = getOrderDetail(999);
* // returns: null
*/
function getOrderDetail(orderId) {

  const orderIds = Array.isArray(orderId) ? orderId : [orderId];

  let params = {
    "model": "purchase.order",
    "method": "web_read",
    "args": [
      orderIds
    ],
    "kwargs": {
      "context": contextGeneral,
      "specification": {
        "id": {},
        "name": {},
        "partner_id": {},
        "company_id": {},
        "date_order": {},
        "date_approve": {},
        "date_planned": {},
        "order_line": {
          "fields": {
            "id": {},
            "name": {},
            "product_id": {
              "fields": {
                "display_name": {}
              }
            },
            "product_qty": {},
            "product_uom": {
              "fields": {
                "display_name": {}
              }
            },
            "price_unit": {}
          }
        },
        "notes": {}
      }
    }
  }

  let result = hacer_peticion("purchase.order/web_read", params)

  return result ? result : null;
}

/**
* Obtiene los detalles de contacto de un proveedor específico
* 
* @param {number|number[]} supplierId - ID del proveedor o array de IDs de proveedores
* @returns {Object[]|null} Array de objetos con los detalles del proveedor o null si no se encuentra
* @returns {number} returns[].id - ID único del proveedor
* @returns {string} returns[].name - Nombre de la empresa proveedora
* @returns {string} returns[].phone - Número de teléfono de contacto
* @returns {string} returns[].email - Dirección de correo electrónico
* 
* @example
* // Obtener detalles de un proveedor específico
* const supplier = getSupplierContactDetails(651);
* // returns: [{"id":651,"name":"Makro Supermayorista S.A.S","phone":"316781669","email":"notificaciones@makro.com.co"}]
* 
* @example
* // Obtener detalles de múltiples proveedores
* const suppliers = getSupplierContactDetails([651, 652]);
* // returns: [{"id":651,"name":"Makro Supermayorista S.A.S",...}, {"id":652,"name":"Otro Proveedor",...}]
* 
* @example
* // Proveedor no encontrado
* const supplier = getSupplierContactDetails(999);
* // returns: null
*/
function getSupplierContactDetails(supplierId) {
  const supplierIds = Array.isArray(supplierId) ? supplierId : [supplierId];

  const params = {
    "model": "res.partner",
    "method": "web_read",
    "args": [
      supplierIds
    ],
    "kwargs": {
      "context": {},
      "specification": {
        "id": {},
        "name": {},
        "phone": {},
        "email": {}
      }
    }
  }

  let result = hacer_peticion("res.partner/web_read", params)

  return result ? result : null;
}


function hacer_peticion(extra_url, params) {
  const url = `https://ezerp.odoo.com/web/dataset/call_kw/${extra_url}`;
  const payload = {
    jsonrpc: "2.0",
    method: "call",
    params: params
  };

  const options = {
    method: "post",
    contentType: "application/json",
    payload: JSON.stringify(payload),
    muteHttpExceptions: true,
    headers: {
      Cookie: LibOdooUtils.odooGetSessionId("EZ")
    }
  };

  try {
    const response = UrlFetchApp.fetch(url, options);
    const json = response.getContentText();
    const data = JSON.parse(json);
    return data.result;
  } catch (error) {
    Logger.log("Error en la solicitud: " + error);
    return null;
  }
}