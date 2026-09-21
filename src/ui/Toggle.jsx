// BookOS - Toggle.jsx
// ruta: bookos/frontend/src/ui/Toggle.jsx
// descripcion: switch del OS (clases .toggle-track del globals.css).

export default function Toggle({ activo, onChange }) {
  return (
    <button
      type="button"
      className={`toggle-track ${activo ? 'active' : ''}`}
      onClick={() => onChange(!activo)}
      aria-pressed={activo}
    >
      <span className="toggle-thumb" />
    </button>
  );
}
