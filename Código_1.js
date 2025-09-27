function doGet(e) {
  // 1) Leer el parámetro raw
  const textoBuscado = e.parameter.semana; 

  try {
    const dataToReturn = OdooWithMake.flujoObtenerRangoInfoCosolidadoPedidos(textoBuscado)
    Logger.log(JSON.stringify(dataToReturn))
    return ContentService.createTextOutput(JSON.stringify(dataToReturn))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (error) {
    return ContentService.createTextOutput(`Error: ${error.message}`)
      .setMimeType(ContentService.MimeType.TEXT);
  }
}