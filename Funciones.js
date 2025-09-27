/**
 * Construye un arreglo de filas (matriz bidimensional) listas para insertarse
 * en una hoja de Google Sheets, a partir de los registros de facturas obtenidos desde Odoo.
 * 
 * Cada fila representa una línea de factura e incluye información como compañía, producto,
 * número de factura, cliente, cantidad y valores de débito o crédito según corresponda.
 * 
 * La función también evita duplicados, excluyendo facturas cuyo número ya esté presente
 * en la hoja, comparando contra una lista de registros existentes.
 *
 * @param {Object[]} registrosOdoo - Arreglo de objetos de factura obtenidos desde Odoo.
 *        Cada objeto debe contener propiedades como `name`, `company_id`, `partner_id`,
 *        `invoice_date`, y `invoice_line_ids` (cada una con información de producto, cantidad y subtotal).
 * 
 * @param {string[]} registrosSheet - Lista de nombres de factura ya presentes en la hoja
 *        (por ejemplo, extraídos de la columna C). Se usa para evitar registrar duplicados.
 * 
 * @returns {any[][]} Matriz de filas para insertar directamente con `setValues`.
 *         Cada subarreglo representa una fila de la hoja.
 */
function utilsConstruirFilasParaRegistrar(registrosOdoo, registrosSheet) {

  // 1) Obtengo nombres ya existentes
  let nombresExistentes = registrosSheet.filter(String); // sólo no vacíos
  let setNombresExistentes = new Set(nombresExistentes);

  // let ROW = filaDeInicioParaRegistrar;
  let outputRows = [];

  // 3) Recorro cada factura
  registrosOdoo.forEach(function (rec) {
    if (setNombresExistentes.has(rec.name)) return;    // ya existe, salto

    // Determinar si es factura o nota de crédito basado en el prefijo
    let nombreDocumento = rec.name?.toUpperCase().trim() || "";
    let esNotaCredito = nombreDocumento.startsWith("NC");

    // para cada línea de factura genero una fila
    rec.invoice_line_ids.forEach(function (line) {
      
      let valorDebito = ""
      let valorCredito = ""

      if (esNotaCredito) {
        // Si es Nota de Crédito: el valor va en Débito (H)
        valorDebito = line.price_subtotal;
      } else {
        // Si es Factura: el valor va en Crédito (I)
        valorCredito = line.price_subtotal;
      }

      outputRows.push([
        rec.company_id.display_name,  // Col A: Compañía
        line.product_uom_id.display_name, // Col B: Tipo de unidad
        rec.name, // Col C: Número factura
        rec.invoice_date, // Col D: fecha de la factura
        rec.partner_id.display_name, // Col E: Cliente / Nombre del Tercero
        line.product_id.display_name,  // Col F: Descripción
        line.quantity, // Col G: Cantidad
        valorDebito, // Col H: Débito
        valorCredito
      ]);

      //ROW++;
    });
  });

  return outputRows
}
