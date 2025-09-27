function doGet(e) {
  const mode = e.parameter["hub.mode"];
  const token = e.parameter["hub.verify_token"];
  const challenge = e.parameter["hub.challenge"];

  if (mode === "subscribe" && token === 'testEliana') {
    Logger.log("✅ Webhook verificado correctamente.");
    return ContentService
      .createTextOutput(challenge)
      .setMimeType(ContentService.MimeType.TEXT);
  } else {
    Logger.log("❌ Error de verificación del webhook.");
    return ContentService
      .createTextOutput("Forbidden")
      .setMimeType(ContentService.MimeType.TEXT);
  }
}