// BookOS - DesarrolloPage.jsx
// ruta: bookos/frontend/src/pages/DesarrolloPage.jsx
// descripcion: instalador PoC. Entrevista simple (nombre, pais, rubro, como te
//   llega el stock, como vendes). Las preguntas viven en
//   utils/desarrolloPreguntas.js: agregar una pregunta no toca codigo core.
//   Las respuestas se guardan en empresa.config (puerta abierta al JSON maestro
//   del LLM en una fase futura).

import { useState } from 'react';
import Input from '../ui/Input';
import DebugTag from '../ui/DebugTag';
import ConfigTogglesBlock from '../blocks/ConfigTogglesBlock';
import { empresaApi } from '../api/api';
import preguntas from '../utils/desarrolloPreguntas';

export default function DesarrolloPage({ esAdmin }) {
  const [respuestas, setRespuestas] = useState({});
  const [mensaje, setMensaje] = useState('');

  if (!esAdmin) {
    return <p className="text-muted">El instalador es solo para administradores.</p>;
  }

  const setRespuesta = (clave, valor) => setRespuestas({ ...respuestas, [clave]: valor });

  const instalar = async () => {
    try {
      await empresaApi.actualizar({
        nombre: respuestas.nombre || 'BookOS',
        pais: respuestas.pais || 'AR',
        rubro: respuestas.rubro || 'libreria',
        config: respuestas,
      });
      setMensaje('✓ Instalacion PoC aplicada. Respuestas guardadas en empresa.config. (En una fase futura este texto + plantillas alimentara el JSON maestro del LLM.)');
    } catch (err) {
      setMensaje(`⚠️ ${err.message}`);
    }
  };

  return (
    <div>
      <DebugTag nombre="DesarrolloPage" />
      <h2 className="text-lg font-semibold mb-1">Desarrollo</h2>
      <p className="text-sm text-muted mb-4">
        Instalador PoC. Es la espora de BookOS: aca arranca todo. No es el formulario
        gigante del futuro; es la entrevista minima. (Preguntas extensibles en utils/desarrolloPreguntas.js)
      </p>
      {mensaje && <p className="text-sm mb-3">{mensaje}</p>}

      <div className="card p-4 max-w-lg space-y-1">
        {preguntas.map((pregunta) => (
          <div key={pregunta.clave}>
            {pregunta.tipo === 'textarea' ? (
              <label className="block mb-3">
                <span className="block text-xs uppercase tracking-widest text-muted mb-1">{pregunta.etiqueta}</span>
                <textarea
                  className="input-os resize-none"
                  rows={3}
                  placeholder={pregunta.ayuda || ''}
                  value={respuestas[pregunta.clave] || ''}
                  onChange={(e) => setRespuesta(pregunta.clave, e.target.value)}
                />
              </label>
            ) : pregunta.tipo === 'select' ? (
              <label className="block mb-3">
                <span className="block text-xs uppercase tracking-widest text-muted mb-1">{pregunta.etiqueta}</span>
                <select
                  className="input-os"
                  value={respuestas[pregunta.clave] || pregunta.default || ''}
                  onChange={(e) => setRespuesta(pregunta.clave, e.target.value)}
                >
                  {pregunta.opciones.map((o) => <option key={o} value={o}>{o}</option>)}
                </select>
              </label>
            ) : (
              <Input
                label={pregunta.etiqueta}
                value={respuestas[pregunta.clave] || ''}
                onChange={(e) => setRespuesta(pregunta.clave, e.target.value)}
              />
            )}
          </div>
        ))}
        <button type="button" className="btn btn-primary" onClick={instalar}>Instalar</button>
      </div>

      <ConfigTogglesBlock
        grupo="desarrollo"
        titulo="Marcas de debug del front"
        nota="debug_mode se aplica al instante en el navegador (sin recompilar); VITE_DEBUG_MODE del build es el piso: si está en true, este toggle no lo apaga."
      />
    </div>
  );
}
