/**
 * Muestra un mensaje de estado
 * @param {string} message - Mensaje a mostrar
 */
function UI_showStatus (message) {
  SpreadsheetApp.getActiveSpreadsheet().toast(message, "Estado", 5);
}

/**
 * Muestra un mensaje de éxito
 * @param {string} message - Mensaje a mostrar
 */
function UI_showSuccess (message) {
  SpreadsheetApp.getActiveSpreadsheet().toast(message, "Éxito", 5);
}

/**
 * Muestra un mensaje de error
 * @param {string} message - Mensaje de error
 */
function UI_showError (message) {
  SpreadsheetApp.getActiveSpreadsheet().toast(message, "Error", 10);
}