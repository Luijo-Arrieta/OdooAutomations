// ========================================
// SISTEMA DE PAGOS Y CONCILIACIÓN DE ASIENTOS CONTABLES 
// ========================================

const MENSAJES_ASIENTOS = {
  PAGO_REGISTRADO: "✅ Pago de asiento registrado y conciliado",
  PAGO_CON_AJUSTE: "✅ Pago conciliado con ajuste automático",
  NO_ENCONTRADO: "❌ Asiento no encontrado en Odoo",
  YA_PAGADO: "✔️ Asiento ya pagado o en proceso",
  PARTNER_NO_ENCONTRADO: "❌ Proveedor no encontrado",
  PROVEEDOR_VACIO: "❌ Campo proveedor vacío", 
  ERROR_REGISTRO: "❌ Error al registrar pago",
  ERROR_CONCILIACION: "❌ Error en conciliación",
  ERROR_AJUSTE: "❌ Error al crear ajuste automático",
  ERROR_PREFIJO: "❌ Prefijo de asiento inválido",
  DIARIO_NO_ENCONTRADO: "❌ Diario no encontrado",
  ERROR_EMPRESA: "❌ No se pudo identificar la empresa",
  SIN_LINEAS_CONCILIABLES: "❌ No hay líneas conciliables con el monto especificado" 
};

// ========================================
// FUNCIÓN PRINCIPAL
// ========================================
function procesarPagosAsientosContables(nombreHoja, configuracion) {
  console.log(`-----🚀 INICIANDO PROCESAMIENTO DE ASIENTOS CONTABLES EN: ${nombreHoja}-----`);
  
  const hoja = obtenerHoja(nombreHoja);
  if (!hoja) return;

  const sesionId = LibOdooUtils.odooGetSessionId("EZ");
  const fechaActual = obtenerFechaActual();
  const contadores = { conciliados: 0, yaPagados: 0, errores: 0, conAjustes: 0, noEncontradas: 0};

  console.log("---📝 Procesando asientos contables...");
  procesarAsientosIndividuales(hoja, sesionId, fechaActual, contadores, configuracion);
  mostrarResumenAsientos(contadores);
  console.log("✅ PROCESAMIENTO DE ASIENTOS COMPLETADO");
}

// ========================================
// PROCESAMIENTO DE ASIENTOS
// ========================================

function procesarAsientosIndividuales(hoja, sesionId, fecha, contadores, configuracion) {
  const ultimaFila = hoja.getLastRow();
  const datos = hoja.getRange(configuracion.FILA_INICIO, 1, ultimaFila - configuracion.FILA_INICIO + 1, 20).getValues();

  const asientosIndividuales = datos
    .map((fila, indice) => ({ fila, numeroFila: indice + configuracion.FILA_INICIO }))
    .filter(item => {
      const valorAsiento = item.fila[configuracion.COLUMNAS.FACTURA];
      const valorCheckbox = item.fila[configuracion.COLUMNAS.CHECKBOX];
      const valorProveedor = item.fila[configuracion.COLUMNAS.PROVEEDOR];
      
      // Validar que todos los campos críticos estén presentes
      const tieneAsiento = typeof valorAsiento === "string" && valorAsiento.trim() !== '';
      const tieneCheckbox = valorCheckbox === true;
      const tieneProveedor = valorProveedor && valorProveedor.toString().trim() !== '';
      const tienePrefijo = configuracion.PREFIJOS_VALIDOS_B.some(prefijo => valorAsiento.startsWith(prefijo));
      
      // *** NUEVA VALIDACIÓN: Marcar error si falta proveedor pero cumple otros criterios ***
      if (tieneCheckbox && tieneAsiento && tienePrefijo && !tieneProveedor) {
        console.warn(`⚠️ Fila ${item.numeroFila}: Asiento '${valorAsiento}' marcado pero sin proveedor`);
        // Establecer mensaje de error inmediatamente
        establecerMensajeEnCelda(hoja, item.numeroFila, MENSAJES_ASIENTOS.PARTNER_NO_ENCONTRADO + ": Campo vacío", fecha, configuracion);
        contadores.errores++;
        return false; // Excluir del procesamiento
      }
      
      return tieneAsiento && tieneCheckbox && tieneProveedor && tienePrefijo;
    });

  console.log(`📝 Encontrados ${asientosIndividuales.length} asientos contables válidos para procesar`);
  if (asientosIndividuales.length === 0) {
    console.log("ℹ️ No hay asientos contables pendientes de procesar (verificar que tengan proveedor)");
    return;
  }

  asientosIndividuales.forEach((item, indice) => {
    console.log(`🔄 Procesando asiento ${indice + 1}/${asientosIndividuales.length}`);
    procesarAsientoIndividual(item, hoja, sesionId, fecha, contadores, configuracion);
  });
}

