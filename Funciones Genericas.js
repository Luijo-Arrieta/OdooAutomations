// ========================================
// CONFIGURACION AJUSTE
// ========================================
const CUENTAS_AJUSTE = {
  MAYOR_SALDO: "42958105", // Cuando el pago es mayor al saldo
  MENOR_SALDO: "53958105", // Cuando el pago es menor al saldo
  ARR_OTROS: "23359505",
  CUENTA_LIQUIDACIONES: "25050505" // Cuenta específica para liquidaciones
};

const LIMITE_AJUSTE = 100; // Límite en pesos para ajustes automáticos

// ========================================
// FUNCIÓN PARA IDENTIFICAR EMPRESA
// ========================================
function identificarEmpresa(hoja, fila, configuracion) {
  // Si solo hay una empresa en la configuración, la retornamos directamente
  if (configuracion.EMPRESAS && Object.keys(configuracion.EMPRESAS).length === 1) {
    return Object.values(configuracion.EMPRESAS)[0];
  }

  // Si hay múltiples empresas, identificamos por la columna B
  if (configuracion.EMPRESAS && configuracion.COLUMNA_EMPRESA !== undefined) {
    const nombreEmpresa = hoja.getRange(fila, configuracion.COLUMNA_EMPRESA + 1).getValue();

    // Buscar la empresa por nombre
    for (const [clave, empresa] of Object.entries(configuracion.EMPRESAS)) {
      if (empresa.NOMBRE && nombreEmpresa.toString().includes(empresa.NOMBRE)) {
        console.log(`🏢 Empresa identificada: ${empresa.NOMBRE} (ID: ${empresa.ID})`);
        return empresa;
      }
    }

    console.warn(`⚠️ No se pudo identificar empresa para: ${nombreEmpresa}`);
    return null;
  }

  // Si no hay configuración de múltiples empresas, usar configuración por defecto
  return configuracion.ODOO ? { ID: configuracion.ODOO.EMPRESA_ID } : null;
}

// ========================================
// FUNCIÓN PARA BUSCAR PROVEEDOR
// ========================================
function buscarProveedorPorNombre(nombreProveedor, sesionId, empresaId) {
  console.log(`🔍 Buscando proveedor: '${nombreProveedor}' (empresa: ${empresaId})`);
  
  // Validación de entrada
  if (!nombreProveedor || nombreProveedor.toString().trim() === '') {
    console.error(`❌ Nombre de proveedor vacío o inválido`);
    return null;
  }

  const nombreLimpio = nombreProveedor.toString().trim();
  console.log(`🧹 Nombre limpio para búsqueda: "${nombreLimpio}"`);
  
  try {
    // ========================================
    // BÚSQUEDA EXACTA CON FILTROS BÁSICOS (COMO EN TU TEST EXITOSO)
    // ========================================
    console.log(`🔍 Paso 1: Búsqueda exacta con filtros básicos...`);
    let proveedores = hacerConsultaOdoo('res.partner', 'search_read', [
      [["name", "=", nombreLimpio], ["is_company", "=", true], ["supplier_rank", ">", 0]]
    ], { fields: ["id", "name", "company_id", "is_company", "supplier_rank"], limit: 1 }, sesionId);
    
    console.log(`📊 Búsqueda exacta con filtros básicos: ${proveedores.length} resultados`);
    
    if (proveedores.length > 0) {
      const proveedor = proveedores[0];
      console.log(`✅ Proveedor encontrado (exacto): ${proveedor.name} (ID: ${proveedor.id})`);
      console.log(`📋 Company ID del proveedor: ${proveedor.company_id || 'Sin empresa asignada'}`);
      console.log(`📋 Es empresa: ${proveedor.is_company}, Supplier rank: ${proveedor.supplier_rank}`);
      return proveedor.id;
    }

    // ========================================
    // BÚSQUEDA CON ILIKE Y FILTROS BÁSICOS
    // ========================================
    console.log(`🔍 Paso 2: Búsqueda con ilike y filtros básicos...`);
    proveedores = hacerConsultaOdoo('res.partner', 'search_read', [
      [["name", "ilike", nombreLimpio], ["is_company", "=", true], ["supplier_rank", ">", 0]]
    ], { fields: ["id", "name", "company_id", "is_company", "supplier_rank"], limit: 1 }, sesionId);
    
    console.log(`📊 Búsqueda ilike con filtros básicos: ${proveedores.length} resultados`);
    
    if (proveedores.length > 0) {
      const proveedor = proveedores[0];
      console.log(`✅ Proveedor encontrado (similar): ${proveedor.name} (ID: ${proveedor.id})`);
      console.log(`📋 Company ID del proveedor: ${proveedor.company_id || 'Sin empresa asignada'}`);
      return proveedor.id;
    }

    // ========================================
    // BÚSQUEDA SIN FILTROS DE SUPPLIER_RANK (FALLBACK)
    // ========================================
    console.log(`🔍 Paso 3: Búsqueda sin filtro supplier_rank...`);
    proveedores = hacerConsultaOdoo('res.partner', 'search_read', [
      [["name", "=", nombreLimpio], ["is_company", "=", true]]
    ], { fields: ["id", "name", "company_id", "is_company", "supplier_rank"], limit: 1 }, sesionId);
    
    console.log(`📊 Búsqueda sin supplier_rank: ${proveedores.length} resultados`);
    
    if (proveedores.length > 0) {
      const proveedor = proveedores[0];
      console.log(`✅ Proveedor encontrado (sin filtro supplier_rank): ${proveedor.name} (ID: ${proveedor.id})`);
      console.log(`📋 Supplier rank: ${proveedor.supplier_rank || 'Sin supplier_rank'}`);
      return proveedor.id;
    }

    // ========================================
    // BÚSQUEDA SOLO POR NOMBRE (MÁXIMO FALLBACK)
    // ========================================
    console.log(`🔍 Paso 4: Búsqueda solo por nombre...`);
    proveedores = hacerConsultaOdoo('res.partner', 'search_read', [
      [["name", "=", nombreLimpio]]
    ], { fields: ["id", "name", "company_id", "is_company", "supplier_rank"], limit: 1 }, sesionId);
    
    console.log(`📊 Búsqueda solo por nombre: ${proveedores.length} resultados`);
    
    if (proveedores.length > 0) {
      const proveedor = proveedores[0];
      console.log(`✅ Proveedor encontrado (solo nombre): ${proveedor.name} (ID: ${proveedor.id})`);
      console.log(`📋 Es empresa: ${proveedor.is_company}, Supplier rank: ${proveedor.supplier_rank}`);
      console.log(`📋 Company ID: ${proveedor.company_id || 'Sin empresa asignada'}`);
      return proveedor.id;
    }

    // No encontrado
    console.error(`❌ Proveedor '${nombreLimpio}' no encontrado en ninguna búsqueda`);
    return null;
    
  } catch (error) {
    console.error(`❌ Error buscando proveedor '${nombreLimpio}': ${error.message}`);
    console.error(`Stack trace: ${error.stack}`);
    return null;
  }
}

