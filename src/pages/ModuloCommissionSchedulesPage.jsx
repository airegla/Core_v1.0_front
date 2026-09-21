// BookOS Core - ModuloCommissionSchedules.jsx
// ruta: Core/frontend/src/pages/ModuloCommissionSchedules.jsx
// descripcion: pagina del modulo "Horarios de Comisión" (adoptado de la tabla legacy "commission_schedules" por el
//   nucleo de desarrollo): listado y alta contra la API del Core.

import { useCallback, useEffect, useState } from 'react';
import DebugTag from '../ui/DebugTag';
import axiosClient from '../api/axiosClient';

const VACIO = {
  commissionId: '',
  roomId: '',
  dayOfWeek: '',
  startTime: '',
  endTime: '',
};

export default function ModuloCommissionSchedules() {
  const [filas, setFilas] = useState([]);
  const [total, setTotal] = useState(0);
  const [form, setForm] = useState(VACIO);
  const [error, setError] = useState('');
  const [mensaje, setMensaje] = useState('');
  const [cargando, setCargando] = useState(true);

  const cargar = useCallback(() => {
    setCargando(true);
    axiosClient.get('/commission_schedules', { params: { limite: 300 } })
      .then((r) => { setFilas(r.data.filas || []); setTotal(r.data.total || 0); })
      .catch((e) => setError(e.message))
      .finally(() => setCargando(false));
  }, []);

  useEffect(() => { cargar(); }, [cargar]);

  const guardar = async (e) => {
    e.preventDefault();
    setError(''); setMensaje('');
    try {
      await axiosClient.post('/commission_schedules', form);
      setForm(VACIO);
      setMensaje('✓ Horarios de Comisión: creado');
      cargar();
    } catch (err) { setError(err.message); }
  };

  const cambio = (campo) => (e) => setForm({ ...form, [campo]: e.target.value });

  return (
    <div>
      <DebugTag nombre="ModuloCommissionSchedules" />
      <h2 className="text-lg font-semibold mb-1">Horarios de Comisión</h2>
      <p className="text-sm text-muted mb-4">
        Define las franjas horarias en las que una comisión ocupa una sala según el día de la semana. Se usa para planificar disponibilidad y evitar solapamientos. `commissionId` y `roomId` referencian la comisión y la sala; `dayOfWeek` indica el día (1 lunes a 7 domingo); `startTime` y `endTime` son horas en formato HH:MM.
      </p>
      {error && <p className="text-sm mb-3" style={{ color: 'var(--danger)' }}>⚠️ {error}</p>}
      {mensaje && <p className="text-sm mb-3">{mensaje}</p>}
      <form className="card p-4 mb-4 flex flex-wrap items-end gap-3" onSubmit={guardar}>
        <label className="block text-sm">
          <span className="block text-xs uppercase tracking-widest text-muted mb-1">commissionId</span>
          <input className="input-os" value={form.commissionId} onChange={cambio('commissionId')} />
        </label>
        <label className="block text-sm">
          <span className="block text-xs uppercase tracking-widest text-muted mb-1">roomId</span>
          <input className="input-os" value={form.roomId} onChange={cambio('roomId')} />
        </label>
        <label className="block text-sm">
          <span className="block text-xs uppercase tracking-widest text-muted mb-1">dayOfWeek</span>
          <input className="input-os" value={form.dayOfWeek} onChange={cambio('dayOfWeek')} />
        </label>
        <label className="block text-sm">
          <span className="block text-xs uppercase tracking-widest text-muted mb-1">startTime</span>
          <input className="input-os" value={form.startTime} onChange={cambio('startTime')} />
        </label>
        <label className="block text-sm">
          <span className="block text-xs uppercase tracking-widest text-muted mb-1">endTime</span>
          <input className="input-os" value={form.endTime} onChange={cambio('endTime')} />
        </label>
        <button type="submit" className="btn btn-primary">Agregar</button>
      </form>
      <div className="card p-4">
        <p className="text-xs uppercase tracking-widest text-muted mb-2">{total} fila(s)</p>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs uppercase tracking-widest text-muted">
              <th className="pb-1">commissionId</th>
              <th className="pb-1">roomId</th>
              <th className="pb-1">dayOfWeek</th>
              <th className="pb-1">startTime</th>
              <th className="pb-1">endTime</th>
            </tr>
          </thead>
          <tbody>
            {filas.map((f, i) => (
              <tr key={f.id || i} className="border-t" style={{ borderColor: 'var(--border, #333)' }}>
                <td className="py-1">{String(f.commissionId ?? '')}</td>
                <td className="py-1">{String(f.roomId ?? '')}</td>
                <td className="py-1">{String(f.dayOfWeek ?? '')}</td>
                <td className="py-1">{String(f.startTime ?? '')}</td>
                <td className="py-1">{String(f.endTime ?? '')}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {cargando && <p className="text-sm text-muted mt-2">Cargando...</p>}
        {!cargando && filas.length === 0 && <p className="text-sm text-muted mt-2">Sin filas todavia.</p>}
      </div>
    </div>
  );
}
