// BookOS - Input.jsx
// ruta: bookos/frontend/src/ui/Input.jsx
// descripcion: input estandarizado del OS (clase .input-os).

export default function Input({ label, ...props }) {
  return (
    <label className="block mb-3">
      {label && <span className="field-label">{label}</span>}
      <input className="input-os" {...props} />
    </label>
  );
}