function procesarAsientoIndividual(item, hoja, sesionId, fecha, contadores, configuracion) {
  const { fila, numeroFila } = item;
  const [nombreAsiento, montoHoja, comunicacion, diarioSeleccionado, nombreProveedor] = [
    fila[configuracion.COLUMNAS.FACTURA],
    fila[configuracion.COLUMNAS.MONTO],
    fila[configuracion.COLUMNAS.COMUNICACION],
    fila[configuracion.COLUMNAS.DIARIO],
    fila[configuracion.COLUMNAS.PROVEEDOR]
  ];

  console.log(`🔍 Procesando asiento contable: ${nombreAsiento} - Proveedor: ${nombreProveedor}`);

  try {
    // ========================================
    // VALIDACIÓN CRÍTICA #1: PROVEEDOR NO VACÍO (PRIMERA LÍNEA)
    // ========================================
    if (!nombreProveedor || nombreProveedor.toString().trim() === '') {
      console.error(`❌ Campo proveedor vacío para asiento: ${nombreAsiento}`);
      return establecerMensajeYContador(hoja, numeroFila, MENSAJES_ASIENTOS.PARTNER_NO_ENCONTRADO + ": Campo vacío", fecha, configuracion, contadores, 'errores');
    }

    // ========================================
    // VALIDACIÓN CRÍTICA #2: EMPRESA VÁLIDA
    // ========================================
    const empresa = identificarEmpresa(hoja, numeroFila, configuracion);
    if (!empresa) {
      return establecerMensajeYContador(hoja, numeroFila, MENSAJES_ASIENTOS.ERROR_EMPRESA, fecha, configuracion, contadores, 'errores');
    }

    // ========================================
    // VALIDACIÓN CRÍTICA #3: PROVEEDOR EXISTE EN ODOO (ANTES DE CONTINUAR)
    // ========================================
    const partnerId = buscarProveedorPorNombre(nombreProveedor.toString().trim(), sesionId, empresa.ID);
    if (!partnerId) {
      console.error(`❌ Proveedor '${nombreProveedor}' no encontrado en Odoo para asiento: ${nombreAsiento}`);
      return establecerMensajeYContador(hoja, numeroFila, `${MENSAJES_ASIENTOS.PARTNER_NO_ENCONTRADO}: ${nombreProveedor}`, fecha, configuracion, contadores, 'errores');
    }

    console.log(`✅ Proveedor encontrado: ${nombreProveedor} (ID: ${partnerId})`);

    // Validaciones restantes (diario, asiento, etc.)
    const validacionDiario = validarDiarioYMetodo(diarioSeleccionado, sesionId, empresa.ID);
    if (!validacionDiario.valido) {
      const mensajeError = validacionDiario.error === 'DIARIO_NO_ENCONTRADO' 
        ? `${MENSAJES_ASIENTOS.DIARIO_NO_ENCONTRADO}: ${validacionDiario.diarioNombre}`
        : MENSAJES_ASIENTOS.ERROR_REGISTRO;
      return establecerMensajeYContador(hoja, numeroFila, mensajeError, fecha, configuracion, contadores, 'errores');
    }

    // Buscar asiento y verificar conciliación
    const asiento = hacerConsultaOdoo('account.move', 'search_read', [
      [["name", "=", nombreAsiento], ["company_id", "=", empresa.ID]]
    ], { fields: ["id", "name", "company_id", "amount_total_signed", "state", "partner_id"], limit: 1 }, sesionId);

    if (!asiento || asiento.length === 0) {
      return establecerMensajeYContador(hoja, numeroFila, MENSAJES_ASIENTOS.NO_ENCONTRADO, fecha, configuracion, contadores, 'noEncontradas');
    }

    // Verificar que existan líneas conciliables ANTES de proceder
    const validacionLineas = validarLineasConciliables(asiento[0].id, montoHoja, sesionId, empresa.ID);
    if (!validacionLineas.valido) {
      console.warn(`⚠️ ${validacionLineas.razon} para asiento ${nombreAsiento}`);
      return establecerMensajeYContador(hoja, numeroFila, MENSAJES_ASIENTOS.SIN_LINEAS_CONCILIABLES, fecha, configuracion, contadores, 'errores');
    }

    if (verificarConciliacionAsiento(nombreAsiento, montoHoja, sesionId, empresa.ID)) {
      return establecerMensajeYContador(hoja, numeroFila, MENSAJES_ASIENTOS.YA_PAGADO, fecha, configuracion, contadores, 'yaPagados');
    }

    // ========================================
    // AQUÍ YA TENEMOS GARANTIZADO QUE EL PROVEEDOR EXISTE
    // ========================================
    
    // Registrar pago y conciliar (partnerId ya validado)
    const resultadoPago = registrarPagoAsientoContable(asiento[0], partnerId, montoHoja, comunicacion, sesionId, configuracion, empresa.ID, diarioSeleccionado, validacionDiario, nombreAsiento);
    if (!resultadoPago.success) {
      return establecerMensajeYContador(hoja, numeroFila, MENSAJES_ASIENTOS.ERROR_REGISTRO, fecha, configuracion, contadores, 'errores');
    }

    const resultadoConciliacion = conciliarPagoConAsiento(resultadoPago.pagoId, asiento[0].id, sesionId, empresa.ID);
    
    let mensaje = MENSAJES_ASIENTOS.PAGO_REGISTRADO;
    let contador = 'conciliados';
    
    if (!resultadoConciliacion.success) {
      console.error(`❌ Error inesperado: fallo en conciliación después de validación exitosa`);
      mensaje = MENSAJES_ASIENTOS.ERROR_CONCILIACION;
      contador = 'errores';
    } else if (resultadoConciliacion.conAjuste) {
      mensaje = `${MENSAJES_ASIENTOS.PAGO_CON_AJUSTE} (${resultadoConciliacion.montoAjuste > 0 ? '+' : ''}${resultadoConciliacion.montoAjuste.toLocaleString('es-CO')})`;
      contadores.conAjustes++;
    }
    
    if (resultadoPago.usandoDefault) mensaje += ` // Default por ${resultadoPago.motivoDefault}`;
    establecerMensajeYContador(hoja, numeroFila, mensaje, fecha, configuracion, contadores, contador);

  } catch (error) {
    establecerMensajeYContador(hoja, numeroFila, `❌ Error: ${error.message}`, fecha, configuracion, contadores, 'errores');
    console.error(`❌ Error procesando asiento ${nombreAsiento}: ${error.message}`);
  }
}


