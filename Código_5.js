function onOpen(){
  let uiOpen = SpreadsheetApp.getUi()

  uiOpen.createMenu("⚡Acciones")
  .addItem("Conciliar asientos disponibles", "trigger")
  .addToUi()
}

function trigger() {
  LibConciliacinbancaria.startProcessBankReconciliation()
}
