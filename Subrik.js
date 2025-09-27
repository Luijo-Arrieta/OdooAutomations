function testSubrik(){
  actualizarSubrik(SubrikEjemploDatos)
}

/**
 * Función para manejar datos del negocio Subrik
 */
function actualizarSubrik(datos) {
  LibDocUtils.writeLogToDoc(
    LogDocId,
    "Iniciando proceso con Subrik")

  // Obtener la base de datos de archivos de despacho y órdenes ya registradas
  let bdDespachos = getInfoBdArchivosDespacho();
  let bdOrdenes = getInfoBdOrdenes();

  // Eliminar registros duplicados del conjunto original de datos
  let datosUnicos = eliminarListasDuplicadas(datos);
  LibDocUtils.writeLogToDoc(
    LogDocId,
    `Datos únicos: ${datosUnicos.length}`);

  // Filtrar solo aquellos datos que no han sido registrados aún
  let datosPorRegistrar = filtrarDatosNoRegistradosSubrik(datosUnicos, bdOrdenes);
  LibDocUtils.writeLogToDoc(
    LogDocId,
    `Datos por registrar: ${datosPorRegistrar.length}`);

  // Agrupar los datos por número de semana y vincularlos con su hoja correspondiente
  let datosAgrupados = agruparDatosPorSemanaSubrik(datosPorRegistrar, bdDespachos);
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
      
      let datosFiltradosSubrik = filtrarCamposSubrik(grupo.registros)
      Logger.log(JSON.stringify(datosFiltradosSubrik))

      // Registro en la El libro correspondiente de despachos
      LibSheetUtils.listToSheet(
        datosFiltradosSubrik,
        true,
        grupo.idSheet,
        "SUBRIK",
        9)

      registrarEnBdOrdenes(
        datosFiltradosSubrik,
        grupo.idSheet,
        "subrik")

    } catch (error) {
      LibDocUtils.writeLogToDoc(
        LogDocId,
        `Error al registrar: 📅 Semana ${grupo.semana} → ${grupo.registros.length} registros, hoja: ${grupo.idSheet} | Error: ${error.message}`);
    }

  });
}

/**
 * Filtra los registros de datos que aún no han sido registrados en la base de órdenes.
 *
 * Compara cada registro de `datos` contra los objetos existentes en `bdOrdenes`,
 * verificando si existe coincidencia exacta entre:
 * - El número de orden (posición 5 del registro) y `orden.idOrden`
 * - La identificación del ítem (posición 16 del registro) y `orden.idItem`
 *
 * Solo se conservan los registros que no tienen match completo con los elementos de `bdOrdenes`.
 *
 * @param {Array<Array<any>>} datos - Arreglo de registros en formato de listas (matrices).
 * @param {Array<Object>} bdOrdenes - Arreglo de objetos que contienen las órdenes ya registradas.
 *
 * @returns {Array<Array<any>>} Lista de registros que aún no han sido registrados.
 *
 * @example
 * const nuevos = filtrarDatosNoRegistrados(datosUnicos, bdOrdenes);
 * Logger.log(nuevos.length); // Muestra cuántos registros no están aún en bdOrdenes
 */
function filtrarDatosNoRegistradosSubrik(datos, bdOrdenes) {
  return datos.filter(registro => {
    const idOrden = registro[3];   // ej. "rg41ssq"
    const idItem  = registro[21];  // ej. "2130"

    const yaRegistrado = bdOrdenes.some(orden =>
      // Convertimos ambos campos a string y les hacemos trim() por si hubiera espacios
      orden.idOrden.toString().trim() === idOrden.toString().trim() &&
      orden.idItem.toString().trim()  === idItem.toString().trim()
    );

    return !yaRegistrado; // sólo paso los que NO están en bdOrdenes
  });
}


/**
 * Agrupa los registros de datos por número de semana y les asigna el `idSheet`
 * correspondiente según la configuración en `bdArchivosDespachos`.
 *
 * Esta función permite organizar datos por semana con base en la fecha de entrega
 * (posición 11 del array de cada registro), facilitando así el registro posterior
 * en la hoja de cálculo adecuada para esa semana.
 *
 * @param {Array<Array<any>>} datosPorRegistrar - Lista de registros no registrados aún.
 *   Cada elemento debe ser un array donde la posición 11 contiene una fecha en formato "dd/MM/yyyy HH:mm".
 *
 * @param {Array<Object>} bdArchivosDespachos - Lista de objetos con información de las hojas por semana.
 *   Cada objeto debe tener al menos:
 *     - `nombre` (string): incluye texto como "semana 18".
 *     - `idSheet` (string): ID de la hoja donde deben registrarse los datos.
 *
 * @returns {Array<Object>} Lista de objetos con la estructura:
 *   {
 *     semana: <número de semana>,
 *     idSheet: <ID de hoja correspondiente>,
 *     registros: <array de registros que pertenecen a esa semana>
 *   }
 *
 * @example
 * const agrupados = agruparDatosPorSemana(datosPorRegistrar, bdArchivosDespachos);
 * agrupados.forEach(grupo => {
 *   Logger.log(`Semana: ${grupo.semana}, Registros: ${grupo.registros.length}`);
 * });
 */
function agruparDatosPorSemanaSubrik(datosPorRegistrar) {
  const folderId = "1KClLCu6i3CqcSRurX9mfohNuKFbFbGUE"
  
  const grupos = {};

  datosPorRegistrar.forEach(registro => {
    const fechaTexto = registro[7]; // ejemplo: "28/04/2025 00:00"
    const fecha = parsearFechaV2(fechaTexto);
    const semana = obtenerNumeroSemana(fecha) + 1;

    if (!grupos[semana]) {
      grupos[semana] = [];
    }

    grupos[semana].push(registro);
  });

  const resultado = Object.entries(grupos).map(([semana, registros]) => {
    const semanaNum = parseInt(semana, 10);
    const filesId = getFileDespachoBySemana(folderId, semana)
    return {
      semana: semanaNum,
      idSheet: filesId,
      registros
    };
  });

  return resultado;
}

/**
 * Toma una lista de listas (cada sublista con TODOS los campos en el orden dado)
 * y devuelve otra lista de listas manteniendo únicamente los índices:
 *   [2, 3, 7, 36, 1, 30, 22, 8]
 *
 * @param {Array<Array<any>>} datosEntrada  Lista de listas original
 * @return {Array<Array<any>>}              Lista de listas filtrada
 */
function filtrarCamposSubrik(datosEntrada) {
  return datosEntrada.map(fila => {
    return [
      fila[5],   // ID Tutti Alimentos
      fila[3],   // ID Subrik
      fila[4],   // Fecha de creación
      fila[8],  // Fecha y hora de entrega
      fila[40],   // Proveedor
      fila[12],  // Regional de entrega
      fila[2],  // GTIN
      fila[6],   // Documento
      fila[1]   // Cantidad
    ];
  });
}

/**
 * Devuleve una lista de listas con el Id de la orden, Id del producto y Id de la sheet en la que el despacho fue registrado.
 */
function construirFilasParaSubrik(ordenes, idSheet) {
  return ordenes.map(fila => [
    fila[1],    // Orden de compra
    fila[6],   // Código de producto
    idSheet
  ])
}

