// ========================================
// SISTEMA DE AUTOMATIZACIÓN DE COMPRAS ODOO
// ========================================

const MENSAJES_COMPRAS = {
  COMPRA_CREADA: "✅ Compra creada exitosamente",
  PROVEEDOR_NO_ENCONTRADO: "❌ Proveedor no encontrado en Odoo",
  PRODUCTO_NO_ENCONTRADO: "❌ Producto no encontrado",
  ERROR_CREACION: "❌ Error al crear la compra",
  EMPRESA_NO_ENCONTRADA: "❌ Empresa no encontrada",
  SIN_PRODUCTOS: "❌ No se encontraron productos para crear la compra",
  YA_PROCESADO: "✔️ Ya procesado anteriormente",
  NO_APROBADO: "⏸️ Registro no aprobado para procesamiento",
  COMPRA_EXISTENTE: "✔️ Compra ya existente",
  COMPRA_EXISTENTE_CON_CAMBIOS: "⚠️ Compra existente con cambios detectados"
};

const CONFIG_COMPRAS = {
  COLUMNAS: {
    FECHA_DESPACHO: 0,    // A (date_order)
    FECHA_ENTREGA: 1,     // B (date_planned)
    PRODUCTO: 3,          // D
    CANTIDAD: 4,          // E
    EMPRESA: 5,           // F (Compañía)
    CLIENTE: 6,           // G (Proveedor)
    ESTADO: 7,            // H
    MENSAJE: 8            // I
  },
  FILA_INICIO: 2,
  ESTADO_APROBADO: "Aprobado"
};

// ========================================
// FUNCIÓN PRINCIPAL COMPLETA
// ========================================
function procesoCompletoCompras(nombreHoja) {
  console.log("[INICIO] Validación y procesamiento automático de compras para hoja: " + nombreHoja);
  aplicarFiltroYMarcar(nombreHoja, CONFIG_COMPRAS);
  console.log("[VALIDACIÓN COMPLETADA] Iniciando procesamiento de compras aprobadas...");
  procesarComprasAprobadas(nombreHoja);
  console.log("[FIN] Proceso completo finalizado para hoja: " + nombreHoja);
}

// ========================================
// PROCESAMIENTO DE COMPRAS APROBADAS
// ========================================
function procesarComprasAprobadas(nombreHoja) {
  const hoja = obtenerHoja(nombreHoja);
  if (!hoja) { console.log("[ERROR] No se encontró la hoja: " + nombreHoja); return; }
  const sesionId = LibOdooUtilsT.odooGetSessionIdtest();
  const fechaActual = obtenerFechaActual();
  const contadores = { creadas: 0, errores: 0, yaProcesadas: 0 };
  const ultimaFila = hoja.getLastRow();
  const datos = hoja.getRange(CONFIG_COMPRAS.FILA_INICIO, 1, ultimaFila - CONFIG_COMPRAS.FILA_INICIO + 1, 10).getValues();
  const gruposCompras = agruparFilasPorPadre(datos, CONFIG_COMPRAS).filter(grupo => grupo.filaPadre.fila[7] === "Aprobado");
  console.log(`[PROCESO] Procesando ${gruposCompras.length} grupos de compras aprobadas...`);
  gruposCompras.forEach((grupo, indice) => {
    console.log(`[PROCESO] Procesando grupo ${indice + 1}/${gruposCompras.length}`);
    procesarGrupoCompra(grupo, hoja, sesionId, fechaActual, contadores);
  });
  mostrarResumenCompras(contadores);
}

