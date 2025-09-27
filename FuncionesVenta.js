// ========================================
// SISTEMA DE AUTOMATIZACIÓN DE VENTAS ODOO
// ========================================

const MENSAJES_VENTAS = {
  VENTA_CREADA: "✅ Venta creada exitosamente",
  CLIENTE_NO_ENCONTRADO: "❌ Cliente no encontrado en Odoo",
  PRODUCTO_NO_ENCONTRADO: "❌ Producto no encontrado",
  ERROR_CREACION: "❌ Error al crear la venta",
  EMPRESA_NO_ENCONTRADA: "❌ Empresa no encontrada",
  SIN_PRODUCTOS: "❌ No se encontraron productos para crear la venta",
  YA_PROCESADO: "✔️ Ya procesado anteriormente",
  NO_APROBADO: "⏸️ Registro no aprobado para procesamiento",
  VENTA_EXISTENTE: "✔️ Venta ya existente",
  VENTA_EXISTENTE_CON_CAMBIOS: "⚠️ Venta existente con cambios detectados"
};

const CONFIG_VENTAS = {
  COLUMNAS: {
    FECHA_DESPACHO: 0,    // A
    FECHA_ENTREGA: 1,     // B
    PRODUCTO: 3,          // D
    CANTIDAD: 4,          // E
    CLIENTE: 5,           // F
    EMPRESA: 6,           // G
    ESTADO: 7,            // H
    MENSAJE: 8            // I
  },
  FILA_INICIO: 2,
  ESTADO_APROBADO: "Aprobado"
};

// ========================================
// FUNCIÓN PRINCIPAL COMPLETA
// ========================================
function procesoCompletoVentas(nombreHoja) {
  console.log("[INICIO] Validación y procesamiento automático de ventas para hoja: " + nombreHoja);
  aplicarFiltroYMarcar(nombreHoja, CONFIG_VENTAS);
  console.log("[VALIDACIÓN COMPLETADA] Iniciando procesamiento de ventas aprobadas...");
  procesarVentasAprobadas(nombreHoja);
  console.log("[FIN] Proceso completo finalizado para hoja: " + nombreHoja);
}

// ========================================
// PROCESAMIENTO DE VENTAS APROBADAS
// ========================================
function procesarVentasAprobadas(nombreHoja) {
  const hoja = obtenerHoja(nombreHoja);
  if (!hoja) { console.log("[ERROR] No se encontró la hoja: " + nombreHoja); return; }
  const sesionId = LibOdooUtilsT.odooGetSessionIdtest();
  const fechaActual = obtenerFechaActual();
  const contadores = { creadas: 0, errores: 0, yaProcesadas: 0 };
  const ultimaFila = hoja.getLastRow();
  const datos = hoja.getRange(CONFIG_VENTAS.FILA_INICIO, 1, ultimaFila - CONFIG_VENTAS.FILA_INICIO + 1, 10).getValues();
  const gruposVentas = agruparFilasPorPadre(datos, CONFIG_VENTAS).filter(grupo => grupo.filaPadre.fila[7] === "Aprobado");
  console.log(`[PROCESO] Procesando ${gruposVentas.length} grupos de ventas aprobadas...`);
  gruposVentas.forEach((grupo, indice) => {
    console.log(`[PROCESO] Procesando grupo ${indice + 1}/${gruposVentas.length}`);
    procesarGrupoVenta(grupo, hoja, sesionId, fechaActual, contadores);
  });
  mostrarResumenVentas(contadores);
}

function procesarGrupoVenta(grupo, hoja, sesionId, fechaActual, contadores) {
  const { filaPadre, filasHijas } = grupo;
  try {
    const datosVenta = extraerDatosTransaccion(filaPadre.fila, CONFIG_VENTAS);
    console.log(`[DEBUG] Datos extraídos:`, datosVenta);

    // === VALIDACIÓN MEJORADA DE VENTAS EXISTENTES ===
    const empresaInfo = validarEmpresa(datosVenta.empresa, sesionId);
    if (!empresaInfo.valida) {
      hoja.getRange(filaPadre.numeroFila, 8).setValue("Rechazado");
      hoja.getRange(filaPadre.numeroFila, 9).setValue(MENSAJES_VENTAS.EMPRESA_NO_ENCONTRADA + ` [${fechaActual}]`);
      contadores.errores++;
      console.warn(`[GRUPO] Empresa no encontrada: '${datosVenta.empresa}'`);
      return;
    }

    const clienteId = validarCliente(datosVenta.cliente, sesionId, empresaInfo.empresaId);
    if (!clienteId) {
      hoja.getRange(filaPadre.numeroFila, 8).setValue("Rechazado");
      hoja.getRange(filaPadre.numeroFila, 9).setValue(MENSAJES_VENTAS.CLIENTE_NO_ENCONTRADO + ` [${fechaActual}]`);
      contadores.errores++;
      console.warn(`[GRUPO] Cliente no encontrado: '${datosVenta.cliente}'`);
      return;
    }

    const productos = recopilarProductos(filaPadre, filasHijas, CONFIG_VENTAS);
    if (productos.length === 0) {
      hoja.getRange(filaPadre.numeroFila, 8).setValue("Rechazado");
      hoja.getRange(filaPadre.numeroFila, 9).setValue(MENSAJES_VENTAS.SIN_PRODUCTOS + ` [${fechaActual}]`);
      contadores.errores++;
      console.warn(`[GRUPO] Sin productos para la fila ${filaPadre.numeroFila}`);
      return;
    }

    const productosValidados = validarProductosEnOdoo(productos, sesionId, empresaInfo.empresaId);
    if (productosValidados.length === 0) {
      hoja.getRange(filaPadre.numeroFila, 8).setValue("Rechazado");
      hoja.getRange(filaPadre.numeroFila, 9).setValue(MENSAJES_VENTAS.PRODUCTO_NO_ENCONTRADO + ` [${fechaActual}]`);
      contadores.errores++;
      console.warn(`[GRUPO] Ningún producto válido para la fila ${filaPadre.numeroFila}`);
      return;
    }

    // Validar venta existente con productos validados
    const validacionVenta = validarVentaExistente(datosVenta, productosValidados, sesionId);

    if (validacionVenta.existe) {
      // Venta existente - solo cambiar estado en columna H, NO tocar columna I
      hoja.getRange(filaPadre.numeroFila, 8).setValue("✅ Ya existe venta");
      // NO escribir en columna I - mantener mensaje original
      contadores.yaProcesadas++;
      console.log(`[VENTA][EXISTENTE] Venta ya existente: ${validacionVenta.ventaExistente.name}`);
      return;
    } else if (validacionVenta.cambiosDetectados) {
      // Venta diferente - crear nueva venta sin mensaje especial
      console.log(`[VENTA][DIFERENTE] Creando nueva venta por diferencias en productos`);
      // Continuar con la creación de la nueva venta
    }
    console.log(`[GRUPO] Procesando fila ${filaPadre.numeroFila}: Cliente='${datosVenta.cliente}', Empresa='${datosVenta.empresa}', Producto='${datosVenta.producto}'`);
    // PASAR hoja, filaPadre, fechaActual, contadores
    const resultadoVenta = crearVentaEnOdoo(datosVenta, clienteId, productosValidados, empresaInfo.empresaId, sesionId, hoja, filaPadre, fechaActual, contadores);
    if (resultadoVenta && resultadoVenta.success) {
      hoja.getRange(filaPadre.numeroFila, 8).setValue("Aprobado");
      hoja.getRange(filaPadre.numeroFila, 9).setValue(resultadoVenta.mensajeFinal);
      contadores.creadas++;
      filasHijas.forEach(filaHija => {
        hoja.getRange(filaHija.numeroFila, 9).setValue("✅ Incluido en venta padre [" + fechaActual + "]");
      });
      console.log(`[GRUPO] Venta creada exitosamente para fila ${filaPadre.numeroFila}`);
    } else if (resultadoVenta && resultadoVenta.error) {
      hoja.getRange(filaPadre.numeroFila, 8).setValue("Rechazado");
      hoja.getRange(filaPadre.numeroFila, 9).setValue(`${MENSAJES_VENTAS.ERROR_CREACION}: ${resultadoVenta.error} [${fechaActual}]`);
      contadores.errores++;
      console.error(`[GRUPO] Error creando venta para fila ${filaPadre.numeroFila}: ${resultadoVenta.error}`);
    }
  } catch (error) {
    hoja.getRange(filaPadre.numeroFila, 8).setValue("Rechazado");
    hoja.getRange(filaPadre.numeroFila, 9).setValue(`${MENSAJES_VENTAS.ERROR_CREACION}: ${error.message} [${fechaActual}]`);
    contadores.errores++;
    console.error(`[GRUPO] Error inesperado en fila ${filaPadre.numeroFila}: ${error.message}`);
  }
}


