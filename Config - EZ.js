// ========================================
// CONFIGURACIÓN Programacion EZ - EMPRESA ELIANA MARINA ZAIA SILVA
// ========================================

function obtenerConfiguracionEZ() {
  return {
    NOMBRE: "Programacion EZ",
    
    ODOO: {
      DIARIO_ID: 97, //EGRESO
      METODO_PAGO_ID: 50, //Bancolombia 5173
      EMPRESA_ID: 1  // ID único de la empresa
    },

    // Solo hay una empresa, no necesitamos mapeo
    EMPRESAS: {
      PRINCIPAL: {
        ID: 1,
        NOMBRE: "ELIANA MARINA ZAIA SILVA",
        DIARIO_ID: 97, //EGRESO
        METODO_PAGO_ID: 50 //Bancolombia 5173

      }
    },

    COLUMNAS: {
      PROVEEDOR: 2,    // C (índice 2 en array 0-based)
      FACTURA: 6,      // G (índice 6 en array 0-based)  
      COMUNICACION: 7, // H (índice 7 en array 0-based)
      MONTO: 9,        // J (índice 9 en array 0-based)
      CHECKBOX: 10,    // K (índice 10 en array 0-based)
      DIARIO: 11,     // L (índice 11 en array 0-based)
      MENSAJES: 12     // M (índice 11 en array 0-based)
    },

    FILA_INICIO: 7,
    PREFIJOS_VALIDOS: ["FC", "DE"],
    PREFIJOS_VALIDOS_B: ["ARR", "OPV"],
    PREFIJOS_VALIDOS_C: ["Liquidación"]
  };
}
