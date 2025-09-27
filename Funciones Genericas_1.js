// ========================================
// FUNCIONES GENÉRICAS REUTILIZABLES
// ========================================
// Este archivo contiene funciones que pueden ser utilizadas tanto para ventas como para compras

// ========================================
// FUNCIONES DE UTILIDAD GENERAL
// ========================================

/**
 * Verifica si todas las columnas especificadas tienen valores
 * @param {Array} fila - Fila de datos
 * @param {Array} indices - Índices de las columnas a verificar
 * @returns {boolean} - True si todas las columnas tienen valores
 */
function columnasCompletas(fila, indices) {
  return indices.every(idx => fila[idx] !== "" && fila[idx] !== null && fila[idx] !== undefined);
}

/**
 * Obtiene las columnas que faltan valores
 * @param {Array} fila - Fila de datos
 * @param {Array} indices - Índices de las columnas a verificar
 * @returns {Array} - Lista de letras de columnas que faltan
 */
function columnasFaltantes(fila, indices) {
  return indices.filter(idx => fila[idx] === "" || fila[idx] === null || fila[idx] === undefined).map(idx => String.fromCharCode(65 + idx));
}

/**
 * Formatea una fecha para Odoo (formato YYYY-MM-DD HH:MM:SS)
 * @param {Date|string} fecha - Fecha a formatear
 * @returns {string} - Fecha en formato YYYY-MM-DD HH:MM:SS
 */
function formatearFechaParaOdoo(fecha) {
  if (!fecha) {
    const ahora = new Date();
    return ahora.toISOString().slice(0, 19).replace('T', ' ');
  }
  
  if (fecha instanceof Date) {
    return fecha.toISOString().slice(0, 19).replace('T', ' ');
  }
  
  if (typeof fecha === 'string') {
    const fechaParseada = new Date(fecha);
    if (!isNaN(fechaParseada.getTime())) {
      return fechaParseada.toISOString().slice(0, 19).replace('T', ' ');
    }
  }
  
  // Si no se puede parsear, usar fecha actual
  const ahora = new Date();
  return ahora.toISOString().slice(0, 19).replace('T', ' ');
}

/**
 * Obtiene una hoja del spreadsheet por nombre
 * @param {string} nombreHoja - Nombre de la hoja
 * @returns {Sheet|null} - Objeto de la hoja o null si no existe
 */
function obtenerHoja(nombreHoja) {
  try {
    const hoja = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(nombreHoja);
    if (!hoja) {
      SpreadsheetApp.getUi().alert("Error", `No se encontró la hoja: ${nombreHoja}`, SpreadsheetApp.getUi().ButtonSet.OK);
      return null;
    }
    return hoja;
  } catch (error) { return null; }
}

/**
 * Obtiene la fecha actual formateada
 * @returns {string} - Fecha actual en formato DD/MM/YY HH:MM
 */
function obtenerFechaActual() {
  return new Date().toLocaleDateString('es-CO', {
    year: '2-digit', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit'
  });
}

/**
 * Realiza una consulta a Odoo
 * @param {string} modelo - Modelo de Odoo
 * @param {string} metodo - Método a ejecutar
 * @param {Array} args - Argumentos del método
 * @param {Object} kwargs - Argumentos nombrados
 * @param {string} sesionId - ID de sesión de Odoo
 * @returns {Object} - Resultado de la consulta
 */
function hacerConsultaOdoo(modelo, metodo, args = [], kwargs = {}, sesionId) {
  const url = `${odooBaseUrlTest}/web/dataset/call_kw/${modelo}/${metodo}`;
  const payload = {
    jsonrpc: "2.0",
    method: "call",
    params: { model: modelo, method: metodo, args: args, kwargs: kwargs },
    id: Math.floor(Math.random() * 100000)
  };
  const opciones = {
    method: "post",
    contentType: "application/json",
    payload: JSON.stringify(payload),
    headers: { Cookie: sesionId },
    muteHttpExceptions: true
  };

  const respuesta = UrlFetchApp.fetch(url, opciones);
  const responseText = respuesta.getContentText();
  const resultado = JSON.parse(responseText);
  if (resultado.error) throw new Error(`Error en Odoo: ${resultado.error.data.message}`);
  return resultado.result;
}

/**
 * Obtiene el rango de quincena para una fecha
 * @param {Date|string} fecha - Fecha de referencia
 * @returns {Object} - Objeto con inicio y fin de la quincena
 */
