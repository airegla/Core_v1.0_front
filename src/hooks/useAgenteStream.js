// BookOS - useAgenteStream.js
// ruta: bookos/frontend/src/hooks/useAgenteStream.js
// descripcion: consumo del SSE del Secretario (POST + stream). Expone estados,
//   candidatos, la pregunta del agente (confirmacion/clarificacion) y el texto
//   que llega palabra por palabra. El adjunto viaja como { nombre, contenido }.

import { useCallback, useEffect, useRef, useState } from 'react';
import { agenteApi } from '../api/api';

// Watchdog del stream: 3 minutos SIN NINGUN evento cortan el turno con su aviso. El LLM emite chunks
// seguido; una espera muda de 3 minutos no es lentitud, es una conexion que ya no responde (el caso
// medido en el celular: se traba el adjunto y despues el chat no responde mas).
const SIN_EVENTOS_MS = 180000;

export default function useAgenteStream(onHerramienta, perfil = 'secretario') {
  // Cada OFICIO tiene su PROPIO hilo guardado: el Vendedor no reanuda la conversacion del
  // Secretario (dos personalidades en el mismo hilo = esquizofrenia). El listado de conversaciones
  // del panel sigue siendo compartido hasta que la base guarde el perfil (pendiente declarado).
  const claveConversacion = `bookos_conversacion_id_${perfil}`;
  const [mensajes, setMensajes] = useState([]);
  const [estado, setEstado] = useState('');
  const [candidatos, setCandidatos] = useState([]);
  const [textoActual, setTextoActual] = useState('');
  const [cargando, setCargando] = useState(false);
  // Continuidad: la conversacion activa sobrevive recargas (el backend guarda el hilo).
  const [conversacionId, setConversacionId] = useState(() => {
    try {
      return Number(localStorage.getItem(claveConversacion)) || null;
    } catch (_) {
      return null;
    }
  });
  const abortRef = useRef(null);
  // Texto final del ultimo turno cerrado. Lo usa el chat para leer la respuesta en voz alta cuando el
  // pedido vino por micro: la respuesta tiene que ser la del turno que se acaba de cerrar, no la que
  // el estado todavia no termino de pintar.
  const ultimaRespuestaRef = useRef('');

  const agregarMensaje = useCallback((mensaje) => {
    setMensajes((prev) => [...prev, mensaje]);
  }, []);

  const nuevaConversacion = useCallback(() => {
    setConversacionId(null);
    try {
      localStorage.removeItem(claveConversacion);
    } catch (_) {
      /* modo privado */
    }
    setMensajes([]);
    setTextoActual('');
    setCandidatos([]);
  }, []);

  // Reabre una conversacion persistida: repinta los turnos guardados y la vuelve activa.
  const cargarConversacion = useCallback(async (id) => {
    try {
      const res = await agenteApi.conversacionTurnos(id);
      // axiosClient desempaqueta el envelope: `res` ya es el payload {conversacionId, titulo, turnos}.
      const payload = res && res.data !== undefined && !Array.isArray(res) ? res.data : res;
      const detalle = payload && typeof payload === 'object' && !Array.isArray(payload) ? payload : {};
      const filas = Array.isArray(detalle.turnos) ? detalle.turnos : [];
      const reconstruidos = [];
      for (const t of filas) {
        if (t.rol === 'usuario') {
          reconstruidos.push({ rol: 'usuario', texto: t.texto || '' });
        } else if (t.ruta === 'traspaso') {
          // Linea de sistema del traspaso entre ventanas: se repinta como nota, no como respuesta.
          reconstruidos.push({ rol: 'sistema', texto: t.texto || '' });
        } else {
          for (const h of t.herramientas || []) reconstruidos.push({ rol: 'herramienta', nombre: h.nombre, ok: true });
          if (t.texto) reconstruidos.push({ rol: 'agente', texto: t.texto });
        }
      }
      setMensajes(reconstruidos);
      setConversacionId(Number(id));
      try {
        localStorage.setItem(claveConversacion, String(id));
      } catch (_) {
        /* modo privado */
      }
      return true;
    } catch (err) {
      // El id guardado puede apuntar a una conversacion que ya no existe (hilo borrado o base
      // restaurada): se DESCARTA para no pedirla en cada carga (era el 404 repetido del chat).
      // Otro error (red, permisos) NO borra el id: se avisa, porque un catch vacio esconde el
      // defecto real y deja al operario sin saber por que no se reabrio su hilo.
      const status = (err && (err.status || (err.response && err.response.status))) || null;
      if (status === 404) {
        try { localStorage.removeItem(claveConversacion); } catch (_) { /* modo privado */ }
        setConversacionId(null);
      } else {
        console.warn('[agente] no se pudo reabrir la conversacion', id, err && err.message);
      }
      return false;
    }
  }, []);

  // Al abrir el chat, si hay una conversacion activa guardada, se repinta el hilo.
  const autoCargado = useRef(false);
  useEffect(() => {
    if (autoCargado.current || !conversacionId) return;
    autoCargado.current = true;
    cargarConversacion(conversacionId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Al desmontar, un turno en curso se corta: no queda un fetch leyendo con el componente muerto.
  useEffect(() => () => { if (abortRef.current) abortRef.current.abort(); }, []);

  const enviar = useCallback(async (texto, contexto = null, adjunto = null) => {
    // Un turno a la vez: si el anterior sigue en curso NO se descarta el mensaje en silencio
    // (antes desaparecia sin explicacion y parecia que el agente se habia colgado).
    if (!texto.trim()) return false;
    if (cargando) {
      setMensajes((prev) => [...prev, { rol: 'agente', texto: '⏳ Todavia estoy resolviendo el pedido anterior: cuando termine, mandame este (lo dejo anotado).' }]);
      return false;
    }
    setCargando(true);
    setEstado('Analizando...');
    setCandidatos([]);
    setTextoActual('');
    ultimaRespuestaRef.current = '';
    setMensajes((prev) => [...prev, { rol: 'usuario', texto, adjunto: adjunto ? adjunto.nombre : null }]);

    const ctrl = new AbortController();
    abortRef.current = ctrl;
    let watchdog = setTimeout(() => ctrl.abort(), SIN_EVENTOS_MS);
    const patearWatchdog = () => { clearTimeout(watchdog); watchdog = setTimeout(() => ctrl.abort(), SIN_EVENTOS_MS); };

    try {
      const respuesta = await agenteApi.chat(texto.trim(), contexto, adjunto, conversacionId, perfil, ctrl.signal);
      const reader = respuesta.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let acumulado = '';
      let recibioAlgo = false;
      // Ancla del feedback empatico (E3): viaja en el evento resultado y se cuelga del mensaje de
      // TEXTO, que es donde el operario lee la respuesta (el evento resultado suele venir sin texto).
      let evaluacionId = null;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const bloques = buffer.split('\n\n');
        buffer = bloques.pop();
        for (const bloque of bloques) {
          let evento = '';
          let datos = '';
          for (const linea of bloque.split('\n')) {
            if (linea.startsWith('event: ')) evento = linea.slice(7).trim();
            if (linea.startsWith('data: ')) datos += linea.slice(6);
          }
          if (!evento) continue;
          try {
            const payload = datos ? JSON.parse(datos) : {};
            patearWatchdog();
            if (evento === 'estado') {
              if (payload.fase === 'done') continue;
              setEstado(payload.fase);
            } else if (evento === 'candidatos') {
              recibioAlgo = true;
              setCandidatos(payload.resultados || []);
            } else if (evento === 'chunk') {
              recibioAlgo = true;
              acumulado += payload.texto;
              setTextoActual(acumulado);
            } else if (evento === 'pregunta') {
              recibioAlgo = true;
              setMensajes((prev) => [...prev, { rol: 'pregunta', pregunta: payload }]);
            } else if (evento === 'resultado') {
              recibioAlgo = true;
              if (payload.evaluacionId) evaluacionId = payload.evaluacionId;
              if (payload.conversacionId) {
                setConversacionId(payload.conversacionId);
                try {
                  localStorage.setItem(claveConversacion, String(payload.conversacionId));
                } catch (_) {
                  /* modo privado */
                }
              }
              // La tarjeta del resultado se agrega solo si hay ALGO que mostrar. Un cierre de turno sin
              // envelope, sin marcador, sin confirmacion y sin sugerencias dejaba en el chat una
              // burbuja VACIA y, al copiar, una linea "Turno sin texto (ruta X)" que el operario no
              // habia leido en pantalla. El texto del turno viaja en su propio mensaje, asi que no se
              // pierde nada: la conversacion queda siendo lo que el operario vio.
              const tieneAlgoVisible = Boolean(payload.marcador || payload.confirmacion || payload.resultado
                || (Array.isArray(payload.siguientes) && payload.siguientes.length));
              if (tieneAlgoVisible) setMensajes((prev) => [...prev, { rol: 'agente', resultado: payload }]);
            } else if (evento === 'herramienta') {
              recibioAlgo = true;
              setMensajes((prev) => [...prev, { rol: 'herramienta', nombre: payload.nombre, ok: payload.ok }]);
              if (onHerramienta && payload.resultado) onHerramienta(payload.resultado, payload.nombre);
            } else if (evento === 'error') {
              recibioAlgo = true;
              setMensajes((prev) => [...prev, { rol: 'agente', texto: `⚠️ ${payload.message}` }]);
            }
          } catch (err) {
            // evento parcial: ignorar
          }
        }
      }

      if (acumulado) {
        ultimaRespuestaRef.current = acumulado;
        setMensajes((prev) => [...prev, { rol: 'agente', texto: acumulado, evaluacionId }]);
      } else if (!recibioAlgo) {
        // El stream se cerro SIN UN SOLO evento util: no es "no hay resultados", es que la conexion
        // se corto (el backend se reinicio, se cayo o se perdio la red). Decir "no obtuve resultados"
        // hacia creer que el sistema busco y no encontro; aca el pedido no llego a cerrar, asi que
        // tampoco quedo registrado. Se dice lo que paso y se ofrece la salida: reenviar.
        setMensajes((prev) => [...prev, {
          rol: 'agente',
          texto: '⚠️ Se cortó la conexión antes de que el turno respondiera (el servidor pudo reiniciarse). El pedido no llegó a registrarse: mandalo de nuevo.',
        }]);
      } else {
        setMensajes((prev) => [...prev, {
          rol: 'agente',
          texto: 'El turno terminó sin un texto de respuesta (mirá las herramientas de arriba). Decime si querés que lo retome o lo reformulamos.',
        }]);
      }
      return true;
    } catch (err) {
      if (err && err.name === 'AbortError') {
        setMensajes((prev) => [...prev, {
          rol: 'agente',
          texto: '⚠️ La conexión quedó sin respuesta y corté el turno (3 minutos sin eventos). No quedó registrado: mandá el pedido de nuevo.',
        }]);
      } else {
        setMensajes((prev) => [...prev, { rol: 'agente', texto: `⚠️ ${err.message}` }]);
      }
      return false;
    } finally {
      clearTimeout(watchdog);
      abortRef.current = null;
      setEstado('');
      setCargando(false);
    }
  }, [cargando, onHerramienta, conversacionId, perfil]);

  return { mensajes, estado, candidatos, textoActual, cargando, enviar, agregarMensaje, conversacionId, nuevaConversacion, cargarConversacion, ultimaRespuestaRef };
}
