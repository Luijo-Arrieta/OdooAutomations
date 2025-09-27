// ========================================
// MENSAJES DEL SISTEMA
// ========================================
const MENSAJES = {
  PAGO_REGISTRADO: "✅ Pago registrado",
  PAGO_AGRUPADO: "✅ [AGRUPADO] Pago registrado",
  PAGO_REGISTRADO_AJUSTE_MAYOR: "✅ Pago registrado - Ajuste al peso 42958105",
  PAGO_REGISTRADO_AJUSTE_MENOR: "✅ Pago registrado - Ajuste al peso 53958105",
  PAGO_AGRUPADO_AJUSTE_MAYOR: "✅ [AGRUPADO] Pago registrado - Ajuste al peso 42958105",
  PAGO_AGRUPADO_AJUSTE_MENOR: "✅ [AGRUPADO] Pago registrado - Ajuste al peso 53958105",
  YA_PAGADA: "✔️ Ya pagada o en proceso",
  YA_PAGADA_AGRUPADO: "✔️ [AGRUPADO] Ya pagada o en proceso",
  PAGO_PARCIAL_AGRUPADO: "⚠️ [AGRUPADO] Pago aplicado parcialmente - Solo algunas facturas fueron pagadas",
  NO_ENCONTRADA: "❌ No encontrada en Odoo",
  NO_ENCONTRADA_AGRUPADO: "❌ [AGRUPADO] No encontrada en Odoo",
  MONTO_EXCEDIDO: "⚠️ Monto mayor al saldo",
  MONTO_EXCEDIDO_AGRUPADO: "⚠️ [AGRUPADO] Monto mayor a suma de saldos",
  ERROR_REGISTRO: "❌ Error al registrar pago",
  ERROR_REGISTRO_AGRUPADO: "❌ [AGRUPADO] Error al registrar pago",
  ERROR_CHECKBOXES: "❌ [AGRUPADO] No todas las casillas marcadas",
  ERROR_PROVEEDORES: "❌ [AGRUPADO] Proveedores distintos en grupo",
  ERROR_PREFIJOS: "❌ [AGRUPADO] Prefijos de factura inválidos",
  ERROR_PREFIJO: "❌ Prefijo de factura inválido",
  DIARIO_NO_ENCONTRADO: "❌ Diario no encontrado",
  DIARIO_NO_ENCONTRADO_AGRUPADO: "❌ [AGRUPADO] Diario no encontrado",
  METODO_NO_DISPONIBLE: "❌ Método no disponible",
  METODO_NO_DISPONIBLE_AGRUPADO: "❌ [AGRUPADO] Método no disponible",
  ERROR_EMPRESA: "❌ No se pudo identificar la empresa"
};

// ========================================
// FUNCIÓN PRINCIPAL GENÉRICA
// ========================================
function procesarPagosProveedores(nombreHoja, configuracion) {
  console.log(`-----🚀 INICIANDO PROCESAMIENTO EN: ${nombreHoja}-----`);
  console.log(`-🏢Configuración: ${JSON.stringify(configuracion.NOMBRE || 'Sin nombre')}`);

  const hoja = obtenerHoja(nombreHoja);
  if (!hoja) return;

  let sesionId = LibOdooUtils.odooGetSessionId("EZ");
  const fechaActual = obtenerFechaActual();

  // Inicializar contadores
  const contadores = inicializarContadores();
  const filasProcessadas = new Set();

  console.log("---📊 Procesando pagos agrupados...");
  procesarPagosAgrupados(hoja, sesionId, fechaActual, contadores, filasProcessadas, configuracion);

  console.log("---📝 Procesando pagos individuales...");
  procesarPagosIndividuales(hoja, sesionId, fechaActual, contadores, filasProcessadas, configuracion);

  mostrarResumenFinal(contadores);
  console.log("✅ PROCESAMIENTO COMPLETADO");
}

function inicializarContadores() {
  return {
    completadas: 0,
    yaRegistradas: 0,
    noEncontradas: 0,
    montosExcedidos: 0,
    errores: 0,
    gruposCompletados: 0,
    individualesCompletadas: 0
  };
}


// ========================================
// FUNCIONES PARA VERIFICAR PAGOS - CASOS ESPECIFICOS
// ========================================
function verificarMontoContraPagosRealizados(montoHoja, pagosRealizados, tolerancia = 0.01) {
  if (!pagosRealizados || pagosRealizados.length === 0) {
    return { coincide: false, pago: null };
  }

  for (const pago of pagosRealizados) {
    const diferencia = Math.abs(montoHoja - pago.amount);
    if (diferencia <= tolerancia) {
      return { 
        coincide: true, 
        pago: pago,
        diferencia: diferencia
      };
    }
  }

  return { coincide: false, pago: null };
}

function verificarPagoCompletoGrupo(facturasOdoo, sesionId, empresaId) {
  const facturasSinPagar = [];
  
  for (const factura of facturasOdoo) {
    // Re-consultar el estado actual de cada factura
    const facturaActualizada = buscarFacturaEnOdoo(factura.name, sesionId, empresaId);
    
    if (facturaActualizada && 
        facturaActualizada.payment_state !== "paid" && 
        facturaActualizada.payment_state !== "in_payment") {
      facturasSinPagar.push({
        nombre: factura.name,
        saldoRestante: Math.abs(facturaActualizada.amount_residual_signed)
      });
    }
  }
  
  return {
    todasPagadas: facturasSinPagar.length === 0,
    facturasSinPagar: facturasSinPagar,
    cantidadSinPagar: facturasSinPagar.length
  };
}

