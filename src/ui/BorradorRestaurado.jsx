// BookOS - BorradorRestaurado.jsx
// ruta: bookos/frontend/src/ui/BorradorRestaurado.jsx
// descripcion: aviso sutil de que la pantalla tiene trabajo recuperado del disco (la sesion del
//   usuario sobrevive al refrescar). El boton "↺ limpiar" arranca de cero: es el unico gesto
//   para descartar el borrador. Vive en un solo lugar para que todas las paginas se vean igual.

export default function BorradorRestaurado({ visible = false, onLimpiar = null, className = 'text-xs text-muted' }) {
  if (!visible) return null;
  return (
    <span className={className}>
      ↺ borrador recuperado
      {onLimpiar && (
        <button type="button" className="btn btn-ghost text-xs ml-1" title="Descartar lo recuperado y empezar de cero" onClick={onLimpiar}>
          ↺ limpiar
        </button>
      )}
    </span>
  );
}
