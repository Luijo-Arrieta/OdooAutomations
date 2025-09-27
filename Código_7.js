function onOpen() {
  let uiSheet = SpreadsheetApp.getUi();

  uiSheet.createMenu("⚡Acciones")
    .addSubMenu(
      uiSheet.createMenu("➕")
        .addItem("Actualiar BD Correos", "actualizarBdCorreos")
        .addItem("Extaer y cargar factura PDF", "cargueFacturaCompraClientePDF")
    )
    .addItem("Crear facturas recurrentes", "facturasRecurrentes")
    .addItem("Crear facturas NO recurrentes", "facturasNoRecurrentes")
    .addToUi()
}


function actualizarBdCorreos() {
  LibSheetUtils.modalConfirmacion(LibFacturasCompra.actualizarBdCorreos)
}

function cargueFacturaCompraClientePDF() {
  LibSheetUtils.modalConfirmacion(LibFacturasCompra.ExtraerYCargarFacturaPDF)
}

function facturasRecurrentes() {
  LibSheetUtils.modalConfirmacion(LibFacturasCompra.CrearYConfirmarFacturasRecurrentesProveedor)
}

function facturasNoRecurrentes() {
  LibSheetUtils.modalConfirmacion(LibFacturasCompra.pruebas)
}
