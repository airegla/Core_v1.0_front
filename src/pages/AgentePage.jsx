// BookOS - AgentePage.jsx
// ruta: bookos/frontend/src/pages/AgentePage.jsx
// descripcion: el agente en el Kernel (es uno solo: Secretario y Asistente de ventas comparten
//   motor). Muestra su estado (LLM, modelo, pasos, presupuesto), sus toggles (prompt completo o
//   hibrido, cuantas herramientas con manual completo, pasos del loop, techo de contexto) y el
//   inventario de herramientas con el uso real (la automejora: lo calibra la reflexion).
//   El MODELO CHICO LOCAL no se ajusta aca: sus toggles, su semilla y su indice viven en
//   Kernel > Modelo local, y su medicion en Kernel > Banco de pruebas.

import { useEffect, useState } from 'react';
import Toggle from '../ui/Toggle';
import DebugTag from '../ui/DebugTag';
import { configApi, kernelApi } from '../api/api';

// NOTA de menu (2026-09-20): este modulo vive en Core ▾ Agent ▾ Agente; el modelo chico en
// Core ▾ LLM ▾ Modelo local y su banco en Core ▾ LLM ▾ Banco del modelo chico.

export default function AgentePage({ esAdmin }) {
  const [agente, setAgente] = useState(null);
  const [catalogo, setCatalogo] = useState([]);
  const [inventario, setInventario] = useState(null);
  const [mensaje, setMensaje] = useState('');
  const [cargando, setCargando] = useState(false);

  const cargar = async () => {
    try {
      const res = await configApi.obtener();
      setAgente(res.data.agente || null);
      // Solo el grupo 'agente'. Los toggles del MODELO CHICO tienen su propio grupo ('chico') y su
      // pantalla (Kernel > Modelo local): antes se pintaban aca tambien, y la misma clave quedaba en
      // dos lugares con dos relatos distintos.
      setCatalogo((res.data.catalogo || []).filter((c) => c.grupo === 'agente'));
      const inv = await kernelApi.herramientas();
      setInventario(inv.data || null);
    } catch (err) {
      setMensaje(`⚠️ ${err.message}`);
    }
  };

  useEffect(() => { cargar(); }, []); // eslint-disable-line

  const activoDe = (t) => !(t.valor === false || t.valor === 'false' || t.valor === '0' || t.valor === '');

  const cambiar = async (clave, valor) => {
    try {
      await configApi.setToggle(clave, valor);
      setMensaje(`${clave} → ${valor ? 'activo' : 'apagado'}`);
      cargar();
    } catch (err) {
      setMensaje(`⚠️ ${err.message}`);
    }
  };

  const cambiarNumero = async (clave, valor) => {
    try {
      await configApi.setToggle(clave, valor);
      setMensaje(`${clave} → ${valor}`);
      cargar();
    } catch (err) {
      setMensaje(`⚠️ ${err.message}`);
    }
  };

  const recalibrar = async () => {
    setCargando(true);
    try {
      const r = await kernelApi.herramientasCalibrar();
      const d = r.data || {};
      setMensaje(`Calibrado: ${d.total} herramientas con manual completo (${(d.entran || []).length} entran, ${(d.salen || []).length} salen; ${d.sinUso} sin uso).`);
      cargar();
    } catch (err) {
      setMensaje(`⚠️ ${err.message}`);
    } finally {
      setCargando(false);
    }
  };

  const sinUso = inventario ? inventario.sinUso || [] : [];
  const uso = inventario ? inventario.uso || [] : [];

  return (
    <div>
      <DebugTag nombre="AgentePage" />
      <h2 className="text-lg font-semibold mb-4">Agente</h2>
      {mensaje && <p className="text-sm mb-3">{mensaje}</p>}

      {agente && (
        <div className="card p-4 mb-4">
          <div className="text-sm space-y-1">
            <div className="flex items-center gap-2">
              <span>LLM:</span>
              <span className="agente-badge" style={{ color: agente.llmConfigurado && agente.llmEnabled ? '#15803d' : 'var(--danger)' }}>
                {agente.llmConfigurado ? (agente.llmEnabled ? 'activo' : 'apagado (LLM_ENABLED=false)') : 'sin credencial (DEEPSEEK_API_KEY vacía)'}
              </span>
            </div>
            <div className="text-muted text-xs">
              modelos: <span className="font-mono">{Array.isArray(agente.modelos) ? agente.modelos.join(', ') : agente.modelos}</span>
              {' '}· presupuesto {agente.presupuestoDia} llamadas/día · uso y rutas: Core ▾ Logs ▾ Logs del core
            </div>
            <div className="text-muted text-xs">
              El mismo motor atiende al <strong>Secretario</strong> (todas las herramientas) y al <strong>Asistente de ventas</strong> (perfil de librería): cambia la semilla y las herramientas visibles, no el agente.
            </div>
          </div>
        </div>
      )}

      <div className="card p-4 mb-4">
        <h3 className="font-semibold mb-3">Prompt y loop</h3>
        <p className="text-xs text-muted mb-3">
          Estos son los toggles del <strong>LLM pago</strong>. El modelo chico local tiene los suyos
          (encendido, modo con herramientas, pasos y chars por resultado) en
          <strong> Core ▾ LLM ▾ Modelo local</strong>, con su semilla y su índice.
        </p>
        <div className="space-y-3">
          {catalogo.map((t) => (
            <div key={t.clave} className="py-1" style={{ borderBottom: '1px solid var(--border)' }}>
              <div className="flex items-center gap-3">
                {t.tipo === 'bool' ? (
                  <>
                    <Toggle activo={activoDe(t)} onChange={(v) => cambiar(t.clave, v)} />
                    <span className="text-sm font-mono">{t.clave}</span>
                    <span className="text-xs text-muted">actual: {activoDe(t) ? 'on' : 'off'}</span>
                  </>
                ) : (
                  <>
                    <span className="text-sm font-mono">{t.clave}</span>
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
                  </>
                )}
              </div>
              <p className="text-xs text-muted mt-1">{t.descripcion}</p>
            </div>
          ))}
        </div>
      </div>

      {inventario && (
        <div className="card p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold">
              Inventario de herramientas ({inventario.total}) · {inventario.conManualCompleto.length} con manual completo
            </h3>
            {esAdmin && (
              <button type="button" className="btn text-sm" disabled={cargando} onClick={recalibrar}>
                {cargando ? 'Calibrando…' : 'Recalibrar ahora'}
              </button>
            )}
          </div>
          <p className="text-xs text-muted mb-3">
            El set de manuales completos lo <strong>calibra la reflexión</strong> con el uso real (los eventos del ejecutor y
            los turnos del agente); {inventario.enIndice} herramientas quedan en el índice del prompt y su manual se pide
            con <span className="font-mono">herramienta_ver</span>.
            {inventario.calibradoEn ? ` Última calibración: ${new Date(inventario.calibradoEn).toLocaleString('es-AR')}.` : ' Todavía sin calibrar.'}
          </p>

          <h4 className="text-sm font-semibold mb-2">Más usadas</h4>
          <div className="text-xs space-y-1 mb-4">
            {uso.length === 0 && <p className="text-muted">Sin uso registrado todavía.</p>}
            {uso.slice(0, 20).map((u) => (
              <div key={u.nombre} className="flex justify-between" style={{ borderBottom: '1px solid var(--border)' }}>
                <span className="font-mono">{u.nombre}</span>
                <span className="text-muted">{u.usos}</span>
              </div>
            ))}
          </div>

          <h4 className="text-sm font-semibold mb-2">Sin uso (candidatas a poda o consolidación)</h4>
          <div className="text-xs font-mono text-muted" style={{ lineHeight: 1.8 }}>
            {sinUso.length === 0 ? '—' : sinUso.join(' · ')}
          </div>
        </div>
      )}
    </div>
  );
}