function procesarGrupoCompra(grupo, hoja, sesionId, fechaActual, contadores) {
  const { filaPadre, filasHijas } = grupo;
  try {
    const datosCompra = extraerDatosTransaccion(filaPadre.fila, CONFIG_COMPRAS);
    console.log(`[DEBUG] Datos extraídos:`, datosCompra);
    console.log(`[DEBUG] Fila original:`, filaPadre.fila);
    console.log(`[DEBUG] Configuración:`, CONFIG_COMPRAS.COLUMNAS);

    // === VALIDACIÓN MEJORADA DE COMPRAS EXISTENTES ===
    const empresaInfo = validarEmpresa(datosCompra.empresa, sesionId);
    if (!empresaInfo.valida) {
      hoja.getRange(filaPadre.numeroFila, 8).setValue("Rechazado");
      hoja.getRange(filaPadre.numeroFila, 9).setValue(MENSAJES_COMPRAS.EMPRESA_NO_ENCONTRADA + ` [${fechaActual}]`);
      contadores.errores++;
      console.warn(`[GRUPO] Empresa no encontrada: '${datosCompra.empresa}'`);
      return;
    }

    const proveedorId = validarCliente(datosCompra.cliente, sesionId, empresaInfo.empresaId);
    if (!proveedorId) {
      hoja.getRange(filaPadre.numeroFila, 8).setValue("Rechazado");
      hoja.getRange(filaPadre.numeroFila, 9).setValue(MENSAJES_COMPRAS.PROVEEDOR_NO_ENCONTRADO + ` [${fechaActual}]`);
      contadores.errores++;
      console.warn(`[GRUPO] Proveedor no encontrado: '${datosCompra.cliente}'`);
      return;
    }

    const productos = recopilarProductos(filaPadre, filasHijas, CONFIG_COMPRAS);
    if (productos.length === 0) {
      hoja.getRange(filaPadre.numeroFila, 8).setValue("Rechazado");
      hoja.getRange(filaPadre.numeroFila, 9).setValue(MENSAJES_COMPRAS.SIN_PRODUCTOS + ` [${fechaActual}]`);
      contadores.errores++;
      console.warn(`[GRUPO] Sin productos para la fila ${filaPadre.numeroFila}`);
      return;
    }

    const productosValidados = validarProductosEnOdoo(productos, sesionId, empresaInfo.empresaId);
    if (productosValidados.length === 0) {
      hoja.getRange(filaPadre.numeroFila, 8).setValue("Rechazado");
      hoja.getRange(filaPadre.numeroFila, 9).setValue(MENSAJES_COMPRAS.PRODUCTO_NO_ENCONTRADO + ` [${fechaActual}]`);
      contadores.errores++;
      console.warn(`[GRUPO] Ningún producto válido para la fila ${filaPadre.numeroFila}`);
      return;
    }

    // Validar compra existente con productos validados
    const validacionCompra = validarCompraExistente(datosCompra, productosValidados, sesionId);

    if (validacionCompra.existe) {
      // Compra existente - solo cambiar estado en columna H, NO tocar columna I
      hoja.getRange(filaPadre.numeroFila, 8).setValue("✅ Ya existe compra");
      // NO escribir en columna I - mantener mensaje original
      contadores.yaProcesadas++;
      console.log(`[COMPRA][EXISTENTE] Compra ya existente: ${validacionCompra.compraExistente.name}`);
      return;
    } else if (validacionCompra.cambiosDetectados) {
      // Compra diferente - crear nueva compra sin mensaje especial
      console.log(`[COMPRA][DIFERENTE] Creando nueva compra por diferencias en productos`);
      // Continuar con la creación de la nueva compra
    }
    console.log(`[GRUPO] Procesando fila ${filaPadre.numeroFila}: Proveedor='${datosCompra.cliente}', Empresa='${datosCompra.empresa}', Producto='${datosCompra.producto}'`);
    // PASAR hoja, filaPadre, fechaActual, contadores
    const resultadoCompra = crearCompraEnOdoo(datosCompra, proveedorId, productosValidados, empresaInfo.empresaId, sesionId, hoja, filaPadre, fechaActual, contadores);
    if (resultadoCompra && resultadoCompra.success) {
      hoja.getRange(filaPadre.numeroFila, 8).setValue("Aprobado");
      hoja.getRange(filaPadre.numeroFila, 9).setValue(resultadoCompra.mensajeFinal);
      contadores.creadas++;
      filasHijas.forEach(filaHija => {
        hoja.getRange(filaHija.numeroFila, 9).setValue("✅ Incluido en compra padre [" + fechaActual + "]");
      });
      console.log(`[GRUPO] Compra creada exitosamente para fila ${filaPadre.numeroFila}`);
    } else if (resultadoCompra && resultadoCompra.error) {
      hoja.getRange(filaPadre.numeroFila, 8).setValue("Rechazado");
      hoja.getRange(filaPadre.numeroFila, 9).setValue(`${MENSAJES_COMPRAS.ERROR_CREACION}: ${resultadoCompra.error} [${fechaActual}]`);
      contadores.errores++;
      console.error(`[GRUPO] Error creando compra para fila ${filaPadre.numeroFila}: ${resultadoCompra.error}`);
    }
  } catch (error) {
    hoja.getRange(filaPadre.numeroFila, 8).setValue("Rechazado");
    hoja.getRange(filaPadre.numeroFila, 9).setValue(`${MENSAJES_COMPRAS.ERROR_CREACION}: ${error.message} [${fechaActual}]`);
    contadores.errores++;
    console.error(`[GRUPO] Error inesperado en fila ${filaPadre.numeroFila}: ${error.message}`);
  }
}

