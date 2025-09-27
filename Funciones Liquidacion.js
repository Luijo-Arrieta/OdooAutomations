// ========================================
// SISTEMA DE PAGOS PARA LIQUIDACIONES
// ========================================

const MENSAJES_LIQUIDACIONES = {
  PAGO_REGISTRADO: "✅ Pago de liquidación registrado y conciliado",
  PAGO_CREADO_NO_CONCILIADO: "✅ Pago creado, ❌ No se pudo conciliar",
  NO_ENCONTRADO: "❌ Asiento no encontrado en Odoo",
  YA_PAGADO: "✔️ Asiento ya pagado o en proceso",
  PARTNER_NO_ENCONTRADO: "❌ Proveedor no encontrado",
  PROVEEDOR_VACIO: "❌ Campo proveedor vacío",
  ERROR_REGISTRO: "❌ Error al registrar pago",
  ERROR_CONCILIACION: "❌ Error en conciliación",
  ERROR_PREFIJO: "❌ Prefijo de asiento inválido",
  DIARIO_NO_ENCONTRADO: "❌ Diario no encontrado",
  ERROR_EMPRESA: "❌ No se pudo identificar la empresa",
  ERROR_CUENTA_CAMBIO: "❌ Error al cambiar cuenta conciliable",
  PAGO_EXISTENTE_CONCILIADO: "✔️ Pago ya existe y está conciliado",
  PAGO_EXISTENTE_NO_CONCILIADO: "⚠️ Pago existente, no se pudo conciliar"
};

// ========================================
// FUNCIÓN PRINCIPAL
// ========================================
function procesarPagosLiquidaciones(nombreHoja, configuracion) {
  console.log(`-----🚀 INICIANDO PROCESAMIENTO DE LIQUIDACIONES EN: ${nombreHoja}-----`);

  const hoja = obtenerHoja(nombreHoja);
  if (!hoja) return;

  const sesionId = LibOdooUtils.odooGetSessionId("EZ");
  const fechaActual = obtenerFechaActual();
  const contadores = { conciliados: 0, yaPagados: 0, errores: 0, noConciliados: 0, noEncontradas: 0 };

  console.log("---📝 Procesando liquidaciones...");
  procesarLiquidacionesIndividuales(hoja, sesionId, fechaActual, contadores, configuracion);
  mostrarResumenLiquidaciones(contadores);
  console.log("✅ PROCESAMIENTO DE LIQUIDACIONES COMPLETADO");
}

// ========================================
// PROCESAMIENTO DE LIQUIDACIONES
// ========================================

function procesarLiquidacionesIndividuales(hoja, sesionId, fecha, contadores, configuracion) {
  const ultimaFila = hoja.getLastRow();
  const datos = hoja.getRange(configuracion.FILA_INICIO, 1, ultimaFila - configuracion.FILA_INICIO + 1, 20).getValues();

  const liquidacionesIndividuales = datos
    .map((fila, indice) => ({ fila, numeroFila: indice + configuracion.FILA_INICIO }))
    .filter(item => {
      const valorAsiento = item.fila[configuracion.COLUMNAS.FACTURA];
      const valorCheckbox = item.fila[configuracion.COLUMNAS.CHECKBOX];
      const valorProveedor = item.fila[configuracion.COLUMNAS.PROVEEDOR];

      // Validar que todos los campos críticos estén presentes
      const tieneAsiento = typeof valorAsiento === "string" && valorAsiento.trim() !== '';
      const tieneCheckbox = valorCheckbox === true;
      const tieneProveedor = valorProveedor && valorProveedor.toString().trim() !== '';
      const tienePrefijo = configuracion.PREFIJOS_VALIDOS_C.some(prefijo => valorAsiento.startsWith(prefijo));

      // Marcar error si falta proveedor pero cumple otros criterios
      if (tieneCheckbox && tieneAsiento && tienePrefijo && !tieneProveedor) {
        console.warn(`⚠️ Fila ${item.numeroFila}: Liquidación '${valorAsiento}' marcada pero sin proveedor`);
        establecerMensajeEnCelda(hoja, item.numeroFila, MENSAJES_LIQUIDACIONES.PARTNER_NO_ENCONTRADO + ": Campo vacío", fecha, configuracion);
        contadores.errores++;
        return false;
      }

      return tieneAsiento && tieneCheckbox && tieneProveedor && tienePrefijo;
    });

  console.log(`📝 Encontradas ${liquidacionesIndividuales.length} liquidaciones válidas para procesar`);
  if (liquidacionesIndividuales.length === 0) {
    console.log("ℹ️ No hay liquidaciones pendientes de procesar (verificar que tengan proveedor)");
    return;
  }

  liquidacionesIndividuales.forEach((item, indice) => {
    console.log(`🔄 Procesando liquidación ${indice + 1}/${liquidacionesIndividuales.length}`);
    procesarLiquidacionIndividual(item, hoja, sesionId, fecha, contadores, configuracion);
  });
}

