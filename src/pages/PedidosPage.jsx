// BookOS - PedidosPage.jsx
// ruta: bookos/frontend/src/pages/PedidosPage.jsx
// descripcion: pedidos de clientes del CRM (doc 06): alta, filtros por estado y busqueda,
//   paginado server-side, cambio de estado por fila y export CSV. Los estados son los 6 del
//   ciclo de vida (Pendiente -> Solicitado -> Ingresado -> Notificado | Agotado | Cancelado).

import { useEffect, useState } from 'react';
import Table from '../ui/Table';
import Modal from '../ui/Modal';
import Input from '../ui/Input';
import Paginador from '../ui/Paginador';
import DebugTag from '../ui/DebugTag';
import SelectBuscador from '../ui/SelectBuscador';
import { buscarClientes } from '../utils/selectores';
import { crmApi } from '../api/api';
import { descargarCsv } from '../utils/exportar';
import { useAppContext } from '../AppContext';

const ESTADOS = ['Pendiente', 'Solicitado', 'Ingresado', 'Notificado', 'Agotado', 'Cancelado'];

export default function PedidosPage() {
  const { instruccionVista, emitirInstruccion } = useAppContext();
  const [filas, setFilas] = useState([]);
  const [total, setTotal] = useState(0);
  const [porEstado, setPorEstado] = useState({});
  const [page, setPage] = useState(1);
  const [estado, setEstado] = useState('');
  const [busqueda, setBusqueda] = useState('');
  const [mensaje, setMensaje] = useState('');
  const [modal, setModal] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [form, setForm] = useState({ clienteId: '', codigo: '', descripcionTexto: '', cantidad: 1, observaciones: '' });
  const [clienteNombre, setClienteNombre] = useState('');

  const cargar = async () => {
    try {
      const r = await crmApi.pedidos({ estado: estado || undefined, busqueda: busqueda || undefined, page, limit: 25 });
      setFilas(r.data.filas || []);
      setTotal(r.data.total || 0);
      setPorEstado(r.data.porEstado || {});
    } catch (err) {
      setMensaje(`⚠️ ${err.message}`);
    }
  };

  useEffect(() => { cargar(); }, [page, estado]); // eslint-disable-line

  // El cliente creado con F2 llega por el bus: si el alta de pedido esta abierta, queda elegido.
  useEffect(() => {
    if (!instruccionVista || instruccionVista.dominio !== 'clientes' || instruccionVista.accion !== 'cliente_creado') return;
    const c = instruccionVista.cliente;
    if (c && c.id && modal) {
      setForm((f) => ({ ...f, clienteId: c.id }));
      setClienteNombre(c.nombre);
    }
    emitirInstruccion(null);
  }, [instruccionVista]); // eslint-disable-line

  const abrirNuevo = async () => {
    setForm({ clienteId: '', codigo: '', descripcionTexto: '', cantidad: 1, observaciones: '' });
    setClienteNombre('');
    setModal(true);
  };

  const guardar = async () => {
    setGuardando(true);
    try {
      const r = await crmApi.crearPedido({
        clienteId: Number(form.clienteId),
        codigo: form.codigo || null,
        descripcionTexto: form.descripcionTexto || null,
        cantidad: Number(form.cantidad || 1),
        observaciones: form.observaciones || null,
      });
      setMensaje(`Pedido #${r.data.pedido.pedidoId} anotado (${r.data.pedido.estado}).`);
      setModal(false);
      cargar();
    } catch (err) {
      setMensaje(`⚠️ ${err.message}`);
    } finally {
      setGuardando(false);
    }
  };

  const cambiar = async (id, nuevo) => {
    try {
      await crmApi.estadoPedido(id, nuevo);
      setMensaje(`Pedido #${id} → ${nuevo}`);
      cargar();
    } catch (err) {
      setMensaje(`⚠️ ${err.message}`);
    }
  };

  const exportar = () => {
    if (!filas.length) return;
    descargarCsv('pedidos_cliente', columnas.map((c) => ({ titulo: c.titulo, clave: c.clave })), filas);
  };

  const columnas = [
    { clave: 'pedidoId', titulo: '#' },
    { clave: 'cliente', titulo: 'Cliente' },
    { clave: 'titulo', titulo: 'Titulo' },
    { clave: 'cantidad', titulo: 'Cant.' },
    { clave: 'estado', titulo: 'Estado' },
    { clave: 'intentos', titulo: 'Intentos' },
    { clave: 'proveedor', titulo: 'Proveedor' },
    { clave: 'observaciones', titulo: 'Obs.' },
    {
      clave: 'cambiar',
      titulo: 'Cambiar estado',
      render: (f) => (
        <select className="input-os" style={{ maxWidth: 150 }} value="" onChange={(e) => { if (e.target.value) cambiar(f.pedidoId, e.target.value); }}>
          <option value="">→ estado</option>
          {ESTADOS.filter((x) => x !== f.estado).map((x) => <option key={x} value={x}>{x}</option>)}
        </select>
      ),
    },
  ];

  return (
    <div>
      <DebugTag nombre="PedidosPage" />
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold">Pedidos de clientes</h2>
        <div className="flex gap-2">
          <button type="button" className="btn" onClick={exportar} disabled={!filas.length}>Exportar CSV</button>
          <button type="button" className="btn btn-primary" onClick={abrirNuevo}>Nuevo pedido</button>
        </div>
      </div>
      {mensaje && <p className="text-sm mb-3">{mensaje}</p>}

      <div className="card p-3 mb-3 flex flex-wrap items-center gap-3">
        <select className="input-os" style={{ maxWidth: 180 }} value={estado} onChange={(e) => { setEstado(e.target.value); setPage(1); }}>
          <option value="">Todos los estados</option>
          {ESTADOS.map((e) => <option key={e} value={e}>{e}{porEstado[e] ? ` (${porEstado[e]})` : ''}</option>)}
        </select>
        <input className="input-os" style={{ maxWidth: 280 }} placeholder="cliente, titulo o EAN..." value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') { setPage(1); cargar(); } }} />
        <button type="button" className="btn" onClick={() => { setPage(1); cargar(); }}>Filtrar</button>
        <span className="text-xs text-muted">
          {ESTADOS.map((e) => `${e} ${porEstado[e] || 0}`).join(' · ')}
        </span>
      </div>

      <div className="card p-3">
        <Table columnas={columnas} filas={filas} vacio="Sin pedidos para el filtro" />
        <Paginador page={page} total={total} limite={25} onCambiar={setPage} etiqueta="pedidos" />
        <Paginador page={page} total={total} limite={25} onCambiar={setPage} etiqueta="pedidos" />
      </div>

      {modal && (
        <Modal
          abierto={modal}
          onClose={() => setModal(false)}
          titulo="Nuevo pedido de cliente"
          footer={(
            <>
              <button type="button" className="btn" onClick={() => setModal(false)}>Cancelar</button>
              <button type="button" className="btn btn-primary" disabled={guardando || !form.clienteId} onClick={guardar}>
                {guardando ? 'Guardando...' : 'Anotar pedido'}
              </button>
            </>
          )}
        >
          <div className="form-grid">
            <div>
              <label className="field-label">Cliente</label>
              <SelectBuscador
                valor={form.clienteId || null}
                etiquetaValor={clienteNombre}
                placeholder="Buscar cliente..."
                buscar={buscarClientes}
                onSeleccionar={(it) => { setForm({ ...form, clienteId: it ? it.id : '' }); setClienteNombre(it ? it.etiqueta : ''); }}
              />
            </div>
            <Input label="Codigo del catalogo (EAN/ISBN)" value={form.codigo} onChange={(e) => setForm({ ...form, codigo: e.target.value })} />
            <Input label="O titulo libre (si no esta en el catalogo)" value={form.descripcionTexto} onChange={(e) => setForm({ ...form, descripcionTexto: e.target.value })} />
            <Input label="Cantidad" type="number" value={form.cantidad} onChange={(e) => setForm({ ...form, cantidad: e.target.value })} />
            <Input label="Observaciones" value={form.observaciones} onChange={(e) => setForm({ ...form, observaciones: e.target.value })} />
          </div>
        </Modal>
      )}
    </div>
  );
}
