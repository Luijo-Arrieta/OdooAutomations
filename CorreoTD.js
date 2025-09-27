/**
 * Función que obtiene datos de una hoja de cálculo de Google Sheets,
 * los filtra y envía por correo electrónico como una tabla HTML.
 * La tabla muestra solo las filas que tienen el campo "Nombre de la empresa a mostrar en la factura".
 * El asunto y el contenido del correo incluyen la fecha del día de ejecución.
 */
function Enviarcorreo() {
  // Obtener la fecha actual y formatearla como 'yyyy-MM-dd'
  const today = new Date();
  const formattedDate = Utilities.formatDate(today, Session.getScriptTimeZone(), 'yyyy-MM-dd');

  // Obtener los datos de la hoja de cálculo especificada (usando índice de hoja 5)
  const rawData = LibSheetUtils.sheetToJSON(
    "TD", // Nombre de la hoja
    true, // La primera fila contiene encabezados
    "1W8JZhzagztpV7PJxOOnkGGT_Bqtc7Kn5gtUw8h4OInY", // ID de la hoja de cálculo
    5 // Fila de encabezados
  );

  // Filtrar filas donde el campo "Nombre de la empresa a mostrar en la factura" NO esté vacío
  const data = rawData.filter(row =>
    row["Nombre de la empresa a mostrar en la factura"]?.toString().trim() !== ""
  );

  // Construir el cuerpo del correo en formato HTML
  const htmlBody = buildHtmlTable(data, formattedDate);

  // Enviar el correo electrónico con los datos procesados
  MailApp.sendEmail({
    //to: "destino1331333330@cuenta.com",
    //to: "tech@elianazaia.com",
    to: "contabilidad@elianazaia.com", // Dirección de destino
    subject: `Informe de Cartera - Empresas - ${formattedDate}`, // Asunto con fecha
    htmlBody: htmlBody // Cuerpo del mensaje en HTML
  });
}


/**
 * Construye una tabla HTML a partir de un arreglo de objetos, con encabezados y valores.
 * Incluye un título superior con hipervínculo a la hoja original, la fecha de generación
 * y formato HTML moderno para correo electrónico.
 * Además, crea una segunda tabla con solo los encabezados y la fila "suma total" con todas las columnas.
 * 
 * @param {Array<Object>} data - Arreglo de objetos con los datos a mostrar
 * @param {string} formattedDate - Fecha del día actual, ya formateada
 * @returns {string} HTML que representa el contenido del correo
 */
