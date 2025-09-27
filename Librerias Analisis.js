/**
 * Extensión de la librería para interactuar con la API de Odoo.
 * Funciones para manejar órdenes de producción usando web_search_read.
 */
const LibOdooAPIs = {
  /**
  * Extensión adicional para obtener movimientos de stock (stock.move.line) desde Odoo.
  * Agrega funcionalidad para consultar movimientos por mes con conversión de zona horaria.
  */
  getMovimientosStock: function (session_id, mesPersonalizado = null) {
    /**
     * Obtiene los movimientos de stock del mes actual desde Odoo.
     * 
     * @param {string} session_id - ID de sesión activo de Odoo (cookie "session_id")
     * @param {number} mesPersonalizado - Mes específico (1-12). Si es null, usa el mes ANTERIOR al actual.
     * @returns {Object[]} - Lista de movimientos de stock con los campos solicitados.
     * @throws {Error} - Lanza error si Odoo devuelve un mensaje de error.
     */

    // URL al endpoint web_search_read de Odoo para stock.move.line
    const url = odooBaseUrl + '/web/dataset/call_kw/stock.move.line/web_search_read';

    // Obtener fechas del mes en formato UTC con hora 05:00:00
    const fechas = this.obtenerFechasMesUTC(mesPersonalizado);

    // Payload JSON-RPC para web_search_read
    const payload = {
      jsonrpc: "2.0",
      method: "call",
      id: new Date().getTime(),
      params: {
        model: "stock.move.line",
        method: "web_search_read",
        args: [],
        kwargs: {
          domain: [
            ["date", ">=", fechas.fechaInicioUTC],
            ["date", "<", fechas.fechaFinUTC]
          ],
          specification: {
            "location_dest_id": {
              "fields": {
                "display_name": {}
              }
            },
            "location_id": {
              "fields": {
                "display_name": {}
              }
            },
            "state": {},
            "date": {},
            "lot_id": {
              "fields": {
                "display_name": {}
              }
            },
            "product_id": {
              "fields": {
                "display_name": {}
              }
            },
            "reference": {},
            "quantity": {},
            "product_uom_id": {
              "fields": {
                "display_name": {}
              }
            }
          },
          offset: 0,
          order: "id DESC",
          limit: odooRegistrosLimite,
          context: {
            lang: "es_CO",
            tz: "UTC", // Usar UTC para evitar conversiones automáticas
            uid: 14,
            allowed_company_ids: [1, 2, 3, 4],
            bin_size: true,
            params: {
              action: 417,
              model: "stock.move.line",
              view_type: "list",
              cids: "1-2-3-4",
              menu_id: 262
            },
            create: 0,
            pivot_measures: [
              "quantity_product_uom",
              "__count__"
            ],
            current_company_id: 1
          },
          count_limit: 10001
        }
      }
    };

    // Configuración de la solicitud HTTP a Odoo
    const response = UrlFetchApp.fetch(url, {
      method: "post",
      contentType: "application/json",
      headers: {
        Cookie: session_id
      },
      payload: JSON.stringify(payload)
    });

    // Parsear respuesta y verificar errores
    const result = JSON.parse(response.getContentText());
    if (result.error) {
      throw new Error("Error al obtener movimientos de stock: " + JSON.stringify(result.error));
    }

    // web_search_read devuelve los datos en result.records
    const movimientos = result.result.records || [];

    console.log("Movimientos antes de conversión:", JSON.stringify(movimientos.slice(0, 2), null, 2));

    // Convertir fechas de UTC a zona horaria -5 (America/Bogota)
    const movimientosConFechasConvertidas = movimientos.map(movimiento => {
      const movimientoConvertido = { ...movimiento };

      // Convertir date
      if (movimiento.date) {
        movimientoConvertido.date = this.convertirUTCaZonaHoraria(movimiento.date, -5);
      }

      return movimientoConvertido;
    });

    console.log("Movimientos después de conversión:", JSON.stringify(movimientosConFechasConvertidas.slice(0, 2), null, 2));

    return movimientosConFechasConvertidas;
  },

  /**
   * Obtiene las órdenes de producción completadas del mes actual desde Odoo.
   * 
   * @param {string} session_id - ID de sesión activo de Odoo (cookie "session_id")
   * @param {number} mesPersonalizado - Mes específico (1-12). Si es null, usa el mes ANTERIOR al actual.
   * @returns {Object[]} - Lista de órdenes de producción con los campos solicitados.
   * @throws {Error} - Lanza error si Odoo devuelve un mensaje de error.
   */
  getOrdenesProduccionCompletadas: function (session_id, mesPersonalizado = null) {
    // URL al endpoint web_search_read de Odoo
    const url = odooBaseUrl + '/web/dataset/call_kw/mrp.production/web_search_read';

    // Obtener fechas del mes en formato UTC con hora 05:00:00
    const fechas = this.obtenerFechasMesUTC(mesPersonalizado);

    // Payload JSON-RPC para web_search_read
    const payload = {
      jsonrpc: "2.0",
      method: "call",
      id: new Date().getTime(),
      params: {
        model: "mrp.production",
        method: "web_search_read",
        args: [],
        kwargs: {
          domain: [
            ["state", "=", "done"],
            ["date_start", ">=", fechas.fechaInicioUTC],
            ["date_start", "<", fechas.fechaFinUTC]
          ],
          limit: odooRegistrosLimite,
          context: { lang: "es_CO", tz: "UTC" }, // Cambiado a UTC para evitar conversiones automáticas
          // Especificación define qué campos traer y cómo
          specification: {
            "name": {},
            "date_start": {},
            "date_finished": {},
            "product_id": { "fields": { "display_name": {} } },
            "bom_id": { "fields": { "display_name": {} } },
            "lot_producing_id": { "fields": { "display_name": {} } },
            "product_uom_id": { "fields": { "display_name": {} } },
            "product_qty": {},
            "qty_produced": {},
            "state": {},
            "company_id": { "fields": { "display_name": {} } },
            "move_raw_ids": {}
          }
        }
      }
    };

    // Configuración de la solicitud HTTP a Odoo
    const response = UrlFetchApp.fetch(url, {
      method: "post",
      contentType: "application/json",
      headers: {
        Cookie: session_id
      },
      payload: JSON.stringify(payload)
    });

    // Parsear respuesta y verificar errores
    const result = JSON.parse(response.getContentText());
    if (result.error) {
      throw new Error("Error al obtener órdenes de producción: " + JSON.stringify(result.error));
    }

    // web_search_read devuelve los datos en result.records
    const ordenes = result.result.records || [];

    //console.log("Órdenes antes de conversión:", JSON.stringify(ordenes, null, 2));

    // Convertir fechas de UTC a zona horaria -5 (America/Bogota)
    const ordenesConFechasConvertidas = ordenes.map(orden => {
      const ordenConvertida = { ...orden };

      // Convertir date_start
      if (orden.date_start) {
        ordenConvertida.date_start = this.convertirUTCaZonaHoraria(orden.date_start, -5);
      }

      // Convertir date_finished
      if (orden.date_finished) {
        ordenConvertida.date_finished = this.convertirUTCaZonaHoraria(orden.date_finished, -5);
      }

      return ordenConvertida;
    });

    //console.log("Órdenes después de conversión:", JSON.stringify(ordenesConFechasConvertidas, null, 2));

    // Obtener componentes para cada orden
    const ordenesConComponentes = ordenesConFechasConvertidas.map(orden => {
      if (orden.move_raw_ids && orden.move_raw_ids.length > 0) {
        const componentes = this.obtenerComponentesOrden(session_id, orden.move_raw_ids);
        return { ...orden, componentes };
      }
      return { ...orden, componentes: [] };
    });

    return ordenesConComponentes;
  },

  /**
   * Convierte una fecha de UTC a la zona horaria especificada.
   * 
   * @param {string} fechaUTC - Fecha en formato UTC (YYYY-MM-DD HH:MM:SS)
   * @param {number} offsetHoras - Offset de horas (-5 para Colombia)
   * @returns {string} - Fecha convertida en formato YYYY-MM-DD HH:MM:SS
   */
  convertirUTCaZonaHoraria: function (fechaUTC, offsetHoras) {
    try {
      // Crear fecha desde UTC
      const fecha = new Date(fechaUTC + ' UTC');

      // Aplicar offset de zona horaria
      const fechaConvertida = new Date(fecha.getTime() + (offsetHoras * 60 * 60 * 1000));

      // Formatear como string YYYY-MM-DD HH:MM:SS
      const año = fechaConvertida.getUTCFullYear();
      const mes = String(fechaConvertida.getUTCMonth() + 1).padStart(2, '0');
      const dia = String(fechaConvertida.getUTCDate()).padStart(2, '0');
      const hora = String(fechaConvertida.getUTCHours()).padStart(2, '0');
      const minuto = String(fechaConvertida.getUTCMinutes()).padStart(2, '2');
      const segundo = String(fechaConvertida.getUTCSeconds()).padStart(2, '0');

      return `${año}-${mes}-${dia} ${hora}:${minuto}:${segundo}`;
    } catch (error) {
      console.error("Error al convertir fecha:", error);
      return fechaUTC; // Devolver fecha original si hay error
    }
  },

  /**
   * Obtiene los detalles de los componentes (movimientos de stock) de una orden de producción.
   * 
   * @param {string} session_id - ID de sesión activo de Odoo
   * @param {number[]} moveIds - Array de IDs de movimientos de stock
   * @returns {Object[]} - Lista de componentes con sus detalles
   */
  obtenerComponentesOrden: function (session_id, moveIds) {
    if (!moveIds || moveIds.length === 0) {
      return [];
    }

    // URL al endpoint web_search_read para stock.move
    const url = odooBaseUrl + '/web/dataset/call_kw/stock.move/web_search_read';

    const payload = {
      jsonrpc: "2.0",
      method: "call",
      id: new Date().getTime(),
      params: {
        model: "stock.move",
        method: "web_search_read",
        args: [],
        kwargs: {
          domain: [["id", "in", moveIds]],
          context: { lang: "es_CO", tz: "UTC" },
          // Especificación para web_search_read
          specification: {
            "product_id": { "fields": { "display_name": {} } },
            "product_qty": {},
            "product_uom_qty": {},
            "quantity": {}
          }
        }
      }
    };

    try {
      const response = UrlFetchApp.fetch(url, {
        method: "post",
        contentType: "application/json",
        headers: {
          Cookie: session_id
        },
        payload: JSON.stringify(payload)
      });

      const result = JSON.parse(response.getContentText());
      if (result.error) {
        console.error("Error al obtener componentes:", result.error);
        return [];
      }

      // web_search_read devuelve los datos en result.records
      return result.result.records || [];
    } catch (error) {
      console.error("Error al obtener componentes:", error);
      return [];
    }
  },

  /**
   * Función auxiliar para obtener las fechas de inicio y fin del mes en UTC con hora 05:00:00.
   * 
   * @param {number} mesPersonalizado - Mes específico (1-12). Si es null, usa el mes ANTERIOR al actual.
   * @returns {Object} - Objeto con fechas en formato UTC para la búsqueda.
   */
  obtenerFechasMesUTC: function (mesPersonalizado = null) {
    const ahora = new Date();
    const año = ahora.getFullYear();

    let mes, añoTarget;

    if (mesPersonalizado !== null) {
      // Si se proporciona un mes específico, usarlo
      mes = mesPersonalizado;
      añoTarget = año;
    } else {
      // Si no se proporciona mes, usar el mes ANTERIOR
      mes = ahora.getMonth(); // getMonth() devuelve 0-11, así que mes actual - 1
      añoTarget = año;

      // Si estamos en enero (mes 0), el mes anterior es diciembre del año anterior
      if (mes === 0) {
        mes = 12;
        añoTarget = año - 1;
      }
    }

    // Crear fechas en UTC con hora 05:00:00
    const fechaInicioUTC = `${añoTarget}-${String(mes).padStart(2, '0')}-01 05:00:00`;

    // Para la fecha fin, necesitamos el primer día del mes siguiente
    let mesNext = mes + 1;
    let añoNext = añoTarget;
    if (mesNext > 12) {
      mesNext = 1;
      añoNext++;
    }
    const fechaFinUTC = `${añoNext}-${String(mesNext).padStart(2, '0')}-01 05:00:00`;

    console.log(`Buscando órdenes del mes ${mes}/${añoTarget} en UTC:`);
    console.log(`Desde: ${fechaInicioUTC}`);
    console.log(`Hasta: ${fechaFinUTC} (exclusivo)`);

    return {
      fechaInicioUTC: fechaInicioUTC,
      fechaFinUTC: fechaFinUTC
    };
  }
};

