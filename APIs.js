/**
 * Obtiene los datos de una orden de compra en Odoo a partir del número de orden.
 * @param {string} orderNumber - Número de la orden de compra (campo 'name' en Odoo).
 * @returns {Object|null} - Retorna el primer objeto que coincide con el número de orden o null si no encuentra resultados.
 */
function getOrderDataFromOdoo(orderNumber) {
  const payload = {
    "jsonrpc": "2.0",
    "method": "call",
    "params": {
      "model": "purchase.order",
      "method": "search_read",
      "args": [[["name", "in", orderNumber]]],
      "kwargs": {}
    }
  };
  const orderData = consumeEndpoint(payload, 'web/dataset/call_kw/purchase.order/search_read');
  return orderData;
}

/**
 * Agrega un comentario a una orden de compra en Odoo indicando la diferencia entre el total en el XML y el total en la orden.
 * @param {number} orderId - ID de la orden de compra en Odoo.
 * @param {number} totalInOrder - Total registrado en la orden de compra en Odoo.
 * @param {number} totalInXML - Total registrado en el archivo XML de la factura.
 * @returns {any} - Retorna la respuesta del servidor tras publicar el comentario en la orden.
 */
function addMessageToOrdenInOdoo(orderId, totalInOrder, totalInXML) {
  const payload = {
    "jsonrpc": "2.0",
    "method": "call",
    "params": {
      "context": {
        "lang": "es_CO",
        "tz": "America/Lima",
        "uid": 14,
        "allowed_company_ids": [1, 2, 3, 4],
        "mail_post_autofollow": false
      },
      "post_data": {
        "body": `<a href="https://ezerptest.odoo.com/web#model=res.partner&amp;id=16" class="o_mail_redirect" data-oe-id="16" data-oe-model="res.partner" target="_blank" contenteditable="false">@Nalvarte Zuñiga Lourdes Valentina</a> <a href="https://ezerptest.odoo.com/web#model=res.partner&amp;id=1266" class="o_mail_redirect" data-oe-id="1266" data-oe-model="res.partner" target="_blank" contenteditable="false">@Auxiliar Contable</a>   Los valores de la factura no coindiden, en el XML tiene el valor: ${totalInXML} y en la orden en Odoo es: ${totalInOrder} `,
        "attachment_ids": [],
        "attachment_tokens": [],
        "canned_response_ids": [],
        "message_type": "comment",
        "partner_ids": [16, 1266],
        "subtype_xmlid": "mail.mt_note",
        "partner_emails": [],
        "partner_additional_values": {}
      },
      "thread_id": orderId,
      "thread_model": "purchase.order"
    }
  }

  const messageToOrder = consumeEndpoint(payload, 'mail/message/post');
  return messageToOrder;
}

/**
 * Crea una factura en Odoo a partir de una orden de compra específica.
 * @param {number[]} orderId - ID de la orden de compra en Odoo.
 * @returns {any} - Retorna el resultado de la operación (generalmente los datos de la factura creada).
 */
function createInvoiceOnOdoo(orderId) {
  const payload = {
    "jsonrpc": "2.0",
    "method": "call",
    "params": {
      "args": [orderId],
      "kwargs": {
        "context": {
          "lang": "es_CO",
          "tz": "America/Lima",
          "allowed_company_ids": [
            1,
            2,
            3,
            4
          ],
          "create_bill": true
        }
      },
      "method": "action_create_invoice",
      "model": "purchase.order"
    }
  }
  const orderData = consumeEndpoint(payload, 'web/dataset/call_button');
  const resId = orderData?.res_id;
  return orderData;
}

/**
 * Crea una factura en Odoo a partir de una orden de compra específica.
 * @param {number[]} orderId - ID de la orden de compra en Odoo.
 * @returns {any} - Retorna el resultado de la operación (generalmente los datos de la factura creada).
 */
function confirmarInvoiceOnOdoo(borradorId, orderId) {
  const payload = {
    "jsonrpc": "2.0",
    "method": "call",
    "params": {
      "args": [borradorId],
      "kwargs": {
        "context": {
          "lang": "es_CO",
          "tz": "America/Lima",
          "allowed_company_ids": [1, 2, 3, 4],
          "active_id": orderId,
          "active_ids": [orderId],
          "active_model": "purchase.order",
          "default_move_type": "in_invoice",
          "display_account_trust": true,
          "validate_analytic": true
        }
      },
      "method": "action_post",
      "model": "account.move"
    }
  }

  const orderData = consumeEndpoint(payload, 'web/dataset/call_button');
  return orderData;
}

