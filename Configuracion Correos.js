// ===== CONFIGURACIONES DE CORREOS =====

/**
 * Configuración para el correo de Análisis de Consumo
 */
const CONFIG_ANALISIS_CONSUMO = {
  sheetName: "Indicadores",
  spreadsheetId: "", // Vacío para usar el archivo activo
  startRow: 8,
  filterField: "Item",
  //recipients: "preuba@fdjsf.com",
  //recipients: "tech@elianazaia.com, luis.arrieta@imagineapps.co",
  recipients: "finanzas@elianazaia.com, compras@elianazaia.com, juan@elianazaia.com",
  subjectPrefix: "Análisis de Consumos",
  htmlGenerator: generarHTMLAnalisisConsumo // Función personalizada para generar HTML
};

/**
 * Configuración para Producción Semanal con dos tablas
 */
const CONFIG_PROD_SEMANAL = {
  sheetName: "TD",
  spreadsheetId: "", // ID específico de otro Google Sheets
  startRow: 3,
  filterField: "Producto",
  // Nueva configuración para la segunda tabla
  startRow2: 4,
  filterField2: "PT", // Ajusta según el nombre de tu columna
  //recipients: "preuba32@fdjsf.com",
  //recipients: "tech@elianazaia.com, luis.arrieta@imagineapps.co",
  recipients: "finanzas@elianazaia.com, compras@elianazaia.com, juan@elianazaia.com, inventarios@elianazaia.com, analista.tech@elianazaia.com",
  subjectPrefix: "Producción Semanal",
  htmlGenerator: generarHTMLProdSemanal // Función personalizada diferente
};

// ===== HTML PERSONALIZADOS =====
/**
 * Generador HTML para Análisis de Consumo
 */
function generarHTMLAnalisisConsumo(data, formattedDate, fileUrl, config) {
  if (!data || data.length === 0) {
    throw new Error("No se encontraron datos para construir la tabla");
  }

  let html = `
    <div style="max-width: 500px; margin: 0 auto; font-family: 'Segoe UI', sans-serif; line-height: 1.6; color: #333;">
      
      <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 20px; border-radius: 12px; text-align: center; margin-bottom: 20px;">
        <h1 style="margin: 0; font-size: 28px; font-weight: 300;">
          📊 ANÁLISIS DE CONSUMO
        </h1>
        <p style="margin: 10px 0 0 0; font-size: 16px; opacity: 0.9;">
          Fecha: ${formattedDate}
        </p>
      </div>
      
      <div style="background: white; padding: 25px; border-radius: 12px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); margin-bottom: 25px;">
        <p style="margin: 0 0 15px 0; font-size: 16px;">
          Hola,
        </p>
        <p style="margin: 0; color: #666; font-size: 14px;">
          A continuación se presenta el resumen de análisis de consumos:
        </p>
      </div>
  `;
  
  // Tabla principal
  const headers = Object.keys(data[0]);
  
  html += `
    <table style="width: 100%; border-collapse: collapse; background: white; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
  `;

  // Headers
  html += `<tr style="background: #f8f9fa;">`;
  headers.forEach(header => {
    html += `<th style="padding: 15px; text-align: left; font-weight: 600; color: #495057; border-bottom: 2px solid #dee2e6;">${header}</th>`;
  });
  html += `</tr>`;

  // Filas de datos
  data.forEach((row, index) => {
    const firstCellValue = row[headers[0]]?.toString().trim().toLowerCase();
    const isTotalRow = firstCellValue === "suma total";
    
    const bgColor = isTotalRow ? '#e6f3ff' : (index % 2 === 0 ? '#f8f9fa' : 'white');
    const fontWeight = isTotalRow ? 'bold' : 'normal';
    
    html += `<tr style="background: ${bgColor}; font-weight: ${fontWeight};">`;
    
    headers.forEach((header, headerIndex) => {
      const value = row[header];
      if (typeof value === "number") {
        const formattedValue = `$${value.toLocaleString("es-CO", { maximumFractionDigits: 0 })}`;
        html += `<td style="padding: 12px 15px; border-bottom: 1px solid #dee2e6; text-align: right;">${formattedValue}</td>`;
      } else {
        const displayValue = isTotalRow && headerIndex === 0 ? "SUMA TOTAL" : (value ?? "");
        html += `<td style="padding: 12px 15px; border-bottom: 1px solid #dee2e6;">${displayValue}</td>`;
      }
    });
    
    html += `</tr>`;
  });

  html += `</table>`;

  // Footer
  html += `
      <div style="text-align: center; margin-top: 30px; padding: 20px; background: #f8f9fa; border-radius: 8px;">
        <a href="${fileUrl}" target="_blank" style="text-decoration: none;">
          <button style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; border: none; padding: 12px 24px; border-radius: 8px; font-size: 16px; font-weight: 600; cursor: pointer; box-shadow: 0 4px 6px rgba(0,0,0,0.1); transition: all 0.3s ease;">
            📋 Ver Reporte Completo
          </button>
        </a>
        <div style="border-top: 1px solid #dee2e6; padding-top: 15px; margin-top: 15px;">
          <p style="margin: 0; font-size: 12px; color: #6c757d; font-style: italic;">
            *Este reporte fue generado automáticamente el ${formattedDate}*
          </p>
          <p style="margin: 5px 0 0 0; font-size: 14px; font-weight: 600; color: #495057;">
            Equipo de Desarrollo - Imagine Apps
          </p>
        </div>
      </div>
      
    </div>
  `;

  return html;
}

/**
 * Generador HTML para Producción Semanal
 */
