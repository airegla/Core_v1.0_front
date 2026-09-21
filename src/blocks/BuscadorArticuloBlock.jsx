// BookOS - BuscadorArticuloBlock.jsx
// ruta: bookos/frontend/src/blocks/BuscadorArticuloBlock.jsx
// descripcion: buscador de articulos para agregar a un comprobante (EAN, titulo,
//   autor o editorial) con debounce 300 ms y sugerencias (patron bookerp). Se usa
//   en ventas, compras y remitos para no depender de tipear el EAN de memoria.

import { useEffect, useRef, useState } from 'react';
import DebugTag from '../ui/DebugTag';
import { catalogoApi } from '../api/api';

const fmt = (n) => `$${Number(n || 0).toLocaleString('es-AR')}`;

export default function BuscadorArticuloBlock({ onSeleccionar, etiqueta = 'Buscar articulo' }) {
  const [termino, setTermino] = useState('');
  const [resultados, setResultados] = useState([]);
  const [buscando, setBuscando] = useState(false);
  const timerRef = useRef(null);
  const seqRef = useRef(0);

  // Debounce 300 ms: se busca mientras se tipea, sin apretar Enter.
  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    const t = termino.trim();
    if (t.length < 2) {
      setResultados([]);
      setBuscando(false);
      return undefined;
    }
    setBuscando(true);
    timerRef.current = setTimeout(async () => {
      const seq = seqRef.current + 1;
      seqRef.current = seq;
      try {
        const res = await catalogoApi.autocomplete(t);
        if (seq === seqRef.current) setResultados(res.data || []);
      } catch (_) {
        if (seq === seqRef.current) setResultados([]);
      } finally {
        if (seq === seqRef.current) setBuscando(false);
      }
    }, 300);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [termino]);

  const elegir = (articulo) => {
    onSeleccionar(articulo);
    setTermino('');
    setResultados([]);
  };

  return (
    <div>
      <DebugTag nombre="BuscadorArticuloBlock" />
      <div className="flex gap-2 items-center">
        <input
          className="input-os"
          style={{ maxWidth: 420 }}
          placeholder={`${etiqueta}: EAN, titulo, autor o editorial...`}
          value={termino}
          onChange={(e) => setTermino(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && resultados.length) {
              e.preventDefault();
              elegir(resultados[0]);
            }
            if (e.key === 'Escape') {
              setTermino('');
              setResultados([]);
            }
          }}
        />
        {buscando && <span className="text-xs text-muted">buscando...</span>}
      </div>
      {resultados.length > 0 && (
        <div className="mt-2 card p-1" style={{ maxHeight: 280, overflowY: 'auto' }}>
          {resultados.map((a) => (
            <button
              key={a.ean13}
              type="button"
              className="w-full text-left px-3 py-2 rounded"
              onClick={() => elegir(a)}
              title="Agregar este articulo"
            >
              <div className="flex justify-between items-center gap-3">
                <div>
                  <div className="text-sm font-medium">{a.titulo}</div>
                  <div className="text-xs text-muted">
                    {a.autor || 's/d'} · {a.editorial || 's/e'} · <span className="font-mono">{a.ean13}</span>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-sm font-mono">{fmt(a.precio)}</div>
                  <div className="text-xs text-muted">stock {Number(a.stock || 0) + Number(a.stockDeposito || 0)}</div>
                </div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
