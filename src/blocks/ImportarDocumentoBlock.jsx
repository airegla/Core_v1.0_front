// BookOS - ImportarDocumentoBlock.jsx
// ruta: bookos/frontend/src/blocks/ImportarDocumentoBlock.jsx
// descripcion: modal "Importar documento" (bookerp: ImportarComprobanteModalBlock).
//   Pestañas por módulo (pedidos, compras, remitos, liquidaciones, devoluciones),
//   búsqueda, selección con vista previa y carga de los libros al trabajo actual.

import { useEffect, useState } from 'react';
import Modal from '../ui/Modal';
import { comprasApi, remitosApi, ventasApi, consignaApi, mayoristaApi } from '../api/api';

const fmt = (n) => `$${Number(n || 0).toLocaleString('es-AR')}`;

function normItems(items) {
  return (items || []).map((it) => ({
    ean13: String(it.ean13 || it.codigo || it.barras || ''),
    titulo: it.titulo || '',
    // Las sabanas guardan la cantidad en stockConsigna; el resto en cantidad.
    cantidad: Number(it.cantidad ?? it.stockConsigna) || 1,
    precio: Number(it.precio ?? it.precioUnitario ?? it.precioLista ?? it.neto ?? 0) || 0,
    costo: it.costo != null ? Number(it.costo) : null,
  }));
}

const TABS = [
  {
    id: 'pedidos', label: 'Pedidos',
    cargar: async () => {
      const r = await ventasApi.pendientes();
      return (r.data || []).map((d) => ({
        id: d.id, numero: `#${d.id}`, fecha: d.createdAt,
        entidad: d.clienteId ? `Cliente #${d.clienteId}` : 'Consumidor final',
        tipo: d.tipo, items: normItems(d.articulos),
      }));
    },
  },
  {
    id: 'compras', label: 'Compras',
    cargar: async () => {
      const r = await comprasApi.listar({ limit: 100 });
      return (r.data || []).map((d) => ({
        id: d.id, numero: `#${d.id}`, fecha: d.createdAt,
        entidad: d.proveedorId ? `Proveedor #${d.proveedorId}` : '—',
        tipo: d.tipoComprobante, items: normItems(d.items),
      }));
    },
  },
  {
    id: 'remitos', label: 'Remitos',
    cargar: async () => {
      const r = await remitosApi.listar({ page: 1, limit: 100 });
      return (r.data || []).map((d) => ({
        id: d.id, numero: `#${d.id}`, fecha: d.createdAt,
        entidad: d.proveedor || '—', tipo: d.estado, items: normItems(d.items),
      }));
    },
  },
  {
    id: 'liquidaciones', label: 'Liquidaciones',
    cargar: async () => {
      const r = await consignaApi.liquidaciones({ limit: 100 });
      const filas = r.data?.filas || r.data || [];
      return filas.map((d) => ({
        id: d.id, numero: `#${d.id}`, fecha: d.createdAt,
        entidad: d.proveedorId ? `Proveedor #${d.proveedorId}` : '—',
        tipo: d.estado, items: normItems(d.detalle),
      }));
    },
  },
  {
    id: 'devoluciones', label: 'Devoluciones',
    cargar: async () => {
      const r = await consignaApi.listarDevoluciones({ limit: 100 });
      const filas = r.data?.filas || r.data || [];
      return filas.map((d) => ({
        id: d.id, numero: d.nroRemito || `#${d.id}`, fecha: d.createdAt,
        entidad: d.proveedorId ? `Proveedor #${d.proveedorId}` : '—',
        tipo: d.estado, items: normItems(d.items),
      }));
    },
  },
  {
    id: 'remitos_mayoristas', label: 'Remitos mayor.',
    cargar: async () => {
      const r = await mayoristaApi.listarRemitos({ limit: 100 });
      return (r.data || []).map((d) => ({
        id: d.id, numero: `#${d.id}`, fecha: d.createdAt,
        entidad: `${(d.origen && d.origen.nombre) || '—'} → ${(d.destino && d.destino.nombre) || '—'}`, tipo: d.tipoRemito, items: normItems(d.items),
      }));
    },
  },
  {
    id: 'ventas_mayoristas', label: 'Ventas mayor.',
    cargar: async () => {
      const r = await mayoristaApi.listarVentas({ limit: 100 });
      return (r.data || []).map((d) => ({
        id: d.id, numero: `#${d.id}`, fecha: d.createdAt,
        entidad: (d.cliente && d.cliente.nombre) || `Cliente #${d.clienteId || '?'}`, tipo: d.tipoComprobante, items: normItems(d.items),
      }));
    },
  },
  {
    id: 'sabanas', label: 'Sábanas',
    cargar: async () => {
      const r = await mayoristaApi.listarSabanas({ limit: 100 });
      return (r.data || []).map((d) => ({
        id: d.id, numero: d.numero, fecha: d.fecha,
        entidad: (d.cliente && d.cliente.nombre) || `Cliente #${d.clienteId || '?'}`, tipo: 'SABANA', items: normItems(d.items),
      }));
    },
  },
  {
    id: 'devoluciones_mayoristas', label: 'Devoluciones mayor.',
    cargar: async () => {
      const r = await mayoristaApi.listarDevoluciones({ limit: 100 });
      return (r.data || []).map((d) => ({
        id: d.id, numero: d.numero, fecha: d.fecha,
        entidad: (d.cliente && d.cliente.nombre) || `Cliente #${d.clienteId || '?'}`, tipo: d.tipoComprobante, items: normItems(d.items),
      }));
    },
  },
  {
    id: 'pedidos_devolucion', label: 'Pedidos devolución',
    cargar: async () => {
      const r = await mayoristaApi.listarPedidos({ limit: 100 });
      const filas = r.data?.filas || r.data || [];
      return filas.map((d) => ({
        id: d.id, numero: d.numero, fecha: d.fecha,
        entidad: (d.cliente && d.cliente.nombre) || `Cliente #${d.clienteId || '?'}`, tipo: d.estado, items: normItems(d.items),
      }));
    },
  },
];