function procesarLiquidacionIndividual(item, hoja, sesionId, fecha, contadores, configuracion) {
  const { fila, numeroFila } = item;
  const [nombreAsiento, montoHoja, comunicacion, diarioSeleccionado, nombreProveedor] = [
    fila[configuracion.COLUMNAS.FACTURA],
    fila[configuracion.COLUMNAS.MONTO],
    fila[configuracion.COLUMNAS.COMUNICACION],
    fila[configuracion.COLUMNAS.DIARIO],
    fila[configuracion.COLUMNAS.PROVEEDOR]
  ];

  console.log(`🔍 Procesando liquidación: ${nombreAsiento} - Proveedor: ${nombreProveedor} - Monto: ${montoHoja.toLocaleString('es-CO')}`);

  try {
    // ========================================
    // VALIDACIÓN CRÍTICA #1: PROVEEDOR NO VACÍO
    // ========================================
    if (!nombreProveedor || nombreProveedor.toString().trim() === '') {
      console.error(`❌ Campo proveedor vacío para liquidación: ${nombreAsiento}`);
      return establecerMensajeYContador(hoja, numeroFila, MENSAJES_LIQUIDACIONES.PARTNER_NO_ENCONTRADO + ": Campo vacío", fecha, configuracion, contadores, 'errores');
    }

    // ========================================
    // VALIDACIÓN CRÍTICA #2: EMPRESA VÁLIDA
    // ========================================
    const empresa = identificarEmpresa(hoja, numeroFila, configuracion);
    if (!empresa) {
      return establecerMensajeYContador(hoja, numeroFila, MENSAJES_LIQUIDACIONES.ERROR_EMPRESA, fecha, configuracion, contadores, 'errores');
    }

    // ========================================
    // VALIDACIÓN CRÍTICA #3: PROVEEDOR EXISTE EN ODOO
    // ========================================
    const partnerId = buscarProveedorPorNombre(nombreProveedor.toString().trim(), sesionId, empresa.ID);
    if (!partnerId) {
      console.error(`❌ Proveedor '${nombreProveedor}' no encontrado en Odoo para liquidación: ${nombreAsiento}`);
      return establecerMensajeYContador(hoja, numeroFila, `${MENSAJES_LIQUIDACIONES.PARTNER_NO_ENCONTRADO}: ${nombreProveedor}`, fecha, configuracion, contadores, 'errores');
    }

    // Validar diario
    const validacionDiario = validarDiarioYMetodo(diarioSeleccionado, sesionId, empresa.ID);
    if (!validacionDiario.valido) {
      const mensajeError = validacionDiario.error === 'DIARIO_NO_ENCONTRADO'
        ? `${MENSAJES_LIQUIDACIONES.DIARIO_NO_ENCONTRADO}: ${validacionDiario.diarioNombre}`
        : MENSAJES_LIQUIDACIONES.ERROR_REGISTRO;
      return establecerMensajeYContador(hoja, numeroFila, mensajeError, fecha, configuracion, contadores, 'errores');
    }

    // ========================================
    // VERIFICAR PAGO EXISTENTE EN EL ÚLTIMO MES
    // ========================================
    const pagoExistente = verificarPagoExistente(partnerId, montoHoja, comunicacion || nombreAsiento, sesionId, empresa.ID);

    if (pagoExistente) {
      if (pagoExistente.estaConciliado) {
        return establecerMensajeYContador(hoja, numeroFila, MENSAJES_LIQUIDACIONES.PAGO_EXISTENTE_CONCILIADO, fecha, configuracion, contadores, 'yaPagados');
      } else {
        // Buscar asiento con monto para conciliar
        const resultadoBusqueda = buscarAsientoPorProveedorYCuenta(partnerId, montoHoja, sesionId, empresa.ID);

        if (!resultadoBusqueda) {
          // No se pudo conciliar
          return establecerMensajeYContador(
            hoja,
            numeroFila,
            MENSAJES_LIQUIDACIONES.PAGO_EXISTENTE_NO_CONCILIADO,
            fecha,
            configuracion,
            contadores,
            'noConciliados'
          );
        }

        // Intentar conciliación con línea encontrada
        const lineaCoincidente = resultadoBusqueda.lineaCoincidente;
        const resultadoConciliacion = conciliarPagoConLineaEspecifica(pagoExistente.id, lineaCoincidente.id, sesionId, empresa.ID);

        if (resultadoConciliacion.success) {
          return establecerMensajeYContador(hoja, numeroFila, MENSAJES_LIQUIDACIONES.PAGO_REGISTRADO, fecha, configuracion, contadores, 'conciliados');
        } else {
          return establecerMensajeYContador(
            hoja,
            numeroFila,
            MENSAJES_LIQUIDACIONES.PAGO_EXISTENTE_NO_CONCILIADO,
            fecha,
            configuracion,
            contadores,
            'noConciliados'
          );
        }
      }
    }


    // ========================================
    // NUEVO FLUJO: CREAR PAGO PRIMERO
    // ========================================
    const resultadoPago = registrarPagoLiquidacion(partnerId, montoHoja, comunicacion, sesionId, configuracion, empresa.ID, diarioSeleccionado, validacionDiario, nombreAsiento);
    if (!resultadoPago.success) {
      return establecerMensajeYContador(hoja, numeroFila, MENSAJES_LIQUIDACIONES.ERROR_REGISTRO, fecha, configuracion, contadores, 'errores');
    }

    console.log(`✅ Pago creado exitosamente: ${resultadoPago.nombrePago} (ID: ${resultadoPago.pagoId})`);

    // ========================================
    // BUSCAR ASIENTO PARA CONCILIAR
    // ========================================
    const resultadoBusqueda = buscarAsientoPorProveedorYCuenta(partnerId, montoHoja, sesionId, empresa.ID);

    if (!resultadoBusqueda) {
      // No se encontró asiento para conciliar
      const mensajeNoConciliado = `⚠️ Pago creado ${resultadoPago.nombrePago}, ❌ No se pudo conciliar`;
      return establecerMensajeYContador(hoja, numeroFila, mensajeNoConciliado, fecha, configuracion, contadores, 'noConciliados');
    }

    const lineaCoincidente = resultadoBusqueda.lineaCoincidente;

    // ========================================
    // INTENTAR CONCILIACIÓN
    // ========================================
    const resultadoConciliacion = conciliarPagoConLineaEspecifica(resultadoPago.pagoId, lineaCoincidente.id, sesionId, empresa.ID);

    let mensaje = "";
    let contador = "";

    if (resultadoConciliacion.success) {
      mensaje = MENSAJES_LIQUIDACIONES.PAGO_REGISTRADO;
      contador = 'conciliados';
    } else {
      mensaje = `✅ Pago creado ${resultadoPago.nombrePago}, ❌ No se pudo conciliar`;
      contador = 'noConciliados';
    }

    if (resultadoPago.usandoDefault) {
      mensaje += ` // Default por ${resultadoPago.motivoDefault}`;
    }

    establecerMensajeYContador(hoja, numeroFila, mensaje, fecha, configuracion, contadores, contador);

  } catch (error) {
    establecerMensajeYContador(hoja, numeroFila, `❌ Error: ${error.message}`, fecha, configuracion, contadores, 'errores');
    console.error(`❌ Error procesando liquidación ${nombreAsiento}: ${error.message}`);
  }
}


