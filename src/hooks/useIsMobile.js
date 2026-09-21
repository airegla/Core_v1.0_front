// ARCHIVO: useIsMobile.js
// RUTA: frontend/src/hooks/useIsMobile.js
// DESCRIPCIÓN: Hook para detectar viewport móvil (matchMedia).

import { useState, useEffect } from 'react';

export const useIsMobile = (breakpoint = 640) => {
  const [isMobile, setIsMobile] = useState(() => window.matchMedia(`(max-width: ${breakpoint}px)`).matches);

  useEffect(() => {
    const mql = window.matchMedia(`(max-width: ${breakpoint}px)`);
    const handler = (e) => setIsMobile(e.matches);
    mql.addEventListener('change', handler);
    return () => mql.removeEventListener('change', handler);
  }, [breakpoint]);

  return isMobile;
};

export default useIsMobile;
