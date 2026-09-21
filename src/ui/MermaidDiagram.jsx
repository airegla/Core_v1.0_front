// BookOS - MermaidDiagram.jsx
// ruta: bookos/frontend/src/ui/MermaidDiagram.jsx
// descripcion: renderiza un diagrama Mermaid (texto) como SVG dentro del manual.

import { useEffect, useRef, useState } from 'react';
import mermaid from 'mermaid';

let inicializado = false;
let contador = 0;

function inicializar() {
  if (inicializado) return;
  // El manual vive en un modal claro: theme neutral legible en claro u oscuro.
  mermaid.initialize({ startOnLoad: false, theme: 'neutral', securityLevel: 'loose' });
  inicializado = true;
}

export default function MermaidDiagram({ codigo }) {
  const ref = useRef(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let vigente = true;
    inicializar();
    contador += 1;
    const id = `mermaid-diagram-${contador}`;
    mermaid
      .render(id, codigo)
      .then(({ svg }) => {
        if (vigente && ref.current) ref.current.innerHTML = svg;
      })
      .catch((e) => {
        if (vigente) setError(e && e.message ? e.message : 'No se pudo renderizar el diagrama');
      });
    return () => { vigente = false; };
  }, [codigo]);

  if (error) {
    return <pre className="text-xs text-muted card p-3 my-3" style={{ overflowX: 'auto' }}>{codigo}</pre>;
  }
  return <div ref={ref} className="my-3" style={{ overflowX: 'auto', textAlign: 'center' }} />;
}
