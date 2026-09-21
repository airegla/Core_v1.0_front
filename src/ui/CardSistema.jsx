// BookOS - CardSistema.jsx
// ruta: bookos/frontend/src/ui/CardSistema.jsx
// descripcion: card de las metricas del SERVIDOR para el panel de Salud: memoria disponible, uso de
//   CPU, disco, carga, uptime y los procesos que mas RAM comen. Cada numero declara DE DONDE SALE (el
//   comando del sistema que lo midio, o la API de Node cuando la plataforma no tiene ese comando): la
//   procedencia no es un adorno, es lo que permite auditar el dato. Se refresca sola cada 30 s y
//   tiene su boton para refrescar a mano.

import { useCallback, useEffect, useState } from 'react';
import { kernelApi } from '../api/api';

const REFRESCO_MS = 30000;

const bytes = (b, dec = 2) => (b == null ? '—' : `${(Number(b) / 1024 ** 3).toFixed(dec)} GB`);
const pct = (p) => (p == null ? '—' : `${p}%`);

// El color del medidor sigue el mismo criterio que los niveles de Salud: verde, ambar, rojo.
const colorUso = (p) => (p == null ? 'var(--muted)' : p >= 90 ? 'var(--danger)' : p >= 75 ? '#b45309' : '#15803d');

function Medidor({ etiqueta, uso, detalle, fuente }) {
  return (
    <div className="py-1" title={fuente ? `fuente: ${fuente}` : undefined}>
      <div className="flex justify-between items-baseline gap-2">
        <span className="text-sm font-medium">{etiqueta}</span>
        <span className="text-xs font-mono" style={{ color: colorUso(uso) }}>{pct(uso)}</span>
      </div>
      <div className="mt-1" style={{ background: 'var(--border)', height: 6, borderRadius: 3, overflow: 'hidden' }}>
        <div style={{ width: `${Math.min(Math.max(uso || 0, 0), 100)}%`, height: '100%', background: colorUso(uso) }} />
      </div>
      {detalle && <div className="text-xs text-muted mt-1">{detalle}</div>}
    </div>
  );
}

export default function CardSistema() {
  const [m, setM] = useState(null);
  const [error, setError] = useState('');
  const [verFuentes, setVerFuentes] = useState(false);

  const cargar = useCallback(async () => {
    try {
      const res = await kernelApi.saludSistema();
      setM(res.data || null);
      setError('');
    } catch (err) {
      setError(err.message);
    }
  }, []);

  useEffect(() => {
    cargar();
    const t = setInterval(cargar, REFRESCO_MS);
    return () => clearInterval(t);
  }, [cargar]);

  if (error) {
    return (
      <div className="card p-3 mb-4">
        <div className="text-sm font-medium mb-1">Servidor</div>
        <div className="text-xs text-muted">No pude leer las metricas del servidor: {error}</div>
      </div>
    );
  }
  if (!m) return <div className="card p-3 mb-4 text-sm text-muted">Leyendo el servidor…</div>;

  const mem = m.memoria || {};
  const cpu = m.cpu || {};
  const swapPct = mem.swap && mem.swap.totalBytes ? Math.round((mem.swap.usadoBytes / mem.swap.totalBytes) * 1000) / 10 : null;
  const discos = (m.disco && m.disco.montajes) || [];
  const procesos = (m.procesos && m.procesos.lista) || [];
  const up = m.uptime || {};

  return (
    <div className="card p-3 mb-4">
      <div className="flex items-center justify-between gap-2 mb-1">
        <span className="text-sm font-medium">Servidor</span>
        <span className="text-xs text-muted">
          {m.plataforma} · foto de {new Date(m.cuando).toLocaleTimeString('es-AR')}
          <button type="button" className="btn btn-ghost text-xs ml-2" onClick={cargar}>Refrescar</button>
        </span>
      </div>

      <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))' }}>
        <div>
          <Medidor
            etiqueta="Memoria"
            uso={mem.usoPct}
            fuente={mem.fuente}
            detalle={`disponible ${bytes(mem.disponibleBytes)} de ${bytes(mem.totalBytes)} · en uso ${bytes(mem.usadoBytes)}${mem.cacheBytes ? ` · cache ${bytes(mem.cacheBytes)}` : ''}`}
          />
          {mem.swap && mem.swap.totalBytes ? (
            <Medidor
              etiqueta="Swap"
              uso={swapPct}
              fuente={mem.fuente}
              detalle={`en uso ${bytes(mem.swap.usadoBytes)} de ${bytes(mem.swap.totalBytes)}`}
            />
          ) : null}
          <div className="text-xs text-muted mt-1" title={up.fuente || ''}>
            uptime: {up.segundos == null ? '—' : `${Math.floor(up.segundos / 3600)} h ${Math.floor((up.segundos % 3600) / 60)} min`}
          </div>
        </div>

        <div>
          <Medidor
            etiqueta={`CPU (${cpu.nucleos || '?'} nucleos)`}
            uso={cpu.usoPct}
            fuente={cpu.fuente}
            detalle={cpu.usoPct == null
              ? 'uso no medible en esta plataforma'
              : `medido sobre una ventana de ${cpu.ventanaMs} ms`}
          />
          <div className="text-xs text-muted mt-1" title={cpu.fuente || ''}>
            carga (1/5/15 min): {(cpu.carga || []).join(' / ') || '—'}
            {cpu.cargaPorNucleo != null ? ` · por nucleo ${cpu.cargaPorNucleo}` : ''}
          </div>
        </div>

        <div>
          {discos.length ? discos.map((d) => (
            <Medidor
              key={d.montado}
              etiqueta={`Disco ${d.montado}`}
              uso={d.usoPct}
              fuente={m.disco.fuente}
              detalle={`en uso ${bytes(d.usadoBytes)} de ${bytes(d.totalBytes)} · libre ${bytes(d.disponibleBytes)}`}
            />
          )) : (
            <div className="text-xs text-muted">Disco: {m.disco && m.disco.fuente}</div>
          )}
        </div>

        {procesos.length ? (
          <div>
            <div className="text-sm font-medium mb-1">Procesos con mas RAM</div>
            {procesos.map((p) => (
              <div key={`${p.pid}-${p.nombre}`} className="flex justify-between text-xs py-0.5">
                <span className="font-mono truncate" title={`pid ${p.pid}`}>{p.nombre}</span>
                <span className="text-muted">{p.rssMB} MB · {p.cpuPct}%</span>
              </div>
            ))}
          </div>
        ) : null}
      </div>

      <div className="mt-2">
        <button type="button" className="btn btn-ghost text-xs" onClick={() => setVerFuentes((v) => !v)}>
          {verFuentes ? 'Ocultar' : '¿De dónde salen estos datos?'}
        </button>
        {verFuentes && (
          <div className="text-xs text-muted mt-1">
            {(Object.entries(m.fuentes || {})).map(([k, v]) => (
              <div key={k}><span className="font-mono">{k}</span>: {v}</div>
            ))}
            <div className="mt-1">{m.limite}</div>
          </div>
        )}
      </div>
    </div>
  );
}