function obtenerRangoQuincena(fecha) {
  // fecha: string o Date
  let d = (fecha instanceof Date) ? fecha : new Date(fecha);
  if (isNaN(d.getTime())) d = new Date();
  const year = d.getFullYear();
  const month = d.getMonth();
  const day = d.getDate();
  let inicio, fin;
  if (day <= 15) {
    inicio = new Date(year, month, 1);
    fin = new Date(year, month, 15);
  } else {
    inicio = new Date(year, month, 16);
    // Último día del mes
    fin = new Date(year, month + 1, 0);
  }
  // Formato YYYY-MM-DD
  const f = x => x.toISOString().split('T')[0];
  return { inicio: f(inicio), fin: f(fin) };
}

// ========================================
// FUNCIONES DE VALIDACIÓN GENÉRICAS
// ========================================

/**
 * Valida si una empresa existe en Odoo
 * @param {string} nombreEmpresa - Nombre de la empresa
 * @param {string} sesionId - ID de sesión de Odoo
 * @returns {Object} - Resultado de la validación
 */
function validarEmpresa(nombreEmpresa, sesionId) {
  try {
    const nombreBuscado = nombreEmpresa.toString().trim();
    console.log(`[EMPRESA] Buscando empresa con name ilike '${nombreBuscado}'`);
    const empresas = hacerConsultaOdoo('res.company', 'web_search_read', [], {
      domain: [["name", "ilike", nombreBuscado]],
      specification: {
        id: {},
        name: {}
      },
      limit: 1,
      context: { lang: 'es_CO', tz: 'America/Lima' }
    }, sesionId);
    const res = empresas.records || empresas;
    console.log('[EMPRESA] Resultado de búsqueda:', JSON.stringify(res));
    if (res.length > 0) return { valida: true, empresaId: res[0].id, nombre: res[0].name };
    return { valida: false };
  } catch (error) {
    console.error('[EMPRESA] Error buscando empresa:', error && error.message ? error.message : error);
    if (error && error.stack) console.error('[EMPRESA] Stack:', error.stack);
    return { valida: false };
  }
}

/**
 * Valida si un cliente/proveedor existe en Odoo
 * @param {string} nombreCliente - Nombre del cliente/proveedor
 * @param {string} sesionId - ID de sesión de Odoo
 * @param {number} empresaId - ID de la empresa (opcional)
 * @returns {number|null} - ID del cliente/proveedor o null si no existe
 */
function validarCliente(nombreCliente, sesionId, empresaId) {
  try {
    const nombreBuscado = nombreCliente.toString().trim();
    console.log(`[CLIENTE] Buscando cliente con name ilike '${nombreBuscado}'`);
    const clientes = hacerConsultaOdoo('res.partner', 'web_search_read', [], {
      domain: [["name", "ilike", nombreBuscado], ["is_company", "=", true]],
      specification: {
        id: {},
        name: {}
      },
      limit: 1,
      context: { lang: 'es_CO', tz: 'America/Lima' }
    }, sesionId);
    const res = clientes.records || clientes;
    console.log('[CLIENTE] Resultado de búsqueda:', JSON.stringify(res));
    if (res.length > 0) return res[0].id;
    return null;
  } catch (error) {
    console.error('[CLIENTE] Error buscando cliente:', error && error.message ? error.message : error);
    if (error && error.stack) console.error('[CLIENTE] Stack:', error.stack);
    return null;
  }
}

/**
 * Valida productos en Odoo
 * @param {Array} productos - Lista de productos a validar
 * @param {string} sesionId - ID de sesión de Odoo
 * @param {number} empresaId - ID de la empresa
 * @returns {Array} - Lista de productos validados
 */
function validarProductosEnOdoo(productos, sesionId, empresaId) {
  const productosValidados = [];
  for (const producto of productos) {
    try {
      const parseado = parsearProducto(producto.nombre);
      let productosOdoo = [];
      let dominio = [];
      // Usar solo el nombre limpio (sin código entre corchetes) para la búsqueda
      if (parseado.nombre) {
        dominio = [["name", "=", parseado.nombre]];
        console.log(`🔎 Buscando producto en Odoo (web_search_read, product.product) solo por name limpio: '${parseado.nombre}'`);
      } else {
        dominio = [["name", "=", parseado.textoCompleto]];
        console.log(`🔎 Buscando producto en Odoo (web_search_read, product.product) solo por name exacto: '${parseado.textoCompleto}'`);
      }
      productosOdoo = hacerConsultaOdoo(
        'product.product',
        'web_search_read',
        [],
        {
          domain: dominio,
          specification: {
            id: {},
            name: {},
            default_code: {},
            list_price: {},
            barcode: {},
            categ_id: { fields: { display_name: {} } }
          },
          limit: 1,
          context: {
            lang: 'es_CO',
            tz: 'America/Lima'
          }
        },
        sesionId
      );
      const res = productosOdoo.records || productosOdoo;
      if (res && res.length > 0) {
        const prod = res[0];
        const precio = prod.list_price !== undefined ? prod.list_price : 0;
        if (precio === 0) {
          console.warn(`⚠️ Producto encontrado pero sin precio en Odoo: '${prod.name}' (ID: ${prod.id})`);
        }
        console.log(`✅ Producto encontrado en Odoo: '${prod.name}' (ID: ${prod.id}, Código: ${prod.default_code}, Precio: ${precio})`);
        productosValidados.push({ ...producto, productoId: prod.id, nombreOdoo: prod.name, precioLista: precio });
      } else {
        console.warn(`❌ Producto NO encontrado en Odoo: '${producto.nombre}' (buscado como name='${parseado.nombre}')`);
      }
    } catch (error) {
      console.error(`❌ Error buscando producto '${producto.nombre}':`, error && error.message ? error.message : error);
      if (error && error.stack) console.error(`[PRODUCTO] Stack:`, error.stack);
    }
  }
  return productosValidados;
}

