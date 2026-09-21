// BookOS - useAtajoGlobal.js
// ruta: bookos/frontend/src/hooks/useAtajoGlobal.js
// descripcion: atajo de teclado GLOBAL (patron del bookerp, adaptado): escucha en window,
//   evita la accion por defecto del navegador y llama al callback. `activo` permite apagarlo
//   (por ejemplo mientras hay un modal abierto, para no re-dispararlo).

import { useEffect } from 'react';

export default function useAtajoGlobal(tecla, callback, { activo = true } = {}) {
  useEffect(() => {
    if (!activo) return undefined;
    const alTeclear = (e) => {
      if (e.key !== tecla) return;
      e.preventDefault();
      callback(e);
    };
    window.addEventListener('keydown', alTeclear);
    return () => window.removeEventListener('keydown', alTeclear);
  }, [tecla, callback, activo]);
}