// ========================================
// FUNCIÓN: VERIFICAR PAGO EXISTENTE
// ========================================
function verificarPagoExistente(partnerId, monto, referencia, sesionId, empresaId) {
  console.log(`🔍 Verificando si existe pago para proveedor ${partnerId}, monto: ${monto.toLocaleString('es-CO')}`);

  try {
    // Calcular fecha de hace un mes
    const fechaActual = new Date();
    const fechaUnMesAtras = new Date(fechaActual.getFullYear(), fechaActual.getMonth() - 1, fechaActual.getDate());
    const fechaFiltro = fechaUnMesAtras.toISOString().split('T')[0];

    console.log(`📅 Buscando pagos desde: ${fechaFiltro}`);

    // Buscar pagos con características similares en el último mes
    const pagos = hacerConsultaOdoo('account.payment', 'search_read', [
      [
        ["partner_id", "=", partnerId],
        ["amount", "=", Math.abs(monto)],
        ["payment_type", "=", "outbound"],
        ["partner_type", "=", "supplier"],
        ["company_id", "=", empresaId],
        ["date", ">=", fechaFiltro],
        ["state", "in", ["posted", "reconciled"]] // Solo pagos confirmados
      ]
    ], {
      fields: ["id", "name", "ref", "date", "amount", "state", "move_id"],
      order: "date desc, id desc",
      limit: 5
    }, sesionId);

    if (!pagos.length) {
      console.log(`✅ No se encontraron pagos existentes similares`);
      return null;
    }

    console.log(`📋 Encontrados ${pagos.length} pagos similares en el último mes`);

    // Verificar si alguno coincide con la referencia o es muy similar
    const pagoCoincidente = pagos.find(pago => {
      const refPago = (pago.ref || '').toLowerCase();
      const refBuscada = (referencia || '').toLowerCase();

      // Coincidencia exacta en referencia o nombre similar
      return refPago.includes(refBuscada) || refBuscada.includes(refPago);
    });

    if (!pagoCoincidente) {
      console.log(`⚠️ Pagos encontrados pero sin coincidencia en referencias`);
      return null;
    }

    console.log(`🎯 Pago coincidente encontrado: ${pagoCoincidente.name} (${pagoCoincidente.date})`);

    // Verificar si el pago está conciliado
    const estaConciliado = verificarSiPagoEstaConciliado(pagoCoincidente.id, sesionId, empresaId);

    return {
      id: pagoCoincidente.id,
      nombre: pagoCoincidente.name,
      fecha: pagoCoincidente.date,
      estaConciliado: estaConciliado
    };

  } catch (error) {
    console.error(`❌ Error verificando pago existente: ${error.message}`);
    return null;
  }
}