// ========================================
// PROCESAMIENTO DE PAGOS AGRUPADOS
// ========================================
function procesarPagosAgrupados(hoja, sesionId, fecha, contadores, filasProcessadas, configuracion) {
  // Obtener rangos combinados en la columna de MONTO
  const columnaMontoLetra = String.fromCharCode(65 + configuracion.COLUMNAS.MONTO);
  const rangosAgrupados = hoja.getRange(`${columnaMontoLetra}:${columnaMontoLetra}`).getMergedRanges();

  console.log(`📋 Encontrados ${rangosAgrupados.length} grupos para procesar`);

  rangosAgrupados.forEach((rango, indice) => {
    console.log(`🔄 Procesando grupo ${indice + 1}/${rangosAgrupados.length}`);

    const grupoInfo = extraerInformacionGrupo(hoja, rango, configuracion);
    registrarFilasProcessadas(filasProcessadas, grupoInfo.filaInicio, grupoInfo.numeroFilas);

    if (!validarGrupo(grupoInfo, hoja, fecha, configuracion, contadores)) {
      return;
    }

    procesarFacturasDelGrupo(grupoInfo, hoja, sesionId, fecha, contadores, configuracion);
  });
}

function extraerInformacionGrupo(hoja, rango, configuracion) {
  const filaInicio = rango.getRow();
  const numeroFilas = rango.getNumRows();

  return {
    filaInicio,
    numeroFilas,
    montoTotal: hoja.getRange(filaInicio, configuracion.COLUMNAS.MONTO + 1).getValue(),
    checkboxes: hoja.getRange(filaInicio, configuracion.COLUMNAS.CHECKBOX + 1, numeroFilas).getValues(),
    proveedores: hoja.getRange(filaInicio, configuracion.COLUMNAS.PROVEEDOR + 1, numeroFilas).getValues(),
    facturas: hoja.getRange(filaInicio, configuracion.COLUMNAS.FACTURA + 1, numeroFilas).getValues(),
    comunicaciones: hoja.getRange(filaInicio, configuracion.COLUMNAS.COMUNICACION + 1, numeroFilas).getValues(),
    rangoMensajes: hoja.getRange(filaInicio, configuracion.COLUMNAS.MENSAJES + 1, numeroFilas),
    empresas: configuracion.COLUMNA_EMPRESA !== undefined ?
      hoja.getRange(filaInicio, configuracion.COLUMNA_EMPRESA + 1, numeroFilas).getValues() : null,
    // NUEVA LÍNEA: Obtener el diario seleccionado para el grupo
    diarioSeleccionado: hoja.getRange(filaInicio, configuracion.COLUMNAS.DIARIO + 1).getValue()
  };
}

function registrarFilasProcessadas(filasProcessadas, filaInicio, numeroFilas) {
  for (let i = filaInicio; i < filaInicio + numeroFilas; i++) {
    filasProcessadas.add(i);
  }
}