// ========================================
// VALIDACIÓN Y CONSULTAS ODOO
// ========================================
function crearVentaEnOdoo(datosVenta, clienteId, productos, empresaId, sesionId, hoja, filaPadre, fechaActual, contadores) {
  let mensajeFinal = '';
  let lotesAsignados = false;
  let pickingValidado = false;
  try {
    const lineasProductos = productos.map(producto => [0, 0, {
      product_id: producto.productoId,
      product_uom_qty: producto.cantidad,
      price_unit: producto.precioLista || 0,
      name: producto.nombreOdoo
    }]);
    console.log(`[VENTA] Creando venta para cliente ID: ${clienteId}, empresa ID: ${empresaId}, productos: ${productos.map(p => p.nombreOdoo + ' ($' + p.precioLista + ')').join(', ')}`);
    //console.log(`[DEBUG] Fechas originales - Despacho: ${datosVenta.fechaDespacho}, Entrega: ${datosVenta.fechaEntrega}`);
    const fechaDespacho = formatearFechaParaOdoo(datosVenta.fechaDespacho);
    const fechaEntrega = formatearFechaParaOdoo(datosVenta.fechaEntrega);
    //console.log(`[DEBUG] Fechas formateadas - Despacho: ${fechaDespacho}, Entrega: ${fechaEntrega}`);
    const ventaData = {
      partner_id: clienteId,
      company_id: empresaId,
      date_order: formatearFechaParaOdoo(new Date()),
      delivery_date: fechaEntrega,
      commitment_date: fechaDespacho,
      order_line: lineasProductos,
      note: `Venta automatizada desde Google Sheets\nFecha Despacho: ${fechaDespacho}\nFecha Entrega: ${fechaEntrega}`
    };
    //console.log('[VENTA] Objeto enviado a Odoo:', JSON.stringify(ventaData, null, 2));
    const ventaId = hacerConsultaOdoo('sale.order', 'create', [ventaData], {}, sesionId);
    let recordName = null;
    try {
      hacerConsultaOdoo('sale.order', 'action_confirm', [[ventaId]], {}, sesionId);
      const ventaInfo = hacerConsultaOdoo('sale.order', 'read', [[ventaId], ['name']], {}, sesionId);
      if (ventaInfo && ventaInfo.length > 0) {
        recordName = ventaInfo[0].name;
      }
    } catch (error) {
      console.warn(`[VENTA] Advertencia al confirmar venta: ${error && error.message ? error.message : error}`);
      if (error && error.stack) console.warn(`[VENTA] Stack:`, error.stack);
    }
    console.log(`[VENTA] Venta creada con ID: ${ventaId}, record_name: ${recordName}`);

    // === ASIGNACIÓN AUTOMÁTICA DE LOTES Y VALIDACIÓN DE ENTREGA ===
    let pickingId = null;
    let lotesError = false;
    let validacionError = false;
    let advertenciasLotes = [];
    let lotesAsignadosParcial = false;
    let lotesAsignadosTodos = false;
    let ubicacionPV = null;
    let lotesAsignados = [];
    let lotesNoEncontrados = [];
    let lotesErrores = [];
    try {
      // Buscar el picking (entrega) generado por la venta
      const pickings = hacerConsultaOdoo('stock.picking', 'web_search_read', [], {
        domain: [['origin', '=', recordName]],
        specification: {
          id: {},
          state: {},
          name: {},
          company_id: {},
          location_id: {}
        },
        limit: 1,
        context: { lang: 'es_CO', tz: 'America/Lima' }
      }, sesionId);
      const pickingsRes = pickings.records || pickings;
      if (pickingsRes && pickingsRes.length > 0) {
        pickingId = pickingsRes[0].id;
        const pickingCompanyId = pickingsRes[0].company_id && (Array.isArray(pickingsRes[0].company_id) ? pickingsRes[0].company_id[0] : pickingsRes[0].company_id);
        // Buscar ubicación Punto de venta filtrando por empresa
        const ubicacionesPV = hacerConsultaOdoo('stock.location', 'web_search_read', [], {
          domain: [['name', 'ilike', 'Punto de venta'], ['company_id', '=', empresaId]],
          specification: { id: {}, name: {}, company_id: {} },
          limit: 1,
          context: { lang: 'es_CO', tz: 'America/Lima' }
        }, sesionId);
        ubicacionPV = ubicacionesPV.records && ubicacionesPV.records.length > 0 ? ubicacionesPV.records[0] : null;
        if (!ubicacionPV) {
          hoja.getRange(filaPadre.numeroFila, 8).setValue("Rechazado");
          hoja.getRange(filaPadre.numeroFila, 9).setValue(`❌ No se encontró ubicación 'Punto de venta' para la empresa. [${fechaActual}]`);
          contadores.errores++;
          console.error(`[PICKING] No se encontró ubicación 'Punto de venta' para la empresa.`);
          return;
        }
        // Cambiar location_id del picking (entrega) y verificar que se actualizó correctamente
        try {
          hacerConsultaOdoo('stock.picking', 'write', [[pickingId], { location_id: ubicacionPV.id }], {}, sesionId);
          console.log(`[PICKING] location_id actualizado a Punto de venta (${ubicacionPV.id}) para picking: ${pickingId}`);
            
          // Verificar que el cambio se aplicó correctamente
          const pickingVerificado = hacerConsultaOdoo('stock.picking', 'read', [[pickingId], ['location_id']], {}, sesionId);
          if (pickingVerificado && pickingVerificado.length > 0) {
            const locationIdActual = Array.isArray(pickingVerificado[0].location_id) ? 
              pickingVerificado[0].location_id[0] : pickingVerificado[0].location_id;
            if (locationIdActual !== ubicacionPV.id) {
              throw new Error(`La ubicación del picking no se actualizó correctamente. Esperado: ${ubicacionPV.id}, Actual: ${locationIdActual}`);
            }
            console.log(`[PICKING] ✅ Ubicación del picking verificada correctamente: ${locationIdActual}`);
          }
        } catch (errPV) {
          hoja.getRange(filaPadre.numeroFila, 8).setValue("Rechazado");
          hoja.getRange(filaPadre.numeroFila, 9).setValue(`❌ Error cambiando ubicación a 'Punto de venta': ${errPV && errPV.message ? errPV.message : errPV} [${fechaActual}]`);
          contadores.errores++;
          console.error(`[PICKING] Error cambiando ubicación:`, errPV && errPV.message ? errPV.message : errPV);
          return;
        }
        // === LIMPIEZA DE LOTES ANTES DE ASIGNAR ===
        try {
          const verificacionLotes = verificarYLimpiarLotes(pickingId, empresaId, sesionId);
          if (verificacionLotes.success) {
            console.log(`[VERIFICACIÓN] ${verificacionLotes.message}`);
          } else {
            advertenciasLotes.push(`⚠️ Error en verificación de lotes: ${verificacionLotes.error}`);
          }
        } catch (errVerificacion) {
          advertenciasLotes.push(`⚠️ Error verificando lotes: ${errVerificacion && errVerificacion.message ? errVerificacion.message : errVerificacion}`);
        }
        // Preparar los lotes para cada producto
        const productosLotes = productos.map(prod => {
          const lotes = getLotesParaVenta(datosVenta.cliente, datosVenta.empresa, prod.nombreOdoo);
          return { productId: prod.productoId, lotes };
        });
        // Asignar lotes automáticamente SOLO si hay lotes en la ubicación
        for (const prodLote of productosLotes) {
          const movs = hacerConsultaOdoo('stock.move', 'web_search_read', [], {
            domain: [['picking_id', '=', pickingId], ['product_id', '=', prodLote.productId]],
            specification: { id: {}, product_id: {}, product_uom_qty: {}, move_line_ids: {} },
            limit: 10,
            context: { lang: 'es_CO', tz: 'America/Lima' }
          }, sesionId);
          const mov = (movs.records || movs)[0];
          if (!mov) {
            lotesErrores.push(`No se encontró movimiento para producto ID: ${prodLote.productId}`);
            continue;
          }
          for (const loteInfo of prodLote.lotes) {
            // Búsqueda eficiente usando la misma lógica que diagnosticarLote210625
            const quantsOdoo = hacerConsultaOdoo('stock.quant', 'web_search_read', [], {
              domain: [
                "&", "&",
                ["product_id", "=", prodLote.productId],
                ["location_id", "child_of", ubicacionPV.id],
                "&",
                ["on_hand", "=", true],
                ["quantity", ">", 0]
              ],
              specification: {
                product_id: {},
                location_id: {},
                lot_id: {},
                quantity: {},
                company_id: {}
              },
              limit: 80,
              context: {
                lang: 'es_CO',
                tz: 'America/Lima',
                bin_size: true
              }
            }, sesionId);

            const quantsRes = quantsOdoo.records || quantsOdoo;
            //console.log(`[LOTES][DEBUG] Consulta stock.quant para producto ${prodLote.productId}, ubicación ${ubicacionPV.id}:`, quantsRes);

            // Buscar el lote por nombre para obtener su ID
            const lotesOdoo = hacerConsultaOdoo('stock.lot', 'web_search_read', [], {
              domain: [['name', '=', loteInfo.lote], ['product_id', '=', prodLote.productId]],
              specification: { id: {}, name: {}, product_id: {} },
              limit: 10,
              context: { lang: 'es_CO', tz: 'America/Lima' }
            }, sesionId);

            const lotesRes = lotesOdoo.records || lotesOdoo;
            if (!lotesRes || lotesRes.length === 0) {
              lotesNoEncontrados.push(loteInfo.lote);
              continue;
            }

            // Buscar el lote con stock en la ubicación correcta
            let loteConStock = null;
            for (const lote of lotesRes) {
              const quantConLote = quantsRes.find(quant =>
                quant.lot_id === lote.id && quant.quantity > 0
              );
              if (quantConLote) {
                loteConStock = quantConLote;
                break;
              }
            }

            if (!loteConStock) {
              lotesNoEncontrados.push(`${loteInfo.lote} (no encontrado en Punto de venta)`);
              console.log(`[LOTES][DEBUG] ❌ No se encontró stock.quant para lote ${loteInfo.lote} en Punto de venta`);
              continue;
            }

            // Validar que la cantidad disponible sea suficiente
            const cantidadDisponible = loteConStock.quantity || 0;
            console.log(`[LOTES][DEBUG] Lote ${loteInfo.lote}: quantity=${loteConStock.quantity}, cantidadDisponible=${cantidadDisponible}, cantidadSolicitada=${loteInfo.cantidad}`);

            if (cantidadDisponible < loteInfo.cantidad) {
              lotesNoEncontrados.push(`${loteInfo.lote} (stock insuficiente en Punto de venta: ${cantidadDisponible} < ${loteInfo.cantidad})`);
              console.log(`[LOTES][DEBUG] ❌ Stock insuficiente para lote ${loteInfo.lote}: ${cantidadDisponible} < ${loteInfo.cantidad}`);
              continue;
            }

            // Verificar que realmente esté en la ubicación correcta
            const locationId = loteConStock.location_id;
            console.log(`[LOTES][DEBUG] Lote ${loteInfo.lote}: quant.location_id=${locationId}, ubicacionPV.id=${ubicacionPV.id}`);

            if (locationId !== ubicacionPV.id) {
              lotesNoEncontrados.push(`${loteInfo.lote} (ubicación incorrecta: ${locationId} ≠ ${ubicacionPV.id})`);
              console.log(`[LOTES][DEBUG] ❌ Ubicación incorrecta para lote ${loteInfo.lote}: ${locationId} ≠ ${ubicacionPV.id}`);
              continue;
            }

            // Obtener el lot_id para la asignación
            const loteId = loteConStock.lot_id;

            // Aquí sí hay stock suficiente en Punto de venta, continuar con la asignación
            console.log(`[LOTES][ASIGNACIÓN] Asignando lote ${loteInfo.lote} desde ubicación ${ubicacionPV.id} (Punto de venta) con cantidad ${loteInfo.cantidad}`);

            const moveLineData = {
              move_id: mov.id,
              product_id: prodLote.productId,
              qty_done: loteInfo.cantidad,
              lot_id: loteId
            };

            try {
              const moveLineId = hacerConsultaOdoo('stock.move.line', 'create', [moveLineData], {}, sesionId);
              lotesAsignados.push(loteInfo.lote);
              console.log(`[LOTES][ASIGNACIÓN] ✅ Lote ${loteInfo.lote} asignado exitosamente desde Punto de venta`);
            } catch (errLote) {
              lotesErrores.push(`Error asignando lote ${loteInfo.lote}: ${errLote && errLote.message ? errLote.message : errLote}`);
              console.error(`[LOTES][ASIGNACIÓN] ❌ Error asignando lote ${loteInfo.lote}:`, errLote);
            }
          }
        }
        // Log final/resumen de asignación de lotes
        console.log(`[LOTES][ASIGNACIÓN][RESUMEN] Asignados: ${lotesAsignados.join(", ") || 'Ninguno'}, No encontrados: ${lotesNoEncontrados.join(", ") || 'Ninguno'}, Errores: ${lotesErrores.join("; ") || 'Ninguno'}`);
        if (lotesAsignados.length === 0) {
          hoja.getRange(filaPadre.numeroFila, 8).setValue("Aprobado");
          hoja.getRange(filaPadre.numeroFila, 9).setValue(`✅ Venta creada: ${recordName} #### ⚠️ No se pudo asignar ningún lote en la ubicación 'Punto de venta'. Lotes no encontrados: ${lotesNoEncontrados.join(", ")}. Errores: ${lotesErrores.join("; ")} [${fechaActual}]`);
          // No sumar como error, solo advertencia
          return { success: true, ventaId, recordName, fechaDespacho, fechaEntrega, mensajeFinal: `✅ Venta creada: ${recordName} #### ⚠️ No se pudo asignar ningún lote en la ubicación 'Punto de venta'. Lotes no encontrados: ${lotesNoEncontrados.join(", ")}. Errores: ${lotesErrores.join("; ")} [${fechaActual}]` };
        } else if (lotesNoEncontrados.length > 0 || lotesErrores.length > 0) {
          advertenciasLotes.push(`⚠️ Lotes asignados parcialmente. Asignados: ${lotesAsignados.join(", ")}. No encontrados: ${lotesNoEncontrados.join(", ")}. Errores: ${lotesErrores.join("; ")}`);
          lotesAsignadosParcial = true;
        } else {
          lotesAsignadosTodos = true;
        }
        // Eliminar comprobaciones de calidad (si existen)
        try {
          const qualityChecks = hacerConsultaOdoo('quality.check', 'web_search_read', [], {
            domain: [['picking_id', '=', pickingId]],
            specification: { id: {} },
            limit: 100,
            context: { lang: 'es_CO', tz: 'America/Lima' }
          }, sesionId);
          const qualityChecksRes = qualityChecks.records || qualityChecks;
          if (qualityChecksRes && qualityChecksRes.length > 0) {
            for (const qc of qualityChecksRes) {
              hacerConsultaOdoo('quality.check', 'unlink', [[qc.id]], {}, sesionId);
              console.log(`[QUALITY] Comprobación de calidad eliminada: ${qc.id}`);
            }
          }
        } catch (errQ) {
          advertenciasLotes.push(`[QUALITY] Error eliminando comprobaciones de calidad: ${errQ && errQ.message ? errQ.message : errQ}`);
        }
        // Verificar y limpiar lotes que no sean de "Punto de Venta"
        try {
          const verificacionLotes = verificarYLimpiarLotes(pickingId, empresaId, sesionId);
          if (verificacionLotes.success) {
            console.log(`[VERIFICACIÓN] ${verificacionLotes.message}`);
          } else {
            advertenciasLotes.push(`⚠️ Error en verificación de lotes: ${verificacionLotes.error}`);
          }
        } catch (errVerificacion) {
          advertenciasLotes.push(`⚠️ Error verificando lotes: ${errVerificacion && errVerificacion.message ? errVerificacion.message : errVerificacion}`);
        }

        // Validar el picking (entrega) - solo si no hay lotes asignados parcialmente
        if (!lotesAsignadosParcial) {
          try {
            hacerConsultaOdoo('stock.picking', 'button_validate', [[pickingId]], {}, sesionId);
            pickingValidado = true;
            console.log(`[LOTES] Picking validado automáticamente: ${pickingId}`);
          } catch (errV) {
            advertenciasLotes.push(`⚠️ Error validando picking: ${errV && errV.message ? errV.message : errV}`);
            validacionError = true;
          }
        } else {
          console.log(`[LOTES] Picking no validado automáticamente - se manejará con backorder`);
        }
      } else {
        hoja.getRange(filaPadre.numeroFila, 8).setValue("Rechazado");
        hoja.getRange(filaPadre.numeroFila, 9).setValue(`❌ No se encontró picking para la venta: ${recordName} [${fechaActual}]`);
        contadores.errores++;
        console.warn(`[LOTES] No se encontró picking para la venta: ${recordName}`);
        return;
      }
    } catch (errL) {
      hoja.getRange(filaPadre.numeroFila, 8).setValue("Rechazado");
      hoja.getRange(filaPadre.numeroFila, 9).setValue(`❌ Error en la asignación automática de lotes y validación: ${errL && errL.message ? errL.message : errL} [${fechaActual}]`);
      contadores.errores++;
      console.error('[LOTES] Error en la asignación automática de lotes y validación:', errL && errL.message ? errL.message : errL);
      return;
    }
    // === FIN ASIGNACIÓN AUTOMÁTICA DE LOTES ===
    // Construir mensaje final según el resultado
    if (!lotesAsignadosTodos && !lotesAsignadosParcial) {
      mensajeFinal = `✅ Venta creada: ${recordName} | No se pudo asignar lote(s) [${fechaDespacho} - ${fechaEntrega}]`;
    } else if (lotesAsignadosParcial) {
      // Validar picking y permitir que Odoo maneje automáticamente el backorder
      let backorderInfo = '';
      try {
        const backorderResult = validarPickingConBackorderAutomatico(pickingId, ventaId, sesionId);
        console.log(`[BACKORDER] Resultado:`, backorderResult);

        if (backorderResult.success) {
          backorderInfo = ` | Backorder: Creada`;
          console.log(`[BACKORDER] Backorder creada exitosamente`);
        } else {
          backorderInfo = ` | Backorder: Error - ${backorderResult.error || 'Error desconocido'}`;
          console.log(`[BACKORDER] Error: no se pudo crear backorder`);
        }
      } catch (errBackorder) {
        console.error('[BACKORDER] Error validando picking:', errBackorder);
        backorderInfo = ` | Backorder: Error - ${errBackorder.message || 'Error desconocido'}`;
      }

      // Construir mensaje con información detallada de lotes
      const lotesAsignadosList = lotesAsignados.join(', ');
      const lotesNoEncontradosList = lotesNoEncontrados.join(', ');
      const erroresList = lotesErrores.join('; ');

      mensajeFinal = `✅ Venta creada: ${recordName}${backorderInfo} | Lotes asignados parcialmente. ⚠️ Lotes asignados parcialmente. Asignados: ${lotesAsignadosList}. No encontrados: ${lotesNoEncontradosList}. Errores: ${erroresList} [${fechaDespacho} - ${fechaEntrega}]`;
      console.log(`[MENSAJE] Mensaje final construido: ${mensajeFinal}`);
    } else if (lotesAsignadosTodos && !pickingValidado) {
      mensajeFinal = `✅ Venta y lotes asignados: ${recordName} | No se pudo validar entrega [${fechaDespacho} - ${fechaEntrega}]`;
    } else if (lotesAsignadosTodos && pickingValidado) {
      // Crear factura en borrador usando el wizard sale.advance.payment.inv (igual que la interfaz de Odoo)
      let facturaCreada = false;
      let facturaId = null;
      let facturaError = null;
      try {
        // 1. Crear el wizard para facturación regular (productos entregados)
        const vals = {
          advance_payment_method: 'delivered',
          sale_order_ids: [[4, ventaId]],
          consolidated_billing: true
        };
        const specification = {};
        const wizardId = hacerConsultaOdoo(
          'sale.advance.payment.inv',
          'create',
          [vals],
          {},
          sesionId
        );
        console.log(`[FACTURA][WIZARD] Wizard creado con ID: ${wizardId}, vals:`, JSON.stringify(vals));
        // 2. Guardar el wizard (web_save)
        const webSaveRes = hacerConsultaOdoo(
          'sale.advance.payment.inv',
          'web_save',
          [[wizardId], vals, specification],
          { context: { active_ids: [ventaId], active_model: 'sale.order' } },
          sesionId
        );
        console.log(`[FACTURA][WEB_SAVE] Resultado de web_save:`, JSON.stringify(webSaveRes));
        // 3. Crear la factura (create_invoices)
        const facturaRes = hacerConsultaOdoo(
          'sale.advance.payment.inv',
          'create_invoices',
          [[wizardId]],
          { context: { active_ids: [ventaId], active_model: 'sale.order' } },
          sesionId
        );
        console.log(`[FACTURA][CREATE_INVOICES] Resultado de create_invoices:`, JSON.stringify(facturaRes));
        if (facturaRes && facturaRes.res_id) {
          console.log(`[FACTURA][CREADA] Factura creada con ID: ${facturaRes.res_id}`);
        }
        // 4. Considerar éxito si no hay error
        facturaCreada = true;
      } catch (errFactura) {
        console.error('[FACTURA][ERROR]', errFactura && errFactura.message ? errFactura.message : errFactura);
        facturaError = errFactura && errFactura.message ? errFactura.message : errFactura;
      }
      if (facturaCreada) {
        mensajeFinal = `✅ Venta, lotes, entrega y factura (borrador) creados: ${recordName} [${fechaDespacho} - ${fechaEntrega}]`;
      } else if (facturaError) {
        mensajeFinal = `✅ Venta, lotes y entrega validados: ${recordName} | ⚠️ Error creando factura: ${facturaError} [${fechaDespacho} - ${fechaEntrega}]`;
      } else {
        mensajeFinal = `✅ Venta, lotes y entrega validados: ${recordName} [${fechaDespacho} - ${fechaEntrega}]`;
      }
    } else {
      mensajeFinal = `✅ Venta creada: ${recordName} [${fechaDespacho} - ${fechaEntrega}]`;
    }

    return { success: true, ventaId, recordName, fechaDespacho, fechaEntrega, mensajeFinal };
  } catch (error) {
    console.error(`[VENTA] Error creando venta:`, error && error.message ? error.message : error);
    if (error && error.stack) console.error(`[VENTA] Stack:`, error.stack);
    return { success: false, error: error.message };
  }
}

