function doGet(e) {
  // 1) Leer el parámetro raw
  const raw = e.parameter.company_id; 
  // 2) Convertirlo a array de números (vacío si no viene)
  const companyIds = raw
    ? raw.split(',')               // separar por comas
         .map(s => Number(s.trim()))  // convertir a Number
         .filter(n => !isNaN(n))      // descartar lo que no sea número
    : [];

  try {
    const dataToReturn = OdooWithMake.flujoCrearDataParaBotDIAN(companyIds)
    Logger.log(JSON.stringify(dataToReturn))
    return ContentService.createTextOutput(JSON.stringify(dataToReturn))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (error) {
    return ContentService.createTextOutput(`Error: ${error.message}`)
      .setMimeType(ContentService.MimeType.TEXT);
  }
}









