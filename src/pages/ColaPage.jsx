// BookOS - ColaPage.jsx
// ruta: bookos/frontend/src/pages/ColaPage.jsx
// descripcion: panel de Cola del enriquecimiento (E4/E7): estados de la cola, pendientes por
//   prioridad, cobertura del stock activo, breakers de las fuentes externas y presupuesto
//   LLM del dia. Descarga del estado en CSV.

import { useCallback, useEffect, useState } from 'react';
import DebugTag from '../ui/DebugTag';
import { kernelApi } from '../api/api';
import { descargarCsv } from '../utils/exportar';

const money = (n) => Number(n || 0).toLocaleString('es-AR');

export default function ColaPage() {
  const [cola, setCola] = useState(null);
  const [aviso, setAviso] = useState('');
  const [cargando, setCargando] = useState(false);

  const cargar = useCallback(async () => {
    setCargando(true);
    setAviso('');
    try {
      const res = await kernelApi.cola();
      setCola(res.data);
    } catch (err) {
      setAviso(`⚠️ ${err.message}`);
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => { cargar(); }, [cargar]);

  const exportar = () => {
    if (!cola) return;
    const filas = Object.entries(cola.porEstado || {}).map(([estado, n]) => ({ estado, cantidad: n }));
    descargarCsv('cola_enriquecimiento', [{ titulo: 'estado', clave: 'estado' }, { titulo: 'cantidad', clave: 'cantidad' }], filas);
  };

  return (
    <div>
      <DebugTag nombre="ColaPage" />
      <h2 className="text-lg font-semibold mb-1">Cola de enriquecimiento</h2>
      <p className="text-sm text-muted mb-4">
        Estado del pipeline que viste a los artículos con digestos y vectores. Corre por tandas
        (<span className="font-mono">npm run enriquecer</span>); acá se ve la foto y los frenos.
      </p>
      {aviso && <p className="text-sm mb-3">{aviso}</p>}

      <div className="flex gap-2 mb-4">
        <button type="button" className="btn text-sm" onClick={cargar} disabled={cargando}>Refrescar</button>
        {cola && <button type="button" className="btn text-sm" onClick={exportar}>⬇ Descargar estados</button>}
      </div>

      {!cola && cargando && <p className="text-sm text-muted">Cargando…</p>}
      {cola && (
        <>
          <div className="grid gap-3 mb-4" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))' }}>
            <div className="card p-3">
              <div className="text-sm font-medium mb-2">Estados</div>
              {Object.entries(cola.porEstado || {}).map(([estado, n]) => (
                <div key={estado} className="flex justify-between text-xs py-0.5">
                  <span className="text-muted">{estado}</span><span className="font-mono">{money(n)}</span>
                </div>
              ))}
            </div>
            <div className="card p-3">
              <div className="text-sm font-medium mb-2">Pendientes por prioridad</div>
              {(cola.pendientesPorPrioridad || []).map((p) => (
                <div key={p.prioridad} className="flex justify-between text-xs py-0.5">
                  <span className="text-muted">P{p.prioridad}</span><span className="font-mono">{money(p.total)}</span>
                </div>
              ))}
              {(cola.pendientesPorPrioridad || []).length === 0 && <span className="text-xs text-muted">sin pendientes</span>}
            </div>
            <div className="card p-3">
              <div className="text-sm font-medium mb-2">Cobertura del stock activo</div>
              <div className="text-xs space-y-0.5">
                {cola.cobertura && Object.entries(cola.cobertura).map(([k, v]) => (
                  <div key={k} className="flex justify-between">
                    <span className="text-muted">{k}</span>
                    <span className="font-mono">{typeof v === 'number' ? `${money(v)}${String(k).includes('porcentaje') || String(k).includes('pct') ? '%' : ''}` : String(v)}</span>
                  </div>
                ))}
                {!cola.cobertura && <span className="text-muted">sin datos</span>}
              </div>
            </div>
            <div className="card p-3">
              <div className="text-sm font-medium mb-2">Presupuesto LLM del día</div>
              {cola.llm ? Object.entries(cola.llm).map(([k, v]) => (
                <div key={k} className="flex justify-between text-xs py-0.5">
                  <span className="text-muted">{k}</span><span className="font-mono">{typeof v === 'object' ? JSON.stringify(v) : String(v)}</span>
                </div>
              )) : <span className="text-xs text-muted">sin datos</span>}
              <div className="flex justify-between text-xs py-0.5">
                <span className="text-muted">reintentos programados</span><span className="font-mono">{money(cola.reintentosProgramados)}</span>
              </div>
            </div>
          </div>

          {cola.breakers && Object.keys(cola.breakers).length > 0 && (
            <div className="card p-3">
              <div className="text-sm font-medium mb-2">Fuentes externas (breakers)</div>
              {Object.entries(cola.breakers).map(([fuente, estado]) => (
                <div key={fuente} className="flex justify-between text-xs py-0.5">
                  <span className="text-muted">{fuente}</span>
                  <span className="font-mono">{typeof estado === 'object' ? JSON.stringify(estado) : String(estado)}</span>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