function validarGrupo(grupoInfo, hoja, fecha, configuracion, contadores) {
  const algunoMarcado = grupoInfo.checkboxes.some(fila => fila[0] === true);
  if (!algunoMarcado) return false;

  const todosMarcados = grupoInfo.checkboxes.every(fila => fila[0] === true);
  if (!todosMarcados) {
    establecerMensajeTodoElGrupo(grupoInfo, MENSAJES.ERROR_CHECKBOXES, fecha);
    contadores.errores++;
    console.warn("❌ Grupo inválido: No todas las casillas están marcadas");
    return false;
  }

  // Validar que los proveedores no estén vacíos y sean iguales
  const primerProveedor = grupoInfo.proveedores[0][0];
  if (!primerProveedor || primerProveedor.toString().trim() === '') {
    establecerMensajeTodoElGrupo(grupoInfo, MENSAJES.ERROR_PROVEEDORES, fecha);
    contadores.errores++;
    console.warn("❌ Grupo inválido: Proveedor vacío");
    return false;
  }

  const mismoProveedor = grupoInfo.proveedores.every(fila => {
    const proveedor = fila[0];
    return proveedor && proveedor.toString().trim() !== '' && proveedor === primerProveedor;
  });
  
  if (!mismoProveedor) {
    establecerMensajeTodoElGrupo(grupoInfo, MENSAJES.ERROR_PROVEEDORES, fecha);
    contadores.errores++;
    console.warn("❌ Grupo inválido: Proveedores distintos o vacíos");
    return false;
  }

  const todasFacturasValidas = grupoInfo.facturas.every(fila => esFacturaValida(fila[0], configuracion));
  if (!todasFacturasValidas) {
    establecerMensajeTodoElGrupo(grupoInfo, MENSAJES.ERROR_PREFIJOS, fecha);
    contadores.errores++;
    console.warn("❌ Grupo inválido: Prefijos de factura inválidos");
    return false;
  }

  // Validar que todas las facturas del grupo sean de la misma empresa (si aplica)
  let empresaGrupo = null;
  if (configuracion.EMPRESAS && Object.keys(configuracion.EMPRESAS).length > 1) {
    empresaGrupo = identificarEmpresa(hoja, grupoInfo.filaInicio, configuracion);
    if (!empresaGrupo) {
      establecerMensajeTodoElGrupo(grupoInfo, MENSAJES.ERROR_EMPRESA, fecha);
      contadores.errores++;
      return false;
    }

    for (let i = 1; i < grupoInfo.numeroFilas; i++) {
      const empresaActual = identificarEmpresa(hoja, grupoInfo.filaInicio + i, configuracion);
      if (!empresaActual || empresaActual.ID !== empresaGrupo.ID) {
        establecerMensajeTodoElGrupo(grupoInfo, "❌ [AGRUPADO] Empresas distintas en grupo", fecha);
        contadores.errores++;
        console.warn("❌ Grupo inválido: Empresas distintas");
        return false;
      }
    }
  } else {
    // Si solo hay una empresa, identificarla
    empresaGrupo = identificarEmpresa(hoja, grupoInfo.filaInicio, configuracion);
    if (!empresaGrupo) {
      establecerMensajeTodoElGrupo(grupoInfo, MENSAJES.ERROR_EMPRESA, fecha);
      contadores.errores++;
      return false;
    }
  }

  //Verificar diario y método de pago
  console.log(`🔧 Validando diario para grupo: "${grupoInfo.diarioSeleccionado}"`);
  
  const sesionId = LibOdooUtils.odooGetSessionId("EZ"); // Necesitamos el sesionId aquí
  const validacionDiario = validarDiarioYMetodo(grupoInfo.diarioSeleccionado, sesionId, empresaGrupo.ID);
  
  if (!validacionDiario.valido) {
    let mensajeError;
    if (validacionDiario.error === 'DIARIO_NO_ENCONTRADO') {
      mensajeError = `${MENSAJES.DIARIO_NO_ENCONTRADO_AGRUPADO}: ${validacionDiario.diarioNombre}`;
    } else if (validacionDiario.error === 'METODO_NO_DISPONIBLE') {
      mensajeError = `${MENSAJES.METODO_NO_DISPONIBLE_AGRUPADO}: ${validacionDiario.diarioNombre}`;
    } else {
      mensajeError = MENSAJES.ERROR_REGISTRO_AGRUPADO;
    }
    
    establecerMensajeTodoElGrupo(grupoInfo, mensajeError, fecha);
    contadores.errores++;
    console.warn(`❌ Grupo inválido: ${mensajeError}`);
    return false;
  }

  // Guardar la información de validación para usar en el registro
  grupoInfo.validacionDiario = validacionDiario;

  return true;
}

function establecerMensajeTodoElGrupo(grupoInfo, mensaje, fecha) {
  const mensajeCompleto = `${mensaje} // ${fecha}`;
  for (let i = 0; i < grupoInfo.numeroFilas; i++) {
    grupoInfo.rangoMensajes.getCell(i + 1, 1).setValue(mensajeCompleto);
  }
}