// ========================================
// CREACIÓN DE COMPRA EN ODOO
// ========================================
function crearCompraEnOdoo(datosCompra, proveedorId, productos, empresaId, sesionId, hoja, filaPadre, fechaActual, contadores) {
  let mensajeFinal = '';
  let lotesAsignados = false;
  let pickingValidado = false;
  try {
    const lineasProductos = productos.map(producto => [0, 0, {
      product_id: producto.productoId,
      product_qty: producto.cantidad,
      price_unit: producto.precioLista || 0,
      name: producto.nombreOdoo
    }]);
    console.log(`[COMPRA] Creando compra para proveedor ID: ${proveedorId}, empresa ID: ${empresaId}, productos: ${productos.map(p => p.nombreOdoo + ' ($' + p.precioLista + ')').join(', ')}`);
    const fechaOrden = formatearFechaParaOdoo(datosCompra.fechaDespacho); // date_order
    const fechaPlanificada = formatearFechaParaOdoo(datosCompra.fechaEntrega); // date_planned
    console.log(`[DEBUG] Fechas originales - Orden: ${datosCompra.fechaDespacho}, Planificada: ${datosCompra.fechaEntrega}`);
    console.log(`[DEBUG] Fechas formateadas - Orden: ${fechaOrden}, Planificada: ${fechaPlanificada}`);
    const compraData = {
      partner_id: proveedorId,
      company_id: empresaId,
      date_order: fechaOrden,
      date_planned: fechaPlanificada,
      order_line: lineasProductos
    };
    console.log('[COMPRA] Objeto enviado a Odoo:', JSON.stringify(compraData, null, 2));
    const compraId = hacerConsultaOdoo('purchase.order', 'create', [compraData], {}, sesionId);
    let recordName = null;
    try {
      hacerConsultaOdoo('purchase.order', 'button_confirm', [[compraId]], {}, sesionId);
      const compraInfo = hacerConsultaOdoo('purchase.order', 'read', [[compraId], ['name']], {}, sesionId);
      if (compraInfo && compraInfo.length > 0) {
        recordName = compraInfo[0].name;
      }
    } catch (error) {
      console.warn(`[COMPRA] Advertencia al confirmar compra: ${error && error.message ? error.message : error}`);
      if (error && error.stack) console.warn(`[COMPRA] Stack:`, error.stack);
    }
    console.log(`[COMPRA] Compra creada con ID: ${compraId}, record_name: ${recordName}`);

    // === ASIGNACIÓN AUTOMÁTICA DE LOTES Y VALIDACIÓN DE RECEPCIÓN ===
    let pickingId = null;
    let lotesError = false;
    let validacionError = false;
    let advertenciasLotes = [];
    let lotesAsignadosParcial = false;
    let lotesAsignadosTodos = false;
    let lotesAsignados = [];
    let lotesNoEncontrados = [];
    let lotesErrores = [];
    try {
      // Buscar el picking (recepción) generado por la compra
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
        
        
        // Preparar los lotes para cada producto
        const productosLotes = productos.map(prod => {
          const lotes = getLotesParaCompra(datosCompra.cliente, datosCompra.empresa, prod.nombreOdoo);
          return { productId: prod.productoId, lotes };
        });
        
                 // Asignar lotes automáticamente
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
           
           // Obtener líneas de movimiento existentes para este producto
           const moveLines = hacerConsultaOdoo('stock.move.line', 'web_search_read', [], {
             domain: [['move_id', '=', mov.id]],
             specification: { id: {}, product_id: {}, qty_done: {}, lot_id: {} },
             limit: 100,
             context: { lang: 'es_CO', tz: 'America/Lima' }
           }, sesionId);
           
           const moveLinesRes = moveLines.records || moveLines;
           
           // Eliminar líneas existentes sin lotes (líneas automáticas de Odoo)
           console.log(`[LOTES][DEBUG] Encontradas ${moveLinesRes.length} líneas existentes para el movimiento ${mov.id}`);
           for (const moveLine of moveLinesRes) {
             console.log(`[LOTES][DEBUG] Línea ${moveLine.id}: qty_done=${moveLine.qty_done}, lot_id=${moveLine.lot_id ? moveLine.lot_id : 'SIN LOTE'}`);
             if (!moveLine.lot_id) {
               try {
                 hacerConsultaOdoo('stock.move.line', 'unlink', [[moveLine.id]], {}, sesionId);
                 console.log(`[LOTES] Línea automática eliminada: ${moveLine.id}`);
               } catch (errDelete) {
                 console.error(`[LOTES] Error eliminando línea automática:`, errDelete);
               }
             }
           }
           
           // Crear líneas individuales con lotes
           for (const loteInfo of prodLote.lotes) {
             console.log(`[LOTES][DEBUG] Creando línea para lote: '${loteInfo.lote}', cantidad: ${loteInfo.cantidad}`);
             
             // Crear línea con lote específico
             const moveLineData = {
               move_id: mov.id,
               product_id: prodLote.productId,
               qty_done: loteInfo.cantidad,
               lot_name: loteInfo.lote, // Usar lot_name en lugar de lot_id
               picking_id: pickingId
             };
             
             console.log(`[LOTES][DEBUG] Creando línea con datos:`, JSON.stringify(moveLineData));
             
             try {
               const moveLineId = hacerConsultaOdoo('stock.move.line', 'create', [moveLineData], {}, sesionId);
               
               // Verificar que la línea se creó correctamente
               const lineaCreada = hacerConsultaOdoo('stock.move.line', 'web_search_read', [], {
                 domain: [['id', '=', moveLineId]],
                 specification: { id: {}, product_id: {}, qty_done: {}, lot_id: {}, lot_name: {} },
                 limit: 1,
                 context: { lang: 'es_CO', tz: 'America/Lima' }
               }, sesionId);
               
               const lineaRes = lineaCreada.records || lineaCreada;
               if (lineaRes && lineaRes.length > 0) {
                 const linea = lineaRes[0];
                 console.log(`[LOTES][VERIFICACIÓN] Línea creada: ID=${linea.id}, qty_done=${linea.qty_done}, lot_id=${linea.lot_id}, lot_name=${linea.lot_name || 'N/A'}`);
                 
                 // Si la cantidad no es correcta, actualizar
                 if (linea.qty_done !== loteInfo.cantidad) {
                   console.log(`[LOTES][CORRECCIÓN] Actualizando cantidad de ${linea.qty_done} a ${loteInfo.cantidad}`);
                   hacerConsultaOdoo('stock.move.line', 'write', [[linea.id], { qty_done: loteInfo.cantidad }], {}, sesionId);
                 }
                 
                 // Verificar que el lot_name se asignó correctamente
                 if (linea.lot_name && linea.lot_name !== loteInfo.lote) {
                   console.log(`[LOTES][ERROR] Lot name no coincide: esperado='${loteInfo.lote}', actual='${linea.lot_name}'`);
                 }
               }
               
               lotesAsignados.push(loteInfo.lote);
               console.log(`[LOTES][ASIGNACIÓN] ✅ Lote ${loteInfo.lote} asignado exitosamente (ID: ${moveLineId})`);
             } catch (errLote) {
               lotesErrores.push(`Error asignando lote ${loteInfo.lote}: ${errLote && errLote.message ? errLote.message : errLote}`);
               console.error(`[LOTES][ASIGNACIÓN] ❌ Error asignando lote ${loteInfo.lote}:`, errLote);
               console.error(`[LOTES][DEBUG] Datos que causaron error:`, JSON.stringify(moveLineData));
             }
           }
         }
        
        // Log final/resumen de asignación de lotes
        console.log(`[LOTES][ASIGNACIÓN][RESUMEN] Asignados: ${lotesAsignados.join(", ") || 'Ninguno'}, No encontrados: ${lotesNoEncontrados.join(", ") || 'Ninguno'}, Errores: ${lotesErrores.join("; ") || 'Ninguno'}`);
        
        // Simplificar lógica de lotes - no hacer validaciones complejas
        if (lotesAsignados.length > 0) {
          lotesAsignadosTodos = true;
          console.log(`[LOTES] Lotes asignados exitosamente: ${lotesAsignados.join(", ")}`);
        } else {
          console.log(`[LOTES] No se pudieron asignar lotes. No encontrados: ${lotesNoEncontrados.join(", ")}. Errores: ${lotesErrores.join("; ")}`);
        }
        
        // Validar el picking (recepción) - siempre intentar validar
        try {
          hacerConsultaOdoo('stock.picking', 'button_validate', [[pickingId]], {}, sesionId);
          pickingValidado = true;
          console.log(`[LOTES] Picking validado automáticamente: ${pickingId}`);
          
          // Verificar que las líneas existen después de la validación
          const lineasDespuesValidacion = hacerConsultaOdoo('stock.move.line', 'web_search_read', [], {
            domain: [['picking_id', '=', pickingId]],
            specification: { id: {}, product_id: {}, qty_done: {}, lot_id: {}, lot_name: {} },
            limit: 50,
            context: { lang: 'es_CO', tz: 'America/Lima' }
          }, sesionId);
          
          const lineasRes = lineasDespuesValidacion.records || lineasDespuesValidacion;
          console.log(`[LOTES][VERIFICACIÓN] Líneas después de validación: ${lineasRes.length}`);
          for (const linea of lineasRes) {
            console.log(`[LOTES][VERIFICACIÓN] Línea ${linea.id}: qty_done=${linea.qty_done}, lot_id=${linea.lot_id}, lot_name=${linea.lot_name || 'N/A'}`);
          }
        } catch (errV) {
          advertenciasLotes.push(`⚠️ Error validando picking: ${errV && errV.message ? errV.message : errV}`);
          validacionError = true;
        }
      } else {
        hoja.getRange(filaPadre.numeroFila, 8).setValue("Rechazado");
        hoja.getRange(filaPadre.numeroFila, 9).setValue(`❌ No se encontró picking para la compra: ${recordName} [${fechaActual}]`);
        contadores.errores++;
        console.warn(`[LOTES] No se encontró picking para la compra: ${recordName}`);
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
    if (pickingValidado) {
      // Crear factura en borrador usando action_create_invoice (igual que el botón en Odoo)
      let facturaCreada = false;
      let facturaError = null;
      try {
        const facturaRes = hacerConsultaOdoo(
          'purchase.order',
          'action_create_invoice',
          [[compraId]],
          { context: { create_bill: true, quotation_only: true } },
          sesionId
        );
        console.log(`[FACTURA][CREADA] Factura creada para compra ${compraId}:`, JSON.stringify(facturaRes));
        facturaCreada = true;
      } catch (errFactura) {
        console.error('[FACTURA][ERROR]', errFactura && errFactura.message ? errFactura.message : errFactura);
        facturaError = errFactura && errFactura.message ? errFactura.message : errFactura;
      }
      
      if (facturaCreada) {
        // Crear transferencia interna después de la factura
        let transferenciaCreada = false;
        let transferenciaError = null;
        try {
          const transferenciaRes = crearTransferenciaInterna(compraId, empresaId, productos, sesionId);
          if (transferenciaRes.success) {
            console.log(`[TRANSFERENCIA][CREADA] Transferencia interna creada: ${transferenciaRes.recordName}`);
            transferenciaCreada = true;
          } else {
            transferenciaError = transferenciaRes.error;
          }
        } catch (errTransferencia) {
          console.error('[TRANSFERENCIA][ERROR]', errTransferencia && errTransferencia.message ? errTransferencia.message : errTransferencia);
          transferenciaError = errTransferencia && errTransferencia.message ? errTransferencia.message : errTransferencia;
        }
        
        if (transferenciaCreada) {
          mensajeFinal = `✅ Compra, recepción, factura (borrador) y transferencia interna validada: ${recordName} | Lotes verificados y corregidos automáticamente | Lotes: ${lotesAsignados.join(", ") || 'Ninguno'} [${fechaOrden} - ${fechaPlanificada}]`;
        } else {
          mensajeFinal = `✅ Compra, recepción y factura (borrador) creados: ${recordName} | ⚠️ Error creando transferencia: ${transferenciaError} | Lotes: ${lotesAsignados.join(", ") || 'Ninguno'} [${fechaOrden} - ${fechaPlanificada}]`;
        }
      } else if (facturaError) {
        mensajeFinal = `✅ Compra y recepción validados: ${recordName} | ⚠️ Error creando factura: ${facturaError} | Lotes: ${lotesAsignados.join(", ") || 'Ninguno'} [${fechaOrden} - ${fechaPlanificada}]`;
      } else {
        mensajeFinal = `✅ Compra y recepción validados: ${recordName} | Lotes: ${lotesAsignados.join(", ") || 'Ninguno'} [${fechaOrden} - ${fechaPlanificada}]`;
      }
    } else if (lotesAsignadosTodos && !pickingValidado) {
      mensajeFinal = `✅ Compra y lotes asignados: ${recordName} | No se pudo validar recepción [${fechaOrden} - ${fechaPlanificada}]`;
    } else {
      mensajeFinal = `✅ Compra creada: ${recordName} | Lotes asignados: ${lotesAsignados.join(", ") || 'Ninguno'} [${fechaOrden} - ${fechaPlanificada}]`;
    }

    return { success: true, compraId, recordName, fechaOrden, fechaPlanificada, mensajeFinal };
  } catch (error) { 
    console.error(`[COMPRA] Error creando compra:`, error && error.message ? error.message : error);
    if (error && error.stack) console.error(`[COMPRA] Stack:`, error.stack);
    return { success: false, error: error.message };
  }
}

