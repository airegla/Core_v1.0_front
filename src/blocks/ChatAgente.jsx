// BookOS - ChatAgente.jsx
// ruta: bookos/frontend/src/blocks/ChatAgente.jsx
// descripcion: chat del agente, reutilizable por perfil. El Secretario (panel lateral) y el
//   Asistente de ventas (la ventana izquierda del Vendedor) comparten este componente: mismo motor, misma
//   conversacion persistente y mismo render del envelope; cambia la semilla/tools del backend
//   (perfil) y el texto de arranque. Tres zonas: cabecera fija, mensajes con scroll y entrada.
//   Bajo la respuesta viaja el voto del turno (pulgar + escala, plan-rediseno/11 E3): el operario
//   manda sobre cualquier inferencia del evaluador.
//   18-Sep-2026: (a) el scroll SIGUE al agente —cada mensaje y cada pedazo de texto en streaming
//   se ven sin tocar nada— salvo que el operario haya subido a leer algo: ahi no se lo arrastra;
//   (b) VOZ con lo nativo del navegador (hooks/useVoz.js): micro para dictar el pedido y lectura en
//   voz alta, que se activa sola SOLO si el pedido vino por micro (mas un boton 🔊 por respuesta);
//   (c) IMAGENES: se pueden adjuntar fotos y capturas (el modelo las mira, ver agente.service).

import { useCallback, useEffect, useRef, useState } from 'react';
import useAgenteStream from '../hooks/useAgenteStream';
import useVoz from '../hooks/useVoz';
import { useAppContext } from '../AppContext';
import { descargarDesdeServidor, descargarCsv } from '../utils/exportar';
import { agenteApi } from '../api/api';

const money = (n) => `$${Number(n || 0).toLocaleString('es-AR')}`;

// Resumen legible del contexto de pantalla (el JSON completo viaja en el title del badge). Las DOS
// ventanas llevan el MISMO contexto: es la PANTALLA, no el agente.
function resumenContexto(c) {
  if (!c || typeof c !== 'object') return 'pantalla';
  if (c.nombre) return `cliente ${c.nombre}`;
  if (c.ventaId) return `venta #${c.ventaId}`;
  if (c.remitoId) return `remito #${c.remitoId}`;
  if (c.compraId) return `compra #${c.compraId}`;
  if (c.clienteId) return `cliente #${c.clienteId}`;
  if (c.vista) return `vista ${c.vista}`;
  return 'pantalla';
}

// Claves habituales donde las tools devuelven listas (E5).
const CLAVES_LISTA = ['items', 'articulos', 'resultados', 'filas', 'movimientos', 'ventas', 'compras',
  'clientes', 'proveedores', 'remitos', 'pedidos', 'devoluciones', 'liquidaciones', 'transferencias',
  'suscripciones', 'usuarios', 'marcadores', 'entradas', 'lotes', 'componentes',
  // marcadores y agrupados del catalogo: $ayuda y $editoriales
  'ayuda', 'editoriales', 'materias',
  // $llm (reflexion del entorno): listas de la devolucion sobre las herramientas
  'propuestas', 'confusas', 'fricciones', 'utiles', 'grupos'];

// Filas visibles antes de ofrecer "ver mas": se muestran de a tandas, sin cortar el dato.
const TANDA = 25;

function primeraLista(data) {
  if (!data || typeof data !== 'object') return null;
  for (const clave of CLAVES_LISTA) {
    if (Array.isArray(data[clave])) return { clave, lista: data[clave] };
  }
  return null;
}

function etiquetaItem(item) {
  if (item == null) return '(sin dato)';
  if (typeof item !== 'object') return String(item);
  return item.comando || item.titulo || item.nombre || item.descripcion || item.label || item.clave
    || item.herramienta || item.email || item.codigo || item.tipo || `#${item.id != null ? item.id : '?'}`;
}

function detalleItem(item) {
  if (item == null || typeof item !== 'object') return '';
  // Comandos de $ayuda: el detalle es la descripcion.
  if (item.comando) return item.descripcion || '';
  const partes = [];
  if (item.precio != null || item.precioLista != null) partes.push(money(item.precioLista != null ? item.precioLista : item.precio));
  if (item.stock != null || item.stockFirme != null) partes.push(`stock ${item.stockFirme != null ? item.stockFirme : item.stock}`);
  if (item.cantidad != null) partes.push(`${item.cantidad} un.`);
  if (item.unidades != null) partes.push(`${item.unidades} un.`);
  if (item.comprobantes != null) partes.push(`${item.comprobantes} comp.`);
  if (item.tickets != null) partes.push(`${item.tickets} tk`);
  if (item.total != null && item.precio == null) partes.push(money(item.total));
  if (item.importe != null) partes.push(money(item.importe));
  if (item.saldo != null) partes.push(`saldo ${money(item.saldo)}`);
  if (item.clasificacion) partes.push(item.clasificacion);
  if (!partes.length) {
    // Objetos sin campos conocidos (p. ej. la devolucion de $llm: {herramienta, problema, arreglo}):
    // se muestran sus valores en linea en vez de un "#?" sin informacion.
    return Object.entries(item)
      .filter(([, v]) => v != null && typeof v !== 'object')
      .map(([k, v]) => `${k}: ${String(v).slice(0, 90)}`)
      .join(' · ')
      .slice(0, 260);
  }
  return partes.join(' · ');
}

