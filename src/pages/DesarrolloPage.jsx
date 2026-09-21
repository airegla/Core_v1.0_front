// BookOS Core - DesarrolloPage.jsx
// ruta: Core/frontend/src/pages/DesarrolloPage.jsx
// descripcion: panel de DESARROLLO e instalacion asistida del Core standalone. Contra la API real
//   (/api/desarrollo): estado del sistema, dump del origen (registrar por ruta o subir hasta
//   60 MB), analisis estructural del .sql con las plantillas de migracion, y los pasos que faltan
//   declarados con su motivo (nada finge estar hecho). La entrevista de la empresa
//   (utils/desarrolloPreguntas.js) se conserva; el chat del Secretario guia desde el lateral.

import { useCallback, useEffect, useState } from 'react';
import Input from '../ui/Input';
import DebugTag from '../ui/DebugTag';
import ConfigTogglesBlock from '../blocks/ConfigTogglesBlock';
import { empresaApi, desarrolloApi } from '../api/api';
import preguntas from '../utils/desarrolloPreguntas';

const mb = (bytes) => `${(bytes / 1048576).toFixed(2)} MB`;

const COLOR_ESTADO = {
  disponible: 'var(--accent)',
  'disponible-cli': 'var(--accent)',
  'requiere-legacy': '#b26a00',
  pendiente: 'var(--danger)',
};

// Niveles de la verificacion de punta a punta (practica [31]): tres, no dos.
const COLOR_NIVEL = { OK: 'var(--accent)', ATENCION: '#b26a00', FALLA: 'var(--danger)' };

// Vias del plan de mapeo: la semantica es la unica que aplico una equivalencia propuesta por el
// LLM (con confianza y motivo): se muestra distinto para que el operador la vea.
const COLOR_VIA = { directa: 'var(--accent)', semantica: '#1e88e5', plantilla: '#8e24aa', sintesis: 'var(--text-muted)' };

function Badge({ estado }) {
  return (
    <span className="text-xs font-bold" style={{ color: COLOR_ESTADO[estado] || 'var(--text-muted)' }}>
      [{estado}]
    </span>
  );
}

