// BookOS - ConfigTogglesBlock.jsx
// ruta: bookos/frontend/src/blocks/ConfigTogglesBlock.jsx
// descripcion: bloque reutilizable del CATALOGO de interruptores en caliente (runtimeConfig).
//   Cada pagina lo monta con su GRUPO y el backend decide que claves entran: una clave nueva del
//   backend aparece sola en su pantalla, sin tocar el front. Cablea debug_mode al front al vuelo
//   (activarDebug) porque ese toggle es del navegador y los demas son del backend.

import { useCallback, useEffect, useState } from 'react';
import Toggle from '../ui/Toggle';
import { activarDebug } from '../ui/DebugTag';
import { configApi } from '../api/api';

export default function ConfigTogglesBlock({ grupo, titulo = null, descripcion = null, nota = null }) {
  const [catalogo, setCatalogo] = useState([]);
  const [aviso, setAviso] = useState('');

  const cargar = useCallback(async () => {
    try {
      const res = await configApi.obtener();
      setCatalogo((res.data.catalogo || []).filter((t) => t.grupo === grupo));
    } catch (err) { setAviso(`⚠️ ${err.message}`); }
  }, [grupo]);

  useEffect(() => { cargar(); }, [cargar]);

  // El catalogo ya trae el valor EFECTIVO (DB > default): adivinar el default en el front fue el
  // bug que mostraba LLM_ENABLED apagado sin estarlo.
  const activoDe = (t) => !(t.valor === false || t.valor === 'false' || t.valor === '0' || t.valor === '');

  const cambiarToggle = async (clave, valor) => {
    try {
      await configApi.setToggle(clave, valor);
      if (clave === 'debug_mode') activarDebug(valor);
      setAviso(`Toggle ${clave} → ${valor ? 'activo' : 'apagado'}`);
      cargar();
    } catch (err) { setAviso(`⚠️ ${err.message}`); }
  };

  const cambiarNumero = async (clave, valor) => {
    try {
      await configApi.setToggle(clave, valor);
      setAviso(`Toggle ${clave} → ${valor}`);
      cargar();
    } catch (err) { setAviso(`⚠️ ${err.message}`); }
  };

  return (
    <div className="card p-4 mb-4">
      {titulo && <h3 className="font-semibold mb-2">{titulo}</h3>}
      {descripcion && <p className="text-sm text-muted mb-3">{descripcion}</p>}
      {aviso && <p className="text-sm mb-3">{aviso}</p>}
      {catalogo.length === 0 && !aviso && <p className="text-xs text-muted">No hay interruptores en este grupo.</p>}
      <div className="space-y-3">
        {catalogo.map((t) => {
          // Una clave SIN CABLEAR (ningun codigo la lee) NO se dibuja con interruptor: ofrecer un
          // control que no hace nada es peor que no tenerlo. Queda visible con su motivo, que es informacion.
          const cableada = t.cableada !== false;
          return (
            <div key={t.clave}>
              <div className="flex items-center gap-3">
                {!cableada && <span className="agente-badge" style={{ color: 'var(--danger)' }}>sin cablear</span>}
                {cableada && t.tipo === 'bool' && (
                  <Toggle activo={activoDe(t)} onChange={(v) => cambiarToggle(t.clave, v)} />
                )}
                <span className="text-sm font-mono">{t.clave}</span>
                {cableada && t.tipo !== 'bool' && (
                  <input
                    type="number"
                    className="input-os"
                    style={{ maxWidth: 120 }}
                    defaultValue={t.valor}
                    onBlur={(e) => {
                      const v = e.target.value;
                      if (String(v) !== String(t.valor)) cambiarNumero(t.clave, v);
                    }}
                  />
                )}
              </div>
              <p className="text-xs text-muted mt-1">{t.descripcion}</p>
            </div>
          );
        })}
      </div>
      {nota && <p className="text-xs text-muted mt-3">{nota}</p>}
    </div>
  );
}
