function onOpen() {
  SpreadsheetApp.getUi().createMenu("⚡Acciones")
    .addItem("💱 Crear y Cruzar Factoring", "CrearCruzarFactoringIsimo")
    .addItem("💱 Realizar Pagos", "RealizarPagosIsimo")
    .addToUi()
}
