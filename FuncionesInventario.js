function setUpInventarioInSheet() {
  const HOJA = 'PLANTILLA';
  const RANGO_ARENA = 'G7:R130';       // 124 filas x 12 columnas

  // Mapeo RELATIVO dentro del rango G7:R130 (col 1 = G, col 2 = H, etc.)
  const COL_PRODUCT = 1;
  const COL_LOT = 2;
  const COL_QUANTITY = 3;
  const COL_LOCATION = 6;
  const COL_EXPIRATION = 12;

  /**
   * --- 1) Obtener datos desde la base de datos ---
   * Debe existir la función getAjusteInventario() y devolver .records
  */

  LibSheetUtils.UI_showStatus("Extrayendo registros de la base de datos...")
  Logger.log("Extrayendo registros de la base de datos...")

  const records = (getAjusteInventario() || {}).records || [];
  if (records.length === 0) {
    LibSheetUtils.UI_showError("No hay registros en la base de datos");
    return;
  };
  LibSheetUtils.UI_showSuccess(records.length + " Extraidos exitosamente.")
  Logger.log(records.length + " Extraidos exitosamente.")


  // --- Utilidades ---
  const keyOf = (product, lot) =>
    `${String(product || '').trim().toLowerCase()}|${String(lot || '').trim().toLowerCase()}`;

  const normStr = (v) => (v == null ? '' : String(v).trim());

  const toNumber = (v) => {
    if (v == null || v === '') return '';
    const n = Number(v);
    return Number.isFinite(n) ? n : '';
  };

  const formatDate = (dateStr) => {
    try {
      if (!dateStr) return '';

      const date = new Date(dateStr.replace(' ', 'T')); // asegurar compatibilidad
      const day = String(date.getDate()).padStart(2, '0');
      const month = String(date.getMonth() + 1).padStart(2, '0'); // meses van 0-11
      const year = date.getFullYear();

      return `${day}/${month}/${year}`;
    } catch {
      return ""
    }
  };

  /**
   *  --- 2) Abrir sheet y leer el rango --- 
  **/

  LibSheetUtils.UI_showStatus("Comparando registros con la Google Sheet...")
  Logger.log("Extrayendo información de la Google Sheet...")

  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(HOJA);
  const rango = sheet.getRange(RANGO_ARENA);
  const values = rango.getValues(); // matriz [filas][12]
  const numRows = values.length;

  // Índice de las filas existentes por (producto|lote)
  const existingIndex = new Map();  // key -> rowIdx (0-based relativo al rango)
  for (let i = 0; i < numRows; i++) {
    const row = values[i];
    const product = normStr(row[COL_PRODUCT - 1]);
    const lot = normStr(row[COL_LOT - 1]);
    if (product) {
      existingIndex.set(keyOf(product, lot), i);
    }
  }

  // Normalizar los registros que vamos a insertar/actualizar
  const incoming = records.map((item) => ({
    product: normStr(item.product_id && item.product_id.display_name),
    lot: normStr(item.lot_id && item.lot_id.display_name),
    quantity: toNumber(item.quantity),
    location: normStr(item.location_id && item.location_id.display_name),
    expiration_date: formatDate(item.expiration_date)
  }));

  // --- 3) Actualizar filas existentes ---
  // --- 4) Insertar nuevas filas si no existe la combinación producto+lote ---
  // --- 5) Contar las que no caben en el rango (sin espacio) ---
  // Trabajamos sobre copia para escribir en bloque
  const out = values.map((row) => row.slice());

  // Marcar espacios vacíos disponibles (filas cuyo col PRODUCT esté vacío)
  const emptyRowIdxs = [];
  for (let i = 0; i < numRows; i++) {
    if (!normStr(out[i][COL_PRODUCT - 1])) emptyRowIdxs.push(i);
  }

  let appended = 0, updated = 0, skippedNoSpace = 0;

  for (const rec of incoming) {
    if (!rec.product) continue; // seguridad básica

    const k = keyOf(rec.product, rec.lot);

    if (existingIndex.has(k)) {
      // Actualizar fila existente
      const r = existingIndex.get(k);
      const row = out[r];

      row[COL_PRODUCT - 1] = rec.product;
      row[COL_LOT - 1] = rec.lot;
      row[COL_QUANTITY - 1] = rec.quantity;
      row[COL_LOCATION - 1] = rec.location;
      row[COL_EXPIRATION - 1] = rec.expiration_date;

      out[r] = row;
      updated++;
    } else {
      // Insertar en la primera fila vacía disponible dentro del rango
      if (emptyRowIdxs.length === 0) {
        skippedNoSpace++;
        continue;
      }
      const r = emptyRowIdxs.shift();
      const row = out[r];

      row[COL_PRODUCT - 1] = rec.product;
      row[COL_LOT - 1] = rec.lot;
      row[COL_QUANTITY - 1] = rec.quantity;
      row[COL_LOCATION - 1] = rec.location;
      row[COL_EXPIRATION - 1] = rec.expiration_date;

      out[r] = row;
      appended++;
    }
  }

  /** --- Escritura única al sheet (eficiente) --- */
  rango.setValues(out);

  LibSheetUtils.UI_showSuccess(`Actualizadas: ${updated}, Nuevas: ${appended}, Sin espacio: ${skippedNoSpace}`)
  Logger.log(`Actualizadas: ${updated}, Nuevas: ${appended}, Sin espacio: ${skippedNoSpace}`);
  Logger.log(`Out: \n${out}`)
}

function buildDataToSet(valores, inventario) {
  /**
   * Las filas a registrar empiezan en 
   */
}

function getAjusteInventario() {
  const kwargs = {
    "specification": {
      "id": {},
      "company_id": {
        "fields": {
          "display_name": {}
        }
      },
      "location_id": {
        "fields": {
          "display_name": {}
        }
      },
      "product_id": {
        "fields": {
          "display_name": {}
        }
      },
      "lot_id": {
        "fields": {
          "display_name": {}
        }
      },
      "use_expiration_date": {},
      "expiration_date": {},
      "quantity": {},
      "product_uom_id": {
        "fields": {
          "display_name": {}
        }
      }
    },
    "offset": 0,
    "order": "quantity ASC, location_id ASC, product_id ASC, inventory_date ASC, package_id ASC, lot_id ASC, owner_id ASC",
    "limit": 80,
    "context": {
      "lang": "es_CO",
      "tz": "America/Lima",
      "allowed_company_ids": [
        1,
        2,
        3,
        4
      ],
      "inventory_mode": true,
      "no_at_date": true,
      "current_company_id": 1
    },
    "count_limit": 10001,
    "domain": [
      "&",
      [
        "location_id.usage",
        "in",
        [
          "internal",
          "transit"
        ]
      ],
      [
        "location_id",
        "ilike",
        "Punto de venta"
      ]
    ]
  }

  const sesionId = "session_id=2c91c3fe2fa2bcb08a72d39c6768e2e7592fc95c"//LibOdooUtils.odooGetSessionId('EZ')

  const ajusteInventario = hacerConsultaOdoo('stock.quant', 'web_search_read', [], kwargs, sesionId);

  return ajusteInventario;
}