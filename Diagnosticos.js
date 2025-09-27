// Test completo que simula exactamente el flujo del programa principal
function testProveedorCompleto() {
  console.log("🔧 TEST COMPLETO - SIMULANDO FLUJO DEL PROGRAMA PRINCIPAL");
  
  const sesionId = LibOdooUtils.odooGetSessionId("EZ");
  const nombreProveedor = "Nelson Roberto Mestizo Reyes Finca Raiz SAS";
  
  console.log(`Session ID: ${sesionId ? 'OK' : 'FAIL'}`);
  console.log(`Proveedor a buscar: "${nombreProveedor}"`);
  
  // Simular identificación de empresa (usa tu lógica real)
  const empresaId = 1; // Cambia esto por el ID real de tu empresa
  console.log(`Empresa ID: ${empresaId}`);
  
  try {
    // Test 1: Función tal como está en tu código
    console.log("\n=== 1. USANDO FUNCIÓN ACTUAL ===");
    const resultado1 = buscarProveedorPorNombre(nombreProveedor, sesionId, empresaId);
    console.log(`Resultado función actual: ${resultado1 ? `ID: ${resultado1}` : 'NULL'}`);
    
    // Test 2: Búsqueda manual exacta (como en tu test exitoso)
    console.log("\n=== 2. BÚSQUEDA MANUAL EXACTA ===");
    const proveedoresExactos = hacerConsultaOdoo('res.partner', 'search_read', [
      [["name", "=", nombreProveedor], ["is_company", "=", true], ["supplier_rank", ">", 0]]
    ], { fields: ["id", "name", "is_company", "supplier_rank"], limit: 1 }, sesionId);
    
    console.log(`Proveedores encontrados (exacto): ${proveedoresExactos.length}`);
    if (proveedoresExactos.length > 0) {
      console.log(`- ID: ${proveedoresExactos[0].id}`);
      console.log(`- Nombre: ${proveedoresExactos[0].name}`);
      console.log(`- Es empresa: ${proveedoresExactos[0].is_company}`);
      console.log(`- Supplier rank: ${proveedoresExactos[0].supplier_rank}`);
    }
    
    // Test 3: Búsqueda con filtro de empresa
    console.log("\n=== 3. BÚSQUEDA CON FILTRO DE EMPRESA ===");
    const proveedoresConEmpresa = hacerConsultaOdoo('res.partner', 'search_read', [
      [["name", "=", nombreProveedor], ["is_company", "=", true], ["supplier_rank", ">", 0], ["company_id", "=", empresaId]]
    ], { fields: ["id", "name", "company_id"], limit: 1 }, sesionId);
    
    console.log(`Proveedores con filtro empresa: ${proveedoresConEmpresa.length}`);
    if (proveedoresConEmpresa.length > 0) {
      console.log(`- ID: ${proveedoresConEmpresa[0].id}`);
      console.log(`- Nombre: ${proveedoresConEmpresa[0].name}`);
      console.log(`- Company ID: ${proveedoresConEmpresa[0].company_id}`);
    }
    
    // Test 4: Verificar si el proveedor tiene company_id
    console.log("\n=== 4. VERIFICAR COMPANY_ID DEL PROVEEDOR ===");
    const proveedorDetalle = hacerConsultaOdoo('res.partner', 'search_read', [
      [["name", "=", nombreProveedor]]
    ], { fields: ["id", "name", "company_id", "is_company", "supplier_rank"], limit: 1 }, sesionId);
    
    if (proveedorDetalle.length > 0) {
      console.log(`- ID: ${proveedorDetalle[0].id}`);
      console.log(`- Nombre: ${proveedorDetalle[0].name}`);
      console.log(`- Company ID: ${proveedorDetalle[0].company_id}`);
      console.log(`- Es empresa: ${proveedorDetalle[0].is_company}`);
      console.log(`- Supplier rank: ${proveedorDetalle[0].supplier_rank}`);
    }
    
    // Test 5: Validaciones de entrada
    console.log("\n=== 5. VALIDACIONES DE ENTRADA ===");
    console.log(`Nombre vacío: ${nombreProveedor ? 'NO' : 'SÍ'}`);
    console.log(`Nombre después de trim: "${nombreProveedor.toString().trim()}"`);
    console.log(`Longitud: ${nombreProveedor.toString().trim().length}`);
    
  } catch (error) {
    console.error(`❌ Error en test completo: ${error.message}`);
    console.error(error.stack);
  }
}

// Función auxiliar para debugging
function debugBuscarProveedor(nombreProveedor, sesionId, empresaId) {
  console.log(`\n🔍 DEBUG - Buscando proveedor: '${nombreProveedor}'`);
  console.log(`📋 Parámetros:`);
  console.log(`  - Nombre: "${nombreProveedor}"`);
  console.log(`  - Session ID: ${sesionId ? 'Presente' : 'Ausente'}`);
  console.log(`  - Empresa ID: ${empresaId}`);
  console.log(`  - Nombre limpio: "${nombreProveedor.toString().trim()}"`);
  
  // Validación inicial
  if (!nombreProveedor || nombreProveedor.toString().trim() === '') {
    console.error(`❌ FALLA: Nombre vacío o inválido`);
    return null;
  }
  
  const nombreLimpio = nombreProveedor.toString().trim();
  console.log(`✅ Nombre válido: "${nombreLimpio}"`);
  
  try {
    // Búsqueda exacta
    console.log(`🔍 Ejecutando búsqueda exacta...`);
    const proveedores = hacerConsultaOdoo('res.partner', 'search_read', [
      [["name", "=", nombreLimpio], ["is_company", "=", true], ["supplier_rank", ">", 0]]
    ], { fields: ["id", "name"], limit: 1 }, sesionId);
    
    console.log(`📊 Resultados búsqueda exacta: ${proveedores.length}`);
    
    if (proveedores.length > 0) {
      console.log(`✅ Proveedor encontrado: ${proveedores[0].name} (ID: ${proveedores[0].id})`);
      return proveedores[0].id;
    }
    
    // Búsqueda con ilike
    console.log(`🔍 Ejecutando búsqueda con ilike...`);
    const proveedoresIlike = hacerConsultaOdoo('res.partner', 'search_read', [
      [["name", "ilike", nombreLimpio], ["is_company", "=", true], ["supplier_rank", ">", 0]]
    ], { fields: ["id", "name"], limit: 1 }, sesionId);
    
    console.log(`📊 Resultados búsqueda ilike: ${proveedoresIlike.length}`);
    
    if (proveedoresIlike.length > 0) {
      console.log(`✅ Proveedor encontrado (ilike): ${proveedoresIlike[0].name} (ID: ${proveedoresIlike[0].id})`);
      return proveedoresIlike[0].id;
    }
    
    console.error(`❌ No se encontró el proveedor: ${nombreLimpio}`);
    return null;
    
  } catch (error) {
    console.error(`❌ Error en búsqueda: ${error.message}`);
    console.error(error.stack);
    return null;
  }
}