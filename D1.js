function testD1() {
  const fechaTexto = "14/7/2025 0:00:00";
  const fecha = parsearFecha(fechaTexto);
  const semana = obtenerNumeroSemana(fecha) +1;
  const rango = obtenerRangoSemana(fecha);
  
  Logger.log(`📅 Dia: ${fechaTexto}`);
  Logger.log(`📅 Semana #${semana}`);
  Logger.log(`🗓️ Desde: ${rango.inicio}`);
  Logger.log(`🗓️ Hasta: ${rango.fin}`);
}


/**
 * Devuelve el rango de fechas (inicio y fin) de la semana ISO 8601 que contiene la fecha dada.
 * La semana empieza en lunes y termina en domingo.
 *
 * @param {Date} fecha - Fecha base.
 * @returns {{inicio: string, fin: string}} - Fechas en formato "dd-MM-yyyy"
 */
function obtenerRangoSemana(fecha) {
  const timeZone = Session.getScriptTimeZone();
  const diaSemana = fecha.getDay(); // 0: domingo, 1: lunes, ..., 6: sábado

  // Calcular lunes de la semana
  const fechaInicio = new Date(fecha);
  fechaInicio.setDate(fecha.getDate() - ((diaSemana + 6) % 7)); // mueve al lunes

  // Calcular domingo
  const fechaFin = new Date(fechaInicio);
  fechaFin.setDate(fechaInicio.getDate() + 6);

  const inicio = Utilities.formatDate(fechaInicio, timeZone, "dd-MM-yyyy");
  const fin = Utilities.formatDate(fechaFin, timeZone, "dd-MM-yyyy");

  return { inicio, fin };
}


/**
 * Función para manejar datos del negocio D1
 */
function actualizarD1(datos) {
  LibDocUtils.writeLogToDoc(
    LogDocId,
    "Iniciando proceso con D1")

  // Obtener la base de datos de archivos de despacho y órdenes ya registradas
  let bdOrdenes = getInfoBdOrdenes();

  // Eliminar registros duplicados del conjunto original de datos
  let datosUnicos = eliminarListasDuplicadas(datos);
  LibDocUtils.writeLogToDoc(
    LogDocId,
    `Datos únicos: ${datosUnicos.length}`);

  // Filtrar solo aquellos datos que no han sido registrados aún
  let datosPorRegistrar = filtrarDatosNoRegistrados(datosUnicos, bdOrdenes);
  LibDocUtils.writeLogToDoc(
    LogDocId,
    `Datos por registrar: ${datosPorRegistrar.length}`);

  // Agrupar los datos por número de semana y vincularlos con su hoja correspondiente
  let datosAgrupados = agruparDatosPorSemana(datosPorRegistrar, "1KClLCu6i3CqcSRurX9mfohNuKFbFbGUE");
  LibDocUtils.writeLogToDoc(
    LogDocId,
    `Semanas detectadas: ${datosAgrupados.length}`);

  // Mostrar detalle por semana (opcional para depuración)
  datosAgrupados.forEach(grupo => {

    try {

      LibDocUtils.writeLogToDoc(
        LogDocId,
        `📅 Semana ${grupo.semana} → ${grupo.registros.length} registros, hoja: ${grupo.idSheet}`);

      if (grupo.idSheet == null) {
        throw new Error("El sheetId no puede ser Null")
      }

      // Registro en la El libro correspondiente de despachos
      LibSheetUtils.listToSheet(
        grupo.registros,
        true,
        grupo.idSheet,
        "CEN",
        9)

      registrarEnBdOrdenes(
        grupo.registros,
        grupo.idSheet,
        "d1")

    } catch (error) {
      LibDocUtils.writeLogToDoc(
        LogDocId,
        `Error al registrar: 📅 Semana ${grupo.semana} → ${grupo.registros.length} registros, hoja: ${grupo.idSheet} | Error: ${error.message}`);
    }

  });
}

/**
 * Devuleve una lista de listas con el Id de la orden, Id del producto y Id de la sheet en la que el despacho fue registrado.
 */
function construirFilasParaD1(ordenes, idSheet) {
  return ordenes.map(fila => [
    fila[5],    // Orden de compra
    fila[16],   // Código de producto
    idSheet
  ])
}