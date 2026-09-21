// BookOS - EmpresaPage.jsx
// ruta: bookos/frontend/src/pages/EmpresaPage.jsx
// descripcion: datos de la empresa (fiscales AR por defecto). Editable, nunca
//   eliminable: no existe boton de borrar.

import { useEffect, useState } from 'react';
import Input from '../ui/Input';
import DebugTag from '../ui/DebugTag';
import { empresaApi } from '../api/api';

export default function EmpresaPage() {
  const [form, setForm] = useState(null);
  const [mensaje, setMensaje] = useState('');

  useEffect(() => {
    empresaApi.obtener().then((res) => setForm(res.data || {})).catch(() => {});
  }, []);

  const guardar = async () => {
    try {
      const res = await empresaApi.actualizar(form);
      setForm(res.data);
      setMensaje('Empresa actualizada ✓ (indegradable: no se puede eliminar)');
    } catch (err) { setMensaje(`⚠️ ${err.message}`); }
  };

  if (!form) return <div><DebugTag nombre="EmpresaPage" /><p className="text-muted">Cargando...</p></div>;

  const esAr = form.pais === 'AR';
  // Los datos de contacto/fiscales extendidos viven en datosFiscales (JSON), sin migracion.
  const fiscales = form.datosFiscales || {};
  const setDato = (campo, valor) => setForm({ ...form, datosFiscales: { ...fiscales, [campo]: valor } });

  return (
    <div>
      <DebugTag nombre="EmpresaPage" />
      <h2 className="text-lg font-semibold mb-4">Empresa</h2>
      {mensaje && <p className="text-sm mb-3">{mensaje}</p>}

      <div className="card p-4 max-w-2xl">
        <div className="grid grid-cols-2 gap-3">
          <Input label="Nombre" value={form.nombre || ''} onChange={(e) => setForm({ ...form, nombre: e.target.value })} />
          <Input label="Rubro" value={form.rubro || ''} onChange={(e) => setForm({ ...form, rubro: e.target.value })} />
        </div>
        <label className="block mb-3">
          <span className="block text-xs uppercase tracking-widest text-muted mb-1">Pais</span>
          <select className="input-os" value={form.pais || 'AR'} onChange={(e) => setForm({ ...form, pais: e.target.value })}>
            <option value="AR">Argentina</option>
            <option value="ES">Espana</option>
            <option value="UY">Uruguay</option>
          </select>
        </label>
        {esAr && (
          <div className="grid grid-cols-2 gap-3">
            <Input label="CUIT" value={form.cuit || ''} onChange={(e) => setForm({ ...form, cuit: e.target.value })} />
            <Input label="Ingresos brutos (IIBB)" value={fiscales.iibb || ''} onChange={(e) => setDato('iibb', e.target.value)} />
            <label className="block mb-3">
              <span className="block text-xs uppercase tracking-widest text-muted mb-1">Condicion IVA</span>
              <select className="input-os" value={form.condicionIva || ''} onChange={(e) => setForm({ ...form, condicionIva: e.target.value })}>
                <option value="">Seleccionar...</option>
                <option value="Responsable Inscripto">Responsable Inscripto</option>
                <option value="Monotributo">Monotributo</option>
                <option value="Exento">Exento</option>
              </select>
            </label>
            <Input label="Inicio de actividades" type="date" value={fiscales.inicioActividades || ''} onChange={(e) => setDato('inicioActividades', e.target.value)} />
          </div>
        )}
        <div className="grid grid-cols-2 gap-3">
          <Input label="Direccion" value={fiscales.direccion || ''} onChange={(e) => setDato('direccion', e.target.value)} />
          <Input label="Localidad" value={fiscales.localidad || ''} onChange={(e) => setDato('localidad', e.target.value)} />
          <Input label="Provincia" value={fiscales.provincia || ''} onChange={(e) => setDato('provincia', e.target.value)} />
          <Input label="Telefono" value={fiscales.telefono || ''} onChange={(e) => setDato('telefono', e.target.value)} />
          <Input label="Email de contacto" value={fiscales.email || ''} onChange={(e) => setDato('email', e.target.value)} />
          <Input label="Sitio web" value={fiscales.web || ''} onChange={(e) => setDato('web', e.target.value)} />
        </div>
        <button type="button" className="btn btn-primary" onClick={guardar}>Guardar</button>
        <p className="text-xs text-muted mt-2">Estos datos se usan en los comprobantes. El logo queda pendiente de una subida de archivos dedicada.</p>
      </div>
    </div>
  );
}