function procesarFacturasDelGrupo(grupoInfo, hoja, sesionId, fecha, contadores, configuracion) {
  const facturasOdoo = [];
  let sumaSaldos = 0;
  let todasValidas = true;

  const empresaGrupo = identificarEmpresa(hoja, grupoInfo.filaInicio, configuracion);
  if (!empresaGrupo) {
    establecerMensajeTodoElGrupo(grupoInfo, MENSAJES.ERROR_EMPRESA, fecha);
    contadores.errores++;
    return;
  }

  // Validar cada factura del grupo
  for (let i = 0; i < grupoInfo.numeroFilas; i++) {
    const nombreFactura = grupoInfo.facturas[i][0];
    console.log(`🔍 Buscando factura: ${nombreFactura}`);

    const factura = buscarFacturaEnOdoo(nombreFactura, sesionId, empresaGrupo.ID);

    if (!factura) {
      grupoInfo.rangoMensajes.getCell(i + 1, 1).setValue(`${MENSAJES.NO_ENCONTRADA_AGRUPADO} // ${fecha}`);
      todasValidas = false;
      contadores.noEncontradas++;
      console.warn(`❌ Factura no encontrada: ${nombreFactura}`);
      continue;
    }

    if (factura.payment_state === "paid" || factura.payment_state === "in_payment") {
      grupoInfo.rangoMensajes.getCell(i + 1, 1).setValue(`${MENSAJES.YA_PAGADA_AGRUPADO} // ${fecha}`);
      todasValidas = false;
      contadores.yaRegistradas++;
      console.log(`ℹ️ Factura ya procesada: ${nombreFactura}`);
      continue;
    }

    sumaSaldos += Math.abs(factura.amount_residual_signed);
    facturasOdoo.push(factura);
  }

  if (!todasValidas) return;

  // NUEVA LÓGICA DE VALIDACIÓN DE MONTOS CON VERIFICACIÓN DE PAGOS
  const diferencia = grupoInfo.montoTotal - sumaSaldos;
  
  if (diferencia > LIMITE_AJUSTE) {
    // Antes de marcar como monto excedido, verificar si coincide con pagos realizados
    console.log(`🔍 Verificando pagos realizados para el grupo (monto: ${grupoInfo.montoTotal})`);
    
    let algunaCoincidencia = false;
    
    for (const factura of facturasOdoo) {
      const pagosRealizados = obtenerPagosRealizados(factura.id, sesionId, empresaGrupo.ID);
      const verificacion = verificarMontoContraPagosRealizados(grupoInfo.montoTotal, pagosRealizados);
      
      if (verificacion.coincide) {
        console.log(`✅ Monto coincide con pago realizado: ${verificacion.pago.name} (${verificacion.pago.amount})`);
        algunaCoincidencia = true;
        break;
      }
    }
    
    if (algunaCoincidencia) {
      // Marcar como ya pagada si el monto coincide con un pago realizado
      establecerMensajeTodoElGrupo(grupoInfo, MENSAJES.YA_PAGADA_AGRUPADO, fecha);
      contadores.yaRegistradas++;
      console.log(`ℹ️ Grupo marcado como ya pagado - monto coincide con pago realizado`);
      return;
    } else {
      // Si no coincide con ningún pago, marcar como monto excedido
      const mensajeExceso = `${MENSAJES.MONTO_EXCEDIDO_AGRUPADO} (${sumaSaldos.toFixed(2)})`;
      establecerMensajeTodoElGrupo(grupoInfo, mensajeExceso, fecha);
      contadores.montosExcedidos++;
      console.warn(`⚠️ Monto excedido en grupo: ${grupoInfo.montoTotal} > ${sumaSaldos} + ${LIMITE_AJUSTE}`);
      return;
    }
  }

  // Registrar pago agrupado (con ajuste si es necesario)
  const comunicacionesUnidas = grupoInfo.comunicaciones.map(f => f[0]).join(" | ");
  const resultadoPago = registrarPagoAgrupado(facturasOdoo, grupoInfo.montoTotal, sumaSaldos, comunicacionesUnidas, sesionId, configuracion, empresaGrupo.ID, grupoInfo.diarioSeleccionado, grupoInfo.validacionDiario);

  let mensajeFinal;
  if (resultadoPago.success) {
    // NUEVA VALIDACIÓN: Verificar si todas las facturas fueron realmente pagadas
    console.log(`🔍 Verificando si todas las facturas del grupo fueron pagadas...`);
    
    // Esperar un momento para que Odoo procese el pago
    Utilities.sleep(2000);
    
    const verificacionCompleta = verificarPagoCompletoGrupo(facturasOdoo, sesionId, empresaGrupo.ID);
    
    if (!verificacionCompleta.todasPagadas) {
      console.warn(`⚠️ Pago parcial detectado: ${verificacionCompleta.cantidadSinPagar} de ${facturasOdoo.length} facturas no fueron pagadas`);
      
      // Crear mensaje detallado sobre las facturas sin pagar
      const facturasSinPagar = verificacionCompleta.facturasSinPagar.map(f => f.nombre).join(', ');
      const mensajeDetallado = `${MENSAJES.PAGO_PARCIAL_AGRUPADO}.`;
      
      establecerMensajeTodoElGrupo(grupoInfo, mensajeDetallado, fecha);
      contadores.errores++; // Contabilizar como error para revisión manual
      console.warn(`⚠️ Facturas sin pagar en el grupo: ${facturasSinPagar}`);
      return;
    }
    
    // Si llegamos aquí, todas las facturas fueron pagadas correctamente
    if (resultadoPago.conAjuste) {
      mensajeFinal = resultadoPago.tipoAjuste === 'mayor' ? 
        MENSAJES.PAGO_AGRUPADO_AJUSTE_MAYOR : 
        MENSAJES.PAGO_AGRUPADO_AJUSTE_MENOR;
    } else {
      mensajeFinal = MENSAJES.PAGO_AGRUPADO;
    }

    // Agregar sufijo si se usó configuración por defecto
    if (resultadoPago.usandoDefault) {
      mensajeFinal += ` // Default por ${resultadoPago.motivoDefault}`;
    }

    contadores.completadas++;
    contadores.gruposCompletados++;
    console.log(`✅ Pago agrupado registrado exitosamente y todas las facturas fueron pagadas`);
  } else {
    mensajeFinal = MENSAJES.ERROR_REGISTRO_AGRUPADO;
    contadores.errores++;
    console.error(`❌ Error al registrar pago agrupado`);
  }

  establecerMensajeTodoElGrupo(grupoInfo, mensajeFinal, fecha);
}


