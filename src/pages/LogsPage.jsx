// BookOS - LogsPage.jsx
// ruta: bookos/frontend/src/pages/LogsPage.jsx
// descripcion: panel de Logs. Tres vistas ordenadas (mas nuevo primero): actividad del LLM y
//   del agente (llm_audit_log), pipeline de enriquecimiento (enriquecimiento_intento) y la
//   AUDITORIA DEL RANKING (las ultimas busquedas del kernel, que antes vivian en Sistema > Config).
//   Filtros por modulo/ruta/proveedor/etapa y descarga CSV.

import { useCallback, useEffect, useState } from 'react';
import DebugTag from '../ui/DebugTag';
import Modal from '../ui/Modal';
import Paginador from '../ui/Paginador';
import { kernelApi, auditoriaApi } from '../api/api';
import { descargarCsv, descargarDesdeServidor } from '../utils/exportar';

// Cada dato en su linea: es todo lo que hace falta ver de un log.
function camposDe(f, vista) {
  const fecha = f.fecha ? new Date(f.fecha).toLocaleString('es-AR') : '—';
  if (vista === 'enriquecimiento') {
    return [
      ['fecha', fecha], ['id', f.id], ['articuloId', f.articuloId], ['etapa', f.etapa],
      ['ok', f.ok ? 'si' : 'no'], ['fuente', f.fuente || '—'], ['proveedor', f.proveedor || '—'],
      ['modelo', f.modelo || '—'], ['ms', f.ms], ['error', f.error || '—'],
    ];
  }
  const campos = [
    ['fecha', fecha], ['id', f.id], ['modulo', f.modulo], ['perfil', f.perfil || '—'], ['accion', f.accion], ['ruta', f.ruta || '—'],
    ['turno', f.turno || '—'], ['proveedor', f.proveedor || '—'], ['modelo', f.modelo || '—'],
    ['ms', f.ms], ['tokens', f.tokens || 0], ['outcome', f.outcome || '—'], ['usuarioId', f.usuarioId == null ? '—' : f.usuarioId],
  ];
  if (f.prompt) campos.push(['prompt', String(f.prompt)]);
  if (f.output) campos.push(['salida', String(f.output)]);
  if (f.tools) {
    let tools = f.tools;
    try { tools = JSON.stringify(JSON.parse(f.tools), null, 2); } catch (_) { tools = String(f.tools); }
    campos.push(['herramientas', tools]);
  }
  return campos;
}

