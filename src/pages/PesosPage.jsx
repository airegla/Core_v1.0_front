// BookOS - PesosPage.jsx
// ruta: bookos/frontend/src/pages/PesosPage.jsx
// descripcion: panel de PESOS con DOS duenos en la misma pantalla: el BUSCADOR SEMANTICO
//   (similitud por intencion + terminos y umbrales del ranking) y el ROUTER (diales del selector
//   de rutas y su compuerta). El foco entra por prop desde el menu (Core > Kernel > Pesos del
//   buscador / Core > Router > Pesos del router); guardar crea una version nueva y activa, y la
//   anterior queda para rollback. La medicion vive en Banco del buscador / Banco del router.

import { useCallback, useEffect, useState } from 'react';
import DebugTag from '../ui/DebugTag';
import { kernelApi } from '../api/api';

const INTENCIONES = ['tecnico', 'autor', 'exploratorio'];

// Convierte el payload del kernel a la forma editable (strings para los inputs).
function aFormulario(pesos) {
  if (!pesos) return null;
  return {
    sem: {
      tecnico: { ...pesos.sem.tecnico },
      autor: { ...pesos.sem.autor },
      exploratorio: { ...pesos.sem.exploratorio },
    },
    alfa: String(pesos.alfa), beta: String(pesos.beta), gamma: String(pesos.gamma),
    delta: String(pesos.delta), epsilon: String(pesos.epsilon),
    epsilonCoocurrencia: String(pesos.epsilonCoocurrencia), zeta: String(pesos.zeta),
    recallPorCampo: String(pesos.umbrales.recallPorCampo), recallTotal: String(pesos.umbrales.recallTotal),
    // Diales del SELECTOR DE RUTAS. `corte` vacio = ese grupo no pondera en el ranking (hoy es asi).
    rutas: {
      tecnica: String(pesos.rutas.ranking.tecnica), ejemplo: String(pesos.rutas.ranking.ejemplo),
      acuerdo: String(pesos.rutas.ranking.acuerdo),
      corte: pesos.rutas.ranking.corte === null ? '' : String(pesos.rutas.ranking.corte),
      fuenteTurno: String((pesos.rutas.ranking.fuentes && pesos.rutas.ranking.fuentes.turno) || 1),
      margen: String(pesos.rutas.compuerta.margen), exigirAcuerdo: pesos.rutas.compuerta.exigirAcuerdo === true,
    },
  };
}

function aPayload(form) {
  const num = (v) => Number(String(v).replace(',', '.'));
  return {
    sem: {
      tecnico: { id: num(form.sem.tecnico.id), dig: num(form.sem.tecnico.dig), aut: num(form.sem.tecnico.aut) },
      autor: { id: num(form.sem.autor.id), dig: num(form.sem.autor.dig), aut: num(form.sem.autor.aut) },
      exploratorio: { id: num(form.sem.exploratorio.id), dig: num(form.sem.exploratorio.dig), aut: num(form.sem.exploratorio.aut) },
    },
    alfa: num(form.alfa), beta: num(form.beta), gamma: num(form.gamma), delta: num(form.delta),
    epsilon: num(form.epsilon), epsilonCoocurrencia: num(form.epsilonCoocurrencia), zeta: num(form.zeta),
    umbrales: { recallPorCampo: num(form.recallPorCampo), recallTotal: num(form.recallTotal) },
    rutas: {
      ranking: {
        tecnica: num(form.rutas.tecnica), ejemplo: num(form.rutas.ejemplo), acuerdo: num(form.rutas.acuerdo),
        corte: String(form.rutas.corte).trim() === '' ? null : num(form.rutas.corte),
        // Solo el peso de la fuente `turno` (trafico real): es el unico que se toca a mano hoy. Las
        // demas fuentes siguen con su valor por defecto (el backend completa lo que no se declara).
        fuentes: { turno: num(form.rutas.fuenteTurno) },
      },
      compuerta: { margen: num(form.rutas.margen), exigirAcuerdo: form.rutas.exigirAcuerdo === true },
    },
  };
}

