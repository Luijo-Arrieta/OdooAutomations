// ========================================
// CONFIGURACIÓN Programación SAS - MÚLTIPLES EMPRESAS
// ========================================

function obtenerConfiguracionSAS() {
  return {
    NOMBRE: "Programación SAS",

    // Mapeo de empresas por nombre en columna B
    EMPRESAS: {
      EMPRESA_2: {
        ID: 2,
        NOMBRE: "ALIMENTOS TRADICIÓN ARTESANAL S.A.S",  // Texto que aparece en columna B
        DIARIO_ID: 27,          // Bancolombia 2419
        METODO_PAGO_ID: 17
      },
      EMPRESA_3: {
        ID: 3,
        NOMBRE: "TUTTI ALIMENTOS S.A.S", // Texto que aparece en columna B
        DIARIO_ID: 35,          // Bancolombia 2421
        METODO_PAGO_ID: 22
      },
      EMPRESA_4: {
        ID: 4,
        NOMBRE: "LAZZA S.A.S", // Texto que aparece en columna B
        DIARIO_ID: 43,           // Bancolombia 2429 
        METODO_PAGO_ID: 27
      }
    },

    // Columna donde se identifica la empresa (columna B = índice 1)
    COLUMNA_EMPRESA: 1,

    COLUMNAS: {
      PROVEEDOR: 2,    // C (índice 2 en array 0-based)
      FACTURA: 6,      // G (índice 6 en array 0-based)  
      COMUNICACION: 7, // H (índice 7 en array 0-based)
      MONTO: 9,        // J (índice 9 en array 0-based)
      CHECKBOX: 14,    // O (índice 14 en array 0-based)
      DIARIO: 15,     // P (índice 15 en array 0-based)
      MENSAJES: 16     // Q (índice 15 en array 0-based)
    },

    FILA_INICIO: 9,
    PREFIJOS_VALIDOS: ["FC", "DE"],
    PREFIJOS_VALIDOS_B: ["OPV"],
    PREFIJOS_VALIDOS_C: ["Liquidación"]
  };
}