// ========================================
// VALIDACIÓN DE DIARIOS Y MÉTODOS DE PAGO
// ========================================
function buscarDiarioPorNombre(nombreDiario, sesionId, empresaId) {
  const url = `${odooBaseUrl}/web/dataset/call_kw/account.journal/web_search_read`;
  const payload = {
    jsonrpc: "2.0",
    method: "call",
    params: {
      model: "account.journal",
      method: "web_search_read",
      args: [],
      kwargs: {
        domain: [
          "&",
          ["company_id", "=", empresaId],
          ["name", "=", nombreDiario]
        ],
        specification: {
          id: {},
          name: {},
          display_name: {},
          code: {},
          type: {},
          company_id: {}
        },
        limit: 5,
        context: { lang: 'es_CO', tz: 'America/Bogota' }
      }
    },
    id: Math.floor(Math.random() * 100000)
  };

  const opciones = {
    method: "post",
    contentType: "application/json",
    payload: JSON.stringify(payload),
    headers: { Cookie: sesionId },
    muteHttpExceptions: true
  };

  try {
    const respuesta = UrlFetchApp.fetch(url, opciones);
    const resultado = JSON.parse(respuesta.getContentText());

    if (resultado.error) {
      console.warn(`⚠️ Error buscando diario: ${resultado.error.data.message}`);
      return null;
    }

    if (resultado.result && resultado.result.records && resultado.result.records.length > 0) {
      const diario = resultado.result.records[0];
      console.log(`✅ Diario encontrado: ${diario.name} (ID: ${diario.id})`);
      return diario.id;
    }

    console.warn(`⚠️ Diario no encontrado: "${nombreDiario}" para empresa ID: ${empresaId}`);
    return null;

  } catch (error) {
    console.error(`❌ Error en búsqueda de diario: ${error.message}`);
    return null;
  }
}

