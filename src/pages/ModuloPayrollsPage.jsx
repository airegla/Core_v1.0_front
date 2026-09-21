// BookOS Core - ModuloPayrolls.jsx
// ruta: Core/frontend/src/pages/ModuloPayrolls.jsx
// descripcion: pagina del modulo "Nominas" (adoptado de la tabla legacy "payrolls" por el
//   nucleo de desarrollo): listado y alta contra la API del Core.
// estilos: los del core (card/btn/input-os y el patron de colores del tema por variables CSS); para reemplazarlos, crear src/styles/modulo-payrolls.css y regenerar (o importarlo a mano).

import { useCallback, useEffect, useState } from 'react';
import DebugTag from '../ui/DebugTag';
import axiosClient from '../api/axiosClient';

const VACIO = {
  teacherId: '',
  periodMonth: '',
  periodYear: '',
  type: '',
  totalHours: '',
  hourlyRate: '',
  baseCollectedAmount: '',
  commissionPercentage: '',
  grossAmount: '',
  netAmount: '',
  status: '',
  updatedAt: '',
};

export default function ModuloPayrolls() {
  const [filas, setFilas] = useState([]);
  const [total, setTotal] = useState(0);
  const [form, setForm] = useState(VACIO);
  const [error, setError] = useState('');
  const [mensaje, setMensaje] = useState('');
  const [cargando, setCargando] = useState(true);

  const cargar = useCallback(() => {
    setCargando(true);
    axiosClient.get('/payrolls', { params: { limite: 300 } })
      .then((r) => { setFilas(r.data.filas || []); setTotal(r.data.total || 0); })
      .catch((e) => setError(e.message))
      .finally(() => setCargando(false));
  }, []);

  useEffect(() => { cargar(); }, [cargar]);

  const guardar = async (e) => {
    e.preventDefault();
    setError(''); setMensaje('');
    try {
      await axiosClient.post('/payrolls', form);
      setForm(VACIO);
      setMensaje('✓ Nominas: creado');
      cargar();
    } catch (err) { setError(err.message); }
  };

  const cambio = (campo) => (e) => setForm({ ...form, [campo]: e.target.value });

  return (
    <div>
      <DebugTag nombre="ModuloPayrolls" />
      <h2 className="text-lg font-semibold mb-1">Nominas</h2>
      <p className="text-sm text-muted mb-4">
        
      </p>
      {error && <p className="text-sm mb-3" style={{ color: 'var(--danger)' }}>⚠️ {error}</p>}
      {mensaje && <p className="text-sm mb-3">{mensaje}</p>}
      <form className="card p-4 mb-4 flex flex-wrap items-end gap-3" onSubmit={guardar}>
        <label className="block text-sm">
          <span className="block text-xs uppercase tracking-widest text-muted mb-1">teacherId</span>
          <input className="input-os" value={form.teacherId} onChange={cambio('teacherId')} />
        </label>
        <label className="block text-sm">
          <span className="block text-xs uppercase tracking-widest text-muted mb-1">periodMonth</span>
          <input className="input-os" value={form.periodMonth} onChange={cambio('periodMonth')} />
        </label>
        <label className="block text-sm">
          <span className="block text-xs uppercase tracking-widest text-muted mb-1">periodYear</span>
          <input className="input-os" value={form.periodYear} onChange={cambio('periodYear')} />
        </label>
        <label className="block text-sm">
          <span className="block text-xs uppercase tracking-widest text-muted mb-1">type</span>
          <input className="input-os" value={form.type} onChange={cambio('type')} />
        </label>
        <label className="block text-sm">
          <span className="block text-xs uppercase tracking-widest text-muted mb-1">totalHours</span>
          <input className="input-os" value={form.totalHours} onChange={cambio('totalHours')} />
        </label>
        <label className="block text-sm">
          <span className="block text-xs uppercase tracking-widest text-muted mb-1">hourlyRate</span>
          <input className="input-os" value={form.hourlyRate} onChange={cambio('hourlyRate')} />
        </label>
        <label className="block text-sm">
          <span className="block text-xs uppercase tracking-widest text-muted mb-1">baseCollectedAmount</span>
          <input className="input-os" value={form.baseCollectedAmount} onChange={cambio('baseCollectedAmount')} />
        </label>
        <label className="block text-sm">
          <span className="block text-xs uppercase tracking-widest text-muted mb-1">commissionPercentage</span>
          <input className="input-os" value={form.commissionPercentage} onChange={cambio('commissionPercentage')} />
        </label>
        <label className="block text-sm">
          <span className="block text-xs uppercase tracking-widest text-muted mb-1">grossAmount</span>
          <input className="input-os" value={form.grossAmount} onChange={cambio('grossAmount')} />
        </label>
        <label className="block text-sm">
          <span className="block text-xs uppercase tracking-widest text-muted mb-1">netAmount</span>
          <input className="input-os" value={form.netAmount} onChange={cambio('netAmount')} />
        </label>
        <label className="block text-sm">
          <span className="block text-xs uppercase tracking-widest text-muted mb-1">status</span>
          <input className="input-os" value={form.status} onChange={cambio('status')} />
        </label>
        <label className="block text-sm">
          <span className="block text-xs uppercase tracking-widest text-muted mb-1">updatedAt</span>
          <input className="input-os" value={form.updatedAt} onChange={cambio('updatedAt')} />
        </label>
        <button type="submit" className="btn btn-primary">Agregar</button>
      </form>
      <div className="card p-4">
        <p className="text-xs uppercase tracking-widest text-muted mb-2">{total} fila(s)</p>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs uppercase tracking-widest text-muted">
              <th className="pb-1">teacherId</th>
              <th className="pb-1">periodMonth</th>
              <th className="pb-1">periodYear</th>
              <th className="pb-1">type</th>
              <th className="pb-1">totalHours</th>
              <th className="pb-1">hourlyRate</th>
              <th className="pb-1">baseCollectedAmount</th>
              <th className="pb-1">commissionPercentage</th>
              <th className="pb-1">grossAmount</th>
              <th className="pb-1">netAmount</th>
              <th className="pb-1">status</th>
              <th className="pb-1">updatedAt</th>
            </tr>
          </thead>
          <tbody>
            {filas.map((f, i) => (
              <tr key={f.id || i} className="border-t" style={{ borderColor: 'var(--border, #333)' }}>
                <td className="py-1">{String(f.teacherId ?? '')}</td>
                <td className="py-1">{String(f.periodMonth ?? '')}</td>
                <td className="py-1">{String(f.periodYear ?? '')}</td>
                <td className="py-1">{String(f.type ?? '')}</td>
                <td className="py-1">{String(f.totalHours ?? '')}</td>
                <td className="py-1">{String(f.hourlyRate ?? '')}</td>
                <td className="py-1">{String(f.baseCollectedAmount ?? '')}</td>
                <td className="py-1">{String(f.commissionPercentage ?? '')}</td>
                <td className="py-1">{String(f.grossAmount ?? '')}</td>
                <td className="py-1">{String(f.netAmount ?? '')}</td>
                <td className="py-1">{String(f.status ?? '')}</td>
                <td className="py-1">{String(f.updatedAt ?? '')}</td>
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
