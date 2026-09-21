// BookOS - ProveedoresPage.jsx
// ruta: bookos/frontend/src/pages/ProveedoresPage.jsx
// descripcion: ABM de proveedores (regla bookerp: no se puede borrar si tiene
//   compras asociadas).

import { useEffect, useState } from 'react';
import Table from '../ui/Table';
import Modal from '../ui/Modal';
import Input from '../ui/Input';
import Paginador from '../ui/Paginador';
import DebugTag from '../ui/DebugTag';
import { proveedoresApi, transportesApi, ctaCteApi } from '../api/api';

export default function ProveedoresPage() {
  const [proveedores, setProveedores] = useState([]);
  const [transportes, setTransportes] = useState([]);
  const [modal, setModal] = useState(false);
  const [editando, setEditando] = useState(null);
  const [form, setForm] = useState({});
  const [ficha, setFicha] = useState(null);
  const [mensaje, setMensaje] = useState('');
  const [busqueda, setBusqueda] = useState('');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);

  const cargar = async (q = busqueda, p = page) => {
    try {
      const res = await proveedoresApi.listar({ search: q, page: p, limit: 25 });
      setProveedores(res.data || []);
      setTotal(res.pagination ? res.pagination.total : (res.data || []).length);
    } catch (err) { setMensaje(`⚠️ ${err.message}`); }
  };

  useEffect(() => { cargar(busqueda, 1); }, []); // eslint-disable-line
  useEffect(() => { if (page > 1) cargar(busqueda, page); }, [page]); // eslint-disable-line

  const buscar = () => { setPage(1); cargar(busqueda, 1); };
  useEffect(() => {
    transportesApi.listar().then((res) => setTransportes(res.data || [])).catch(() => {});
  }, []);

  const abrirNuevo = () => { setEditando(null); setForm({ activo: true }); setModal(true); };
  const abrirEditar = (p) => { setEditando(p); setForm(p); setModal(true); };

  const guardar = async () => {
    try {
      if (editando) await proveedoresApi.actualizar(editando.id, form);
      else await proveedoresApi.crear(form);
      setModal(false);
      cargar();
    } catch (err) { setMensaje(`⚠️ ${err.message}`); }
  };

  const eliminar = async (p) => {
    try {
      await proveedoresApi.eliminar(p.id);
      cargar();
    } catch (err) { setMensaje(`⚠️ ${err.message}`); }
  };

  // Ficha + cuenta corriente del proveedor (positivo = le debemos).
  const verFicha = async (p) => {
    try {
      const res = await ctaCteApi.estadoCuenta({ proveedorId: p.id });
      setFicha({ proveedor: p, cuenta: res.data || res });
    } catch (err) { setMensaje(`⚠️ ${err.message}`); }
  };

  const columnas = [
    { clave: 'nombre', titulo: 'Nombre' },
    { clave: 'cuit', titulo: 'CUIT' },
    { clave: 'telefono', titulo: 'Telefono' },
    { clave: 'localidad', titulo: 'Localidad' },
    { clave: 'acciones', titulo: '', render: (p) => (
      <div className="flex gap-2">
        <button type="button" className="btn btn-ghost text-xs" onClick={() => verFicha(p)}>Ver</button>
        <button type="button" className="btn btn-ghost text-xs" onClick={() => abrirEditar(p)}>Editar</button>
        <button type="button" className="btn btn-ghost text-xs" style={{ color: 'var(--danger)' }} onClick={() => eliminar(p)}>Eliminar</button>
      </div>
    ) },
  ];

  const columnasCuenta = [
    { clave: 'fecha', titulo: 'Fecha', render: (m) => new Date(m.fecha).toLocaleDateString('es-AR') },
    { clave: 'tipoComprobante', titulo: 'Comprobante' },
    { clave: 'debe', titulo: 'Debe', render: (m) => (Number(m.debe) ? `$${Number(m.debe).toLocaleString('es-AR')}` : '') },
    { clave: 'haber', titulo: 'Haber', render: (m) => (Number(m.haber) ? `$${Number(m.haber).toLocaleString('es-AR')}` : '') },
    { clave: 'saldo', titulo: 'Saldo', render: (m) => `$${Number(m.saldo).toLocaleString('es-AR')}` },
    { clave: 'vencimiento', titulo: 'Vence', render: (m) => (m.fechaVencimiento ? new Date(m.fechaVencimiento).toLocaleDateString('es-AR') : '') },
  ];

  return (
    <div>
      <DebugTag nombre="ProveedoresPage" />
      <div className="flex items-center justify-between mb-4 gap-2">
        <h2 className="text-lg font-semibold">Proveedores</h2>
        <div className="flex gap-2">
          <input
            className="input-os"
            style={{ maxWidth: 260 }}
            placeholder="Buscar por nombre, CUIT o email..."
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') buscar(); }}
          />
          <button type="button" className="btn" onClick={buscar}>Buscar</button>
          <button type="button" className="btn btn-primary" onClick={abrirNuevo}>Nuevo proveedor</button>
        </div>
      </div>
      {mensaje && <p className="text-sm mb-3">{mensaje}</p>}
      <Table columnas={columnas} filas={proveedores} vacio="Sin proveedores" exportable exportarNombre="proveedores" />
      <Paginador page={page} total={total} limite={25} onCambiar={setPage} etiqueta="proveedores" />

      <Modal abierto={modal} onClose={() => setModal(false)} titulo={editando ? 'Editar proveedor' : 'Nuevo proveedor'} ancho="680px"
        footer={(
          <div className="flex gap-2">
            <button type="button" className="btn" onClick={() => setModal(false)}>Cancelar</button>
            <button type="button" className="btn btn-primary" disabled={!form.nombre} onClick={guardar}>Guardar</button>
          </div>
        )}
      >
        <div className="grid grid-cols-2 gap-3">
          <Input label="Razon social" value={form.nombre || ''} onChange={(e) => setForm({ ...form, nombre: e.target.value })} />
          <Input label="Nombre de fantasia" value={form.nombreFantasia || ''} onChange={(e) => setForm({ ...form, nombreFantasia: e.target.value })} />
          <Input label="Codigo interno" value={form.codigo || ''} onChange={(e) => setForm({ ...form, codigo: e.target.value })} />
          <Input label="CUIT" value={form.cuit || ''} onChange={(e) => setForm({ ...form, cuit: e.target.value })} />
          <Input label="Telefono" value={form.telefono || ''} onChange={(e) => setForm({ ...form, telefono: e.target.value })} />
          <Input label="Email" value={form.email || ''} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          <Input label="Bonificacion %" type="number" value={form.porcentajeDescuento ?? ''} onChange={(e) => setForm({ ...form, porcentajeDescuento: e.target.value === '' ? null : Number(e.target.value) })} />
          <label className="block mb-3">
            <span className="block text-xs uppercase tracking-widest text-muted mb-1">Transporte asignado</span>
            <select className="input-os" value={form.transporteId || ''} onChange={(e) => setForm({ ...form, transporteId: e.target.value ? Number(e.target.value) : null })}>
              <option value="">Sin transporte</option>
              {transportes.map((t) => <option key={t.id} value={t.id}>{t.nombre}</option>)}
            </select>
          </label>
          <Input label="Direccion" value={form.direccion || ''} onChange={(e) => setForm({ ...form, direccion: e.target.value })} />
          <Input label="Localidad" value={form.localidad || ''} onChange={(e) => setForm({ ...form, localidad: e.target.value })} />
        </div>
        <label className="flex items-center gap-2 text-sm mb-3">
          <input type="checkbox" checked={form.activo !== false} onChange={(e) => setForm({ ...form, activo: e.target.checked })} /> Activo
        </label>
        <label className="block mb-3">
          <span className="block text-xs uppercase tracking-widest text-muted mb-1">Observaciones</span>
          <textarea className="input-os resize-none" rows={2} value={form.observaciones || ''} onChange={(e) => setForm({ ...form, observaciones: e.target.value })} />
        </label>
      </Modal>

      <Modal abierto={Boolean(ficha)} onClose={() => setFicha(null)} titulo={ficha ? `Ficha - ${ficha.proveedor.nombre}` : ''} ancho="760px"
        footer={ficha ? <button type="button" className="btn btn-primary" onClick={() => setFicha(null)}>Cerrar</button> : null}
      >
        {ficha && (
          <>
            <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-sm mb-4">
              <div><span className="text-muted">Fantasia: </span>{ficha.proveedor.nombreFantasia || '-'}</div>
              <div><span className="text-muted">Codigo interno: </span>{ficha.proveedor.codigo || '-'}</div>
              <div><span className="text-muted">CUIT: </span>{ficha.proveedor.cuit || '-'}</div>
              <div><span className="text-muted">Telefono: </span>{ficha.proveedor.telefono || '-'}</div>
              <div><span className="text-muted">Email: </span>{ficha.proveedor.email || '-'}</div>
              <div><span className="text-muted">Localidad: </span>{ficha.proveedor.localidad || '-'}</div>
              <div className="col-span-2"><span className="text-muted">Direccion: </span>{ficha.proveedor.direccion || '-'}</div>
              <div><span className="text-muted">Bonificacion: </span>{ficha.proveedor.porcentajeDescuento ? `${ficha.proveedor.porcentajeDescuento}%` : '-'}</div>
              <div><span className="text-muted">Transporte: </span>{(transportes.find((t) => t.id === ficha.proveedor.transporteId) || {}).nombre || '-'}</div>
              {ficha.proveedor.observaciones && <div className="col-span-2"><span className="text-muted">Observaciones: </span>{ficha.proveedor.observaciones}</div>}
            </div>
            <div className="flex items-center justify-between mb-2">
              <h4 className="font-semibold">Cuenta corriente</h4>
              <div className="text-sm">
                Saldo: <strong style={{ color: Number(ficha.cuenta.saldoActual) > 0 ? 'var(--danger)' : undefined }}>${Number(ficha.cuenta.saldoActual || 0).toLocaleString('es-AR')}</strong>
                <span className="text-xs text-muted"> (positivo = le debemos)</span>
              </div>
            </div>
            <Table columnas={columnasCuenta} filas={(ficha.cuenta.movimientos || []).slice(-10).reverse()} vacio="Sin movimientos" />
            <p className="text-xs text-muted mt-2">
              Ultimos {Math.min(10, (ficha.cuenta.movimientos || []).length)} de {(ficha.cuenta.movimientos || []).length} movimientos.
              El estado de cuenta completo esta en Cta. corriente proveedor.
            </p>
          </>
        )}
      </Modal>
    </div>
  );
}