// ========================================
// FUNCIÓN: VERIFICAR SI PAGO ESTÁ CONCILIADO
// ========================================
function verificarSiPagoEstaConciliado(pagoId, sesionId, empresaId) {
  console.log(`🔍 Verificando estado de conciliación del pago: ${pagoId}`);

  try {
    // Obtener move_id del pago
    const pago = hacerConsultaOdoo('account.payment', 'read', [[pagoId], ["move_id", "is_reconciled"]], {}, sesionId);

    if (!pago.length || !pago[0].move_id?.length) {
      console.warn(`⚠️ No se pudo obtener move_id del pago ${pagoId}`);
      return false;
    }

    // Si Odoo tiene el campo is_reconciled disponible, usarlo
    if (pago[0].hasOwnProperty('is_reconciled')) {
      return pago[0].is_reconciled;
    }

    const movePagoId = pago[0].move_id[0];

    // Obtener líneas del pago en la cuenta de liquidaciones para verificar conciliación
    const lineasPago = obtenerLineasLiquidacion(movePagoId, sesionId, empresaId);

    if (!lineasPago.length) {
      console.warn(`⚠️ No se encontraron líneas del pago en cuenta ${CUENTAS_AJUSTE.CUENTA_LIQUIDACIONES}`);
      return false;
    }

    // Si todas las líneas relevantes están conciliadas, el pago está conciliado
    const todasConciliadas = lineasPago.every(linea => linea.reconciled);

    console.log(`📊 Estado conciliación pago ${pagoId}: ${todasConciliadas ? 'CONCILIADO' : 'NO CONCILIADO'}`);
    return todasConciliadas;

  } catch (error) {
    console.error(`❌ Error verificando conciliación del pago ${pagoId}: ${error.message}`);
    return false;
  }
}

