function obtenerCorreosRecientesConArchivos(diasAtras = 1) {
  const fechaLimite = new Date();
  fechaLimite.setDate(fechaLimite.getDate() - diasAtras);
  let filtroFecha = `after:${Utilities.formatDate(fechaLimite, Session.getScriptTimeZone(), "yyyy/MM/dd")}`
  let filtroArchivos = `has:attachment`
  let filtro = `${filtroFecha} ${filtroArchivos}`

  Logger.log(filtro)

  const threads = GmailApp.search(filtro);

  // Para cada hilo, tomar solo el último mensaje
  const ultimosMensajes = threads.map(thread => {
    const msgs = thread.getMessages();
    return msgs[msgs.length - 1];
  });

  return ultimosMensajes;
}

function obtenerContenidoXMLDeCorreo(mensaje) {
  const attachments = mensaje.getAttachments();

  for (const archivo of attachments) {
    const nombre = archivo.getName().toLowerCase();
    const mime = archivo.getContentType();
    let contenidoXML = null;

    // Caso 1: XML directo
    if (nombre.endsWith('.xml')) {
      contenidoXML = archivo.getDataAsString();
    }

    // Caso 2: ZIP que contiene XML
    if (zipMimeTypes.has(mime)) {
      const blob = archivo.copyBlob(); // Creamos una copia del blob para descomprimir
      const archivosZip = Utilities.unzip(blob);

      for (const archivoInterno of archivosZip) {
        const nombreInterno = archivoInterno.getName().toLowerCase();
        if (nombreInterno.endsWith('.xml')) {
          contenidoXML = archivoInterno.getDataAsString();
          break;
        }
      }
    }

    // Si encontramos XML, extraemos solo el contenido dentro de <cac:Attachment>
    if (contenidoXML) {
      return contenidoXML
    }
  }

  // Si no se encuentra XML o no hay contenido en <cac:Attachment>, retorna null
  return null;
}