function generarHTMLProdSemanal(data, formattedDate, fileUrl, config, weekInfo = null) {
  // Verificar si tenemos dos tablas
  const hayDosTablas = data.tabla1 && data.tabla2;
  
  if (!hayDosTablas && (!data || data.length === 0)) {
    throw new Error("No se encontraron datos para construir la tabla");
  }

  // Determinar el texto de fecha a mostrar
  let fechaTexto = formattedDate;
  if (weekInfo) {
    const fechaInicio = LibOdooAPIs.formatearFechaParaMostrar(weekInfo.lunesObjetivo);
    const fechaFin = LibOdooAPIs.formatearFechaParaMostrar(weekInfo.domingoObjetivo);
    fechaTexto = `${fechaInicio} - ${fechaFin}`;
  }

  let html = `
    <div style="max-width: 700px; margin: 0 auto; font-family: 'Segoe UI', sans-serif; line-height: 1.6; color: #333;">
      
      <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 18px; border-radius: 12px; text-align: center; margin-bottom: 15px;">
        <h1 style="margin: 0; font-size: 28px; font-weight: 300;">
          🏭 PRODUCCIÓN SEMANAL
        </h1>
        <p style="margin: 10px 0 0 0; font-size: 16px; opacity: 0.9;">
          Semana: ${fechaTexto}
        </p>
      </div>
      
      <div style="background: white; padding: 25px; border-radius: 12px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); margin-bottom: 25px;">
        <p style="margin: 0 0 15px 0; font-size: 16px;">
          Hola,
        </p>
        <p style="margin: 0; color: #666; font-size: 14px;">
          A continuación se presenta el informe de producción semanal:
        </p>
      </div>
  `;

  if (hayDosTablas) {
    // PRIMERA TABLA (sin decimales)
    html += generarTablaHTMLSimple(data.tabla1, "Tabla Principal", false);
    
    // SEGUNDA TABLA (con decimales)
    if (data.tabla2 && data.tabla2.length > 0) {
      html += `<br><br>`;
      html += generarTablaHTMLSimple(data.tabla2, "Componentes con Variación Significativa (>= 5%)", true);
    }
  } else {
    // TABLA ÚNICA (sin decimales por defecto)
    html += generarTablaHTMLSimple(data, "Producción Semanal", false);
  }

  // Footer
  html += `
      <div style="text-align: center; margin-top: 30px; padding: 20px; background: #f8f9fa; border-radius: 8px;">
        <a href="${fileUrl}" target="_blank" style="text-decoration: none;">
          <button style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; border: none; padding: 12px 24px; border-radius: 8px; font-size: 16px; font-weight: 600; cursor: pointer; box-shadow: 0 4px 6px rgba(0,0,0,0.1); transition: all 0.3s ease;">
            📋 Ver Reporte Completo
          </button>
        </a>
        
        <div style="border-top: 1px solid #dee2e6; padding-top: 15px; margin-top: 15px;">
          <p style="margin: 0; font-size: 12px; color: #6c757d; font-style: italic;">
            Este reporte fue generado automáticamente el ${formattedDate}
          </p>
          <p style="margin: 5px 0 0 0; font-size: 14px; font-weight: 600; color: #495057;">
            Equipo de Desarrollo - Imagine Apps
          </p>
        </div>
      </div>
      
    </div>
  `;

  return html;
}

/**
 * Función auxiliar para generar HTML de tabla simplificada
 * @param {Array} data - Datos de la tabla
 * @param {string} titulo - Título de la tabla
 * @param {boolean} mostrarDecimales - Si debe mostrar decimales en los números
 */
function generarTablaHTMLSimple(data, titulo, mostrarDecimales = false) {
  if (!data || data.length === 0) return "";

  const headers = Object.keys(data[0]);
  
  let html = `
    <h3 style="color: #333; margin-bottom: 10px;">${titulo}</h3>
    <table style="width: 100%; border-collapse: collapse; background: white; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
  `;
  
  // FILA DE HEADERS
  html += `<tr style="background: #f8f9fa;">`;
  headers.forEach(header => {
    html += `<th style="padding: 15px; text-align: left; font-weight: 600; color: #495057; border-bottom: 2px solid #dee2e6;">${header}</th>`;
  });
  html += "</tr>";
  
  // FILAS DE DATOS
  data.forEach((row, index) => {
    const firstCellValue = row[headers[0]]?.toString().trim().toLowerCase();
    const isTotalRow = firstCellValue === "suma total";

    const bgColor = isTotalRow ? '#e6f3ff' : (index % 2 === 0 ? '#f8f9fa' : 'white');
    const fontWeight = isTotalRow ? 'bold' : 'normal';

    html += `<tr style="background: ${bgColor}; font-weight: ${fontWeight};">`;
    headers.forEach((header, headerIndex) => {
      const value = row[header];
      
      if (typeof value === "number" && headerIndex !== 0) {
        let formattedValue;
        
        // Si es la última columna (porcentaje)
        if (headerIndex === headers.length - 1) {
          formattedValue = `${(value * 100).toFixed(2)}%`;
        } else {
          // Formatear según si debe mostrar decimales o no
          if (mostrarDecimales) {
            formattedValue = value.toLocaleString("en-US", { 
              minimumFractionDigits: 2, 
              maximumFractionDigits: 2 
            });
          } else {
            formattedValue = value.toLocaleString("en-US", { 
              minimumFractionDigits: 0, 
              maximumFractionDigits: 0 
            });
          }
        }
        
        html += `<td style="padding: 12px 15px; border-bottom: 1px solid #dee2e6; text-align: right;">${formattedValue}</td>`;
      } else {
        const displayValue = value !== null && value !== undefined ? value : "";
        html += `<td style="padding: 12px 15px; border-bottom: 1px solid #dee2e6;">${displayValue}</td>`;
      }
    });
    html += "</tr>";
  });

  html += "</table>";
  return html;
}