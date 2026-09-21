// BookOS - TransportesPage.jsx
// ruta: bookos/frontend/src/pages/TransportesPage.jsx
// descripcion: transportes y depositos (eje del modulo mayorista). CRUD simple,
//   stock por deposito y conexion con el Secretario.

import { useEffect, useState } from 'react';
import Table from '../ui/Table';
import Paginador from '../ui/Paginador';
import Modal from '../ui/Modal';
import DebugTag from '../ui/DebugTag';
import { transportesApi, depositosApi } from '../api/api';
import { useAppContext } from '../AppContext';
import BotonSecretario from '../ui/BotonSecretario';
import BorradorRestaurado from '../ui/BorradorRestaurado';
// Sesion de trabajo: lo tipeado en el modal sobrevive al refresco.
import usePersistentWork from '../hooks/usePersistentWork';

const TIPOS_DEPOSITO = ['CENTRAL', 'SUCURSAL', 'MAYORISTA'];

export default function TransportesPage() {
  const [tab, setTab] = useState('transportes');
  const [transportes, setTransportes] = useState([]);
  const [depositos, setDepositos] = useState([]);
  const [pagT, setPagT] = useState(1);
  const LIMITE_PAG = 25;
  const [mensaje, setMensaje] = useState('');

  const [modalAbierto, setModalAbierto] = useState(false);
  const [editando, setEditando] = useState(null);
  const [form, setForm, limpiarForm, formRestaurado] = usePersistentWork('transporte_nuevo', { nombre: '', cuit: '', telefono: '', tipo: 'SUCURSAL', direccion: '' });

  const [stockDeposito, setStockDeposito] = useState(null);

  const { setContextoActual, pedirConsulta } = useAppContext();

  const cargar = async () => {
    try {
      const [t, d] = await Promise.all([transportesApi.listar(), depositosApi.listar()]);
      setTransportes(t.data || []);
      setDepositos(d.data || []);
    } catch (err) { setMensaje(`⚠️ ${err.message}`); }
  };

  useEffect(() => { cargar(); }, []); // eslint-disable-line

  useEffect(() => {
    setContextoActual({ vista: 'transportes', transportes: transportes.length, depositos: depositos.length });
  }, [transportes.length, depositos.length]); // eslint-disable-line

  const abrirNuevo = () => {
    setEditando(null);
    // NO se borra el borrador: si habia uno a medio cargar, se sigue desde ahi (el gesto ↺ limpia).
    setModalAbierto(true);
  };

  const abrirEditar = (item) => {
    setEditando(item);
    setForm({
      nombre: item.nombre || '',
      cuit: item.cuit || '',
      telefono: item.telefono || '',
      tipo: item.tipo || 'SUCURSAL',
      direccion: item.direccion || '',
    });
    setModalAbierto(true);
  };

  const guardar = async () => {
    try {
      if (tab === 'transportes') {
        const payload = { nombre: form.nombre, cuit: form.cuit, telefono: form.telefono };
        if (editando) await transportesApi.actualizar(editando.id, payload);
        else await transportesApi.crear(payload);
      } else {
        const payload = { nombre: form.nombre, tipo: form.tipo, direccion: form.direccion };
        if (editando) await depositosApi.actualizar(editando.id, payload);
        else await depositosApi.crear(payload);
      }
      setMensaje(`${tab === 'transportes' ? 'Transporte' : 'Depósito'} ${editando ? 'actualizado' : 'creado'} ✓`);
      setModalAbierto(false);
      limpiarForm();
      cargar();
    } catch (err) { setMensaje(`⚠️ ${err.message}`); }
  };

  const eliminar = async (id) => {
    const nombre = tab === 'transportes'
      ? transportes.find((t) => t.id === id)?.nombre
      : depositos.find((d) => d.id === id)?.nombre;
    if (!window.confirm(`¿Eliminar ${tab === 'transportes' ? 'transporte' : 'depósito'} "${nombre}"?`)) return;
    try {
      if (tab === 'transportes') await transportesApi.eliminar(id);
      else await depositosApi.eliminar?.(id);
      setMensaje('Eliminado ✓');
      cargar();
    } catch (err) { setMensaje(`⚠️ ${err.message}`); }
  };

  const verStock = async (id) => {
    try {
      const res = await depositosApi.stock(id);
      setStockDeposito({ deposito: depositos.find((d) => d.id === id), filas: res.data || [] });
    } catch (err) { setMensaje(`⚠️ ${err.message}`); }
  };

  const columnasTransportes = [
    { clave: 'id', titulo: 'ID' },
    { clave: 'nombre', titulo: 'Nombre' },
    { clave: 'cuit', titulo: 'CUIT' },
    { clave: 'telefono', titulo: 'Teléfono' },
    { clave: 'estado', titulo: 'Estado', render: (t) => <span className="agente-badge">{t.estado ? 'ACTIVO' : 'INACTIVO'}</span> },
    { clave: 'acciones', titulo: '', render: (t) => (
      <div className="flex gap-2">
        <button type="button" className="btn btn-ghost text-xs" onClick={() => abrirEditar(t)}>Editar</button>
        <button type="button" className="btn btn-ghost text-xs" style={{ color: 'var(--danger)' }} onClick={() => eliminar(t.id)}>Eliminar</button>
      </div>
    ) },
  ];

  const columnasDepositos = [
    { clave: 'id', titulo: 'ID' },
    { clave: 'nombre', titulo: 'Nombre' },
    { clave: 'tipo', titulo: 'Tipo', render: (d) => <span className="agente-badge">{d.tipo}</span> },
    { clave: 'direccion', titulo: 'Dirección' },
    { clave: 'activo', titulo: 'Estado', render: (d) => <span className="agente-badge">{d.activo ? 'ACTIVO' : 'INACTIVO'}</span> },
    { clave: 'acciones', titulo: '', render: (d) => (
      <div className="flex gap-2">
        <button type="button" className="btn btn-ghost text-xs" onClick={() => verStock(d.id)}>Stock</button>
        <button type="button" className="btn btn-ghost text-xs" onClick={() => abrirEditar(d)}>Editar</button>
      </div>
    ) },
  ];

  return (
    <div>
      <DebugTag nombre="TransportesPage" />
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold">Transportes y Depósitos</h2>
        <span className="text-xs text-muted">logística del módulo mayorista</span>
      </div>

      {mensaje && <p className="text-sm mb-3">{mensaje}</p>}

      <div className="flex items-center gap-3 mb-4">
        <div className="flex gap-1">
          <button type="button" className={`btn ${tab === 'transportes' ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setTab('transportes')}>Transportes</button>
          <button type="button" className={`btn ${tab === 'depositos' ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setTab('depositos')}>Depósitos</button>
        </div>
        <div className="flex-1" />
        <BotonSecretario
          className="btn btn-ghost text-xs"
          consulta={`Estoy en la vista de ${tab === 'transportes' ? 'transportes' : 'depósitos'} (${tab === 'transportes' ? transportes.length : depositos.length} registros). ¿Que me sugeris?`}
        />
        <button type="button" className="btn btn-primary text-xs" onClick={abrirNuevo}>
          + {tab === 'transportes' ? 'Transporte' : 'Depósito'}
        </button>
      </div>

      {tab === 'transportes'
        ? <Table columnas={columnasTransportes} filas={transportes.slice((pagT - 1) * LIMITE_PAG, pagT * LIMITE_PAG)} vacio="Sin transportes" exportable exportarNombre="transportes" />
        : <Table columnas={columnasDepositos} filas={depositos.slice((pagT - 1) * LIMITE_PAG, pagT * LIMITE_PAG)} vacio="Sin depositos" exportable exportarNombre="depositos" />}
      <Paginador page={pagT} total={tab === 'transportes' ? transportes.length : depositos.length} limite={LIMITE_PAG} onCambiar={setPagT} etiqueta={tab === 'transportes' ? 'transportes' : 'depositos'} />

      <Modal abierto={modalAbierto} onClose={() => setModalAbierto(false)} titulo={`${editando ? 'Editar' : 'Nuevo'} ${tab === 'transportes' ? 'transporte' : 'depósito'}`} ancho="420px"
        footer={
          <>
            <button type="button" className="btn btn-ghost" onClick={() => setModalAbierto(false)}>Cancelar</button>
            <button type="button" className="btn btn-primary" disabled={!form.nombre} onClick={guardar}>Guardar</button>
          </>
        }
      >
        <label className="block mb-3">
          <span className="block text-xs uppercase tracking-widest text-muted mb-1">Nombre</span>
          <BorradorRestaurado visible={formRestaurado} onLimpiar={limpiarForm} />
          <input className="input-os" value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} />
        </label>
        {tab === 'transportes' ? (
          <>
            <label className="block mb-3">
              <span className="block text-xs uppercase tracking-widest text-muted mb-1">CUIT</span>
              <input className="input-os" value={form.cuit} onChange={(e) => setForm({ ...form, cuit: e.target.value })} />
            </label>
            <label className="block mb-3">
              <span className="block text-xs uppercase tracking-widest text-muted mb-1">Teléfono</span>
              <input className="input-os" value={form.telefono} onChange={(e) => setForm({ ...form, telefono: e.target.value })} />
            </label>
          </>
        ) : (
          <>
            <label className="block mb-3">
              <span className="block text-xs uppercase tracking-widest text-muted mb-1">Tipo</span>
              <select className="input-os" value={form.tipo} onChange={(e) => setForm({ ...form, tipo: e.target.value })}>
                {TIPOS_DEPOSITO.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </label>
            <label className="block mb-3">
              <span className="block text-xs uppercase tracking-widest text-muted mb-1">Dirección</span>
              <input className="input-os" value={form.direccion} onChange={(e) => setForm({ ...form, direccion: e.target.value })} />
            </label>
          </>
        )}
      </Modal>

      <Modal abierto={Boolean(stockDeposito)} onClose={() => setStockDeposito(null)} titulo={stockDeposito ? `Stock de ${stockDeposito.deposito.nombre}` : ''} ancho="640px">
        {stockDeposito && (
          <table className="table-os">
            <thead>
              <tr><th>EAN13</th><th>Firme</th><th>Consigna</th><th>Consigna orig.</th></tr>
            </thead>
            <tbody>
              {stockDeposito.filas.length === 0 && (
                <tr><td colSpan={4} className="text-muted text-center py-4 text-xs">Sin stock registrado en este depósito</td></tr>
              )}
              {stockDeposito.filas.map((f) => (
                <tr key={`${f.ean13}-${f.depositoId}`}>
                  <td className="font-mono text-xs">{f.ean13}</td>
                  <td>{f.stockFirme}</td>
                  <td>{f.stockConsignaActual}</td>
                  <td>{f.stockConsignaOriginal}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Modal>
    </div>
  );
}
