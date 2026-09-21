// BookOS - PerfilesPage.jsx
// ruta: bookos/frontend/src/pages/PerfilesPage.jsx
// descripcion: "Ver perfiles" del Kernel (plan-rediseno/11, E7). Un perfil de usuario por fila con
//   su informacion empatica reunida para ANALISIS RAPIDO: como viene el trato (score contra su
//   target y su tendencia), consentimiento y pausa, cuantos intercambios evaluados tiene, que
//   senales se repiten, el animo, los votos humanos y el APRENDIZAJE que hoy entra al prompt. Al
//   abrir una fila se ve el detalle (las ultimas evaluaciones con la razon del score y la historia
//   de lo que conto el operario) y las acciones de privacidad: pausar, revocar, exportar y dar de
//   baja. El score es informacion INTERNA: vive aca, no en la conversacion con el operario.

import { useEffect, useState } from 'react';
import DebugTag from '../ui/DebugTag';
import { agenteApi } from '../api/api';
import { descargarCsv } from '../utils/exportar';

const colorTrato = (score, target) => (score == null ? 'var(--muted)' : Number(score) < Number(target) ? '#b45309' : '#15803d');
const fecha = (f) => (f ? new Date(f).toLocaleString('es-AR') : '-');
const dias = (n) => (n == null ? '-' : n === 0 ? 'hoy' : `hace ${n} d`);

// Barra simple del trato: el numero solo no dice nada, el contexto (target) si.
function Trato({ score, target, reciente }) {
  if (score == null) return <span className="text-xs text-muted">sin datos</span>;
  return (
    <div className="flex items-center gap-2">
      <span className="font-mono text-sm" style={{ color: colorTrato(score, target) }}>{score}/5</span>
      <span className="text-xs text-muted">target {target}{reciente != null && reciente !== score ? ` · últimas ${reciente}` : ''}</span>
    </div>
  );
}

