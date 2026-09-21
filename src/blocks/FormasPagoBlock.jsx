// BookOS - FormasPagoBlock.jsx
// ruta: bookos/frontend/src/blocks/FormasPagoBlock.jsx
// descripcion: sub-formas de pago (debito, credito 6 cuotas, promo semanal de Santa Fe...)
//   vinculadas a un metodo de pago madre y a un operador, con su coeficiente y cuotas. Son las
//   lineas que se eligen al cobrar (F10) y al registrar un recibo.

import { useEffect, useState } from 'react';
import Table from '../ui/Table';
import Modal from '../ui/Modal';
import { parametrosApi } from '../api/api';

const VACIO = { nombre: '', metodoPagoId: '', operadorId: '', subtipo: '', cuotas: '', coeficiente: '1', descripcion: '' };
const SUBTIPOS = ['', 'DEBITO', 'CREDITO', 'QR', 'PROMO'];

export default function FormasPagoBlock() {
  const [filas, setFilas] = useState([]);
  const [metodos, setMetodos] = useState([]);
  const [operadores, setOperadores] = useState([]);
  const [mensaje, setMensaje] = useState('');
  const [abierto, setAbierto] = useState(false);
  const [form, setForm] = useState(VACIO);

  const cargar = async () => {
    try {
      const [f, m, o] = await Promise.all([
        parametrosApi.formasPago(),
        parametrosApi.metodosPago(),
        parametrosApi.operadoresPago(),
      ]);
      setFilas(f.data || []);
      setMetodos((m.data || []).filter((x) => x.activo));
      setOperadores((o.data || []).filter((x) => x.activo));
    } catch (err) { setMensaje(`⚠️ ${err.message}`); }
  };
  useEffect(() => { cargar(); }, []);

  const guardar = async () => {
    try {
      await parametrosApi.crearFormaPago({
        nombre: form.nombre,
        metodoPagoId: form.metodoPagoId || null,
        operadorId: form.operadorId || null,
        subtipo: form.subtipo || null,
        cuotas: form.cuotas === '' ? null : Number(form.cuotas),
        coeficiente: form.coeficiente === '' ? 1 : Number(form.coeficiente),
        descripcion: form.descripcion || null,
      });
      setMensaje(`Sub-forma "${form.nombre}" creada ✓`);
      setAbierto(false);
      setForm(VACIO);
      cargar();
    } catch (err) { setMensaje(`⚠️ ${err.message}`); }
  };

  const alternar = async (f) => {
    try {
      await parametrosApi.actualizarFormaPago(f.id, { activo: !f.activo });
      cargar();
    } catch (err) { setMensaje(`⚠️ ${err.message}`); }
  };

  // Una sub-forma ya usada no se borra (409): el cobro la referencia. Se desactiva.
  const eliminar = async (f) => {
    if (!window.confirm(`¿Eliminar la sub-forma "${f.nombre}"?`)) return;
    try {
      await parametrosApi.eliminarFormaPago(f.id);
      setMensaje('Sub-forma eliminada ✓');
      cargar();
    } catch (err) { setMensaje(`⚠️ ${err.message}`); }
  };

  const columnas = [
    { clave: 'id', titulo: 'ID' },
    { clave: 'nombre', titulo: 'Sub-forma' },
    { clave: 'metodoPago', titulo: 'Método', render: (f) => f.metodoPago?.nombre || '—' },
    { clave: 'operador', titulo: 'Operador', render: (f) => f.operador ? `${f.operador.nombre} (${Number(f.operador.porcentajeCostoEstimado || 0)}%)` : '—' },
    { clave: 'subtipo', titulo: 'Subtipo', render: (f) => f.subtipo || '—' },
    { clave: 'cuotas', titulo: 'Cuotas', render: (f) => f.cuotas || '—' },
    { clave: 'coeficiente', titulo: 'Coeficiente', render: (f) => Number(f.coeficiente || 1).toFixed(2) },
    { clave: 'activo', titulo: 'Estado', render: (f) => <span className="agente-badge">{f.activo ? 'ACTIVA' : 'INACTIVA'}</span> },
    { clave: 'acciones', titulo: '', render: (f) => (
      <div className="flex gap-2">
        <button type="button" className="btn btn-ghost text-xs" onClick={() => alternar(f)}>{f.activo ? 'Desactivar' : 'Activar'}</button>
        <button type="button" className="btn btn-ghost text-xs" style={{ color: 'var(--danger)' }} onClick={() => eliminar(f)}>Eliminar</button>
      </div>
    ) },
  ];

  return (
    <div>
      <div className="flex justify-end mb-3">
        <button type="button" className="btn btn-primary text-xs" onClick={() => setAbierto(true)}>+ Sub-forma</button>
      </div>
      {mensaje && <p className="text-sm mb-3">{mensaje}</p>}
      <Table columnas={columnas} filas={filas} vacio="Sin sub-formas cargadas" exportable exportarNombre="formas_pago" />
      <p className="text-xs text-muted mt-2">
        El coeficiente se escribe como <strong>1.10</strong>: se aplica sobre el monto y la diferencia
        contra 1 es lo que absorbe el comercio. Ejemplo: "VISA Santa Fe promo semanal" = TARJETA +
        operador + coeficiente 1.10.
      </p>

      <Modal abierto={abierto} onClose={() => setAbierto(false)} titulo="Nueva sub-forma de pago" ancho="520px"
        footer={
          <>
            <button type="button" className="btn btn-ghost" onClick={() => setAbierto(false)}>Cancelar</button>
            <button type="button" className="btn btn-primary" disabled={!form.nombre} onClick={guardar}>Guardar</button>
          </>
        }
      >
        <label className="block mb-3">
          <span className="block text-xs uppercase tracking-widest text-muted mb-1">Nombre</span>
          <input className="input-os" placeholder="Visa Santa Fe promo semanal" value={form.nombre} onChange={(e) => setForm((f) => ({ ...f, nombre: e.target.value }))} />
        </label>
        <div className="grid grid-cols-2 gap-3 mb-3">
          <label className="block">
            <span className="block text-xs uppercase tracking-widest text-muted mb-1">Método madre</span>
            <select className="input-os" value={form.metodoPagoId} onChange={(e) => setForm((f) => ({ ...f, metodoPagoId: e.target.value }))}>
              <option value="">—</option>
              {metodos.map((m) => <option key={m.id} value={m.id}>{m.nombre}</option>)}
            </select>
          </label>
          <label className="block">
            <span className="block text-xs uppercase tracking-widest text-muted mb-1">Operador / pasarela</span>
            <select className="input-os" value={form.operadorId} onChange={(e) => setForm((f) => ({ ...f, operadorId: e.target.value }))}>
              <option value="">—</option>
              {operadores.map((o) => <option key={o.id} value={o.id}>{o.nombre}</option>)}
            </select>
          </label>
        </div>
        <div className="grid grid-cols-3 gap-3 mb-3">
          <label className="block">
            <span className="block text-xs uppercase tracking-widest text-muted mb-1">Subtipo</span>
            <select className="input-os" value={form.subtipo} onChange={(e) => setForm((f) => ({ ...f, subtipo: e.target.value }))}>
              {SUBTIPOS.map((s) => <option key={s} value={s}>{s || '—'}</option>)}
            </select>
          </label>
          <label className="block">
            <span className="block text-xs uppercase tracking-widest text-muted mb-1">Cuotas</span>
            <input className="input-os" type="number" min="1" placeholder="6" value={form.cuotas} onChange={(e) => setForm((f) => ({ ...f, cuotas: e.target.value }))} />
          </label>
          <label className="block">
            <span className="block text-xs uppercase tracking-widest text-muted mb-1">Coeficiente</span>
            <input className="input-os" type="number" min="1" step="0.01" placeholder="1.10" value={form.coeficiente} onChange={(e) => setForm((f) => ({ ...f, coeficiente: e.target.value }))} />
          </label>
        </div>
        <label className="block">
          <span className="block text-xs uppercase tracking-widest text-muted mb-1">Descripción</span>
          <input className="input-os" placeholder="Promo bancaria de los miercoles..." value={form.descripcion} onChange={(e) => setForm((f) => ({ ...f, descripcion: e.target.value }))} />
        </label>
        <p className="text-xs text-muted mt-3">
          El método madre define en qué línea del cobro aparece. Una sub-forma ya usada no se borra.
        </p>
      </Modal>
    </div>
  );
}
