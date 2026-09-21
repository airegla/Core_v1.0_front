// BookOS Core - ModuloCommissions.jsx
// ruta: Core/frontend/src/pages/ModuloCommissions.jsx
// descripcion: pagina del modulo "Comisiones" (adoptado de la tabla legacy "commissions" por el
//   nucleo de desarrollo): listado y alta contra la API del Core.
// estilos: los del core (card/btn/input-os y el patron de colores del tema por variables CSS); para reemplazarlos, crear src/styles/modulo-commissions.css y regenerar (o importarlo a mano).

import { useCallback, useEffect, useState } from 'react';
import DebugTag from '../ui/DebugTag';
import axiosClient from '../api/axiosClient';

const VACIO = {
  name: '',
  courseId: '',
  teacherId: '',
  roomId: '',
  priceListId: '',
  quota: '',
  active: '',
};

export default function ModuloCommissions() {
  const [filas, setFilas] = useState([]);
  const [total, setTotal] = useState(0);
  const [form, setForm] = useState(VACIO);
  const [error, setError] = useState('');
  const [mensaje, setMensaje] = useState('');
  const [cargando, setCargando] = useState(true);

  const cargar = useCallback(() => {
    setCargando(true);
    axiosClient.get('/commissions', { params: { limite: 300 } })
      .then((r) => { setFilas(r.data.filas || []); setTotal(r.data.total || 0); })
      .catch((e) => setError(e.message))
      .finally(() => setCargando(false));
  }, []);

  useEffect(() => { cargar(); }, [cargar]);

  const guardar = async (e) => {
    e.preventDefault();
    setError(''); setMensaje('');
    try {
      await axiosClient.post('/commissions', form);
      setForm(VACIO);
      setMensaje('✓ Comisiones: creado');
      cargar();
    } catch (err) { setError(err.message); }
  };

  const cambio = (campo) => (e) => setForm({ ...form, [campo]: e.target.value });

  return (
    <div>
      <DebugTag nombre="ModuloCommissions" />
      <h2 className="text-lg font-semibold mb-1">Comisiones</h2>
      <p className="text-sm text-muted mb-4">
        
      </p>
      {error && <p className="text-sm mb-3" style={{ color: 'var(--danger)' }}>⚠️ {error}</p>}
      {mensaje && <p className="text-sm mb-3">{mensaje}</p>}
      <form className="card p-4 mb-4 flex flex-wrap items-end gap-3" onSubmit={guardar}>
        <label className="block text-sm">
          <span className="block text-xs uppercase tracking-widest text-muted mb-1">name</span>
          <input className="input-os" value={form.name} onChange={cambio('name')} />
        </label>
        <label className="block text-sm">
          <span className="block text-xs uppercase tracking-widest text-muted mb-1">courseId</span>
          <input className="input-os" value={form.courseId} onChange={cambio('courseId')} />
        </label>
        <label className="block text-sm">
          <span className="block text-xs uppercase tracking-widest text-muted mb-1">teacherId</span>
          <input className="input-os" value={form.teacherId} onChange={cambio('teacherId')} />
        </label>
        <label className="block text-sm">
          <span className="block text-xs uppercase tracking-widest text-muted mb-1">roomId</span>
          <input className="input-os" value={form.roomId} onChange={cambio('roomId')} />
        </label>
        <label className="block text-sm">
          <span className="block text-xs uppercase tracking-widest text-muted mb-1">priceListId</span>
          <input className="input-os" value={form.priceListId} onChange={cambio('priceListId')} />
        </label>
        <label className="block text-sm">
          <span className="block text-xs uppercase tracking-widest text-muted mb-1">quota</span>
          <input className="input-os" value={form.quota} onChange={cambio('quota')} />
        </label>
        <label className="block text-sm">
          <span className="block text-xs uppercase tracking-widest text-muted mb-1">active</span>
          <input className="input-os" value={form.active} onChange={cambio('active')} />
        </label>
        <button type="submit" className="btn btn-primary">Agregar</button>
      </form>
      <div className="card p-4">
        <p className="text-xs uppercase tracking-widest text-muted mb-2">{total} fila(s)</p>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs uppercase tracking-widest text-muted">
              <th className="pb-1">name</th>
              <th className="pb-1">courseId</th>
              <th className="pb-1">teacherId</th>
              <th className="pb-1">roomId</th>
              <th className="pb-1">priceListId</th>
              <th className="pb-1">quota</th>
              <th className="pb-1">active</th>
            </tr>
          </thead>
          <tbody>
            {filas.map((f, i) => (
              <tr key={f.id || i} className="border-t" style={{ borderColor: 'var(--border, #333)' }}>
                <td className="py-1">{String(f.name ?? '')}</td>
                <td className="py-1">{String(f.courseId ?? '')}</td>
                <td className="py-1">{String(f.teacherId ?? '')}</td>
                <td className="py-1">{String(f.roomId ?? '')}</td>
                <td className="py-1">{String(f.priceListId ?? '')}</td>
                <td className="py-1">{String(f.quota ?? '')}</td>
                <td className="py-1">{String(f.active ?? '')}</td>
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