function BotonDescarga({ descarga }) {
  if (!descarga) return null;
  const manejar = () => {
    descargarDesdeServidor(`/archivos/${descarga.archivoId}/descarga`, descarga.nombre).catch(() => {});
  };
  return (
    <button type="button" className="btn btn-primary text-xs mt-2" onClick={manejar}>
      ⬇ Descargar {descarga.nombre || 'CSV'}
    </button>
  );
}

// Listado: se muestra de a tandas con un boton "ver mas" en lugar de cortar el resultado. El
// corte duro (primeros 8) era una de las dos causas de que el operario viera todo truncado.
function ListaEnvelope({ lista, total, descarga }) {
  const [visibles, setVisibles] = useState(TANDA);
  const quedan = lista.length - visibles;
  return (
    <div>
      {total != null && <div className="text-xs text-muted mb-1">{Number(total).toLocaleString('es-AR')} resultado(s)</div>}
      {lista.slice(0, visibles).map((item, i) => (
        <div key={i} className="text-xs py-0.5 flex justify-between gap-2">
          <span className="truncate">{etiquetaItem(item)}</span>
          <span className="font-mono whitespace-nowrap">{detalleItem(item)}</span>
        </div>
      ))}
      {quedan > 0 && (
        <button type="button" className="btn text-xs mt-1" onClick={() => setVisibles((v) => v + TANDA)}>
          Ver {Math.min(TANDA, quedan)} más ({quedan} restantes)
        </button>
      )}
      <BotonDescarga descarga={descarga} />
    </div>
  );
}

// Etiqueta legible de una clave (mismo criterio que el texto de los canales sin tarjeta):
// porTipo -> "Por tipo". Las siglas quedan intactas.
function etiquetaClave(clave) {
  const t = String(clave || '')
    .replace(/_/g, ' ')
    .replace(/([a-z0-9])([A-Z])/g, (m, a, b) => `${a} ${b.toLowerCase()}`)
    .trim();
  return t.charAt(0).toUpperCase() + t.slice(1);
}

// Desgloses: las listas que NO son el listado principal (p. ej. `porTipo` del resumen de ventas:
// comprobantes e importe por tipo de comprobante). Antes no se pintaban en ningun canal.
function SubListas({ data, excluir }) {
  const grupos = Object.entries(data).filter(([k, v]) => k !== excluir && Array.isArray(v) && v.length > 0
    && typeof v[0] === 'object' && v[0] !== null);
  if (!grupos.length) return null;
  return (
    <div className="text-xs mt-1 space-y-0.5">
      {grupos.map(([clave, lista]) => (
        <div key={clave}>
          <div className="text-muted">{etiquetaClave(clave)}</div>
          {lista.slice(0, 10).map((item, i) => (
            <div key={i} className="flex justify-between gap-2">
              <span className="truncate">{etiquetaItem(item)}</span>
              <span className="font-mono whitespace-nowrap">{detalleItem(item)}</span>
            </div>
          ))}
          {lista.length > 10 && <div className="text-muted">(...y {lista.length - 10} más)</div>}
        </div>
      ))}
    </div>
  );
}

// Render legible del envelope E5/E6: { ok, data, meta, avisos, descarga }.
function BloqueEnvelope({ envelope }) {
  if (!envelope) return null;
  if (envelope.ok === false) {
    const e = envelope.error || {};
    return <div className="text-xs">⚠️ {e.mensaje || 'No se pudo completar la operación.'}</div>;
  }
  const data = envelope.data;
  if (data == null) return null;

  if (typeof data !== 'object') return <div className="text-xs">{String(data)}</div>;

  // Modos de los marcadores del kernel (catalogo/filtrado) y listados genericos.
  const lista = primeraLista(data);
  if (lista && lista.lista.length > 0) {
    return (
      <>
        <ListaEnvelope lista={lista.lista} total={data.total} descarga={envelope.descarga} />
        <SubListas data={data} excluir={lista.clave} />
      </>
    );
  }

  // Resumen comparativo (archivo_comparar) u objetos de conteo.
  const resumen = data.resumen && typeof data.resumen === 'object' ? data.resumen : null;
  if (resumen) {
    return (
      <div className="text-xs space-y-0.5">
        {Object.entries(resumen).map(([clave, valor]) => (
          <div key={clave} className="flex justify-between">
            <span className="text-muted">{clave}</span>
            <span className="font-mono">{typeof valor === 'number' ? valor.toLocaleString('es-AR') : String(valor)}</span>
          </div>
        ))}
        <BotonDescarga descarga={envelope.descarga} />
      </div>
    );
  }

  // Objeto plano de totales (resúmenes de ventas, remitos, caja...).
  const entradas = Object.entries(data).filter(([, v]) => v == null || typeof v !== 'object');
  if (entradas.length > 0 && !lista) {
    return (
      <div className="text-xs space-y-0.5">
        {entradas.slice(0, 40).map(([clave, valor]) => (
          <div key={clave} className="flex justify-between gap-2">
            <span className="text-muted">{clave}</span>
            <span className="font-mono">{typeof valor === 'number' ? valor.toLocaleString('es-AR') : String(valor == null ? '—' : valor)}</span>
          </div>
        ))}
        <SubListas data={data} excluir={null} />
        {envelope.avisos && envelope.avisos.length > 0 && (
          <div className="text-muted pt-1">{envelope.avisos.map((a, i) => <div key={i}>ℹ️ {a}</div>)}</div>
        )}
        <BotonDescarga descarga={envelope.descarga} />
      </div>
    );
  }

  // Ultimo recurso: el objeto completo, en un bloque con scroll. Antes se cortaba a 1200 chars,
  // que era la otra causa de "todo truncado".
  return (
    <>
      <pre className="text-xs overflow-auto" style={{ maxHeight: 320 }}>
        {JSON.stringify(data, null, 2)}
      </pre>
      {envelope.avisos && envelope.avisos.length > 0 && (
        <div className="text-xs text-muted">{envelope.avisos.map((a, i) => <div key={i}>ℹ️ {a}</div>)}</div>
      )}
      <BotonDescarga descarga={envelope.descarga} />
    </>
  );
}

