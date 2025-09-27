function SendOrderConfirmation() {
  try {
    Logger.log("SendOrderConfirmation")

    // Falta agregar que la fecha debe ser hoy
    const rows = getOrdersToBeConfirmed();

    for (let row of rows) {

      let responseApi = sendTemplate_orden_creada4(
        row.supplier_phone,
        row.supplier_name,
        row.order_name,
        row.order_products_detail,
        row.order_date_planned,
        row.company_name
      )

      const idMessage = responseApi?.messages?.[0]?.id;

      let updateData = {
        order_Id: row.order_Id,
        template_sent_order_confirmation: true,
        template_sent_order_confirmation_date: Utilities.formatDate(
          new Date(), Session.getScriptTimeZone(), "yyyy-MM-dd HH:mm:ss"
        ),
        pending: false,
        template_order_confirmation_message_id: idMessage
      }

      let next_follow_up = calcularNextFollowUp(
        row.order_date_planned
      );

      if (next_follow_up){
        updateData.next_follow_up = next_follow_up;
      }

      updateOrderRow(updateData, updateOpt)

    }

  } catch (e) {
    throw new Error(`Error: ${JSON.stringify(e.message)}`)
  } 

}


function SendOrderNotification() {
  try {
    Logger.log("SendOrderNotification")

    const rows = getOrdersToBeNotified()

    if (!rows?.length) {
      Logger.log("No hay envíos de plantilla de notificación pendientes.");
      return;
    }

    for (let row of rows) {

      let responseApi = sendTemplate_orden_notification(
        row.supplier_phone,
        row.supplier_name,
        row.company_name,
        row.order_name,
        row.order_products_detail,
        row.order_date_planned,
      )

      const idMessage = responseApi?.messages?.[0]?.id;

      let updateData = {
        order_Id: row.order_Id,
        template_sent_order_notification: true,
        template_sent_order_notification_date: Utilities.formatDate(
          new Date(), Session.getScriptTimeZone(), "yyyy-MM-dd HH:mm:ss"
        ),
        template_order_notification_message_id: idMessage
      }

      let next_follow_up = calcularNextFollowUp(
        row.order_date_planned
      );

      if (next_follow_up){
        updateData.next_follow_up = next_follow_up;
      }

      updateOrderRow(updateData, updateOpt)

    }

  }
  catch (e) {
    throw new Error(`Error: ${JSON.stringify(e.message)}`)
  }
}

