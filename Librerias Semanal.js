/**
 * Extensión de la librería para obtener órdenes de producción por semana.
 * Funciones para manejar órdenes de producción filtrando por semana (Lunes a Domingo).
 * Maneja correctamente las fechas para órdenes con misma referencia base
 */

// Extender el objeto LibOdooAPIs existente Para la Funcion Semanal General
Object.assign(LibOdooAPIs, {
  /**
   * Obtiene las órdenes de producción completadas de una semana específica.
   * Por defecto obtiene la semana anterior a la actual.
   * 
   * @param {string} session_id - ID de sesión activo de Odoo (cookie "session_id")
   * @param {number} semanaOffset - Offset de semanas (0 = semana actual, -1 = semana anterior, etc.)
   * @returns {Object[]} - Lista de órdenes de producción con los campos solicitados.
   * @throws {Error} - Lanza error si Odoo devuelve un mensaje de error.
   */
  getOrdenesProduccionCompletadasSemana: function (session_id, semanaOffset = -1) {
    // Obtener órdenes de la semana principal
    const ordenesSemana = this.obtenerOrdenesSemana(session_id, semanaOffset);

    // Procesar órdenes: validar grupos y completar con semanas siguientes
    const ordenesCompletas = this.procesarOrdenesConValidacionGrupos(session_id, ordenesSemana, semanaOffset);

    // Obtener componentes para cada orden
    const ordenesConComponentes = ordenesCompletas.map(orden => {
      if (orden.move_raw_ids && orden.move_raw_ids.length > 0) {
        const componentes = this.obtenerComponentesOrden(session_id, orden.move_raw_ids);
        return { ...orden, componentes };
      }
      return { ...orden, componentes: [] };
    });

    return ordenesConComponentes;
  },

  /**
   * Obtiene órdenes de una semana específica (función auxiliar)
   * 
   * @param {string} session_id - ID de sesión activo de Odoo
   * @param {number} semanaOffset - Offset de semanas
   * @returns {Object[]} - Array de órdenes de la semana
   */
  obtenerOrdenesSemana: function(session_id, semanaOffset) {
    // URL al endpoint web_search_read de Odoo
    const url = odooBaseUrl + '/web/dataset/call_kw/mrp.production/web_search_read';

    // Obtener fechas de la semana en formato UTC con hora 05:00:00
    const fechas = this.obtenerFechasSemanaUTC(semanaOffset);

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
            ["picking_type_id.active", "=", true],
            ["state", "=", "done"],
            ["date_start", ">=", fechas.fechaInicioSemanaUTC],
            ["date_start", "<", fechas.fechaFinSemanaUTC]
          ],
          limit: odooRegistrosLimite,
          context: { lang: "es_CO", tz: "UTC" },
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
      throw new Error("Error al obtener órdenes de producción por semana: " + JSON.stringify(result.error));
    }

    // web_search_read devuelve los datos en result.records
    const ordenes = result.result.records || [];

    // Convertir fechas de UTC a zona horaria -5 (America/Bogota)
    return ordenes.map(orden => {
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
  },

  /**
   * Procesa órdenes validando grupos y completando con semanas siguientes
   * 
   * @param {string} session_id - ID de sesión activo de Odoo
   * @param {Object[]} ordenesSemana - Órdenes de la semana principal
   * @param {number} semanaOffset - Offset de la semana principal
   * @returns {Object[]} - Órdenes procesadas y completas
   */
  procesarOrdenesConValidacionGrupos: function(session_id, ordenesSemana, semanaOffset) {
    // Separar órdenes con y sin sufijo -###
    const ordenesConSufijo = [];
    const ordenesSinSufijo = [];
    
    ordenesSemana.forEach(orden => {
      if (/-(\d{3})$/.test(orden.name)) {
        ordenesConSufijo.push(orden);
      } else {
        ordenesSinSufijo.push(orden);
      }
    });

    // Agrupar órdenes con sufijo por referencia base
    const gruposPorReferencia = {};
    ordenesConSufijo.forEach(orden => {
      const referenciaBase = this.extraerReferenciaBase(orden.name);
      if (!gruposPorReferencia[referenciaBase]) {
        gruposPorReferencia[referenciaBase] = [];
      }
      gruposPorReferencia[referenciaBase].push(orden);
    });

    // Procesar cada grupo
    const ordenesValidadas = [];
    Object.keys(gruposPorReferencia).forEach(referenciaBase => {
      const grupo = gruposPorReferencia[referenciaBase];
      // Verificar si existe la orden padre (termina en -001)
      const ordenPadre = grupo.find(orden => orden.name.endsWith('-001'));
      if (!ordenPadre) {
        // Si no hay orden padre, eliminar todo el grupo (no agregar nada)
        console.log(`⚠️ Grupo ${referenciaBase} eliminado: no se encontró orden padre (-001)`);
        return;
      }
      // Si hay orden padre, buscar órdenes faltantes en las dos semanas siguientes
      const grupoCompleto = this.completarGrupoConSemanasPosteriores(
        session_id,
        referenciaBase,
        grupo,
        semanaOffset,
        2 // Solo buscar en las dos semanas siguientes
      );
      // Normalizar fechas del grupo completo con la fecha del padre
      const grupoNormalizado = this.normalizarFechasConPadre(grupoCompleto, ordenPadre);
      ordenesValidadas.push(...grupoNormalizado);
    });
    // Devolver las órdenes validadas (agrupadas y normalizadas) + las que no tienen sufijo
    return [...ordenesValidadas, ...ordenesSinSufijo];
  },

  /**
   * Completa un grupo buscando órdenes faltantes en semanas posteriores
   * @param {string} session_id - ID de sesión activo de Odoo
   * @param {string} referenciaBase - Referencia base del grupo
   * @param {Object[]} grupoActual - Órdenes ya encontradas del grupo
   * @param {number} semanaOffset - Offset de la semana original
   * @param {number} maxSemanasBuscar - Máximo de semanas hacia adelante para buscar
   * @returns {Object[]} - Grupo completo con órdenes de múltiples semanas
   */
  completarGrupoConSemanasPosteriores: function(session_id, referenciaBase, grupoActual, semanaOffset, maxSemanasBuscar = 2) {
    let grupoCompleto = [...grupoActual];
    let semanaActual = semanaOffset + 1; // Empezar en la semana siguiente
    // Obtener números de secuencia ya encontrados
    const secuenciasEncontradas = new Set();
    grupoActual.forEach(orden => {
      const numeroSecuencia = this.extraerNumeroSecuencia(orden.name);
      if (numeroSecuencia) {
        secuenciasEncontradas.add(numeroSecuencia);
      }
    });
    // Buscar en semanas posteriores (solo maxSemanasBuscar veces)
    for (let i = 0; i < maxSemanasBuscar; i++) {
      try {
        const ordenesSemanaPosterior = this.obtenerOrdenesSemana(session_id, semanaActual + i);
        // Filtrar órdenes que pertenezcan al mismo grupo
        const ordenesGrupo = ordenesSemanaPosterior.filter(orden => {
          const referenciaOrden = this.extraerReferenciaBase(orden.name);
          return referenciaOrden === referenciaBase && /-(\d{3})$/.test(orden.name);
        });
        // Agregar órdenes nuevas (que no tengamos ya)
        ordenesGrupo.forEach(orden => {
          const numeroSecuencia = this.extraerNumeroSecuencia(orden.name);
          if (numeroSecuencia && !secuenciasEncontradas.has(numeroSecuencia)) {
            grupoCompleto.push(orden);
            secuenciasEncontradas.add(numeroSecuencia);
            console.log(`✅ Orden ${orden.name} encontrada en semana ${semanaActual + i} y agregada al grupo`);
          }
        });
      } catch (error) {
        console.log(`⚠️ Error buscando en semana ${semanaActual + i}: ${error.message}`);
        break;
      }
    }
    return grupoCompleto;
  },

  /**
   * Extrae el número de secuencia de una orden (-001, -002, etc.)
   * 
   * @param {string} nombreOrden - Nombre completo de la orden
   * @returns {string|null} - Número de secuencia o null si no se encuentra
   */
  extraerNumeroSecuencia: function(nombreOrden) {
    if (!nombreOrden) {
      return null;
    }
    
    const patron = /-(\d{3})$/;
    const match = nombreOrden.match(patron);
    
    return match ? match[1] : null;
  },

  /**
   * Normaliza fechas de un grupo usando la fecha del padre (-001)
   * 
   * @param {Object[]} grupo - Array de órdenes del grupo
   * @param {Object} ordenPadre - Orden padre (-001) con la fecha de referencia
   * @returns {Object[]} - Grupo con fechas normalizadas
   */
  normalizarFechasConPadre: function(grupo, ordenPadre) {
    const fechaInicioPadre = ordenPadre.date_start;
    const fechaFinPadre = ordenPadre.date_finished;
    
    return grupo.map(orden => {
      const ordenNormalizada = { ...orden };
      
      if (fechaInicioPadre) {
        ordenNormalizada.date_start = fechaInicioPadre;
      }
      
      if (fechaFinPadre) {
        ordenNormalizada.date_finished = fechaFinPadre;
      }
      
      return ordenNormalizada;
    });
  },



  /**
   * Extrae la referencia base de una orden de producción.
   * Ejemplo: "TUT/MO/01274-001" -> "TUT/MO/01274"
   * 
   * @param {string} nombreOrden - Nombre completo de la orden
   * @returns {string} - Referencia base sin el sufijo
   */
  extraerReferenciaBase: function(nombreOrden) {
    if (!nombreOrden) {
      return nombreOrden;
    }
    
    // Buscar el patrón -XXX al final (donde XXX son 3 dígitos)
    const patron = /^(.+)-\d{3}$/;
    const match = nombreOrden.match(patron);
    
    if (match) {
      return match[1]; // Devolver la parte antes del -XXX
    }
    
    // Si no encuentra el patrón, devolver el nombre completo
    return nombreOrden;
  },

  /**
   * Función auxiliar para obtener las fechas de inicio y fin de la semana en UTC con hora 05:00:00.
   * La semana va de Lunes a Domingo.
   * 
   * @param {number} semanaOffset - Offset de semanas (0 = semana actual, -1 = semana anterior, etc.)
   * @returns {Object} - Objeto con fechas en formato UTC para la búsqueda.
   */
  obtenerFechasSemanaUTC: function (semanaOffset = -1) {
    const ahora = new Date();
    
    // Obtener el día de la semana (0 = Domingo, 1 = Lunes, ..., 6 = Sábado)
    const diaSemana = ahora.getDay();
    
    // Calcular cuántos días hay que restar para llegar al lunes
    // Si es domingo (0), necesitamos restar 6 días para llegar al lunes anterior
    // Si es lunes (1), necesitamos restar 0 días
    // Si es martes (2), necesitamos restar 1 día, etc.
    const diasHastaLunes = diaSemana === 0 ? 6 : diaSemana - 1;
    
    // Calcular el lunes de la semana actual
    const lunesActual = new Date(ahora);
    lunesActual.setDate(ahora.getDate() - diasHastaLunes);
    
    // Aplicar el offset de semanas
    const lunesObjetivo = new Date(lunesActual);
    lunesObjetivo.setDate(lunesActual.getDate() + (semanaOffset * 7));
    
    // Calcular el domingo (fin de semana)
    const domingoObjetivo = new Date(lunesObjetivo);
    domingoObjetivo.setDate(lunesObjetivo.getDate() + 6);
    
    // Formatear fechas para Odoo (formato UTC con hora 05:00:00)
    const fechaInicioSemanaUTC = this.formatearFechaParaOdoo(lunesObjetivo);
    const fechaFinSemanaUTC = this.formatearFechaParaOdoo(new Date(domingoObjetivo.getTime() + 24 * 60 * 60 * 1000)); // Lunes siguiente

    return {
      fechaInicioSemanaUTC: fechaInicioSemanaUTC,
      fechaFinSemanaUTC: fechaFinSemanaUTC,
      lunesObjetivo: lunesObjetivo,
      domingoObjetivo: domingoObjetivo
    };
  },

  /**
   * Formatea una fecha para usar en consultas de Odoo (formato UTC con hora 05:00:00).
   * 
   * @param {Date} fecha - Fecha a formatear
   * @returns {string} - Fecha en formato "YYYY-MM-DD 05:00:00"
   */
  formatearFechaParaOdoo: function (fecha) {
    const año = fecha.getFullYear();
    const mes = String(fecha.getMonth() + 1).padStart(2, '0');
    const dia = String(fecha.getDate()).padStart(2, '0');
    
    return `${año}-${mes}-${dia} 05:00:00`;
  },

  /**
   * Formatea una fecha para mostrar en logs (formato legible).
   * 
   * @param {Date} fecha - Fecha a formatear
   * @returns {string} - Fecha en formato "DD/MM/YYYY"
   */
  formatearFechaParaMostrar: function (fecha) {
    const dia = String(fecha.getDate()).padStart(2, '0');
    const mes = String(fecha.getMonth() + 1).padStart(2, '0');
    const año = fecha.getFullYear();
    
    return `${dia}/${mes}/${año}`;
  },

  /**
   * Obtiene información sobre la semana actual y otras semanas útiles.
   * 
   * @returns {Object} - Información sobre diferentes semanas
   */
  obtenerInfoSemanas: function () {
    const semanaActual = this.obtenerFechasSemanaUTC(0);
    const semanaAnterior = this.obtenerFechasSemanaUTC(-1);
    const semanaSiguiente = this.obtenerFechasSemanaUTC(1);
    
    return {
      actual: {
        ...semanaActual,
        descripcion: `Semana actual: ${this.formatearFechaParaMostrar(semanaActual.lunesObjetivo)} a ${this.formatearFechaParaMostrar(semanaActual.domingoObjetivo)}`
      },
      anterior: {
        ...semanaAnterior,
        descripcion: `Semana anterior: ${this.formatearFechaParaMostrar(semanaAnterior.lunesObjetivo)} a ${this.formatearFechaParaMostrar(semanaAnterior.domingoObjetivo)}`
      },
      siguiente: {
        ...semanaSiguiente,
        descripcion: `Semana siguiente: ${this.formatearFechaParaMostrar(semanaSiguiente.lunesObjetivo)} a ${this.formatearFechaParaMostrar(semanaSiguiente.domingoObjetivo)}`
      }
    };
  }
});

/**
 * Función de ejemplo para probar la funcionalidad.
 * Muestra información sobre las semanas disponibles.
 */
function mostrarInfoSemanas() {
  const info = LibOdooAPIs.obtenerInfoSemanas();
  
  console.log("=== INFORMACIÓN DE SEMANAS ===");
  console.log(info.anterior.descripcion);
  console.log(info.actual.descripcion);
  console.log(info.siguiente.descripcion);
  
  return info;
}