// BookOS - CrmEnConstruccion.jsx
// ruta: bookos/frontend/src/pages/CrmEnConstruccion.jsx
// descripcion: placeholder honesto de las paginas del CRM que llegan en etapas posteriores
//   (doc 06): dice que es, para que sirve y en que etapa del plan se construye.

import DebugTag from '../ui/DebugTag';

export default function CrmEnConstruccion({ titulo, etapa, detalle }) {
  return (
    <div>
      <DebugTag nombre={`CRM:${titulo}`} />
      <h2 className="text-lg font-semibold mb-1">{titulo}</h2>
      <p className="text-sm text-muted mb-3">{detalle}</p>
      <div className="card p-4 text-sm">
        <p className="mb-1">🚧 Llega con la etapa <strong>{etapa}</strong> del plan CRM.</p>
        <p className="text-muted">
          Plan completo: <span className="font-mono">plan-rediseno/06-MERGE-BOOKRM.md</span>
        </p>
      </div>
    </div>
  );
}
