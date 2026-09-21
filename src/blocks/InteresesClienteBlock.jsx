// BookOS - InteresesClienteBlock.jsx
// ruta: bookos/frontend/src/blocks/InteresesClienteBlock.jsx
// descripcion: intereses de un cliente (doc 06 P5): tematicas cargadas con su origen, alta y baja,
//   siembra de un perfil default y la afinidad REAL medida de sus compras. Es el mismo bloque en la
//   ficha ("Ver") y en la edicion del cliente: lo que se ve es lo que se edita.

import { useEffect, useState } from 'react';
import { crmApi } from '../api/api';

export default function InteresesClienteBlock({ clienteId, onMensaje = () => {} }) {
  const [datos, setDatos] = useState(null);
  const [nueva, setNueva] = useState('');
  const [perfil, setPerfil] = useState('');
  const [cargando, setCargando] = useState(true);

  const cargar = async () => {
    if (!clienteId) return;
    setCargando(true);
    try {
      const r = await crmApi.tematicas(clienteId);
      setDatos(r && r.data ? r.data : null);
    } catch (err) {
      onMensaje(`⚠️ ${err.message}`);
    } finally {
      setCargando(false);
    }
  };

  useEffect(() => { cargar(); }, [clienteId]); // eslint-disable-line

  const agregar = async () => {
    if (!nueva.trim()) return;
    try {
      await crmApi.asignarTematicas(clienteId, { materias: [nueva.trim()] });
      setNueva('');
      await cargar();
    } catch (err) { onMensaje(`⚠️ ${err.message}`); }
  };

  const quitar = async (materiaId) => {
    try {
      await crmApi.quitarTematica(clienteId, materiaId);
      await cargar();
    } catch (err) { onMensaje(`⚠️ ${err.message}`); }
  };

  const sembrar = async () => {
    if (!perfil) return;
    try {
      await crmApi.sembrarTematicas(clienteId, [perfil]);
      setPerfil('');
      await cargar();
      onMensaje('');
    } catch (err) { onMensaje(`⚠️ ${err.message}`); }
  };

  if (!clienteId) return null;

  return (
    <div className="bloque-clientes">
      <div className="flex items-center justify-between mb-2 gap-2">
        <h4 className="font-semibold">Intereses del cliente</h4>
        <div className="flex gap-2">
          <select className="input-os" style={{ maxWidth: 220 }} value={perfil} onChange={(e) => setPerfil(e.target.value)}>
            <option value="">Sembrar perfil...</option>
            {(datos && datos.perfiles ? datos.perfiles : []).map((p) => <option key={p.clave} value={p.clave}>{p.etiqueta}</option>)}
          </select>
          <button type="button" className="btn btn-ghost text-xs" disabled={!perfil} onClick={sembrar}>Sembrar</button>
        </div>
      </div>

      {cargando && <p className="text-xs text-muted">Cargando intereses...</p>}
      {!cargando && datos && (
        <>
          <div className="lista-chips mb-2">
            {(datos.tematicas || []).map((t) => (
              <span key={t.materiaId} className="chip-tema" title={`origen: ${t.origen}${t.nota ? ` · ${t.nota}` : ''}`}>
                {t.materia}
                <button type="button" onClick={() => quitar(t.materiaId)} title="Quitar">×</button>
              </span>
            ))}
            {!(datos.tematicas || []).length && <span className="text-xs text-muted">Sin temáticas cargadas: sembrá un perfil o agregá materias a mano.</span>}
          </div>
          <div className="flex gap-2 mb-3">
            <input
              className="input-os"
              style={{ maxWidth: 300 }}
              placeholder="Agregar materia (ej. POLICIAL. POLICIALES)"
              value={nueva}
              onChange={(e) => setNueva(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') agregar(); }}
            />
            <button type="button" className="btn" onClick={agregar}>Agregar</button>
          </div>
          <p className="text-xs text-muted mb-1">
            Afinidad real (calculada de sus compras: {datos.unidades || 0} unidades, {datos.comprados || 0} títulos
            {datos.materiasDescartadas ? `; ${datos.materiasDescartadas} materias con una sola unidad no se listan` : ''}):
          </p>
          <div className="lista-chips">
            {(datos.afinidad || []).map((a) => (
              <span key={a.materia} className="chip-afinidad" title={`${a.unidades} unidades · $${Number(a.importe || 0).toLocaleString('es-AR')}`}>
                {a.materia} · {a.unidades} u{a.cuota ? ` (${Math.round(a.cuota * 100)}%)` : ''}
              </span>
            ))}
            {!(datos.afinidad || []).length && <span className="text-xs text-muted">Todavía no tiene compras registradas.</span>}
          </div>
        </>
      )}
    </div>
  );
}
