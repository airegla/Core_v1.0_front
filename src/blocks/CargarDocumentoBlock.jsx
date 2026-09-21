// BookOS - CargarDocumentoBlock.jsx
// ruta: bookos/frontend/src/blocks/CargarDocumentoBlock.jsx
// descripcion: carga el contenido de un comprobante de otro modulo dentro del que
//   se esta armando (patron bookerp): elegis un remito/pedido/compra recuperable y
//   sus renglones se copian al borrador actual. Muestra preview antes de cargar.

import { useEffect, useState } from 'react';
import Modal from '../ui/Modal';
import DebugTag from '../ui/DebugTag';
import { documentosApi } from '../api/api';

const TIPOS = [
  { valor: '', label: 'Todos' },
  { valor: 'remito', label: 'Remitos' },
  { valor: 'pedido', label: 'Pedidos a proveedor' },
  { valor: 'compra', label: 'Compras' },
  { valor: 'liquidacion', label: 'Liquidaciones de consigna' },
  { valor: 'remito_mayorista', label: 'Remitos mayoristas' },
  { valor: 'venta_mayorista', label: 'Ventas mayoristas' },
  { valor: 'devolucion_mayorista', label: 'Devoluciones mayoristas' },
  { valor: 'pedido_devolucion', label: 'Pedidos de devolución' },
  { valor: 'sabana', label: 'Sábanas' },
];
const fmt = (n) => `$${Number(n || 0).toLocaleString('es-AR')}`;
const fecha = (f) => (f ? new Date(f).toLocaleDateString('es-AR') : '—');

export default function CargarDocumentoBlock({ onCargar, proveedorId = null, etiqueta = 'Cargar documento' }) {
  const [abierto, setAbierto] = useState(false);
  const [tipo, setTipo] = useState('');
  const [q, setQ] = useState('');
  const [filas, setFilas] = useState([]);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState('');
  const [elegido, setElegido] = useState(null);

  // Al abrir / cambiar tipo o busqueda: lista de recuperables (debounce en el texto).
  useEffect(() => {
    if (!abierto) return undefined;
    const t = setTimeout(async () => {
      setCargando(true);
      try {
        const res = await documentosApi.recuperables({ tipo: tipo || undefined, proveedorId: proveedorId || undefined, q: q || undefined, limite: 30 });
        // axiosClient desempaqueta el envelope: `res` ya es el payload.
        const payload = res && res.data !== undefined && !Array.isArray(res) ? res.data : res;
        setFilas(Array.isArray(payload) ? payload : []);
        setError('');
      } catch (err) {
        setError(err.message);
        setFilas([]);
      } finally {
        setCargando(false);
      }
    }, q ? 350 : 0);
    return () => clearTimeout(t);
  }, [abierto, tipo, q, proveedorId]);

  const elegir = async (d) => {
    try {
      const res = await documentosApi.detalle(d.tipo, d.id);
      const payload = res && res.data !== undefined && !Array.isArray(res) ? res.data : res;
      setElegido(payload);
      setError('');
    } catch (err) { setError(err.message); }
  };

  const cargar = () => {
    if (!elegido) return;
    onCargar(elegido.items || [], { proveedorId: elegido.proveedorId, numero: elegido.numero, tipo: elegido.tipo, id: elegido.id });
    setAbierto(false);
    setElegido(null);
    setQ('');
  };

  const cerrar = () => { setAbierto(false); setElegido(null); setQ(''); setError(''); };

  return (
    <div>
      <DebugTag nombre="CargarDocumentoBlock" />
      <button type="button" className="btn btn-ghost text-xs" onClick={() => setAbierto(true)}>
        📄 {etiqueta}
      </button>

      <Modal
        abierto={abierto}
        onClose={cerrar}
        titulo={elegido ? `Cargar ${elegido.tipo} #${elegido.id}` : etiqueta}
        ancho="760px"
        footer={elegido ? (
          <>
            <button type="button" className="btn btn-ghost" onClick={() => setElegido(null)}>Volver</button>
            <button type="button" className="btn btn-primary" onClick={cargar}>
              Cargar {(elegido.items || []).length} renglones
            </button>
          </>
        ) : <button type="button" className="btn btn-ghost" onClick={cerrar}>Cerrar</button>}
      >
        {error && <p className="text-sm mb-3" style={{ color: 'var(--danger)' }}>{error}</p>}

        {!elegido && (
          <>
            <div className="flex gap-2 mb-3 flex-wrap">
              <select className="input-os" style={{ maxWidth: 200 }} value={tipo} onChange={(e) => setTipo(e.target.value)}>
                {TIPOS.map((t) => <option key={t.valor || 'todos'} value={t.valor}>{t.label}</option>)}
              </select>
              <input
                className="input-os"
                style={{ maxWidth: 320 }}
                placeholder="Buscar por numero o proveedor..."
                value={q}
                onChange={(e) => setQ(e.target.value)}
              />
              {cargando && <span className="text-xs text-muted self-center">buscando...</span>}
            </div>
            {proveedorId ? <p className="text-xs text-muted mb-2">Filtrado por el proveedor de la cabecera.</p> : null}
            {filas.length === 0 && !cargando && <p className="text-sm text-muted">Sin documentos recuperables para ese filtro.</p>}
            <div style={{ maxHeight: 360, overflowY: 'auto' }}>
              {filas.map((d) => (
                <button
                  key={`${d.tipo}-${d.id}`}
                  type="button"
                  className="w-full text-left px-3 py-2 rounded"
                  onClick={() => elegir(d)}
                  title="Ver los renglones de este documento"
                >
                  <div className="flex justify-between items-center gap-3">
                    <div>
                      <div className="text-sm">
                        <span className="agente-badge mr-2">{d.tipo}</span>
                        #{d.id} {d.numero ? `· ${d.numero}` : ''} {d.estado ? `· ${d.estado}` : ''}
                      </div>
                      <div className="text-xs text-muted">{(d.cliente || d.proveedor || 'sin entidad')} · {fecha(d.fecha)}</div>
                    </div>
                    <div className="text-right text-xs">
                      <div>{d.items} renglones · {d.unidades} u</div>
                      {d.importe != null && <div className="font-mono">{fmt(d.importe)}</div>}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </>
        )}

        {elegido && (
          <>
            <p className="text-sm mb-2">
              <span className="agente-badge mr-2">{elegido.tipo}</span>
              #{elegido.id} · {elegido.cliente || elegido.proveedor || 'sin entidad'} · {fecha(elegido.fecha)} · estado {elegido.estado}
            </p>
            <div style={{ maxHeight: 320, overflowY: 'auto' }}>
              {(elegido.items || []).map((i, idx) => (
                <div key={`${i.ean13 || 's/c'}-${idx}`} className="text-sm py-1 flex justify-between gap-3" style={{ borderBottom: '1px solid var(--border)' }}>
                  <span className="flex-1 truncate">
                    {i.titulo || i.ean13 || '(renglon sin titulo)'}
                    <span className="text-xs text-muted ml-2 font-mono">{i.ean13 || ''}</span>
                  </span>
                  <span className="text-xs whitespace-nowrap">{i.cantidad} u {i.costo != null ? `× ${fmt(i.costo)}` : ''}</span>
                </div>
              ))}
            </div>
            <p className="text-xs text-muted mt-2">Los renglones se agregan al comprobante actual; despues podes ajustar cantidades y precios.</p>
          </>
        )}
      </Modal>
    </div>
  );
}