function buscarMetodoPagoCompatible(diarioId, sesionId, empresaId, nombrePreferido = "Manual") {
  const url = `${odooBaseUrl}/web/dataset/call_kw/account.payment.method.line/web_search_read`;
  const payload = {
    jsonrpc: "2.0",
    method: "call",
    params: {
      model: "account.payment.method.line",
      method: "web_search_read",
      args: [],
      kwargs: {
        domain: [
          ["journal_id", "=", diarioId],
          ["payment_type", "=", "outbound"]
        ],
        specification: {
          id: {},
          name: {},
          payment_method_id: {},
          journal_id: {}
        },
        limit: 10,
        context: { lang: 'es_CO', tz: 'America/Bogota' }
      }
    },
    id: Math.floor(Math.random() * 100000)
  };

  const opciones = {
    method: "post",
    contentType: "application/json",
    payload: JSON.stringify(payload),
    headers: { Cookie: sesionId },
    muteHttpExceptions: true
  };

  try {
    const respuesta = UrlFetchApp.fetch(url, opciones);
    const resultado = JSON.parse(respuesta.getContentText());

    if (resultado.error) {
      console.warn(`⚠️ Error buscando método de pago compatible: ${resultado.error.data.message}`);
      return null;
    }

    if (resultado.result && resultado.result.records && resultado.result.records.length > 0) {
      // Primero buscar por nombre preferido (ej: "Manual")
      const metodoPreferido = resultado.result.records.find(metodo =>
        metodo.name.toLowerCase().includes(nombrePreferido.toLowerCase())
      );

      if (metodoPreferido) {
        console.log(`✅ Método de pago preferido encontrado: ${metodoPreferido.name} (ID: ${metodoPreferido.id})`);
        return metodoPreferido.id;
      }

      // Si no encuentra el preferido, tomar el primero disponible
      const metodo = resultado.result.records[0];
      console.log(`✅ Método de pago compatible encontrado: ${metodo.name} (ID: ${metodo.id})`);
      return metodo.id;
    }

    console.warn(`⚠️ No se encontró método de pago compatible para diario ID: ${diarioId}`);
    return null;

  } catch (error) {
    console.error(`❌ Error en búsqueda de método de pago compatible: ${error.message}`);
    return null;
  }
}

// ========================================
// FUNCIÓN PARA VALIDAR DIARIO Y MÉTODO - MODIFICADA PARA EMPRESA ID=1
// ========================================
function validarDiarioYMetodo(nombreDiario, sesionId, empresaId) {
  console.log(`🔍 Validando diario para empresa ID: ${empresaId}, diario: "${nombreDiario}"`);
  
  // CASO ESPECIAL: EMPRESA ID = 1
  if (empresaId === 1) {
    console.log(`🏢 Empresa ID=1 detectada - Usando diario predeterminado y método de pago de columna`);
    
    // Si no hay nombre de diario/método especificado, usar configuración por defecto
    if (!nombreDiario || typeof nombreDiario !== 'string' || nombreDiario.trim() === '') {
      console.log(`ℹ️ No hay método especificado para empresa ID=1, se usará configuración por defecto`);
      return { 
        valido: true, 
        usarDefault: true, 
        motivo: 'Empresa ID=1 - Configuración Predeterminada',
        empresaEspecial: true
      };
    }

    // Para empresa ID=1: buscar el método de pago por nombre en lugar del diario
    const metodoPagoId = buscarMetodoPagoPorNombre(nombreDiario.trim(), sesionId, empresaId);
    
    if (!metodoPagoId) {
      console.error(`❌ Método de pago no encontrado para empresa ID=1: "${nombreDiario}"`);
      return { 
        valido: false, 
        error: 'METODO_NO_ENCONTRADO_ID1', 
        metodoPagoNombre: nombreDiario.trim(),
        empresaEspecial: true
      };
    }

    console.log(`✅ Método de pago encontrado para empresa ID=1: "${nombreDiario}" (ID: ${metodoPagoId})`);
    
    return { 
      valido: true, 
      usarDefault: false, 
      metodoPagoId: metodoPagoId,
      usarDiarioPredeterminado: true, // Flag especial para empresa ID=1
      empresaEspecial: true
    };
  }

  // LÓGICA ORIGINAL PARA OTRAS EMPRESAS
  // Si no hay diario especificado, usar configuración por defecto (válido)
  if (!nombreDiario || typeof nombreDiario !== 'string' || nombreDiario.trim() === '') {
    console.log(`ℹ️ No hay diario especificado, se usará configuración por defecto`);
    return { 
      valido: true, 
      usarDefault: true, 
      motivo: 'Diario Predeterminado' 
    };
  }

  console.log(`🔍 Validando diario: "${nombreDiario}" para empresa ID: ${empresaId}`);
  
  // Buscar el diario por nombre
  const diarioId = buscarDiarioPorNombre(nombreDiario.trim(), sesionId, empresaId);
  
  if (!diarioId) {
    console.error(`❌ Diario no encontrado: "${nombreDiario}" para empresa ID: ${empresaId}`);
    return { 
      valido: false, 
      error: 'DIARIO_NO_ENCONTRADO', 
      diarioNombre: nombreDiario.trim() 
    };
  }

  console.log(`✅ Diario encontrado: "${nombreDiario}" (ID: ${diarioId})`);

  // Verificar método de pago compatible
  const metodoPagoId = buscarMetodoPagoCompatible(diarioId, sesionId, empresaId, "Manual");
  
  if (!metodoPagoId) {
    console.error(`❌ No hay método de pago compatible para diario: "${nombreDiario}"`);
    return { 
      valido: false, 
      error: 'METODO_NO_DISPONIBLE', 
      diarioNombre: nombreDiario.trim() 
    };
  }

  console.log(`✅ Método de pago compatible encontrado (ID: ${metodoPagoId}) para diario: "${nombreDiario}"`);
  
  return { 
    valido: true, 
    usarDefault: false, 
    diarioId: diarioId, 
    metodoPagoId: metodoPagoId 
  };
}