// ========================================
// PROCESAMIENTO DE PAGOS INDIVIDUALES
// ========================================
function procesarPagosIndividuales(hoja, sesionId, fecha, contadores, filasProcessadas, configuracion) {
  const ultimaFila = hoja.getLastRow();
  const datos = hoja.getRange(configuracion.FILA_INICIO, 1, ultimaFila - configuracion.FILA_INICIO + 1, 20).getValues(); // Aumenté a 20 columnas

  const facturasIndividuales = datos
    .map((fila, indice) => ({ fila, numeroFila: indice + configuracion.FILA_INICIO }))
    .filter(item => {
      // Excluir filas ya procesadas por grupos
      if (filasProcessadas.has(item.numeroFila)) {
        console.log(`⏭️ Saltando fila ${item.numeroFila} (ya procesada en grupo)`);
        return false;
      }

      const valorFactura = item.fila[configuracion.COLUMNAS.FACTURA];
      const valorCheckbox = item.fila[configuracion.COLUMNAS.CHECKBOX];

      return typeof valorFactura === "string" && valorCheckbox === true;
    });

  console.log(`📝 Encontradas ${facturasIndividuales.length} facturas individuales para procesar`);

  if (facturasIndividuales.length === 0) {
    console.log("ℹ️ No hay facturas individuales pendientes de procesar");
    return;
  }

  facturasIndividuales.forEach((item, indice) => {
    console.log(`🔄 Procesando factura individual ${indice + 1}/${facturasIndividuales.length}`);
    procesarFacturaIndividual(item, hoja, sesionId, fecha, contadores, configuracion);
  });
}

function procesarFacturaIndividual(item, hoja, sesionId, fecha, contadores, configuracion) {
  const fila = item.fila;
  const numeroFila = item.numeroFila;
  const nombreFactura = fila[configuracion.COLUMNAS.FACTURA];
  const montoHoja = fila[configuracion.COLUMNAS.MONTO];
  const comunicacion = fila[configuracion.COLUMNAS.COMUNICACION];
  const diarioSeleccionado = fila[configuracion.COLUMNAS.DIARIO];

  console.log(`🔍 Procesando factura individual: ${nombreFactura}`);

  try {
    if (!esFacturaValida(nombreFactura, configuracion)) {
      establecerMensajeEnCelda(hoja, numeroFila, MENSAJES.ERROR_PREFIJO, fecha, configuracion);
      contadores.errores++;
      console.warn(`❌ Prefijo inválido en factura: ${nombreFactura}`);
      return;
    }

    const empresa = identificarEmpresa(hoja, numeroFila, configuracion);
    if (!empresa) {
      establecerMensajeEnCelda(hoja, numeroFila, MENSAJES.ERROR_EMPRESA, fecha, configuracion);
      contadores.errores++;
      return;
    }

    console.log(`🔧 Validando diario para factura individual: "${diarioSeleccionado}"`);
    const validacionDiario = validarDiarioYMetodo(diarioSeleccionado, sesionId, empresa.ID);
    
    if (!validacionDiario.valido) {
      let mensajeError;
      if (validacionDiario.error === 'DIARIO_NO_ENCONTRADO') {
        mensajeError = `${MENSAJES.DIARIO_NO_ENCONTRADO}: ${validacionDiario.diarioNombre}`;
      } else if (validacionDiario.error === 'METODO_NO_DISPONIBLE') {
        mensajeError = `${MENSAJES.METODO_NO_DISPONIBLE}: ${validacionDiario.diarioNombre}`;
      } else {
        mensajeError = MENSAJES.ERROR_REGISTRO;
      }
      
      establecerMensajeEnCelda(hoja, numeroFila, mensajeError, fecha, configuracion);
      contadores.errores++;
      console.warn(`❌ Validación de diario falló: ${mensajeError}`);
      return;
    }

    const factura = buscarFacturaEnOdoo(nombreFactura, sesionId, empresa.ID);

    if (!factura) {
      establecerMensajeEnCelda(hoja, numeroFila, MENSAJES.NO_ENCONTRADA, fecha, configuracion);
      contadores.noEncontradas++;
      console.warn(`❌ Factura no encontrada: ${nombreFactura}`);
      return;
    }

    if (factura.payment_state === "paid" || factura.payment_state === "in_payment") {
      establecerMensajeEnCelda(hoja, numeroFila, MENSAJES.YA_PAGADA, fecha, configuracion);
      contadores.yaRegistradas++;
      console.log(`ℹ️ Factura ya pagada: ${nombreFactura}`);
      return;
    }

    const saldoFactura = Math.abs(factura.amount_residual_signed);
    const diferencia = montoHoja - saldoFactura;

    // NUEVA LÓGICA DE VALIDACIÓN CON VERIFICACIÓN DE PAGOS
    if (diferencia > LIMITE_AJUSTE) {
      // Antes de marcar como monto excedido, verificar si coincide con pagos realizados
      console.log(`🔍 Verificando pagos realizados para ${nombreFactura} (monto: ${montoHoja})`);
      
      const pagosRealizados = obtenerPagosRealizados(factura.id, sesionId, empresa.ID);
      const verificacion = verificarMontoContraPagosRealizados(montoHoja, pagosRealizados);
      
      if (verificacion.coincide) {
        console.log(`✅ Monto coincide con pago realizado: ${verificacion.pago.name} (${verificacion.pago.amount})`);
        establecerMensajeEnCelda(hoja, numeroFila, MENSAJES.YA_PAGADA, fecha, configuracion);
        contadores.yaRegistradas++;
        console.log(`ℹ️ Factura marcada como ya pagada - monto coincide con pago realizado`);
        return;
      } else {
        // Si no coincide con ningún pago, marcar como monto excedido
        establecerMensajeEnCelda(hoja, numeroFila, MENSAJES.MONTO_EXCEDIDO, fecha, configuracion);
        contadores.montosExcedidos++;
        console.warn(`⚠️ Monto excedido: ${montoHoja} > ${saldoFactura} + ${LIMITE_AJUSTE}`);
        return;
      }
    }

    // Procesar pago (con ajuste si es necesario)
    const resultadoPago = registrarPagoIndividual(factura, montoHoja, saldoFactura, comunicacion, sesionId, configuracion, empresa.ID, diarioSeleccionado, validacionDiario);

    let mensaje;
    if (resultadoPago.success) {
      if (resultadoPago.conAjuste) {
        mensaje = resultadoPago.tipoAjuste === 'mayor' ? 
          MENSAJES.PAGO_REGISTRADO_AJUSTE_MAYOR : 
          MENSAJES.PAGO_REGISTRADO_AJUSTE_MENOR;
      } else {
        mensaje = MENSAJES.PAGO_REGISTRADO;
      }

      // Agregar sufijo si se usó configuración por defecto
      if (resultadoPago.usandoDefault) {
        mensaje += ` // Default por ${resultadoPago.motivoDefault}`;
      }

      contadores.completadas++;
      contadores.individualesCompletadas++;
      console.log(`✅ Pago individual registrado: ${nombreFactura}`);
    } else {
      mensaje = MENSAJES.ERROR_REGISTRO;
      contadores.errores++;
      console.error(`❌ Error al registrar pago: ${nombreFactura}`);
    }

    establecerMensajeEnCelda(hoja, numeroFila, mensaje, fecha, configuracion);

  } catch (error) {
    establecerMensajeEnCelda(hoja, numeroFila, `❌ Error: ${error.message}`, fecha, configuracion);
    contadores.errores++;
    console.error(`❌ Error procesando ${nombreFactura}: ${error.message}`);
  }
}

