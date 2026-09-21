// BookOS - OperadoresPagoBlock.jsx
// ruta: bookos/frontend/src/blocks/OperadoresPagoBlock.jsx
// descripcion: mantenimiento de operadores/pasarelas de pago (posnet de Payway, pos de
//   MercadoPago, Fiserv...) con su porcentaje estimado de costo. Es la tabla madre de las
//   sub-formas de pago: cada sub-forma cuelga de un operador.

import { useEffect, useState } from 'react';
import Table from '../ui/Table';
import Modal from '../ui/Modal';
import { parametrosApi } from '../api/api';

const VACIO = { nombre: '', porcentajeCostoEstimado: '', descripcion: '' };

export default function OperadoresPagoBlock() {
  const [filas, setFilas] = useState([]);
  const [mensaje, setMensaje] = useState('');
  const [abierto, setAbierto] = useState(false);
  const [form, setForm] = useState(VACIO);

  const cargar = async () => {
    try {
      const res = await parametrosApi.operadoresPago();
      setFilas(res.data || []);
    } catch (err) { setMensaje(`⚠️ ${err.message}`); }
  };
  useEffect(() => { cargar(); }, []);

  const guardar = async () => {
    try {
      await parametrosApi.crearOperadorPago({
        nombre: form.nombre,
        porcentajeCostoEstimado: Number(form.porcentajeCostoEstimado) || 0,
        descripcion: form.descripcion || null,
      });
      setMensaje(`Operador "${form.nombre}" creado ✓`);
      setAbierto(false);
      setForm(VACIO);
      cargar();
    } catch (err) { setMensaje(`⚠️ ${err.message}`); }
  };

  const alternar = async (o) => {
    try {
      await parametrosApi.actualizarOperadorPago(o.id, { activo: !o.activo });
      cargar();
    } catch (err) { setMensaje(`⚠️ ${err.message}`); }
  };

  // El backend devuelve 409 si el operador tiene sub-formas: el mensaje se muestra tal cual.
  const eliminar = async (o) => {
    if (!window.confirm(`¿Eliminar el operador "${o.nombre}"?`)) return;
    try {
      await parametrosApi.eliminarOperadorPago(o.id);
      setMensaje('Operador eliminado ✓');
      cargar();
    } catch (err) { setMensaje(`⚠️ ${err.message}`); }
  };

  const columnas = [
    { clave: 'id', titulo: 'ID' },
    { clave: 'nombre', titulo: 'Operador / pasarela' },
    { clave: 'porcentajeCostoEstimado', titulo: '% costo estimado', render: (o) => `${Number(o.porcentajeCostoEstimado || 0).toLocaleString('es-AR')}%` },
    { clave: 'descripcion', titulo: 'Descripción' },
    { clave: 'activo', titulo: 'Estado', render: (o) => <span className="agente-badge">{o.activo ? 'ACTIVO' : 'INACTIVO'}</span> },
    { clave: 'acciones', titulo: '', render: (o) => (
      <div className="flex gap-2">
        <button type="button" className="btn btn-ghost text-xs" onClick={() => alternar(o)}>{o.activo ? 'Desactivar' : 'Activar'}</button>
        <button type="button" className="btn btn-ghost text-xs" style={{ color: 'var(--danger)' }} onClick={() => eliminar(o)}>Eliminar</button>
      </div>
    ) },
  ];

  return (
    <div>
      <div className="flex justify-end mb-3">
        <button type="button" className="btn btn-primary text-xs" onClick={() => setAbierto(true)}>+ Operador</button>
      </div>
      {mensaje && <p className="text-sm mb-3">{mensaje}</p>}
      <Table columnas={columnas} filas={filas} vacio="Sin operadores cargados" exportable exportarNombre="operadores_pago" />
      <p className="text-xs text-muted mt-2">
        El % es lo que estimás que te cobra la pasarela sobre el monto. El costo real de cada cobro se
        guarda como foto del momento en la venta y en el recibo.
      </p>

      <Modal abierto={abierto} onClose={() => setAbierto(false)} titulo="Nuevo operador de pago" ancho="420px"
        footer={
          <>
            <button type="button" className="btn btn-ghost" onClick={() => setAbierto(false)}>Cancelar</button>
            <button type="button" className="btn btn-primary" disabled={!form.nombre} onClick={guardar}>Guardar</button>
          </>
        }
      >
        <label className="block mb-3">
          <span className="block text-xs uppercase tracking-widest text-muted mb-1">Nombre</span>
          <input className="input-os" placeholder="Payway / MercadoPago / Fiserv..." value={form.nombre} onChange={(e) => setForm((f) => ({ ...f, nombre: e.target.value }))} />
        </label>
        <label className="block mb-3">
          <span className="block text-xs uppercase tracking-widest text-muted mb-1">% estimado de costo</span>
          <input className="input-os" type="number" min="0" step="0.01" placeholder="1.5" value={form.porcentajeCostoEstimado} onChange={(e) => setForm((f) => ({ ...f, porcentajeCostoEstimado: e.target.value }))} />
        </label>
        <label className="block">
          <span className="block text-xs uppercase tracking-widest text-muted mb-1">Descripción</span>
          <input className="input-os" placeholder="Posnet del local, pos de MercadoPago..." value={form.descripcion} onChange={(e) => setForm((f) => ({ ...f, descripcion: e.target.value }))} />
        </label>
      </Modal>
    </div>
  );
}
