function doPost(e) {
  try {
    const body = JSON.parse(e.postData.contents);
    LibDocUtils.writeLogToDoc(logs, 'Acá llegó')
    LibDocUtils.writeLogToDoc(logs,"📩 Webhook recibido:\n" + JSON.stringify(body, null, 2));

    LibWhatsApp.recepcionRespuesta(body)

    return ContentService
      .createTextOutput("OK")
      .setMimeType(ContentService.MimeType.TEXT);

  } catch (error) {
    LibDocUtils.writeLogToDoc(logs,"❌ Error en doPost: " + error);
    return ContentService
      .createTextOutput("Error")
      .setMimeType(ContentService.MimeType.TEXT);
  }
}