/**
 * Busca los lotes y cantidades para un producto, cliente y empresa en la hoja 'TD'.
 * @param {string} cliente - Nombre del cliente (columna F de COMPRAS, columna T de TD)
 * @param {string} empresa - Nombre de la empresa (columna G de COMPRAS, columna S de TD)
 * @param {string} producto - Producto en formato '[codigo] nombre' (columna D de COMPRAS, columna U de TD)
 * @returns {Array<{lote: string, cantidad: number}>}
 */
function getLotesParaVenta(cliente, empresa, producto) {
  const hojaTD = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('TD');
  if (!hojaTD) {
    console.error('[LOTES] No se encontró la hoja TD');
    return [];
  }
  const datosTD = hojaTD.getDataRange().getValues();
  const lotes = [];
  let lastVendedor = '';
  let lastComprador = '';
  let lastProducto = '';
  for (let i = 1; i < datosTD.length; i++) { // Asume encabezados en la fila 1
    const fila = datosTD[i];
    let vendedorTD = String(fila[18] || '').trim(); // S = 18
    let compradorTD = String(fila[19] || '').trim(); // T = 19
    let productoTD = String(fila[20] || '').trim(); // U = 20
    const loteTD = String(fila[21] || '').trim(); // V = 21
    const cantidadTD = parseFloat(fila[22] || 0); // W = 22

    // Heredar valores del padre si la celda está vacía
    if (vendedorTD) lastVendedor = vendedorTD;
    else vendedorTD = lastVendedor;

    if (compradorTD) lastComprador = compradorTD;
    else compradorTD = lastComprador;

    if (productoTD) lastProducto = productoTD;
    else productoTD = lastProducto;

    // Extraer solo el nombre del productoTD si tiene formato [codigo] nombre
    let productoTDNombre = productoTD;
    const patron = /^\[[^\]]+\]\s*(.+)$/;
    const match = productoTD.match(patron);
    if (match) productoTDNombre = match[1].trim();

    // Comparación flexible: quitar espacios y minúsculas
    const vendedorTDComp = vendedorTD.replace(/\s+/g, '').toLowerCase();
    const empresaComp = empresa.replace(/\s+/g, '').toLowerCase();
    const compradorTDComp = compradorTD.replace(/\s+/g, '').toLowerCase();
    const clienteComp = cliente.replace(/\s+/g, '').toLowerCase();
    const productoTDNombreComp = productoTDNombre.replace(/\s+/g, '').toLowerCase();
    const productoComp = producto.replace(/\s+/g, '').toLowerCase();

    if (
      vendedorTDComp === empresaComp &&
      compradorTDComp === clienteComp &&
      productoTDNombreComp === productoComp
    ) {
      lotes.push({ lote: loteTD, cantidad: cantidadTD });
    }
  }
  if (lotes.length > 0) {
    console.log(`[LOTES][RESUMEN] Lotes encontrados para cliente='${cliente}', empresa='${empresa}', producto='${producto}': ${JSON.stringify(lotes)}`);
  } else {
    console.log(`[LOTES][RESUMEN] No se encontraron lotes para cliente='${cliente}', empresa='${empresa}', producto='${producto}'`);
  }
  return lotes;
}

