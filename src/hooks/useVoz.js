// BookOS - useVoz.js
// ruta: bookos/frontend/src/hooks/useVoz.js
// descripcion: voz del chat con lo NATIVO del navegador (Web Speech API): dictado por microfono
//   (SpeechRecognition) y lectura en voz alta (speechSynthesis). El audio no sale de la maquina: no
//   hay servidor, clave ni costo por uso. Antes de usarlo se consulta `soportaDictado`/`soportaLectura`
//   y el navegador que no las tiene NO muestra los botones: esconder la funcion es mas honesto que un
//   boton que no hace nada. Idioma por defecto: es-AR.
//   El dictado devuelve el texto COMPLETO de la toma (final + lo que el navegador va adivinando), para
//   que quien lo use escriba en su cuadro sin tener que concatenar.

import { useCallback, useEffect, useRef, useState } from 'react';

export default function useVoz({ alDictar, idioma = 'es-AR' } = {}) {
  const Reconocimiento = typeof window !== 'undefined' ? window.SpeechRecognition || window.webkitSpeechRecognition : null;
  const soportaDictado = Boolean(Reconocimiento);
  const soportaLectura = typeof window !== 'undefined' && 'speechSynthesis' in window;

  const [escuchando, setEscuchando] = useState(false);
  const [hablando, setHablando] = useState(false);
  const reconocimientoRef = useRef(null);
  // El callback vive en un ref: el reconocedor se arma una vez por toma y no tiene que reconstruirse
  // cada vez que el componente cambia de render.
  const alDictarRef = useRef(alDictar);
  alDictarRef.current = alDictar;

  const alternarDictado = useCallback(() => {
    if (!soportaDictado) return;
    if (escuchando) {
      try {
        if (reconocimientoRef.current) reconocimientoRef.current.stop();
      } catch (_) {
        /* el navegador ya lo habia cortado */
      }
      setEscuchando(false);
      return;
    }
    // Se arma uno NUEVO por toma: reusar el mismo despues de `end` falla en Chrome.
    const reconocedor = new Reconocimiento();
    reconocedor.lang = idioma;
    reconocedor.continuous = false;
    reconocedor.interimResults = true;
    reconocedor.onresult = (evento) => {
      let final = '';
      let parcial = '';
      for (let i = 0; i < evento.results.length; i += 1) {
        const t = evento.results[i][0] ? evento.results[i][0].transcript : '';
        if (evento.results[i].isFinal) final += t;
        else parcial += t;
      }
      if (alDictarRef.current) alDictarRef.current({ texto: `${final} ${parcial}`.trim(), final: final.trim(), parcial: parcial.trim() });
    };
    // Un error del reconocedor (sin permiso, sin micro) se informa al que lo usa y se corta la escucha.
    reconocedor.onerror = (e) => {
      if (alDictarRef.current) alDictarRef.current({ texto: '', error: (e && e.error) || 'error' });
      setEscuchando(false);
    };
    reconocedor.onend = () => setEscuchando(false);
    reconocimientoRef.current = reconocedor;
    setEscuchando(true);
    try {
      reconocedor.start();
    } catch (_) {
      setEscuchando(false);
    }
  }, [Reconocimiento, escuchando, idioma, soportaDictado]);

  const hablar = useCallback((texto) => {
    if (!soportaLectura || !texto) return;
    // Se saca el markdown: leer asteriscos y almohadillas en voz alta no aporta nada.
    const limpio = String(texto).replace(/[*_#`>|-]/g, ' ').replace(/\s+/g, ' ').trim();
    if (!limpio) return;
    try {
      window.speechSynthesis.cancel();
    } catch (_) {
      /* nada que cancelar */
    }
    const dicho = new SpeechSynthesisUtterance(limpio);
    dicho.lang = idioma;
    const voces = window.speechSynthesis.getVoices() || [];
    const elegida = voces.find((v) => v.lang === idioma) || voces.find((v) => /^es/i.test(v.lang));
    if (elegida) dicho.voice = elegida;
    dicho.onend = () => setHablando(false);
    dicho.onerror = () => setHablando(false);
    setHablando(true);
    try {
      window.speechSynthesis.speak(dicho);
    } catch (_) {
      setHablando(false);
    }
  }, [idioma, soportaLectura]);

  const detener = useCallback(() => {
    if (!soportaLectura) return;
    try {
      window.speechSynthesis.cancel();
    } catch (_) {
      /* nada que cortar */
    }
    setHablando(false);
  }, [soportaLectura]);

  // Al cerrar el panel se corta el dictado y la lectura: dejar el micro abierto o la voz hablando
  // despues de cerrar el chat es peor que no tener la funcion.
  useEffect(() => () => {
    try {
      if (reconocimientoRef.current) reconocimientoRef.current.stop();
    } catch (_) {
      /* ya estaba cortado */
    }
    if (soportaLectura) {
      try {
        window.speechSynthesis.cancel();
      } catch (_) {
        /* nada que cortar */
      }
    }
  }, [soportaLectura]);

  return { soportaDictado, soportaLectura, escuchando, hablando, alternarDictado, hablar, detener };
}