function actualizarFechaFactura(idFactura, idOrden, fecha) {
  const payload = {
    "jsonrpc": "2.0",
    "method": "call",
    "params": {
      "model": "account.move",
      "method": "onchange",
      "args": [
        [idFactura],
        { "invoice_date": fecha },
        ["invoice_date"],
        {
          "id": {},
          "invoice_date": {}
        }
      ],
      "kwargs": {
        "context": {
          "lang": "es_CO",
          "tz": "America/Lima",
          "allowed_company_ids": [1, 2, 3, 4],
          "active_model": "purchase.order",
          "display_account_trust": true,
          "active_id": idOrden,
          "active_ids": [idOrden],
          "default_move_type": "in_invoice"
        }
      }
    }
  }

  const payload2 = {
    "jsonrpc": "2.0",
    "method": "call",
    "params": {
      "model": "account.move",
      "method": "web_save",
      "args": [
        [idFactura],
        { "invoice_date": fecha }
      ],
      "kwargs": {
        "context": {
          "lang": "es_CO",
          "tz": "America/Lima",
          "allowed_company_ids": [1, 2, 3, 4],
          "active_model": "purchase.order",
          "display_account_trust": true,
          "active_id": idOrden,
          "active_ids": [idOrden],
          "default_move_type": "in_invoice"
        },
        "specification": {
          "id": {},
          "invoice_date": {}
        }
      }
    }
  }


  consumeEndpoint(payload, "web/dataset/call_kw/account.move/onchange")
  const data2 = consumeEndpoint(payload2, "web/dataset/call_kw/account.move/web_save")
  return data2
}

function getIdProveedorByNit(nit, company) {
  const payload = {
    "jsonrpc": "2.0",
    "method": "call",
    "params": {
      "model": "res.partner",
      "method": "name_search",
      "args": [],
      "kwargs": {
        "name": nit,
        "operator": "ilike",
        "args": [
          [
            "company_id",
            "in",
            [
              false,
              company
            ]
          ]
        ],
        "limit": 8,
        "context": {
          "lang": "es_CO",
          "tz": "America/Lima",
          "allowed_company_ids": [
            company
          ],
          "res_partner_search_mode": "supplier",
          "show_address": 1,
          "default_is_company": true,
          "show_vat": true
        }
      }
    }
  }

  const response = consumeEndpoint(payload, 'web/dataset/call_kw/res.partner/name_search');
  return response[0][0];
}

function getFechaContablePorFechaFacturacion(companyId, partnerId, invoiceDate) {
  const payload = {
    "jsonrpc": "2.0",
    "method": "call",
    "params": {
      "model": "account.move",
      "method": "onchange",
      "args": [
        [],
        {
          "state": "draft",
          "date": invoiceDate,
          "auto_post": "no",
          "asset_id_display_name": "Activo",
          "company_id": companyId,
          "journal_id": 29, // "Factura Proveedor"
          "move_type": "in_invoice",
          "payment_state": "not_paid",
          "invoice_filter_type_domain": "purchase",
          "currency_id": 8,
          "company_currency_id": 8,
          "commercial_partner_id": partnerId,
          "bank_partner_id": partnerId,
          "country_code": "CO",
          "tax_country_id": 49,
          "tax_calculation_rounding_method": "round_per_line",
          "highest_name": "/",
          "name": "/",
          "partner_id": partnerId,
          "partner_shipping_id": partnerId,
          "quick_edit_total_amount": 0,
          "invoice_date": invoiceDate,
          "invoice_date_due": invoiceDate,
          "l10n_co_edi_is_direct_payment": true,
          "l10n_co_edi_type": "1",
          "l10n_co_edi_operation_type": "10",
          "l10n_co_edi_payment_option_id": 1,
          "display_name": "Borrador de factura"
        },
        [
          "invoice_date"
        ],
        {
          "date": {},
          "highest_name": {},
          "name": {}
        }
      ],
      "kwargs": {
        "context": {
          "lang": "es_CO",
          "tz": "America/Lima",
          "allowed_company_ids": [companyId],
          "default_move_type": "in_invoice",
          "display_account_trust": true
        }
      }
    }
  }

  const response = consumeEndpoint(payload, 'web/dataset/call_kw/account.move/onchange');
  return response.value;
}

