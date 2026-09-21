// BookOS - PropuestasPage.jsx
// ruta: bookos/frontend/src/pages/PropuestasPage.jsx
// descripcion: panel de Propuestas. La reflexion y el calibrador dejan aca lo que proponen
//   (marcadores, pesos, reglas) con su detalle y observacion; aprobar una propuesta la
//   aplica de verdad (marcador o version de pesos). Solo el admin aprueba o rechaza.

import { useCallback, useEffect, useState } from 'react';
import DebugTag from '../ui/DebugTag';
import { propuestasApi } from '../api/api';
import { descargarCsv } from '../utils/exportar';

const COLOR_ESTADO = { PENDIENTE: '#b45309', APROBADA: '#15803d', RECHAZADA: 'var(--muted, #6b7280)' };

// Los tipos que se aplican solos necesitan cuerpo estructurado (detalle). Sin el, aprobar no
// tiene nada que aplicar: se avisa en la fila y no se manda la llamada al servidor.
const REQUIEREN_CUERPO = ['informe', 'marcador', 'pesos'];
function cuerpoFaltante(p) {
  if (!REQUIEREN_CUERPO.includes(p.tipo)) return null;
  const d = p.detalle && typeof p.detalle === 'object' ? p.detalle : null;
  if (!d) {
    const piezas = p.tipo === 'informe' ? 'clave/titulo/definicion' : p.tipo === 'marcador' ? 'nombre/regla' : 'pesos';
    return `La propuesta no trae "detalle" (${piezas}): no hay nada que aplicar. Pedile al agente que la rehaga con proponer_cambio incluyendo el cuerpo.`;
  }
  if (p.tipo === 'informe' && !d.definicion) return 'Falta "detalle.definicion" (fuente, agruparPor y metricas): no hay nada que aplicar.';
  if (p.tipo === 'marcador' && (!d.nombre || !d.regla)) return 'Falta "detalle.nombre" o "detalle.regla": no hay nada que cristalizar.';
  if (p.tipo === 'pesos' && !(d.pesos || d.almohadilla)) return 'Falta "detalle.pesos": no hay version que crear.';
  return null;
}

