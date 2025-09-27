/**
 * Librería utilitaria para autenticación manual con Odoo.
 */
const LibOdooUtilsT = {
  odooGetSessionIdtest: function () {
    
    //const session_id = "7e2fa4e9acefd9cebddf1e5411580c0d9f16ca87";  // JOSE TEST
    const session_id = "4be73df6752ec8cbc8b72a31aa2f59bad029c406";  // PORTATIL TEST
    //const session_id = "d008f59dc4278a4530522f324d972d1c7a573028";    //PORTATIL PRODU
    

    if (!session_id) {
      throw new Error("No se ha definido un session_id válido en LibOdooUtils.");
    }

    return session_id;
  }
};
