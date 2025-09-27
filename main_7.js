function actualizarComparativoPedidos() {
  const semanas = [0, 1, -1];

  semanas.forEach(variacion => {
    try {
      Logger.log(`Ejecutando semana con variación de: ${variacion}`)
      getDataConsolidatedOrdersComparative(variacion);
      Logger.log(`Semana procesada correctamente`);
    } catch (error) {
      Logger.log(`Error al procesar semana ${variacion}: ${error}`);
    }
  });
}
