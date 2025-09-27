function DescargarOrdenesDeCompra() { 
  try {
    Logger.log("DescargarOrdenesDeCompra");

    const today = new Date();
    
    const hour = today.getHours();
    if (hour <= 8 || hour >= 18 ) {
      Logger.log('Fuera de horario de 08:00 a 18:00. Terminando función.');
      return;
    }

    const daysAgo = new Date();
    daysAgo.setDate(today.getDate() - 7)
    
    const searchDay = Utilities.formatDate(daysAgo, TZ, "yyyy-MM-dd") + " 00:00:00";
    
    const orderIds = getOrderId(searchDay);

    if (!orderIds?.length) {
      Logger.log("No hay órdenes en Odoo con fecha de aprobación >= " + searchDay)
      return;
    }

    const sheet = SpreadsheetApp.openById(SheetDB).getSheetByName(SheetNameBD);
    const idsRegistrados = new Set(sheet.getRange("A2:A").getValues().flat().filter(Boolean));

    const idsPorRegistrar = orderIds?.filter(id => !idsRegistrados.has(id)) ?? orderIds;
    Logger.log("Ordenes por registrar: " + idsPorRegistrar.length)

    if (!idsPorRegistrar.length) {
      Logger.log("No hay órdenes por registrar.")
      return;
    }

    const ordersDetail = getOrderDetail(idsPorRegistrar);
    const supplierIds = ordersDetail.map(d => d.partner_id);
    const suppliersDetail = getSupplierContactDetails(supplierIds);

    const filas = buildOrderObjects(ordersDetail, suppliersDetail);

    LibSheetUtils.jsonToSheet(
      filas,
      SheetNameBD,
      true,
      SheetDB
    )
  } catch (e) {
    throw new Error (`Error al actualizar la base de datos: ${JSON.stringify(e.message)}`)
  } finally {
    SendOrderNotification();
  }
}

/**
 * Dado el JSON de órdenes y el JSON de proveedores, devuelve
 * un array de objetos con todos los campos completados y valores por defecto.
 *
 * @param {Object[]} orders   — Array de órdenes (tal cual sale del log).
 * @param {Object[]} suppliers — Array de proveedores (tal cual sale del log).
 * @return {Object[]}         — Array listo para insertar o procesar.
 */
function buildOrderObjects(orders, suppliers) {
  let toggle = false;
  return orders.map(function (ord) {
    toggle = !toggle;

    const dm = { ...DataModel };
    // Buscar datos del proveedor
    const sup = suppliers.find(function (s) { return s.id === ord.partner_id; }) || {};

    dm.order_Id =               ord.id;
    dm.order_name =             ord.name;
    dm.order_products_detail =  buildOrderProductsMessage(ord.order_line);
    dm.order_date =             ord.date_order;
    dm.order_date_approve =     ord.date_approve;
    dm.order_date_planned =     ord.date_planned;
    dm.order_notes =            formatNotes(ord.notes) || null;
    dm.company_id =             ord.company_id;
    dm.company_name =           getCompanyName(ord.company_id) || null;
    dm.supplier_id =            sup.id || null;
    dm.supplier_name =          sup.name || null;
    dm.supplier_phone =         toggle ? "51923720354" : "573104751978"; //normalizeForWhatsApp(sup.phone) || null;
    dm.supplier_email =         sup.email || null;

    return dm;
  });
}

/**
 * A partir del array order_line, construye un detalle más legible.
 * Devuelve un array de objetos con producto, cantidad, unidad y precio.
 *
 * @param {Object[]} lines — Cada elemento tiene id, name, product_id, product_qty, product_uom, price_unit
 * @return {Object[]}
 */
function flattenOrderLines(lines) {
  if (!Array.isArray(lines)) return [];
  return lines.map(function (l) {
    return {
      //line_id:     l.id,
      tag: l.name,
      //product_id:  l.product_id.id,
      name: l.product_id.display_name,
      quantity: l.product_qty,
      uom: l.product_uom.display_name,
      unit_price: l.price_unit
    };
  });
}

/**
 * Toma el array de líneas (de flattenOrderLines) y devuelve
 * un texto con cada producto formateado para WhatsApp.
 *
 * @param {Array.<{ tag:string, name:string, quantity:number, uom:string, unit_price:number }>} lines
 * @return {string} Mensaje de varias líneas, cada producto numerado.
 */
function buildOrderProductsMessage(lines) {
  if (!Array.isArray(lines) || lines.length === 0) {
    return 'No hay productos en el pedido.';
  }
  return lines
    .map(function (item, idx) {
      let name = item.product_id.display_name;
      let tag = item.name;
      let qty = item.product_qty;
      let uom = item.product_uom.display_name;
      let price = formatCurrencyCOP(item.price_unit);

      return (
        `${(idx + 1)}). Producto: ${name} (${tag}). Cantidad: ${qty} * ${uom}. Precio unitario: ${price}`
      );
    })
    .join('; ✅ ');
}

function formatCurrencyCOP(amount) {
  const formatter = new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
  return formatter.format(amount);
}

/**
 * Normaliza un teléfono para WhatsApp API:
 * - El parámetro es únicamente `phone`.
 * - Se quitan todos los caracteres no numéricos.
 * - Si la cadena resultante ya empieza con '57', se deja.
 * - Si no, antepone '57'.
 *
 * @param {string|number} phone — Número entrante (p. ej. "+57 312 3886224" o "316781669").
 * @return {string|null}        — Sólo dígitos con country code (p. ej. "573123882224"), o null si no es válido.
 */
function normalizeForWhatsApp(phone) {
  const defaultCountryCode = '57';
  if (phone === null || phone === undefined) return null;

  // 1. Convertir a string y eliminar todo lo que no sea dígito
  const digits = phone.toString().trim().replace(/\D+/g, '');
  if (!digits) return null;

  // 2. Si ya trae el código de país, devolvemos tal cual
  if (digits.startsWith(defaultCountryCode)) {
    return digits;
  }

  // 3. Si no, anteponemos el código de país por defecto
  return defaultCountryCode + digits;
}

/**
 * Transforma un string con <p>…</p><p>…</p> en una lista separada por comas.
 * - Elimina todas las etiquetas de apertura <p>…>
 * - Reemplaza cada </p> por una coma
 * - Quita la coma final sobrante y recorta espacios
 *
 * @param {string} htmlNotes — Notas en formato HTML de párrafos.
 * @return {string} — Texto plano con ítems separados por comas.
 */
function formatNotes(htmlNotes) {
  if (!htmlNotes || typeof htmlNotes !== 'string') return '';
  // 1. Quitar cualquier etiqueta de apertura <p> (y atributos, si existieran)
  let txt = htmlNotes.replace(/<p[^>]*>/gi, '');
  // 2. Reemplazar cierre de párrafo por coma
  txt = txt.replace(/<\/p>/gi, ', ');
  // 3. Eliminar comas duplicadas, recortar y quitar coma final
  txt = txt
    .replace(/,+/g, ', ')   // varias comas → una sola
    .trim()
    .replace(/,$/, '');    // coma al final → nada
  return txt;
}

function getCompanyName(companyId){
  switch (companyId){
    case 1: return "Eliana Zaia";
    case 2: return "Alimentos Tradicionales";
    case 3: return "Tutti Alimentos";
    case 4: return "Lazza"
  }
}


