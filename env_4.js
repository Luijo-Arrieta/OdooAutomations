const IdBdCorreos = "1t0_mXPp3VWwYKor1uR57dAlF__IqCLWdHIg5mUtzKrw";
const IdBdLeyendasProductos = "18uchuLoNDj8w8h08e5FWaBbgEHFAqYkuxhJfCelq1-k";
const IdDocLog = "1u98Xrxj5pcFM-Pv25BKwghXUufNwXYF9DUOWSMxIJqs";

const zipMimeTypes = new Set([
  'application/zip',
  'application/x-zip-compressed',
  'application/octet-stream'
]);

const Companies = [
    {id: 1, nit: "35512662", name: "Eliana", journalFacturaProveedor: 12},
    {id: 2, nit: "901646300", name: "Artesanal", journalFacturaProveedor: 21},
    {id: 3, nit: "901646415", name: "Tutti", journalFacturaProveedor: 29},
    {id: 4, nit: "901646529", name: "Lazza",journalFacturaProveedor: 37},
  ]

/**
 * Realiza una petición POST a un endpoint de Odoo usando session_id para autenticación.
 * @param {Object} payload - Datos que se enviarán en el cuerpo de la solicitud.
 * @param {string} extraURL - Ruta que se agregará a la URL base del servidor Odoo.
 * @returns {any|null} - Devuelve la propiedad `result` de la respuesta si es exitosa, o null si ocurre un error.
 */
function consumeEndpoint(payload, extraURL) {
  //const url = 'https://ezerp.odoo.com';
  const url = 'https://ezerptest.odoo.com';
  const session_id = "session_id=47bd2e2aba0afb57a32cc484092a294b298f5383";
  const endpoint = `${url}/${extraURL}`;

  const options = {
    method: "post",
    contentType: "application/json",
    headers: {
      "Cookie": session_id
    },
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  };


  const response = UrlFetchApp.fetch(endpoint, options);
  const data = JSON.parse(response.getContentText());
  
  if (data?.error) {
    Logger.log("Error obteniendo órdenes de compra: ");
    Logger.log(JSON.stringify(payload))
    Logger.log(JSON.stringify(data.error.data.debug))
    return null;
  }

  return data.result;
}
