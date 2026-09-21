// BookOS - ModeloChicoBlock.jsx
// ruta: bookos/frontend/src/blocks/ModeloChicoBlock.jsx
// descripcion: panel del modelo chico local CON HERRAMIENTAS (laboratorio). Muestra su estado y el
//   de su worker, sus interruptores y topes editables en caliente (los del grupo 'chico' del
//   catalogo del backend, no una lista escrita aca), el indice compacto de las herramientas para
//   ajustarlo a mano (descripcion por modulo; las acciones salen del contrato y no se editan desde
//   aca), la semilla corta y el prompt final que recibe el modelo.
//   Lo monta la pantalla Core > LLM > Modelo local.
//   Regla del laboratorio: lo que el motor usa tiene que poder verse y tocarse desde el front; si
//   algo no esta en esta pantalla, el vectorHumano no puede accederlo.

import { useEffect, useState } from 'react';
import Toggle from '../ui/Toggle';
import { configApi, kernelApi } from '../api/api';

// El GRUPO del catalogo que esta pantalla edita. No se listan las claves a mano: se dibujan las que
// el backend declare con `grupo: 'chico'`, asi una clave nueva de ese grupo aparece sola (antes
// estaban las cuatro clavadas aca y una quinta quedaba invisible sin que nada lo dijera).
const GRUPO = 'chico';
// Las dos claves que el ENCABEZADO necesita entender (no solo mostrar): ENCENDIDO es el modelo en
// uso y el que hace el override del LLM pago; MODO lo pone a trabajar con herramientas y REQUIERE el
// encendido. El resto de la fila se dibuja sola desde el catalogo.
const CLAVE_ENCENDIDO = 'LLM_CHICO_ENABLED';
const CLAVE_MODO = 'LLM_CHICO_TOOLS_ENABLED';
// Etiqueta corta para las claves conocidas; una clave nueva del grupo cae en la descripcion larga
// del catalogo (se muestra igual, solo mas verbosa).
const AYUDA = {
  [CLAVE_ENCENDIDO]: 'enciende el modelo local y hace el override del LLM pago',
  [CLAVE_MODO]: 'modo: loop con herramientas',
  LLM_CHICO_TOOLS_PASOS: 'pasos de herramienta por turno',
  LLM_CHICO_TOOLS_MAX_CHARS: 'chars por resultado de herramienta',
};

// Valor efectivo de un toggle guardado (misma normalizacion que el resto del OS).
const activoDe = (v) => !(v === false || v === 'false' || v === '0' || v === '' || v === undefined || v === null);

