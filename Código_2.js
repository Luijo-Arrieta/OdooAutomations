function getOrCreateLogDocId(PROP_KEY) {
  var PROP_KEY = "LOG_DOC_ID";
  const props = PropertiesService.getScriptProperties();
  let docId = props.getProperty(PROP_KEY);

  if (docId) return docId;

  // Buscar si ya existe un documento con ese nombre
  const files = DriveApp.getFilesByName("Logs WebApp");
  if (files.hasNext()) {
    docId = files.next().getId();
  } else {
    const doc = DocumentApp.create("Logs WebApp");
    docId = doc.getId();
  }

  props.setProperty(PROP_KEY, docId);
  return docId;
}


function writeLogToDoc(documentId, mensaje) {
  try {
    const doc = DocumentApp.openById(documentId);
    const body = doc.getBody();

    const timestamp = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyy-MM-dd HH:mm:ss");
    body.appendParagraph(`[${timestamp}] ${mensaje}`);
    doc.saveAndClose();
  } catch (error) {
    Logger.log("❌ Error al escribir log en Google Doc: " + error.message);
  }
}

function test(){
  writeLogToDoc("1QS_mZvOhH6xM3PZEIA1OvVZkvQA3kK5YkKUVEc5GFwI", "Prueba")
}