/**
 * Escribe las órdenes de producción en la hoja "Data Consumos" del Google Sheets.
 * 
 * @param {Object[]} ordenesProduccion - Lista de órdenes de producción obtenidas de Odoo.
 * @param {string} sheetId - ID del Google Sheets.
 * @param {string} sheetName - Nombre de la hoja (por defecto "Data Consumos").
 */
function escribirOrdenesProduccionEnSheet(ordenesProduccion, sheetId, sheetName) {
  const hoja = SpreadsheetApp.openById(sheetId).getSheetByName(sheetName);
  if (!hoja) {
    throw new Error(`No se encontró la hoja con nombre "${sheetName}" en el Spreadsheet.`);
  }

  // Paso 1: Expandir los datos para que cada componente tenga su propia fila
  const datos = [];

  ordenesProduccion.forEach(orden => {
    // Información principal de la orden
    const infoPrincipal = [
      orden.name || "",
      orden.date_start ? convertirStringAFecha(orden.date_start) : "",
      orden.date_finished ? convertirStringAFecha(orden.date_finished) : "",
      obtenerNombreCampo(orden.product_id),
      obtenerNombreCampo(orden.bom_id),
      obtenerNombreCampo(orden.lot_producing_id),
      (obtenerNombreCampo(orden.product_uom_id) === "unidades" ? "Unidades" : obtenerNombreCampo(orden.product_uom_id)),
      orden.product_qty || "",
      orden.qty_produced || "",
      orden.state === "done" ? "Hecho" : (orden.state || ""),
      obtenerNombreCampo(orden.company_id)
    ];

    // Verificar si hay componentes
    if (orden.componentes && orden.componentes.length > 0) {
      // Crear una fila para cada componente
      orden.componentes.forEach(componente => {
        const filaCompleta = [
          ...infoPrincipal,
          obtenerNombreCampo(componente.product_id),
          componente.product_qty || "",
          componente.product_uom_qty || "",
          componente.quantity || ""
        ];
        datos.push(filaCompleta);
      });
    } else {
      // Si no hay componentes, crear una fila con información principal solamente
      const filaCompleta = [
        ...infoPrincipal,
        "",
        "",
        "",
        ""
      ];
      datos.push(filaCompleta);
    }
  });

  // Paso 2: Eliminar filas de la 3 en adelante (mantener encabezados)
  const ultimaFila = hoja.getLastRow();
  if (ultimaFila >= 3) {
    // Eliminar filas desde la 3 hasta la última
    hoja.deleteRows(3, ultimaFila - 2);
  }

  // Paso 3: Escribir los nuevos datos en A-O, desde la fila 2
  if (datos.length > 0) {
    hoja.getRange(2, 1, datos.length, 15).setValues(datos);

    // Paso 4: Omitir formateo si las columnas son tipadas
    // Las columnas tipadas ya manejan el formato automáticamente
    console.log("Datos escritos. Las columnas tipadas manejan el formato automáticamente.");
  }

  // Paso 5: Mensaje de éxito
  const ahora = new Date();
  const formatoFecha = Utilities.formatDate(ahora, Session.getScriptTimeZone(), "yyyy-MM-dd 'a las' HH:mm:ss");
  console.log(`Datos de órdenes de producción actualizados el ${formatoFecha}. Registros procesados: ${datos.length}`);
}