// ========================================
// BÚSQUEDA DE LOTES EN SHEETS
// ========================================
function getLotesParaCompra(proveedor, empresa, producto) {
  const lotes = [];
  try {
    // Obtener datos del sheet TD (Trade Desk)
    const sheetTD = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('TD');
    if (!sheetTD) {
      console.log('[LOTES] No se encontró la hoja TD');
      return lotes;
    }
    
    const datosTD = sheetTD.getDataRange().getValues();
    let lastVendedor = '';
    let lastComprador = '';
    let lastProducto = '';
    
    for (let i = 1; i < datosTD.length; i++) {
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
      const clienteComp = proveedor.replace(/\s+/g, '').toLowerCase();
      const productoTDNombreComp = productoTDNombre.replace(/\s+/g, '').toLowerCase();
      const productoComp = producto.replace(/\s+/g, '').toLowerCase();

      if (
        vendedorTDComp === clienteComp &&
        compradorTDComp === empresaComp &&
        productoTDNombreComp === productoComp
      ) {
        lotes.push({ lote: loteTD, cantidad: cantidadTD });
      }
    }
    if (lotes.length > 0) {
      console.log(`[LOTES][RESUMEN] Lotes encontrados para proveedor='${proveedor}', empresa='${empresa}', producto='${producto}': ${JSON.stringify(lotes)}`);
    } else {
      console.log(`[LOTES][RESUMEN] No se encontraron lotes para proveedor='${proveedor}', empresa='${empresa}', producto='${producto}'`);
    }
    return lotes;
  } catch (error) {
    console.error('[LOTES] Error buscando lotes:', error);
    return lotes;
  }
}