export default function PropuestasPage({ esAdmin }) {
  const [filas, setFilas] = useState([]);
  const [soloPendientes, setSoloPendientes] = useState(true);
  const [expandida, setExpandida] = useState(null);
  const [aviso, setAviso] = useState('');
  const [cargando, setCargando] = useState(false);

  const cargar = useCallback(async () => {
    setCargando(true);
    try {
      const res = await propuestasApi.listar(soloPendientes);
      setFilas(res.data || []);
    } catch (err) {
      setAviso(`⚠️ ${err.message}`);
    } finally {
      setCargando(false);
    }
  }, [soloPendientes]);

  useEffect(() => { cargar(); }, [cargar]);

  const resolver = async (id, accion) => {
    setAviso('');
    try {
      const res = accion === 'aprobar' ? await propuestasApi.aprobar(id) : await propuestasApi.rechazar(id);
      const r = res.data && res.data.resultado ? res.data.resultado : res.data;
      setAviso(`Propuesta ${id} ${accion === 'aprobar' ? 'aprobada' : 'rechazada'}${r && r.aplicada === false ? ` (${r.motivo})` : r && r.marcador ? ` → ${r.marcador}` : r && r.versionNueva ? ` → version ${r.versionNueva}` : ''}`);
      await cargar();
    } catch (err) {
      setAviso(`⚠️ ${err.message}`);
    }
  };

  const exportar = () => {
    const planas = filas.map((p) => ({
      id: p.id, tipo: p.tipo, estado: p.estado, resumen: p.resumen, solicitante: p.solicitante || '',
      observacion: p.observacion || '', fecha: new Date(p.createdAt).toLocaleString('es-AR'),
    }));
    descargarCsv('propuestas', [
      { titulo: 'id', clave: 'id' }, { titulo: 'tipo', clave: 'tipo' }, { titulo: 'estado', clave: 'estado' },
      { titulo: 'resumen', clave: 'resumen' }, { titulo: 'solicitante', clave: 'solicitante' },
      { titulo: 'observacion', clave: 'observacion' }, { titulo: 'fecha', clave: 'fecha' },
    ], planas);
  };

  return (
    <div>
      <DebugTag nombre="PropuestasPage" />
      <h2 className="text-lg font-semibold mb-1">Propuestas</h2>
      <p className="text-sm text-muted mb-4">
        El kernel propone; el humano aprueba. Aprobar un <span className="font-mono">marcador</span> lo vuelve
        coste cero; aprobar <span className="font-mono">pesos</span> crea una versión nueva del ranking (con rollback).
      </p>
      {aviso && <p className="text-sm mb-3">{aviso}</p>}

      <div className="flex items-center gap-3 mb-3">
        <label className="text-sm flex items-center gap-1">
          <input type="checkbox" checked={soloPendientes} onChange={(e) => setSoloPendientes(e.target.checked)} />
          Solo pendientes
        </label>
        <button type="button" className="btn text-sm" onClick={cargar} disabled={cargando}>Refrescar</button>
        {filas.length > 0 && <button type="button" className="btn text-sm" onClick={exportar}>⬇ Descargar</button>}
      </div>

      {filas.length === 0 && !cargando && <p className="text-sm text-muted">No hay propuestas{soloPendientes ? ' pendientes' : ''}.</p>}
      <div className="space-y-2">
        {filas.map((p) => {
          const falta = cuerpoFaltante(p);
          return (
          <div key={p.id} className="card p-3">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="agente-badge">{p.tipo}</span>
              <span className="text-sm font-medium flex-1">{p.resumen}</span>
              <span className="text-xs font-mono" style={{ color: COLOR_ESTADO[p.estado] || 'inherit' }}>{p.estado}</span>
            </div>
            <div className="text-xs text-muted mt-1">
              #{p.id} · {p.solicitante || '—'} · {new Date(p.createdAt).toLocaleString('es-AR')}
              {p.observacion && <span> · observación: “{p.observacion}”</span>}
            </div>
            <div className="flex items-center gap-2 mt-2">
              <button type="button" className="btn btn-ghost text-xs" onClick={() => setExpandida(expandida === p.id ? null : p.id)}>
                {expandida === p.id ? 'Ocultar detalle' : 'Ver detalle'}
              </button>
              {esAdmin && p.estado === 'PENDIENTE' && (
                <>
                  <button
                    type="button"
                    className="btn btn-primary text-xs"
                    onClick={() => resolver(p.id, 'aprobar')}
                    disabled={Boolean(falta)}
                    title={falta || 'Aplicar la propuesta'}
                  >
                    Aprobar
                  </button>
                  <button type="button" className="btn text-xs" onClick={() => resolver(p.id, 'rechazar')}>Rechazar</button>
                </>
              )}
            </div>
            {expandida === p.id && (
              <div className="mt-2 space-y-2">
                {p.detalle == null ? (
                  <p className="text-xs text-muted">Esta propuesta no tiene cuerpo estructurado: quedo descripta solo en el resumen y la observación.</p>
                ) : (
                  <pre className="text-xs overflow-x-auto" style={{ maxHeight: 260 }}>{JSON.stringify(p.detalle, null, 2)}</pre>
                )}
                {falta && <p className="text-xs" style={{ color: '#b45309' }}>⚠️ {falta}</p>}
                {p.resultado != null && (
                  <div className="text-xs">
                    <span className="text-muted">resultado: </span>
                    <span className="font-mono">{JSON.stringify(p.resultado).slice(0, 400)}</span>
                  </div>
                )}
              </div>
            )}
          </div>
          );
        })}
      </div>
    </div>
  );
}