/**
 * Parsea un producto para extraer código y nombre
 * @param {string} textoProducto - Texto del producto
 * @returns {Object} - Objeto con código interno, nombre y texto completo
 */
function parsearProducto(textoProducto) {
  const texto = textoProducto.toString().trim();
  // Buscar patrón [código] nombre
  const patron = /^\[([^\]]+)\]\s*(.+)$/;
  const coincidencia = texto.match(patron);
  if (coincidencia) {
    return {
      codigoInterno: coincidencia[1].trim(),
      nombre: coincidencia[2].trim(),
      textoCompleto: texto
    };
  }
  // Si no tiene el formato [código] nombre, usar todo como nombre
  return {
    codigoInterno: null,
    nombre: texto,
    textoCompleto: texto
  };
}

// ========================================
// FUNCIONES DE PROCESAMIENTO DE DATOS
// ========================================

/**
 * Agrupa filas por padre (genérica)
 * @param {Array} datos - Datos de la hoja
 * @param {Object} config - Configuración de columnas
 * @returns {Array} - Grupos de filas
 */
function agruparFilasPorPadre(datos, config) {
  const grupos = [];
  let grupoActual = null;
  datos.forEach((fila, indice) => {
    const numeroFila = indice + config.FILA_INICIO;
    const tieneAlgunValor = fila.slice(0, 7).some((celda, idx) => idx !== 2 && celda !== "" && celda !== null && celda !== undefined);
    if (!tieneAlgunValor) {
      if (grupoActual) {
        grupos.push(grupoActual);
        grupoActual = null;
      }
      return;
    }
    const esPadre = columnasCompletas(fila, [0, 1, 3, 4, 5, 6]);
    if (esPadre) {
      if (grupoActual) grupos.push(grupoActual);
      grupoActual = { filaPadre: { fila, numeroFila }, filasHijas: [] };
    } else if (grupoActual && !((fila[0] !== "" && fila[0] !== null) || (fila[1] !== "" && fila[1] !== null)) && (fila[3] !== "" && fila[4] !== "")) {
      grupoActual.filasHijas.push({ fila, numeroFila });
    }
  });
  if (grupoActual) grupos.push(grupoActual);
  return grupos;
}

// ========================================
// FUNCIONES DE COMPARACIÓN
// ========================================

/**
 * Compara productos y cantidades entre transacción actual y existente
 * @param {Array} productosActuales - Productos de la transacción actual
 * @param {Array} productosExistentes - Productos de la transacción existente
 * @returns {Array|false} - Lista de cambios o false si no hay cambios
 */
function compararProductosYcantidades(productosActuales, productosExistentes) {
  const cambios = [];

  // Crear mapas para comparación
  const mapaActual = new Map();
  const mapaExistente = new Map();

  // Mapear productos actuales
  productosActuales.forEach(prod => {
    const key = prod.productoId || prod.nombreOdoo;
    mapaActual.set(key, prod.cantidad);
  });

  // Mapear productos existentes
  productosExistentes.forEach(prod => {
    const productId = Array.isArray(prod.product_id) ? prod.product_id[0] : prod.product_id;
    mapaExistente.set(productId, prod.product_uom_qty);
  });

  // Comparar productos
  const todosProductos = new Set([...mapaActual.keys(), ...mapaExistente.keys()]);

  for (const productoId of todosProductos) {
    const cantidadActual = mapaActual.get(productoId) || 0;
    const cantidadExistente = mapaExistente.get(productoId) || 0;

    if (cantidadActual !== cantidadExistente) {
      cambios.push(`Producto ID ${productoId}: ${cantidadExistente} → ${cantidadActual}`);
    }
  }

  return cambios.length > 0 ? cambios : false;
}

// ========================================
// FUNCIONES DE FILTRO Y VALIDACIÓN DE SHEETS
// ========================================