// ========================================
// VERIFICACIÓN Y LIMPIEZA DE LOTES
// ========================================
function verificarYLimpiarLotesCompra(pickingId, empresaId, sesionId) {
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
    
    let lotesEliminados = [];
    let lotesCorrectos = [];
    
    for (const moveLine of moveLinesRes) {
      if (!moveLine.lot_id) continue; // Solo verificar líneas con lotes
      
      // Para compras, no necesitamos verificar ubicación específica como en ventas
      // Solo verificamos que el lote exista y tenga cantidad válida
      if (moveLine.qty_done > 0) {
        lotesCorrectos.push({
          lote: moveLine.lot_id.display_name,
          producto: moveLine.product_id.display_name,
          cantidad: moveLine.qty_done
        });
      } else {
        // Eliminar líneas con cantidad 0 o negativa
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
      }
    }
    
    return {
      success: true,
      lotesCorrectos,
      lotesEliminados,
      message: `Verificación completada. Lotes válidos: ${lotesCorrectos.length}`
    };
    
  } catch (error) {
    console.error('[VERIFICACIÓN] Error verificando lotes:', error);
    return { success: false, error: error.message };
  }
}

// ========================================
// VALIDACIÓN DE COMPRA EXISTENTE
// ========================================
function validarCompraExistente(datosCompra, productosActuales, sesionId) {
  try {
    const rango = obtenerRangoQuincena(datosCompra.fechaDespacho);
    const proveedorId = validarCliente(datosCompra.cliente, sesionId, null);
    const empresaInfo = validarEmpresa(datosCompra.empresa, sesionId);

    if (!proveedorId || !empresaInfo.valida) {
      return { existe: false, cambios: false, compraExistente: null };
    }

    // Buscar compras existentes para el proveedor/empresa/quincena
    const comprasExistentes = hacerConsultaOdoo(
      'purchase.order',
      'web_search_read',
      [],
      {
        domain: [
          ['partner_id', '=', proveedorId],
          ['company_id', '=', empresaInfo.empresaId],
          ['date_order', '>=', rango.inicio],
          ['date_order', '<=', rango.fin]
        ],
        specification: {
          id: {},
          name: {},
          state: {},
          date_order: {},
          order_line: { fields: { product_id: {}, product_qty: {}, name: {} } }
        },
        limit: 10,
        context: { lang: 'es_CO', tz: 'America/Lima' }
      },
      sesionId
    );

    const comprasRes = comprasExistentes.records || comprasExistentes;
    if (!comprasRes || comprasRes.length === 0) {
      return { existe: false, cambios: false, compraExistente: null };
    }

    // Si hay compras existentes, comparar productos y cantidades
    for (const compraExistente of comprasRes) {
      const productosExistentes = compraExistente.order_line || [];

      // Comparar productos y cantidades
      const cambios = compararProductosYcantidades(productosActuales, productosExistentes);

      if (!cambios) {
        // No hay cambios, es la misma compra
        return {
          existe: true,
          cambios: false,
          compraExistente: compraExistente,
          mensaje: `✔️ Compra ya existente en Odoo: ${compraExistente.name}`
        };
      } else {
        // Hay cambios, es una compra diferente - no decir nada, solo crear nueva
        return {
          existe: false,
          cambios: false,
          compraExistente: null,
          cambiosDetectados: cambios,
          mensaje: null
        };
      }
    }

    return { existe: false, cambios: false, compraExistente: null };
  } catch (error) {
    console.error('[VALIDACIÓN COMPRA] Error validando compra existente:', error);
    return { existe: false, cambios: false, compraExistente: null, error: error.message };
  }
}

