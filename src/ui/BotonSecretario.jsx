// BookOS - BotonSecretario.jsx
// ruta: bookos/frontend/src/ui/BotonSecretario.jsx
// descripcion: boton unico para hablar con el Secretario. Reemplaza los botones sueltos
//   "Preguntar al Secretario" repartidos por el front: el icono, el texto, el tooltip y el
//   comportamiento viven en un solo lugar (si algun dia el boton desaparece, se borra aca).
//   Recibe la consulta ya armada por la vista y la deja en el bus del contexto, que la lleva
//   al chat. Con `alPedir` la vista puede ademas cerrar su modal.

import { useAppContext } from '../AppContext';

export default function BotonSecretario({
  consulta = null,
  texto = 'Secretario', // texto visible ('' o soloIcono lo ocultan)
  soloIcono = false,
  className = 'btn btn-ghost',
  titulo = 'Hablar con el Secretario',
  disabled = false,
  alPedir = null,
}) {
  const { pedirConsulta } = useAppContext();

  const pedir = () => {
    if (consulta && pedirConsulta) pedirConsulta(consulta);
    if (alPedir) alPedir();
  };

  return (
    <button
      type="button"
      className={className}
      title={titulo}
      aria-label={titulo}
      disabled={disabled}
      onClick={pedir}
    >
      <span aria-hidden="true">💬</span>
      {soloIcono || !texto ? null : <span className="ml-1">{texto}</span>}
    </button>
  );
}