// ========================================
// FUNCIÓN AUXILIAR: OBTENER LÍNEAS DE LIQUIDACIÓN
// ========================================
function obtenerLineasLiquidacion(moveId, sesionId, empresaId) {
  try {
    // Buscar la cuenta de liquidaciones
    const cuenta = hacerConsultaOdoo('account.account', 'search_read', [
      [["code", "=", CUENTAS_AJUSTE.CUENTA_LIQUIDACIONES], ["company_id", "=", empresaId]]
    ], { fields: ["id"], limit: 1 }, sesionId);

    if (!cuenta.length) {
      console.error(`❌ No se encontró la cuenta ${CUENTAS_AJUSTE.CUENTA_LIQUIDACIONES}`);
      return [];
    }

    const cuentaId = cuenta[0].id;

    // Obtener líneas del move en la cuenta de liquidaciones
    const lineas = hacerConsultaOdoo('account.move.line', 'search_read', [
      [
        ["move_id", "=", moveId],
        ["account_id", "=", cuentaId],
        ["company_id", "=", empresaId]
      ]
    ], { fields: ["id", "name", "debit", "credit", "balance", "reconciled"] }, sesionId);

    return lineas;

  } catch (error) {
    console.error(`❌ Error obteniendo líneas de liquidación: ${error.message}`);
    return [];
  }
}