// ========================================
// FUNCIONES DE UTILIDAD 
// ========================================
function establecerMensajeYContador(hoja, numeroFila, mensaje, fecha, configuracion, contadores, tipoContador) {
  establecerMensajeEnCelda(hoja, numeroFila, mensaje, fecha, configuracion);
  contadores[tipoContador]++;
}

function hacerConsultaOdoo(modelo, metodo, args = [], kwargs = {}, sesionId) {
  const url = `${odooBaseUrl}/web/dataset/call_kw/${modelo}/${metodo}`;
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
  const resultado = JSON.parse(respuesta.getContentText());

  if (resultado.error) throw new Error(`Error en Odoo: ${resultado.error.data.message}`);
  return resultado.result;
}

function verificarConciliacionAsiento(nombreAsiento, montoObjetivo, sesionId, empresaId) {
  console.log(`🔍 Verificando conciliación para asiento: ${nombreAsiento} con monto: ${montoObjetivo}`);
  
  try {
    // Buscar asiento y obtener líneas en una sola consulta optimizada
    const asientos = hacerConsultaOdoo('account.move', 'search_read', [
      [["name", "=", nombreAsiento], ["company_id", "=", empresaId]]
    ], { fields: ["id", "name"], limit: 1 }, sesionId);

    if (!asientos.length) {
      console.warn(`⚠️ No se encontró ningún asiento con nombre ${nombreAsiento}`);
      return false;
    }

    const moveId = asientos[0].id;
    console.log(`📄 Asiento encontrado: ${asientos[0].name} (ID: ${moveId})`);

    // Obtener líneas contables del asiento
    const lineas = hacerConsultaOdoo('account.move.line', 'search_read', [
      [["move_id", "=", moveId]]
    ], { fields: ["id", "name", "balance", "reconciled"] }, sesionId);

    // Filtrar líneas que coinciden con el monto y verificar conciliación
    const lineasCoinciden = lineas.filter(linea => 
      Math.abs(linea.balance - montoObjetivo) < LIMITE_AJUSTE || Math.abs(linea.balance - (-montoObjetivo)) < LIMITE_AJUSTE
    );
    
    if (lineasCoinciden.length === 0) {
      // Ya no solo advertir, sino que esto indica un problema
      console.warn(`⚠️ No se encontraron líneas conciliables para monto ${montoObjetivo.toLocaleString('es-CO')}`);
      return false;
    }

    const todasConciliadas = lineasCoinciden.every(linea => linea.reconciled);
    console.log(`🎯 Resultado final: ${todasConciliadas ? 'Todas las líneas están conciliadas' : 'Hay líneas sin conciliar'}`);
    return todasConciliadas;

  } catch (error) {
    console.error(`❌ Error en verificación de conciliación: ${error.message}`);
    return false;
  }
}

