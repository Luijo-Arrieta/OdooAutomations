/**
 * Distancia de Levenshtein entre dos cadenas
 */

function Levenshtein(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') {
    throw new TypeError('levenshtein espera dos strins.');
  }

  const m = a.length;
  const n = b.length;

  if (m === 0) return n;
  if (n === 0) return m;

  const dp = Array.from(
    { length: m + 1 },
    () => Array(n + 1)
      .fill(0)
  );

  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,     // borrado
        dp[i][j - 1] + 1,     // inserción
        dp[i - 1][j - 1] + cost // sustitución
      );
    }
  }

  return dp[m][n];
}

/**
 * Normaliza texto: minusculas, sin tildes, sin stop‑words
 */
function normalizarProducto(str) {
  const sinTildes = str
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
  const alnum = sinTildes.replace(/[^a-z0-9\s]/g, " ");
  return alnum
    .split(/\s+/)
    .filter(w => w && !["de", "del", "la", "las", "los", "el", "y", "a", "en"].includes(w))
    .join(" ");
}

/**
 * Busca el mejor producto:
 * 1) exacto en product_name
 * 2) inclusion en product_name
 * 3) exacto en product_tag
 * 4) inclusion en product_tag
 * 5) Levenshtein más pequeño (por debajo de un umbral)
 */
function buscarProductoPorEtiquetaX(descripcion, bd) {

  if (typeof descripcion !== 'string') {
    Logger.log("La descripcion debe ser un string.")
    return null;
  }

  descripcion = normalizarProducto(descripcion)
  Logger.log(descripcion)
  if (!descripcion) return false; // evita match con string vacío

  // 1. Exacto en product_name
  //Logger.log("1. Exacto en product_name")
  let p = bd.find(x => normalizarProducto(x.product_name) === descripcion);
  if (p) return p;

  // 2. Inclusion en product_name
  //Logger.log("2. Inclusion en product_name")
  p = bd.find(x => {
    const nm = normalizarProducto(x.product_name);
    if (!nm) return false; // evita match con string vacío
    return nm.includes(descripcion) || descripcion.includes(nm);
  });
  if (p) return p;

  // 3. Exacto en product_tag
  //Logger.log("3. Exacto en product_tag")
  p = bd.find(x => normalizarProducto(x.product_tag) === descripcion);
  if (p) return p;

  // 4. Inclusion en product_tag
  //Logger.log("4. Inclusion en product_tag")
  p = bd.find( x => {
    const tag = normalizarProducto(x.product_tag);
    if (!tag) return false; // evita match con string vacío
    return tag.includes(descripcion) || descripcion.includes(tag);
  })
  if (p) return p;

  // 5. Fuzzy: buscamos distancia mínima en name
  //Logger.log("5. Fuzzy: buscamos distancia mínima en name")
  let mejor = null;
  let mejorDist = Infinity;

  bd.forEach(x => {
    const name = normalizarProducto(x.product_name);
    const dist = Levenshtein(descripcion, name)
    if (dist < mejorDist) {
      mejorDist = dist;
      mejor = x;
    }
  })

  p = (mejorDist <= 3) ? mejor : null;
  if (p) return p;
  
  // 6. Fuzzy: buscamos distancia mínima en tag
  //Logger.log("6. Fuzzy: buscamos distancia mínima en tag")
  bd.forEach(x => {
    const tag = normalizarProducto(x.product_tag);
    const dist = Levenshtein(descripcion, tag)
    if (dist < mejorDist) {
      mejorDist = dist;
      mejor = x;
    }
  })

  return (mejorDist <= 3) ? mejor : null;

}