// BookOS Core - ModuloAttendanceRecords.jsx
// ruta: Core/frontend/src/pages/ModuloAttendanceRecords.jsx
// descripcion: pagina del modulo "Asistencias" (adoptado de la tabla legacy "attendance_records" por el
//   nucleo de desarrollo): listado y alta contra la API del Core.
// estilos: los del core (card/btn/input-os y el patron de colores del tema por variables CSS); para reemplazarlos, crear src/styles/modulo-attendance_records.css y regenerar (o importarlo a mano).

import { useCallback, useEffect, useState } from 'react';
import DebugTag from '../ui/DebugTag';
import axiosClient from '../api/axiosClient';

const VACIO = {
  commissionId: '',
  studentId: '',
  date: '',
  status: '',
  recordedById: '',
  notes: '',
};

export default function ModuloAttendanceRecords() {
  const [filas, setFilas] = useState([]);
  const [total, setTotal] = useState(0);
  const [form, setForm] = useState(VACIO);
  const [error, setError] = useState('');
  const [mensaje, setMensaje] = useState('');
  const [cargando, setCargando] = useState(true);

  const cargar = useCallback(() => {
    setCargando(true);
    axiosClient.get('/attendance_records', { params: { limite: 300 } })
      .then((r) => { setFilas(r.data.filas || []); setTotal(r.data.total || 0); })
      .catch((e) => setError(e.message))
      .finally(() => setCargando(false));
  }, []);

  useEffect(() => { cargar(); }, [cargar]);

  const guardar = async (e) => {
    e.preventDefault();
    setError(''); setMensaje('');
    try {
      await axiosClient.post('/attendance_records', form);
      setForm(VACIO);
      setMensaje('✓ Asistencias: creado');
      cargar();
    } catch (err) { setError(err.message); }
  };

  const cambio = (campo) => (e) => setForm({ ...form, [campo]: e.target.value });

  return (
    <div>
      <DebugTag nombre="ModuloAttendanceRecords" />
      <h2 className="text-lg font-semibold mb-1">Asistencias</h2>
      <p className="text-sm text-muted mb-4">
        Registro de asistencia: cada fila marca la asistencia de un alumno (studentId) en una comision o clase (commissionId) en una fecha concreta (date). El campo status documenta el resultado de esa asistencia (PRESENT, ABSENT, LATE, JUSTIFIED; en el nucleo, que no admite enums, se adopta como String respetando esos valores) y recordedById identifica al usuario que tomo o registro la asistencia. notes guarda observaciones libres sobre el registro y createdAt marca cuando se cargo.
      </p>
      {error && <p className="text-sm mb-3" style={{ color: 'var(--danger)' }}>⚠️ {error}</p>}
      {mensaje && <p className="text-sm mb-3">{mensaje}</p>}
      <form className="card p-4 mb-4 flex flex-wrap items-end gap-3" onSubmit={guardar}>
        <label className="block text-sm">
          <span className="block text-xs uppercase tracking-widest text-muted mb-1">commissionId</span>
          <input className="input-os" value={form.commissionId} onChange={cambio('commissionId')} />
        </label>
        <label className="block text-sm">
          <span className="block text-xs uppercase tracking-widest text-muted mb-1">studentId</span>
          <input className="input-os" value={form.studentId} onChange={cambio('studentId')} />
        </label>
        <label className="block text-sm">
          <span className="block text-xs uppercase tracking-widest text-muted mb-1">date</span>
          <input className="input-os" value={form.date} onChange={cambio('date')} />
        </label>
        <label className="block text-sm">
          <span className="block text-xs uppercase tracking-widest text-muted mb-1">status</span>
          <input className="input-os" value={form.status} onChange={cambio('status')} />
        </label>
        <label className="block text-sm">
          <span className="block text-xs uppercase tracking-widest text-muted mb-1">recordedById</span>
          <input className="input-os" value={form.recordedById} onChange={cambio('recordedById')} />
        </label>
        <label className="block text-sm">
          <span className="block text-xs uppercase tracking-widest text-muted mb-1">notes</span>
          <input className="input-os" value={form.notes} onChange={cambio('notes')} />
        </label>
        <button type="submit" className="btn btn-primary">Agregar</button>
      </form>
      <div className="card p-4">
        <p className="text-xs uppercase tracking-widest text-muted mb-2">{total} fila(s)</p>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs uppercase tracking-widest text-muted">
              <th className="pb-1">commissionId</th>
              <th className="pb-1">studentId</th>
              <th className="pb-1">date</th>
              <th className="pb-1">status</th>
              <th className="pb-1">recordedById</th>
              <th className="pb-1">notes</th>
            </tr>
          </thead>
          <tbody>
            {filas.map((f, i) => (
              <tr key={f.id || i} className="border-t" style={{ borderColor: 'var(--border, #333)' }}>
                <td className="py-1">{String(f.commissionId ?? '')}</td>
                <td className="py-1">{String(f.studentId ?? '')}</td>
                <td className="py-1">{String(f.date ?? '')}</td>
                <td className="py-1">{String(f.status ?? '')}</td>
                <td className="py-1">{String(f.recordedById ?? '')}</td>
                <td className="py-1">{String(f.notes ?? '')}</td>
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
