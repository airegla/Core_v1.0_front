// BookOS - BancoPruebasPage.jsx
// ruta: bookos/frontend/src/pages/BancoPruebasPage.jsx
// descripcion: pantalla del BANCO DE PRUEBAS con TRES duenos en pestanas: el BUSCADOR (serie fija
//   de consultas evaluada con el LLM pago; antes vivia dentro de Pesos), el ROUTER (banco de
//   pedidos con ruta esperada: plantilla sin LLM, planificador y selector) y el MODELO CHICO
//   (que herramienta elige el chico para cada consulta de la serie). El foco entra por prop desde
//   el menu (Core > Kernel > Banco del buscador / Router > Banco del router / LLM > Banco del
//   modelo chico).
//
//   Las tres son instrumentos de MEDICION: ninguna activa nada por si sola. La del buscador, si
//   encuentra mejora, deja una propuesta para aprobar; las otras dos solo dejan el reporte.

import { useCallback, useEffect, useState } from 'react';
import DebugTag from '../ui/DebugTag';
import { kernelApi } from '../api/api';

// Costo medido por consulta del modelo chico. Se declara en la pantalla porque la corrida BLOQUEA la
// peticion: el usuario tiene que saber cuanto va a esperar. El numero es el del 0.5B medido en el i5
// (15-Sep-2026); el 1.5B tarda ~2,4x, y por eso el aviso dice "estimado".
const MS_POR_CONSULTA_CHICO = 12000;

// Rotulo de las series conocidas. La LISTA y su tamano salen del backend (`consultasPorSerie`):
// agregar una serie alla no obliga a tocar esta pantalla.
const ROTULO_SERIE = {
  normal: 'consultas de busqueda del banco de ranking',
  memoria: 'consultas de memoria',
  pedidos: 'PEDIDOS reales del operario',
};

// Encabezado de cada pestana: la pantalla tiene TRES duenos y la pestana dice QUE mide cada uno
// (antes las tres series compartian una sola pantalla con un texto que prometia las tres juntas).
const TITULOS = { sem: 'Banco del buscador semántico', router: 'Banco del router', chico: 'Banco del modelo chico' };
const INTROS = {
  sem: (
    <>
      Serie fija de consultas reales evaluada con el <strong>LLM pago</strong> (1–5) durante hasta 3
      ciclos de ajuste. Si encuentra mejora deja una propuesta en <strong>Core ▾ Kernel ▾ Propuestas
      Kernel</strong>; no activa nada por sí solo. Es el instrumento para comparar los pesos del
      buscador (<strong>Core ▾ Kernel ▾ Pesos del buscador</strong>) antes y después.
    </>
  ),
  router: (
    <>
      Mide, sobre el <strong>banco de pedidos con su ruta esperada</strong>, qué hace el turno con
      cada uno: si lo contesta la plantilla sin LLM (y si acierta), si el planificador lo atrapa con
      la herramienta correcta, y si el selector respaldaría esa decisión. <strong>No ejecuta
      herramientas</strong>: el planificador solo propone. Sirve para comparar los diales de
      <strong> Core ▾ Router ▾ Pesos del router</strong> antes y después.
    </>
  ),
  chico: (
    <>
      Corre la serie de consultas contra el worker del modelo chico, una llamada por consulta, con
      el prompt real del motor. Mide qué herramienta elige y si existe en el contrato vigente.
      <strong> No ejecuta ninguna herramienta</strong>: no toca datos.
    </>
  ),
};

