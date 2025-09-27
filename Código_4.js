function onOpen(){
  SpreadsheetApp.getUi().createMenu("⚡ Acciones")
  .addItem("Actualizar con información de la hoja activa", "actualizar")
  .addToUi()
}

function actualizar() {
  try {
    let sheetName = SpreadsheetApp.getActiveSheet().getName()

    LibPedidos.triggerActualizacion(sheetName)
  } catch (error) {
    Logger.log("Error en onEdit: " + error);
  }
}