// BookOS - Table.jsx
// ruta: bookos/frontend/src/ui/Table.jsx
// descripcion: tabla base del OS (clase .table-os del globals.css). Si recibe
//   exportable=true, agrega un boton "Exportar CSV" que descarga el listado que
//   se esta viendo (usa los datos crudos de cada fila).

import { descargarCsv } from '../utils/exportar';

export default function Table({ columnas, filas, vacio = 'Sin resultados', exportable = false, exportarNombre = 'listado' }) {
  const exportar = () => {
    const cols = columnas.filter((c) => c.clave && c.titulo);
    const filasCrudas = filas.map((f) => {
      const o = {};
      for (const c of cols) o[c.clave] = c.valorExport ? c.valorExport(f) : f[c.clave];
      return o;
    });
    descargarCsv(exportarNombre, cols.map((c) => ({ titulo: c.titulo, clave: c.clave })), filasCrudas);
  };

  return (
    <div className="card overflow-hidden">
      {exportable && (
        <div className="flex justify-end px-4 py-2" style={{ borderBottom: '1px solid var(--border)' }}>
          <button type="button" className="btn btn-ghost text-xs" onClick={exportar}>Exportar CSV</button>
        </div>
      )}
      {/* En pantallas chicas la tabla puede ser mas ancha que la tarjeta: se desplaza en horizontal
          en vez de recortarse (antes el overflow-hidden mostraba solo una franja de la 1a columna). */}
      <div className="overflow-x-auto">
        <table className="table-os">
          <thead>
            <tr>
              {columnas.map((c) => <th key={c.clave}>{c.titulo}</th>)}
            </tr>
          </thead>
          <tbody>
            {filas.length === 0 ? (
              <tr>
                <td colSpan={columnas.length} className="text-muted text-center py-8">{vacio}</td>
              </tr>
            ) : filas.map((fila, i) => (
              <tr key={fila.id || i}>
                {columnas.map((c) => <td key={c.clave}>{c.render ? c.render(fila) : fila[c.clave]}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