/**
 * Aplica filtro y marca el estado de las filas en la hoja
 * @param {string} nombreHoja - Nombre de la hoja
 * @param {Object} config - Configuración de columnas
 * @returns {void}
 */
function aplicarFiltroYMarcar(nombreHoja, config) {
  const hoja = obtenerHoja(nombreHoja);
  if (!hoja) { console.log("[ERROR] No se encontró la hoja: " + nombreHoja); return; }
  const ultimaFila = hoja.getLastRow();
  const ultimaColumna = Math.max(hoja.getLastColumn(), 9);
  const datos = hoja.getRange(1, 1, ultimaFila, ultimaColumna).getValues();
  let primerPadreEncontrado = false;
  console.log(`[FILTRO] Validando ${datos.length - 1} filas...`);
  for (let i = 1; i < datos.length; i++) {
    const fila = datos[i];
    // Parar si toda la fila está vacía en columnas A-G (excluyendo C)
    let vacia = true;
    for (let j = 0; j < 7; j++) {
      if (j === 2) continue;
      if (fila[j] !== "" && fila[j] !== null && fila[j] !== undefined) {
        vacia = false;
        break;
      }
    }
    if (vacia) { console.log(`[FILTRO] Fila ${i + 1} vacía. Fin de validación.`); break; }
    let estado = "";
    let esPadre = columnasCompletas(fila, [0, 1, 3, 4, 5, 6]);
    let esHija = !((fila[0] !== "" && fila[0] !== null) || (fila[1] !== "" && fila[1] !== null)) && (fila[3] !== "" && fila[4] !== "");
    if (esPadre) {
      primerPadreEncontrado = true;
      const columnaF = String(fila[5] || "").trim().toLowerCase();
      const columnaG = String(fila[6] || "").trim().toLowerCase();
      if (columnaF.includes("gi group") || columnaG.includes("gi group")) {
        estado = "Rechazado";
      } else if (columnaF.includes("temporal") || columnaG.includes("temporal")) {
        estado = "Rechazado";
      } else if (
        columnaF === columnaG ||
        columnaF.includes(columnaG) ||
        columnaG.includes(columnaF)
      ) {
        estado = "Rechazado";
      } else {
        estado = "Aprobado";
      }
      //console.log(`[FILTRO] Fila ${i+1} marcada como ${estado}`);
    } else if (esHija && primerPadreEncontrado) {
      continue; // No marcar hijas
    } else if (!primerPadreEncontrado) {
      estado = "Rechazado";
      //console.log(`[FILTRO] Fila ${i+1} rechazada: incompleta antes del primer padre.`);
    } else {
      estado = "Rechazado";
      //console.log(`[FILTRO] Fila ${i+1} rechazada: incompleta después del primer padre.`);
    }
    hoja.getRange(i + 1, 8).setValue(estado); // H
  }
}

// ========================================
// FUNCIONES DE EXTRACCIÓN Y RECOPILACIÓN DE DATOS
// ========================================

/**
 * Extrae datos de una fila según la configuración
 * @param {Array} fila - Fila de datos
 * @param {Object} config - Configuración de columnas
 * @returns {Object} - Datos extraídos
 */
function extraerDatosTransaccion(fila, config) {
  return {
    fechaDespacho: fila[config.COLUMNAS.FECHA_DESPACHO],
    fechaEntrega: fila[config.COLUMNAS.FECHA_ENTREGA],
    producto: fila[config.COLUMNAS.PRODUCTO],
    cantidad: fila[config.COLUMNAS.CANTIDAD],
    cliente: fila[config.COLUMNAS.CLIENTE],
    empresa: fila[config.COLUMNAS.EMPRESA]
  };
}

/**
 * Recopila productos de filas padre e hijas
 * @param {Object} filaPadre - Fila padre
 * @param {Array} filasHijas - Filas hijas
 * @param {Object} config - Configuración de columnas
 * @returns {Array} - Lista de productos recopilados
 */
function recopilarProductos(filaPadre, filasHijas, config) {
  const productos = [];
  const productoPadre = filaPadre.fila[config.COLUMNAS.PRODUCTO];
  const cantidadPadre = filaPadre.fila[config.COLUMNAS.CANTIDAD];
  if (productoPadre && cantidadPadre) {
    productos.push({ nombre: productoPadre.toString().trim(), cantidad: parseFloat(cantidadPadre) || 1, origen: 'padre' });
  }
  filasHijas.forEach(filaHija => {
    const productoHijo = filaHija.fila[config.COLUMNAS.PRODUCTO];
    const cantidadHijo = filaHija.fila[config.COLUMNAS.CANTIDAD];
    if (productoHijo && cantidadHijo) {
      productos.push({ nombre: productoHijo.toString().trim(), cantidad: parseFloat(cantidadHijo) || 1, origen: 'hijo' });
    }
  });
  return productos;
}
