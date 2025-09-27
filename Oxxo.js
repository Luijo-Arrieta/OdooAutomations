const FolderIdOxxo = "1nYVYH_eXkz5ec-5K52iNNSt2gVTX-8Hz"

/**
 * Función para manejar datos del negocio Oxxo
 */
function actualizarOxxo(datos) {
  LibDocUtils.writeLogToDoc(
    LogDocId,
    "Iniciando proceso con Oxxo")

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
  let datosAgrupados = agruparDatosPorSemana(datosPorRegistrar, FolderIdOxxo);
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
        "CEN test",
        9)

      registrarEnBdOrdenes(
        grupo.registros,
        grupo.idSheet,
        "oxxo")

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
function construirFilasParaOxxo(ordenes, idSheet) {
  return ordenes.map(fila => [
    fila[5],    // Orden de compra
    fila[16],   // Código de producto
    idSheet
  ])
}

function getConsolidadoDataOxxo(idFile) {
 // Validamos idFile
 if (!idFile || typeof idFile !== 'string' || idFile.trim() === '') {
   throw new Error(`ID de archivo inválido o no existe: ${idFile}`);
 }
 
 let datos = LibSheetUtils.sheetToJSON(
   "TD Comparativo",
   true,
   idFile,
   3
 );

 return datos.filter(
   r => r['CIUDAD-ENTREGA'] && r['CIUDAD-ENTREGA'].toString().trim() !== ''
 );
}

/**
 * @param {string} fechaStr - Fecha en formato "yyyy-MM-dd"
 */
function actualizarConsolidadoOxxo(fechatStr = "") {
  const numColHeader = 14;

  let date = fechatStr === "" ? new Date() : parsearFechaV2(fechatStr);
  
  const sheet = SpreadsheetApp.openById(IdCosolidadoComparativoPedidos)
    .getSheetByName(NameCosolidadoComparativoPedidos);
  
  let numSemana = LibSheetUtils.obtenerNumeroSemana(date, 2);
  let numSemanaSiguiente = numSemana + 1;

  let idDespachoFile = getFileDespachoBySemana(FolderIdOxxo, numSemanaSiguiente);

  let dataTablaDinamica = getConsolidadoDataOxxo(idDespachoFile);

  let textoSemanaBuscada = `semana: ${numSemanaSiguiente}`;
  
  let coordenadasSemana = LibSheetUtils.sheetBuscarTextoEnRango(
    IdCosolidadoComparativoPedidos,
    NameCosolidadoComparativoPedidos,
    textoSemanaBuscada,
    1,
    5
  );
  
  if (!coordenadasSemana) {
    const mensajeError = `❌ No se encontró la Semana: ${numSemanaSiguiente}`;
    //Logger.log(mensajeError);
    throw new Error(mensajeError);
    //return;
  }

  let coordenadasPrimerOxxo = LibSheetUtils.sheetBuscarTextoEnRango(
    IdCosolidadoComparativoPedidos,
    NameCosolidadoComparativoPedidos,
    `Oxxo`,
    coordenadasSemana.fila,
    coordenadasSemana.fila + 70,
    coordenadasSemana.numCol,
    coordenadasSemana.numCol + numColHeader
  )

  let colNegocios = LibSheetUtils.getColumnValues(
    sheet,
    coordenadasSemana.numCol,
    coordenadasSemana.fila
  );

  let lastRowOxxo = colNegocios.filter(item =>
    typeof item === 'string' && item.toLowerCase().includes("oxxo")
  ).length + coordenadasPrimerOxxo.fila - 1;

  /*let lastCol = LibSheetUtils.columnaA1(
    coordenadasPrimerOxxo.numCol + numColHeader
  )*/

  let rangoOxxo = {
    startCol: coordenadasPrimerOxxo.numCol,
    startRow: coordenadasPrimerOxxo.fila,
    lastCol: coordenadasPrimerOxxo.numCol + numColHeader,
    lastRow: lastRowOxxo
  }

  Logger.log(JSON.stringify(rangoOxxo))

  // Ejemplo: "QJ38:QJ47"
  /*let rangoRegionalesOxxoStr = `${
    LibSheetUtils.columnaA1(rangoOxxo.startCol + 1)
  }${
    rangoOxxo.startRow
  }:${
    LibSheetUtils.columnaA1(rangoOxxo.startCol + 1)
  }${
    rangoOxxo.lastRow
  }`;*/

  // Ejemplo: "QJ2:QY2"
  /*let rangoTitulosTablaStr = `${
    LibSheetUtils.columnaA1(coordenadasSemana.numCol + 1)
  }${
    coordenadasSemana.fila + 1
  }:${
    LibSheetUtils.columnaA1(coordenadasSemana.numCol + numColHeader)
  }${
    coordenadasSemana.fila + 1
  }`;*

  let regionalesOxxo = SpreadsheetApp.openById(
    IdCosolidadoComparativoPedidos
  ).getSheetByName(
    NameCosolidadoComparativoPedidos
  ).getRange(
    rangoRegionalesOxxoStr
  ).getDisplayValues()

  /*let titulosTabla = SpreadsheetApp.openById(
    IdCosolidadoComparativoPedidos
  ).getSheetByName(
    NameCosolidadoComparativoPedidos
  ).getRange(
    rangoTitulosTablaStr
  ).getDisplayValues()*/

  Logger.log("Tabla Dinamica: " + JSON.stringify(dataTablaDinamica))
  //Logger.log("Regionales Oxxo: " + JSON.stringify(regionalesOxxo))

  let filasPorRegistrar = construirFilasPorRegistrar(dataTablaDinamica);

  Logger.log(JSON.stringify(filasPorRegistrar))

  LibSheetUtils.listToSheet(
    filasPorRegistrar,
    true,
    IdCosolidadoComparativoPedidos,
    NameCosolidadoComparativoPedidos,
    rangoOxxo.startCol + 2,
    rangoOxxo.startRow
  )
}

/**
 * Dado dataTablaDinamica y un listado de regiones, construye un array de filas
 * en el orden fijo:
 *   [ REGIONAL, Leche Asada,Arroz con Leche,Gelatina Mosaico,Gelicloud,Gelitas,Tiramisu,Gelifitt,Postre de Natas,Cheesecake Frutos Rojos,Tres Leches,Arcoiris,Flan Caramelo,SUM de Valor]
 *
 * @param {Object[]} dataTablaDinamica    — Array de objetos con CIUDAD-ENTREGA + campos.
 * @param {string[][]} regionalesOxxo     — Array de [ciudad] en el orden deseado.
 * @return {Array<Array<any>>}            — Filas listas para setValues().
 */
function construirFilasPorRegistrar(dataTablaDinamica) {
  // Orden estático de las propiedades después de la columna Región
  const camposOrden = [
    "Leche Asada",
    "Arroz con Leche",
    "Gelatina Mosaico",
    "Gelicloud",
    "Gelitas",
    "Tiramisu",
    "Gelifitt",
    "Postre de Natas",
    "Cheesecake Frutos Rojos",
    "Tres Leches",
    "Arcoiris",
    "Flan Caramelo",
    "SUM de Valor"
  ];

  return dataTablaDinamica.map(obj => {
    return camposOrden.map(c => {
      const val = Object.prototype.hasOwnProperty.call(obj, c) ? obj[c] : "";
      return val !== null && val !== undefined ? String(val) : "";
    });
  });
}