// ========================================
// FUNCIÓN DE PAGO ESPECÍFICA PARA LIQUIDACIONES
// ========================================
function registrarPagoLiquidacion(partnerId, monto, comunicacion, sesionId, configuracion, empresaId, diarioSeleccionado, validacionDiario, nombreAsiento) {
  try {
    // Determinar configuración de diario y método de pago
    let diarioId, metodoPagoId, usandoDefault = false, motivoDefault = '';

    if (validacionDiario) {
      // CASO ESPECIAL: EMPRESA ID = 1
      if (validacionDiario.empresaEspecial && empresaId === 1) {
        console.log(`🏢 Procesando liquidación para empresa ID=1 con lógica especial`);
        
        if (validacionDiario.usarDefault) {
          usandoDefault = true;
          motivoDefault = validacionDiario.motivo;
          
          // Usar configuración predeterminada para empresa ID=1
          const empresa = Object.values(configuracion.EMPRESAS).find(emp => emp.ID === empresaId);
          if (empresa && empresa.DIARIO_ID_B && empresa.METODO_PAGO_ID_B) {
            diarioId = empresa.DIARIO_ID_B;
            metodoPagoId = empresa.METODO_PAGO_ID_B;
          } else {
            throw new Error(`No se encontró configuración predeterminada de liquidación para empresa ID: ${empresaId}`);
          }
        } else {
          // Para empresa ID=1: usar diario predeterminado de liquidación + método de pago de la columna
          const empresa = Object.values(configuracion.EMPRESAS).find(emp => emp.ID === empresaId);
          if (!empresa || !empresa.DIARIO_ID_B) {
            throw new Error(`No se encontró diario predeterminado de liquidación para empresa ID: ${empresaId}`);
          }
          
          diarioId = empresa.DIARIO_ID_B; // Diario predeterminado de liquidación
          metodoPagoId = validacionDiario.metodoPagoId; // Método de la columna
          usandoDefault = false;
          
          console.log(`✅ Empresa ID=1 Liquidación: Diario predeterminado (ID: ${diarioId}) + Método de columna (ID: ${metodoPagoId})`);
        }
      }
      // LÓGICA ORIGINAL PARA OTRAS EMPRESAS
      else if (validacionDiario.usarDefault) {
        usandoDefault = true;
        motivoDefault = validacionDiario.motivo;

        const empresa = Object.values(configuracion.EMPRESAS).find(emp => emp.ID === empresaId) || Object.values(configuracion.EMPRESAS)[0];
        const config = Object.keys(configuracion.EMPRESAS).length > 1 ? empresa : empresa;
        diarioId = Object.keys(configuracion.EMPRESAS).length > 1 ? config.DIARIO_ID_B : config.DIARIO_ID_B;
        metodoPagoId = Object.keys(configuracion.EMPRESAS).length > 1 ? config.METODO_PAGO_ID_B : config.METODO_PAGO_ID_B;
      } else {
        diarioId = validacionDiario.diarioId;
        metodoPagoId = validacionDiario.metodoPagoId;
      }
    } else {
      // Fallback a lógica original si no hay validación
      usandoDefault = true;
      const empresa = Object.values(configuracion.EMPRESAS).find(emp => emp.ID === empresaId) || Object.values(configuracion.EMPRESAS)[0];
      const config = Object.keys(configuracion.EMPRESAS).length > 1 ? empresa : empresa;
      diarioId = Object.keys(configuracion.EMPRESAS).length > 1 ? config.DIARIO_ID_B : config.DIARIO_ID_B;
      metodoPagoId = Object.keys(configuracion.EMPRESAS).length > 1 ? config.METODO_PAGO_ID_B : config.METODO_PAGO_ID_B;
    }

    console.log(`💰 Creando pago para liquidación - Partner: ${partnerId}, Monto: ${monto.toLocaleString('es-CO')}`);

    // Buscar la cuenta de liquidaciones para usar como destino
    const cuentaLiquidacion = hacerConsultaOdoo('account.account', 'search_read', [
      [["code", "=", CUENTAS_AJUSTE.CUENTA_LIQUIDACIONES], ["company_id", "=", empresaId]]
    ], { fields: ["id", "name"], limit: 1 }, sesionId);

    let cuentaPago = null;
    if (cuentaLiquidacion.length > 0) {
      cuentaPago = cuentaLiquidacion[0].id;
      console.log(`🏦 Usando cuenta de liquidaciones: ${CUENTAS_AJUSTE.CUENTA_LIQUIDACIONES} (ID: ${cuentaPago})`);
    }

    // Obtener nombre del proveedor para la referencia
    const proveedorInfo = hacerConsultaOdoo('res.partner', 'read', [[partnerId], ["name"]], {}, sesionId);
    const nombreProveedorCompleto = proveedorInfo.length > 0 ? proveedorInfo[0].name : 'Proveedor';

    // Formatear fecha actual
    const fechaActual = new Date();
    const fechaFormateada = fechaActual.toLocaleDateString('es-CO', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });

    // Crear objeto de pago
    const pagoData = {
      payment_type: "outbound",
      partner_type: "supplier",
      partner_id: partnerId,
      amount: Math.abs(monto),
      journal_id: diarioId,
      payment_method_line_id: metodoPagoId,
      date: new Date().toISOString().split("T")[0],
      ref: comunicacion || `Liquidación - ${nombreProveedorCompleto} - ${fechaFormateada}`,
      company_id: empresaId
    };

    // Agregar cuenta de destino si se encontró
    if (cuentaPago) {
      pagoData.destination_account_id = cuentaPago;
    }

    // Crear pago
    const pagoId = hacerConsultaOdoo('account.payment', 'create', [pagoData], {}, sesionId);
    console.log(`✅ Pago creado con ID: ${pagoId}`);

    // Confirmar el pago
    try {
      hacerConsultaOdoo('account.payment', 'action_post', [[pagoId]], {}, sesionId);
      console.log(`✅ Pago confirmado exitosamente`);
    } catch (error) {
      console.warn(`⚠️ Advertencia al confirmar pago: ${error.message}`);
    }

    // Obtener el nombre/número del pago creado
    const pagoInfo = hacerConsultaOdoo('account.payment', 'read', [[pagoId], ["name"]], {}, sesionId);
    const nombrePago = pagoInfo.length > 0 ? pagoInfo[0].name : `#${pagoId}`;

    return {
      success: true,
      usandoDefault,
      motivoDefault,
      pagoId,
      nombrePago
    };

  } catch (error) {
    console.error(`❌ Error en registro de pago para liquidación: ${error.message}`);
    return { success: false, error: error.message };
  }
}