function registrarPagoAsientoContable(asiento, partnerId, monto, comunicacion, sesionId, configuracion, empresaId, diarioSeleccionado, validacionDiario, nombreAsiento) {
  try {
    // Determinar configuración de diario y método de pago
    let diarioId, metodoPagoId, usandoDefault = false, motivoDefault = '';

    if (validacionDiario) {
      // CASO ESPECIAL: EMPRESA ID = 1
      if (validacionDiario.empresaEspecial && empresaId === 1) {
        console.log(`🏢 Procesando asiento contable para empresa ID=1 con lógica especial`);
        
        if (validacionDiario.usarDefault) {
          usandoDefault = true;
          motivoDefault = validacionDiario.motivo;
          
          // Usar configuración predeterminada para empresa ID=1
          const empresa = Object.values(configuracion.EMPRESAS).find(emp => emp.ID === empresaId);
          if (empresa && empresa.DIARIO_ID && empresa.METODO_PAGO_ID) {
            diarioId = empresa.DIARIO_ID;
            metodoPagoId = empresa.METODO_PAGO_ID;
          } else {
            throw new Error(`No se encontró configuración predeterminada para empresa ID: ${empresaId}`);
          }
        } else {
          // Para empresa ID=1: usar diario predeterminado + método de pago de la columna
          const empresa = Object.values(configuracion.EMPRESAS).find(emp => emp.ID === empresaId);
          if (!empresa || !empresa.DIARIO_ID) {
            throw new Error(`No se encontró diario predeterminado para empresa ID: ${empresaId}`);
          }
          
          diarioId = empresa.DIARIO_ID; // Diario predeterminado
          metodoPagoId = validacionDiario.metodoPagoId; // Método de la columna
          usandoDefault = false;
          
          console.log(`✅ Empresa ID=1 Asiento: Diario predeterminado (ID: ${diarioId}) + Método de columna (ID: ${metodoPagoId})`);
        }
      }
      // LÓGICA ORIGINAL PARA OTRAS EMPRESAS
      else if (validacionDiario.usarDefault) {
        usandoDefault = true;
        motivoDefault = validacionDiario.motivo;
        
        const empresa = Object.values(configuracion.EMPRESAS).find(emp => emp.ID === empresaId) || Object.values(configuracion.EMPRESAS)[0];
        const config = Object.keys(configuracion.EMPRESAS).length > 1 ? empresa : empresa;
        diarioId = Object.keys(configuracion.EMPRESAS).length > 1 ? config.DIARIO_ID : config.DIARIO_ID_B;
        metodoPagoId = Object.keys(configuracion.EMPRESAS).length > 1 ? config.METODO_PAGO_ID : config.METODO_PAGO_ID_B;
      } else {
        diarioId = validacionDiario.diarioId;
        metodoPagoId = validacionDiario.metodoPagoId;
      }
    } else {
      // Fallback a lógica original si no hay validación
      usandoDefault = true;
      const empresa = Object.values(configuracion.EMPRESAS).find(emp => emp.ID === empresaId) || Object.values(configuracion.EMPRESAS)[0];
      const config = Object.keys(configuracion.EMPRESAS).length > 1 ? empresa : empresa;
      diarioId = Object.keys(configuracion.EMPRESAS).length > 1 ? config.DIARIO_ID : config.DIARIO_ID_B;
      metodoPagoId = Object.keys(configuracion.EMPRESAS).length > 1 ? config.METODO_PAGO_ID : config.METODO_PAGO_ID_B;
    }

    console.log(`💰 Creando pago para asiento ${asiento.name} - Partner: ${partnerId}, Monto: ${monto}`);

    // Verificar si es ARR para usar cuenta especial
    const esARR = nombreAsiento && nombreAsiento.startsWith("ARR");
    let cuentaPago = null;

    if (esARR) {
      // Buscar la cuenta especial para ARR
      const cuentaARR = hacerConsultaOdoo('account.account', 'search_read', [
        [["code", "=", CUENTAS_AJUSTE.ARR_OTROS], ["company_id", "=", empresaId]]
      ], { fields: ["id", "name"], limit: 1 }, sesionId);
      
      if (cuentaARR.length > 0) {
        cuentaPago = cuentaARR[0].id;
        console.log(`🏦 Usando cuenta especial ARR: ${CUENTAS_AJUSTE.ARR_OTROS} (ID: ${cuentaPago})`);
      } else {
        console.warn(`⚠️ No se encontró cuenta ARR ${CUENTAS_AJUSTE.ARR_OTROS}, usando cuenta por defecto`);
      }
    }

    // Crear objeto de pago base
    const pagoData = {
      payment_type: "outbound",
      partner_type: "supplier",
      partner_id: partnerId,
      amount: Math.abs(monto),
      journal_id: diarioId,
      payment_method_line_id: metodoPagoId,
      date: new Date().toISOString().split("T")[0],
      ref: comunicacion || `Pago ${asiento.name}`,
      company_id: empresaId
    };

    // Agregar cuenta especial si es ARR
    if (cuentaPago) {
      pagoData.destination_account_id = cuentaPago;
    }

    // Crear y confirmar pago
    const pagoId = hacerConsultaOdoo('account.payment', 'create', [pagoData], {}, sesionId);

    console.log(`✅ Pago creado con ID: ${pagoId}${esARR ? ' (usando cuenta ARR)' : ''}`);

    // Confirmar el pago
    try {
      hacerConsultaOdoo('account.payment', 'action_post', [[pagoId]], {}, sesionId);
    } catch (error) {
      console.warn(`⚠️ Advertencia al confirmar pago: ${error.message}`);
    }

    return { success: true, usandoDefault, motivoDefault, pagoId };

  } catch (error) {
    console.error(`❌ Error en registro de pago para asiento: ${error.message}`);
    return { success: false, error: error.message };
  }
}