export default function LogsPage() {
  const [vista, setVista] = useState('actividad');
  const [filas, setFilas] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [filtros, setFiltros] = useState({ modulo: '', ruta: '', proveedor: '', perfil: '', q: '' });
  const [etapa, setEtapa] = useState('');
  const [soloOk, setSoloOk] = useState('');
  const [aviso, setAviso] = useState('');
  const [cargando, setCargando] = useState(false);
  const [detalle, setDetalle] = useState(null);
  const [cargandoDetalle, setCargandoDetalle] = useState(false);

  // El detalle se ve en modal: actividad lo trae completo del servidor; enriquecimiento
  // ya viene con todos los campos en la lista.
  const verDetalle = async (f) => {
    if (vista === 'enriquecimiento') { setDetalle(f); return; }
    setCargandoDetalle(true);
    try {
      const res = await kernelApi.registroDetalle(f.id);
      const payload = res && res.data !== undefined && !Array.isArray(res) ? res.data : res;
      setDetalle(payload && payload.id ? payload : f);
    } catch (err) {
      setAviso(`⚠️ ${err.message}`);
      setDetalle(f);
    } finally {
      setCargandoDetalle(false);
    }
  };

  const cargar = useCallback(async () => {
    setCargando(true);
    setAviso('');
    try {
      if (vista === 'actividad') {
        const params = { limit: 50, page };
        for (const [k, v] of Object.entries(filtros)) if (v) params[k] = v;
        const res = await kernelApi.registro(params);
        setFilas(res.data.filas || []);
        setTotal(res.data.total || 0);
      } else if (vista === 'ranking') {
        // Auditoria del ranking: las ultimas busquedas con su intencion, outcome y latencia.
        const res = await auditoriaApi.ranking(50);
        setFilas(res.data || []);
        setTotal((res.data || []).length);
      } else {
        const params = { limit: 150 };
        if (etapa) params.etapa = etapa;
        if (soloOk) params.ok = soloOk;
        const res = await kernelApi.logs(params);
        setFilas(res.data.ultimos || []);
        setTotal((res.data.ultimos || []).length);
      }
    } catch (err) {
      setAviso(`⚠️ ${err.message}`);
    } finally {
      setCargando(false);
    }
  }, [vista, filtros, etapa, soloOk, page]);

  useEffect(() => { cargar(); }, [cargar]);

  // Cambiar de vista o de filtros vuelve a la primera pagina.
  useEffect(() => { setPage(1); }, [vista, filtros, etapa, soloOk]); // eslint-disable-line

  const descargarActividad = () => {
    const params = new URLSearchParams({ limit: '500', descargar: 'true' });
    for (const [k, v] of Object.entries(filtros)) if (v) params.set(k, v);
    descargarDesdeServidor(`/kernel/registro?${params.toString()}`, 'registro_llm.csv').catch(() => setAviso('⚠️ No se pudo descargar'));
  };

  const descargarEnriquecimiento = () => {
    const filasPlanas = filas.map((f) => ({
      id: f.id, fecha: new Date(f.fecha).toLocaleString('es-AR'), articuloId: f.articuloId,
      etapa: f.etapa, ok: f.ok ? 'si' : 'no', fuente: f.fuente || '', proveedor: f.proveedor || '',
      modelo: f.modelo || '', ms: f.ms, error: f.error || '',
    }));
    descargarCsv('enriquecimiento', [
      { titulo: 'id', clave: 'id' }, { titulo: 'fecha', clave: 'fecha' }, { titulo: 'articuloId', clave: 'articuloId' },
      { titulo: 'etapa', clave: 'etapa' }, { titulo: 'ok', clave: 'ok' }, { titulo: 'fuente', clave: 'fuente' },
      { titulo: 'proveedor', clave: 'proveedor' }, { titulo: 'modelo', clave: 'modelo' }, { titulo: 'ms', clave: 'ms' },
      { titulo: 'error', clave: 'error' },
    ], filasPlanas);
  };

  return (
    <div>
      <DebugTag nombre="LogsPage" />
      <h2 className="text-lg font-semibold mb-1">Logs</h2>
      <p className="text-sm text-muted mb-4">Todo lo que hizo el sistema, ordenado y filtrable: actividad del LLM/agente y pipeline de enriquecimiento.</p>
      {aviso && <p className="text-sm mb-3">{aviso}</p>}

      <div className="flex items-center gap-2 mb-3 flex-wrap">
        <button type="button" className={`btn text-sm ${vista === 'actividad' ? 'btn-primary' : ''}`} onClick={() => setVista('actividad')}>Actividad (LLM/agente)</button>
        <button type="button" className={`btn text-sm ${vista === 'enriquecimiento' ? 'btn-primary' : ''}`} onClick={() => setVista('enriquecimiento')}>Enriquecimiento</button>
        <button type="button" className={`btn text-sm ${vista === 'ranking' ? 'btn-primary' : ''}`} onClick={() => setVista('ranking')}>Ranking (auditoría)</button>
        <button type="button" className="btn btn-ghost text-sm" onClick={cargar} disabled={cargando}>Refrescar</button>
        {vista === 'actividad'
          ? <button type="button" className="btn btn-ghost text-sm" onClick={descargarActividad}>⬇ Descargar (servidor)</button>
          : vista === 'enriquecimiento' && filas.length > 0 && <button type="button" className="btn btn-ghost text-sm" onClick={descargarEnriquecimiento}>⬇ Descargar</button>}
      </div>

      {vista === 'actividad' && (
        <div className="flex items-center gap-2 mb-3 flex-wrap">
          <input className="input-os" style={{ maxWidth: 160 }} placeholder="módulo" value={filtros.modulo} onChange={(e) => setFiltros({ ...filtros, modulo: e.target.value })} />
          <input className="input-os" style={{ maxWidth: 160 }} placeholder="ruta" value={filtros.ruta} onChange={(e) => setFiltros({ ...filtros, ruta: e.target.value })} />
          <input className="input-os" style={{ maxWidth: 160 }} placeholder="proveedor" value={filtros.proveedor} onChange={(e) => setFiltros({ ...filtros, proveedor: e.target.value })} />
          <select className="input-os" style={{ maxWidth: 160 }} value={filtros.perfil} onChange={(e) => setFiltros({ ...filtros, perfil: e.target.value })} title="Qué ventana habló">
            <option value="">perfil: todos</option>
            <option value="secretario">Secretario</option>
            <option value="ventas">Vendedor</option>
          </select>
          <input className="input-os" style={{ maxWidth: 220 }} placeholder="acción (contiene)" value={filtros.q} onChange={(e) => setFiltros({ ...filtros, q: e.target.value })} />
          <span className="text-xs text-muted">{total} filas</span>
        </div>
      )}
      {vista === 'enriquecimiento' && (
        <div className="flex items-center gap-2 mb-3 flex-wrap">
          <input className="input-os" style={{ maxWidth: 160 }} placeholder="etapa (E2…E7)" value={etapa} onChange={(e) => setEtapa(e.target.value)} />
          <select className="input-os" style={{ maxWidth: 160 }} value={soloOk} onChange={(e) => setSoloOk(e.target.value)}>
            <option value="">ok: todos</option>
            <option value="true">solo ok</option>
            <option value="false">solo errores</option>
          </select>
        </div>
      )}

      <div className="card p-3 overflow-x-auto">
        <table className="w-full text-xs" style={{ borderCollapse: 'collapse' }}>
          <thead>
            <tr className="text-left text-muted">
              {vista === 'actividad' ? (
                <>
                  <th className="py-1 pr-3">fecha</th><th className="py-1 pr-3">perfil</th><th className="py-1 pr-3">módulo</th><th className="py-1 pr-3">acción</th>
                  <th className="py-1 pr-3">ruta</th><th className="py-1 pr-3">proveedor</th><th className="py-1 pr-3">modelo</th>
                  <th className="py-1 pr-3">ms</th><th className="py-1 pr-3">tokens</th><th className="py-1">outcome</th>
                </>
              ) : vista === 'ranking' ? (
                <>
                  <th className="py-1 pr-3">fecha</th><th className="py-1 pr-3">intención</th><th className="py-1 pr-3">consulta</th>
                  <th className="py-1 pr-3">outcome</th><th className="py-1">ms</th>
                </>
              ) : (
                <>
                  <th className="py-1 pr-3">fecha</th><th className="py-1 pr-3">artículo</th><th className="py-1 pr-3">etapa</th>
                  <th className="py-1 pr-3">ok</th><th className="py-1 pr-3">fuente</th><th className="py-1 pr-3">proveedor</th>
                  <th className="py-1 pr-3">ms</th><th className="py-1">error</th>
                </>
              )}
            </tr>
          </thead>
          <tbody>
            {filas.map((f) => (
              <tr
                key={f.id}
                style={{ borderTop: '1px solid var(--border)', cursor: vista === 'ranking' ? 'default' : 'pointer' }}
                title={vista === 'ranking' ? '' : 'Ver detalle del log'}
                onClick={() => { if (vista !== 'ranking') verDetalle(f); }}
              >
                {vista === 'actividad' ? (
                  <>
                    <td className="py-1 pr-3 font-mono">{new Date(f.fecha).toLocaleString('es-AR')}</td>
                    <td className="py-1 pr-3">{f.perfil === 'ventas' ? 'Vendedor' : f.perfil === 'secretario' ? 'Secretario' : '—'}</td>
                    <td className="py-1 pr-3">{f.modulo}</td>
                    <td className="py-1 pr-3">{f.accion}</td>
                    <td className="py-1 pr-3">{f.ruta || '—'}</td>
                    <td className="py-1 pr-3">{f.proveedor || '—'}</td>
                    <td className="py-1 pr-3">{f.modelo || '—'}</td>
                    <td className="py-1 pr-3 font-mono">{f.ms}</td>
                    <td className="py-1 pr-3 font-mono">{f.tokens || 0}</td>
                    <td className="py-1">{f.outcome || '—'}</td>
                  </>
                ) : vista === 'ranking' ? (
                  <>
                    <td className="py-1 pr-3 font-mono">{f.fecha ? new Date(f.fecha).toLocaleString('es-AR') : '—'}</td>
                    <td className="py-1 pr-3">{f.intencion}</td>
                    <td className="py-1 pr-3">{f.consulta}</td>
                    <td className="py-1 pr-3">{f.outcome || 'SIN_SENAL'}</td>
                    <td className="py-1 font-mono">{f.ms}</td>
                  </>
                ) : (
                  <>
                    <td className="py-1 pr-3 font-mono">{new Date(f.fecha).toLocaleString('es-AR')}</td>
                    <td className="py-1 pr-3 font-mono">{f.articuloId}</td>
                    <td className="py-1 pr-3">{f.etapa}</td>
                    <td className="py-1 pr-3" style={{ color: f.ok ? '#15803d' : 'var(--danger)' }}>{f.ok ? 'sí' : 'no'}</td>
                    <td className="py-1 pr-3">{f.fuente || '—'}</td>
                    <td className="py-1 pr-3">{f.proveedor || '—'}</td>
                    <td className="py-1 pr-3 font-mono">{f.ms}</td>
                    <td className="py-1" title={f.error || ''}>{(f.error || '').slice(0, 70)}</td>
                  </>
                )}
              </tr>
            ))}
            {filas.length === 0 && !cargando && (
              <tr><td className="py-2 text-muted" colSpan={9}>Sin filas con esos filtros.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {vista === 'actividad' && (
        <Paginador page={page} total={total} limite={50} onCambiar={setPage} etiqueta="logs" />
      )}

      <Modal
        abierto={Boolean(detalle)}
        onClose={() => setDetalle(null)}
        titulo={detalle ? `${vista === 'actividad' ? 'Actividad' : vista === 'enriquecimiento' ? 'Enriquecimiento' : 'Ranking'} · log #${detalle.id}` : ''}
        ancho="760px"
      >
        {cargandoDetalle && <p className="text-sm text-muted">Trayendo el detalle...</p>}
        {detalle && !cargandoDetalle && (
          <div className="space-y-2">
            {camposDe(detalle, vista).map(([etiqueta, valor]) => (
              <div key={etiqueta} className="text-sm">
                <span className="text-xs uppercase tracking-widest text-muted block">{etiqueta}</span>
                {typeof valor === 'string' && valor.length > 110 ? (
                  <pre className="text-xs card p-2 mt-1" style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', maxHeight: 240, overflowY: 'auto' }}>{valor}</pre>
                ) : (
                  <span>{String(valor == null ? '—' : valor)}</span>
                )}
              </div>
            ))}
          </div>
        )}
      </Modal>
    </div>
  );
}