export default function BancoPruebasPage({ esAdmin, foco = 'sem' }) {
  const [aviso, setAviso] = useState('');
  // Pestana activa: la trae el menu (Core ▾ Kernel / Router / LLM) y se puede cambiar aca sin
  // volver al menu. Las tres series se cargan igual (el estado se lee una vez).
  const [seccion, setSeccion] = useState(foco);
  useEffect(() => { setSeccion(foco); }, [foco]);

  // --- Banco del ranking ---
  const [ranking, setRanking] = useState(null);
  const [observacion, setObservacion] = useState('');
  const [corriendoRanking, setCorriendoRanking] = useState(false);

  // --- Banco del modelo chico ---
  const [chico, setChico] = useState(null);
  const [serie, setSerie] = useState('normal');
  const [limite, setLimite] = useState('');
  const [corriendoChico, setCorriendoChico] = useState(false);
  const [reporte, setReporte] = useState(null);

  // --- Banco del router de intencion (serie "Rutas") ---
  const [rutas, setRutas] = useState(null);
  const [corriendoRutas, setCorriendoRutas] = useState(false);
  const [reporteRutas, setReporteRutas] = useState(null);

  const cargar = useCallback(async () => {
    try {
      const b = await kernelApi.banco();
      setRanking(b.data || null);
    } catch (err) {
      setAviso(`⚠️ ${err.message}`);
    }
    try {
      const c = await kernelApi.bancoChicoEstado();
      setChico(c.data || null);
    } catch (err) {
      setAviso(`⚠️ no se pudo leer el estado del banco del chico: ${err.message}`);
    }
    try {
      const r = await kernelApi.rutasBanco();
      setRutas(r.data || null);
    } catch (err) {
      setAviso(`⚠️ no se pudo leer el banco de rutas: ${err.message}`);
    }
  }, []);

  useEffect(() => { cargar(); }, [cargar]);

  const correrRanking = async () => {
    setCorriendoRanking(true);
    setAviso('Corriendo el banco del ranking (serie fija + evaluación LLM, hasta 3 ciclos)…');
    try {
      const res = await kernelApi.bancoCorrer({ observacion: observacion || null });
      const r = res.data || {};
      setAviso(r.ok === false
        ? `Banco: ${r.motivo}`
        : `Banco: métrica ${r.base} → ${r.mejor} (mejora ${r.mejora}, ciclos ${r.ciclos}, ${r.llamadasLlm} llamadas)${r.propuestaId ? ` · propuesta #${r.propuestaId} creada` : ' · sin mejora: no se propone nada'}`);
      await cargar();
    } catch (err) {
      setAviso(`⚠️ ${err.message}`);
    } finally {
      setCorriendoRanking(false);
    }
  };

  const correrChico = async () => {
    setCorriendoChico(true);
    setReporte(null);
    setAviso(`Midiendo el modelo chico (serie ${serie})… no cierres la pantalla.`);
    try {
      const res = await kernelApi.bancoChico({ serie, limite: Number(limite) || 0 });
      const r = res.data || {};
      setReporte(r);
      setAviso(r.ok === false ? `Banco del chico: ${r.motivo}` : 'Corrida del banco del chico terminada');
    } catch (err) {
      setAviso(`⚠️ ${err.message}`);
    } finally {
      setCorriendoChico(false);
    }
  };

  const correrRutas = async () => {
    setCorriendoRutas(true);
    setReporteRutas(null);
    setAviso('Midiendo el router de intenciones sobre el banco de pedidos… (una consulta por caso)' );
    try {
      const res = await kernelApi.rutasBancoCorrer();
      const r = res.data || {};
      setReporteRutas(r);
      setAviso(`Router de intenciones: ${r.veredicto}${r.motivos && r.motivos.length ? ` — ${r.motivos.join(' · ')}` : ''}`);
    } catch (err) {
      setAviso(`⚠️ ${err.message}`);
    } finally {
      setCorriendoRutas(false);
    }
  };

  // Tamano de cada serie segun lo que declara el backend.
  const tamanos = (chico && chico.consultasPorSerie) || {};
  const totalSerie = (s) => (s === 'todas'
    ? Object.values(tamanos).reduce((acc, lista) => acc + lista.length, 0)
    : (tamanos[s] || []).length);
  const consultasDeSerie = () => {
    const n = totalSerie(serie);
    const l = Number(limite) || 0;
    return l > 0 ? Math.min(l, n) : n;
  };

  const minutos = Math.round((consultasDeSerie() * MS_POR_CONSULTA_CHICO) / 60000);

  return (
    <div>
      <DebugTag nombre="BancoPruebasPage" />
      <h2 className="text-lg font-semibold mb-1">{TITULOS[seccion] || TITULOS.sem}</h2>
      <p className="text-sm text-muted mb-4">{INTROS[seccion] || INTROS.sem}</p>
      <div className="flex gap-2 mb-4 flex-wrap">
        {[['sem', 'Buscador semántico'], ['router', 'Router'], ['chico', 'Modelo chico']].map(([id, label]) => (
          <button
            key={id}
            type="button"
            className={`btn text-sm ${seccion === id ? 'btn-primary' : 'btn-ghost'}`}
            onClick={() => setSeccion(id)}
          >
            {label}
          </button>
        ))}
      </div>
      {aviso && <p className="text-sm mb-3">{aviso}</p>}

      {seccion === 'sem' && (
      <div className="card p-4 mb-4">
        <div className="text-sm font-medium mb-2">Ranking (serie fija · evaluación con LLM)</div>
        <p className="text-xs text-muted mb-2">
          Serie fija de {ranking ? ranking.consultas.length : '—'} consultas reales · evaluación con LLM
          (1–5) · hasta 3 ciclos de ajuste · presupuesto de llamadas por corrida.
        </p>
        <div className="flex flex-wrap items-center gap-2">
          {esAdmin && (
            <>
              <input className="input-os" style={{ maxWidth: 360 }} placeholder="Observación para la corrida (ej. campaña de navidad)"
                value={observacion} onChange={(e) => setObservacion(e.target.value)} />
              <button type="button" className="btn btn-primary text-sm" onClick={correrRanking} disabled={corriendoRanking}>
                {corriendoRanking ? 'Midiendo…' : 'Correr banco del ranking'}
              </button>
            </>
          )}
        </div>
        {ranking && ranking.corridas && ranking.corridas.length > 0 && (
          <div className="mt-3">
            {ranking.corridas.map((c) => (
              <div key={c.id} className="flex items-center justify-between text-xs py-0.5">
                <span className="font-mono">{new Date(c.fecha).toLocaleString('es-AR')} · v{c.versionPesos} · {c.ciclos} ciclos · {c.llamadasLlm} llamadas</span>
                <span>métrica {Number(c.metrica)} {c.propuestaId ? `· propuesta #${c.propuestaId}` : '· sin propuesta'}</span>
              </div>
            ))}
          </div>
        )}
      </div>
      )}

      {seccion === 'chico' && (
      <div className="card p-4 mb-4">
        <div className="text-sm font-medium mb-2">Modelo chico local (elección de herramienta)</div>
        <p className="text-xs text-muted mb-2">
          Corre la serie de consultas contra el worker del modelo chico, una llamada por consulta, con
          el prompt real del motor. Mide qué herramienta elige y si existe en el contrato vigente.
          <strong> No ejecuta ninguna herramienta</strong>: no toca datos.
        </p>
        {chico && chico.contrato && (
          <p className="text-xs text-muted mb-2">
            contrato vivo: pasos <span className="font-mono">{chico.contrato.pasos}</span> · chars por resultado{' '}
            <span className="font-mono">{chico.contrato.maxChars}</span> · prompt{' '}
            <span className="font-mono">{chico.contrato.promptChars}</span> chars (~{Math.round(chico.contrato.promptChars / 4)} tokens)
            · índice <span className="font-mono">{chico.contrato.indice.modulos} módulos / {chico.contrato.indice.accionesTotales} acciones</span>
            {' '}(fuente <span className="font-mono">{chico.contrato.indice.fuente}</span>)
          </p>
        )}
        <div className="flex flex-wrap items-center gap-2">
          {esAdmin && (
            <>
              <select className="input-os" style={{ maxWidth: 380 }} value={serie} onChange={(e) => setSerie(e.target.value)}>
                {((chico && chico.series) || ['normal']).map((s) => (
                  <option key={s} value={s}>{`${s} (${totalSerie(s)}${ROTULO_SERIE[s] ? ` — ${ROTULO_SERIE[s]}` : ''})`}</option>
                ))}
              </select>
              <input type="number" min="0" className="input-os" style={{ maxWidth: 140 }} placeholder="límite (0 = toda)"
                value={limite} onChange={(e) => setLimite(e.target.value)} />
              <button type="button" className="btn btn-primary text-sm" onClick={correrChico} disabled={corriendoChico}>
                {corriendoChico ? 'Midiendo…' : 'Correr banco del chico'}
              </button>
              <span className="text-xs text-muted">
                {consultasDeSerie()} consultas · ~{minutos} min (medido: ~12 s por consulta)
              </span>
            </>
          )}
        </div>
        <p className="text-xs text-muted mt-2">
          LÍMITES declarados: una llamada por consulta (no simula el resultado de la herramienta, así
          que no mide el loop completo ni la respuesta final del turno) y mide con el prompt del motor
          <strong> sin los bloques del turno</strong> (memoria, bloque del operario e hilo): es a
          propósito, para que la serie quede comparable entre corridas. Cambiar de modelo cambia todo
          el resultado: la serie mide la dupla índice + semilla + modelo.
        </p>

        {reporte && reporte.ok === false && (
          <p className="text-sm mt-3" style={{ color: 'var(--danger)' }}>No se midió: {reporte.motivo}</p>
        )}

        {reporte && reporte.ok && (
          <div className="mt-3">
            <div className="text-xs mb-2">
              <span className="font-mono">{reporte.resumen.consultas}</span> consultas ·
              forma <span className="font-mono">{Object.entries(reporte.resumen.porForma).map(([k, v]) => `${k} ${v}`).join(' · ')}</span> ·
              módulo existente <span className="font-mono">{reporte.resumen.moduloExistente}</span> ·
              módulo esperado <span className="font-mono">{reporte.resumen.moduloEsperado}</span> ·
              mediana <span className="font-mono">{reporte.resumen.msMediana} ms</span> ·
              máximo <span className="font-mono">{reporte.resumen.msMaximo} ms</span>
              {reporte.reporte && <span className="text-muted"> · reporte en <span className="font-mono">{reporte.reporte.split(/[\\/]/).pop()}</span></span>}
            </div>
            <div style={{ maxHeight: 360, overflow: 'auto' }}>
              {reporte.filas.map((f, i) => (
                <div key={`${f.consulta}-${i}`} className="flex items-center justify-between text-xs py-0.5" style={{ borderBottom: '1px solid var(--border)' }}>
                  <span className="truncate" style={{ maxWidth: 380 }} title={[f.consulta, f.porque ? `esperado: ${f.porque}` : ''].filter(Boolean).join('\n')}>
                    {f.consulta}
                    {f.porque && <span className="text-muted"> → {Array.isArray(f.esperado) ? f.esperado.join(' / ') : f.esperado}</span>}
                  </span>
                  <span className="flex items-center gap-2">
                    <span className="font-mono text-muted">{f.ms} ms</span>
                    <span className="font-mono">
                      {f.forma === 'herramienta' ? `${f.herramienta}${f.accion && !String(f.herramienta).includes(':') ? `:${f.accion}` : ''}` : f.forma}
                    </span>
                    {f.forma === 'herramienta' && !f.modulo && <span className="agente-badge" style={{ color: 'var(--danger)' }}>módulo inexistente</span>}
                    {f.forma === 'herramienta' && f.accionValida === false && <span className="agente-badge" style={{ color: 'var(--danger)' }}>acción inexistente</span>}
                    {f.acierta && <span className="agente-badge">esperado</span>}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
      )}

      {seccion === 'router' && (
      <div className="card p-4 mb-4">
        <div className="text-sm font-medium mb-2">Rutas (decisión de camino del turno)</div>
        <p className="text-xs text-muted mb-2">
          Mide, sobre el <strong>banco de pedidos con su ruta esperada</strong>, qué hace el turno con
          cada uno: si lo contesta el camino sin LLM de la plantilla (y si acierta), si el
          <strong> planificador</strong> lo atrapa con la herramienta correcta, y si el
          <strong> selector</strong> respaldaría esa decisión. <strong>No ejecuta herramientas</strong>:
          el planificador solo propone. Es también el instrumento que dice si un cambio en los diales
          del selector (<strong>Core ▾ Router ▾ Pesos del router</strong>) mejoró o empeoró: se corre antes y después.
        </p>
        {rutas && (
          <p className="text-xs text-muted mb-2">
            banco <span className="font-mono">{rutas.banco.archivo}</span> ·{' '}
            <span className="font-mono">{rutas.banco.casos}</span> casos sobre{' '}
            <span className="font-mono">{rutas.banco.rutas}</span> rutas · diales v<span className="font-mono">{rutas.diales.version}</span>:
            técnica <span className="font-mono">{rutas.diales.ranking.tecnica}</span>,
            ejemplo <span className="font-mono">{rutas.diales.ranking.ejemplo}</span>,
            acuerdo <span className="font-mono">{rutas.diales.ranking.acuerdo}</span>,
            corte <span className="font-mono">{rutas.diales.ranking.corte === null ? 'no pondera' : rutas.diales.ranking.corte}</span>
            {' '}· compuerta margen <span className="font-mono">{rutas.diales.compuerta.margen}</span>
            {rutas.diales.compuerta.exigirAcuerdo ? ' exigiendo acuerdo' : ' sin exigir acuerdo'}
            {' '}· la plantilla sabe contestar <span className="font-mono">{(rutas.rutasConPlantilla || []).join(' · ')}</span>
          </p>
        )}
        <div className="flex flex-wrap items-center gap-2">
          {esAdmin && (
            <button type="button" className="btn btn-primary text-sm" onClick={correrRutas} disabled={corriendoRutas}>
              {corriendoRutas ? 'Midiendo…' : 'Correr banco de rutas'}
            </button>
          )}
          <span className="text-xs text-muted">
            {rutas ? `${rutas.banco.casos} pedidos` : 'banco de pedidos'} · una consulta por caso, sin modelo pago
          </span>
        </div>
        <p className="text-xs text-muted mt-2">
          LÍMITES declarados: mide la DECISIÓN, no la respuesta final (la plantilla todavía exige que la
          búsqueda del kernel junte el umbral de resultados), y es una COTA SUPERIOR de ahorro —el
          marcador y las rutas deterministas corren antes y no se evalúan acá—. El banco tiene UNA ruta
          esperada por caso: si otra ruta también resolvería el pedido, se cuenta igual como error.
        </p>

        {reporteRutas && (
          <div className="mt-3">
            <div className="text-xs mb-2">
              veredicto <span className="font-mono">{reporteRutas.veredicto}</span> · camino sin LLM:{' '}
              <span className="font-mono">{reporteRutas.resumen.caminoSelector.decide}</span> por el camino barato
              (<span className="font-mono">{reporteRutas.resumen.caminoSelector.gratis}</span> gratis ·{' '}
              <span className="font-mono">{reporteRutas.resumen.caminoSelector.misroute}</span> mal) contra{' '}
              <span className="font-mono">{reporteRutas.resumen.caminoTexto.decide}</span> de la regla de texto anterior
              (<span className="font-mono">{reporteRutas.resumen.caminoTexto.misroute}</span> mal) ·
              planificador: atrapa <span className="font-mono">{reporteRutas.resumen.planificador.atrapa}</span>,
              con el gate pasan <span className="font-mono">{reporteRutas.resumen.planificador.pasan}</span> y se frenan{' '}
              <span className="font-mono">{reporteRutas.resumen.planificador.frenados}</span>
            </div>
            <div style={{ maxHeight: 360, overflow: 'auto' }}>
              {reporteRutas.filas
                .filter((f) => f.camino.selector.decide || f.plan)
                .map((f, i) => (
                  <div key={`${f.texto}-${i}`} className="flex items-center justify-between text-xs py-0.5" style={{ borderBottom: '1px solid var(--border)' }}>
                    <span className="truncate" style={{ maxWidth: 420 }} title={`${f.texto}\nesperaba ${f.esperada}`}>
                      {f.texto}
                      <span className="text-muted"> → {f.esperada}</span>
                    </span>
                    <span className="flex items-center gap-2">
                      {f.camino.selector.decide && (f.camino.selector.gratis
                        ? <span className="agente-badge">gratis</span>
                        : <span className="agente-badge" style={{ color: 'var(--danger)' }}>se contesta mal</span>)}
                      {f.plan && (
                        <span className="font-mono">
                          plan {f.plan.ruta}{f.plan.escribe ? ' (escribe)' : ''}
                          {f.plan.respaldado
                            ? (f.plan.conLaEsperada ? ' · pasa' : ' · PASA EQUIVOCADO')
                            : (f.plan.conLaEsperada ? ' · frenado' : ' · frenado (bien)')}
                        </span>
                      )}
                    </span>
                  </div>
                ))}
            </div>
          </div>
        )}
      </div>
      )}
    </div>
  );
}
