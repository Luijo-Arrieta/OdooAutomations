/**
 * Librería utilitaria para autenticación manual con Odoo.
 */
const LibOdooUtilsT = {
  odooGetSessionIdtest: function () {
    
    const session_id = "session_id = 12df3435b4874927f737e05c1152d24c8186fca3";  // JOSE TEST
    //const session_id = "###";  // PORTATIL TEST
    //const session_id = "###";    //PORTATIL PRODU
    

    if (!session_id) {
      throw new Error("No se ha definido un session_id válido en LibOdooUtils.");
    }

    return session_id;
  }
};

