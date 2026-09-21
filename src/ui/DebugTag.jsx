// BookOS - DebugTag.jsx
// ruta: bookos/frontend/src/ui/DebugTag.jsx
// descripcion: marca de identificacion de componente cuando debug_mode esta activo. Dos fuentes y
//   alcanza con una: VITE_DEBUG_MODE (build) y el toggle debug_mode del OS (runtime, Sistema ▾
//   Desarrollo). Estado REACTIVO unico (useSyncExternalStore) compartido con el shell: el toggle se ve
//   al instante, sin recargar, y VITE_DEBUG_MODE=true sigue siendo el piso. debug_mode=false -> no
//   renderiza nada.

import { useSyncExternalStore } from 'react';

// Dos fuentes y alcanza con una: VITE_DEBUG_MODE (build) y el toggle debug_mode del OS (runtime,
// Sistema > Desarrollo: se prende sin recompilar el front). El build es el piso: si VITE_DEBUG_MODE
// esta en true, el toggle no lo apaga.
//
// El estado vive aca y es REACTIVO: activarDebug() avisa a todos los DebugTag ya montados, asi el
// cambio se ve al instante y sin recargar. Con una bandera muda no se veia nada hasta el proximo
// F5 (medido: 0 marcas hasta recargar, con el toggle ya encendido en la base).
let activo = import.meta.env.VITE_DEBUG_MODE === 'true';
const suscriptores = new Set();

// Referencias ESTABLES a nivel modulo: useSyncExternalStore las compara en cada render y una
// funcion nueva por render lo haria re-suscribir en bucle.
const suscribir = (cb) => {
  suscriptores.add(cb);
  return () => suscriptores.delete(cb);
};
const leer = () => activo;

export function activarDebug(valor) {
  const nuevo = Boolean(valor) || import.meta.env.VITE_DEBUG_MODE === 'true';
  if (nuevo === activo) return;
  activo = nuevo;
  suscriptores.forEach((avisar) => avisar());
}

// Para el shell (la marca de agua del contenedor): mismo estado y misma reactividad.
export const useDebugActivo = () => useSyncExternalStore(suscribir, leer);

export default function DebugTag({ nombre }) {
  const visible = useDebugActivo();
  if (!visible) return null;
  return (
    <span className="agente-badge" title={`componente: ${nombre}`}>
      {nombre}
    </span>
  );
}
