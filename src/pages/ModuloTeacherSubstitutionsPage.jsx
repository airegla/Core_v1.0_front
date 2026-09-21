// BookOS Core - ModuloTeacherSubstitutions.jsx
// ruta: Core/frontend/src/pages/ModuloTeacherSubstitutions.jsx
// descripcion: pagina del modulo "Suplencias de Docentes" (adoptado de la tabla legacy "teacher_substitutions" por el
//   nucleo de desarrollo): listado y alta contra la API del Core.
// estilos: los del core (card/btn/input-os y el patron de colores del tema por variables CSS); para reemplazarlos, crear src/styles/modulo-teacher_substitutions.css y regenerar (o importarlo a mano).

import { useCallback, useEffect, useState } from 'react';
import DebugTag from '../ui/DebugTag';
import axiosClient from '../api/axiosClient';

const VACIO = {
  date: '',
  commissionId: '',
  originalTeacherId: '',
  substituteTeacherId: '',
  hoursWorked: '',
  reason: '',
};

export default function ModuloTeacherSubstitutions() {
  const [filas, setFilas] = useState([]);
  const [total, setTotal] = useState(0);
  const [form, setForm] = useState(VACIO);
  const [error, setError] = useState('');
  const [mensaje, setMensaje] = useState('');
  const [cargando, setCargando] = useState(true);

  const cargar = useCallback(() => {
    setCargando(true);
    axiosClient.get('/teacher_substitutions', { params: { limite: 300 } })
      .then((r) => { setFilas(r.data.filas || []); setTotal(r.data.total || 0); })
      .catch((e) => setError(e.message))
      .finally(() => setCargando(false));
  }, []);

  useEffect(() => { cargar(); }, [cargar]);

  const guardar = async (e) => {
    e.preventDefault();
    setError(''); setMensaje('');
    try {
      await axiosClient.post('/teacher_substitutions', form);
      setForm(VACIO);
      setMensaje('✓ Suplencias de Docentes: creado');
      cargar();
    } catch (err) { setError(err.message); }
  };

  const cambio = (campo) => (e) => setForm({ ...form, [campo]: e.target.value });

  return (
    <div>
      <DebugTag nombre="ModuloTeacherSubstitutions" />
      <h2 className="text-lg font-semibold mb-1">Suplencias de Docentes</h2>
      <p className="text-sm text-muted mb-4">
        
      </p>
      {error && <p className="text-sm mb-3" style={{ color: 'var(--danger)' }}>⚠️ {error}</p>}
      {mensaje && <p className="text-sm mb-3">{mensaje}</p>}
      <form className="card p-4 mb-4 flex flex-wrap items-end gap-3" onSubmit={guardar}>
        <label className="block text-sm">
          <span className="block text-xs uppercase tracking-widest text-muted mb-1">date</span>
          <input className="input-os" value={form.date} onChange={cambio('date')} />
        </label>
        <label className="block text-sm">
          <span className="block text-xs uppercase tracking-widest text-muted mb-1">commissionId</span>
          <input className="input-os" value={form.commissionId} onChange={cambio('commissionId')} />
        </label>
        <label className="block text-sm">
          <span className="block text-xs uppercase tracking-widest text-muted mb-1">originalTeacherId</span>
          <input className="input-os" value={form.originalTeacherId} onChange={cambio('originalTeacherId')} />
        </label>
        <label className="block text-sm">
          <span className="block text-xs uppercase tracking-widest text-muted mb-1">substituteTeacherId</span>
          <input className="input-os" value={form.substituteTeacherId} onChange={cambio('substituteTeacherId')} />
        </label>
        <label className="block text-sm">
          <span className="block text-xs uppercase tracking-widest text-muted mb-1">hoursWorked</span>
          <input className="input-os" value={form.hoursWorked} onChange={cambio('hoursWorked')} />
        </label>
        <label className="block text-sm">
          <span className="block text-xs uppercase tracking-widest text-muted mb-1">reason</span>
          <input className="input-os" value={form.reason} onChange={cambio('reason')} />
        </label>
        <button type="submit" className="btn btn-primary">Agregar</button>
      </form>
      <div className="card p-4">
        <p className="text-xs uppercase tracking-widest text-muted mb-2">{total} fila(s)</p>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs uppercase tracking-widest text-muted">
              <th className="pb-1">date</th>
              <th className="pb-1">commissionId</th>
              <th className="pb-1">originalTeacherId</th>
              <th className="pb-1">substituteTeacherId</th>
              <th className="pb-1">hoursWorked</th>
              <th className="pb-1">reason</th>
            </tr>
          </thead>
          <tbody>
            {filas.map((f, i) => (
              <tr key={f.id || i} className="border-t" style={{ borderColor: 'var(--border, #333)' }}>
                <td className="py-1">{String(f.date ?? '')}</td>
                <td className="py-1">{String(f.commissionId ?? '')}</td>
                <td className="py-1">{String(f.originalTeacherId ?? '')}</td>
                <td className="py-1">{String(f.substituteTeacherId ?? '')}</td>
                <td className="py-1">{String(f.hoursWorked ?? '')}</td>
                <td className="py-1">{String(f.reason ?? '')}</td>
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