export default function PesosPage({ esAdmin, foco = 'sem' }) {
  const [data, setData] = useState(null);
  const [form, setForm] = useState(null);
  const [aviso, setAviso] = useState('');
  // 'sem' = buscador semantico, 'router' = selector de rutas. El menu trae el foco; las pestañas
  // permiten cambiarlo sin volver al menu (misma pantalla, mismo formulario de fondo).
  const [seccion, setSeccion] = useState(foco);
  useEffect(() => { setSeccion(foco); }, [foco]);

  const cargar = useCallback(async () => {
    try {
      const res = await kernelApi.pesos();
      setData(res.data);
      setForm(aFormulario(res.data.vigente));
    } catch (err) {
      setAviso(`⚠️ ${err.message}`);
    }
  }, []);

  useEffect(() => { cargar(); }, [cargar]);

  const set = (clave, valor) => setForm((f) => ({ ...f, [clave]: valor }));
  const setSem = (intencion, componente, valor) =>
    setForm((f) => ({ ...f, sem: { ...f.sem, [intencion]: { ...f.sem[intencion], [componente]: valor } } }));

  const setRuta = (clave, valor) => setForm((f) => ({ ...f, rutas: { ...f.rutas, [clave]: valor } }));

  const guardar = async () => {
    if (!window.confirm('Guardar estos pesos como versión nueva y activarla. ¿Confirmás?')) return;
    try {
      const res = await kernelApi.pesosGuardar({ pesos: aPayload(form), nota: 'Edición manual desde el panel' });
      setAviso(`✓ ${res.message}`);
      await cargar();
    } catch (err) {
      const msg = err.response && err.response.data ? err.response.data.message : err.message;
      setAviso(`⚠️ ${msg}`);
    }
  };

  const activar = async (id) => {
    if (!window.confirm(`Reactivar la versión ${id} (rollback). ¿Confirmás?`)) return;
    try {
      const res = await kernelApi.pesosActivar(id);
      setAviso(`✓ ${res.message}`);
      await cargar();
    } catch (err) {
      const msg = err.response && err.response.data ? err.response.data.message : err.message;
      setAviso(`⚠️ ${msg}`);
    }
  };

  if (!form || !data) {
    return <div><DebugTag nombre="PesosPage" /><p className="text-sm text-muted">Cargando pesos… {aviso}</p></div>;
  }

  const campo = (etiqueta, clave, paso = 0.01, ayuda = null) => (
    <label className="block" title={ayuda || ''}>
      <span className="block text-xs uppercase tracking-widest text-muted mb-1">{etiqueta}</span>
      <input className="input-os" type="number" step={paso} min={0} value={form[clave]} onChange={(e) => set(clave, e.target.value)} />
    </label>
  );

  return (
    <div>
      <DebugTag nombre="PesosPage" />
      <div className="flex items-center gap-2 mb-1">
        <h2 className="text-lg font-semibold">{seccion === 'router' ? 'Pesos del router' : 'Pesos del buscador semántico'}</h2>
        <span className="agente-badge">versión vigente {data.vigente.version}</span>
      </div>
      {seccion === 'router' ? (
        <p className="text-sm text-muted mb-4">
          Diales del SELECTOR de ruta: con qué se elige la herramienta de cada pedido del turno y cuándo
          el camino sin LLM de la plantilla puede responder. Guardar crea una versión nueva (la anterior
          queda para rollback); la medición antes/después se corre en Core ▾ Router ▾ <strong>Banco del router</strong>.
        </p>
      ) : (
        <p className="text-sm text-muted mb-4">
          score = α·sem + β·sparse + γ·grafo + δ·negocio + ε·flujo + ζ·empatía. Guardar crea una versión nueva
          (la anterior queda para rollback); la medición antes/después se corre en Core ▾ Kernel ▾ <strong>Banco del buscador</strong>.
        </p>
      )}
      <div className="flex gap-2 mb-4">
        {[['sem', 'Buscador semántico'], ['router', 'Router']].map(([id, label]) => (
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
        <>
      <div className="card p-4 mb-4">
        <div className="text-sm font-medium mb-2">Similitud semántica por intención (se normaliza a 1)</div>
        <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))' }}>
          {INTENCIONES.map((intencion) => (
            <div key={intencion} className="p-2" style={{ border: '1px solid var(--border)', borderRadius: 10 }}>
              <div className="text-xs font-mono mb-2">{intencion}</div>
              <div className="grid grid-cols-3 gap-2">
                {['id', 'dig', 'aut'].map((c) => (
                  <label key={c} className="block">
                    <span className="block text-xs text-muted mb-1">{c}</span>
                    <input className="input-os" type="number" step={0.05} min={0} max={1}
                      value={form.sem[intencion][c]} onChange={(e) => setSem(intencion, c, e.target.value)} />
                  </label>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="card p-4 mb-4">
        <div className="text-sm font-medium mb-2">Términos y umbrales</div>
        <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))' }}>
          {campo('α sem', 'alfa', 0.05, 'peso global de la similitud semántica (0.5–1.5)')}
          {campo('β sparse', 'beta', 0.01, 'matches de keywords en digestos (0–0.2)')}
          {campo('γ grafo', 'gamma', 0.01, 'reglas del grafo de negocio (0–0.5)')}
          {campo('δ negocio', 'delta', 0.01, 'stock, rotación, pedibilidad (0–0.3)')}
          {campo('ε flujo', 'epsilon', 0.01, 'sell-through de materia (0–0.2)')}
          {campo('ε coocurrencia', 'epsilonCoocurrencia', 0.01, 'coocurrencia de ventas (0–0.15)')}
          {campo('ζ empatía', 'zeta', 0.01, 'contexto de pantalla/cliente (0–0.3)')}
          {campo('recall por campo', 'recallPorCampo', 1, '20–120')}
          {campo('recall total', 'recallTotal', 1, '60–400')}
        </div>
        {esAdmin && (
          <div className="flex items-center gap-2 mt-3">
            <button type="button" className="btn btn-primary text-sm" onClick={guardar}>Guardar como versión nueva</button>
            <button type="button" className="btn text-sm" onClick={() => setForm(aFormulario(data.vigente))}>Restaurar valores vigentes</button>
          </div>
        )}
      </div>
        </>
      )}

      {seccion === 'router' && (
      <div className="card p-4 mb-4">
        <div className="text-sm font-medium mb-2">Selector de rutas (con qué se elige la herramienta)</div>
        <p className="text-xs text-muted mb-3">
          Pesan en el selector que decide, por semejanza con los pedidos anteriores, a qué ruta va cada
          pedido del turno (y si el camino sin LLM de la plantilla puede usarse). <strong>corte</strong> vacío
          significa que la ficha diferencial no entra al ranking. <strong>acuerdo</strong> es cuánto suma la
          segunda evidencia cuando coinciden; el <strong>margen</strong> y exigir el acuerdo son el criterio
          para <em>delegar</em> una decisión al selector. Todo esto se mide en Core ▾ Router ▾
          <strong> Banco del router</strong>.
        </p>
        <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))' }}>
          <label className="block" title="cuánto pesa la descripción técnica de cada herramienta">
            <span className="block text-xs uppercase tracking-widest text-muted mb-1">técnica</span>
            <input className="input-os" type="number" step={0.1} min={0} value={form.rutas.tecnica} onChange={(e) => setRuta('tecnica', e.target.value)} />
          </label>
          <label className="block" title="cuánto pesa cada forma de pedir ya registrada">
            <span className="block text-xs uppercase tracking-widest text-muted mb-1">ejemplo</span>
            <input className="input-os" type="number" step={0.1} min={0} value={form.rutas.ejemplo} onChange={(e) => setRuta('ejemplo', e.target.value)} />
          </label>
          <label className="block" title="cuánto suma que la forma y la descripción apunten al mismo lado">
            <span className="block text-xs uppercase tracking-widest text-muted mb-1">acuerdo</span>
            <input className="input-os" type="number" step={0.1} min={0} value={form.rutas.acuerdo} onChange={(e) => setRuta('acuerdo', e.target.value)} />
          </label>
          <label className="block" title="ficha diferencial: vacío = no pondera en el ranking">
            <span className="block text-xs uppercase tracking-widest text-muted mb-1">corte</span>
            <input className="input-os" type="number" step={0.05} min={0} placeholder="no pondera" value={form.rutas.corte} onChange={(e) => setRuta('corte', e.target.value)} />
          </label>
          <label className="block" title="cuánto pesa una forma que VINO DE UN TURNO REAL contra una sembrada">
            <span className="block text-xs uppercase tracking-widest text-muted mb-1">peso turno real</span>
            <input className="input-os" type="number" step={0.1} min={0} value={form.rutas.fuenteTurno} onChange={(e) => setRuta('fuenteTurno', e.target.value)} />
          </label>
          <label className="block" title="despegue mínimo entre la primera y la segunda candidata para decidir solo">
            <span className="block text-xs uppercase tracking-widest text-muted mb-1">margen compuerta</span>
            <input className="input-os" type="number" step={0.01} min={0} max={1} value={form.rutas.margen} onChange={(e) => setRuta('margen', e.target.value)} />
          </label>
          <label className="flex items-center gap-2 mt-4" title="exige que las dos evidencias apunten a la misma ruta">
            <input type="checkbox" checked={form.rutas.exigirAcuerdo} onChange={(e) => setRuta('exigirAcuerdo', e.target.checked)} />
            <span className="text-xs text-muted">exigir acuerdo</span>
          </label>
        </div>
        {esAdmin && (
          <div className="flex items-center gap-2 mt-3">
            <button type="button" className="btn btn-primary text-sm" onClick={guardar}>Guardar como versión nueva</button>
            <button type="button" className="btn text-sm" onClick={() => setForm(aFormulario(data.vigente))}>Restaurar valores vigentes</button>
          </div>
        )}
      </div>
      )}

      <div className="card p-4 mb-4">
        <div className="text-sm font-medium mb-2">Cómo se mide un cambio de pesos</div>
        {seccion === 'router' ? (
          <p className="text-xs text-muted">
            El <strong>banco del router</strong> (Core ▾ Router ▾ Banco del router) corre el banco de
            pedidos con su ruta esperada y dice cuántos se contestan gratis, cuántos se contestarían mal
            y cuántos se van al modelo. Cambiar los diales de arriba sin volver a correrlo es cambiar el
            dial sin medir. Guardar acá una versión nueva la activa; la anterior queda para rollback.
          </p>
        ) : (
          <p className="text-xs text-muted">
            El <strong>banco del buscador</strong> (Core ▾ Kernel ▾ Banco del buscador) corre la serie
            fija de consultas y la evalúa con el LLM (hasta 3 ciclos); si encuentra mejora, deja una
            propuesta en <strong>Core ▾ Kernel ▾ Propuestas Kernel</strong>. Cambiar los pesos de arriba
            sin volver a correrlo es cambiar el dial sin medir. Guardar acá una versión nueva la activa;
            la anterior queda para rollback.
          </p>
        )}
      </div>

      <div className="card p-4">
        <div className="text-sm font-medium mb-2">Historial de versiones</div>
        {data.historial.map((v) => (
          <div key={v.id} className="flex items-center justify-between text-xs py-1">
            <span>
              <span className="font-mono">v{v.version}</span>
              {v.activa && <span className="agente-badge ml-2">activa</span>}
              <span className="text-muted ml-2">{new Date(v.createdAt).toLocaleString('es-AR')}</span>
              {v.nota && <span className="text-muted ml-2">· {v.nota}</span>}
            </span>
            {esAdmin && !v.activa && (
              <button type="button" className="btn btn-ghost text-xs" onClick={() => activar(v.id)}>Reactivar (rollback)</button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
