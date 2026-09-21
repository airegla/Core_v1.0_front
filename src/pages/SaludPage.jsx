// BookOS - SaludPage.jsx
// ruta: bookos/frontend/src/pages/SaludPage.jsx
// descripcion: panel de Salud del kernel (doc 01 §8). Muestra el ultimo reporte de la
//   auditoria diaria (checks con nivel y detalle) y la tendencia de las corridas; el
//   admin puede disparar una corrida y descargar la serie.

import { useCallback, useEffect, useState } from 'react';
import DebugTag from '../ui/DebugTag';
import CardSistema from '../ui/CardSistema';
import { kernelApi } from '../api/api';
import { descargarCsv } from '../utils/exportar';

const colorNivel = (nivel) => (nivel === 'alerta' ? 'var(--danger)' : nivel === 'atencion' ? '#b45309' : '#15803d');

export default function SaludPage({ esAdmin }) {
  const [data, setData] = useState({ ultimo: null, ultimos: [] });
  const [comparativa, setComparativa] = useState(null);
  const [diasLlm, setDiasLlm] = useState(7);
  const [cargando, setCargando] = useState(true);
  const [aviso, setAviso] = useState('');
  const [corriendo, setCorriendo] = useState(false);

  const cargarComparativa = useCallback(async (d) => {
    try {
      const res = await kernelApi.llmComparativa(d);
      setComparativa(res.data || null);
    } catch (_) {
      // Sin comparativa el panel de Salud sigue siendo util: no se rompe la pantalla por esto.
      setComparativa(null);
    }
  }, []);

  useEffect(() => { cargarComparativa(diasLlm); }, [cargarComparativa, diasLlm]);

  const cargar = useCallback(async () => {
    setCargando(true);
    try {
      const res = await kernelApi.salud(30);
      setData(res.data || { ultimo: null, ultimos: [] });
    } catch (err) {
      setAviso(`⚠️ ${err.message}`);
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => { cargar(); }, [cargar]);

  const correr = async () => {
    setCorriendo(true);
    setAviso('Corriendo auditoría…');
    try {
      const res = await kernelApi.saludCorrer();
      setAviso(`Reporte generado: ${JSON.stringify(res.data.resumen)}`);
      await cargar();
    } catch (err) {
      setAviso(`⚠️ ${err.message}`);
    } finally {
      setCorriendo(false);
    }
  };

  const exportarTendencia = () => {
    const filas = data.ultimos.map((r) => ({
      fecha: new Date(r.fecha).toLocaleString('es-AR'),
      ok: r.resumen.ok, atencion: r.resumen.atencion, alerta: r.resumen.alerta, origen: r.origen, ms: r.ms,
    }));
    descargarCsv('salud_tendencia', [
      { titulo: 'fecha', clave: 'fecha' }, { titulo: 'ok', clave: 'ok' }, { titulo: 'atencion', clave: 'atencion' },
      { titulo: 'alerta', clave: 'alerta' }, { titulo: 'origen', clave: 'origen' }, { titulo: 'ms', clave: 'ms' },
    ], filas);
  };

  const ultimo = data.ultimo;

  return (
    <div>
      <DebugTag nombre="SaludPage" />
      <div className="flex items-center gap-2 mb-1">
        <h2 className="text-lg font-semibold">Salud de la base</h2>
        {ultimo && (
          <span className="agente-badge">{new Date(ultimo.fecha).toLocaleString('es-AR')} · {ultimo.origen}</span>
        )}
      </div>
      <p className="text-sm text-muted mb-4">
        Auditoría técnica y semántica (doc 01 §8). Corre sola todos los días a las 2:00; el resultado queda
        persistido con su tendencia.
      </p>
      {aviso && <p className="text-sm mb-3">{aviso}</p>}

      {/* La foto del SERVIDOR va primero: es lo que se mira cuando algo anda mal (memoria, CPU, disco). */}
      <CardSistema />
      <div className="flex gap-2 mb-4">
        {esAdmin && (
          <button type="button" className="btn btn-primary text-sm" onClick={correr} disabled={corriendo}>
            {corriendo ? 'Corriendo…' : 'Correr ahora'}
          </button>
        )}
        <button type="button" className="btn text-sm" onClick={cargar} disabled={cargando}>Refrescar</button>
        {data.ultimos.length > 0 && (
          <button type="button" className="btn text-sm" onClick={exportarTendencia}>⬇ Descargar tendencia</button>
        )}
      </div>

      {comparativa && comparativa.proveedores && comparativa.proveedores.length > 0 && (
        <div className="card p-3 mb-4">
          <div className="flex items-center justify-between gap-2 mb-2">
            <span className="text-sm font-medium">Motores LLM por proveedor</span>
            <div className="flex gap-1">
              {[1, 7, 30].map((d) => (
                <button
                  key={d}
                  type="button"
                  className={`btn text-xs ${diasLlm === d ? 'btn-primary' : 'btn-ghost'}`}
                  onClick={() => setDiasLlm(d)}
                >
                  {d} d
                </button>
              ))}
            </div>
          </div>
          <p className="text-xs text-muted mb-2">
            El modelo local y los pagos se miden por separado para poder compararlos. Los tokens del modelo
            local son estimados por longitud (su worker no informa consumo real).
          </p>
          {comparativa.proveedores.map((p) => (
            <div key={p.proveedor} className="py-2 text-xs" style={{ borderBottom: '1px solid var(--border)' }}>
              <div className="flex justify-between gap-2">
                <span className="font-mono font-medium">{p.proveedor}</span>
                <span>
                  {p.llamadas} llamadas · {Number(p.tokens || 0).toLocaleString('es-AR')} tokens · {' '}
                  {p.msPromedio} ms promedio · {p.msMax} ms máximo
                </span>
              </div>
              <div className="text-muted mt-1">
                {Object.entries(p.modulos || {}).sort((a, b) => b[1] - a[1]).map(([m, n]) => `${m}: ${n}`).join(' · ')}
              </div>
            </div>
          ))}
        </div>
      )}

      {cargando && !ultimo && <p className="text-sm text-muted">Cargando…</p>}
      {ultimo && (
        <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))' }}>
          {ultimo.checks.map((c) => (
            <div key={c.clave} className="card p-3">
              <div className="flex items-center justify-between gap-2 mb-1">
                <span className="text-sm font-medium">{c.titulo}</span>
                <span className="text-xs font-mono" style={{ color: colorNivel(c.nivel) }}>{c.nivel.toUpperCase()}</span>
              </div>
              <div className="text-xs text-muted mb-1">valor: {c.valor == null ? '—' : String(c.valor)} · {c.ms} ms</div>
              {c.detalle.slice(0, 4).map((d, i) => (
                <div key={i} className="text-xs py-0.5 truncate" title={d}>{d}</div>
              ))}
              {c.detalle.length > 4 && <div className="text-xs text-muted">… y {c.detalle.length - 4} más</div>}
            </div>
          ))}
        </div>
      )}

      {data.ultimos.length > 1 && (
        <div className="card p-3 mt-4">
          <div className="text-sm font-medium mb-2">Tendencia</div>
          {data.ultimos.map((r) => (
            <div key={r.id} className="flex items-center justify-between text-xs py-0.5">
              <span className="font-mono">{new Date(r.fecha).toLocaleString('es-AR')}</span>
              <span>
                <span style={{ color: '#15803d' }}>{r.resumen.ok} ok</span>
                {' · '}
                <span style={{ color: '#b45309' }}>{r.resumen.atencion} atención</span>
                {' · '}
                <span style={{ color: 'var(--danger)' }}>{r.resumen.alerta} alerta</span>
                {' · '}{r.ms} ms
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