function buildHtmlTable(data, formattedDate) {
  if (!data || data.length === 0) {
    return `
      <div style="max-width: 600px; margin: 0 auto; font-family: 'Segoe UI', sans-serif; line-height: 1.6; color: #333;">
        <div style="background: white; padding: 25px; border-radius: 12px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); text-align: center;">
          <p style="margin: 0; font-size: 16px; color: #6c757d;">No se encontraron datos para mostrar.</p>
        </div>
      </div>
    `;
  }

  let html = `
    <div style="max-width: 800px; margin: 0 auto; font-family: 'Segoe UI', sans-serif; line-height: 1.6; color: #333;">
      
      <!-- Header con gradiente -->
      <div style="background: linear-gradient(135deg, #2c5aa0 0%, #1e3c72 100%); color: white; padding: 25px; border-radius: 12px; text-align: center; margin-bottom: 20px;">
        <h1 style="margin: 0; font-size: 32px; font-weight: 300;">
          📊 INFORME DE CARTERA
        </h1>
        <p style="margin: 10px 0 0 0; font-size: 18px; opacity: 0.9;">
          Fecha: ${formattedDate}
        </p>
      </div>
      
      <!-- Mensaje de saludo -->
      <div style="background: white; padding: 25px; border-radius: 12px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); margin-bottom: 25px;">
        <p style="margin: 0 0 15px 0; font-size: 16px;">
          Hola,
        </p>
        <p style="margin: 0; color: #666; font-size: 14px;">
          A continuación se presenta el resumen de cartera:
        </p>
      </div>
  `;

  const headers = Object.keys(data[0]);

  // PRIMERA TABLA - Resumen completo
  html += `
      <div style="background: white; padding: 25px; border-radius: 12px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); margin-bottom: 25px;">
        <h2 style="margin: 0 0 10px 0; font-size: 20px; color: #2c5aa0; font-weight: 600;">
          📋 Resumen Detallado
        </h2>
        <p style="margin: 0 0 20px 0; font-style: italic; font-size: 11px; color: #6c757d;">
          *Cifras expresadas en miles de pesos ($COP)
        </p>
        <table style="width: 100%; border-collapse: collapse; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
  `;

  // Headers de la primera tabla
  html += `<tr style="background: #f8f9fa;">`;
  headers.forEach((h, i) => {
    const headerText = i === 0 ? h : h + "*";
    html += `<th style="padding: 15px; text-align: left; font-weight: 600; color: #495057; border-bottom: 2px solid #dee2e6;">${headerText}</th>`;
  });
  html += `</tr>`;

  // Filas de la primera tabla
  data.forEach((row, index) => {
    const firstCellValue = row[headers[0]]?.toString().trim().toLowerCase();
    const isTotalRow = firstCellValue === "suma total";
    
    const bgColor = isTotalRow ? '#e6f3ff' : (index % 2 === 0 ? '#f8f9fa' : 'white');
    const fontWeight = isTotalRow ? 'bold' : 'normal';

    html += `<tr style="background: ${bgColor}; font-weight: ${fontWeight};">`;
    
    headers.forEach((h, headerIndex) => {
      const value = row[h];
      if (typeof value === "number") {
        const divided = value / 1000;
        const formattedValue = `$${divided.toLocaleString("es-CO", { maximumFractionDigits: 0 })}`;
        html += `<td style="padding: 12px 15px; border-bottom: 1px solid #dee2e6; text-align: right;">${formattedValue}</td>`;
      } else {
        const cellText = (headerIndex === 0 && value?.toString().trim().toLowerCase() === "suma total")
          ? `${value}*`
          : value ?? "";
        html += `<td style="padding: 12px 15px; border-bottom: 1px solid #dee2e6;">${cellText}</td>`;
      }
    });
    html += "</tr>";
  });

  html += `
        </table>
      </div>
  `;

  // SEGUNDA TABLA - Solo totales
  const totalRow = data.find(row => 
    row[headers[0]]?.toString().trim().toLowerCase() === "suma total"
  );

  if (totalRow) {
    html += `
      <div style="background: white; padding: 25px; border-radius: 12px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); margin-bottom: 25px;">
        <h2 style="margin: 0 0 10px 0; font-size: 20px; color: #2c5aa0; font-weight: 600;">
          💰 Total por Edades de Cartera
        </h2>
        <p style="margin: 0 0 20px 0; font-style: italic; font-size: 11px; color: #6c757d;">
          *Cifras expresadas en miles de pesos ($COP)
        </p>
        <table style="width: 100%; border-collapse: collapse; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
    `;

    // Headers de la segunda tabla
    html += `<tr style="background: #f8f9fa;">`;
    headers.forEach((h, index) => {
      const label = index === 0 ? "Edades de cartera" : h + "*";
      html += `<th style="padding: 15px; text-align: left; font-weight: 600; color: #495057; border-bottom: 2px solid #dee2e6;">${label}</th>`;
    });
    html += `</tr>`;

    // Fila total
    html += `<tr style="background: #e6f3ff; font-weight: bold;">`;
    headers.forEach((h, index) => {
      const value = totalRow[h];
      if (typeof value === "number") {
        const divided = value / 1000;
        const formattedValue = `$${divided.toLocaleString("es-CO", { maximumFractionDigits: 0 })}`;
        html += `<td style="padding: 12px 15px; border-bottom: 1px solid #dee2e6; text-align: right;">${formattedValue}</td>`;
      } else {
        const cellText = (index === 0 && value?.toString().trim().toLowerCase() === "suma total")
          ? `${value}*`
          : value ?? "";
        html += `<td style="padding: 12px 15px; border-bottom: 1px solid #dee2e6;">${cellText}</td>`;
      }
    });
    html += `</tr>`;

    html += `
        </table>
      </div>
    `;
  }

  // Footer moderno
  html += `
      <div style="text-align: center; margin-top: 30px; padding: 25px; background: #f8f9fa; border-radius: 12px;">
        <div style="margin-bottom: 20px;">
          <a href="https://docs.google.com/spreadsheets/d/1W8JZhzagztpV7PJxOOnkGGT_Bqtc7Kn5gtUw8h4OInY" 
             target="_blank" 
             style="text-decoration: none;">
            <button style="background: linear-gradient(135deg, #2c5aa0 0%, #1e3c72 100%); color: white; border: none; padding: 12px 24px; border-radius: 8px; font-size: 16px; font-weight: 600; cursor: pointer; box-shadow: 0 4px 6px rgba(0,0,0,0.1); transition: all 0.3s ease;">
              🔗 Ver Hoja Original Completa
            </button>
          </a>
        </div>
        <div style="border-top: 1px solid #dee2e6; padding-top: 20px; margin-top: 20px;">
          <p style="margin: 0; font-size: 12px; color: #6c757d; font-style: italic;">
            *Este reporte fue generado automáticamente el ${formattedDate}*
          </p>
          <p style="margin: 10px 0 0 0; font-size: 16px; font-weight: 600; color: #2c5aa0;">
            Saludos,<br>Equipo Imagine Apps
          </p>
        </div>
      </div>
      
    </div>
  `;

  return html;
}