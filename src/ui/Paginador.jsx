// BookOS - Paginador.jsx
// ruta: bookos/frontend/src/ui/Paginador.jsx
// descripcion: controles de paginacion server-side (page / limite / total) para
//   los listados del OS. Patron bookerp: el backend pagina, la vista solo navega.

export default function Paginador({ page, total, limite = 30, onCambiar, etiqueta = 'registros' }) {
  const totalPaginas = Math.max(Math.ceil((Number(total) || 0) / (Number(limite) || 30)), 1);
  if (!total) return null;
  return (
    <div className="flex justify-between items-center mt-4 text-sm text-muted flex-wrap gap-2">
      <span>
        Pagina {page} de {totalPaginas} · {Number(total).toLocaleString('es-AR')} {etiqueta}
      </span>
      <div className="flex gap-2">
        <button type="button" className="btn btn-ghost" disabled={page <= 1} onClick={() => onCambiar(page - 1)}>
          Anterior
        </button>
        <button type="button" className="btn btn-ghost" disabled={page >= totalPaginas} onClick={() => onCambiar(page + 1)}>
          Siguiente
        </button>
      </div>
    </div>
  );
}
