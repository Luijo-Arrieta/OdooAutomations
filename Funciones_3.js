/**
 * Procesa la información del Google Sheet de activación del flujo
 *
 * @param {object{}} dataRaw — JSON/Objeto con la información cruda de la Google Sheet
 * @returns {object{facturas[], notasCredito[]}} Retorna el número e importe de las facturas y notas.
 */
function clasificarDataRawPorTipoFactura(dataRaw) {
  const facturas = [];
  const notasCredito = [];

  dataRaw.forEach(entry => {
    const numero = entry["Número Factura"];
    const importe = Math.abs(Number(entry["Importe Pagado"])); // valor absoluto

    if (numero.startsWith("FE")) {
      facturas.push({
        numero,
        importe
      });
    } else if (numero.includes("NC")) {
      notasCredito.push({
        name: numero,
        importe
      });
    }
  });

  return {
    facturas,
    notasCredito
  };
}

/**
 * Genera el objeto necesario para el payload de la creación de la nota crédito especial 
 *
 * @param {object[]} items   — Array de las NC extraidas desde el Google Sheet de ejecución.
 * @returns {object[]}  Objeto dispuestso para la creación de la nota crédito.
 */
function crearPayloadNCEspecial(nc_items) {
  // Construyo invoice_line_ids
  const invoice_line = construirInvoiceLineIdsEspeciales(nc_items);

  //Logger.log(JSON.stringify(invoice_line))

  const fechaHoy = hoyISO();

  // Encabezado base a partir de facturasDetalle
  return {
    date: fechaHoy,                              // fecha de la NC (por defecto hoy)
    auto_post: 'no',                             // si Odoo debe validarla automáticamente
    deferred_move_ids: [],                       // contabilidad diferida (vacío para NC estándar)
    deferred_original_move_ids: [],              // idem
    landed_costs_ids: [],                        // costes de transporte, etc. (vacío)
    company_id: 1,              // la compañía en la que creas la NC
    journal_id: 13,              // el diario de contabilidad a usar
    move_type: 'out_refund',                     // tipo “nota de crédito”
    payment_state: 'not_paid',                   // estado de pago inicial
    currency_id: 8,            // moneda de la factura original
    tax_cash_basis_created_move_ids: [],         // impuestos por caja (vacío)
    name: '/',                                   // nombre provisional; Odoo lo rellenará
    partner_id: 1418,              // el cliente de la factura original
    partner_shipping_id: 1418,     // la misma dirección de envío
    quick_edit_total_amount: 0,                  // campo interno de Odoo
    ref: false,                                  // referencia externa (si la hay)
    invoice_date_due: fechaHoy,                  // fecha de vencimiento (hoy por defecto)
    invoice_payment_term_id: 5,
    narration: false,                       // tu “concepto de NC” desde la hoja
    user_id: 14,                    // quién crea la NC
    invoice_user_id: 14,
    team_id: 1,                    // equipo/venta asociada
    invoice_origin: false,

    invoice_line_ids: invoice_line
  };

}

/**
 * Procesa el detalle de la factura para extraer el debito y el move_id
 *
 * @param {object{}} dataRaw — JSON/Objeto con la información cruda del detalle de la factura
 * @returns {object[]}
 */
function procesarDetalleFacturaParaPagos(dataRaw) {
  return dataRaw
    .slice() // para no modificar el array original
    .sort((a, b) => a.name.localeCompare(b.name))
    .map(factura => {
      const linea = factura.line_ids.find(l => l.name === factura.name);

      return {
        id: factura.id,
        name: factura.name,
        origin: factura.invoice_origin,
        move_id: linea?.id ?? null,
        debit: linea?.debit ?? null
      };
    });
}

/**
 * Toma la factura y la cruza con tantas facturas sea posible
 *
 * @param {object} facturas — Lista de detalle de facturas procesada para contener el debito y el move_id
 * @param {object} facturas — Lista de detalle de facturas procesada para contener el debito y el move_id
 * @param {number} id_NC — Identificador de la nota crédito por cruzar
 */
function cruzarFeConNc(sessio_id, facturas, valorNotaCreditoResidual, id_NC) {
  Logger.log(`Inicia el cruce de facturas con la nota crédito.`)
  var saldoDisponible = parseFloat(valorNotaCreditoResidual.toFixed(2));

  for (var i = 0; i < facturas.length; i++) {
    const factura = facturas[i];

    const Factura_name = factura.name
    // Asegurar que debito tenga máximo 2 decimales
    const Factura_debito = parseFloat(factura.debit.toFixed(2));

    // Si la factura supera el saldo restante, se ejecuta la asignación y se finaliza la función
    if (saldoDisponible <= 0) {
      Logger.log("Finaliza el cruce entre la nota crédito (id=" + id_NC + ") y las facturas dispuestas.")
      break;
    }

    let asignado = apiCruzarFeConNc(sessio_id, id_NC, factura.move_id)

    if (asignado) {
      saldoDisponible -= Factura_debito;
      saldoDisponible = parseFloat(saldoDisponible.toFixed(2));

      try {
        const dataOutput = {
          Factura_name,
          Factura_debito,
          ID_NC: id_NC
        }
        Utils_jsonToSheet([dataOutput], "OutPut Cruces", true)

      } finally {
        Logger.log("Asignado a " + Factura_name + ". Saldo restante: " + saldoDisponible);
        UI_showSuccess("Asignado a " + Factura_name + ". Saldo restante: " + saldoDisponible)
      }

    } else {
      Logger.log("No se pudo asignar la factura: " + factura.name);
    }
  }
}
