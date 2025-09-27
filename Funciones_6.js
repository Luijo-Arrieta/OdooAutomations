
/**
 * Toma la información extraida del GoogleSheet para convertirla a información útil para el proceso de creacion del pago
 */
function procesarFacturasIsimo(data) {
  const limpiarMoneda = (valor) => {
    if (!valor || typeof valor !== 'string') return 0;
    return parseFloat(valor.replace(/\$/g, '').replace(/\./g, '').replace(',', '.')) || 0;
  };

  const transformarNumero = (numeroFactura) => {
    const [prefijo, numStr] = numeroFactura.split('-');
    const letras = prefijo.slice(0, 4);
    const numeros = parseInt(numStr, 10); // Quita ceros a la izquierda
    return { letras, numeros, original: numeroFactura };
  };

  const invertirPrefijo = (prefijo) => {
    if (prefijo.startsWith('FEMH')) return 'FETU' + prefijo.slice(4);
    if (prefijo.startsWith('FETU')) return 'FEMH' + prefijo.slice(4);
    return prefijo; // por si hay otras variantes
  };

  const procesados = data.map((item) => {
    const { letras, numeros } = transformarNumero(item["N° de factura"]);
    return {
      numero: `${letras}${numeros}`, // sin guion, sin ceros
      fecha: convertirFechaADateIso(item["Fecha negociación"]),
      descuento: limpiarMoneda(item["Descuento factoring"]),
      socio: item["Nombre pagador"],
      socio_nit: item["NIT pagador"],
      compania: item["Nombre emisor"],
      compania_nit: item["NIT emisor"],
      importe: limpiarMoneda(item["Monto a recibir"]),
    };
  });

  const copias = procesados.map((original) => {
    const letras = original.numero.slice(0, 4);
    const numeros = original.numero.slice(4); // parte numérica como string
    const nuevoPrefijo = invertirPrefijo(letras);
    return {
      ...original,
      numero: `${nuevoPrefijo}${numeros}`,
    };
  });

  // Combinar y ordenar
  const facturas = [...procesados, ...copias].sort((a, b) => a.numero.localeCompare(b.numero));

  // Calcular el descuento total solo de los originales
  const descuentoTotal = procesados.reduce((acc, curr) => acc + curr.descuento, 0);

  return {
    facturas,
    fecha: facturas[0].fecha
  };
}

/**
 * Convierte fecha en formato "dd/MM/yyyy" → "yyyy-MM-dd"
 */
function convertirFechaADateIso(fechaTexto) {
  const [dd, mm, yyyy] = fechaTexto.split('/');
  return `${yyyy}-${mm}-${dd}`;
}

function completarDetalleFacturaIsimo(detalleFacturas, facturas) {
  const mapFacturas = {};

  // Crear un mapa para acceso rápido por número de factura
  facturas.forEach(factura => {
    mapFacturas[factura.numero] = {
      descuento: factura.descuento,
      fecha: factura.fecha,
      importe: factura.importe
    };
  });

  // Enriquecer cada factura del detalle con datos desde data.facturas
  const detalleEnriquecido = detalleFacturas.map(factura => {
    const infoExtra = mapFacturas[factura.name];
    return {
      ...factura,
      ...(infoExtra ? infoExtra : {}) // Agrega solo si existe información relacionada
    };
  });

  return detalleEnriquecido;
}