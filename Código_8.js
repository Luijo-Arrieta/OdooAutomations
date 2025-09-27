function trigger() {
  const ui = SpreadsheetApp.getUi();
  
  const respuesta = ui.alert(
    "Crear notas de crédito.",
    "¿Deseas continuar?",
    ui.ButtonSet.OK_CANCEL
  );

  if (respuesta == ui.Button.OK) {
    // Acción a ejecutar si el usuario confirma
    OdooWithMake.flujoCreacionNotaCreditoParcial()
  } else {
    // El usuario canceló: no hacer nada
    OdooWithMake.UI_showStatus("Operación cancelada.")
    Logger.log("El usuario canceló la acción.");
  }
}
