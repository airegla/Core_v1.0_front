// BookOS - CampaniasPage.jsx
// ruta: bookos/frontend/src/pages/CampaniasPage.jsx
// descripcion: campañas del CRM (doc 06 D7). Historial de campañas con su configuración y estado,
//   alta (brief + cantidad de títulos + segmento + vigencia), generación de los borradores por
//   lotes (el asistente arma un mail por cliente con títulos en stock), revisión práctica
//   (aprobar / rechazar de a una o todas) y envío de lo aprobado, respetando el MODO PRUEBA.

import { useEffect, useState } from 'react';
import DebugTag from '../ui/DebugTag';
import Modal from '../ui/Modal';
import SelectBuscador from '../ui/SelectBuscador';
import BorradorRestaurado from '../ui/BorradorRestaurado';
import usePersistentWork from '../hooks/usePersistentWork';
import { buscarMaterias, buscarClientes } from '../utils/selectores';
import { campaniasApi, crmApi } from '../api/api';

const ESTADO_COLOR = {
  BORRADOR: 'var(--muted, #6b7280)',
  GENERANDO: '#b45309',
  GENERADA: '#1d4ed8',
  ENVIANDO: '#b45309',
  ENVIADA: '#15803d',
  DESCARTADA: 'var(--danger, #b91c1c)',
};