export default function ImportarDocumentoBlock({ onCargar, etiqueta = 'Importar documento' }) {
  const [abierto, setAbierto] = useState(false);
  const [tab, setTab] = useState('pedidos');
  const [docs, setDocs] = useState([]);
  const [q, setQ] = useState('');
  const [selId, setSelId] = useState(null);
  const [loading, setLoading] = useState(false);

  const cargarTab = async (id) => {
    setLoading(true); setSelId(null); setDocs([]);
    try {
      const t = TABS.find((x) => x.id === id);
      const lista = await t.cargar();
      setDocs(lista);
    } catch (e) {
      setDocs([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { if (abierto) cargarTab(tab); }, [abierto, tab]); // eslint-disable-line

  const filtrados = docs.filter((d) => !q || `${d.numero} ${d.entidad} ${d.tipo}`.toLowerCase().includes(q.toLowerCase()));
  const sel = docs.find((d) => d.id === selId);

  const cargar = () => { if (sel) onCargar(sel.items); setAbierto(false); setQ(''); setSelId(null); };

  return (
    <>
      <button type="button" className="btn btn-ghost text-xs" onClick={() => setAbierto(true)}>{etiqueta}</button>

      <Modal
        abierto={abierto}
        onClose={() => setAbierto(false)}
        titulo="Importar documento"
        ancho="780px"
        footer={
          <>
            <button type="button" className="btn btn-ghost" onClick={() => setAbierto(false)}>Cancelar</button>
            <button type="button" className="btn btn-primary" disabled={!selId} onClick={cargar}>
              {selId ? `Cargar (${sel ? sel.items.length : 0} libros)` : 'Cargar documento'}
            </button>
          </>
        }
      >
        <div className="flex gap-1 mb-3 flex-wrap">
          {TABS.map((t) => (
            <button key={t.id} type="button" className={`btn ${tab === t.id ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setTab(t.id)}>{t.label}</button>
          ))}
        </div>

        <input
          className="input-os mb-3"
          style={{ maxWidth: 360 }}
          placeholder="Buscar por número o entidad..."
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />

        <div style={{ maxHeight: 260, overflowY: 'auto' }} className="mb-3">
          {loading ? (
            <p className="text-sm text-muted py-6 text-center">Cargando...</p>
          ) : filtrados.length === 0 ? (
            <p className="text-sm text-muted py-6 text-center">Sin documentos en este módulo.</p>
          ) : (
            <table className="table-os">
              <thead>
                <tr><th style={{ width: 30 }} /><th>Nro</th><th>Fecha</th><th>Entidad</th><th>Tipo</th><th>Items</th></tr>
              </thead>
              <tbody>
                {filtrados.map((d) => (
                  <tr
                    key={`${tab}-${d.id}`}
                    onClick={() => setSelId(d.id)}
                    style={{ cursor: 'pointer', background: selId === d.id ? 'var(--bg-soft)' : undefined }}
                  >
                    <td><input type="radio" readOnly checked={selId === d.id} /></td>
                    <td className="font-mono text-xs">{d.numero}</td>
                    <td className="text-xs">{d.fecha ? new Date(d.fecha).toLocaleDateString('es-AR') : '—'}</td>
                    <td className="text-sm">{d.entidad}</td>
                    <td><span className="agente-badge">{d.tipo}</span></td>
                    <td className="text-center font-semibold">{d.items.length}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {sel && (
          <div className="card p-3">
            <div className="text-xs uppercase tracking-widest text-muted mb-1">Vista previa ({sel.items.length} libros)</div>
            <div style={{ maxHeight: 160, overflowY: 'auto' }}>
              {sel.items.map((it, i) => (
                <div key={i} className="flex justify-between text-sm py-0.5">
                  <span>{it.cantidad}× {it.titulo} <span className="font-mono text-xs text-muted">({it.ean13})</span></span>
                  <span className="font-mono">{fmt(it.precio)}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </Modal>
    </>
  );
}
