 function flujoInformeCartera() {
  let session_id = LibOdooUtils.odooGetSessionId("EZ")
  const facturas = LibOdooAPIs.getFacturasNoPagadas(session_id);

  Logger.log("Facturas encontradas: " + facturas.length);

  // ID del Spreadsheet y nombre de la hoja
  const sheetId = "1W8JZhzagztpV7PJxOOnkGGT_Bqtc7Kn5gtUw8h4OInY"; 
  const sheetName = "Reporte Completo"; 

  // Escribe los datos en la hoja
  escribirFacturasEnSheet(facturas, sheetId, sheetName);

  Logger.log("Facturas correctamente actualizadas");

  // Envía el correo con los datos actualizados
  Enviarcorreo();

  Logger.log("Correo Enviado");

  //Forma manual 
}