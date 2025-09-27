function pruebaExtraer() {
  let mensaje = GmailApp.getMessageById("1975fe1413e24241")
  let data = procesarCorreo(mensaje)
  Logger.log(JSON.stringify(data))
}

/**
 * Extrae el número de orden de compra de un texto dado.
 * Busca el patrón "Orden de compra:" seguido del número o código.
 * @param {string} text - Texto donde se buscará el número de orden.
 * @returns {string|null} - Retorna el número de orden si se encuentra, o null si no.
 */
function extraerNumeroOrdenCompra(body) {
  const regex = /orden\s+de\s+compra[:\s\-]*([A-Z]?\d{4,})/i;
  const match = body.match(regex);
  return match ? match[1].trim() : null;
}

function extractValue(text, regex, groupIndex = 0) {
  const match = text.match(regex);
  return match ? match[groupIndex] : null;
}

function parseInvoiceXML(xmlContent) {
  const data = {};

  // Datos básicos de la factura usando regex
  data.numeroFactura = extractValue(xmlContent, /<cbc:ID>([^<]+)<\/cbc:ID>/, 1) || null;
  data.cufe = extractValue(xmlContent, /<cbc:UUID[^>]*>([^<]+)<\/cbc:UUID>/, 1) || null;
  data.fechaEmision = extractValue(xmlContent, /<cbc:IssueDate>([^<]+)<\/cbc:IssueDate>/, 1) || null;
  data.horaEmision = extractValue(xmlContent, /<cbc:IssueTime>([^<]+)<\/cbc:IssueTime>/, 1) || null;
  data.fechaVencimiento = extractValue(xmlContent, /<cbc:PaymentDueDate>([^<]+)<\/cbc:PaymentDueDate>/, 1) || null;
  data.moneda = extractValue(xmlContent, /<cbc:DocumentCurrencyCode>([^<]+)<\/cbc:DocumentCurrencyCode>/, 1) || 'COP';

  // Datos del cliente
  data.cliente = extractCliente(xmlContent);

  let companyId = data.cliente.idOdoo;

  // Datos del proveedor
  data.proveedor = extractProveedor(xmlContent, companyId);

  // Totales de la factura
  data.totales = {
    subtotal: extractValue(xmlContent, /<cbc:LineExtensionAmount currencyID="[^"]*">([^<]+)<\/cbc:LineExtensionAmount>/, 1) || '0',
    impuestos: extractValue(xmlContent, /<cac:TaxTotal>[\s\S]*?<cbc:TaxAmount[^>]*>([^<]+)<\/cbc:TaxAmount>/, 1) || '0',
    total: extractValue(xmlContent, /<cbc:PayableAmount[^>]*>([^<]+)<\/cbc:PayableAmount>/, 1) || '0'
  };

  // Extraer items de la factura
  data.items = extractInvoiceItems(xmlContent, companyId);

  return data;
}

function extractCliente(xmlContent) {
  // Nombre principal: intenta PartyName → Name, si viene vacío o no existe, usa RegistrationName
  let nombre = extractValue(
    xmlContent,
    /<cac:AccountingCustomerParty>[\s\S]*?<cac:PartyName>[\s\S]*?<cbc:Name>([^<]*)<\/cbc:Name>/,
    1
  );
  if (!nombre) {
    nombre = extractValue(
      xmlContent,
      /<cac:AccountingCustomerParty>[\s\S]*?<cac:PartyTaxScheme>[\s\S]*?<cbc:RegistrationName>([^<]+)<\/cbc:RegistrationName>/,
      1
    );
  }

  // NIT: primero PartyIdentification → ID, si no existe, PartyTaxScheme → CompanyID
  let nit = extractValue(
    xmlContent,
    /<cac:AccountingCustomerParty>[\s\S]*?<cac:PartyIdentification>[\s\S]*?<cbc:ID[^>]*>([^<]+)<\/cbc:ID>/,
    1
  );
  if (!nit) {
    nit = extractValue(
      xmlContent,
      /<cac:AccountingCustomerParty>[\s\S]*?<cac:PartyTaxScheme>[\s\S]*?<cbc:CompanyID[^>]*>([^<]+)<\/cbc:CompanyID>/,
      1
    );
  }

  // Teléfono y email: suelen venir en <cac:Contact>
  const telefono = extractValue(
    xmlContent,
    /<cac:AccountingCustomerParty>[\s\S]*?<cac:Contact>[\s\S]*?<cbc:Telephone>([^<]+)<\/cbc:Telephone>/,
    1
  );
  const email = extractValue(
    xmlContent,
    /<cac:AccountingCustomerParty>[\s\S]*?<cac:Contact>[\s\S]*?<cbc:ElectronicMail>([^<]+)<\/cbc:ElectronicMail>/,
    1
  );

  const idOdoo = getIdCompanyByNitOrName(nit, nombre)
  const idOdooCuentaFacturaProveedor = getIdFacturaProveedorCompanyByNitOrName(idOdoo)

  return {
    idOdoo: idOdoo,
    nombre:   nombre   || null,
    nit:      nit      || null,
    telefono: telefono || null,
    email:    email    || null,
    idOdooCFacPro: idOdooCuentaFacturaProveedor
  };
}

