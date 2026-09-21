// BookOS - BuscadorTecnicoBlock.jsx
// ruta: bookos/frontend/src/blocks/BuscadorTecnicoBlock.jsx
// descripcion: F6 — el buscador TECNICO del mostrador (la busqueda F7 del bookerp): modal global
//   con la sintaxis T titulo / A autor / * codigo / X contiene contra /api/catalogo/f7. Es rapido
//   y practico: LISTADO (no tarjetas), navegacion con flechas, Enter agrega el renglon cuando se
//   esta facturando, y el resultado tecnico (EAN, precio, stock) siempre a la vista.

import { useEffect, useRef, useState } from 'react';
import Modal from '../ui/Modal';
import BotonSecretario from '../ui/BotonSecretario';
import usePersistentWork from '../hooks/usePersistentWork';
import { catalogoApi } from '../api/api';
import { useAppContext } from '../AppContext';

const money = (n) => `$${Number(n || 0).toLocaleString('es-AR')}`;
const stockDe = (a) => Number(a.stock || 0) + Number(a.stockDeposito || 0);

export default function BuscadorTecnicoBlock({ abierto, onCerrar, enFacturar = false, onIrACatalogo = null }) {
  const { emitirInstruccion } = useAppContext();
  // F6 PERSISTENTE (como el F7): cerrar el modal o refrescar la pagina NO pierde la busqueda.
  // El estado vive en disco (usePersistentWork) y el boton ↺ Limpiar lo arranca de cero.
  const [memoria, setMemoria, limpiarMemoria] = usePersistentWork('buscador_f6', { q: '', filas: [], buscado: '' });
  const { q, filas, buscado } = memoria;
  const setQ = (v) => setMemoria((m) => ({ ...m, q: v }));
  const setFilas = (v) => setMemoria((m) => ({ ...m, filas: v }));
  const setBuscado = (v) => setMemoria((m) => ({ ...m, buscado: v }));
  const [error, setError] = useState('');
  const [cargando, setCargando] = useState(false);
  const [indice, setIndice] = useState(0);
  const inputRef = useRef(null);
  const listaRef = useRef(null);

  useEffect(() => {
    if (!abierto) return undefined;
    setError('');
    const t = setTimeout(() => inputRef.current && inputRef.current.focus(), 80);
    return () => clearTimeout(t);
  }, [abierto]);

  const buscar = async (texto) => {
    const consulta = String(texto || '').trim();
    if (consulta.length < 2) {
      setError('Escribi el prefijo y el texto: T titulo, A autor, * codigo o X contiene');
      setFilas([]);
      return;
    }
    setCargando(true);
    setError('');
    try {
      const res = await catalogoApi.f7(consulta);
      const lista = Array.isArray(res.data) ? res.data : (res.data && res.data.filas) || [];
      setFilas(lista);
      setBuscado(consulta);
      setIndice(0);
      if (!lista.length) setError('Sin resultados para esa busqueda (proba con otro prefijo).');
    } catch (err) {
      setError(err.message);
      setFilas([]);
    } finally {
      setCargando(false);
    }
  };

  const eanDe = (a) => a.barras || a.ean13 || a.codigo || '';

  const agregar = (a) => {
    if (!enFacturar) return;
    emitirInstruccion({ dominio: 'ventas', accion: 'agregar_item', item: { ean13: eanDe(a), titulo: a.titulo, precio: a.precioLista || a.precio } });
    onCerrar();
  };

  // Ver ficha: abre el catalogo con ese articulo (la vista escucha la instruccion y muestra la
  // ficha con su kardex; la instruccion se consume una sola vez).
  const verFicha = (a) => {
    emitirInstruccion({ dominio: 'catalogo', accion: 'abrir_ficha', data: { articuloId: a.id, ean13: eanDe(a) } });
    if (onIrACatalogo) onIrACatalogo();
    onCerrar();
  };

  const alTeclearInput = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (filas.length && e.shiftKey) agregar(filas[indice]);
      else buscar(q);
      return;
    }
    if (e.key === 'ArrowDown' && filas.length) {
      e.preventDefault();
      setIndice((i) => Math.min(i + 1, filas.length - 1));
    }
    if (e.key === 'ArrowUp' && filas.length) {
      e.preventDefault();
      setIndice((i) => Math.max(i - 1, 0));
    }
  };

  // La seleccion sigue al teclado: si se sale de vista, se acerca.
  useEffect(() => {
    const fila = listaRef.current && listaRef.current.querySelector(`[data-fila="${indice}"]`);
    if (fila && fila.scrollIntoView) fila.scrollIntoView({ block: 'nearest' });
  }, [indice, filas]);

  // ↺ Limpiar: borra el borrador guardado y arranca de cero (mismo gesto que el F7).
  const limpiar = () => {
    limpiarMemoria();
    setError('');
    setIndice(0);
    if (inputRef.current) inputRef.current.focus();
  };

  const footer = (
    <div className="flex items-center justify-between gap-2 w-full">
      <span className="text-xs text-muted">
        T titulo · A autor · * codigo exacto · X contiene {enFacturar ? '· ↑↓ elegir · Enter buscar · Shift+Enter agrega' : '· ↑↓ elegir'} · la busqueda se conserva al cerrar
      </span>
      <button type="button" className="btn btn-ghost text-xs" onClick={onCerrar}>Cerrar (Esc)</button>
    </div>
  );

  return (
    <Modal abierto={abierto} onClose={onCerrar} titulo="Busqueda tecnica (F6)" ancho="900px" footer={footer}>
      <div className="flex gap-2 mb-3">
        <input
          ref={inputRef}
          className="input-os font-mono flex-1"
          value={q}
          onChange={(e) => setQ(e.target.value.toUpperCase())}
          onKeyDown={alTeclearInput}
          placeholder="T RAYUELA   ·   A BORGES   ·   * 9789500000000   ·   X INFANTIL"
        />
        <button type="button" className="btn btn-primary text-sm" disabled={cargando} onClick={() => buscar(q)}>
          {cargando ? 'Buscando...' : 'Buscar'}
        </button>
        <button type="button" className="btn btn-ghost text-sm" title="Empezar de cero (borra la busqueda guardada)" onClick={limpiar}>↺ Limpiar</button>
      </div>
      {error && <p className="text-sm mb-2" style={{ color: 'var(--danger)' }}>{error}</p>}
      {buscado && !error && <p className="text-xs text-muted mb-1">{filas.length} resultado(s) para «{buscado}»</p>}
      <div ref={listaRef} style={{ maxHeight: '52vh', overflowY: 'auto' }}>
        {filas.length ? (
          <table className="table-os w-full text-sm">
            <thead>
              <tr>
                <th>EAN</th>
                <th>Titulo</th>
                <th>Autor</th>
                <th>Editorial</th>
                <th className="text-right">Precio</th>
                <th className="text-right">Stock</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {filas.map((a, i) => (
                <tr
                  key={eanDe(a) || i}
                  data-fila={i}
                  style={i === indice ? { background: 'var(--bg-soft)' } : undefined}
                  onClick={() => setIndice(i)}
                  onDoubleClick={() => agregar(a)}
                >
                  <td className="font-mono text-xs">{eanDe(a)}</td>
                  <td>{a.titulo}</td>
                  <td className="text-muted">{a.autor || a.autorPrincipal || ''}</td>
                  <td className="text-muted">{a.editorial || ''}</td>
                  <td className="text-right font-mono">{money(a.precioLista || a.precio)}</td>
                  <td className="text-right font-mono" style={{ color: stockDe(a) > 0 ? '#15803d' : 'var(--danger)' }}>{stockDe(a)}</td>
                  <td className="text-right whitespace-nowrap">
                    {enFacturar && <button type="button" className="btn btn-primary text-xs" onClick={() => agregar(a)}>Agregar</button>}
                    <button type="button" className="btn btn-ghost text-xs ml-1" onClick={() => verFicha(a)}>Ficha</button>
                    <BotonSecretario
                      soloIcono
                      className="btn btn-ghost text-xs ml-1"
                      consulta={`Contame que sabemos de "${a.titulo}" (${eanDe(a)}).`}
                      alPedir={onCerrar}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          !error && <p className="text-sm text-muted">{buscado ? 'Sin resultados.' : 'Escribi una busqueda y apreta Enter.'}</p>
        )}
      </div>
    </Modal>
  );
}
