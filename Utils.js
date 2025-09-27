/**
 * FUNCIONES AUXILIARES PARA MANEJO DE APÓSTROFE
 */

/**
 * Preserva el apóstrofe en valores de texto para mantener formato correcto en sheets
 * @param {string} valor - Valor que puede tener o no apóstrofe
 * @returns {string} Valor con apóstrofe garantizado
 */
function preservarApostrofe(valor) {
  if (!valor) return valor;
  
  let valorStr = valor.toString().trim();
  
  // Si ya tiene apóstrofe al inicio, mantenerlo
  if (valorStr.startsWith("'")) {
    return valorStr;
  }
  
  // Si no tiene apóstrofe, agregarlo
  return "'" + valorStr;
}

/**
 * Normaliza valores para comparación quitando apóstrofe inicial
 * @param {string} valor - Valor que puede tener o no apóstrofe
 * @returns {string} Valor sin apóstrofe para comparación
 */
function normalizarParaComparacion(valor) {
  if (!valor) return valor;
  return valor.toString().replace(/^'/, '').trim();
}

/**
 * Obtiene y filtra los registros de archivos de despacho desde la hoja "OXXO Despachos".
 * Si `isOxxo` es verdadero, solo retorna los registros cuyo tipoConsolidado contiene "oxxo" (ignorando mayúsculas).
 * Si `isOxxo` es falso, retorna los registros que **no** contienen "oxxo".
 *
 * @param {boolean} isOxxo - Determina si se filtran registros Oxxo (true) o no Oxxo (false).
 * @returns {Array<Object>} Lista de objetos con propiedades: nombre, anio, idSheet, tipoConsolidado.
 */
function getInfoBdArchivosDespacho(isOxxo = false) {
  const dataRaw = LibSheetUtils.sheetToJSON('2025', true, BdArchivosId).map(row => ({
    nombre: row.Nombre,
    anio: row['Año'],
    idSheet: row['ID documento'],
    tipoConsolidado: row['Tipo de documento']
  }));

  return dataRaw.filter(row => {
    const tipo = row.tipoConsolidado?.toLowerCase() || '';
    return isOxxo ? tipo.includes('oxxo') : !tipo.includes('oxxo');
  });
}

/**
 * Obtiene la lista de órdenes previamente registradas desde una hoja de cálculo.
 *
 * Esta función consulta una hoja de Google Sheets (ID definido por `BdOrdenesId`)
 * y transforma cada fila en un objeto estructurado con los siguientes campos:
 *
 * - `idOrden`: Número de la orden de compra
 * - `idItem`: Identificación del ítem (con apóstrofe preservado)
 * - `idSheet`: ID del documento (hoja de cálculo destino donde se registró)
 *
 * Se espera que la hoja tenga al menos las siguientes columnas:
 * - "Numero de la Orden de compra"
 * - "Identificacion del Item"
 * - "ID documento"
 *
 * @returns {Array<Object>} Arreglo de objetos con los campos: `idOrden`, `idItem`, `idSheet`.
 *
 * @example
 * const ordenes = getInfoBdOrdenes();
 * Logger.log(ordenes[0].idOrden); // Ej: 4502921580
 */
function getInfoBdOrdenes() {
  const data = LibSheetUtils.sheetToJSON('Hoja 1 Prod', true, BdOrdenesId).map(row => ({
    idOrden: row['Numero de la Orden de compra'],
    idItem: preservarApostrofe(row['Identificacion del Item']), // 👈 CORRECCIÓN: Preservar apóstrofe
    idSheet: row['ID documento']
  }));

  //Logger.log(data)

  return data;
}


/**
 * Elimina registros duplicados en una lista de listas (matrices).
 *
 * Convierte cada sublista en una cadena JSON para detectar duplicados exactos
 * y retorna solo aquellos elementos únicos.
 *
 * Útil para limpiar datos antes de aplicar filtros u operaciones.
 *
 * @param {Array<Array<any>>} listas - Arreglo de sublistas con posibles elementos repetidos.
 * @returns {Array<Array<any>>} Lista depurada sin elementos duplicados.
 *
 * @example
 * const sinDuplicados = eliminarListasDuplicadas(datosOriginales);
 * Logger.log(sinDuplicados.length); // Cantidad de registros únicos
 */
function eliminarListasDuplicadas(listas) {
  const vistas = new Set();
  const unicas = [];

  for (const lista of listas) {
    const clave = JSON.stringify(lista);
    if (!vistas.has(clave)) {
      vistas.add(clave);
      unicas.push(lista);
    }
  }

  return unicas;
}


/**
 * Filtra los registros de datos que aún no han sido registrados en la base de órdenes.
 *
 * Compara cada registro de `datos` contra los objetos existentes en `bdOrdenes`,
 * verificando si existe coincidencia exacta entre:
 * - El número de orden (posición 5 del registro) y `orden.idOrden`
 * - La identificación del ítem (posición 16 del registro) y `orden.idItem`
 *
 * NOTA: Usa normalización para comparar correctamente datos históricos (sin apóstrofe) 
 * con datos nuevos (con apóstrofe).
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
function filtrarDatosNoRegistrados(datos, bdOrdenes) {
  const datosFiltrados = datos.filter(registro => {
    const idOrden = registro[5];
    const idItem = registro[16]; // Ya viene con apóstrofe desde fuente externa
    
    // 👈 CORRECCIÓN: Normalizar para comparar con datos históricos que pueden no tener apóstrofe
    const idItemNormalizado = normalizarParaComparacion(idItem);

    const yaRegistrado = bdOrdenes.some(orden => {
      // 👈 CORRECCIÓN: Normalizar también los datos de la BD para comparación consistente
      const ordenIdItemNormalizado = normalizarParaComparacion(orden.idItem);
      return orden.idOrden.toString() === idOrden.toString() && 
             ordenIdItemNormalizado === idItemNormalizado;
    });

    return !yaRegistrado;
  });

  return datosFiltrados;
}


/**
 * Convierte una cadena de texto con formato "dd/MM/yyyy HH:mm" en un objeto Date válido.
 *
 * Esta función es útil cuando se trabaja con fechas importadas desde fuentes externas
 * (como archivos o APIs) que usan el formato día/mes/año.
 *
 * @param {string} fechaStr - La fecha en formato "dd/MM/yyyy HH:mm", por ejemplo "28/04/2025 00:00".
 * @returns {Date} Objeto Date correspondiente a la fecha indicada (hora ignorada).
 *
 * @example
 * const fecha = parsearFecha("28/04/2025 00:00");
 * Logger.log(fecha); // Mon Apr 28 2025 00:00:00 GMT...
 */
function parsearFecha(fechaStr) {
  const partes = fechaStr.split(" ");
  const [dia, mes, anio] = partes[0].split("/").map(n => parseInt(n, 10));
  return new Date(anio, mes - 1, dia);
}

/**
 * Convierte una cadena de texto con formato "yyyy-MM-dd HH:mm" en un objeto Date válido.
 *
 * Esta función es útil cuando se trabaja con fechas importadas desde fuentes externas
 * (como archivos o APIs) que usan el formato día/mes/año.
 *
 * @param {string} fechaStr - La fecha en formato "yyyy-MM-dd HH:mm", por ejemplo "2025-05-21 00:00".
 * @returns {Date} Objeto Date correspondiente a la fecha indicada (hora ignorada).
 *
 * @example
 * const fecha = parsearFecha("2025-05-21 00:00");
 * Logger.log(fecha); // Mon Apr 28 2025 00:00:00 GMT...
 */
function parsearFechaV2(fechaStr) {
  const partes = fechaStr.split(" ");
  const [anio, mes, dia] = partes[0].split("-").map(n => parseInt(n, 10));
  return new Date(anio, mes - 1, dia);
}

/**
 * Calcula el número de semana de una fecha dada, emulando NUM.DE.SEMANA(fecha, 2) de Google Sheets.
 * Usa el estándar donde la semana empieza en lunes.
 *
 * @param {Date} fecha - Fecha válida.
 * @returns {number} Número de semana del año (1-53).
 */
function obtenerNumeroSemana(fecha) {
  const timeZone = Session.getScriptTimeZone();
  const semana = parseInt(Utilities.formatDate(fecha, timeZone, "w"), 10);
  const diaSemana = fecha.getDay(); // 0: domingo, 1: lunes, ..., 6: sábado

  return diaSemana === 0 ? semana - 1 : semana; // si es domingo, pertenece a la semana anterior
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
function agruparDatosPorSemana(datosPorRegistrar, folderId) {
  const grupos = {};

  datosPorRegistrar.forEach(registro => {
    const fechaTexto = registro[11]; // ejemplo: "28/04/2025 00:00"
    const fecha = parsearFecha(fechaTexto);
    const semana = obtenerNumeroSemana(fecha) +1;


    if (!grupos[semana]) {
      grupos[semana] = [];
    }

    grupos[semana].push(registro);
  });

  const resultado = Object.entries(grupos).map(([semana, registros]) => {
    const semanaNum = parseInt(semana, 10);
    const fileId = getFileDespachoBySemana(folderId, semana)

    return {
      semana: semanaNum,
      idSheet: fileId,
      registros
    };
  });

  return resultado;
}


function getFileDespachoBySemana(folderId, week) {
  Logger.log('folderId ----- ' + folderId)
  const folder = DriveApp.getFolderById(folderId);

  const files = folder.getFiles();
  const filesFiltrados = [];
  let fileId = null

  while (files.hasNext()) {
    const file = files.next();
    const fileName = file.getName();

    if (fileName.toLowerCase().includes(`semana ${week}`)) {
      fileId = file.getId()
    }
  }

  Logger.log("FileID: " + fileId);
  return fileId;
}

/**
 * Registra órdenes en la hoja de cálculo correspondiente según el negocio.
 *
 * Esta función toma una lista de órdenes, las transforma en un formato compatible
 * según el negocio (`D1`, `Oxxo`, `Subrik`) usando funciones específicas,
 * y las registra en una hoja de cálculo central definida por `idBaseDatos`.
 *
 * NOTA: Los datos se guardan manteniendo el formato con apóstrofe en idItem.
 *
 * @param {Array<Object>} ordenes - Lista de órdenes a registrar.
 * @param {string} idSheet - ID de la hoja de origen desde donde provienen los datos. Se incluye en cada fila.
 * @param {string} negocio - Nombre del negocio (`d1`, `oxxo`, `subrik`). Define la transformación de los datos.
 *
 * @throws {Error} Lanza un error si no se generan datos para registrar (lista vacía).
 *
 * @example
 * registrarEnBdOrdenes(listaOrdenes, "1abc23def456", "D1");
 */
function registrarEnBdOrdenes(ordenes, idSheet, negocio) {
  const idBaseDatos = "1CoOTOF7DgCKJcHWKPVpInzQqzB_zj-NqBAcm4N07dRc"

  let datos = []

  switch (negocio.toLowerCase()) {
    case 'd1':
      datos = construirFilasParaD1(ordenes, idSheet);
      break;
    case 'oxxo':
      datos = construirFilasParaOxxo(ordenes, idSheet);
      break;
    case 'subrik':
      datos = construirFilasParaSubrik(ordenes, idSheet);
      break;
    default:
      throw new Error("Negocio no reconocido: " + negocio);
  }

  if (datos.length <= 0) {
    throw new Error("No se recibieron datos para registrar.")
  }

  LibSheetUtils.listToSheet(
    datos,
    true,
    idBaseDatos,
    "Hoja 1 Prod"
  );
}

function getRangoInfoCosolidadoPedidos(textoBuscado) {
  let sheetId = IdCosolidadoComparativoPedidos
  let sheetName = NameCosolidadoComparativoPedidos
  let filaInicioBusqueda = 1


  let respuesta = LibSheetUtils.sheetBuscarTextoEnRango(
    sheetId,
    sheetName,
    textoBuscado,
    filaInicioBusqueda,
    filaInicioBusqueda + 2)

  if (!respuesta) {
    Logger.log("No se encontró la primera instancia de " + textoBuscado);
    return null;
  }

  let columnaInicio = LibSheetUtils.columnaA1(respuesta.numColum)
  let columnaFin = LibSheetUtils.columnaA1(respuesta.numColum + 14)
  let numFilasConData = 61
  let filaHeader = respuesta.fila + 1
  let filaData = respuesta.fila + 2

  let header = `${columnaInicio}${filaHeader}:${columnaFin}${filaHeader}`
  let totales = `${columnaInicio}${filaData + numFilasConData}:${columnaFin}${filaData + numFilasConData + 2}`

  /**
   * Cambia el rango de búsqueda para ir a por la tabla de consolidados
   */

  respuesta = LibSheetUtils.sheetBuscarTextoEnRango(
    sheetId,
    sheetName,
    textoBuscado,
    filaData + numFilasConData + 2,
    filaData + numFilasConData + 4)

  if (!respuesta) {
    Logger.log("No se encontró la tabla de consolidados para " + textoBuscado);
    return null;
  }

  columnaInicio = LibSheetUtils.columnaA1(respuesta.numColum)
  filaData = respuesta.fila + 1

  let consolidado = `${columnaInicio}${filaData}:${columnaFin}${filaData + 5}`

  let response = {
    header,
    totales,
    consolidado
  }

  Logger.log(JSON.stringify(response))

  return response
}