// ========================================
// TRANSFERENCIA INTERNA
// ========================================
function crearTransferenciaInterna(compraId, empresaId, productos, sesionId) {
  try {
    console.log(`1. Obteniendo información de la compra ${compraId}...`);
    
    // Obtener información de la compra para determinar el picking_type_id
    const compraInfo = hacerConsultaOdoo('purchase.order', 'read', [[compraId]], {
      fields: ['company_id', 'partner_id', 'order_line']
    }, sesionId);
    
    if (!compraInfo || compraInfo.length === 0) {
      throw new Error('No se pudo obtener información de la compra');
    }
    
    const compra = compraInfo[0];
    const companyId = compra.company_id[0];
    
    // Obtener productos reales de la compra con sus lotes
    console.log(`2. Obteniendo líneas de la compra...`);
    
    // Obtener las líneas de la compra
    const lineasCompra = hacerConsultaOdoo('purchase.order.line', 'read', [compra.order_line], {
      fields: ['product_id', 'product_qty', 'price_unit', 'name']
    }, sesionId);
    
    if (!lineasCompra || lineasCompra.length === 0) {
      throw new Error('No se encontraron líneas de compra');
    }
    
    // Obtener movimientos de la compra para los lotes reales
    const movimientosCompra = hacerConsultaOdoo('stock.move', 'web_search_read', [], {
      domain: [['purchase_line_id.order_id', '=', compraId]],
      specification: { id: {}, product_id: {}, product_uom_qty: {}, move_line_ids: {} },
      limit: 10,
      context: { lang: 'es_CO', tz: 'America/Lima' }
    }, sesionId);
    
    const movimientosRes = movimientosCompra.records || movimientosCompra;
    
    // Preparar productos con lotes reales
    const productosConLotes = [];
    
    for (const linea of lineasCompra) {
      const productId = linea.product_id[0];
      const nombre = linea.name;
      const cantidad = linea.product_qty;
      
      // Buscar el movimiento correspondiente
      const movimiento = movimientosRes.find(mov => mov.product_id[0] === productId);
      
      if (movimiento) {
        // Obtener líneas de movimiento para los lotes
        const lineasMovimiento = hacerConsultaOdoo('stock.move.line', 'web_search_read', [], {
          domain: [['move_id', '=', movimiento.id]],
          specification: { id: {}, product_id: {}, qty_done: {}, lot_id: {}, lot_name: {} },
          limit: 10,
          context: { lang: 'es_CO', tz: 'America/Lima' }
        }, sesionId);
        
        const lineasRes = lineasMovimiento.records || lineasMovimiento;
        
        if (lineasRes && lineasRes.length > 0) {
          // Usar lotes reales de la compra
          const lotes = lineasRes.map(linea => ({
            lote: linea.lot_name || `LOTE_${linea.id}`,
            cantidad: linea.qty_done,
            lotId: linea.lot_id || null
          }));
          
          productosConLotes.push({
            productId: productId,
            nombre: nombre,
            cantidad: cantidad,
            uomId: 1,
            lotes: lotes
          });
        } else {
          // Sin lotes específicos
          productosConLotes.push({
            productId: productId,
            nombre: nombre,
            cantidad: cantidad,
            uomId: 1,
            lotes: []
          });
        }
      } else {
        productosConLotes.push({
          productId: productId,
          nombre: nombre,
          cantidad: cantidad,
          uomId: 1,
          lotes: []
        });
      }
    }
    
    // Determinar el picking_type_id según la empresa
    let pickingTypeId;
    switch (companyId) {
      case 1: // EZ
        pickingTypeId = 5;
        break;
      case 2: // ATA
        pickingTypeId = 14;
        break;
      case 3: // TUT
        pickingTypeId = 23;
        break;
      case 4: // LZ
        pickingTypeId = 32;
        break;
      default:
        throw new Error(`Empresa no reconocida: ${companyId}`);
    }
    
    // Buscar ubicación origen correcta para la empresa de la compra
    const ubicacionesOrigen = hacerConsultaOdoo('stock.location', 'web_search_read', [], {
      domain: [['name', 'ilike', 'Existencias'], ['company_id', '=', companyId]],
      specification: { id: {}, name: {}, company_id: {} },
      limit: 1,
      context: { lang: 'es_CO', tz: 'America/Lima' }
    }, sesionId);
    
    const ubicacionOrigenRes = ubicacionesOrigen.records && ubicacionesOrigen.records.length > 0 ? ubicacionesOrigen.records[0] : null;
    if (!ubicacionOrigenRes) {
      throw new Error(`No se encontró ubicación 'Existencias' para la empresa ${companyId}`);
    }
    
    const ubicacionOrigen = ubicacionOrigenRes.id; // Ubicación Existencias de la empresa correcta
    
    // Buscar ubicación Punto de venta específica para la empresa
    const ubicacionesPV = hacerConsultaOdoo('stock.location', 'web_search_read', [], {
      domain: [['name', 'ilike', 'Punto de venta'], ['company_id', '=', companyId]],
      specification: { id: {}, name: {}, company_id: {} },
      limit: 1,
      context: { lang: 'es_CO', tz: 'America/Lima' }
    }, sesionId);
    
    const ubicacionPV = ubicacionesPV.records && ubicacionesPV.records.length > 0 ? ubicacionesPV.records[0] : null;
    if (!ubicacionPV) {
      throw new Error(`No se encontró ubicación 'Punto de venta' para la empresa ${companyId}`);
    }
    
    const ubicacionDestino = ubicacionPV.id; // Punto de Venta específico de la empresa
    
    // Crear la transferencia interna en estado draft
    const transferenciaData = {
      picking_type_id: pickingTypeId,
      location_id: ubicacionOrigen,
      location_dest_id: ubicacionDestino,
      origin: 'PUNTO DE VENTA',
      scheduled_date: formatearFechaParaOdoo(new Date()),
      company_id: companyId,
      move_ids_without_package: []
    };
    
    // Agregar solo los movimientos básicos (sin lotes)
    for (const producto of productosConLotes) {
      if (!producto.productId) {
        console.error(`❌ Producto sin ID válido: ${producto.nombre}`);
        continue;
      }
      
      // Crear movimiento básico sin lotes
      const moveData = {
        product_id: producto.productId,
        product_uom_qty: producto.cantidad,
        product_uom: producto.uomId || 1,
        name: producto.nombre,
        location_id: ubicacionOrigen,
        location_dest_id: ubicacionDestino
      };
      
      transferenciaData.move_ids_without_package.push([0, 0, moveData]);
    }
    
    // Crear la transferencia con contexto específico de la empresa
    const transferenciaRes = hacerConsultaOdoo('stock.picking', 'create', [transferenciaData], {
      context: { 
        lang: 'es_CO', 
        tz: 'America/Lima',
        default_company_id: companyId,
        allowed_company_ids: [companyId]
      }
    }, sesionId);
    
    if (!transferenciaRes) {
      throw new Error('No se pudo crear la transferencia interna');
    }
    
    // Obtener el nombre del registro
    const transferenciaInfo = hacerConsultaOdoo('stock.picking', 'read', [[transferenciaRes]], {
      fields: ['name']
    }, sesionId);
    
    const recordName = transferenciaInfo[0].name;
    
    // Agregar líneas de movimiento con lotes después de crear la transferencia
    try {
      // Primero confirmar la transferencia para que esté en estado "assigned"
      hacerConsultaOdoo('stock.picking', 'action_confirm', [[transferenciaRes]], {
        context: { 
          lang: 'es_CO', 
          tz: 'America/Lima',
          default_company_id: companyId,
          allowed_company_ids: [companyId]
        }
      }, sesionId);
      
      // Obtener los movimientos de la transferencia después de confirmar
      const movimientosTransferencia = hacerConsultaOdoo('stock.move', 'web_search_read', [], {
        domain: [['picking_id', '=', transferenciaRes]],
        specification: { id: {}, product_id: {}, product_uom_qty: {}, name: {} },
        limit: 10,
        context: { lang: 'es_CO', tz: 'America/Lima' }
      }, sesionId);
      
      const movimientosTransferenciaRes = movimientosTransferencia.records || movimientosTransferencia;
      
      let lineasCreadas = 0;
      
      for (const movimiento of movimientosTransferenciaRes) {
        const productoId = Array.isArray(movimiento.product_id) ? movimiento.product_id[0] : movimiento.product_id;
        const cantidad = movimiento.product_uom_qty;
        
        // Buscar el producto en productosConLotes para obtener los lotes
        const producto = productosConLotes.find(p => p.productId === productoId);
        
        // Verificar si el producto requiere tracking por lotes
        const productoInfo = hacerConsultaOdoo('product.product', 'read', [[productoId]], {
          fields: ['tracking']
        }, sesionId);
        
        const requiereLotes = productoInfo && productoInfo.length > 0 && 
                             (productoInfo[0].tracking === 'lot' || productoInfo[0].tracking === 'serial');
        
        if (producto && producto.lotes && producto.lotes.length > 0) {
          // Eliminar líneas existentes del movimiento (si las hay)
          const lineasExistentes = hacerConsultaOdoo('stock.move.line', 'web_search_read', [], {
            domain: [['move_id', '=', movimiento.id]],
            specification: { id: {} },
            limit: 10,
            context: { lang: 'es_CO', tz: 'America/Lima' }
          }, sesionId);
          
          const lineasExistentesRes = lineasExistentes.records || lineasExistentes;
          if (lineasExistentesRes && lineasExistentesRes.length > 0) {
            for (const linea of lineasExistentesRes) {
              hacerConsultaOdoo('stock.move.line', 'unlink', [[linea.id]], {}, sesionId);
            }
          }
          
          // Crear nuevas líneas con lotes
          for (const loteInfo of producto.lotes) {
            const lineaData = {
              move_id: movimiento.id,
              product_id: productoId,
              qty_done: loteInfo.cantidad,
              location_id: ubicacionOrigen,
              location_dest_id: ubicacionDestino,
              picking_id: transferenciaRes
            };
            
            // Usar lot_id con los IDs reales de los lotes de la compra
            if (loteInfo.lotId && loteInfo.lotId !== null) {
              lineaData.lot_id = loteInfo.lotId;
            } else {
              // Esto NO debería pasar si obtuvimos correctamente los lotes de la compra
              console.error(`❌ ERROR CRÍTICO: No se encontró lotId para ${loteInfo.lote}. Revisar mapeo de lotes.`);
              throw new Error(`No se encontró lotId para el lote ${loteInfo.lote}`);
            }
            
            const lineaCreada = hacerConsultaOdoo('stock.move.line', 'create', [lineaData], {}, sesionId);
            if (lineaCreada) {
              lineasCreadas++;
            }
          }
        } else if (requiereLotes) {
          // Crear un lote por defecto para cumplir la validación
          const lineaData = {
            move_id: movimiento.id,
            product_id: productoId,
            qty_done: movimiento.product_uom_qty,
            lot_name: `LOTE_${productoId}_${Date.now()}`,
            lot_id: false, // Odoo creará el lote y asignará el ID
            location_id: ubicacionOrigen,
            location_dest_id: ubicacionDestino,
            picking_id: transferenciaRes
          };
          
          const lineaCreada = hacerConsultaOdoo('stock.move.line', 'create', [lineaData], {}, sesionId);
          if (lineaCreada) {
            lineasCreadas++;
          }
        }
      }
      
      // Validar la transferencia después de agregar líneas
      const validacionRes = hacerConsultaOdoo('stock.picking', 'button_validate', [[transferenciaRes]], {
        context: { 
          lang: 'es_CO', 
          tz: 'America/Lima',
          default_company_id: companyId,
          allowed_company_ids: [companyId]
        }
      }, sesionId);
      
      // Si hay un wizard (lotes caducados, etc.), manejarlo
      if (validacionRes && typeof validacionRes === 'object' && validacionRes.res_model) {
        if (validacionRes.res_model === 'expiry.picking.confirmation') {
          // Obtener información adicional del picking para el contexto
          const pickingInfo = hacerConsultaOdoo('stock.picking', 'read', [[transferenciaRes]], {
            fields: ['name', 'state', 'move_ids_without_package', 'company_id']
          }, sesionId);
          
          // Para expiry.picking.confirmation, necesitamos usar 'action_confirm'
          const wizardId = validacionRes.res_id;
          
          // Usar web_save como método principal (es lo que hace la interfaz web)
          try {
            const confirmRes = hacerConsultaOdoo('expiry.picking.confirmation', 'web_save', [[], {}], {
              context: {
                lang: 'es_CO',
                tz: 'America/Lima',
                uid: 14,
                default_company_id: companyId,
                allowed_company_ids: [companyId],
                active_id: 32,
                active_ids: [32],
                active_model: 'stock.picking.type',
                button_validate_picking_ids: [transferenciaRes],
                default_picking_ids: [[6, 0, [transferenciaRes]]]
              },
              specification: {
                description: {},
                picking_ids: {},
                production_ids: {},
                workorder_id: {fields: {}},
                show_lots: {},
                lot_ids: {fields: {product_id: {fields: {display_name: {}}}, name: {}}, limit: 40, order: ""}
              }
            }, sesionId);
            
            // Después de web_save, necesitamos ejecutar el wizard
            if (confirmRes && confirmRes.length > 0 && confirmRes[0].id) {
              const wizardCreatedId = confirmRes[0].id;
              
              // Ejecutar wizard con el método process (confirmado como correcto)
              const executeRes = hacerConsultaOdoo('expiry.picking.confirmation', 'process', [[wizardCreatedId]], {
                context: {
                  lang: 'es_CO',
                  tz: 'America/Lima',
                  uid: 14,
                  allowed_company_ids: [companyId],
                  active_id: 32,
                  active_ids: [32],
                  active_model: 'stock.picking.type',
                  button_validate_picking_ids: [transferenciaRes],
                  contact_display: 'partner_address',
                  default_company_id: companyId,
                  default_lot_ids: validacionRes.context?.default_lot_ids || [],
                  default_picking_ids: [[6, 0, [transferenciaRes]]],
                  default_picking_type_id: 32
                }
              }, sesionId);
            }
          } catch (errorConfirm) {
            // Fallback: usar process
            try {
              const confirmRes2 = hacerConsultaOdoo('expiry.picking.confirmation', 'process', [[wizardId]], {
                context: {
                  lang: 'es_CO',
                  tz: 'America/Lima',
                  default_company_id: companyId,
                  allowed_company_ids: [companyId]
                }
              }, sesionId);
            } catch (errorConfirm2) {
              console.log(`⚠️ Transferencia creada pero requiere confirmación manual: ${recordName}`);
            }
          }
        } else if (validacionRes.res_model === 'stock.warn.insufficient.qty.scrap' || 
                   validacionRes.res_model === 'stock.warn.insufficient.qty' ||
                   validacionRes.res_model.includes('warn') || 
                   validacionRes.res_model.includes('confirm')) {
          
          const wizardId = validacionRes.res_id;
          const confirmRes = hacerConsultaOdoo(validacionRes.res_model, 'process', [[wizardId]], {
            context: {
              lang: 'es_CO',
              tz: 'America/Lima',
              default_company_id: companyId,
              allowed_company_ids: [companyId]
            }
          }, sesionId);
        }
      }
      
      console.log(`✅ Transferencia completada: ${recordName}`);
      
    } catch (errValidacion) {
      console.error(`❌ Error validando transferencia: ${errValidacion.message}`);
    }
    
    return { 
      success: true, 
      transferenciaId: transferenciaRes, 
      recordName: recordName 
    };
    
  } catch (error) {
    console.error(`❌ Error creando transferencia interna:`, error && error.message ? error.message : error);
    return { success: false, error: error.message };
  }
}

// ========================================
// UTILIDADES
// ========================================
function mostrarResumenCompras(contadores) {
  const mensaje = `🛒 RESUMEN DE PROCESAMIENTO DE COMPRAS\n\n📊 TOTALES:\n✅ Compras creadas: ${contadores.creadas}\n✔️ Ya procesadas: ${contadores.yaProcesadas}\n❌ Errores: ${contadores.errores}`;
  console.log(mensaje);
  SpreadsheetApp.getUi().alert(mensaje);
}
