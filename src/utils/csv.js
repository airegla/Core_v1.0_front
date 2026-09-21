// BookOS - csv.js
// ruta: bookos/frontend/src/utils/csv.js
// descripcion: parseo de CSV del lado del cliente + mapeo de columnas por alias.
//   Se usa para importar un listado en el documento actual o adjuntarlo al
//   Secretario.

function parseLinea(linea, sep) {
  const out = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < linea.length; i += 1) {
    const c = linea[i];
    if (inQuotes) {
      if (c === '"') {
        if (linea[i + 1] === '"') { cur += '"'; i += 1; }
        else inQuotes = false;
      } else cur += c;
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === sep) {
      out.push(cur); cur = '';
    } else {
      cur += c;
    }
  }
  out.push(cur);
  return out;
}

// Detecta separador (; vs ,) y devuelve { encabezados, filas } con filas como objetos.
export function parsearCsv(texto) {
  const t = String(texto || '').replace(/^\uFEFF/, '');
  const lineas = t.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  if (lineas.length === 0) return { encabezados: [], filas: [] };
  const primera = lineas[0];
  const sep = (primera.match(/;/g) || []).length >= (primera.match(/,/g) || []).length ? ';' : ',';
  const encabezados = parseLinea(primera, sep).map((h) => h.trim());
  const filas = lineas.slice(1).map((l) => {
    const vals = parseLinea(l, sep);
    const obj = {};
    encabezados.forEach((h, i) => { obj[h] = vals[i] !== undefined ? vals[i].trim() : ''; });
    return obj;
  });
  return { encabezados, filas };
}

const ALIASES = {
  ean13: ['ean13', 'ean', 'codigo', 'isbn', 'codigo_barras', 'barcode', 'ean_13'],
  titulo: ['titulo', 'titulo_libro', 'nombre', 'descripcion', 'titulo libro'],
  cantidad: ['cantidad', 'cant', 'unidades', 'qty'],
  precio: ['precio', 'precio_venta', 'precio_lista', 'pvp', 'precio unitario', 'precio_unitario'],
  costo: ['costo', 'precio_costo', 'coste', 'costo unitario'],
  autor: ['autor', 'autor_principal'],
  editorial: ['editorial'],
  tema: ['tema', 'materia'],
  stock: ['stock', 'stock_firme', 'firme'],
  stockDeposito: ['stock_deposito', 'deposito', 'stockdeposito', 'stock_dep'],
};

function normalizarClave(h) {
  return String(h || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '');
}

// Mapea filas crudas (objetos con headers originales) a campos canonicos por alias.
export function mapearFilas(filas, campos) {
  const headers = Object.keys(filas[0] || {});
  const lookup = {};
  for (const h of headers) {
    const n = normalizarClave(h);
    for (const [campo, aliases] of Object.entries(ALIASES)) {
      if (aliases.some((a) => normalizarClave(a) === n)) lookup[campo] = h;
    }
  }
  return filas.map((f) => {
    const o = {};
    for (const campo of campos) {
      const src = lookup[campo];
      if (src) o[campo] = f[src];
    }
    return o;
  });
}