export default function CampaniasPage() {
  const [campanias, setCampanias] = useState([]);
  const [seleccionada, setSeleccionada] = useState(null);
  const [detalle, setDetalle] = useState(null);
  const [perfiles, setPerfiles] = useState([]);
  const [materiaNombre, setMateriaNombre] = useState('');
  const [abiertaPropuesta, setAbiertaPropuesta] = useState(null);
  const [historialAbierto, setHistorialAbierto] = useState(false);
  const [mensaje, setMensaje] = useState('');
  const [ocupado, setOcupado] = useState('');
  // BORRADOR PERSISTENTE: la campana a medio armar (con su segmento elegido) sobrevive al refresco.
  const [form, setForm, limpiarForm, formRestaurado] = usePersistentWork('campania_nueva', {
    nombre: '',
    brief: '',
    cantidadTitulos: 5,
    segmentoTipo: 'perfil',
    perfil: '',
    materia: '',
    // Segmento personalizado: los clientes elegidos con el buscador (no ids tipeados a mano).
    clientes: [],
    menosDias: '',
    limiteClientes: '',
    desde: '',
    hasta: '',
  });

  const cargarLista = async (idPreferido) => {
    try {
      const res = await campaniasApi.listar({ limit: 50 });
      const lista = res.data.campanias || [];
      setCampanias(lista);
      const id = idPreferido || seleccionada || (lista[0] && lista[0].campaniaId);
      if (id) seleccionar(id);
    } catch (err) { setMensaje(`⚠️ ${err.message}`); }
  };

  const seleccionar = async (id) => {
    setSeleccionada(id);
    setAbiertaPropuesta(null);
    try {
      const res = await campaniasApi.detalle(id);
      setDetalle(res.data);
    } catch (err) { setMensaje(`⚠️ ${err.message}`); }
  };

  useEffect(() => {
    cargarLista();
    crmApi.perfiles().then((res) => {
      const lista = res.data || [];
      setPerfiles(lista);
      setForm((f) => ({ ...f, perfil: f.perfil || (lista[0] ? lista[0].clave : '') }));
    }).catch(() => {});
  }, []); // eslint-disable-line

  const valoresSegmento = () => {
    if (form.segmentoTipo === 'perfil') return form.perfil ? [form.perfil] : [];
    if (form.segmentoTipo === 'tematica') return form.materia ? [Number(form.materia)] : [];
    return (form.clientes || []).map((c) => Number(c.id)).filter((n) => Number.isInteger(n) && n > 0);
  };

  const crear = async () => {
    const valores = valoresSegmento();
    if (!form.nombre.trim()) { setMensaje('⚠️ Poné un nombre a la campaña'); return; }
    if (!valores.length) { setMensaje('⚠️ Elegí a qué clientes apunta (perfil, materia o ids de cliente)'); return; }
    setOcupado('crear');
    setMensaje('');
    try {
      const res = await campaniasApi.crear({
        nombre: form.nombre,
        brief: form.brief,
        cantidadTitulos: Number(form.cantidadTitulos) || 5,
        segmento: {
          tipo: form.segmentoTipo,
          valores,
          ...(form.menosDias ? { menosDias: Number(form.menosDias) } : {}),
          ...(form.limiteClientes ? { limite: Number(form.limiteClientes) } : {}),
        },
        desde: form.desde || null,
        hasta: form.hasta || null,
      });
      setMensaje('✓ Campaña creada. Ahora generá los borradores y revisalos.');
      limpiarForm();
      await cargarLista(res.data.campaniaId);
    } catch (err) { setMensaje(`⚠️ ${err.message}`); } finally { setOcupado(''); }
  };

  const verSegmento = async () => {
    if (!seleccionada) return;
    setOcupado('segmento');
    try {
      const res = await campaniasApi.segmento(seleccionada);
      const d = res.data;
      setMensaje(`Segmento: ${d.clientes} cliente(s) con email${d.sinTematicas ? ` · ${d.sinTematicas} sin temáticas (no se les genera)` : ''}.`);
    } catch (err) { setMensaje(`⚠️ ${err.message}`); } finally { setOcupado(''); }
  };

  // Generacion por lotes: cada cliente es una llamada al modelo, asi que se repite hasta que no
  // queden pendientes (con tope de vueltas para no quedar en loop si algo falla).
  const generar = async () => {
    if (!seleccionada) return;
    setOcupado('generar');
    setMensaje('Generando borradores...');
    try {
      let vueltas = 0;
      let total = 0;
      let ultimo = null;
      for (;;) {
        const res = await campaniasApi.generar(seleccionada, { limite: 3 });
        ultimo = res.data;
        total += ultimo.generadas;
        vueltas += 1;
        setMensaje(`Generando borradores... ${total} listos${ultimo.pendientes ? `, quedan ${ultimo.pendientes}` : ''}`);
        if (ultimo.listo || ultimo.pendientes === 0 || vueltas >= 12) break;
      }
      setMensaje(`✓ ${total} borrador(es) generados${ultimo && ultimo.sinTematicas ? ` · ${ultimo.sinTematicas} cliente(s) sin temáticas quedaron afuera` : ''}. Revisalos y aprobá los que quieras mandar.`);
      await cargarLista(seleccionada);
    } catch (err) { setMensaje(`⚠️ ${err.message}`); } finally { setOcupado(''); }
  };

  const revisar = async (propuestaId, accion) => {
    setOcupado(`revisar-${propuestaId}`);
    try {
      await campaniasApi.revisar(seleccionada, propuestaId, { accion });
      await seleccionar(seleccionada);
      await cargarLista(seleccionada);
      setMensaje(accion === 'aprobar' ? '✓ Propuesta aprobada (todavía no se envió)' : '✓ Propuesta descartada');
    } catch (err) { setMensaje(`⚠️ ${err.message}`); } finally { setOcupado(''); }
  };

  const revisarTodas = async (accion) => {
    setOcupado('revisar-todas');
    try {
      const res = await campaniasApi.revisarTodas(seleccionada, { accion });
      const n = accion === 'aprobar' ? res.data.aprobadas : res.data.descartadas;
      setMensaje(`✓ ${n} propuesta(s) ${accion === 'aprobar' ? 'aprobadas' : 'descartadas'}`);
      await seleccionar(seleccionada);
      await cargarLista(seleccionada);
    } catch (err) { setMensaje(`⚠️ ${err.message}`); } finally { setOcupado(''); }
  };

  const enviar = async (propuestaId) => {
    const aprobadas = detalle ? (detalle.porEstado.APROBADA || 0) : 0;
    const cuantos = propuestaId ? 1 : aprobadas;
    if (!cuantos) { setMensaje('⚠️ No hay propuestas aprobadas para enviar'); return; }
    const confirmado = window.confirm(`Se van a enviar ${cuantos} mail(s) a clientes reales (respeta el MODO PRUEBA del mailer). ¿Confirmás?`);
    if (!confirmado) return;
    setOcupado('enviar');
    setMensaje('Enviando...');
    try {
      const res = await campaniasApi.enviar(seleccionada, { propuestaId });
      const d = res.data;
      setMensaje(`✓ ${d.enviadas} mail(s) enviado(s)${d.errores ? ` · ${d.errores} con error` : ''}${d.quedanAprobadas ? ` · quedan ${d.quedanAprobadas} aprobadas` : ''}`);
      await seleccionar(seleccionada);
      await cargarLista(seleccionada);
    } catch (err) { setMensaje(`⚠️ ${err.message}`); } finally { setOcupado(''); }
  };

  const descartar = async () => {
    if (!window.confirm('¿Descartar la campaña? Queda en el historial como descartada y no se puede enviar.')) return;
    setOcupado('descartar');
    try {
      await campaniasApi.descartar(seleccionada);
      setMensaje('✓ Campaña descartada');
      await cargarLista(seleccionada);
    } catch (err) { setMensaje(`⚠️ ${err.message}`); } finally { setOcupado(''); }
  };

  const c = detalle ? detalle.campania : null;
  const porEstado = detalle ? detalle.porEstado : {};
  const propuestas = detalle ? detalle.propuestas : [];

  return (
    <div>
      <DebugTag nombre="CampaniasPage" />
      <div className="flex items-center justify-between mb-1">
        <h2 className="text-lg font-semibold">Campañas</h2>
        <div className="flex items-center gap-2">
          <BorradorRestaurado visible={formRestaurado} onLimpiar={limpiarForm} />
          <button type="button" className="btn btn-ghost text-xs" onClick={() => setHistorialAbierto(true)}>Historial</button>
        </div>
      </div>
      <p className="text-sm text-muted mb-4">
        Un lote de mails para un grupo de clientes: el asistente arma una propuesta con títulos en stock para
        cada uno, vos revisás y aprobás, y recién ahí sale el envío. Todo queda en el historial.
      </p>
      {mensaje && <p className="text-sm mb-3">{mensaje}</p>}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-1 space-y-4">
          <div className="card p-4">
            <h3 className="font-semibold mb-3">Nueva campaña</h3>
            <label className="block mb-2">
              <span className="field-label">Nombre</span>
              <input className="input-os" value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} placeholder="Navidad 2026" />
            </label>
            <label className="block mb-2">
              <span className="field-label">Brief (contexto para el asistente)</span>
              <textarea className="input-os resize-none" rows={3} value={form.brief} onChange={(e) => setForm({ ...form, brief: e.target.value })} placeholder="Es para Navidad: 20% en infantil, cupón en la web, del 1 al 15." />
            </label>
            <div className="grid grid-cols-2 gap-2">
              <label className="block mb-2">
                <span className="field-label">Títulos por cliente</span>
                <input className="input-os" type="number" min="1" max="20" value={form.cantidadTitulos} onChange={(e) => setForm({ ...form, cantidadTitulos: e.target.value })} />
              </label>
              <label className="block mb-2">
                <span className="field-label">No compran hace (días)</span>
                <input className="input-os" type="number" min="0" value={form.menosDias} onChange={(e) => setForm({ ...form, menosDias: e.target.value })} placeholder="opcional" />
              </label>
            </div>
            <label className="block mb-2">
              <span className="field-label">A quiénes apunta</span>
              <select className="input-os" value={form.segmentoTipo} onChange={(e) => setForm({ ...form, segmentoTipo: e.target.value })}>
                <option value="perfil">Por perfil (lectura de entrada)</option>
                <option value="tematica">Por temática del catálogo</option>
                <option value="clientes">Por clientes puntuales (elegidos con el buscador)</option>
              </select>
            </label>
            {form.segmentoTipo === 'perfil' && (
              <label className="block mb-2">
                <span className="field-label">Perfil</span>
                <select className="input-os" value={form.perfil} onChange={(e) => setForm({ ...form, perfil: e.target.value })}>
                  <option value="">Elegir...</option>
                  {perfiles.map((p) => <option key={p.clave} value={p.clave}>{p.etiqueta} ({p.materias.length} materias)</option>)}
                </select>
              </label>
            )}
            {form.segmentoTipo === 'tematica' && (
              <label className="block mb-2">
                <span className="field-label">Materia</span>
                <SelectBuscador
                  valor={form.materia || null}
                  etiquetaValor={materiaNombre}
                  placeholder="Buscar materia..."
                  buscar={buscarMaterias}
                  onSeleccionar={(it) => { setForm({ ...form, materia: it ? it.id : '' }); setMateriaNombre(it ? it.etiqueta : ''); }}
                />
              </label>
            )}
            {form.segmentoTipo === 'clientes' && (
              <div className="mb-2">
                <span className="field-label">Clientes del envío</span>
                <SelectBuscador
                  valor={null}
                  etiquetaValor=""
                  placeholder="Buscar cliente por nombre, mail o documento..."
                  buscar={buscarClientes}
                  onSeleccionar={(it) => {
                    if (!it) return;
                    setForm((f) => (f.clientes.some((c) => c.id === it.id) ? f : { ...f, clientes: [...f.clientes, { id: it.id, nombre: it.nombre || it.etiqueta }] }));
                  }}
                />
                <div className="flex flex-wrap gap-1 mt-2">
                  {!(form.clientes || []).length && <span className="text-xs text-muted">Todavía no elegiste clientes.</span>}
                  {(form.clientes || []).map((c) => (
                    <span key={c.id} className="chip-tema">
                      {c.nombre}
                      <button type="button" className="ml-1" onClick={() => setForm((f) => ({ ...f, clientes: f.clientes.filter((x) => x.id !== c.id) }))}>✕</button>
                    </span>
                  ))}
                </div>
                {(form.clientes || []).length > 0 && <p className="text-xs text-muted mt-1">{(form.clientes || []).length} cliente(s) en el envío.</p>}
              </div>
            )}
            <div className="grid grid-cols-2 gap-2">
              <label className="block mb-2">
                <span className="field-label">Vigencia desde</span>
                <input className="input-os" type="date" value={form.desde} onChange={(e) => setForm({ ...form, desde: e.target.value })} />
              </label>
              <label className="block mb-2">
                <span className="field-label">Hasta</span>
                <input className="input-os" type="date" value={form.hasta} onChange={(e) => setForm({ ...form, hasta: e.target.value })} />
              </label>
            </div>
            <label className="block mb-3">
              <span className="field-label">Tope de clientes</span>
              <input className="input-os" type="number" min="1" value={form.limiteClientes} onChange={(e) => setForm({ ...form, limiteClientes: e.target.value })} placeholder="opcional" />
            </label>
            <button type="button" className="btn btn-primary text-sm" disabled={ocupado === 'crear'} onClick={crear}>Crear campaña</button>
          </div>

          <Modal abierto={historialAbierto} onClose={() => setHistorialAbierto(false)} titulo="Historial de campañas" ancho="620px"
            footer={<button type="button" className="btn btn-primary" onClick={() => setHistorialAbierto(false)}>Cerrar</button>}
          >
            <div className="space-y-1" style={{ maxHeight: 420, overflowY: 'auto' }}>
              {campanias.map((k) => (
                <button
                  key={k.campaniaId}
                  type="button"
                  className="w-full text-left p-2 rounded"
                  style={{ background: k.campaniaId === seleccionada ? 'var(--bg-soft)' : 'transparent', border: '1px solid var(--border)' }}
                  onClick={() => { seleccionar(k.campaniaId); setHistorialAbierto(false); }}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-semibold">{k.nombre}</span>
                    <span className="text-xs" style={{ color: ESTADO_COLOR[k.estado] || 'inherit', fontWeight: 600 }}>{k.estado}</span>
                  </div>
                  <div className="text-xs text-muted">
                    {k.clientes} cliente(s) · {k.propuestas ? Object.entries(k.propuestas).map(([e, n]) => `${e.toLowerCase()} ${n}`).join(' · ') : 'sin borradores'}
                  </div>
                </button>
              ))}
              {!campanias.length && <p className="text-xs text-muted">Todavía no hay campañas. Creá la primera.</p>}
            </div>
          </Modal>
        </div>

        <div className="lg:col-span-2">
          <div className="card p-4">
            {!c ? (
              <p className="text-sm text-muted">Elegí una campaña del historial (o creá una nueva) para ver su configuración y revisar los mails.</p>
            ) : (
              <>
                <div className="flex items-center gap-2 flex-wrap mb-1">
                  <h3 className="font-semibold">{c.nombre}</h3>
                  <span className="agente-badge" style={{ color: ESTADO_COLOR[c.estado] }}>{c.estado}</span>
                  <span className="text-xs text-muted">{c.clientes} cliente(s) en el segmento</span>
                </div>
                <p className="text-xs text-muted mb-2">
                  {c.segmento ? `${c.segmento.tipo}: ${(c.segmento.valores || []).join(', ')}` : ''}
                  {c.segmento && c.segmento.menosDias ? ` · sin comprar hace ${c.segmento.menosDias} días` : ''}
                  {c.desde || c.hasta ? ` · vigencia ${c.desde ? new Date(c.desde).toLocaleDateString('es-AR') : '...'} a ${c.hasta ? new Date(c.hasta).toLocaleDateString('es-AR') : '...'}` : ''}
                  {` · ${c.cantidadTitulos} títulos por cliente · plantilla ${c.plantillaClave}`}
                </p>
                {c.brief && <p className="text-sm mb-2" style={{ background: 'var(--bg-soft)', padding: 8, borderRadius: 8 }}>{c.brief}</p>}
                <div className="flex gap-2 flex-wrap mb-3">
                  <span className="chip-afinidad">borradores {porEstado.BORRADOR || 0}</span>
                  <span className="chip-tema">aprobadas {porEstado.APROBADA || 0}</span>
                  <span className="chip-tema">enviadas {porEstado.ENVIADA || 0}</span>
                  <span className="chip-tema">descartadas {porEstado.DESCARTADA || 0}</span>
                  {detalle.pendientesDeGenerar ? <span className="chip-tema">sin generar {detalle.pendientesDeGenerar}</span> : null}
                </div>

                <div className="flex gap-2 flex-wrap mb-4">
                  <button type="button" className="btn text-sm" disabled={ocupado === 'segmento'} onClick={verSegmento}>Ver segmento</button>
                  <button type="button" className="btn btn-primary text-sm" disabled={ocupado === 'generar' || c.estado === 'ENVIADA' || c.estado === 'DESCARTADA'} onClick={generar}>
                    {ocupado === 'generar' ? 'Generando...' : detalle.pendientesDeGenerar ? `Generar borradores (${detalle.pendientesDeGenerar})` : 'Generar borradores'}
                  </button>
                  <button type="button" className="btn text-sm" disabled={!porEstado.BORRADOR} onClick={() => revisarTodas('aprobar')}>Aprobar todas</button>
                  <button type="button" className="btn text-sm" disabled={!(porEstado.BORRADOR || porEstado.APROBADA)} onClick={() => revisarTodas('rechazar')}>Rechazar todas</button>
                  <button type="button" className="btn btn-primary text-sm" disabled={!porEstado.APROBADA} onClick={() => enviar(null)}>Enviar aprobadas ({porEstado.APROBADA || 0})</button>
                  <button type="button" className="btn btn-ghost text-sm" disabled={c.estado === 'ENVIADA' || c.estado === 'DESCARTADA'} onClick={descartar}>Descartar campaña</button>
                </div>

                {propuestas.length ? (
                  <div className="space-y-2">
                    {propuestas.map((p) => (
                      <div key={p.propuestaId} className="card p-3">
                        <div className="flex items-center justify-between gap-2 flex-wrap">
                          <div>
                            <span className="text-sm font-semibold">{p.cliente}</span>
                            <span className="text-xs text-muted"> · {p.email} · {p.titulos} título(s)</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="agente-badge" style={{ color: ESTADO_COLOR[p.estado] || 'inherit' }}>{p.estado}</span>
                            {p.estado === 'BORRADOR' && (
                              <>
                                <button type="button" className="btn text-xs" disabled={ocupado === `revisar-${p.propuestaId}`} onClick={() => revisar(p.propuestaId, 'aprobar')}>Aprobar</button>
                                <button type="button" className="btn btn-ghost text-xs" disabled={ocupado === `revisar-${p.propuestaId}`} onClick={() => revisar(p.propuestaId, 'rechazar')}>Rechazar</button>
                              </>
                            )}
                            {p.estado === 'APROBADA' && (
                              <>
                                <button type="button" className="btn btn-primary text-xs" disabled={ocupado === 'enviar'} onClick={() => enviar(p.propuestaId)}>Enviar</button>
                                <button type="button" className="btn btn-ghost text-xs" onClick={() => revisar(p.propuestaId, 'rechazar')}>Rechazar</button>
                              </>
                            )}
                            <button type="button" className="btn btn-ghost text-xs" onClick={() => setAbiertaPropuesta(abiertaPropuesta === p.propuestaId ? null : p.propuestaId)}>
                              {abiertaPropuesta === p.propuestaId ? 'Ocultar mail' : 'Ver mail'}
                            </button>
                          </div>
                        </div>
                        {p.errorEnvio && <p className="text-xs mt-1" style={{ color: 'var(--danger)' }}>Error de envío: {p.errorEnvio}</p>}
                        {abiertaPropuesta === p.propuestaId && (
                          <div className="mt-2">
                            <p className="text-xs text-muted">Asunto</p>
                            <p className="text-sm font-semibold mb-2">{p.asunto}</p>
                            <pre className="text-xs whitespace-pre-wrap" style={{ fontFamily: 'inherit', background: 'var(--bg-soft)', padding: 8, borderRadius: 8 }}>{p.cuerpo}</pre>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted">Todavía no hay borradores: usá “Generar borradores”.</p>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