// Tarjeta de pregunta del agente: confirmacion de escrituras o clarificacion de datos.
function PreguntaCard({ pregunta, resuelta, onConfirmar, onResponder, onDescartar }) {
  const esConfirmacion = pregunta.tipo === 'confirmacion';
  return (
    <div className="card p-3" style={{ borderColor: 'var(--accent)' }}>
      <div className="text-xs font-semibold mb-1">
        {esConfirmacion ? '🔒 Necesito tu confirmación' : '❓ Me falta un dato'}
      </div>
      <div className="text-xs whitespace-pre-wrap mb-2">{pregunta.texto || '...'}</div>
      {esConfirmacion && pregunta.preview != null && (
        <pre className="text-xs overflow-x-auto mb-2" style={{ maxHeight: 160 }}>
          {typeof pregunta.preview === 'string' ? pregunta.preview : JSON.stringify(pregunta.preview, null, 2).slice(0, 800)}
        </pre>
      )}
      {resuelta ? (
        <div className="text-xs text-muted">Resuelta ✓</div>
      ) : (
        <div className="flex gap-2">
          {esConfirmacion ? (
            <>
              <button type="button" className="btn btn-primary text-xs" onClick={onConfirmar}>Confirmar</button>
              <button type="button" className="btn text-xs" onClick={onDescartar}>Cancelar</button>
            </>
          ) : (
            <button type="button" className="btn btn-primary text-xs" onClick={onResponder}>Responder</button>
          )}
        </div>
      )}
    </div>
  );
}

// Texto de arranque segun el perfil: CORTO a proposito. El detalle de comandos vive en $ayuda
// (informacion completa sin recargar la pantalla).
const AYUDA_VACIA = {
  secretario: (
    <p className="mb-1">Te ayudo desde aca. Escribí <span className="font-mono">$ayuda</span> para más información.</p>
  ),
  ventas: (
    <p className="mb-1">Soy tu asistente de ventas. Escribí <span className="font-mono">$ayuda</span> para más información.</p>
  ),
};

// Voto del turno (plan-rediseno/11, E3): pulgar y escala 1-5 contra la evaluacion empatica del
// turno. Se puede votar UNA vez y las dos formas se combinan (el backend las cruza); el voto no
// gasta LLM y si falla se avisa sin romper la conversacion.
function VotoTurno({ evaluacionId }) {
  const [estado, setEstado] = useState(null); // 'ok' | 'error'
  const [enviando, setEnviando] = useState(false);

  async function votar(pulgar, score) {
    if (enviando || estado === 'ok') return;
    setEnviando(true);
    try {
      await agenteApi.feedback(evaluacionId, { pulgar, score });
      setEstado('ok');
    } catch (_) {
      setEstado('error');
    } finally {
      setEnviando(false);
    }
  }

  if (estado === 'ok') return <div className="text-xs text-muted mt-1">✓ Gracias, quedó registrado</div>;
  return (
    <div className="flex items-center gap-1 mt-1 text-xs">
      <span className="text-muted">¿Qué tal el trato?</span>
      <button type="button" className="btn btn-ghost text-xs px-1" disabled={enviando} onClick={() => votar(1, null)} title="Bien">👍</button>
      <button type="button" className="btn btn-ghost text-xs px-1" disabled={enviando} onClick={() => votar(-1, null)} title="Para mejorar">👎</button>
      {[1, 2, 3, 4, 5].map((n) => (
        <button key={n} type="button" className="btn btn-ghost text-xs px-1" disabled={enviando} onClick={() => votar(null, n)} title={`${n} de 5`}>{n}</button>
      ))}
      {estado === 'error' && <span className="text-muted">no se pudo registrar</span>}
    </div>
  );
}

