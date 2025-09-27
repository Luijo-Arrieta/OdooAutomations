/**
 * Librería utilitaria para autenticación manual con Odoo.
 */
const LibOdooUtilsT = {
  odooGetSessionIdtest: function () {
    
    const session_id = "b75745ebe98be4af75c9f1540a80e39288caf036";  // JOSE TEST
    //const session_id = "###";  // PORTATIL TEST
    //const session_id = "###";    //PORTATIL PRODU
    

    if (!session_id) {
      throw new Error("No se ha definido un session_id válido en LibOdooUtils.");
    }

    return session_id;
  }
};

