/**
 * Librería para interactuar con la API de Odoo.
 * Contiene funciones que se conectan al backend de Odoo mediante JSON-RPC.
 */
const LibOdooAPIs = {
  /**
   * Obtiene las facturas de cliente no pagadas o parcialmente pagadas desde Odoo.
   * 
   * @param {string} session_id - ID de sesión activo de Odoo (cookie "session_id")
   * @returns {Object[]} - Lista de facturas con los campos solicitados.
   * @throws {Error} - Lanza error si Odoo devuelve un mensaje de error.
   */
  getFacturasNoPagadas: function (session_id) {
    // URL al endpoint JSON-RPC de Odoo para lectura del modelo `account.move`
    const url = odooBaseUrl + '/web/dataset/call_kw/account.move/search_read';

    // Payload JSON-RPC para buscar facturas
    const payload = {
      jsonrpc: "2.0",
      method: "call",
      id: new Date().getTime(),  // ID único por llamada
      params: {
        model: "account.move",
        method: "search_read",  // Método de Odoo para búsqueda y lectura
        args: [],               // Vacío porque usamos kwargs
        kwargs: {
          domain: [             // Filtros de búsqueda
            ["payment_state", "in", ["not_paid", "partial"]],  // No pagadas o parcialmente pagadas
            ["move_type", "=", "out_invoice"],                  // Facturas de cliente
            ["state", "=", "posted"]                            // Publicadas (no borradores)
          ],
          fields: [           // Campos que queremos traer desde Odoo
            "company_id",
            "invoice_partner_display_name",
            "name",
            "ref",
            "invoice_date",
            "invoice_date_due",
            "amount_untaxed_signed",
            "amount_total_signed",
            "amount_residual",
          ],
          limit: odooRegistrosLimite  // Límite máximo de registros a traer
        }
      }
    };

    // Configuración de la solicitud HTTP a Odoo
    const response = UrlFetchApp.fetch(url, {
      method: "post",
      contentType: "application/json",
      headers: {
        Cookie: session_id  // Autenticación por cookie
      },
      payload: JSON.stringify(payload)
    });

    // Parsear respuesta y verificar errores
    const result = JSON.parse(response.getContentText());
    if (result.error) {
      throw new Error("Error al obtener facturas: " + JSON.stringify(result.error));
    }

    // Retornar registros obtenidos
    return result.result;
  }
};


function escribirFacturasEnSheet(facturas, sheetId, sheetName) {
  const hoja = SpreadsheetApp.openById(sheetId).getSheetByName(sheetName);
  if (!hoja) {
    throw new Error(`No se encontró la hoja con nombre "${sheetName}" en el Spreadsheet.`);
  }

  // Paso 1: Borrar datos desde fila 3 (deja encabezado y mensaje intactos)
  const ultimaFila = hoja.getLastRow();
  if (ultimaFila >= 3) {
    hoja.getRange(3, 1, ultimaFila - 2, 9).clearContent();
  }

  // Paso 2: Ordenar las facturas por nombre de empresa y luego por número
  facturas.sort((a, b) => {
    const nombreA = (a.invoice_partner_display_name || "").toLowerCase();
    const nombreB = (b.invoice_partner_display_name || "").toLowerCase();

    if (nombreA < nombreB) return -1;
    if (nombreA > nombreB) return 1;

    const numeroA = (a.name || "").toLowerCase();
    const numeroB = (b.name || "").toLowerCase();

    if (numeroA < numeroB) return -1;
    if (numeroA > numeroB) return 1;

    return 0;
  });

  // Paso 3: Preparar los datos en el orden correcto
  const datos = facturas.map(f => [
    f.company_id?.[1] || "",                                // A: Compañía
    f.invoice_partner_display_name || "",                   // B: Nombre empresa
    f.name || "",                                           // C: Número
    "'" + (f.ref || ""),                                    // D: Referencia (como texto)
    f.invoice_date ? new Date(f.invoice_date) : "",         // E: Fecha factura
    f.invoice_date_due ? new Date(f.invoice_date_due) : "", // F: Fecha vencimiento
    f.amount_untaxed_signed || "",                          // G: Importe sin impuestos
    f.amount_total_signed || "",                            // H: Total con signo
    f.amount_residual || ""                                 // I: Importe adeudado
  ]);

  // Paso 4: Escribir los datos a partir de la fila 3
  if (datos.length > 0) {
    hoja.getRange(3, 1, datos.length, 9).setValues(datos);

    // Paso 5: Formatear columnas de fechas (E y F)
    hoja.getRange(3, 5, datos.length, 1).setNumberFormat("yyyy-mm-dd");
    hoja.getRange(3, 6, datos.length, 1).setNumberFormat("yyyy-mm-dd");
  }

  // Paso 6: Agregar mensaje en A2 con fecha y hora
  const ahora = new Date();
  const formatoFecha = Utilities.formatDate(ahora, Session.getScriptTimeZone(), "yyyy-MM-dd 'a las' HH:mm:ss");
  hoja.getRange("A2").setValue(`Los datos fueron actualizados por última vez el día ${formatoFecha}`);
}


