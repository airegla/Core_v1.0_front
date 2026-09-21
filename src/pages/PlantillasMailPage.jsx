// BookOS - PlantillasMailPage.jsx
// ruta: bookos/frontend/src/pages/PlantillasMailPage.jsx
// descripcion: editor de los mails que manda el sistema (CRM > Plantillas mail). Lista de
//   plantillas con asunto y cuerpo editables, variables que se insertan en el cursor, vista
//   previa en vivo con datos de ejemplo, envio de prueba real y el manual de variables.

import { useEffect, useRef, useState } from 'react';
import DebugTag from '../ui/DebugTag';
import Input from '../ui/Input';
import { mailerApi, plantillasApi } from '../api/api';

export default function PlantillasMailPage() {
  const [plantillas, setPlantillas] = useState([]);
  const [manual, setManual] = useState(null);
  const [clave, setClave] = useState('');
  const [form, setForm] = useState({ asunto: '', cuerpo: '' });
  const [previa, setPrevia] = useState(null);
  const [pruebaA, setPruebaA] = useState('');
  const [mailer, setMailer] = useState(null);
  const [mensaje, setMensaje] = useState('');
  const [ocupado, setOcupado] = useState(false);
  const cuerpoRef = useRef(null);

  const actual = plantillas.find((p) => p.clave === clave) || null;
  const sucio = Boolean(actual) && (form.asunto !== actual.asunto || form.cuerpo !== actual.cuerpo);

  const cargar = async (clavePreferida) => {
    try {
      const res = await plantillasApi.listar();
      const lista = res.data.plantillas || [];
      setPlantillas(lista);
      setManual(res.data.manual);
      const elegida = clavePreferida || clave || (lista[0] && lista[0].clave);
      const p = lista.find((x) => x.clave === elegida) || lista[0];
      if (p) {
        setClave(p.clave);
        setForm({ asunto: p.asunto, cuerpo: p.cuerpo });
      }
    } catch (err) {
      setMensaje(`⚠️ ${err.message}`);
    }
  };

  useEffect(() => { cargar(); }, []); // eslint-disable-line

  useEffect(() => {
    mailerApi.estado()
      .then((res) => {
        setMailer(res.data);
        const email = String(res.data.from || res.data.user || '').match(/[\w.+-]+@[\w-]+\.[\w.]+/);
        setPruebaA((prev) => prev || (email ? email[0] : ''));
      })
      .catch(() => {});
  }, []);

  // Vista previa en vivo: se rearma sola mientras se edita (debounce), sin guardar nada.
  useEffect(() => {
    if (!clave || !form.cuerpo) return undefined;
    const t = setTimeout(() => {
      plantillasApi.previsualizar(clave, form)
        .then((res) => setPrevia(res.data))
        .catch(() => setPrevia(null));
    }, 600);
    return () => clearTimeout(t);
  }, [clave, form]); // eslint-disable-line

  const elegir = (p) => {
    setClave(p.clave);
    setForm({ asunto: p.asunto, cuerpo: p.cuerpo });
    setPrevia(null);
    setMensaje('');
  };

  const insertar = (variable) => {
    const texto = `{{${variable}}}`;
    const area = cuerpoRef.current;
    if (!area) {
      setForm((f) => ({ ...f, cuerpo: `${f.cuerpo}${texto}` }));
      return;
    }
    const ini = area.selectionStart == null ? form.cuerpo.length : area.selectionStart;
    const fin = area.selectionEnd == null ? ini : area.selectionEnd;
    const nuevo = form.cuerpo.slice(0, ini) + texto + form.cuerpo.slice(fin);
    setForm((f) => ({ ...f, cuerpo: nuevo }));
    requestAnimationFrame(() => {
      area.focus();
      const pos = ini + texto.length;
      area.setSelectionRange(pos, pos);
    });
  };

  const guardar = async () => {
    if (!clave) return;
    setOcupado(true);
    setMensaje('');
    try {
      const res = await plantillasApi.guardar(clave, form);
      setPlantillas((lista) => lista.map((p) => (p.clave === clave ? res.data : p)));
      setMensaje('✓ Plantilla guardada: los próximos mails salen con este texto.');
    } catch (err) {
      setMensaje(`⚠️ ${err.message}`);
    } finally {
      setOcupado(false);
    }
  };

  const probar = async () => {
    if (!clave || !pruebaA) return;
    setOcupado(true);
    setMensaje('');
    try {
      const res = await plantillasApi.probar(clave, { destinatario: pruebaA, ...form });
      setMensaje(`✓ ${res.message || `Prueba enviada a ${pruebaA}`}`);
    } catch (err) {
      setMensaje(`⚠️ ${err.message}`);
    } finally {
      setOcupado(false);
    }
  };

  const revertir = () => {
    if (!actual) return;
    setForm({ asunto: actual.asunto, cuerpo: actual.cuerpo });
    setMensaje('');
  };

  const variablesDe = (p) => [...(p && p.variables ? p.variables : []), ...(manual ? manual.variables : [])];

  return (
    <div>
      <DebugTag nombre="PlantillasMailPage" />
      <h2 className="text-lg font-semibold mb-1">Plantillas de mail</h2>
      <p className="text-sm text-muted mb-4">
        El asunto y el cuerpo de los mails que manda el sistema. Se editan acá y salen así, sin tocar
        código: lo que no sea una variable se envía tal cual. Las variables se completan solas al enviar.
      </p>
      {mensaje && <p className="text-sm mb-3">{mensaje}</p>}
      {mailer && mailer.redirigirA ? (
        <p className="text-xs mb-3" style={{ color: '#b45309', fontWeight: 600 }}>
          ⚠️ MODO PRUEBA activo: las pruebas y los mails reales van a <span className="font-mono">{mailer.redirigirA}</span>. Se apaga en CRM ▾ → Config CRM.
        </p>
      ) : null}

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        <div className="lg:col-span-1">
          <div className="card p-3">
            <h3 className="font-semibold mb-2 text-sm">Mails del sistema</h3>
            <div className="space-y-1">
              {plantillas.map((p) => (
                <button
                  key={p.clave}
                  type="button"
                  className="w-full text-left p-2 rounded"
                  style={{
                    background: p.clave === clave ? 'var(--accent-soft, rgba(0,0,0,0.06))' : 'transparent',
                    border: '1px solid var(--border, rgba(0,0,0,0.1))',
                  }}
                  onClick={() => elegir(p)}
                >
                  <span className="text-sm font-semibold block">{p.nombre}</span>
                  <span className="text-xs text-muted font-mono">{p.clave}</span>
                  {p.editada ? <span className="agente-badge ml-2">editada</span> : null}
                </button>
              ))}
              {!plantillas.length && <p className="text-xs text-muted">Cargando plantillas...</p>}
            </div>
          </div>
        </div>

        <div className="lg:col-span-2">
          <div className="card p-4">
            {actual ? (
              <>
                <div className="flex items-center gap-2 flex-wrap mb-2">
                  <h3 className="font-semibold">{actual.nombre}</h3>
                  <span className="text-xs text-muted font-mono">{actual.clave}</span>
                  {sucio ? <span className="agente-badge" style={{ color: '#b45309' }}>sin guardar</span> : null}
                </div>
                <p className="text-xs text-muted mb-3">{actual.descripcion}</p>

                <Input
                  label="Asunto"
                  value={form.asunto}
                  onChange={(e) => setForm({ ...form, asunto: e.target.value })}
                  placeholder="Asunto del mail (acepta variables)"
                />

                <label className="block mb-2">
                  <span className="block text-xs uppercase tracking-widest text-muted mb-1">Cuerpo</span>
                  <textarea
                    ref={cuerpoRef}
                    className="input-os font-mono resize-y"
                    rows={14}
                    value={form.cuerpo}
                    onChange={(e) => setForm({ ...form, cuerpo: e.target.value })}
                  />
                </label>

                <div className="mb-3">
                  <p className="text-xs uppercase tracking-widest text-muted mb-1">Variables (click para insertar en el cursor)</p>
                  <div className="lista-chips">
                    {(actual.variables || []).map((v) => (
                      <button key={v.clave} type="button" className="chip-afinidad" title={`${v.descripcion} · ej: ${v.ejemplo || ''}`} onClick={() => insertar(v.clave)}>
                        {`{{${v.clave}}}`}
                      </button>
                    ))}
                    {(manual ? manual.variables : []).map((v) => (
                      <button key={v.clave} type="button" className="chip-tema" title={`${v.descripcion} · ej: ${v.ejemplo || ''}`} onClick={() => insertar(v.clave)}>
                        {`{{${v.clave}}}`}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex items-end gap-2 flex-wrap">
                  <button type="button" className="btn btn-primary text-sm" disabled={ocupado || !sucio} onClick={guardar}>Guardar</button>
                  <button type="button" className="btn text-sm" disabled={ocupado || !sucio} onClick={revertir}>Descartar cambios</button>
                  <label className="text-sm flex-1 min-w-[200px]">
                    <span className="field-label">Probar este mail a</span>
                    <input className="input-os" value={pruebaA} onChange={(e) => setPruebaA(e.target.value)} placeholder="destino@ejemplo.com" />
                  </label>
                  <button type="button" className="btn text-sm" disabled={ocupado || !pruebaA} onClick={probar}>Enviar prueba</button>
                </div>
                <p className="text-xs text-muted mt-2">La prueba manda el texto que ves acá (aunque no lo hayas guardado) y respeta el MODO PRUEBA del mailer.</p>
              </>
            ) : (
              <p className="text-muted text-sm">Cargando...</p>
            )}
          </div>
        </div>

        <div className="lg:col-span-1">
          <div className="card p-4">
            <h3 className="font-semibold mb-2 text-sm">Vista previa</h3>
            {previa ? (
              <>
                <p className="text-xs text-muted mb-1">Asunto</p>
                <p className="text-sm font-semibold mb-3">{previa.asunto}</p>
                <p className="text-xs text-muted mb-1">Cuerpo</p>
                <pre className="text-xs whitespace-pre-wrap" style={{ fontFamily: 'inherit' }}>{previa.cuerpo}</pre>
                {previa.sinValor && previa.sinValor.length ? (
                  <p className="text-xs mt-3" style={{ color: '#b45309' }}>
                    Sin dato en este envío: {previa.sinValor.map((v) => `{{${v}}}`).join(', ')}
                  </p>
                ) : null}
                <p className="text-xs text-muted mt-3">Se arma con datos de ejemplo: en el envío real cada variable trae su valor.</p>
              </>
            ) : (
              <p className="text-xs text-muted">Escribí algo en el cuerpo para ver el mail terminado.</p>
            )}
          </div>
        </div>
      </div>

      <div className="card p-4 mt-4">
        <h3 className="font-semibold mb-1">Manual de variables</h3>
        <p className="text-xs text-muted mb-3">Cómo se escriben y de dónde sale cada dato. Nada de esto hay que recordarlo: se inserta con un click.</p>
        {manual ? (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <h4 className="text-sm font-semibold mb-1">Cómo se escriben</h4>
                <ul className="text-xs text-muted" style={{ listStyle: 'disc', paddingLeft: 18 }}>
                  {manual.sintaxis.map((s) => <li key={s} className="mb-1">{s}</li>)}
                </ul>
              </div>
              <div>
                <h4 className="text-sm font-semibold mb-1">Consejos</h4>
                <ul className="text-xs text-muted" style={{ listStyle: 'disc', paddingLeft: 18 }}>
                  {manual.consejos.map((s) => <li key={s} className="mb-1">{s}</li>)}
                </ul>
              </div>
            </div>
            <h4 className="text-sm font-semibold mt-4 mb-2">Variables de empresa y fecha (sirven en todas las plantillas)</h4>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-left text-muted">
                    <th className="py-1 pr-3">Variable</th>
                    <th className="py-1 pr-3">Qué es</th>
                    <th className="py-1 pr-3">Ejemplo</th>
                    <th className="py-1">Insertar</th>
                  </tr>
                </thead>
                <tbody>
                  {manual.variables.map((v) => (
                    <tr key={v.clave} style={{ borderTop: '1px solid var(--border, rgba(0,0,0,0.08))' }}>
                      <td className="py-1 pr-3 font-mono">{`{{${v.clave}}}`}</td>
                      <td className="py-1 pr-3">{v.descripcion}</td>
                      <td className="py-1 pr-3 text-muted whitespace-pre-wrap">{v.ejemplo}</td>
                      <td className="py-1">
                        <button type="button" className="btn btn-ghost text-xs" onClick={() => insertar(v.clave)}>Insertar</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-xs text-muted mt-2">
              Los datos de empresa se cargan una sola vez en Sistema ▾ → Empresa; acá se usan. Si querés un membrete
              que no sale de esos campos (instagram, horarios, un lema), escribilo derecho en el cuerpo.
            </p>
          </>
        ) : (
          <p className="text-xs text-muted">Cargando manual...</p>
        )}
      </div>

      {actual ? (
        <p className="text-xs text-muted mt-3">
          Las variables se insertan con un click y se completan solas al enviar: {variablesDe(actual).length} disponibles para{' '}
          <span className="font-mono">{actual.clave}</span>.
        </p>
      ) : null}
    </div>
  );
}