// ========================================
// CONCILIACIÓN ESPECÍFICA PARA LIQUIDACIONES (MONTO EXACTO)
// ========================================
function conciliarPagoConLineaEspecifica(pagoId, lineaAsientoId, sesionId, empresaId) {
  console.log(`🔗 Conciliando pago ${pagoId} con línea específica ${lineaAsientoId}`);

  try {
    // Obtener move_id del pago
    const pago = hacerConsultaOdoo('account.payment', 'read', [[pagoId], ["name", "move_id"]], {}, sesionId);
    if (!pago.length || !pago[0].move_id?.length) {
      return { success: false, error: "NO_MOVE_PAGO" };
    }

    const movePagoId = pago[0].move_id[0];

    // Obtener líneas del pago en la cuenta de liquidaciones
    const lineasPago = obtenerLineasLiquidacion(movePagoId, sesionId, empresaId);

    if (!lineasPago.length) {
      console.warn(`⚠️ No se encontraron líneas del pago en cuenta ${CUENTAS_AJUSTE.CUENTA_LIQUIDACIONES}`);
      return { success: false, error: "NO_LINEAS_PAGO" };
    }

    // Buscar la línea del pago que pueda conciliar con la línea del asiento
    const lineaPagoParaConciliar = lineasPago.find(linea => !linea.reconciled);

    if (!lineaPagoParaConciliar) {
      console.warn(`⚠️ No se encontró línea no conciliada del pago`);
      return { success: false, error: "PAGO_YA_CONCILIADO" };
    }

    // Verificar que los balances se anulen (conciliación válida)
    const lineaAsiento = hacerConsultaOdoo('account.move.line', 'read', [[lineaAsientoId], ["balance", "reconciled"]], {}, sesionId);

    if (!lineaAsiento.length || lineaAsiento[0].reconciled) {
      console.warn(`⚠️ Línea del asiento no disponible para conciliación`);
      return { success: false, error: "LINEA_ASIENTO_NO_DISPONIBLE" };
    }

    const sumaBalances = parseFloat(lineaPagoParaConciliar.balance) + parseFloat(lineaAsiento[0].balance);

    if (Math.abs(sumaBalances) > 0.01) {
      console.warn(`⚠️ Los balances no se anulan: Pago: ${lineaPagoParaConciliar.balance}, Asiento: ${lineaAsiento[0].balance}, Suma: ${sumaBalances}`);
      return { success: false, error: "BALANCES_NO_COINCIDEN" };
    }

    // Ejecutar conciliación
    const idsLineas = [lineaPagoParaConciliar.id, lineaAsientoId];
    hacerConsultaOdoo('account.move.line', 'reconcile', [idsLineas], {}, sesionId);

    console.log(`✅ Conciliación exitosa entre líneas ${idsLineas.join(' y ')}`);
    return { success: true, conciliadas: 1 };

  } catch (error) {
    console.error(`❌ Error en conciliación directa: ${error.message}`);
    return { success: false, error: error.message };
  }
}