function validarLineasConciliables(asientoId, montoObjetivo, sesionId, empresaId) {
  console.log(`🔍 Validando líneas conciliables para asiento ID: ${asientoId} con monto: ${montoObjetivo.toLocaleString('es-CO')}`);
  
  try {
    // Obtener líneas contables del asiento
    const lineas = hacerConsultaOdoo('account.move.line', 'search_read', [
      [["move_id", "=", asientoId]]
    ], { fields: ["id", "name", "balance", "reconciled"] }, sesionId);

    if (lineas.length === 0) {
      return { valido: false, razon: "No se encontraron líneas contables en el asiento" };
    }

    // Buscar líneas que coincidan exactamente con el monto objetivo
    const lineasExactas = lineas.filter(linea => 
      Math.abs(linea.balance - montoObjetivo) < 1 || Math.abs(linea.balance - (-montoObjetivo)) < 1
    );

    if (lineasExactas.length > 0) {
      console.log(`✅ Encontradas ${lineasExactas.length} líneas con coincidencia exacta`);
      return { valido: true, tipoCoincidencia: "exacta", lineas: lineasExactas };
    }

    // Buscar líneas que permitan ajuste automático (dentro del límite)
    const lineasConAjuste = lineas.filter(linea => {
      const diferencia = Math.abs(Math.abs(linea.balance) - Math.abs(montoObjetivo));
      return diferencia > 0 && diferencia <= LIMITE_AJUSTE;
    });

    if (lineasConAjuste.length > 0) {
      console.log(`✅ Encontradas ${lineasConAjuste.length} líneas que permiten ajuste automático`);
      return { valido: true, tipoCoincidencia: "conAjuste", lineas: lineasConAjuste };
    }

    // No hay líneas conciliables
    console.warn(`⚠️ No se encontraron líneas conciliables para monto ${montoObjetivo.toLocaleString('es-CO')}`);
    const montosDisponibles = lineas.map(l => l.balance.toLocaleString('es-CO')).join(', ');
    return { 
      valido: false
    };

  } catch (error) {
    console.error(`❌ Error validando líneas conciliables: ${error.message}`);
    return { valido: false, razon: `Error en validación: ${error.message}` };
  }
}