// ========================================
// FUNCIONES DE INTEGRACIÓN CON ODOO
// ========================================
function buscarFacturaEnOdoo(nombreFactura, sesionId, empresaId) {
  const url = `${odooBaseUrl}/web/dataset/call_kw/account.move/search_read`;
  const payload = {
    jsonrpc: "2.0",
    method: "call",
    params: {
      model: "account.move",
      method: "search_read",
      args: [[
        ["name", "=", nombreFactura],
        ["company_id", "=", empresaId]
      ]],
      kwargs: {
        fields: ["id", "name", "company_id", "amount_total_signed", "amount_residual_signed", "currency_id", "payment_state"],
        limit: 1
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

  const respuesta = UrlFetchApp.fetch(url, opciones);
  const resultado = JSON.parse(respuesta.getContentText());

  if (resultado.error) {
    throw new Error(`Error en Odoo: ${resultado.error.data.message}`);
  }

  return resultado.result.length > 0 ? resultado.result[0] : null;
}

function buscarCuentaPorCodigo(codigoCuenta, sesionId, empresaId) {
  const url = `${odooBaseUrl}/web/dataset/call_kw/account.account/search_read`;
  const payload = {
    jsonrpc: "2.0",
    method: "call",
    params: {
      model: "account.account",
      method: "search_read",
      args: [[
        ["code", "=", codigoCuenta],
        ["company_id", "=", empresaId]
      ]],
      kwargs: {
        fields: ["id", "name", "code"],
        limit: 1
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

  const respuesta = UrlFetchApp.fetch(url, opciones);
  const resultado = JSON.parse(respuesta.getContentText());

  if (resultado.error) {
    console.error(`Error buscando cuenta ${codigoCuenta}: ${resultado.error.data.message}`);
    return null;
  }

  return resultado.result.length > 0 ? resultado.result[0] : null;
}

function obtenerPagosRealizados(facturaId, sesionId, empresaId) {
  const url = `${odooBaseUrl}/web/dataset/call_kw/account.payment/search_read`;
  const payload = {
    jsonrpc: "2.0",
    method: "call",
    params: {
      model: "account.payment",
      method: "search_read",
      args: [[
        ["reconciled_invoice_ids", "in", [facturaId]],
        ["company_id", "=", empresaId],
        ["state", "in", ["posted", "sent", "reconciled"]]
      ]],
      kwargs: {
        fields: ["id", "name", "amount", "state"]
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
      console.error(`Error obteniendo pagos: ${resultado.error.data.message}`);
      return [];
    }

    return resultado.result || [];
  } catch (error) {
    console.error(`Error en obtenerPagosRealizados: ${error.message}`);
    return [];
  }
}

function registrarPagoIndividual(factura, montoHoja, saldoFactura, comunicacion, sesionId, configuracion, empresaId, diarioSeleccionado = null, validacionDiario = null) {
  return ejecutarRegistroPago([factura.id], montoHoja, saldoFactura, comunicacion, sesionId, false, configuracion, empresaId, diarioSeleccionado, validacionDiario);
}

function registrarPagoAgrupado(facturas, montoTotal, sumaSaldos, comunicaciones, sesionId, configuracion, empresaId, diarioSeleccionado = null, validacionDiario = null) {
  const idsFacturas = facturas.map(f => f.id);
  return ejecutarRegistroPago(idsFacturas, montoTotal, sumaSaldos, comunicaciones, sesionId, true, configuracion, empresaId, diarioSeleccionado, validacionDiario);
}

function ejecutarRegistroPago(idsFacturas, montoPago, montoSaldo, comunicacion, sesionId, esAgrupado = false, configuracion, empresaId = null, diarioSeleccionado = null, validacionDiario = null) {
  const baseUrl = odooBaseUrl;
  const opciones = {
    method: "post",
    contentType: "application/json",
    headers: { Cookie: sesionId },
    muteHttpExceptions: true
  };

  try {
    // Determinar empresaId final
    let empresaIdFinal = empresaId;
    if (!empresaIdFinal) {
      if (configuracion.EMPRESAS && Object.keys(configuracion.EMPRESAS).length === 1) {
        empresaIdFinal = Object.values(configuracion.EMPRESAS)[0].ID;
      } else {
        throw new Error('No se pudo determinar el ID de empresa');
      }
    }

    console.log(`🏢 ID de empresa determinado: ${empresaIdFinal}`);

    // Determinar configuración de diario y método
    let diarioId, metodoPagoId;
    let usandoConfiguracionDefault = false;
    let motivoDefault = '';

    if (validacionDiario) {
      // CASO ESPECIAL: EMPRESA ID = 1
      if (validacionDiario.empresaEspecial && empresaIdFinal === 1) {
        console.log(`🏢 Procesando empresa ID=1 con lógica especial`);
        
        if (validacionDiario.usarDefault) {
          usandoConfiguracionDefault = true;
          motivoDefault = validacionDiario.motivo;
          
          // Usar configuración predeterminada para empresa ID=1
          const empresa = Object.values(configuracion.EMPRESAS).find(emp => emp.ID === empresaIdFinal);
          if (empresa && empresa.DIARIO_ID && empresa.METODO_PAGO_ID) {
            diarioId = empresa.DIARIO_ID;
            metodoPagoId = empresa.METODO_PAGO_ID;
          } else {
            throw new Error(`No se encontró configuración predeterminada para empresa ID: ${empresaIdFinal}`);
          }
        } else {
          // Para empresa ID=1: usar diario predeterminado + método de pago de la columna
          const empresa = Object.values(configuracion.EMPRESAS).find(emp => emp.ID === empresaIdFinal);
          if (!empresa || !empresa.DIARIO_ID) {
            throw new Error(`No se encontró diario predeterminado para empresa ID: ${empresaIdFinal}`);
          }
          
          diarioId = empresa.DIARIO_ID; // Diario predeterminado
          metodoPagoId = validacionDiario.metodoPagoId; // Método de la columna
          usandoConfiguracionDefault = false;
          
          console.log(`✅ Empresa ID=1: Diario predeterminado (ID: ${diarioId}) + Método de columna (ID: ${metodoPagoId})`);
        }
      }
      // LÓGICA ORIGINAL PARA OTRAS EMPRESAS
      else if (validacionDiario.usarDefault) {
        usandoConfiguracionDefault = true;
        motivoDefault = validacionDiario.motivo;
        
        if (configuracion.EMPRESAS && Object.keys(configuracion.EMPRESAS).length > 1 && empresaIdFinal) {
          const empresa = Object.values(configuracion.EMPRESAS).find(emp => emp.ID === empresaIdFinal);
          if (empresa && empresa.DIARIO_ID && empresa.METODO_PAGO_ID) {
            diarioId = empresa.DIARIO_ID;
            metodoPagoId = empresa.METODO_PAGO_ID;
          } else {
            throw new Error(`No se encontró configuración para empresa ID: ${empresaIdFinal}`);
          }
        } else if (configuracion.EMPRESAS && Object.keys(configuracion.EMPRESAS).length === 1) {
          const empresa = Object.values(configuracion.EMPRESAS)[0];
          diarioId = empresa.DIARIO_ID;
          metodoPagoId = empresa.METODO_PAGO_ID;
        } else {
          throw new Error("No se pudo determinar la configuración de diario y método de pago");
        }
      } else {
        diarioId = validacionDiario.diarioId;
        metodoPagoId = validacionDiario.metodoPagoId;
        usandoConfiguracionDefault = false;
      }
    } else {
      throw new Error("No se recibió información de validación de diario");
    }

    console.log(`💳 Configuración final - Diario ID: ${diarioId}, Método Pago ID: ${metodoPagoId}`);

    // NUEVA LÓGICA: Determinar si necesita ajuste
    const diferencia = montoPago - montoSaldo;
    const necesitaAjuste = Math.abs(diferencia) > 0.01 && Math.abs(diferencia) <= LIMITE_AJUSTE;
    
    let cuentaAjusteId = null;
    let tipoAjuste = null;

    if (necesitaAjuste) {
      const codigoCuenta = diferencia > 0 ? CUENTAS_AJUSTE.MAYOR_SALDO : CUENTAS_AJUSTE.MENOR_SALDO;
      tipoAjuste = diferencia > 0 ? 'mayor' : 'menor';
      
      console.log(`⚖️ Necesita ajuste: ${diferencia.toFixed(2)} - Cuenta: ${codigoCuenta}`);
      
      const cuentaAjuste = buscarCuentaPorCodigo(codigoCuenta, sesionId, empresaIdFinal);
      if (!cuentaAjuste) {
        throw new Error(`No se encontró cuenta de ajuste con código: ${codigoCuenta}`);
      }
      cuentaAjusteId = cuentaAjuste.id;
      console.log(`✅ Cuenta de ajuste encontrada: ${cuentaAjuste.name} (ID: ${cuentaAjusteId})`);
    }

    console.log(`💰 Configuración de pago - Monto: ${montoPago}, Saldo: ${montoSaldo}, Ajuste: ${necesitaAjuste ? 'SÍ' : 'NO'}`);

    // Preparar datos del wizard
    const datosWizard = {
      payment_type: "outbound",
      partner_type: "supplier",
      amount: montoPago, // Usar el monto de pago completo
      journal_id: diarioId,
      payment_method_line_id: metodoPagoId,
      communication: comunicacion,
      ...(esAgrupado && { group_payment: true })
    };

    // Agregar writeoff si es necesario
    if (necesitaAjuste) {
      datosWizard.payment_difference_handling = "reconcile";
      datosWizard.writeoff_account_id = cuentaAjusteId;
      datosWizard.writeoff_label = `Ajuste automático ${tipoAjuste === 'mayor' ? 'mayor' : 'menor'} saldo`;
    }

    // 1. Crear wizard de pago
    const payloadWizard = {
      jsonrpc: "2.0",
      method: "call",
      params: {
        model: "account.payment.register",
        method: "create",
        args: [datosWizard],
        kwargs: {
          context: {
            active_model: "account.move",
            active_ids: idsFacturas
          }
        }
      },
      id: Math.floor(Math.random() * 100000)
    };

    const respuestaWizard = UrlFetchApp.fetch(`${baseUrl}/web/dataset/call_kw/account.payment.register/create`, {
      ...opciones,
      payload: JSON.stringify(payloadWizard)
    });

    const resultadoWizard = JSON.parse(respuestaWizard.getContentText());
    if (resultadoWizard.error) throw new Error("Wizard: " + resultadoWizard.error.data.message);

    const wizardId = resultadoWizard.result;

    // 2. Guardar wizard
    const payloadGuardar = {
      jsonrpc: "2.0",
      method: "call",
      params: {
        model: "account.payment.register",
        method: "web_save",
        args: [[wizardId], {}, {}],
        kwargs: {
          context: {
            active_model: "account.move",
            active_ids: idsFacturas
          }
        }
      },
      id: Math.floor(Math.random() * 100000)
    };

    const respuestaGuardar = UrlFetchApp.fetch(`${baseUrl}/web/dataset/call_kw/account.payment.register/web_save`, {
      ...opciones,
      payload: JSON.stringify(payloadGuardar)
    });

    const resultadoGuardar = JSON.parse(respuestaGuardar.getContentText());
    if (resultadoGuardar.error) throw new Error("web_save: " + resultadoGuardar.error.data.message);

    // 3. Crear pagos
    const payloadAccion = {
      jsonrpc: "2.0",
      method: "call",
      params: {
        model: "account.payment.register",
        method: "action_create_payments",
        args: [[wizardId]],
        kwargs: {
          context: {
            active_model: "account.move",
            active_ids: idsFacturas
          }
        }
      },
      id: Math.floor(Math.random() * 100000)
    };

    const respuestaAccion = UrlFetchApp.fetch(`${baseUrl}/web/dataset/call_kw/account.payment.register/action_create_payments`, {
      ...opciones,
      payload: JSON.stringify(payloadAccion)
    });

    const resultadoAccion = JSON.parse(respuestaAccion.getContentText());
    if (resultadoAccion.error) throw new Error("create_payments: " + resultadoAccion.error.data.message);

    return {
      success: true,
      usandoDefault: usandoConfiguracionDefault,
      motivoDefault: motivoDefault,
      conAjuste: necesitaAjuste,
      tipoAjuste: tipoAjuste,
      empresaEspecial: validacionDiario?.empresaEspecial || false
    };

  } catch (error) {
    console.error(`❌ Error en registro de pago: ${error.message}`);
    return { success: false, error: 'ERROR_REGISTRO', message: error.message };
  }
}

// ========================================
// FUNCIÓN DE RESUMEN
// ========================================
function mostrarResumenFinal(contadores) {
  const mensaje = `📦 RESUMEN DE PROCESAMIENTO
  
  🔄 TOTALES GENERALES:
  ✅ Pagos completados: ${contadores.completadas}
  ✔️ Ya registrados: ${contadores.yaRegistradas}
  ⚠️ Montos excedidos: ${contadores.montosExcedidos}
  ❌ No encontradas: ${contadores.noEncontradas}
  ❌ Errores: ${contadores.errores}

  📊 DETALLES:
  🔗 Grupos procesados: ${contadores.gruposCompletados}
  📝 Individuales procesados: ${contadores.individualesCompletadas}`;

  console.log(mensaje);
  SpreadsheetApp.getUi().alert(mensaje);
}