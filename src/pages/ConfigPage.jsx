// BookOS - ConfigPage.jsx
// ruta: bookos/frontend/src/pages/ConfigPage.jsx
// descripcion: configuracion del LEDGER: aca viven SOLO los interruptores que tocan stock, caja y
//   cuenta corriente (consigna, depositos, sync del legacy). El resto tiene su casa por dueno:
//   agente (Core > Agent > Agente), enriquecimiento (Core > Kernel > Enriquecimiento), modelo
//   chico (Core > LLM > Modelo local), CRM (CRM > Config CRM), bandeja de precios (Sistema >
//   Importador) y marcas de debug (Sistema > Desarrollo). Los paneles del kernel que vivian aca
//   se mudaron a Core > Kernel > Propuestas Kernel y Core > Logs > Logs del core.

import DebugTag from '../ui/DebugTag';
import ConfigTogglesBlock from '../blocks/ConfigTogglesBlock';

export default function ConfigPage() {
  // La pagina es ESTATICA: el bloque compartido lee el catalogo del backend (grupo 'sistema') y
  // cablea debug_mode al front. Antes cada pagina filtraba y pintaba el catalogo por su cuenta.

  return (
    <div>
      <DebugTag nombre="ConfigPage" />
      <h2 className="text-lg font-semibold mb-1">Configuración</h2>
      <p className="text-sm text-muted mb-4">
        Acá viven <strong>solo los interruptores del ledger</strong>: lo que toca stock, caja y cuenta
        corriente (consigna, depósitos y el sync del legacy). Todo lo demás tiene su casa por módulo:
        <strong> Core ▾ Agent ▾ Agente</strong> (LLM pago), <strong>Core ▾ Kernel ▾ Enriquecimiento</strong>
        (fuentes, ciclo y vectores), <strong>Core ▾ LLM ▾ Modelo local</strong> (modelo chico y workers),
        <strong> CRM ▾ Config CRM</strong> (mail, Telegram y toggles del CRM), <strong>Sistema ▾ Importador</strong>
        (bandeja de precios) y <strong>Sistema ▾ Desarrollo</strong> (marcas de debug).
      </p>

      <ConfigTogglesBlock
        grupo="sistema"
        titulo="Interruptores del ledger y del OS"
        nota="Editables en caliente (runtimeConfig) y leídos del catálogo del backend: una clave nueva del grupo sistema aparece sola. Las propuestas del Secretario se ven en Core ▾ Kernel ▾ Propuestas Kernel y la auditoría del ranking, en Core ▾ Logs ▾ Logs del core."
      />
    </div>
  );
}