/**
 * Asigna los lotes a los movimientos de stock de un picking en Odoo.
 * @param {number} pickingId - ID del picking (entrega) generado por la venta
 * @param {Array<{productId: number, lotes: Array<{lote: string, cantidad: number}>}>} productosLotes - Lista de productos con sus lotes y cantidades
 * @param {string} sesionId - Sesión activa de Odoo
 */
function asignarLotesEnOdoo(pickingId, productosLotes, sesionId) {
  try {
    // Obtener los movimientos de stock del picking usando web_search_read con specification
    const movimientos = hacerConsultaOdoo('stock.move', 'web_search_read', [], {
      domain: [['picking_id', '=', pickingId]],
      specification: {
        id: {},
        product_id: {},
        product_uom_qty: {},
        move_line_ids: {}
      },
      limit: 100,
      context: { lang: 'es_CO', tz: 'America/Lima' }
    }, sesionId);
    const movs = movimientos.records || movimientos; // por compatibilidad

    for (const prodLote of productosLotes) {
      // Comparación robusta de product_id
      const mov = movs.find(m => {
        let pid = m.product_id;
        if (Array.isArray(pid)) return pid[0] === prodLote.productId;
        if (typeof pid === 'object' && pid !== null && 'id' in pid) return pid.id === prodLote.productId;
        return pid === prodLote.productId;
      });
      if (!mov) {
        continue;
      }

      for (const loteInfo of prodLote.lotes) {
        // Obtener la ubicación del picking
        const picking = hacerConsultaOdoo('stock.picking', 'read', [[pickingId]], {
          fields: ['location_id']
        }, sesionId);

        if (!picking || picking.length === 0) {
          continue;
        }

        const ubicacionPicking = picking[0].location_id[0]; // location_id es un array [id, name]

        // Usar la misma lógica eficiente de búsqueda que en diagnosticarLote210625
        const quantsConStock = hacerConsultaOdoo('stock.quant', 'web_search_read', [], {
          domain: ["&", "&", ["product_id", "=", prodLote.productId], ["location_id", "child_of", ubicacionPicking], "&", ["on_hand", "=", true], ["quantity", ">", 0]],
          specification: {
            id: {},
            product_id: { fields: { display_name: {} } },
            quantity: {},
            location_id: { fields: { display_name: {} } },
            company_id: { fields: { display_name: {} } },
            lot_id: { fields: { display_name: {} } },
            package_id: { fields: { display_name: {} } },
            product_uom_id: { fields: { display_name: {} } }
          },
          limit: 80,
          context: {
            lang: 'es_CO',
            tz: 'America/Lima',
            bin_size: true,
            single_product: true,
            tree_view_ref: "stock.view_stock_quant_tree_simple",
            count_limit: 10001
          }
        }, sesionId);

        // Filtrar solo los lotes que coinciden con el nombre del lote requerido
        const lotesConStock = quantsConStock.records ? quantsConStock.records.filter(quant =>
          quant.lot_id && quant.lot_id.display_name === loteInfo.lote
        ) : [];

        if (lotesConStock.length === 0) {
          continue;
        }

        // Encontrar el lote con stock suficiente
        let loteIdConStock = null;
        for (const quant of lotesConStock) {
          if (quant.quantity >= loteInfo.cantidad) {
            loteIdConStock = quant.lot_id.id;
            break;
          }
        }

        if (!loteIdConStock) {
          continue;
        }

        // Crear o actualizar la línea de movimiento con el lote y cantidad
        const moveLineData = {
          move_id: mov.id,
          product_id: prodLote.productId,
          qty_done: loteInfo.cantidad,
          lot_id: loteIdConStock
        };

        // Crear la línea de movimiento (stock.move.line)
        const moveLineId = hacerConsultaOdoo('stock.move.line', 'create', [moveLineData], {}, sesionId);
      }
    }

    // Verificar y limpiar lotes que no sean de "Punto de Venta"
    try {
      // Obtener la empresa del picking para la verificación
      const picking = hacerConsultaOdoo('stock.picking', 'read', [[pickingId], ['company_id']], {}, sesionId);
      if (picking && picking.length > 0) {
        const empresaId = Array.isArray(picking[0].company_id) ? picking[0].company_id[0] : picking[0].company_id;
        const verificacionLotes = verificarYLimpiarLotes(pickingId, empresaId, sesionId);
        if (verificacionLotes.success) {
          console.log(`[ASIGNACIÓN] ${verificacionLotes.message}`);
        }
      }
    } catch (error) {
      console.error('[ASIGNACIÓN] Error en verificación de lotes:', error);
    }

    // Forzar qty_done en todas las líneas si es necesario (ya no usar product_uom_qty)
    const moveLines = hacerConsultaOdoo('stock.move.line', 'web_search_read', [], {
      domain: [['picking_id', '=', pickingId]],
      specification: {
        id: {},
        qty_done: {}
      },
      limit: 100,
      context: { lang: 'es_CO', tz: 'America/Lima' }
    }, sesionId);
    const moveLinesRes = moveLines.records || moveLines;
    // Si necesitas forzar qty_done, hazlo aquí según tu lógica
  } catch (error) {
    console.error('[LOTES] Error asignando lotes en Odoo:', error && error.message ? error.message : error);
    if (error && error.stack) console.error('[LOTES] Stack:', error.stack);
  }
}