// ========================================
// CONCILIACIÓN CON AJUSTES AUTOMÁTICOS
// ========================================
function conciliarPagoConAsiento(pagoId, asientoOriginalId, sesionId, empresaId) {
  console.log(`🔗 Iniciando conciliación - Pago ID: ${pagoId}, Asiento ID: ${asientoOriginalId}`);
  
  try {
    // Obtener move_id del pago
    const pago = hacerConsultaOdoo('account.payment', 'read', [[pagoId], ["name", "move_id"]], {}, sesionId);
    if (!pago.length || !pago[0].move_id?.length) {
      return { success: false, error: "NO_MOVE_PAGO" };
    }

    const movePagoId = pago[0].move_id[0];

    // Obtener líneas de ambos movimientos
    const lineasPago = obtenerLineasContables(movePagoId, sesionId);
    const lineasAsiento = obtenerLineasContables(asientoOriginalId, sesionId);

    if (!lineasPago.length || !lineasAsiento.length) {
      return { success: false, error: "NO_LINEAS_ENCONTRADAS" };
    }

    // Buscar líneas conciliables (exactas o con diferencias menores al límite)
    const resultadoConciliacion = buscarYConciliarLineas(lineasPago, lineasAsiento, sesionId, empresaId);
    
    return resultadoConciliacion;

  } catch (error) {
    console.error(`❌ Error en conciliación: ${error.message}`);
    return { success: false, error: error.message };
  }
}

