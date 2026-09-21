// BookOS - Modal.jsx
// ruta: bookos/frontend/src/ui/Modal.jsx
// descripcion: modal base del OS. Todo lo que crea/edita pasa por aca para no
//   perder trabajo al navegar. Cierra con ESC.

import { useEffect } from 'react';

export default function Modal({ abierto, onClose, titulo, children, footer, ancho = '720px' }) {
  useEffect(() => {
    if (!abierto) return undefined;
    const alEscape = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', alEscape);
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', alEscape);
      document.body.style.overflow = '';
    };
  }, [abierto, onClose]);

  if (!abierto) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" style={{ maxWidth: ancho }} onClick={(e) => e.stopPropagation()}>
        <div className="modal-header flex items-center justify-between px-6 py-4">
          <h3 className="font-semibold text-base">{titulo}</h3>
          <button type="button" className="btn btn-ghost text-muted" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body px-6 py-4">{children}</div>
        {footer && (
          <div className="modal-footer flex justify-end gap-2 px-6 py-4">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