function getIdImpuestoByName(name, companyId) {
  const payload = {
    "jsonrpc": "2.0",
    "method": "call",
    "params": {
      "model": "account.tax",
      "method": "name_search",
      "args": [],
      "kwargs": {
        "name": name,
        "operator": "ilike",
        "args": [
          "&",
          "&",
          "&",
          ["type_tax_use", "=?", "purchase"],
          ["company_id", "parent_of", companyId],
          ["country_id", "=", 49],
          "!",
          ["id", "in", []]
        ],
        "limit": 8,
        "context": {
          "lang": "es_CO",
          "tz": "America/Lima",
          "allowed_company_ids": [companyId],
          "display_account_trust": true,
          "journal_id": 29,
          "quick_encoding_vals": false,
          "active_test": true,
          "append_type_to_tax_name": false
        }
      }
    }
  }

  const response = consumeEndpoint(payload, 'web/dataset/call_kw/res.partner/name_search');
  if (!response?.length || !response[0]?.length) return false;

  return response[0][0];
}

function getIdProductoByName(name, companyId) {
  const payload = {
    "jsonrpc": "2.0",
    "method": "call",
    "params": {
      "model": "product.product",
      "method": "name_search",
      "args": [],
      "kwargs": {
        "name": name,
        "operator": "ilike",
        "args": [
          [
            "purchase_ok",
            "=",
            true
          ]
        ],
        "limit": 8,
        "context": {
          "lang": "es_CO",
          "tz": "America/Lima",
          "allowed_company_ids": [companyId]
        }
      }
    }
  }

  const response = consumeEndpoint(payload, 'web/dataset/call_kw/res.partner/name_search');
  if (!response?.length || !response[0]?.length) return false;

  return response[0][0];
}

function getIdFacturasProveedor(company) {
  const payload = {
    "jsonrpc": "2.0",
    "method": "call",
    "params": {
      "model": "account.move",
      "method": "web_search_read",
      "args": [],
      "kwargs": {
        "specification": {
          "id": {}
        },
        "offset": 0,
        "order": "invoice_date DESC",
        "limit": 10000,
        "context": {
          "lang": "es_CO",
          "tz": "America/Lima",
          "allowed_company_ids": [company],
          "default_move_type": "in_invoice",
          "display_account_trust": true,
          "current_company_id": company
        },
        "count_limit": 10001,
        "domain": [
                "&",
                [
                    "move_type",
                    "=",
                    "in_invoice"
                ],
                "&",
                [
                    "state",
                    "=",
                    "posted"
                ],
                [
                    "invoice_date",
                    ">=",
                    "2025-01-01"
                ]
            ]
      }
    }
  }

  const response = consumeEndpoint(payload, 'web/dataset/call_kw/account.move/web_search_read');
  if (!response?.records?.length) return false;
  const ids = response.records.map(r => r.id)
  return ids;
}

function getDetalleFacturaProveedor(ids, companies) {
  const payload = {
    "jsonrpc": "2.0",
    "method": "call",
    "params": {
      "model": "account.move",
      "method": "web_read",
      "args": [
        ids
      ],
      "kwargs": {
        "context": {
          "lang": "es_CO",
          "tz": "America/Lima",
          "allowed_company_ids": companies,
          "default_move_type": "in_invoice",
          "display_account_trust": true
        },
        "specification": {
          "id": {},
          "name": {},
          "invoice_date": {},
          "invoice_line_ids": {
            "fields": {
              "id": {},
              "product_id": {
                "fields": {
                  "display_name": {}
                }
              },
              "name": {},
              "account_id": {
                "fields": {
                  "display_name": {}
                }
              },
              "analytic_distribution": {}
            },
            "limit": 40,
            "order": "sequence ASC, id ASC",
            "context": {
              "default_move_type": "in_invoice",
              "default_display_type": "product"
            }
          }
        }
      }
    }
  }

  const response = consumeEndpoint(payload, 'web/dataset/call_kw/account.move/web_read');
  if (!response?.length) return false;

  return response
}

function getIdCuentaProductoByName(nameCuenta, companyId, partnerId) {
  const payload = {
    "jsonrpc": "2.0",
    "method": "call",
    "params": {
      "model": "account.account",
      "method": "name_search",
      "args": [],
      "kwargs": {
        "name": nameCuenta,
        "operator": "ilike",
        "args": [
          "&",
          "&",
          [
            "deprecated",
            "=",
            false
          ],
          [
            "account_type",
            "not in",
            [
              "asset_receivable",
              "liability_payable",
              "off_balance"
            ]
          ],
          [
            "company_id",
            "parent_of",
            companyId
          ]
        ],
        "limit": 8,
        "context": {
          "lang": "es_CO",
          "tz": "America/Lima",
          "allowed_company_ids": [companyId],
          "partner_id": partnerId,
          "move_type": "in_invoice"
        }
      }
    }
  }

  const response = consumeEndpoint(payload, 'web/dataset/call_kw/account.account/name_search');
  if (!response?.length || !response[0]?.length) return false;

  return response[0][0];
}