function buscarYConciliarLineas(lineasPago, lineasAsiento, sesionId, empresaId) {
  const conciliacionesExactas = [];
  const conciliacionesConAjuste = [];
  
  // Primero buscar conciliaciones exactas
  lineasPago.forEach(lp => {
    if (lp.reconciled) return;
    lineasAsiento.forEach(lf => {
      if (!lf.reconciled && 
          lp.account_id[0] === lf.account_id[0] && 
          Math.abs(parseFloat(lp.balance) + parseFloat(lf.balance)) < 1) {
        conciliacionesExactas.push({
          lineaPago: lp,
          lineaAsiento: lf,
          diferencia: 0
        });
      }
    });
  });

  // Si no hay conciliaciones exactas, buscar con ajustes
  if (conciliacionesExactas.length === 0) {
    lineasPago.forEach(lp => {
      if (lp.reconciled) return;
      lineasAsiento.forEach(lf => {
        if (!lf.reconciled && 
            lp.account_id[0] === lf.account_id[0]) {
          const diferencia = parseFloat(lp.balance) + parseFloat(lf.balance);
          if (Math.abs(diferencia) > 0 && Math.abs(diferencia) <= LIMITE_AJUSTE) {
            conciliacionesConAjuste.push({
              lineaPago: lp,
              lineaAsiento: lf,
              diferencia: diferencia
            });
          }
        }
      });
    });
  }

  // Ejecutar conciliaciones exactas
  if (conciliacionesExactas.length > 0) {
    return ejecutarConciliacionesExactas(conciliacionesExactas, sesionId);
  }

  // Si no hay exactas, ejecutar con ajustes
  if (conciliacionesConAjuste.length > 0) {
    return ejecutarConciliacionesConAjuste(conciliacionesConAjuste, sesionId, empresaId);
  }

  return { success: false, error: "NO_LINEAS_CONCILIABLES" };
}

function ejecutarConciliacionesExactas(conciliaciones, sesionId) {
  let conciliacionesExitosas = 0;
  
  for (const conciliacion of conciliaciones) {
    try {
      const idsLineas = [conciliacion.lineaPago.id, conciliacion.lineaAsiento.id];
      hacerConsultaOdoo('account.move.line', 'reconcile', [idsLineas], {}, sesionId);
      conciliacionesExitosas++;
      console.log(`✅ Conciliación exacta exitosa para líneas ${idsLineas.join(', ')}`);
    } catch (error) {
      console.warn(`⚠️ Fallo conciliación exacta para líneas: ${error.message}`);
    }
  }

  return conciliacionesExitosas > 0 
    ? { success: true, conciliadas: conciliacionesExitosas, conAjuste: false }
    : { success: false, error: "TODAS_LAS_CONCILIACIONES_FALLARON" };
}

function ejecutarConciliacionesConAjuste(conciliaciones, sesionId, empresaId) {
  let conciliacionesExitosas = 0;
  let montoTotalAjuste = 0;
  
  for (const conciliacion of conciliaciones) {
    try {
      const resultado = crearConciliacionConAjuste(conciliacion, sesionId, empresaId);
      if (resultado.success) {
        conciliacionesExitosas++;
        montoTotalAjuste += conciliacion.diferencia;
        console.log(`✅ Conciliación con ajuste exitosa - Diferencia: ${conciliacion.diferencia.toLocaleString('es-CO')}`);
      }
    } catch (error) {
      console.warn(`⚠️ Fallo conciliación con ajuste: ${error.message}`);
    }
  }

  return conciliacionesExitosas > 0 
    ? { 
        success: true, 
        conciliadas: conciliacionesExitosas, 
        conAjuste: true,
        montoAjuste: montoTotalAjuste
      }
    : { success: false, error: "TODAS_LAS_CONCILIACIONES_CON_AJUSTE_FALLARON" };
}