// ========================================
// FUNCIÓN PARA BUSCAR MÉTODO DE PAGO POR NOMBRE (EMPRESA ID=1)
// ========================================
function buscarMetodoPagoPorNombre(nombreMetodo, sesionId, empresaId) {
  console.log(`🔍 Buscando método de pago por nombre: "${nombreMetodo}" para empresa ID: ${empresaId}`);
  
  const url = `${odooBaseUrl}/web/dataset/call_kw/account.payment.method.line/web_search_read`;
  const payload = {
    jsonrpc: "2.0",
    method: "call",
    params: {
      model: "account.payment.method.line",
      method: "web_search_read",
      args: [],
      kwargs: {
        domain: [
          ["name", "ilike", nombreMetodo],
          ["payment_type", "=", "outbound"]
        ],
        specification: {
          id: {},
          name: {},
          journal_id: {},
          payment_method_id: {}
        },
        limit: 10,
        context: { lang: 'es_CO', tz: 'America/Bogota' }
      }
    },
    id: Math.floor(Math.random() * 100000)
  };

  const opciones = {
    method: "post",
    contentType: "application/json",
    payload: JSON.stringify(payload),
    headers: { Cookie: sesionId },
    muteHttpExceptions: true
  };

  try {
    const respuesta = UrlFetchApp.fetch(url, opciones);
    const resultado = JSON.parse(respuesta.getContentText());

    if (resultado.error) {
      console.warn(`⚠️ Error buscando método de pago: ${resultado.error.data.message}`);
      return null;
    }

    if (resultado.result && resultado.result.records && resultado.result.records.length > 0) {
      // Buscar coincidencia exacta primero
      let metodoEncontrado = resultado.result.records.find(metodo =>
        metodo.name.toLowerCase() === nombreMetodo.toLowerCase()
      );

      // Si no hay coincidencia exacta, tomar el primero que contenga el nombre
      if (!metodoEncontrado) {
        metodoEncontrado = resultado.result.records.find(metodo =>
          metodo.name.toLowerCase().includes(nombreMetodo.toLowerCase())
        );
      }

      // Si aún no hay coincidencia, tomar el primero disponible
      if (!metodoEncontrado) {
        metodoEncontrado = resultado.result.records[0];
      }

      console.log(`✅ Método de pago encontrado: ${metodoEncontrado.name} (ID: ${metodoEncontrado.id})`);
      console.log(`📋 Journal ID asociado: ${metodoEncontrado.journal_id}`);
      return metodoEncontrado.id;
    }

    console.warn(`⚠️ No se encontró método de pago para: "${nombreMetodo}"`);
    return null;

  } catch (error) {
    console.error(`❌ Error en búsqueda de método de pago: ${error.message}`);
    return null;
  }
}


// ========================================
// FUNCIONES DE UTILIDAD
// ========================================
function obtenerHoja(nombreHoja) {
  const hoja = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(nombreHoja);
  if (!hoja) {
    SpreadsheetApp.getUi().alert(`❌ Hoja "${nombreHoja}" no encontrada`);
    console.error(`Hoja no encontrada: ${nombreHoja}`);
    return null;
  }
  return hoja;
}

function obtenerFechaActual() {
  return Utilities.formatDate(new Date(), "GMT-5", "yyyy-MM-dd");
}

function esFacturaValida(valorFactura, configuracion) {
  return typeof valorFactura === "string" &&
    configuracion.PREFIJOS_VALIDOS.some(prefijo => valorFactura.startsWith(prefijo));
}

function establecerMensajeEnCelda(hoja, fila, mensaje, fecha, configuracion) {
  const mensajeCompleto = `${mensaje} // ${fecha}`;
  hoja.getRange(fila, configuracion.COLUMNAS.MENSAJES + 1).setValue(mensajeCompleto);
}
