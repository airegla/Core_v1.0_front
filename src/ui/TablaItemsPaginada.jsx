// BookOS - TablaItemsPaginada.jsx
// ruta: bookos/frontend/src/ui/TablaItemsPaginada.jsx
// descripcion: vista de renglones de un documento (modales de detalle: Ver remito, Ver venta,
//   Ver compra, Ver liquidacion...) con paginacion local de a 25 filas: los documentos largos no
//   rompen el modal. Recibe los headers y una funcion que arma cada fila (el indice es el global).

import { useState } from 'react';

const POR_PAGINA = 25;

export default function TablaItemsPaginada({ items = [], headers, fila, vacio = 'Sin renglones' }) {
  const [pagina, setPagina] = useState(1);
  const totalPaginas = Math.max(Math.ceil(items.length / POR_PAGINA), 1);
  const pag = Math.min(pagina, totalPaginas);
  const offset = (pag - 1) * POR_PAGINA;
  const visibles = items.slice(offset, offset + POR_PAGINA);

  return (
    <>
      <table className="table-os">
        <thead>
          <tr>{headers}</tr>
        </thead>
        <tbody>
          {items.length === 0 && (
            <tr><td colSpan={headers.length} className="text-muted text-sm">{vacio}</td></tr>
          )}
          {visibles.map((it, i) => fila(it, offset + i))}
        </tbody>
      </table>
      {totalPaginas > 1 && (
        <div className="flex justify-between items-center mt-2 text-xs text-muted">
          <span>Mostrando {offset + 1}–{Math.min(offset + POR_PAGINA, items.length)} de {items.length} renglones</span>
          <div className="flex gap-2">
            <button type="button" className="btn btn-ghost text-xs" disabled={pag <= 1} onClick={() => setPagina(pag - 1)}>← Anterior</button>
            <span>Página {pag} de {totalPaginas}</span>
            <button type="button" className="btn btn-ghost text-xs" disabled={pag >= totalPaginas} onClick={() => setPagina(pag + 1)}>Siguiente →</button>
          </div>
        </div>
      )}
    </>
  );
}