// ========================================
// VERIFICACIÓN DE CONCILIACIÓN PARA LIQUIDACIONES
// ========================================
function buscarAsientoPorProveedorYCuenta(partnerId, montoObjetivo, sesionId, empresaId) {
  console.log(`🔍 Buscando último asiento para proveedor ID: ${partnerId}, monto: ${montoObjetivo}, cuenta: ${CUENTAS_AJUSTE.CUENTA_LIQUIDACIONES}`);

  try {
    // Primero buscar la cuenta de liquidaciones
    const cuenta = hacerConsultaOdoo('account.account', 'search_read', [
      [["code", "=", CUENTAS_AJUSTE.CUENTA_LIQUIDACIONES], ["company_id", "=", empresaId]]
    ], { fields: ["id", "name"], limit: 1 }, sesionId);

    if (!cuenta.length) {
      console.error(`❌ No se encontró la cuenta ${CUENTAS_AJUSTE.CUENTA_LIQUIDACIONES} en la empresa ${empresaId}`);
      return null;
    }

    const cuentaId = cuenta[0].id;
    console.log(`📋 Cuenta encontrada: ${cuenta[0].name} (ID: ${cuentaId})`);

    // Buscar líneas de cuenta que coincidan con proveedor, cuenta y monto
    const lineasCuenta = hacerConsultaOdoo('account.move.line', 'search_read', [
      [
        ["partner_id", "=", partnerId],
        ["account_id", "=", cuentaId],
        ["company_id", "=", empresaId],
        ["reconciled", "=", false] // Solo líneas no conciliadas
      ]
    ], {
      fields: ["id", "move_id", "name", "debit", "credit", "balance", "date", "reconciled"],
      order: "date desc, id desc" // Ordenar por fecha descendente para obtener el más reciente
    }, sesionId);

    if (!lineasCuenta.length) {
      console.warn(`⚠️ No se encontraron líneas no conciliadas para proveedor ${partnerId} en cuenta ${CUENTAS_AJUSTE.CUENTA_LIQUIDACIONES}`);
      return null;
    }

    console.log(`📋 Encontradas ${lineasCuenta.length} líneas de cuenta para el proveedor`);

    // Filtrar todas las líneas con el mismo monto (±0.01)
    const montoObjetivoAbs = Math.abs(montoObjetivo);
    const lineasConMontoCoincidente = lineasCuenta.filter(linea => {
      const montoLinea = Math.abs(linea.balance);
      return Math.abs(montoLinea - montoObjetivoAbs) < 0.01;
    });

    if (!lineasConMontoCoincidente.length) {
      console.warn(`⚠️ No se encontró ninguna línea con monto coincidente. Monto buscado: ${montoObjetivo.toLocaleString('es-CO')}`);
      return null;
    }

    console.log(`🔍 Filtradas ${lineasConMontoCoincidente.length} líneas con monto coincidente, buscando la más reciente con prefijo 'SLR'`);

    // Ordenar las líneas por fecha descendente
    lineasConMontoCoincidente.sort((a, b) => new Date(b.date) - new Date(a.date));

    // Buscar la primera línea cuyo asiento tenga prefijo 'SLR'
    for (const linea of lineasConMontoCoincidente) {
      const moveId = linea.move_id[0];
      const asiento = hacerConsultaOdoo('account.move', 'search_read', [
        [["id", "=", moveId]]
      ], { fields: ["id", "name", "company_id", "amount_total_signed", "state", "partner_id", "date"] }, sesionId);

      if (!asiento.length) {
        console.warn(`⚠️ No se pudo obtener información del asiento ID: ${moveId}`);
        continue;
      }

      if (asiento[0].name.startsWith("SLR")) {
        console.log(`✅ Asiento válido encontrado: ${asiento[0].name} (ID: ${moveId}) - Fecha: ${asiento[0].date}`);
        return {
          asiento: asiento[0],
          lineaCoincidente: linea
        };
      } else {
        console.warn(`⏩ Asiento (${asiento[0].name}) no tiene prefijo 'SLR', se descarta`);
      }
    }

    console.warn(`❌ No se encontró ninguna línea con monto coincidente y asiento con prefijo 'SLR'`);
    return null;

  } catch (error) {
    console.error(`❌ Error buscando asiento por proveedor y cuenta: ${error.message}`);
    return null;
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

// ========================================
// FUNCIÓN DE RESUMEN
// ========================================
function mostrarResumenLiquidaciones(contadores) {
  const mensaje = `📦 RESUMEN DE PROCESAMIENTO DE LIQUIDACIONES
  
  🔄 TOTALES:
  ✅🔗 Conciliados exitosamente: ${contadores.conciliados}
  ⚠️🔧 Pagado sin conciliar: ${contadores.noConciliados}
  ✔️ Ya pagados: ${contadores.yaPagados}
  ❌ No encontradas: ${contadores.noEncontradas}
  ❌ Errores: ${contadores.errores}`;

  console.log(mensaje);
  SpreadsheetApp.getUi().alert(mensaje);
}