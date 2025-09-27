function onOpen() {
  SpreadsheetApp.getUi().createMenu("⚡Acciones")
    .addItem("📄 Extraer PDF 🕵️", "ExtraerPDF")
    .addItem("💱 Crear Factoring", "CrearFactoring")
    .addItem("💱 Realizar Pago Agrupado D1", "RealizarPagosD1")
    .addToUi()
}