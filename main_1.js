/**
 * Recursos requeridos:
 * 
 * Archivo: Odoo // Comparativo de pedidos Pre-Registro
 * https://docs.google.com/spreadsheets/d/1MHV5wi3izTs8zFn0gzZ4RtLdq7ocrs98ayczfyASVvA/edit?usp=sharing
 * 
 * Carpeta de despachos
 * https://drive.google.com/drive/folders/1iA49JaSVoJL8Pd_WBN4CN2x0HtQDCBLY?usp=drive_link
 * 
 * Archivo: BD Ordenes Almacenadas
 * https://docs.google.com/spreadsheets/d/1CoOTOF7DgCKJcHWKPVpInzQqzB_zj-NqBAcm4N07dRc/edit?usp=sharing
 *
 * Carpeta: DB - archivos semanas despachos
 * https://docs.google.com/spreadsheets/d/1iJEuc-xSwfba2KPDn38xSpjA-3TKiONQ-VgsVSUZODQ/edit?usp=sharing
 * 
 * Archivo: Logs
 * https://docs.google.com/document/d/1QS_mZvOhH6xM3PZEIA1OvVZkvQA3kK5YkKUVEc5GFwI/edit?usp=sharing
 * /

/**
 * Verifica el token y delega a la función correspondiente según el negocio.
 * @param {Object} payload - Datos recibidos en el webhook.
 * @returns {Object} - Resultado con mensaje de éxito o error.
*/
function manejarWebhook(payload) {
  const TOKEN = PropertiesService.getScriptProperties().getProperty("WEBHOOK_TOKEN");

  const tokenRecibido = payload?.token;
  const negocio = payload?.negocio;
  const datos = payload?.datos;

  // Registro de Logr
  LibDocUtils.writeLogToDoc(
    LogDocId,
    `📥 Datos recibidos: ${JSON.stringify(negocio)}`
  )
  // Registro de Logr
  LibDocUtils.writeLogToDoc(
    LogDocId,
    `📥 Datos recibidos: ${JSON.stringify(datos)}`
  )

  if (tokenRecibido !== TOKEN) {
    let response = { status: 'error', mensaje: 'Token inválido' }
    LibDocUtils.writeLogToDoc(
      LogDocId,
      `${JSON.stringify(response)}`
    )
    
    return response;
  }

  // Registra la data en un archivo de pre-registro para poder usar la data después en caso de que falle y desde aquí se dispara la actualización a los demás archivos: Despachos y Comparativo de pedidos
  LibSheetUtils.listToSheet(
    datos,
    false,
    "1MHV5wi3izTs8zFn0gzZ4RtLdq7ocrs98ayczfyASVvA",
    negocio);

  switch (negocio.toLowerCase()) {
    case 'd1':
      return actualizarD1(datos);
    case 'oxxo':
      return actualizarOxxo(datos);
    case 'subrik':
      return actualizarSubrik(datos);
    default:
      Logger.log(JSON.stringify({ status: 'error', mensaje: 'Negocio no reconocido' }));
  }

  return { status: 'ok', mensaje: 'Pre-Registro realizado con éxito' }
}

function triggerActualizacion(sheetName){
  // Obtener datos con tu función
    const datos = LibSheetUtils.sheetToList(
      sheetName,
      "1MHV5wi3izTs8zFn0gzZ4RtLdq7ocrs98ayczfyASVvA");

    switch (sheetName.toLowerCase()) {
      case 'd1':
        return actualizarD1(datos);
      case 'oxxo':
        return actualizarOxxo(datos);
      case 'subrik':
        return actualizarSubrik(datos);
      default:
        Logger.log(JSON.stringify({ status: 'error', mensaje: 'Negocio no reconocido' }));
    }
}
