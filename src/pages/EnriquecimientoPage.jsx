// BookOS - EnriquecimientoPage.jsx
// ruta: bookos/frontend/src/pages/EnriquecimientoPage.jsx
// descripcion: pantalla del ENRIQUECIMIENTO (Core > Kernel > Enriquecimiento). Reune los
//   interruptores que gobiernan de donde sale el entendimiento del catalogo: las FUENTES de
//   sinopsis, el CICLO automatico de la cola y el WORKER de embeddings (el motor de vectores).
//   Antes vivian repartidos en Sistema > Config, donde no se los encontraba. La cola se mira en
//   Core > Kernel > Cola y el resultado del pipeline en Core > Salud.

import DebugTag from '../ui/DebugTag';
import ConfigTogglesBlock from '../blocks/ConfigTogglesBlock';

export default function EnriquecimientoPage({ esAdmin }) {
  return (
    <div>
      <DebugTag nombre="EnriquecimientoPage" />
      <h2 className="text-lg font-semibold mb-1">Enriquecimiento</h2>
      <p className="text-sm text-muted mb-4">
        De acá sale lo que el buscador semántico entiende: cada artículo pasa por las <strong>fuentes
        externas</strong> (una sinopsis de Google Books, Wikipedia, etc.), se le escribe un digesto con
        el LLM y se vectoriza. El pipeline tiene dueño manual
        (<span className="font-mono">node scripts/enriquecer.js</span>) y puede correr solo con el ciclo
        automático. Los pendientes se ven en <strong>Core ▾ Kernel ▾ Cola</strong>; el estado del
        pipeline, en <strong>Core ▾ Salud</strong>.
      </p>

      <ConfigTogglesBlock
        grupo="enriquecimiento"
        titulo="Interruptores del enriquecimiento"
        nota="Cada clave es un interruptor en caliente (runtimeConfig): rige en la próxima corrida del
          pipeline. Apagado el ciclo, un artículo sigue en el catálogo y se vende, pero no entra a la
          búsqueda semántica hasta tener digesto y vectores."
      />

      <div className="card p-4">
        <div className="text-sm font-medium mb-2">Qué toca cada uno</div>
        <ul className="text-xs text-muted space-y-1">
          <li><strong>Fuentes</strong>: apagada, el pipeline la saltea (además cada fuente tiene su breaker si falla sola).</li>
          <li><strong>ENRIQUECIMIENTO_CICLO_ENABLED / ENRIQUECIMIENTO_LOTE</strong>: el ciclo por tandas cada 15 minutos; consume LLM mientras haya pendientes.</li>
          <li><strong>EMBEDDINGS_WORKER_AUTO</strong>: arranque del worker de vectores (puerto 3010). Levantarlo o pararlo a mano, en <strong>Core ▾ LLM ▾ Modelo local</strong>.</li>
        </ul>
      </div>
    </div>
  );
}
