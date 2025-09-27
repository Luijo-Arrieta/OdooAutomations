function DefineNextFollowUp() {
  try {
    Logger.log("DefineNextFollowUp")

    const filterDB = [
      {
        column: 'on_time_delivery',
        operator: '=',
        values: [null]
      },
      {
        column: 'pending',
        operator: '!=',
        values: [true]
      }
    ]

    const dataDB = sheetToJson(SheetDB, null, 1, 1, filterDB)

    if (!dataDB?.length) {
      Logger.log("No se encontraron seguimientos que cumplan con los filtros para continuar.");
      return;
    }

    let errores = [];

    for (let row of dataDB) {
      try {

        let next_follow_up = calcularNextFollowUp(
          row.order_date_planned
        );

        if (!next_follow_up) continue;

        let updateData = {
          order_Id: row.order_Id,
          pending: true,
          next_follow_up
        }

        updateOrderRow(updateData, updateOpt)
      }
      catch (e) {
        errores.push({
          errorType: e.type,
          errorMessage: e.message,
          elemento: row
        })
      }
    }
  } catch (e) {
    Logger.log("Errores:")
    Logger.log(JSON.stringify(errores))
    Logger.log(JSON.stringify(e.message))
  }
}

// Se debe activar todos los días a las 9.
function ZeroDayDeliveryAlert() {

  Logger.log("ZeroDayDeliveryAlert")

  // Se debe modificar ya que no debe filtrar por si hay envíos pendientes
  const rows = getOrdersToBeConfirmed();
  const alertPhone = "573104751978";

  let errores = [];

  for (let row of rows) {
    try {

      const days = getDaysRemainingForDelivery(row.order_date_planned)

      if (days > 1) continue;

      const responseApi = sendWhatsAppTemplateMessage(
        alertPhone,
        'delivery_alert',
        [row?.supplier_name ?? '', row?.order_name ?? '', row?.order_date_planned ?? '', row?.order_products_detail ?? '', row?.comment ?? '']
      )

      const idMessage = responseApi?.messages?.[0]?.id;

      const updateData = {
        order_Id: row?.order_Id,
        pending: false,
        next_follow_up: null,
        on_time_delivery: false,
        alert_sent: true,
        message_id: idMessage
      }

      updateOrderRow(updateData, updateOpt)

    } catch (e) {
      errores.push({
        errorType: e.type,
        errorMessage: e.message,
        element: row
      })
    }
  }

  Logger.log("Errores: ")
  Logger.log(JSON.stringify(errores))
}

function getOrdersToBeNotified() {
  Logger.log("SUB - getOrdersToBeNotified")

  const filterDB = [
    {
      column: 'template_sent_order_notification',
      operator: '!=',
      values: [true]
    },
    {
      column: 'on_time_delivery',
      operator: '=',
      values: [null]
    }
  ]

  const orderDB = {
    column: 'order_date',
    direction: false
  }

  const dataDB = sheetToJson(SheetDB, null, 1, 1, filterDB, orderDB)

  if (!dataDB?.length) {
    Logger.log("No hay órdenes pendientes de notificación.");
    return [];
  }

  Logger.log(`${dataDB.length} Filas por procesar.`)

  return dataDB
}

function getOrdersToBeConfirmed() {
  Logger.log("SUB - getOrdersToBeConfirmed")

  const hoy = Utilities.formatDate(new Date(), TZ, "yyyy-MM-dd")

  const filterDB = [
    {
      column: 'pending',
      operator: '=',
      values: [true]
    },
    {
      column: 'next_follow_up',
      operator: '!=',
      values: [false, null]
    },
    {
      column: 'on_time_delivery',
      operator: '=',
      values: [null]
    },
    {
      column: 'next_follow_up',
      operator: 'contains',
      values: [hoy]
    }
  ]

  const orderDB = {
    column: 'order_date',
    direction: false
  }

  const dataDB = sheetToJson(SheetDB, null, 1, 1, filterDB, orderDB)

  if (!dataDB?.length) {
    Logger.log("No hay órdenes pendientes de confirmación para hoy.");
    return [];
  }

  Logger.log(`${dataDB.length} Filas por procesar.`)

  return dataDB
}

function calcularNextFollowUp(order_date_planned) {

  const days = getDaysRemainingForDelivery(order_date_planned)

  const reminderDays = new Set([0, 1, 2, 3, 5, 7])

  // Condición 1: Si faltan igual o menos días restantes a los días de quiebre = Seguimiento diario
  if (reminderDays.has(days)) return Utilities.formatDate( new Date(), TZ, "yyyy-MM-dd");

  return null;
}

function getDaysRemainingForDelivery(order_date_planned) {
  const todayUTC = new Date().setHours(0,0,0,0);
  const deliveryDateUTC = new Date(order_date_planned).setHours(0,0,0,0);
  return Math.floor(
    (deliveryDateUTC - todayUTC) / MS_PER_DAY);
}

function createDeliveryAlertMessage(supplier, orderName, orderDetail, orderDeliveryDate, comment, quantities = false) {
  const reason = "cumplirá con las cantidades";
  const message = `
  *🚨ALERTA🚨*
  El proveedor *${supplier}* no *ha confirmado la entrega*.
  Pedido: *${orderName}*
  Fecha de entrega: *${orderDeliveryDate}*
  Detalle: ${orderDetail}
  
  Comentario: ${comment}`;
  return message;
}


function limpiarLogs(){
  const doc = DocumentApp.openById(logs);
  doc.getBody().clear();

  doc.saveAndClose();
}