export default function ChatAgente({ perfil = 'secretario', titulo = 'El Secretario', onCerrarMobile = null, claveArranque = null, arranqueDefault = 'expandido', onAbrirOtraVentana = null }) {
  const { contextoActual, setUltimosRecomendados, consultaAutomatica, pedirConsulta, prellenadoChat, pedirPrellenado, emitirInstruccion, csvAdjunto, setCsvAdjunto, clienteIdActivo, setClienteActivo } = useAppContext();
  const emitirRef = useRef(emitirInstruccion);
  emitirRef.current = emitirInstruccion;
  const setClienteActivoRef = useRef(setClienteActivo);
  setClienteActivoRef.current = setClienteActivo;

  const textareaRef = useRef(null);
  const inputFileRef = useRef(null);
  const [texto, setTexto] = useState('');
  const [aviso, setAviso] = useState('');
  const [adjunto, setAdjunto] = useState(null);
  const [resueltas, setResueltas] = useState({});
  // El adjunto se LEE en el navegador (FileReader): mientras eso pasa el envio queda bloqueado y
  // avisado. Antes, enviar en el medio mandaba el pedido SIN adjunto y parecia que "se habia trabado".
  const [leyendoAdjunto, setLeyendoAdjunto] = useState(false);
  // PREFERENCIA DE ARRANQUE de esta ventana (se elige arriba y se guarda en este navegador): al
  // abrir la aplicacion, la ventana arranca expandida o minimizada segun esto.
  const [arranqueMinimizado, setArranqueMinimizado] = useState(() => {
    try { return (localStorage.getItem(claveArranque) || arranqueDefault) === 'minimizado'; } catch (_) { return arranqueDefault === 'minimizado'; }
  });

  const alternarArranque = () => {
    const nuevo = !arranqueMinimizado;
    setArranqueMinimizado(nuevo);
    try { localStorage.setItem(claveArranque, nuevo ? 'minimizado' : 'expandido'); } catch (_) { /* modo privado */ }
  };

  // Autoscroll: el scroll sigue al agente mientras el operario este abajo. Si subio a leer algo, NO se
  // lo arrastra (el ref se recalcula con su propio scroll): volver a bajar lo reengancha.
  const mensajesRef = useRef(null);
  const pegadoAlFondo = useRef(true);
  const alScrollear = () => {
    const caja = mensajesRef.current;
    if (!caja) return;
    pegadoAlFondo.current = caja.scrollHeight - caja.scrollTop - caja.clientHeight < 48;
  };

  // Voz: dictado al cuadro de texto y lectura en voz alta. `textoAntesDeDictar` guarda lo que ya estaba
  // escrito para no pisarlo cuando el micro empieza a transcribir.
  const textoAntesDeDictar = useRef('');
  const vinoDeVoz = useRef(false);
  const { soportaDictado, soportaLectura, escuchando, hablando, alternarDictado, hablar, detener } = useVoz({
    alDictar: (r) => {
      if (r.error) {
        setAviso(r.error === 'not-allowed' ? 'El navegador no dio permiso para usar el micrófono.' : `No pude escuchar (${r.error}).`);
        return;
      }
      const base = textoAntesDeDictar.current ? `${textoAntesDeDictar.current} ` : '';
      setTexto(`${base}${r.texto}`.trim());
      vinoDeVoz.current = true;
      setAviso('');
    },
  });

  // La vista activa se refresca cuando el agente escribe sobre su dominio.
  const onHerramienta = useCallback((resultado, nombre) => {
    const env = resultado || {};
    if (env.ok === false) return;
    // CAPTURA DEL CLIENTE ACTIVO: si el turno IDENTIFICO o CREO un cliente (ficha, alta, cambio),
    // ese cliente queda como VARIABLE EN TRANSITO del sistema (buscador F7, Vendedor, venta).
    if (/^clientes_(ficha|crear|actualizar)$/.test(nombre || '')) {
      const c = env.data && env.data.cliente ? env.data.cliente : null;
      if (c && c.id) setClienteActivoRef.current({ id: c.id, nombre: c.nombre });
    }
    if (/^ventas_(crear|actualizar|confirmar|anular|registrar)/.test(nombre || '')) {
      emitirRef.current({ dominio: 'ventas', accion: 'refrescar', mensaje: `${nombre} ejecutada por el agente ✓` });
    } else if (/^remitos_(crear|confirmar|anular|actualizar)/.test(nombre || '')) {
      emitirRef.current({ dominio: 'remitos', accion: 'refrescar', mensaje: `${nombre} ejecutada por el agente ✓` });
    }
  }, []);

  const { mensajes, estado, candidatos, textoActual, cargando, enviar, agregarMensaje, conversacionId, nuevaConversacion, cargarConversacion, ultimaRespuestaRef } = useAgenteStream(onHerramienta, perfil);
  const [panelConvs, setPanelConvs] = useState(false);
  const [listaConvs, setListaConvs] = useState([]);

  // Panel de conversaciones guardadas: reabrir una (repinta el hilo) o borrarla. Cada ventana ve
  // SOLO sus hilos: el perfil viaja como filtro y el backend separa Secretario de Vendedor.
  const abrirPanelConvs = async () => {
    const abrir = !panelConvs;
    setPanelConvs(abrir);
    if (!abrir) return;
    try {
      const res = await agenteApi.conversaciones({ limite: 20, perfil });
      // axiosClient desempaqueta el envelope: `res` ya es el payload (la lista).
      const payload = res && res.data !== undefined && !Array.isArray(res) ? res.data : res;
      const filas = Array.isArray(payload) ? payload : payload && Array.isArray(payload.data) ? payload.data : [];
      setListaConvs(filas);
    } catch (_) {
      setListaConvs([]);
    }
  };

  const abrirConversacion = async (id) => {
    const ok = await cargarConversacion(id);
    if (ok) setPanelConvs(false);
  };

  const borrarConversacion = async (id, titulo) => {
    if (!window.confirm(`¿Eliminar la conversación "${String(titulo || id).slice(0, 60)}"?`)) return;
    try {
      await agenteApi.conversacionEliminar(id);
      setListaConvs((prev) => prev.filter((c) => c.conversacionId !== id));
      if (conversacionId === id) nuevaConversacion();
    } catch (_) {
      /* si falla, se deja la lista como esta */
    }
  };

  // Convierte el csvAdjunto del contexto (sabana pedida desde otra pagina) al
  // formato del chat: { nombre, contenido }.
  const adjuntoDesdeContexto = useCallback(() => {
    if (!csvAdjunto) return null;
    if (csvAdjunto.contenido) return { nombre: csvAdjunto.nombre || 'sabana.csv', contenido: csvAdjunto.contenido };
    const esc = (v) => {
      const s = v == null ? '' : String(v);
      return /[;"\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const enc = csvAdjunto.encabezados || [];
    const filas = csvAdjunto.filas || [];
    const lineas = [enc.map(esc).join(';'), ...filas.map((f) => enc.map((c) => esc(f[c])).join(';'))];
    return { nombre: 'sabana.csv', contenido: lineas.join('\n') };
  }, [csvAdjunto]);

  // EL CLIENTE ACTIVO VIAJA EN TODAS LAS CONSULTAS (fusionado con el contexto de pantalla): es el
  // MISMO camino del contexto que ya usan las consultas con herramientas — el router/kernel pesan su
  // perfil cuando clienteId viaja.
  const contextoDelTurno = () => ({
    ...(contextoActual || {}),
    ...(clienteIdActivo ? { clienteId: clienteIdActivo } : {}),
  });

  // Consulta programada desde otra vista (ej. "Preguntar al agente sobre este remito").
  useEffect(() => {
    if (consultaAutomatica) {
      setTexto('');
      enviar(consultaAutomatica, contextoDelTurno(), adjuntoDesdeContexto());
      setCsvAdjunto(null);
      setAdjunto(null);
      pedirConsulta(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [consultaAutomatica]);

  // PRELLENADO del traspaso (D1): el pedido llega al INPUT, no se envia solo — lo revisa el operario
  // y decide. El slot del contexto es por perfil: aca se consume el de ESTA ventana y se limpia.
  useEffect(() => {
    if (prellenadoChat && prellenadoChat.perfil === perfil) {
      setTexto(prellenadoChat.texto);
      setAviso('⇄ Pedido recibido de la otra ventana: revisalo y envialo.');
      pedirPrellenado(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prellenadoChat]);

  const alEnviar = async () => {
    const consulta = texto;
    const adj = adjunto || adjuntoDesdeContexto();
    if (!consulta.trim() && !adj) return;
    if (leyendoAdjunto) { setAviso('Esperá un momento: estoy leyendo el adjunto.'); return; }
    // Si el pedido vino por micro, la respuesta se lee en voz alta (pedido del vectorHumano): no habla
    // en cada turno escrito, que seria insoportable.
    const dichoPorVoz = vinoDeVoz.current;
    if (escuchando) alternarDictado();
    textoAntesDeDictar.current = '';
    // Si el turno anterior sigue en curso el mensaje NO se descarta: se avisa en el chat y el
    // texto queda en el cuadro para reenviarlo cuando termine.
    const enviado = await enviar(consulta.trim() || 'Analizá el archivo adjunto y contame qué tenés.', contextoDelTurno(), adj);
    if (enviado) {
      setTexto('');
      setAdjunto(null);
      setCsvAdjunto(null);
      if (candidatos.length > 0) {
        setUltimosRecomendados(candidatos.map((c) => c.ean13));
      }
      if (dichoPorVoz && soportaLectura && ultimaRespuestaRef.current) hablar(ultimaRespuestaRef.current);
    }
    vinoDeVoz.current = false;
  };

  // Pasar el pedido a la OTRA ventana (spec 21-Sep): viaja SOLO el pedido (D2) — lo tipeado si hay,
  // si no el ultimo pedido del hilo. El destino lo recibe PRELLENADO (D1) y se anexa a su hilo
  // activo (D3). No gasta modelo: el backend solo persiste lineas de sistema.
  const pasarAlOtro = async () => {
    const otro = perfil === 'ventas' ? 'secretario' : 'ventas';
    const rotulo = otro === 'ventas' ? 'Vendedor' : 'Secretario';
    const ultimo = [...mensajes].reverse().find((m) => m.rol === 'usuario');
    const pedido = (texto || '').trim() || (ultimo ? String(ultimo.texto || '').trim() : '');
    if (!pedido) { setAviso('No hay un pedido para pasar todavia.'); return; }
    try {
      let activoDestino = null;
      try { activoDestino = localStorage.getItem(`bookos_conversacion_id_${otro}`); } catch (_) { /* modo privado */ }
      const res = await agenteApi.traspaso({ origen: perfil, destino: otro, conversacionId, conversacionIdDestino: activoDestino ? Number(activoDestino) : null, texto: pedido });
      const d = res && res.data !== undefined && !Array.isArray(res) ? res.data : res;
      pedirPrellenado(otro, (d && d.textoPropuesto) || pedido);
      agregarMensaje({ rol: 'sistema', texto: `⇄ Pasado al ${rotulo}${d && d.conversacionIdDestino ? ` (hilo #${d.conversacionIdDestino})` : ''}` });
      if (typeof onAbrirOtraVentana === 'function') onAbrirOtraVentana(otro);
    } catch (e) {
      setAviso(`⚠️ No pude pasar el pedido: ${e.message}`);
    }
  };

  // Adjuntos: CSV/TXT como texto (2MB), imagenes y binarios (Excel/PDF) como base64 (6MB). Los
  // binarios viajan ~33% mas pesados; el limite de la ruta del chat (10mb) lo contempla. La IMAGEN
  // tiene que viajar como binario SI o SI: leida como texto llegaria rota.
  const alAdjuntar = (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    setLeyendoAdjunto(true);
    setAviso(`Leyendo ${file.name}…`);
    const esImagen = /^image\//i.test(file.type || '') || /\.(png|jpe?g|webp|gif)$/i.test(file.name);
    const binario = esImagen || /\.(xlsx|xls|pdf)$/i.test(file.name) || /excel|spreadsheet|pdf/i.test(file.type || '');
    const limite = binario ? 6 * 1024 * 1024 : 2 * 1024 * 1024;
    if (file.size > limite) {
      setAviso(`El archivo supera ${binario ? '6MB' : '2MB'}. Probá con uno más chico.`);
      e.target.value = '';
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setLeyendoAdjunto(false);
      if (binario) {
        const texto = String(reader.result || '');
        const b64 = texto.includes(',') ? texto.slice(texto.indexOf(',') + 1) : texto;
        setAdjunto({ nombre: file.name, contenido: b64, base64: true, mime: file.type || (esImagen ? 'image/png' : '') });
      } else {
        setAdjunto({ nombre: file.name, contenido: String(reader.result || '') });
      }
      setAviso(`Adjunto listo (${file.name}). Escribí tu mensaje y envialo.`);
    };
    reader.onerror = () => { setLeyendoAdjunto(false); setAviso('No se pudo leer el archivo.'); };
    if (binario) reader.readAsDataURL(file);
    else reader.readAsText(file);
    e.target.value = '';
  };

  const confirmarPregunta = async (pregunta, clave) => {
    try {
      const res = await agenteApi.confirmar(pregunta.herramienta, pregunta.argumentos, conversacionId);
      const envelope = res.data && res.data.data ? res.data.data : res.data;
      agregarMensaje({ rol: 'agente', texto: '✓ Ejecutado con tu confirmación', resultado: { ruta: 'confirmacion', resultado: envelope } });
      setResueltas((prev) => ({ ...prev, [clave]: true }));
    } catch (err) {
      const mensaje = err.response && err.response.data && err.response.data.message ? err.response.data.message : err.message;
      agregarMensaje({ rol: 'agente', texto: `⚠️ ${mensaje}` });
    }
  };

  const responderPregunta = () => {
    if (textareaRef.current) textareaRef.current.focus();
  };

  // Texto legible de un mensaje del agente para COPIAR o EXPORTAR. Un mensaje que solo trae el
  // payload del evento (`resultado` sin texto) es un cierre de turno, no una respuesta: volcarlo
  // como JSON crudo ensuciaba la conversacion copiada (el operario pegaba un JSON en el chat).
  const textoParaCopiar = (m) => {
    if (m.texto) return m.texto;
    if (!m.resultado) return m.pregunta ? m.pregunta.texto : (m.nombre || '');
    if (m.resultado.ruta === 'confirmacion') return 'Ejecutado con confirmacion';
    const r = m.resultado.resultado;
    if (r && r.data && !Array.isArray(r.data)) return 'Resultado de herramienta (ver el panel)';
    // Nada que copiar como texto: el turno ya viaja en su propio mensaje (o mostro una tarjeta que no
    // es texto). Antes caia aca un rotulo "Turno sin texto (ruta X)" que el operario NUNCA vio en el
    // chat: la copia tiene que ser lo que se leyo, no el cierre interno del turno.
    return '';
  };

  const copiarChat = async () => {
    const contenido = mensajes.map((m) => {
      if (m.rol === 'usuario') return `Vos: ${m.texto}`;
      if (m.rol === 'herramienta') return `🔧 ${m.nombre}`;
      if (m.rol === 'pregunta') return `Agente (${m.pregunta.tipo}): ${m.pregunta.texto || ''}`;
      const texto = textoParaCopiar(m);
      return texto ? `Agente: ${texto}` : '';
    }).filter(Boolean).join('\n\n');
    try {
      await navigator.clipboard.writeText(contenido || 'Sin conversacion');
      setAviso('Conversacion copiada ✓');
    } catch (err) {
      setAviso('No se pudo copiar (permisos del navegador).');
    }
  };

  const exportarChat = () => {
    const filas = mensajes.map((m) => ({
      rol: m.rol === 'usuario' ? 'vos' : m.rol === 'herramienta' ? 'herramienta' : m.rol === 'pregunta' ? 'pregunta' : 'agente',
      contenido: m.rol === 'usuario' ? m.texto : textoParaCopiar(m),
    }));
    descargarCsv(`conversacion_${perfil}`, [{ titulo: 'rol', clave: 'rol' }, { titulo: 'contenido', clave: 'contenido' }], filas);
    setAviso('Conversacion exportada ✓');
  };

  const adjuntoPendiente = adjunto || (csvAdjunto ? { nombre: csvAdjunto.nombre || 'sabana.csv' } : null);

  // El scroll sigue al agente: se reengancha con cada mensaje, con cada pedazo de texto en streaming y
  // con los candidatos. Solo actua si el operario esta abajo (si subio a leer, no se lo arrastra).
  useEffect(() => {
    const caja = mensajesRef.current;
    if (!caja || !pegadoAlFondo.current) return;
    caja.scrollTop = caja.scrollHeight;
  }, [mensajes, textoActual, candidatos, cargando]);

  return (
    <div className="flex flex-col" style={{ height: '100%', minHeight: 0 }}>
      <div className="agente-header px-4 py-3 flex items-center gap-2 flex-wrap">
        <span className="font-semibold text-sm">{titulo}</span>
        {estado && <span className="agente-badge agente-badge-analizando">{estado}</span>}
        {claveArranque && (
          <button
            type="button"
            className="btn btn-ghost text-xs"
            onClick={alternarArranque}
            title="Cómo ARRANCA esta ventana al abrir la aplicación (se guarda en este navegador)"
          >
            arranque: {arranqueMinimizado ? 'minimizado' : 'expandido'}
          </button>
        )}
        <button
          type="button"
          className="btn btn-ghost text-xs"
          onClick={pasarAlOtro}
          title={`Pasa el ultimo pedido a la otra ventana (${perfil === 'ventas' ? 'Secretario' : 'Vendedor'}): llega PRELLENADO, no se envia solo`}
        >
          ⇄ Pasar al {perfil === 'ventas' ? 'Secretario' : 'Vendedor'}
        </button>
        {contextoActual && (
          <span className="agente-badge" title={JSON.stringify(contextoActual)}>contexto: {resumenContexto(contextoActual)}</span>
        )}
        <button
          type="button"
          className="btn btn-ghost text-xs ml-auto"
          onClick={abrirPanelConvs}
          disabled={cargando}
          title="Conversaciones guardadas"
        >
          🗂
        </button>
        <button
          type="button"
          className="btn btn-ghost text-xs"
          onClick={nuevaConversacion}
          disabled={cargando}
          title="Empezar una conversación nueva (el hilo actual queda guardado)"
        >
          ＋ Nueva
        </button>
        {onCerrarMobile && (
          <button type="button" className="btn btn-ghost text-xs agente-cerrar" onClick={onCerrarMobile} title="Cerrar">✕</button>
        )}
      </div>

      {panelConvs && (
        <div className="agente-historial px-4 py-2" style={{ maxHeight: 260, overflowY: 'auto' }}>
          <div className="text-xs text-muted mb-1">Conversaciones guardadas (más recientes primero):</div>
          {listaConvs.length === 0 && <div className="text-xs text-muted">Todavía no hay conversaciones guardadas.</div>}
          {listaConvs.map((c) => (
            <div key={c.conversacionId} className="flex items-center gap-2 py-1" style={{ borderBottom: '1px solid var(--border)' }}>
              <button type="button" className="btn btn-ghost text-xs flex-1" onClick={() => abrirConversacion(c.conversacionId)} title={c.titulo || ''}>
                {(c.titulo || '(sin titulo)').slice(0, 42)} · {c.turnos} turnos
              </button>
              <button type="button" className="btn btn-ghost text-xs" onClick={() => borrarConversacion(c.conversacionId, c.titulo)} title="Borrar conversación">🗑</button>
            </div>
          ))}
        </div>
      )}

      <div className="agente-mensajes px-4 py-3 space-y-3" ref={mensajesRef} onScroll={alScrollear}>
        {mensajes.length === 0 && (
          <div className="text-xs text-muted leading-relaxed">
            {AYUDA_VACIA[perfil] || AYUDA_VACIA.secretario}
          </div>
        )}
        {mensajes.map((m, i) => {
          if (m.rol === 'sistema') {
            return (
              <div key={i} className="text-xs text-muted text-center my-1">{m.texto}</div>
            );
          }
          if (m.rol === 'herramienta') {
            return (
              <div key={i} className="text-xs">
                <span className="agente-badge">{m.ok === false ? '⚠️' : '🔧'} {m.nombre}</span>
              </div>
            );
          }
          if (m.rol === 'pregunta') {
            const clave = `${m.pregunta.tipo}-${i}`;
            return (
              <PreguntaCard
                key={i}
                pregunta={m.pregunta}
                resuelta={Boolean(resueltas[clave])}
                onConfirmar={() => confirmarPregunta(m.pregunta, clave)}
                onResponder={responderPregunta}
                onDescartar={() => setResueltas((prev) => ({ ...prev, [clave]: true }))}
              />
            );
          }
          if (m.rol === 'usuario') {
            return (
              <div key={i} className="text-sm text-right">
                <div className="inline-block max-w-[85%] px-3 py-2 rounded-[10px] whitespace-pre-wrap text-left btn-primary">
                  {m.adjunto && <div className="text-xs opacity-80 mb-1">📎 {m.adjunto}</div>}
                  {m.texto}
                </div>
              </div>
            );
          }
          return (
            <div key={i} className="text-sm">
              <div
                className="inline-block max-w-[92%] px-3 py-2 rounded-[10px] whitespace-pre-wrap text-left"
                style={{ background: 'var(--bg-soft)', border: '1px solid var(--border)' }}
              >
                {m.resultado ? (
                  <>
                    {m.texto && <div className="mb-1">{m.texto}</div>}
                    {m.resultado.ruta === 'confirmacion' ? (
                      <BloqueEnvelope envelope={m.resultado.resultado} />
                    ) : (
                      <>
                        {m.resultado.marcador && <span className="agente-badge mr-1">{m.resultado.marcador}</span>}
                        {m.resultado.confirmacion && <div className="text-xs text-muted mb-1">Escritura preparada: esperá la confirmación.</div>}
                        <BloqueEnvelope envelope={m.resultado.resultado} />
                        {Array.isArray(m.resultado.siguientes) && m.resultado.siguientes.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-2">
                            {m.resultado.siguientes.slice(0, 4).map((s) => (
                              <button
                                key={String(s)}
                                type="button"
                                className="btn text-xs"
                                onClick={() => enviar(`Ejecutá ${String(s).replace(/_/g, ' ')}`, contextoDelTurno())}
                              >
                                {String(s).replace(/_/g, ' ')}
                              </button>
                            ))}
                          </div>
                        )}
                      </>
                    )}
                  </>
                ) : m.texto}
              </div>
              {m.evaluacionId && <VotoTurno evaluacionId={m.evaluacionId} />}
              {soportaLectura && textoParaCopiar(m) && (
                <button
                  type="button"
                  className="btn btn-ghost text-xs px-1 ml-1 align-top"
                  onClick={() => (hablando ? detener() : hablar(textoParaCopiar(m)))}
                  title={hablando ? 'Parar de leer' : 'Escuchar la respuesta'}
                >
                  {hablando ? '⏹' : '🔊'}
                </button>
              )}
            </div>
          );
        })}

        {cargando && textoActual && (
          <div className="text-sm">
            <div
              className="inline-block max-w-[92%] px-3 py-2 rounded-[10px] whitespace-pre-wrap text-left"
              style={{ background: 'var(--bg-soft)', border: '1px solid var(--border)' }}
            >
              {textoActual}
            </div>
          </div>
        )}

        {candidatos.length > 0 && (
          <div className="space-y-2">
            {candidatos.slice(0, 6).map((c, i) => (
              <div key={c.ean13 || c.articuloId || i} className="card p-3">
                <div className="flex justify-between gap-2">
                  <span className="text-sm font-medium">{c.titulo}</span>
                  <span className="text-xs text-muted font-mono">{(c.score || 0).toFixed(2)}</span>
                </div>
                <div className="text-xs text-muted">{c.autor} · {c.editorial}</div>
                <div className="flex justify-between text-xs mt-1">
                  <span className="font-mono">{c.ean13 || c.barras || ''}</span>
                  <span>{money(c.precio)} · stock {Number(c.stock || 0) + Number(c.stockDeposito || 0)}</span>
                </div>
                <div className="flex justify-end mt-2">
                  <button
                    type="button"
                    className="btn btn-primary text-xs"
                    onClick={() => emitirInstruccion({ dominio: 'ventas', accion: 'agregar_item', item: { ean13: c.ean13, titulo: c.titulo, precio: c.precio } })}
                  >
                    Agregar a la venta
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="agente-input-wrap p-3">
        {(adjuntoPendiente || aviso) && (
          <div className="flex items-center gap-2 mb-2 text-xs flex-wrap">
            {adjuntoPendiente && <span className="agente-badge">📎 {adjuntoPendiente.nombre}</span>}
            {aviso && <span className="text-muted">{aviso}</span>}
          </div>
        )}
        <div className="flex items-center gap-1 mb-2 flex-wrap">
          <input ref={inputFileRef} type="file" accept=".csv,.txt,.xlsx,.xls,.pdf,.png,.jpg,.jpeg,.webp,.gif,text/csv,text/plain,application/pdf,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,image/png,image/jpeg,image/webp,image/gif" style={{ display: 'none' }} onChange={alAdjuntar} />
          <button type="button" className="btn btn-ghost text-xs" onClick={() => inputFileRef.current && inputFileRef.current.click()} title="Adjuntar archivo o imagen (CSV, Excel, PDF, foto)">📎 Adjuntar</button>
          {soportaDictado && (
            <button
              type="button"
              className={`btn btn-ghost text-xs ${escuchando ? 'agente-mic-escuchando' : ''}`}
              onClick={() => {
                if (!escuchando) textoAntesDeDictar.current = texto;
                alternarDictado();
              }}
              title={escuchando ? 'Estoy escuchando: tocá de nuevo para cortar' : 'Dictar el pedido por micrófono'}
            >
              {escuchando ? '🎙 Escuchando…' : '🎙 Hablar'}
            </button>
          )}
          {hablando && (
            <button type="button" className="btn btn-ghost text-xs" onClick={detener} title="Parar de leer">⏹ Parar</button>
          )}
          <button type="button" className="btn btn-ghost text-xs" onClick={copiarChat} title="Copiar conversacion">📋 Copiar</button>
          <button type="button" className="btn btn-ghost text-xs" onClick={exportarChat} title="Exportar conversacion a CSV">⬇ Exportar</button>
          {adjunto && <button type="button" className="btn btn-ghost text-xs text-muted" onClick={() => setAdjunto(null)}>Quitar adjunto</button>}
          {!adjunto && csvAdjunto && <button type="button" className="btn btn-ghost text-xs text-muted" onClick={() => setCsvAdjunto(null)}>Quitar sábana</button>}
        </div>
        <textarea
          ref={textareaRef}
          className="input-os mb-2 resize-none"
          rows={2}
          placeholder={perfil === 'ventas' ? 'Pedime una recomendación, una búsqueda o un pedido...' : 'Preguntale al Secretario o usa un marcador $...'}
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); alEnviar(); } }}
        />
        <button type="button" className="btn btn-primary w-full" disabled={cargando || leyendoAdjunto} onClick={alEnviar}>
          {cargando ? 'Pensando...' : leyendoAdjunto ? 'Leyendo adjunto…' : 'Enviar'}
        </button>
      </div>
    </div>
  );
}
