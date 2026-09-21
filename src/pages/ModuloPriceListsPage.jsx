// BookOS Core - ModuloPriceLists.jsx
// ruta: Core/frontend/src/pages/ModuloPriceLists.jsx
// descripcion: pagina del modulo "Precios" (adoptado de la tabla legacy "price_lists" por el
//   nucleo de desarrollo): listado y alta contra la API del Core.
// estilos: los del core (card/btn/input-os y el patron de colores del tema por variables CSS); para reemplazarlos, crear src/styles/modulo-price_lists.css y regenerar (o importarlo a mano).

import { useCallback, useEffect, useState } from 'react';
import DebugTag from '../ui/DebugTag';
import axiosClient from '../api/axiosClient';

const VACIO = {
  itemType: '',
  courseId: '',
  amount: '',
  effectiveDate: '',
  isActive: '',
};

export default function ModuloPriceLists() {
  const [filas, setFilas] = useState([]);
  const [total, setTotal] = useState(0);
  const [form, setForm] = useState(VACIO);
  const [error, setError] = useState('');
  const [mensaje, setMensaje] = useState('');
  const [cargando, setCargando] = useState(true);

  const cargar = useCallback(() => {
    setCargando(true);
    axiosClient.get('/price_lists', { params: { limite: 300 } })
      .then((r) => { setFilas(r.data.filas || []); setTotal(r.data.total || 0); })
      .catch((e) => setError(e.message))
      .finally(() => setCargando(false));
  }, []);

  useEffect(() => { cargar(); }, [cargar]);

  const guardar = async (e) => {
    e.preventDefault();
    setError(''); setMensaje('');
    try {
      await axiosClient.post('/price_lists', form);
      setForm(VACIO);
      setMensaje('✓ Precios: creado');
      cargar();
    } catch (err) { setError(err.message); }
  };

  const cambio = (campo) => (e) => setForm({ ...form, [campo]: e.target.value });

  return (
    <div>
      <DebugTag nombre="ModuloPriceLists" />
      <h2 className="text-lg font-semibold mb-1">Precios</h2>
      <p className="text-sm text-muted mb-4">
        
      </p>
      {error && <p className="text-sm mb-3" style={{ color: 'var(--danger)' }}>⚠️ {error}</p>}
      {mensaje && <p className="text-sm mb-3">{mensaje}</p>}
      <form className="card p-4 mb-4 flex flex-wrap items-end gap-3" onSubmit={guardar}>
        <label className="block text-sm">
          <span className="block text-xs uppercase tracking-widest text-muted mb-1">itemType</span>
          <input className="input-os" value={form.itemType} onChange={cambio('itemType')} />
        </label>
        <label className="block text-sm">
          <span className="block text-xs uppercase tracking-widest text-muted mb-1">courseId</span>
          <input className="input-os" value={form.courseId} onChange={cambio('courseId')} />
        </label>
        <label className="block text-sm">
          <span className="block text-xs uppercase tracking-widest text-muted mb-1">amount</span>
          <input className="input-os" value={form.amount} onChange={cambio('amount')} />
        </label>
        <label className="block text-sm">
          <span className="block text-xs uppercase tracking-widest text-muted mb-1">effectiveDate</span>
          <input className="input-os" value={form.effectiveDate} onChange={cambio('effectiveDate')} />
        </label>
        <label className="block text-sm">
          <span className="block text-xs uppercase tracking-widest text-muted mb-1">isActive</span>
          <input className="input-os" value={form.isActive} onChange={cambio('isActive')} />
        </label>
        <button type="submit" className="btn btn-primary">Agregar</button>
      </form>
      <div className="card p-4">
        <p className="text-xs uppercase tracking-widest text-muted mb-2">{total} fila(s)</p>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs uppercase tracking-widest text-muted">
              <th className="pb-1">itemType</th>
              <th className="pb-1">courseId</th>
              <th className="pb-1">amount</th>
              <th className="pb-1">effectiveDate</th>
              <th className="pb-1">isActive</th>
            </tr>
          </thead>
          <tbody>
            {filas.map((f, i) => (
              <tr key={f.id || i} className="border-t" style={{ borderColor: 'var(--border, #333)' }}>
                <td className="py-1">{String(f.itemType ?? '')}</td>
                <td className="py-1">{String(f.courseId ?? '')}</td>
                <td className="py-1">{String(f.amount ?? '')}</td>
                <td className="py-1">{String(f.effectiveDate ?? '')}</td>
                <td className="py-1">{String(f.isActive ?? '')}</td>
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