/**
 * Escribe las órdenes de producción en la hoja "Data Inventarios" del Google Sheets.
 * 
 * @param {Object[]} movimientosStock - Lista de movimientos de stock obtenidos de Odoo.
 * @param {string} sheetId - ID del Google Sheets.
 * @param {string} sheetName - Nombre de la hoja (por defecto "Data Movimientos").
 */
function escribirMovimientosStockEnSheet(movimientosStock, sheetId, sheetName) {
  const hoja = SpreadsheetApp.openById(sheetId).getSheetByName(sheetName);
  if (!hoja) {
    throw new Error(`No se encontró la hoja con nombre "${sheetName}" en el Spreadsheet.`);
  }

  // Paso 1: Preparar los datos para escribir - usando el nuevo campo valor_total
  const datos = movimientosStock.map(movimiento => [
    obtenerNombreCampo(movimiento.location_dest_id),           // A - Destino
    obtenerNombreCampo(movimiento.location_id),                // Desde
    movimiento.state || "",                                    // Estado
    movimiento.date ? convertirStringAFecha(movimiento.date) : "", // Fecha
    obtenerNombreCampo(movimiento.lot_id),                     // Lote/Nº de Serie
    obtenerNombreCampo(movimiento.product_id),                 // Producto
    movimiento.reference || "",                                // Referencia
    movimiento.quantity || "",                                 // Terminado
    obtenerNombreCampo(movimiento.product_uom_id),             // Unidad de Medida
  ]);

  // Paso 2: Eliminar filas de la 3 en adelante (mantener encabezados)
  const ultimaFila = hoja.getLastRow();
  if (ultimaFila >= 3) {
    hoja.deleteRows(3, ultimaFila - 2);
  }

  // Paso 3: Escribir los nuevos datos desde la fila 2
  if (datos.length > 0) {
    hoja.getRange(2, 1, datos.length, 9).setValues(datos);
    console.log("Datos de movimientos escritos. Las columnas tipadas manejan el formato automáticamente.");
  }

  // Paso 4: Mensaje de éxito
  const ahora = new Date();
  const formatoFecha = Utilities.formatDate(ahora, Session.getScriptTimeZone(), "yyyy-MM-dd 'a las' HH:mm:ss");
  console.log(`Datos de movimientos de stock actualizados el ${formatoFecha}. Registros procesados: ${datos.length}`);
}

/**
 * Convierte un string de fecha a objeto Date para Google Sheets.
 * 
 * @param {string} fechaString - Fecha en formato "YYYY-MM-DD HH:MM:SS"
 * @returns {Date} - Objeto Date
 */
function convertirStringAFecha(fechaString) {
  try {
    // Parsear la fecha directamente sin agregar UTC
    const fecha = new Date(fechaString);
    return fecha;
  } catch (error) {
    console.error("Error al convertir fecha:", error);
    return null;
  }
}

// Función auxiliar para obtener el nombre de un campo relacional
function obtenerNombreCampo(campo) {
  // Para web_search_read, los campos relacionales vienen con display_name directamente
  if (campo && typeof campo === "object" && campo.display_name) {
    return campo.display_name;
  }
  // Fallback para arrays (formato anterior)
  if (Array.isArray(campo)) {
    return campo[1] || "";
  }
  return "";
}