export default function PerfilesPage({ esAdmin }) {
  const [perfiles, setPerfiles] = useState([]);
  const [abierto, setAbierto] = useState(null);
  const [detalle, setDetalle] = useState(null);
  const [mensaje, setMensaje] = useState('');
  const [cargando, setCargando] = useState(false);

  const cargar = async () => {
    try {
      const res = await agenteApi.operarios();
      setPerfiles(res.data || []);
    } catch (err) {
      setMensaje(`⚠️ ${err.message}`);
    }
  };

  useEffect(() => { cargar(); }, []); // eslint-disable-line

  const abrir = async (usuarioId) => {
    if (abierto === usuarioId) {
      setAbierto(null);
      setDetalle(null);
      return;
    }
    setAbierto(usuarioId);
    setDetalle(null);
    try {
      const res = await agenteApi.operarioDetalle(usuarioId, { evaluaciones: 12 });
      setDetalle(res.data || null);
    } catch (err) {
      setMensaje(`⚠️ ${err.message}`);
    }
  };

  const accion = async (usuarioId, nombre) => {
    try {
      await agenteApi.operarioAccion(nombre, usuarioId);
      setMensaje(`Listo: ${nombre}`);
      await cargar();
      if (abierto === usuarioId) {
        const res = await agenteApi.operarioDetalle(usuarioId, { evaluaciones: 12 });
        setDetalle(res.data || null);
      }
    } catch (err) {
      setMensaje(`⚠️ ${err.message}`);
    }
  };

  const exportarJson = async (usuarioId, nombre) => {
    try {
      const res = await agenteApi.operarioExport(usuarioId);
      const blob = new Blob([JSON.stringify(res.data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `operario-${usuarioId}-${String(nombre).replace(/\s+/g, '_')}.json`;
      a.click();
      URL.revokeObjectURL(url);
      setMensaje('Export listo (JSON)');
    } catch (err) {
      setMensaje(`⚠️ ${err.message}`);
    }
  };

  const exportarCsv = async (usuarioId, nombre) => {
    try {
      const res = await agenteApi.operarioExport(usuarioId);
      // `descargarCsv` recibe columnas { titulo, clave } y filas planas: se aplana aca (si no, el
      // CSV sale con los encabezados y las celdas vacias).
      const crudas = (((res.data || {}).perfil || {}).evaluaciones) || [];
      const filas = crudas.map((e) => ({
        fecha: fecha(e.fecha),
        tipoPedido: e.tipoPedido || '',
        score: e.scoreEmpatia == null ? '' : e.scoreEmpatia,
        escala: e.scoreHumano == null ? '' : e.scoreHumano,
        pulgar: e.feedbackHumano === 1 ? 'arriba' : e.feedbackHumano === -1 ? 'abajo' : '',
        senal: e.feedbackImplicito || '',
        animo: e.animoInferido || '',
        evaluadoPor: e.evaluadoPor || '',
        razon: e.razon || '',
        problemas: e.problemas || '',
        mejora: e.mejoraPropuesta || '',
        aprendizaje: e.sugerenciaTrato || '',
        resumen: e.resumen || '',
      }));
      descargarCsv(`operario-${usuarioId}-${String(nombre).replace(/\s+/g, '_')}`, [
        { titulo: 'fecha', clave: 'fecha' },
        { titulo: 'tipo de pedido', clave: 'tipoPedido' },
        { titulo: 'score', clave: 'score' },
        { titulo: 'escala del operario', clave: 'escala' },
        { titulo: 'pulgar', clave: 'pulgar' },
        { titulo: 'senal', clave: 'senal' },
        { titulo: 'animo', clave: 'animo' },
        { titulo: 'evaluado por', clave: 'evaluadoPor' },
        { titulo: 'razon del score', clave: 'razon' },
        { titulo: 'problemas', clave: 'problemas' },
        { titulo: 'mejora propuesta', clave: 'mejora' },
        { titulo: 'aprendizaje', clave: 'aprendizaje' },
        { titulo: 'resumen (retencion)', clave: 'resumen' },
      ], filas);
      setMensaje(`Export listo (CSV, ${filas.length} evaluaciones)`);
    } catch (err) {
      setMensaje(`⚠️ ${err.message}`);
    }
  };

  const borrar = async (usuarioId, nombre) => {
    if (!window.confirm(`¿Dar de baja a ${nombre}? La historia queda (softdelete), se borra su memoria y sus conversaciones quedan sin dueño.`)) return;
    try {
      const res = await agenteApi.operarioBorrar(usuarioId);
      const d = res.data || {};
      setMensaje(`Dado de baja: ${d.evaluacionesDadasDeBaja} evaluaciones sin vigencia, ${d.observacionesBorradas} observaciones y ${d.conversacionesDesvinculadas} conversaciones desvinculadas.`);
      setAbierto(null);
      setDetalle(null);
      await cargar();
    } catch (err) {
      setMensaje(`⚠️ ${err.message}`);
    }
  };

  const correrRetencion = async () => {
    setCargando(true);
    try {
      const res = await agenteApi.operarioRetencion({});
      const d = res.data || {};
      setMensaje(`Retención: ${d.resumidas || 0} resumidas, ${d.pendientes || 0} pendientes de ${d.candidatas || 0} candidatas (mayores a ${d.dias} días).`);
    } catch (err) {
      setMensaje(`⚠️ ${err.message}`);
    } finally {
      setCargando(false);
    }
  };

  return (
    <div>
      <DebugTag nombre="PerfilesPage" />
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold">Perfiles del operario</h2>
        {esAdmin && (
          <button type="button" className="btn text-xs" disabled={cargando} onClick={correrRetencion} title="Reemplaza la prosa vieja por un resumen del LLM (las filas no se borran)">
            {cargando ? 'Corriendo…' : 'Correr retención'}
          </button>
        )}
      </div>
      {mensaje && <p className="text-sm mb-3">{mensaje}</p>}

      <div className="card p-4 mb-4 text-xs text-muted">
        Cómo viene el <strong>trato</strong> con cada persona que opera el sistema: el score (interno) contra su target,
        la tendencia, el consentimiento y el aprendizaje que hoy entra al prompt. Abrí una fila para ver las
        evaluaciones con la razón del score y lo que el operario contó.
      </div>

      <div className="card p-4">
        {perfiles.length === 0 && <div className="text-sm text-muted">Todavía no hay perfiles con trato registrado.</div>}
        {perfiles.map((p) => (
          <div key={p.usuarioId} className="py-2" style={{ borderBottom: '1px solid var(--border)' }}>
            <div className="flex items-center gap-3 flex-wrap cursor-pointer" onClick={() => abrir(p.usuarioId)}>
              <span className="text-xs text-muted" style={{ width: 12 }}>{abierto === p.usuarioId ? '▾' : '▸'}</span>
              <span className="text-sm font-medium" style={{ minWidth: 150 }}>{p.nombre}{p.rol === 'admin' ? ' · admin' : ''}</span>
              <span className="text-xs text-muted" style={{ minWidth: 90 }}>{p.rol}</span>
              <div style={{ minWidth: 170 }}><Trato score={p.scorePromedio} target={p.target} reciente={p.scoreReciente} /></div>
              <span className="text-xs" style={{ minWidth: 80 }}>{p.tendencia === 'mejora' ? '↗ mejora' : p.tendencia === 'empeora' ? '↘ empeora' : p.tendencia === 'estable' ? '→ estable' : '-'}</span>
              <span className="text-xs text-muted" style={{ minWidth: 120 }}>
                {p.consentimiento === 'revocado' ? 'revocado' : p.pausado ? `pausado hasta ${new Date(p.pausaHasta).toLocaleDateString('es-AR')}` : 'consentimiento activo'}
              </span>
              <span className="text-xs text-muted" style={{ minWidth: 110 }}>{p.evaluaciones} eval. · {dias(p.diasSinEvaluar)}</span>
              {p.aprendizajeVigente && <span className="agente-badge" title="Es lo que hoy entra al prompt">aprendizaje</span>}
            </div>

            {abierto === p.usuarioId && detalle && (
              <div className="mt-3 ml-6 text-sm">
                <div className="flex flex-wrap gap-2 mb-3">
                  <button type="button" className="btn text-xs" onClick={() => accion(p.usuarioId, p.pausado ? 'reanudar' : 'pausar')}>
                    {p.pausado ? 'Reanudar evaluación' : 'Pausar 8 h'}
                  </button>
                  <button type="button" className="btn text-xs" onClick={() => accion(p.usuarioId, p.consentimiento === 'revocado' ? 'aceptar' : 'revocar')}>
                    {p.consentimiento === 'revocado' ? 'Reactivar consentimiento' : 'Revocar consentimiento'}
                  </button>
                  <button type="button" className="btn text-xs" onClick={() => exportarJson(p.usuarioId, p.nombre)}>Exportar JSON</button>
                  <button type="button" className="btn text-xs" onClick={() => exportarCsv(p.usuarioId, p.nombre)}>Exportar CSV</button>
                  {p.borrable && (
                    <button type="button" className="btn text-xs" onClick={() => borrar(p.usuarioId, p.nombre)}>Dar de baja</button>
                  )}
                  {!p.borrable && <span className="text-xs text-muted">la ficha del admin no se borra (puede pausar)</span>}
                </div>

                {p.aprendizajeVigente && (
                  <div className="mb-3 p-2 rounded-[8px]" style={{ background: 'var(--bg-soft)' }}>
                    <div className="text-xs text-muted mb-1">Aprendizaje que hoy entra al prompt (se consume en pocos turnos)</div>
                    <div className="text-sm">{p.aprendizajeVigente}</div>
                  </div>
                )}

                <div className="text-xs text-muted mb-1">Últimas evaluaciones</div>
                <div className="mb-3">
                  {(detalle.evaluaciones || []).map((e) => (
                    <div key={e.id} className="py-1 text-xs" style={{ borderBottom: '1px solid var(--border)', opacity: e.vigente === false ? 0.55 : 1 }}>
                      <span className="font-mono">{fecha(e.fecha).slice(0, 16)}</span>
                      {' · '}<span className="font-mono" style={{ color: colorTrato(e.scoreEmpatia, p.target) }}>{e.scoreEmpatia ?? '-'}/5</span>
                      {e.scoreHumano != null && <span className="text-muted"> (operario: {e.scoreHumano})</span>}
                      {e.feedbackHumano === 1 && ' 👍'}
                      {e.feedbackHumano === -1 && ' 👎'}
                      {' · '}{e.tipoPedido}
                      {e.feedbackImplicito ? ` · ${e.feedbackImplicito}` : ''}
                      {e.animoInferido ? ` · ánimo ${e.animoInferido}` : ''}
                      {e.evaluadoPor ? ` · ${e.evaluadoPor}` : ''}
                      {e.vigente === false ? ' · dado de baja' : ''}
                      {e.razon && <div className="text-muted">razón: {e.razon}</div>}
                      {e.problemas && <div className="text-muted">problema: {e.problemas}</div>}
                      {e.mejoraPropuesta && <div className="text-muted">mejora: {e.mejoraPropuesta}</div>}
                      {e.resumen && <div className="text-muted">resumen (retención): {e.resumen}</div>}
                    </div>
                  ))}
                  {(detalle.evaluaciones || []).length === 0 && <div className="text-xs text-muted">Sin evaluaciones todavía.</div>}
                </div>

                <div className="text-xs text-muted mb-1">Lo que contó y cómo se lo observó</div>
                {(detalle.historial || []).map((o) => (
                  <div key={o.id} className="text-xs py-1" style={{ borderBottom: '1px solid var(--border)', opacity: o.vigente ? 1 : 0.55 }}>
                    <span className="font-mono">{fecha(o.fecha).slice(0, 10)}</span> · {o.origen}{o.vigente ? '' : ' · historia'} · {o.texto}
                  </div>
                ))}
                {(detalle.historial || []).length === 0 && (
                  <div className="text-xs text-muted">Sin observaciones todavía (las arma el ciclo del kernel).</div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