function crearConciliacionConAjuste(conciliacion, sesionId, empresaId) {
  try {
    const { lineaPago, lineaAsiento, diferencia } = conciliacion;
    
    // Determinar cuenta de ajuste según si el pago es mayor o menor
    const cuentaAjuste = diferencia > 0 ? CUENTAS_AJUSTE.MAYOR_SALDO : CUENTAS_AJUSTE.MENOR_SALDO;
    
    console.log(`🔧 Creando ajuste automático - Diferencia: ${diferencia.toLocaleString('es-CO')}, Cuenta: ${cuentaAjuste}`);
    
    // Buscar la cuenta de ajuste
    const cuenta = hacerConsultaOdoo('account.account', 'search_read', [
      [["code", "=", cuentaAjuste], ["company_id", "=", empresaId]]
    ], { fields: ["id", "name"], limit: 1 }, sesionId);
    
    if (!cuenta.length) {
      console.error(`❌ No se encontró la cuenta de ajuste: ${cuentaAjuste}`);
      return { success: false, error: "CUENTA_AJUSTE_NO_ENCONTRADA" };
    }
    
    const cuentaAjusteId = cuenta[0].id;
    
    // Crear asiento de ajuste
    const asientoAjuste = {
      company_id: empresaId,
      date: new Date().toISOString().split("T")[0],
      ref: `Ajuste automático - Diferencia: ${diferencia.toLocaleString('es-CO')}`,
      line_ids: [
        [0, 0, {
          account_id: lineaPago.account_id[0], // Misma cuenta que las líneas a conciliar
          debit: diferencia > 0 ? 0 : Math.abs(diferencia),
          credit: diferencia > 0 ? Math.abs(diferencia) : 0,
          name: `Ajuste conciliación - ${Math.abs(diferencia).toLocaleString('es-CO')}`
        }],
        [0, 0, {
          account_id: cuentaAjusteId,
          debit: diferencia > 0 ? Math.abs(diferencia) : 0,
          credit: diferencia > 0 ? 0 : Math.abs(diferencia),
          name: `Contrapartida ajuste - ${Math.abs(diferencia).toLocaleString('es-CO')}`
        }]
      ]
    };
    
    // Crear y confirmar el asiento de ajuste
    const asientoAjusteId = hacerConsultaOdoo('account.move', 'create', [asientoAjuste], {}, sesionId);
    hacerConsultaOdoo('account.move', 'action_post', [[asientoAjusteId]], {}, sesionId);
    
    // Obtener la línea de ajuste para conciliación
    const lineasAjuste = hacerConsultaOdoo('account.move.line', 'search_read', [
      [["move_id", "=", asientoAjusteId], ["account_id", "=", lineaPago.account_id[0]]]
    ], { fields: ["id", "balance"] }, sesionId);
    
    if (!lineasAjuste.length) {
      console.error(`❌ No se pudo obtener línea de ajuste`);
      return { success: false, error: "LINEA_AJUSTE_NO_ENCONTRADA" };
    }
    
    // Conciliar las tres líneas: pago original, asiento original y ajuste
    const lineasAConciliar = [lineaPago.id, lineaAsiento.id, lineasAjuste[0].id];
    hacerConsultaOdoo('account.move.line', 'reconcile', [lineasAConciliar], {}, sesionId);
    
    console.log(`✅ Conciliación con ajuste completada exitosamente`);
    return { success: true, asientoAjusteId };
    
  } catch (error) {
    console.error(`❌ Error creando ajuste automático: ${error.message}`);
    return { success: false, error: error.message };
  }
}

function obtenerLineasContables(moveId, sesionId) {
  try {
    return hacerConsultaOdoo('account.move.line', 'search_read', [
      [["move_id", "=", moveId]]
    ], { fields: ["id", "name", "account_id", "debit", "credit", "balance", "reconciled"] }, sesionId);
  } catch (error) {
    console.error(`❌ Error en obtenerLineasContables: ${error.message}`);
    return [];
  }
}

// ========================================
// FUNCIÓN DE RESUMEN
// ========================================
function mostrarResumenAsientos(contadores) {
  const mensaje = `📦 RESUMEN DE PROCESAMIENTO DE ASIENTOS CONTABLES
  
  🔄 TOTALES:
  ✅🔗 Conciliados exitosamente: ${contadores.conciliados}
  ✅🔧 Con ajustes automáticos: ${contadores.conAjustes}
  ✔️ Ya pagados: ${contadores.yaPagados}
  ❌ No encontradas: ${contadores.noEncontradas}
  ❌ Errores: ${contadores.errores}`;

  console.log(mensaje);
  SpreadsheetApp.getUi().alert(mensaje);
}