function getAnaliticasProveedor(proveedorId, companyId) {
  const payload = {
    "jsonrpc": "2.0",
    "method": "call",
    "params": {
      "model": "account.move.line",
      "method": "onchange",
      "args": [
        [],
        {
          "move_id": {
            "company_id": companyId,
            "journal_id": getIdFacturaProveedorCompanyByNitOrName(companyId),
            "move_type": "in_invoice",
            "payment_state": "not_paid",
            "currency_id": 8,
            "name": "/",
            "partner_id": proveedorId,
            "partner_shipping_id": proveedorId,
            "quick_edit_total_amount": 0,
            "l10n_co_edi_type": "1",
            "l10n_co_edi_operation_type": "10",
            "invoice_line_ids": []
          }
        },
        [],
        {
          "analytic_distribution": {}
        }
      ],
      "kwargs": {
        "context": {
          "lang": "es_CO",
          "tz": "America/Lima",
          "allowed_company_ids": [companyId],
          "display_account_trust": true,
          "default_move_type": "in_invoice",
          "journal_id": getIdFacturaProveedorCompanyByNitOrName(companyId),
          "default_partner_id": proveedorId,
          "default_currency_id": 8,
          "default_display_type": "product",
          "quick_encoding_vals": false
        }
      }
    }
  }

  const response = consumeEndpoint(payload, 'web/dataset/call_kw/account.move.line/onchange');
  if (!response?.value?.analytic_distribution?.length) return false;

  return response.value.analytic_distribution;
}


function crearFacturaProveedor(factura, productos) {

  const payload = {
    "jsonrpc": "2.0",
    "method": "call",
    "params": {
      "model": "account.move",
      "method": "web_save",
      "args": [
        [],
        {
          "date": factura.fechaContable,
          "auto_post": "no",
          "company_id": factura.cliente.idOdoo,
          "journal_id": factura.cuentaDiario,
          "move_type": "in_invoice",
          "payment_state": "not_paid",
          "currency_id": 8,
          "name": "/",
          "partner_id": factura.proveedor.idOdoo,
          "partner_shipping_id": factura.proveedor.idOdoo,
          "quick_edit_total_amount": 0,
          "ref": factura.numeroFactura,
          "invoice_date": factura.fechaEmision,
          "invoice_date_due": factura.fechaEmision,
          "l10n_co_edi_type": "1",
          "l10n_co_edi_operation_type": "10",
          "l10n_co_edi_payment_option_id": 1,
          "invoice_line_ids": productos,
          "narration": `${factura.numeroFactura} - ${factura.proveedor.nombre}`
        }
      ],
      "kwargs": {
        "context": {
          "lang": "es_CO",
          "tz": "America/Lima",
          "allowed_company_ids": [factura.cliente.idOdoo],
          "default_move_type": "in_invoice",
          "display_account_trust": true
        },
        "specification": {
          "id": {},
          "name": {},
          "invoice_date": {}
        }
      }
    }
  }

  const response = consumeEndpoint(payload, 'web/dataset/call_kw/account.move/web_save');
  if (!response?.length) return false;

  return response[0];
}

function getDetalleProducto(idProduct, company) {
  const payload = {
    "jsonrpc": "2.0",
    "method": "call",
    "params": {
      "model": "product.product",
      "method": "web_read",
      "args": [
        [
          idProduct
        ]
      ],
      "kwargs": {
        "context": {
          "lang": "es_CO",
          "tz": "America/Lima",
          "allowed_company_ids": [company]
        },
        "specification": {
          "id": {},
          "name": {},
          "type": {},
          "uom_id": {},
          "taxes_id": {},
          "currency_id": {},
          "display_name": {}
        }
      }
    }
  }

  const response = consumeEndpoint(payload, 'web/dataset/call_kw/account.move/web_read');
  if (!response?.length) return false;

  return response[0]
}


function confirmarFacturaNoRecurrente(idBorradore) {
  const payload = {
    "jsonrpc": "2.0",
    "method": "call",
    "params": {
        "args": [
            [idBorradore]
        ],
        "kwargs": {
            "context": {
                "lang": "es_CO",
                "tz": "America/Lima",
                "allowed_company_ids": [1, 2, 3, 4],
                "default_move_type": "in_invoice",
                "display_account_trust": true,
                "validate_analytic": true
            }
        },
        "method": "action_post",
        "model": "account.move"
    }
}

  const response = consumeEndpoint(payload, 'web/dataset/call_button');
  if (response === null) return false;

  return true;
}