function extractProveedor(xmlContent, companyId) {
  // 1) Nombre: primero PartyName → Name, si no existe o está vacío, usa RegistrationName
  let nombre = extractValue(
    xmlContent,
    /<cac:AccountingSupplierParty>[\s\S]*?<cac:PartyName>[\s\S]*?<cbc:Name>([^<]*)<\/cbc:Name>/,
    1
  );
  if (!nombre) {
    nombre = extractValue(
      xmlContent,
      /<cac:AccountingSupplierParty>[\s\S]*?<cac:PartyTaxScheme>[\s\S]*?<cbc:RegistrationName>([^<]+)<\/cbc:RegistrationName>/,
      1
    );
  }

  // 2) NIT: CompanyID bajo PartyTaxScheme, si no, bajo PartyLegalEntity
  let nit = extractValue(
    xmlContent,
    /<cac:AccountingSupplierParty>[\s\S]*?<cac:PartyTaxScheme>[\s\S]*?<cbc:CompanyID[^>]*>([^<]+)<\/cbc:CompanyID>/,
    1
  );
  if (!nit) {
    nit = extractValue(
      xmlContent,
      /<cac:AccountingSupplierParty>[\s\S]*?<cac:PartyLegalEntity>[\s\S]*?<cbc:CompanyID[^>]*>([^<]+)<\/cbc:CompanyID>/,
      1
    );
  }

  // 3) Teléfono y email: extraemos desde el bloque Contact
  const telefono = extractValue(
    xmlContent,
    /<cac:AccountingSupplierParty>[\s\S]*?<cac:Contact>[\s\S]*?<cbc:Telephone>([^<]+)<\/cbc:Telephone>/,
    1
  );
  const email = extractValue(
    xmlContent,
    /<cac:AccountingSupplierParty>[\s\S]*?<cac:Contact>[\s\S]*?<cbc:ElectronicMail>([^<]+)<\/cbc:ElectronicMail>/,
    1
  );

  const idOdoo = getIdProveedorByNit(nit, companyId)

  return {
    idOdoo: idOdoo,
    nombre:   nombre   || null,
    nit:      nit      || null,
    telefono: telefono || null,
    email:    email    || null
  };
}

function extractInvoiceItems(xmlContent,  companyId) {
  Logger.log(`Extrayendo el detalle de items de la factura`)

  const items = [];
  const itemRegex = /<cac:InvoiceLine>([\s\S]*?)<\/cac:InvoiceLine>/gs;
  let match;

  while ((match = itemRegex.exec(xmlContent)) !== null) {
    const itemXML = match[1];

    const item = {
      descripcion: extractValue(itemXML, /<cbc:Description>([^<]+)<\/cbc:Description>/, 1) || 'Sin descripción',
      cantidad: extractValue(itemXML, /<cbc:InvoicedQuantity[^>]*>([^<]+)<\/cbc:InvoicedQuantity>/, 1) || '0',
      unidad: extractValue(itemXML, /<cbc:InvoicedQuantity[^>]*unitCode="([^"]*)"/, 1) || '',
      precioUnitario: extractValue(itemXML, /<cbc:PriceAmount[^>]*>([^<]+)<\/cbc:PriceAmount>/, 1) || '0',
      total: extractValue(itemXML, /<cbc:LineExtensionAmount[^>]*>([^<]+)<\/cbc:LineExtensionAmount>/, 1) || '0',
      impuestos: extractTaxes(itemXML, companyId)
    };

    items.push(item);
  }

  return items;
}

