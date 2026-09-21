// BookOS - usePersistentWork.js
// ruta: bookos/frontend/src/hooks/usePersistentWork.js
// descripcion: borradores que sobreviven al cambio de pagina y al refresco (localStorage).
//   Regla de oro del OS: cambiar de pagina NO borra trabajo.
//   La clave va POR USUARIO (el id lo deja el login en localStorage): dos operarios en la misma
//   PC no se pisan el borrador. Devuelve ademas `restaurado`, para que la pantalla avise con el
//   indicador "↺ limpiar".

import { useEffect, useState } from 'react';

// Usuario actual: sin login (o en pruebas) cae a la clave pelada de siempre.
function claveDe(clave) {
  try {
    const usuario = localStorage.getItem('bookos_usuario_id');
    return usuario ? `bookos_borrador_${clave}_u${usuario}` : `bookos_borrador_${clave}`;
  } catch (err) {
    return `bookos_borrador_${clave}`;
  }
}

export default function usePersistentWork(clave, valorInicial) {
  const [valor, setValor] = useState(() => {
    try {
      const guardado = localStorage.getItem(claveDe(clave));
      if (!guardado) return valorInicial;
      const parseado = JSON.parse(guardado);
      // Arrays (listas de items): se usan tal cual — el spread de un array en un objeto
      // devolveria {} y romperia el render. Objetos (cabeceras): merge sobre el inicial.
      if (Array.isArray(valorInicial)) return Array.isArray(parseado) ? parseado : valorInicial;
      // Primitivos (un texto de busqueda, un numero): el valor guardado manda. Ojo: 0 y '' son
      // validos, por eso ?? y no ||.
      if (valorInicial === null || typeof valorInicial !== 'object') return parseado ?? valorInicial;
      return parseado && typeof parseado === 'object' ? { ...valorInicial, ...parseado } : valorInicial;
    } catch (err) {
      return valorInicial;
    }
  });

  // Hay borrador en disco: la pantalla muestra el indicador hasta que se limpie.
  const [restaurado, setRestaurado] = useState(() => {
    try { return Boolean(localStorage.getItem(claveDe(clave))); } catch (err) { return false; }
  });

  useEffect(() => {
    try {
      localStorage.setItem(claveDe(clave), JSON.stringify(valor));
    } catch (err) {
      // storage lleno: se pierde el borrador pero no rompe la app
    }
  }, [clave, valor]);

  const limpiar = () => {
    setValor(valorInicial);
    setRestaurado(false);
  };

  return [valor, setValor, limpiar, restaurado];
}
