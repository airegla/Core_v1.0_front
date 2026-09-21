// BookOS - exportar.js
// ruta: bookos/frontend/src/utils/exportar.js
// descripcion: exportacion del lado del cliente. Dos caminos:
//   - descargarCsv: CSV inmediato desde los datos que YA estan en pantalla
//     (listado, carrito, detalle) sin tocar el backend.
//   - descargarDesdeServidor: baja un archivo generado por el backend (una tool
//     del Secretario o el endpoint /exportacion) usando el JWT.

function dispararDescarga(blob, nombre) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = nombre;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function esc(v) {
  const s = v === null || v === undefined ? '' : String(v);
  return /[;"\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

// columnas: [{ titulo, clave }] | filas: [{ clave: valor }]
export function descargarCsv(nombre, columnas, filas = []) {
  const cols = columnas.filter((c) => c && c.titulo != null);
  const lineas = [cols.map((c) => esc(c.titulo)).join(';')];
  for (const f of filas) {
    lineas.push(cols.map((c) => esc(f[c.clave])).join(';'));
  }
  const csv = `\ufeff${lineas.join('\n')}`;
  const archivo = `${nombre.replace(/\.csv$/i, '')}_${new Date().toISOString().slice(0, 10)}.csv`;
  dispararDescarga(new Blob([csv], { type: 'text/csv;charset=utf-8;' }), archivo);
}

// url: ruta relativa tipo /api/exportacion/descargar/nombre.csv
// nombreSugerido: opcional; si no viene se deduce de la url.
export async function descargarDesdeServidor(url, nombreSugerido = null) {
  const token = localStorage.getItem('bookos_token');
  const base = import.meta.env.VITE_API_URL || '/api';
  const final = /^https?:/.test(url) ? url : `${base}${url}`;
  const res = await fetch(final, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) throw new Error(`No se pudo descargar (${res.status})`);
  const blob = await res.blob();
  const nombre = nombreSugerido || decodeURIComponent(url.split('/').pop());
  dispararDescarga(blob, nombre);
}

// Exporta un listado generico a CSV via backend (util para PDFs tambien).
export async function exportarCsvServidor(nombre, columnas, filas) {
  const { exportacionApi } = await import('../api/api');
  const res = await exportacionApi.csv({ nombre, columnas, filas });
  return res.data;
}