// ========================================
// VERIFICACIÓN Y LIMPIEZA DE LOTES
// ========================================
/**
 * Verifica que todos los lotes asignados sean de ubicaciones "Punto de Venta" y elimina los que no lo sean
 * @param {number} pickingId - ID del picking (entrega)
 * @param {number} empresaId - ID de la empresa
 * @param {string} sesionId - ID de sesión de Odoo
 * @returns {Object} Resultado de la verificación
 */
function verificarYLimpiarLotes(pickingId, empresaId, sesionId) {
  try {
    // Obtener todas las líneas de movimiento del picking
    const moveLines = hacerConsultaOdoo('stock.move.line', 'web_search_read', [], {
      domain: [['picking_id', '=', pickingId]],
      specification: {
        id: {},
        product_id: { fields: { display_name: {} } },
        lot_id: { fields: { display_name: {} } },
        location_id: { fields: { display_name: {} } },
        qty_done: {}
      },
      limit: 100,
      context: { lang: 'es_CO', tz: 'America/Lima' }
    }, sesionId);

    const moveLinesRes = moveLines.records || moveLines;
    if (!moveLinesRes || moveLinesRes.length === 0) {
      return { success: true, message: 'No hay líneas de movimiento para verificar' };
    }

    // Obtener ubicaciones "Punto de Venta" para la empresa
    const ubicacionesPV = hacerConsultaOdoo('stock.location', 'web_search_read', [], {
      domain: [['name', 'ilike', 'Punto de venta'], ['company_id', '=', empresaId]],
      specification: { id: {}, name: {}, company_id: {} },
      limit: 10,
      context: { lang: 'es_CO', tz: 'America/Lima' }
    }, sesionId);

    const ubicacionesPVRes = ubicacionesPV.records || ubicacionesPV;
    const ubicacionesPVIds = ubicacionesPVRes.map(upv => upv.id);

    let lotesEliminados = [];
    let lotesCorrectos = [];

    for (const moveLine of moveLinesRes) {
      if (!moveLine.lot_id) continue; // Solo verificar líneas con lotes

      // Verificar si el lote está en una ubicación "Punto de Venta"
      const quantsLote = hacerConsultaOdoo('stock.quant', 'web_search_read', [], {
        domain: [
          ['lot_id', '=', moveLine.lot_id.id],
          ['product_id', '=', moveLine.product_id.id],
          ['location_id', 'in', ubicacionesPVIds],
          ['quantity', '>', 0]
        ],
        specification: {
          id: {},
          location_id: { fields: { display_name: {} } },
          quantity: {}
        },
        limit: 1,
        context: { lang: 'es_CO', tz: 'America/Lima' }
      }, sesionId);

      const quantsLoteRes = quantsLote.records || quantsLote;

      if (!quantsLoteRes || quantsLoteRes.length === 0) {
        // El lote no está en "Punto de Venta", eliminarlo
        try {
          hacerConsultaOdoo('stock.move.line', 'unlink', [[moveLine.id]], {}, sesionId);
          lotesEliminados.push({
            lote: moveLine.lot_id.display_name,
            producto: moveLine.product_id.display_name,
            cantidad: moveLine.qty_done
          });
        } catch (error) {
          console.error(`[VERIFICACIÓN] Error eliminando línea de movimiento ${moveLine.id}:`, error);
        }
      } else {
        // El lote está en "Punto de Venta", es correcto
        lotesCorrectos.push({
          lote: moveLine.lot_id.display_name,
          producto: moveLine.product_id.display_name,
          ubicacion: quantsLoteRes[0].location_id.display_name,
          cantidad: moveLine.qty_done
        });
      }
    }

    return {
      success: true,
      lotesCorrectos,
      lotesEliminados,
      message: `Verificación completada. Lotes de hojas válidos: ${lotesCorrectos.length}`
    };

  } catch (error) {
    console.error('[VERIFICACIÓN] Error verificando lotes:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Valida el picking y permite que Odoo maneje automáticamente el backorder
 * @param {number} pickingId - ID del picking (entrega)
 * @param {number} ventaId - ID de la venta
 * @param {string} sesionId - ID de sesión de Odoo
 * @returns {Object} Resultado de la validación
 */
function validarPickingConBackorderAutomatico(pickingId, ventaId, sesionId) {
  try {
    // Obtener información del picking
    const picking = hacerConsultaOdoo('stock.picking', 'read', [[pickingId], ['name', 'origin', 'state']], {}, sesionId);
    if (!picking || picking.length === 0) {
      return { success: false, error: 'No se encontró el picking' };
    }

    const pickingInfo = picking[0];
    console.log(`[BACKORDER] Validando picking: ${pickingInfo.name}, estado: ${pickingInfo.state}`);

    // Validar el picking - Odoo puede devolver un wizard de confirmación
    const validationResult = hacerConsultaOdoo('stock.picking', 'button_validate', [[pickingId]], {}, sesionId);
    //console.log(`[BACKORDER] Validación completada:`, validationResult);

    // Si la validación devuelve un wizard de backorder, procesarlo automáticamente
    if (validationResult && validationResult.res_model === 'stock.backorder.confirmation') {
      //console.log(`[BACKORDER] Wizard de backorder detectado, procesando automáticamente...`);

      // Extraer datos del contexto del wizard
      const context = validationResult.context || {};
      const pickIds = context.default_pick_ids || [];

      if (pickIds.length > 0) {
        // Crear el wizard con los datos proporcionados
        const wizardData = {
          pick_ids: pickIds,
          show_transfers: context.default_show_transfers || false
        };

        //console.log(`[BACKORDER] Wizard data:`, wizardData);

        let wizardId;
        try {
          wizardId = hacerConsultaOdoo('stock.backorder.confirmation', 'create', [wizardData], {}, sesionId);
          console.log(`[BACKORDER] Wizard creado con ID: ${wizardId}`);
        } catch (errCreate) {
          console.error('[BACKORDER] Error creando wizard:', errCreate);
          // Intentar con formato alternativo
          const wizardDataAlt = {
            pick_ids: [[6, 0, pickIds.map(p => p[1])]],
            show_transfers: context.default_show_transfers || false
          };
          console.log(`[BACKORDER] Intentando con formato alternativo:`, wizardDataAlt);
          wizardId = hacerConsultaOdoo('stock.backorder.confirmation', 'create', [wizardDataAlt], {}, sesionId);
          console.log(`[BACKORDER] Wizard creado con ID (formato alternativo): ${wizardId}`);
        }

        // Obtener la empresa del picking para filtrar correctamente
        const pickingCompanyInfo = hacerConsultaOdoo('stock.picking', 'read', [[pickingId], ['company_id']], {}, sesionId);
        const pickingCompanyId = pickingCompanyInfo && pickingCompanyInfo.length > 0 ?
          (Array.isArray(pickingCompanyInfo[0].company_id) ? pickingCompanyInfo[0].company_id[0] : pickingCompanyInfo[0].company_id) :
          3; // Default a empresa ID 3 si no se puede obtener

        // Guardar el wizard (web_save) para procesar los datos
        const webSaveResult = hacerConsultaOdoo('stock.backorder.confirmation', 'web_save', [[wizardId], wizardData, {}], {
          context: {
            active_id: context.active_id,
            active_ids: context.active_ids || [context.active_id],
            active_model: context.active_model || 'sale.order',
            button_validate_picking_ids: context.button_validate_picking_ids,
            default_group_id: context.default_group_id,
            default_origin: context.default_origin,
            default_partner_id: context.default_partner_id,
            default_pick_ids: context.default_pick_ids,
            default_picking_type_id: context.default_picking_type_id,
            default_show_transfers: context.default_show_transfers,
            lang: 'es_CO',
            tz: 'America/Lima',
            uid: 14,
            allowed_company_ids: [pickingCompanyId],
            current_company_id: pickingCompanyId
          }
        }, sesionId);
        console.log(`[BACKORDER] Wizard guardado:`, webSaveResult);



        // Procesar el wizard para crear el backorder
        const processResult = hacerConsultaOdoo('stock.backorder.confirmation', 'process', [[wizardId]], {
          context: {
            active_id: context.active_id,
            active_ids: context.active_ids || [context.active_id],
            active_model: context.active_model || 'sale.order',
            button_validate_picking_ids: context.button_validate_picking_ids,
            lang: 'es_CO',
            tz: 'America/Lima',
            uid: 14,
            allowed_company_ids: [pickingCompanyId],
            current_company_id: pickingCompanyId
          }
        }, sesionId);
        console.log(`[BACKORDER] Wizard procesado:`, processResult);

        // Si process devuelve true, el backorder se creó exitosamente
        if (processResult === true) {
          console.log(`[BACKORDER] Backorder creada exitosamente`);

          // Limpiar lotes del backorder después de su creación usando la función específica
          try {
            console.log(`[BACKORDER] Limpiando lotes del backorder después de su creación...`);
            limpiarLotesBackorderVenta(pickingInfo.origin, sesionId);
            console.log(`[BACKORDER] Limpieza completada para venta: ${pickingInfo.origin}`);
          } catch (errLimpiarPost) {
            console.error('[BACKORDER] Error limpiando backorder después de crear:', errLimpiarPost);
          }

          return { success: true };
        } else {
          console.log(`[BACKORDER] Error en process:`, processResult);
          return { success: false, error: 'Error procesando wizard' };
        }
      } else {
        return { success: false, error: 'No se encontraron pick_ids en el contexto' };
      }
    } else {
      // Si no hay wizard, el picking se validó sin backorder
      console.log(`[BACKORDER] Picking validado sin backorder`);
      return { success: true };
    }

  } catch (error) {
    console.error('[BACKORDER] Error validando picking:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Limpia los lotes de los backorders de una venta específica
 * @param {string} ventaName - Nombre de la venta (ej: S07263)
 * @param {string} sesionId - ID de sesión de Odoo
 */
function limpiarLotesBackorderVenta(ventaName, sesionId) {
  try {
    console.log(`[LIMPIAR] Buscando backorders para venta: ${ventaName}`);

    // Buscar pickings de la venta con estado 'assigned' (que tienen lotes asignados)
    const pickings = hacerConsultaOdoo('stock.picking', 'web_search_read', [], {
      domain: [
        ['origin', '=', ventaName],
        ['state', '=', 'assigned']
      ],
      specification: { id: {}, name: {}, state: {}, origin: {} },
      limit: 10,
      context: { lang: 'es_CO', tz: 'America/Lima' }
    }, sesionId);

    const pickingsRes = pickings.records || pickings;
    //console.log(`[LIMPIAR] Pickings encontrados con estado 'assigned':`, pickingsRes);

    if (pickingsRes && pickingsRes.length > 0) {
      for (const picking of pickingsRes) {
        console.log(`[LIMPIAR] Limpiando lotes del picking: ${picking.name} (ID: ${picking.id})`);

        // Obtener las líneas de movimiento del picking
        const moveLines = hacerConsultaOdoo('stock.move.line', 'web_search_read', [], {
          domain: [['picking_id', '=', picking.id]],
          specification: { id: {}, lot_id: {}, qty_done: {}, product_id: {} },
          limit: 100,
          context: { lang: 'es_CO', tz: 'America/Lima' }
        }, sesionId);

        const moveLinesRes = moveLines.records || moveLines;
        //console.log(`[LIMPIAR] Líneas de movimiento encontradas: ${moveLinesRes.length}`);

        // Eliminar todas las líneas de movimiento con lotes
        for (const moveLine of moveLinesRes) {
          if (moveLine.lot_id) {
            try {
              hacerConsultaOdoo('stock.move.line', 'unlink', [[moveLine.id]], {}, sesionId);
              //console.log(`[LIMPIAR] Línea de movimiento eliminada: ${moveLine.id} (Producto: ${moveLine.product_id})`);
            } catch (errUnlink) {
              console.error(`[LIMPIAR] Error eliminando línea ${moveLine.id}:`, errUnlink);
            }
          }
        }

        console.log(`[LIMPIAR] Picking ${picking.name} limpiado - sin lotes asignados`);
      }
    } else {
      console.log(`[LIMPIAR] No se encontraron pickings con estado 'assigned' para la venta ${ventaName}`);
    }
  } catch (error) {
    console.error('[LIMPIAR] Error limpiando lotes de backorders:', error);
  }
}

// ========================================
// UTILIDADES
// ========================================
function mostrarResumenVentas(contadores) {
  const mensaje = `🛒 RESUMEN DE PROCESAMIENTO DE VENTAS\n\n📊 TOTALES:\n✅ Ventas creadas: ${contadores.creadas}\n✔️ Ya procesadas: ${contadores.yaProcesadas}\n❌ Errores: ${contadores.errores}`;
  console.log(mensaje);
  SpreadsheetApp.getUi().alert(mensaje);
}

/**
 * Valida si existe una venta para el cliente/empresa/quincena y compara productos/cantidades
 * @param {Object} datosVenta - Datos de la venta actual
 * @param {Array} productosActuales - Productos de la venta actual
 * @param {string} sesionId - Sesión de Odoo
 * @returns {Object} - Resultado de la validación
 */
function validarVentaExistente(datosVenta, productosActuales, sesionId) {
  try {
    const rango = obtenerRangoQuincena(datosVenta.fechaDespacho);
    const clienteId = validarCliente(datosVenta.cliente, sesionId, null);
    const empresaInfo = validarEmpresa(datosVenta.empresa, sesionId);

    if (!clienteId || !empresaInfo.valida) {
      return { existe: false, cambios: false, ventaExistente: null };
    }

    // Buscar ventas existentes para el cliente/empresa/quincena
    const ventasExistentes = hacerConsultaOdoo(
      'sale.order',
      'web_search_read',
      [],
      {
        domain: [
          ['partner_id', '=', clienteId],
          ['company_id', '=', empresaInfo.empresaId],
          ['commitment_date', '>=', rango.inicio],
          ['commitment_date', '<=', rango.fin]
        ],
        specification: {
          id: {},
          name: {},
          state: {},
          commitment_date: {},
          order_line: { fields: { product_id: {}, product_uom_qty: {}, name: {} } }
        },
        limit: 10,
        context: { lang: 'es_CO', tz: 'America/Lima' }
      },
      sesionId
    );

    const ventasRes = ventasExistentes.records || ventasExistentes;
    if (!ventasRes || ventasRes.length === 0) {
      return { existe: false, cambios: false, ventaExistente: null };
    }

    // Si hay ventas existentes, comparar productos y cantidades
    for (const ventaExistente of ventasRes) {
      const productosExistentes = ventaExistente.order_line || [];

      // Comparar productos y cantidades
      const cambios = compararProductosYcantidades(productosActuales, productosExistentes);

      if (!cambios) {
        // No hay cambios, es la misma venta
        return {
          existe: true,
          cambios: false,
          ventaExistente: ventaExistente,
          mensaje: `✔️ Venta ya existente en Odoo: ${ventaExistente.name}`
        };
      } else {
        // Hay cambios, es una venta diferente - no decir nada, solo crear nueva
        return {
          existe: false,
          cambios: false,
          ventaExistente: null,
          cambiosDetectados: cambios,
          mensaje: null
        };
      }
    }

    return { existe: false, cambios: false, ventaExistente: null };
  } catch (error) {
    console.error('[VALIDACIÓN VENTA] Error validando venta existente:', error);
    return { existe: false, cambios: false, ventaExistente: null, error: error.message };
  }
}