export default function DesarrolloPage({ esAdmin }) {
  const [situacion, setSituacion] = useState(null);
  const [error, setError] = useState('');
  const [mensaje, setMensaje] = useState('');
  const [rutaDump, setRutaDump] = useState('');
  const [subiendo, setSubiendo] = useState(false);
  const [analisis, setAnalisis] = useState(null);
  const [analizando, setAnalizando] = useState('');
  const [migracion, setMigracion] = useState(null);
  const [migrando, setMigrando] = useState('');
  const [limpiando, setLimpiando] = useState('');
  const [modulos, setModulos] = useState(null);
  const [creandoModulo, setCreandoModulo] = useState('');
  const [resultadoModulo, setResultadoModulo] = useState(null);
  const [deshaciendo, setDeshaciendo] = useState('');
  const [trabajo, setTrabajo] = useState(null);
  const [respuestas, setRespuestas] = useState({});
  const [mensajeEntrevista, setMensajeEntrevista] = useState('');

  const cargar = useCallback(() => {
    setError('');
    desarrolloApi
      .situacion()
      .then((r) => setSituacion(r.data))
      .catch((e) => setError(e.message));
    desarrolloApi
      .modulos()
      .then((r) => setModulos(r.data))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (esAdmin) cargar();
  }, [esAdmin, cargar]);

  // Progreso del lote automatico: mientras hay un trabajo activo, se consulta cada 4 s.
  useEffect(() => {
    if (!trabajo || !trabajo.activo) return undefined;
    const id = setInterval(() => {
      desarrolloApi
        .trabajo()
        .then((r) => {
          setTrabajo(r.data);
          if (r.data && !r.data.activo) cargar();
        })
        .catch(() => {});
    }, 4000);
    return () => clearInterval(id);
  }, [trabajo, cargar]);

  if (!esAdmin) {
    return <p className="text-muted">El instalador es solo para administradores.</p>;
  }

  const registrarRuta = async () => {
    try {
      setError('');
      const r = await desarrolloApi.registrarDump(rutaDump);
      setMensaje(`✓ ${r.message}: ${r.data.archivo} (${mb(r.data.bytes)})`);
      setRutaDump('');
      cargar();
    } catch (e) {
      setError(e.message);
    }
  };

  const subirArchivo = async (file) => {
    if (!file) return;
    if (file.size > 60 * 1024 * 1024) {
      setError(`El archivo pesa ${mb(file.size)}: el tope de subida es 60 MB. Copialo al servidor (backend/migration_dump/) y registralo por ruta.`);
      return;
    }
    setSubiendo(true);
    setError('');
    try {
      const base64 = await new Promise((resolve, reject) => {
        const lector = new FileReader();
        lector.onload = () => resolve(String(lector.result).split(',')[1]);
        lector.onerror = () => reject(new Error('No se pudo leer el archivo'));
        lector.readAsDataURL(file);
      });
      const r = await desarrolloApi.subirDump(file.name, base64);
      setMensaje(`✓ ${r.message}: ${r.data.archivo} (${mb(r.data.bytes)})`);
      cargar();
    } catch (e) {
      setError(e.message);
    } finally {
      setSubiendo(false);
    }
  };

  const analizar = async (archivo) => {
    setAnalizando(archivo);
    setError('');
    try {
      const r = await desarrolloApi.analizar(archivo);
      setAnalisis(r.data);
    } catch (e) {
      setError(e.message);
    } finally {
      setAnalizando('');
    }
  };

  const migrar = async (archivo) => {
    setMigrando(archivo);
    setError('');
    try {
      const r = await desarrolloApi.migrar(archivo);
      setMigracion(r.data);
      cargar();
    } catch (e) {
      setError(e.message);
    } finally {
      setMigrando('');
    }
  };

  const limpiarEspejo = async (espejo) => {
    setLimpiando(espejo);
    setError('');
    try {
      const r = await desarrolloApi.limpiarEspejo(espejo);
      setMensaje(`✓ ${r.message}: ${r.data.espejo}`);
      if (migracion && migracion.espejo === espejo) setMigracion(null);
      cargar();
    } catch (e) {
      setError(e.message);
    } finally {
      setLimpiando('');
    }
  };

  const crearModulo = async (tabla) => {
    setCreandoModulo(tabla);
    setError('');
    try {
      const r = await desarrolloApi.crearModulo(tabla);
      setResultadoModulo(r.data);
      cargar();
    } catch (e) {
      setError(e.message);
    } finally {
      setCreandoModulo('');
    }
  };

  const deshacerModulo = async (nombre) => {
    setDeshaciendo(nombre);
    setError('');
    try {
      const r = await desarrolloApi.deshacerModulo(nombre);
      setMensaje(`✓ ${r.message}: ${r.data.nombre}`);
      setResultadoModulo(null);
      cargar();
    } catch (e) {
      setError(e.message);
    } finally {
      setDeshaciendo('');
    }
  };

  const desarrollarTodo = async () => {
    setError('');
    try {
      const r = await desarrolloApi.desarrollarTodo(null);
      setTrabajo(r.data.trabajo || null);
      if (r.data && r.data.iniciado === false) setMensaje(r.data.motivo || 'Ya hay un desarrollo en curso');
    } catch (e) {
      setError(e.message);
    }
  };

  const guardarEntrevista = async () => {
    try {
      await empresaApi.actualizar({
        nombre: respuestas.nombre || 'BookOS',
        pais: respuestas.pais || 'AR',
        rubro: respuestas.rubro || 'libreria',
        config: respuestas,
      });
      setMensajeEntrevista('✓ Entrevista guardada en empresa.config.');
    } catch (err) {
      setMensajeEntrevista(`⚠️ ${err.message}`);
    }
  };

  const setRespuesta = (clave, valor) => setRespuestas({ ...respuestas, [clave]: valor });

  return (
    <div>
      <DebugTag nombre="DesarrolloPage" />
      <h2 className="text-lg font-semibold mb-1">Desarrollo — instalacion asistida</h2>
      <p className="text-sm text-muted mb-4">
        El Core se instala y migra un sistema legacy (dump o base viva) desde aca. Los pasos sin
        motor todavia se declaran con su motivo: nada finge estar hecho.
      </p>
      {error && <p className="text-sm mb-3" style={{ color: 'var(--danger)' }}>⚠️ {error}</p>}
      {mensaje && <p className="text-sm mb-3">{mensaje}</p>}

      {/* Paso 0 — Sistema */}
      <div className="card p-4 mb-4">
        <div className="flex items-center justify-between mb-2">
          <h3 className="font-semibold">Sistema</h3>
          <button type="button" className="btn" onClick={cargar}>Actualizar</button>
        </div>
        {!situacion && !error && <p className="text-sm text-muted">Consultando el estado del Core...</p>}
        {situacion && (
          <div className="text-sm space-y-1">
            <p>
              Base: {situacion.base.conectada ? 'conectada' : 'SIN CONEXION'}
              {situacion.base.conectada ? ` · migraciones ${situacion.base.migracionesAplicadas}/${situacion.base.migracionesDeclaradas}${situacion.base.migracionesAlDia ? '' : ' (PENDIENTES)'}` : ` · ${situacion.base.motivo || ''}`}
              {' · '}API :{situacion.puertoApi} · Core v{situacion.version}
            </p>
            <p>
              Legacy: {situacion.legacy.configurado ? `configurado (${situacion.legacy.host})` : 'sin configurar (LEGACY_DB_* en el .env del backend)'}
            </p>
          </div>
        )}
      </div>

      {/* Paso 1 — Origen del sistema viejo */}
      <div className="card p-4 mb-4">
        <h3 className="font-semibold mb-2">1 · Origen del sistema viejo</h3>
        <p className="text-sm text-muted mb-3">
          Un dump .sql (mysqldump/Navicat) o un schema.prisma del sistema viejo. Los archivos grandes
          se copian a backend/migration_dump/ en el servidor y se registran por ruta; los chicos
          (hasta 60 MB) se suben desde aca.
        </p>
        {situacion && situacion.dumps.length > 0 && (
          <table className="w-full text-sm mb-3">
            <thead>
              <tr className="text-left text-xs uppercase tracking-widest text-muted">
                <th className="pb-1">Archivo</th>
                <th className="pb-1">Tamano</th>
                <th className="pb-1">Modificado</th>
                <th className="pb-1"></th>
              </tr>
            </thead>
            <tbody>
              {situacion.dumps.map((d) => (
                <tr key={d.archivo}>
                  <td className="py-1">{d.archivo}</td>
                  <td className="py-1">{mb(d.bytes)}</td>
                  <td className="py-1">{new Date(d.modificado).toLocaleString()}</td>
                  <td className="py-1">
                    <span className="flex gap-2">
                      <button type="button" className="btn" onClick={() => analizar(d.archivo)} disabled={analizando === d.archivo}>
                        {analizando === d.archivo ? 'Analizando...' : 'Analizar'}
                      </button>
                      <button type="button" className="btn" onClick={() => migrar(d.archivo)} disabled={migrando === d.archivo}>
                        {migrando === d.archivo ? 'Migrando...' : 'Migrar'}
                      </button>
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {situacion && situacion.dumps.length === 0 && <p className="text-sm text-muted mb-3">No hay ningun origen (.sql o .prisma) en migration_dump todavia.</p>}
        <div className="flex items-end gap-2 mb-2">
          <div className="flex-1">
            <Input label="Ruta completa en el servidor (ej. C:\\dumps\\bookrm_db.sql)" value={rutaDump} onChange={(e) => setRutaDump(e.target.value)} />
          </div>
          <button type="button" className="btn" onClick={registrarRuta} disabled={!rutaDump.trim()}>Registrar</button>
        </div>
        <label className="block text-sm">
          <span className="block text-xs uppercase tracking-widest text-muted mb-1">Subir un origen chico (hasta 60 MB)</span>
          <input
            type="file"
            accept=".sql,.prisma"
            className="input-os"
            disabled={subiendo}
            onChange={(e) => { subirArchivo(e.target.files && e.target.files[0]); e.target.value = ''; }}
          />
        </label>
        {subiendo && <p className="text-sm text-muted mt-1">Subiendo...</p>}
      </div>

      {/* Paso 2 — Analisis estructural */}
      <div className="card p-4 mb-4">
        <h3 className="font-semibold mb-2">2 · Analisis estructural</h3>
        {!analisis && <p className="text-sm text-muted">Elegi un origen de la lista y toca Analizar: se leen sus tablas (o modelos, si es un schema.prisma) y se cruzan contra el esquema del nucleo: por nombre (directa), por SIGNIFICADO con evidencia (semantica, via LLM), por plantilla declarada o a sintesis.</p>}
        {analisis && (
          <div>
            <p className="text-sm mb-2">
              <strong>{analisis.archivo}</strong> ({mb(analisis.bytes)}) · bases detectadas: {analisis.bases.length ? analisis.bases.join(', ') : '(sin CREATE DATABASE/USE)'}
              {analisis.sinDatos ? ' · ESTRUCTURA SIN DATOS (schema): se planifica; importar filas requiere el dump o la base viva' : ''}
              {' · '}tablas: {analisis.resumen.tablas} · directas: {analisis.resumen.directas} · semanticas: {analisis.resumen.semanticas} · con plantilla: {analisis.resumen.conPlantilla} · a sintesis: {analisis.resumen.aSintesis}
              {' · '}inserts aprox: {analisis.resumen.insertosTotales}
            </p>
            {analisis.avisoSemantico && <p className="text-xs mb-2" style={{ color: '#b26a00' }}>⚠️ {analisis.avisoSemantico}</p>}
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-widest text-muted">
                  <th className="pb-1">Tabla del origen</th>
                  <th className="pb-1">Via</th>
                  <th className="pb-1">Destino</th>
                  <th className="pb-1">Insertos</th>
                  <th className="pb-1">Detalle</th>
                </tr>
              </thead>
              <tbody>
                {analisis.plan.map((p) => (
                  <tr key={p.tabla} className="border-t" style={{ borderColor: 'var(--border, #333)' }}>
                    <td className="py-1 font-mono text-xs">{p.tabla}</td>
                    <td className="py-1 text-xs font-bold" style={{ color: COLOR_VIA[p.via] || 'inherit' }}>
                      [{p.via}]
                      {p.via === 'semantica' && p.confianza ? ` ${Math.round(p.confianza * 100)}%` : ''}
                    </td>
                    <td className="py-1 font-mono text-xs">{p.destino || '-'}</td>
                    <td className="py-1">{p.inserts}</td>
                    <td className="py-1 text-xs text-muted">{p.nota}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {analisis.resumen.propuestasDebiles > 0 && (
              <p className="mt-2 text-xs" style={{ color: '#b26a00' }}>
                {analisis.resumen.propuestasDebiles} tabla(s) con propuesta semantica debil (confianza al 75%): quedan declaradas para revisar y se sintetizan; nada se aplica a ciegas.
              </p>
            )}
          </div>
        )}
      </div>

      {/* Paso 3 — Migracion + verificacion + espejo */}
      <div className="card p-4 mb-4">
        <h3 className="font-semibold mb-2">3 · Migracion, verificacion y espejo</h3>
        {!migracion && <p className="text-sm text-muted">Migrar aplica el plan del analisis a las bases propias (INSERT IGNORE, no pisa datos), sintetiza y semantiza el resto, y al terminar VERIFICA de punta a punta contra la base viva: OK / ATENCION / FALLA. La base espejo del origen se conserva para consulta y se limpia desde aca.</p>}
        {migracion && (
          <div>
            <p className="text-sm mb-2">
              <strong>{migracion.archivo}</strong> · importacion #{migracion.importacionId} · espejo: {migracion.espejo || '(sin datos: schema)'}
              {' · '}tablas: {migracion.resumen.tablas} · insertados: {migracion.resumen.insertados} · ignoradas por el motor: {migracion.resumen.omitidos} · sintetizadas: {migracion.resumen.sintetizadas} · semanticas: {migracion.resumen.semanticas} · errores: {migracion.resumen.errores}
            </p>
            <p className="text-sm mb-2">
              Verificacion: <strong style={{ color: COLOR_NIVEL[migracion.verificacion.nivel] }}>[{migracion.verificacion.nivel}]</strong>
              {migracion.avisoSemantico ? ` · aviso semantico: ${migracion.avisoSemantico}` : ''}
            </p>
            <table className="w-full text-sm mb-2">
              <thead>
                <tr className="text-left text-xs uppercase tracking-widest text-muted">
                  <th className="pb-1">Tabla</th>
                  <th className="pb-1">Via</th>
                  <th className="pb-1">Nivel</th>
                  <th className="pb-1">Origen / presentes</th>
                  <th className="pb-1">Nota</th>
                </tr>
              </thead>
              <tbody>
                {migracion.verificacion.detalle.map((v) => (
                  <tr key={v.tabla} className="border-t" style={{ borderColor: 'var(--border, #333)' }}>
                    <td className="py-1 font-mono text-xs">{v.tabla}</td>
                    <td className="py-1 text-xs">{v.via}</td>
                    <td className="py-1 text-xs font-bold" style={{ color: COLOR_NIVEL[v.nivel] }}>[{v.nivel}]</td>
                    <td className="py-1 text-xs">{v.origen === null ? '-' : `${v.presentes === null ? '?' : v.presentes}/${v.origen}`}</td>
                    <td className="py-1 text-xs text-muted">{v.nota}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {migracion.espejo && (
              <button type="button" className="btn" onClick={() => limpiarEspejo(migracion.espejo)} disabled={limpiando === migracion.espejo}>
                {limpiando === migracion.espejo ? 'Limpiando...' : `Limpiar base espejo (${migracion.espejo})`}
              </button>
            )}
          </div>
        )}
        {situacion && situacion.espejos && situacion.espejos.filter((e) => e.existe).length > 0 && (
          <div className="mt-3">
            <p className="text-xs uppercase tracking-widest text-muted mb-1">Bases espejo de los origenes registrados</p>
            <ul className="text-sm space-y-1">
              {situacion.espejos.filter((e) => e.existe).map((e) => (
                <li key={e.espejo} className="flex items-center gap-2">
                  <span className="font-mono text-xs">{e.espejo}</span> <span className="text-muted text-xs">({e.archivo})</span>
                  <button type="button" className="btn" onClick={() => limpiarEspejo(e.espejo)} disabled={limpiando === e.espejo}>
                    {limpiando === e.espejo ? 'Limpiando...' : 'Limpiar'}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* Paso 4 — Modulos nuevos (adopcion del legacy + semantica) */}
      <div className="card p-4 mb-4">
        <h3 className="font-semibold mb-2">4 · Modulos nuevos (adopcion del legacy + semantica)</h3>
        <p className="text-sm text-muted mb-3">
          El desarrollador del Core convierte una sintesis en un modulo COMPLETO por etapas: adopta la
          tabla legacy tal cual (estructura real y sus datos si hay espejo), inserta su modelo en el
          schema con migracion versionada, arma backend y panel por las plantillas del core, la
          semantiza para el buscador y regenera los READMEs. Si el modelo declara ambiguedades
          sustantivas no aplica nada: queda pendiente de decision.
        </p>
        {modulos && modulos.sintesis.length === 0 && <p className="text-sm text-muted">No hay sintesis vigentes: migra un origen primero.</p>}
        <div className="flex items-center gap-3 mb-3 flex-wrap">
          <button type="button" className="btn btn-primary" onClick={desarrollarTodo} disabled={Boolean(trabajo && trabajo.activo)}>
            {trabajo && trabajo.activo ? `Desarrollando ${trabajo.hechos}/${trabajo.total}...` : 'Desarrollar todos los modulos pendientes'}
          </button>
          {trabajo && trabajo.activo && trabajo.actual && <span className="text-sm text-muted">ahora: {trabajo.actual}</span>}
          {trabajo && !trabajo.activo && trabajo.final && (
            <span className="text-sm">
              ultimo lote <strong style={{ color: COLOR_NIVEL[trabajo.final.nivel] }}>[{trabajo.final.nivel}]</strong>: {trabajo.final.creados} creados ({trabajo.final.conVista} con vista, {trabajo.final.apoyo} de apoyo) · {trabajo.final.frenos} con freno · {trabajo.final.errores} con error
            </span>
          )}
        </div>
        {trabajo && trabajo.activo && (
          <div className="mb-3">
            <div style={{ height: 6, background: 'var(--border, #333)', borderRadius: 3 }}>
              <div style={{ height: 6, width: `${trabajo.total ? Math.round((trabajo.hechos / trabajo.total) * 100) : 0}%`, background: 'var(--accent)', borderRadius: 3 }} />
            </div>
            <ul className="text-xs mt-2 space-y-1">
              {trabajo.resultados.slice(-4).map((r) => (
                <li key={r.tabla}>
                  [{r.estado}] {r.tabla}{r.titulo ? ` → ${r.titulo}` : ''}{r.ambiguedades && r.ambiguedades.length ? ` (freno: ${String(r.ambiguedades[0]).slice(0, 80)})` : ''}
                </li>
              ))}
            </ul>
          </div>
        )}
        {modulos && modulos.sintesis.length > 0 && (
          <table className="w-full text-sm mb-3">
            <thead>
              <tr className="text-left text-xs uppercase tracking-widest text-muted">
                <th className="pb-1">Tabla legacy</th>
                <th className="pb-1">Origen</th>
                <th className="pb-1">Columnas</th>
                <th className="pb-1">Estado</th>
                <th className="pb-1"></th>
              </tr>
            </thead>
            <tbody>
              {modulos.sintesis.map((s) => (
                <tr key={s.tabla} className="border-t" style={{ borderColor: 'var(--border, #333)' }}>
                  <td className="py-1 font-mono text-xs">{s.tabla}</td>
                  <td className="py-1 text-xs">{s.archivo || '-'}</td>
                  <td className="py-1 text-xs">{s.columnas}</td>
                  <td className="py-1 text-xs">
                    {s.resuelto ? `modulo: ${s.modulo}` : s.pendienteDecision ? 'pendiente de decision' : s.deshecho ? 'deshecho (reintentable)' : 'sintesis'}
                  </td>
                  <td className="py-1">
                    {!s.resuelto && !s.pendienteDecision && (
                      <button type="button" className="btn" onClick={() => crearModulo(s.tabla)} disabled={creandoModulo === s.tabla}>
                        {creandoModulo === s.tabla ? 'Creando...' : 'Crear modulo'}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {resultadoModulo && (
          <div className="mb-3">
            <p className="text-sm mb-1">
              <strong>{(resultadoModulo.modulo && resultadoModulo.modulo.titulo) || resultadoModulo.modulo.nombre}</strong>
              {' · '}estado: <strong style={{ color: resultadoModulo.estado === 'creado' ? 'var(--accent)' : '#b26a00' }}>[{resultadoModulo.estado}]</strong>
              {resultadoModulo.vista && resultadoModulo.vista.propia === false ? ` · tabla de apoyo sin vista propia (${resultadoModulo.vista.motivo || 'pivote/detalle'})` : ''}
              {resultadoModulo.nota ? ` · ${resultadoModulo.nota}` : ''}
            </p>
            {resultadoModulo.ambiguedades && resultadoModulo.ambiguedades.length > 0 && (
              <p className="text-xs mb-1" style={{ color: '#b26a00' }}>Ambiguedades declaradas (no se aplico nada): {resultadoModulo.ambiguedades.join(' · ')}</p>
            )}
            <ul className="text-xs space-y-1 mb-2">
              {(resultadoModulo.etapas || []).map((e) => (
                <li key={e.clave}>
                  <strong>[{e.estado}] {e.clave}</strong> {e.titulo}{e.detalle ? ` — ${e.detalle}` : ''}
                </li>
              ))}
            </ul>
            {resultadoModulo.verificacion && (
              <ul className="text-xs space-y-1 mb-2">
                {resultadoModulo.verificacion.pasos.map((p) => (
                  <li key={p.paso} style={{ color: COLOR_NIVEL[p.nivel] }}>[{p.nivel}] {p.paso} — {p.detalle}</li>
                ))}
              </ul>
            )}
            {resultadoModulo.archivos && resultadoModulo.archivos.length > 0 && (
              <p className="text-xs text-muted font-mono">{resultadoModulo.archivos.join(' · ')}</p>
            )}
          </div>
        )}
        {modulos && modulos.modulos.length > 0 && (
          <div>
            <p className="text-xs uppercase tracking-widest text-muted mb-1">Modulos creados</p>
            <ul className="text-sm space-y-1">
              {modulos.modulos.map((m) => (
                <li key={m.nombre} className="flex items-center gap-2 flex-wrap">
                  <strong>{m.titulo}</strong>{' '}
                  <span className="text-muted text-xs">({m.tabla} · {m.modelo} · migracion {m.migracion}{m.vista && m.vista.propia === false ? ' · apoyo: sin vista' : ''})</span>
                  <button type="button" className="btn" onClick={() => deshacerModulo(m.nombre)} disabled={deshaciendo === m.nombre}>
                    {deshaciendo === m.nombre ? 'Deshaciendo...' : 'Deshacer'}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* Pasos siguientes (los declara el backend: estado y motivo reales) */}
      {situacion && (
        <div className="card p-4 mb-4">
          <h3 className="font-semibold mb-2">Pasos del flujo (estado real)</h3>
          <ul className="text-sm space-y-2">
            {situacion.pasos.map((p) => (
              <li key={p.clave}>
                <Badge estado={p.estado} /> <strong>{p.n}. {p.titulo}</strong> — <span className="text-muted">{p.nota}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Entrevista (conservada) */}
      <div className="card p-4 mb-4 max-w-lg">
        <h3 className="font-semibold mb-2">Entrevista inicial</h3>
        <p className="text-sm text-muted mb-3">
          La espora: aca arranca la personalizacion. Preguntas extensibles en utils/desarrolloPreguntas.js.
        </p>
        {mensajeEntrevista && <p className="text-sm mb-3">{mensajeEntrevista}</p>}
        <div className="space-y-1">
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
          <button type="button" className="btn btn-primary" onClick={guardarEntrevista}>Guardar entrevista</button>
        </div>
      </div>

      <ConfigTogglesBlock
        grupo="desarrollo"
        titulo="Marcas de debug del front"
        nota="debug_mode se aplica al instante en el navegador (sin recompilar); VITE_DEBUG_MODE del build es el piso: si esta en true, este toggle no lo apaga."
      />
    </div>
  );
}