export default function ModeloChicoBlock() {
  const [estado, setEstado] = useState(null);
  const [toggles, setToggles] = useState({});
  const [catalogo, setCatalogo] = useState([]);
  const [filas, setFilas] = useState([]);
  const [semilla, setSemilla] = useState('');
  const [aviso, setAviso] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [verPrompt, setVerPrompt] = useState(false);

  const cargar = async () => {
    try {
      // El estado del chico trae las filas EFECTIVAS (lo guardado o la semilla): el editor muestra
      // siempre lo que el modelo recibe de verdad, no un borrador aparte.
      const [chico, cfg] = await Promise.all([kernelApi.chicoEstado(), configApi.obtener()]);
      const d = chico.data || {};
      setEstado(d);
      setToggles(cfg.data.toggles || {});
      setCatalogo(cfg.data.catalogo || []);
      setFilas(Array.isArray(d.filas) ? d.filas.map((f) => ({ ...f })) : []);
      setSemilla(d.semilla || '');
    } catch (err) {
      setAviso(`⚠️ ${err.message}`);
    }
  };

  useEffect(() => { cargar(); }, []); // eslint-disable-line

  const cambiarToggle = async (clave, valor) => {
    try {
      await configApi.setToggle(clave, valor);
      setAviso(`${clave} → ${valor}`);
      await cargar();
    } catch (err) {
      setAviso(`⚠️ ${err.message}`);
    }
  };

  const editarDescripcion = (modulo, valor) => {
    setFilas((prev) => prev.map((f) => (f.modulo === modulo ? { ...f, descripcion: valor } : f)));
  };

  const guardar = async () => {
    setGuardando(true);
    try {
      const r = await kernelApi.chicoGuardar({ indice: filas, semilla });
      const d = r.data || {};
      setAviso(`Guardado: ${d.indice ? `${d.indice.modulos} modulos, ${d.indice.chars} chars (~${d.indice.tokensAprox} tokens)` : 'ok'} · fuente ${d.indice ? d.indice.fuente : '—'}`);
      await cargar();
    } catch (err) {
      setAviso(`⚠️ ${err.message}`);
    } finally {
      setGuardando(false);
    }
  };

  const volverASemilla = async () => {
    setGuardando(true);
    try {
      await kernelApi.chicoGuardar({ reset: true });
      setAviso('Indice y semilla vueltos a la semilla del laboratorio');
      await cargar();
    } catch (err) {
      setAviso(`⚠️ ${err.message}`);
    } finally {
      setGuardando(false);
    }
  };

  const indice = (estado && estado.indice) || null;
  const worker = (estado && estado.worker) || null;
  // Las filas del panel salen del CATALOGO (grupo 'chico'), no de una lista escrita aca. El valor de
  // cada una es el EFECTIVO (el catalogo ya combina lo guardado con el default del .env): mostrar el
  // input vacio hacia creer que el motor no tenia tope.
  const filasToggles = catalogo.filter((t) => t.grupo === GRUPO);
  const valorDe = (clave) => {
    const def = catalogo.find((c) => c.clave === clave);
    return def ? def.valor : undefined;
  };
  const encendido = activoDe(valorDe(CLAVE_ENCENDIDO));
  const modo = activoDe(valorDe(CLAVE_MODO));
  const activo = encendido && modo;          // el chat lo usa solo con los dos puestos
  // Mientras se escribe un numero manda el borrador local; al salir del campo se guarda.
  const enEdicion = (clave, valorEfectivo) => {
    const borrador = toggles[clave];
    return borrador !== undefined && borrador !== null && borrador !== '' ? borrador : valorEfectivo;
  };

  return (
    <div className="card p-4 mb-4">
      <div className="flex items-center justify-between gap-2 mb-2">
        <h3 className="font-semibold">Modelo chico con herramientas</h3>
        <span className="agente-badge" style={{ color: activo ? '#15803d' : 'var(--danger)' }}>
          {activo
            ? 'ENCENDIDO + MODO: el chat usa el chico (override del LLM pago)'
            : (encendido ? 'ENCENDIDO sin modo: solo frasea sobre la plantilla' : 'APAGADO: el chat usa el LLM pago')}
        </span>
      </div>
      <p className="text-sm text-muted mb-3">
        Modelo local con el mismo loop de herramientas que el LLM pago, pero con un contrato propio:
        indice compacto en vez del manual completo y menos pasos. Son DOS interruptores: el de
        ENCENDIDO es el que hace el override del LLM pago, y el de MODO lo pone a trabajar con herramientas
        (con el encendido apagado, el modo no hace nada). Requiere el worker levantado (abajo). Ocupa RAM
        mientras esta cargado: medido en este i5 el 15-Sep-2026, 1,5 GB al cargar y un RSS de proceso que
        crece con el uso hasta ~5,4 GB (el modelo NO se libera al soltarlo: el proceso no devuelve esa
        memoria al sistema).
      </p>

      {aviso && <p className="text-sm mb-3">{aviso}</p>}

      {estado && (
        <div className="text-xs text-muted mb-3 space-y-1">
          <div>
            worker: <span className="font-mono">{worker && worker.ok ? `escuchando (${worker.ramMB} MB${worker.cargado ? ', modelo cargado' : ', modelo sin cargar'})` : `apagado${worker && worker.motivo ? ` (${worker.motivo})` : ''}`}</span>
          </div>
          {indice && (
            <div>
              indice: <span className="font-mono">{indice.modulos} modulos · {indice.accionesTotales} acciones · {indice.chars} chars (~{indice.tokensAprox} tokens)</span>
              {' '}· fuente <span className="font-mono">{indice.fuente}</span>
              {' '}· el manual completo serian <span className="font-mono">~{Math.round(indice.charsManualCompleto / 4)} tokens</span>
            </div>
          )}
          <div>prompt completo que recibe: <span className="font-mono">{estado.promptChars} chars (~{Math.round((estado.promptChars || 0) / 4)} tokens)</span></div>
        </div>
      )}

      <div className="mb-3">
        {filasToggles.length === 0 && (
          <p className="text-sm text-muted">
            El catalogo del backend no tiene ninguna clave con <span className="font-mono">grupo: '{GRUPO}'</span>.
          </p>
        )}
        {filasToggles.map((t) => {
          // El MODO se apaga visualmente cuando el encendido esta en off: es la unica dependencia
          // entre dos toggles de este grupo y hay que verla, no deducirla.
          const requiereEncendido = t.clave === CLAVE_MODO;
          const etiqueta = AYUDA[t.clave] || t.descripcion;
          return (
            <div
              key={t.clave}
              className="flex justify-between items-center py-2 gap-3"
              style={{ borderBottom: '1px solid var(--border)', opacity: requiereEncendido && !encendido ? 0.55 : 1 }}
            >
              <span className="text-sm">
                {t.clave}
                <span className="text-xs text-muted">
                  {' — '}{etiqueta}{requiereEncendido && !encendido ? ' (requiere el toggle de encendido)' : ''}
                </span>
              </span>
              {t.tipo === 'bool' ? (
                <Toggle activo={activoDe(t.valor)} onChange={(v) => cambiarToggle(t.clave, v)} />
              ) : (
                <input
                  type="number"
                  className="input text-sm"
                  style={{ width: 90 }}
                  value={enEdicion(t.clave, t.valor)}
                  onChange={(e) => setToggles((p) => ({ ...p, [t.clave]: e.target.value }))}
                  onBlur={(e) => cambiarToggle(t.clave, Number(e.target.value))}
                />
              )}
            </div>
          );
        })}
      </div>

      <details className="mb-3">
        <summary className="text-sm font-medium cursor-pointer">Semilla corta</summary>
        <p className="text-xs text-muted my-2">
          Lo primero que lee el modelo, en lugar de la semilla del Secretario (que esta escrita para un modelo grande).
        </p>
        <textarea
          className="input text-xs font-mono"
          rows={4}
          style={{ width: '100%' }}
          value={semilla}
          onChange={(e) => setSemilla(e.target.value)}
        />
      </details>

      <details className="mb-3">
        <summary className="text-sm font-medium cursor-pointer">
          Indice de las 33 herramientas ({filas.length} modulos)
        </summary>
        <p className="text-xs text-muted my-2">
          Ajustá la descripcion de cada modulo (pocas palabras). Las acciones NO se editan aca: se leen del
          contrato real de las herramientas, asi el indice no puede desincronizarse de lo que existe.
        </p>
        <div className="space-y-1">
          {filas.map((f) => (
            <div key={f.modulo} className="flex items-center gap-2">
              <span className="text-xs font-mono" style={{ width: 130, flexShrink: 0 }}>{f.modulo}</span>
              <input
                type="text"
                className="input text-xs"
                style={{ flex: 1 }}
                value={f.descripcion || ''}
                placeholder="descripcion corta"
                onChange={(e) => editarDescripcion(f.modulo, e.target.value)}
              />
              <span className="text-xs text-muted truncate" style={{ maxWidth: 260 }} title={(f.acciones || []).join(', ')}>
                {(f.acciones || []).length} acc.
              </span>
            </div>
          ))}
        </div>
      </details>

      <div className="flex gap-2 mb-3">
        <button type="button" className="btn btn-primary text-sm" onClick={guardar} disabled={guardando}>
          {guardando ? 'Guardando…' : 'Guardar ajuste'}
        </button>
        <button type="button" className="btn btn-ghost text-sm" onClick={volverASemilla} disabled={guardando}>
          Volver a la semilla
        </button>
        <button type="button" className="btn text-sm" onClick={() => setVerPrompt((v) => !v)}>
          {verPrompt ? 'Ocultar prompt' : 'Ver prompt exacto'}
        </button>
        <button type="button" className="btn text-sm" onClick={cargar}>Refrescar</button>
      </div>

      {verPrompt && estado && (
        <pre className="text-xs font-mono p-2" style={{ background: 'var(--bg-soft)', border: '1px solid var(--border)', maxHeight: 320, overflow: 'auto', whiteSpace: 'pre-wrap' }}>
          {estado.lineas || ''}
          {'\n\n'}
          {estado.restricciones || ''}
        </pre>
      )}
    </div>
  );
}
