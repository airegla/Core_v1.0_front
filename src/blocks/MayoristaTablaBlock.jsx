// BookOS - MayoristaTablaBlock.jsx
// ruta: bookos/frontend/src/blocks/MayoristaTablaBlock.jsx
// descripcion: renglones de una operacion del mayorista (F-12 §4.4): buscador asincronico de
//   articulos + cantidad + tipo de stock por linea (consigna/firme) + importacion de CSV. Es el
//   mismo bloque para remitos, facturas y devoluciones: cambia lo que la pagina hace con los items.
//   Con conPrecio (facturas) muestra precio, descuento por linea y subtotal; con sabana (baja de
//   consigna) muestra el disponible real del cliente por titulo y avisa si se factura de mas.
//   La lista de renglones se pagina de a 20 (los documentos largos, p. ej. una liquidacion
//   importada, no rompen la pantalla); los indices que editan son siempre los globales.

import { useState } from 'react';
import SelectBuscador from '../ui/SelectBuscador';
import ImportarCsvBlock from './ImportarCsvBlock';
import { buscarArticulos } from '../utils/selectores';

const POR_PAGINA = 20;

export default function MayoristaTablaBlock({ items = [], onItems, conTipoStock = true, conPrecio = false, sabana = null, descuentoDefault = null, etiquetaVacio = 'Agrega renglones con el buscador o un CSV (código;cantidad)' }) {
  const [pagina, setPagina] = useState(1);
  const totalPaginas = Math.max(Math.ceil(items.length / POR_PAGINA), 1);
  const pag = Math.min(pagina, totalPaginas);
  const offset = (pag - 1) * POR_PAGINA;
  const visibles = items.slice(offset, offset + POR_PAGINA);
  const agregar = (item, cantidad, tipoStock) => {
    if (!item || !cantidad) return;
    const existente = items.findIndex((i) => i.articuloId === item.id && (!conTipoStock || i.tipoStock === tipoStock));
    if (existente >= 0) {
      const copia = [...items];
      copia[existente] = { ...copia[existente], cantidad: copia[existente].cantidad + Number(cantidad) };
      onItems(copia);
      setPagina(Math.floor(existente / POR_PAGINA) + 1);
      return;
    }
    onItems([...items, {
      articuloId: item.id,
      ean13: item.ean13,
      titulo: item.etiqueta,
      cantidad: Number(cantidad),
      ...(conTipoStock ? { tipoStock } : {}),
      ...(conPrecio ? { precioUnitario: item.precioLista || 0, descuentoLinea: descuentoDefault != null ? descuentoDefault : null } : {}),
    }]);
    setPagina(Math.ceil((items.length + 1) / POR_PAGINA));
  };

  const importarCsv = (filas) => {
    const nuevos = filas
      .filter((f) => (f.ean13 || f.codigo) && Number(f.cantidad) > 0)
      .map((f) => ({ articuloId: null, ean13: String(f.ean13 || f.codigo), titulo: f.titulo || '', cantidad: Number(f.cantidad), ...(conTipoStock ? { tipoStock: 'CONSIGNA' } : {}), ...(conPrecio ? { precioUnitario: 0, descuentoLinea: descuentoDefault != null ? descuentoDefault : null } : {}) }));
    if (nuevos.length) {
      onItems([...items, ...nuevos]);
      setPagina(Math.ceil((items.length + nuevos.length) / POR_PAGINA));
    }
  };

  const quitar = (i) => onItems(items.filter((_, idx) => idx !== i));
  const cambiar = (i, campo, v) => {
    const copia = [...items];
    copia[i] = { ...copia[i], [campo]: v };
    onItems(copia);
  };
  const subtotal = (it) => (Number(it.cantidad) || 0) * (Number(it.precioUnitario) || 0) * (1 - (Number(it.descuentoLinea) || 0) / 100);
  // Disponible en la sabana del cliente (baja de consigna): por articuloId o por codigo de barras.
  const disponible = (it) => {
    if (!sabana) return null;
    if (it.articuloId && sabana[it.articuloId] != null) return sabana[it.articuloId];
    if (it.ean13 && sabana[`c:${it.ean13}`] != null) return sabana[`c:${it.ean13}`];
    return 0;
  };

  const columnas = 4 + (conTipoStock ? 1 : 0) + (conPrecio ? 3 : 0) + (sabana ? 1 : 0);

  return (
    <>
      <div className="flex gap-2 items-end mb-2 flex-wrap">
        <div className="flex-1" style={{ minWidth: 260 }}>
          <span className="field-label">Buscar título (EAN, título o autor)</span>
          <SelectBuscador
            valor={null}
            etiquetaValor=""
            placeholder="EAN, título o autor..."
            buscar={buscarArticulos}
            onSeleccionar={(item) => { if (item) agregar(item, 1, conTipoStock ? 'CONSIGNA' : undefined); }}
          />
        </div>
        <ImportarCsvBlock etiqueta="Importar CSV" onCargar={importarCsv} />
      </div>

      <table className="table-os">
        <thead>
          <tr>
            <th>EAN</th>
            <th>Título</th>
            <th>Cant.</th>
            {conTipoStock && <th>Sale de</th>}
            {sabana && <th>Sábana</th>}
            {conPrecio && <th>Precio</th>}
            {conPrecio && <th>Desc. %</th>}
            {conPrecio && <th>Subtotal</th>}
            <th />
          </tr>
        </thead>
        <tbody>
          {items.length === 0 && (
            <tr><td colSpan={columnas} className="text-muted text-sm">{etiquetaVacio}</td></tr>
          )}
          {visibles.map((it, i) => {
            const gi = offset + i;
            const disp = disponible(it);
            const excede = sabana && Number(it.cantidad) > disp;
            return (
              <tr key={gi}>
                <td className="font-mono text-xs">{it.ean13 || '—'}</td>
                <td>{it.titulo || '(se resuelve al guardar por el código)'}</td>
                <td style={{ width: 90 }}>
                  <input className="input-os" type="number" min="1" value={it.cantidad} onChange={(e) => cambiar(gi, 'cantidad', Number(e.target.value))} />
                </td>
                {conTipoStock && (
                  <td style={{ width: 150 }}>
                    <select className="input-os" value={it.tipoStock || 'CONSIGNA'} onChange={(e) => cambiar(gi, 'tipoStock', e.target.value)}>
                      <option value="CONSIGNA">Consigna</option>
                      <option value="FIRME">Firme</option>
                    </select>
                  </td>
                )}
                {sabana && (
                  <td className="text-xs" style={{ color: excede ? 'var(--danger)' : undefined }} title={excede ? 'No se puede facturar como baja de consigna mas de lo que el cliente tiene en su sábana' : undefined}>
                    {disp}{excede ? ' ⚠️' : ''}
                  </td>
                )}
                {conPrecio && (
                  <td style={{ width: 130 }}>
                    <input className="input-os" type="number" min="0" value={it.precioUnitario || 0} onChange={(e) => cambiar(gi, 'precioUnitario', Number(e.target.value))} />
                  </td>
                )}
                {conPrecio && (
                  <td style={{ width: 90 }}>
                    <input className="input-os" type="number" min="0" max="100" value={it.descuentoLinea == null ? '' : it.descuentoLinea} placeholder={descuentoDefault != null ? String(descuentoDefault) : '0'} onChange={(e) => cambiar(gi, 'descuentoLinea', e.target.value === '' ? null : Number(e.target.value))} />
                  </td>
                )}
                {conPrecio && <td className="text-xs font-mono">${subtotal(it).toLocaleString('es-AR')}</td>}
                <td>
                  <button type="button" className="btn btn-ghost text-xs" style={{ color: 'var(--danger)' }} onClick={() => quitar(gi)}>Quitar</button>
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
      <p className="text-sm mt-2">
        Renglones: <strong>{items.length}</strong> · Unidades: <strong>{items.reduce((a, i) => a + Number(i.cantidad || 0), 0)}</strong>
        {conPrecio && <> · Subtotal: <strong>${items.reduce((a, i) => a + subtotal(i), 0).toLocaleString('es-AR')}</strong></>}
      </p>
    </>
  );
}