function extractTaxes(itemXML, companyId) {
  const taxes = [];
  
  // Buscar todos los TaxTotal dentro del item
  const taxTotalRegex = /<cac:TaxTotal>([\s\S]*?)<\/cac:TaxTotal>/gs;
  let taxMatch;

  while ((taxMatch = taxTotalRegex.exec(itemXML)) !== null) {
    const taxTotalXML = taxMatch[1];
    
    // Buscar todos los TaxSubtotal dentro de cada TaxTotal
    const taxSubtotalRegex = /<cac:TaxSubtotal>([\s\S]*?)<\/cac:TaxSubtotal>/gs;
    let subtotalMatch;

    while ((subtotalMatch = taxSubtotalRegex.exec(taxTotalXML)) !== null) {
      const taxSubtotalXML = subtotalMatch[1];
      
      // Extraer información del impuesto
      const taxableAmount = extractValue(taxSubtotalXML, /<cbc:TaxableAmount[^>]*>([^<]+)<\/cbc:TaxableAmount>/, 1) || '0';
      const taxAmount = extractValue(taxSubtotalXML, /<cbc:TaxAmount[^>]*>([^<]+)<\/cbc:TaxAmount>/, 1) || '0';
      const percent = extractValue(taxSubtotalXML, /<cbc:Percent>([^<]+)<\/cbc:Percent>/, 1) || '0';
      
      // Extraer información del esquema de impuesto
      const taxCategoryXML = extractValue(taxSubtotalXML, /<cac:TaxCategory>([\s\S]*?)<\/cac:TaxCategory>/, 1) || '';
      const taxSchemeXML = extractValue(taxCategoryXML, /<cac:TaxScheme>([\s\S]*?)<\/cac:TaxScheme>/, 1) || '';
      
      const taxId = extractValue(taxSchemeXML, /<cbc:ID>([^<]+)<\/cbc:ID>/, 1) || '';
      const taxName = extractValue(taxSchemeXML, /<cbc:Name>([^<]+)<\/cbc:Name>/, 1) || '';
      const taxCategoryId = extractValue(taxCategoryXML, /<cbc:ID>([^<]+)<\/cbc:ID>/, 1) || '';
      
      // Determinar el tipo de impuesto basado en el ID
      let tipoImpuesto = '';
      switch(taxId) {
        case '01':
          tipoImpuesto = 'IVA';
          break;
        case '02':
          tipoImpuesto = 'IC (Impuesto al Consumo)';
          break;
        case '03':
          tipoImpuesto = 'ICA (Impuesto de Industria y Comercio)';
          break;
        case '04':
          tipoImpuesto = 'INC (Impuesto Nacional al Carbono)';
          break;
        case '05':
          tipoImpuesto = 'ReteIVA';
          break;
        case '06':
          tipoImpuesto = 'ReteRenta';
          break;
        case '07':
          tipoImpuesto = 'ReteICA';
          break;
        case '08':
          tipoImpuesto = 'ReteCREE';
          break;
        case '20':
          tipoImpuesto = 'FTO (Sobretasa a la Gasolina)';
          break;
        case '21':
          tipoImpuesto = 'IPOCONSUMO (Impuesto sobre las Bolsas Plásticas)';
          break;
        case '22':
          tipoImpuesto = 'INC (Impuesto Nacional a la Gasolina y ACPM)';
          break;
        case '23':
          tipoImpuesto = 'IC (Impuesto al Carbono de todos los Combustibles Líquidos y Gaseosos)';
          break;
        case '24':
          tipoImpuesto = 'INC Bolsas';
          break;
        case '25':
          tipoImpuesto = 'INC Bebidas Azucaradas';
          break;
        case 'ZY':
          tipoImpuesto = 'No causa';
          break;
        case 'ZZ':
          tipoImpuesto = 'No aplica';
          break;
        default:
          tipoImpuesto = taxName || `Código ${taxId}`;
      }

      const idOdoo = getIdImpuestoByName(`${parseFloat(percent)}% ${tipoImpuesto}`, companyId)

      if (taxId && (parseFloat(taxAmount) > 0 || parseFloat(percent) > 0)) {
        taxes.push({
          idOdoo: idOdoo,
          codigo: taxId,
          nombre: `${parseFloat(percent)}% ${tipoImpuesto}`,
          categoria: taxCategoryId,
          tipo: tipoImpuesto,
          porcentaje: parseFloat(percent),
          baseGravable: parseFloat(taxableAmount),
          valorImpuesto: parseFloat(taxAmount)
        });
      }
    }
  }

  return taxes;
}