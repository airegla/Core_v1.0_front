// BookOS - ItemsEditorBlock.jsx
// ruta: bookos/frontend/src/blocks/ItemsEditorBlock.jsx
// descripcion: tabla editable generica para cargar items de un comprobante
//   (venta, remito, liquidacion). Recibe columnas configurables y delega cambios al padre.
//   La lista se pagina de a 20 (los documentos largos - una liquidacion importada, por ejemplo -
//   no rompen la pantalla): los indices que recibe el padre son SIEMPRE los globales del array.

import { useState } from 'react';

const POR_PAGINA = 20;

export default function ItemsEditorBlock({ items, onChange, onRemove, columnas, vacio = 'Sin items' }) {
  const [pagina, setPagina] = useState(1);
  const totalPaginas = Math.max(Math.ceil(items.length / POR_PAGINA), 1);
  const pag = Math.min(pagina, totalPaginas);
  const offset = (pag - 1) * POR_PAGINA;
  const visibles = items.slice(offset, offset + POR_PAGINA);

  const setCampo = (index, clave, valor) => {
    onChange(items.map((it, i) => (i === index ? { ...it, [clave]: valor } : it)));
  };

  return (
    <>
      <table className="table-os w-full">
        <thead>
          <tr>
            {columnas.map((c) => <th key={c.clave} style={c.style}>{c.titulo}</th>)}
            <th style={{ width: 40 }} />
          </tr>
        </thead>
        <tbody>
          {items.length === 0 && (
            <tr>
              <td colSpan={columnas.length + 1} className="text-muted text-xs py-4 text-center">{vacio}</td>
            </tr>
          )}
          {visibles.map((it, i) => {
            const gi = offset + i;
            return (
              <tr key={gi}>
                {columnas.map((c) => (
                  <td key={c.clave}>
                    {c.render ? c.render(it, gi, setCampo) : c.editable ? (
                      <input
                        className="input-os"
                        style={{ padding: '4px 8px', width: c.ancho || 90 }}
                        type={c.tipo || 'text'}
                        value={it[c.clave] ?? ''}
                        onChange={(e) => setCampo(gi, c.clave, c.tipo === 'number' ? Number(e.target.value) : e.target.value)}
                      />
                    ) : (
                      <span className="text-sm">{it[c.clave]}</span>
                    )}
                  </td>
                ))}
                <td>
                  <button type="button" className="btn btn-ghost text-xs" onClick={() => onRemove(gi)} title="Quitar">✕</button>
                </td>
              </tr>
            );
          })}
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
