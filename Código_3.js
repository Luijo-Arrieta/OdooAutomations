/**
 * Obten el valor de autenticación de Odoo que debe ser ingresado como cookie en las peticiones.
 * @param {string} usuario - **usario**: Denominación del usuario en tanto a las opciones de la base de datos ej: "EZ", "LOGISTICA"
 * @return {string} - cookie de acceso con los permisos del usuario en elegido
 */
function odooGetSessionId(usuario) {
  /** https://docs.google.com/spreadsheets/d/1oYPrJFU2difvFyIdq94uUBQWcaovLkX62DbkBDbJABA/edit?usp=sharing */
  let sheetId = "1oYPrJFU2difvFyIdq94uUBQWcaovLkX62DbkBDbJABA"
  let queryType = "data"
  let sheetName = "Session"

  let url = `https://script.google.com/macros/s/AKfycbwkXmlrrqJ8KppZhrDoPPGpUGy3Qb4wGrewN2USWTB6yJMJ2QULDquv-abZovsKQcD_/exec?sheetId=${sheetId}&queryType=${queryType}`;

  try {
    const response = UrlFetchApp.fetch(url);
    const result = JSON.parse(response.getContentText());

    if (!result.data || !Array.isArray(result.data)) {
      throw new Error("Formato de datos inválido");
    }

    const fila = result.data.find(row => row[0] === usuario);
    return fila ? fila[1] : null;
  } catch (e) {
    Logger.log('Error al obtener session ID: ' + e);
    return null;
  }
}

function prueba(){
  odooGetSessionId('EZ')
}