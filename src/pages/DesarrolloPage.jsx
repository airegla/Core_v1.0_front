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
  const [respuestas, setRespuestas] = useState({});
  const [mensajeEntrevista, setMensajeEntrevista] = useState('');

  const cargar = useCallback(() => {
    setError('');
    desarrolloApi
      .situacion()
      .then((r) => setSituacion(r.data))
      .catch((e) => setError(e.message));
  }, []);

  useEffect(() => {
    if (esAdmin) cargar();
  }, [esAdmin, cargar]);

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

      {/* Paso 1 — Dump del origen */}
      <div className="card p-4 mb-4">
        <h3 className="font-semibold mb-2">1 · Dump del origen</h3>
        <p className="text-sm text-muted mb-3">
          Un .sql del sistema viejo (mysqldump/Navicat). Los dumps grandes se copian a
          backend/migration_dump/ en el servidor y se registran por ruta; los chicos (hasta 60 MB)
          se suben desde aca.
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
                    <button type="button" className="btn" onClick={() => analizar(d.archivo)} disabled={analizando === d.archivo}>
                      {analizando === d.archivo ? 'Analizando...' : 'Analizar'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {situacion && situacion.dumps.length === 0 && <p className="text-sm text-muted mb-3">No hay ningun .sql en migration_dump todavia.</p>}
        <div className="flex items-end gap-2 mb-2">
          <div className="flex-1">
            <Input label="Ruta completa en el servidor (ej. C:\\dumps\\bookrm_db.sql)" value={rutaDump} onChange={(e) => setRutaDump(e.target.value)} />
          </div>
          <button type="button" className="btn" onClick={registrarRuta} disabled={!rutaDump.trim()}>Registrar</button>
        </div>
        <label className="block text-sm">
          <span className="block text-xs uppercase tracking-widest text-muted mb-1">Subir un .sql chico (hasta 60 MB)</span>
          <input
            type="file"
            accept=".sql"
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
        {!analisis && <p className="text-sm text-muted">Elegi un dump de la lista y toca Analizar: se leen sus tablas y se cruzan contra el esquema y las plantillas.</p>}
        {analisis && (
          <div>
            <p className="text-sm mb-2">
              <strong>{analisis.archivo}</strong> ({mb(analisis.bytes)}) · bases detectadas: {analisis.bases.length ? analisis.bases.join(', ') : '(sin CREATE DATABASE/USE)'}
              {' · '}tablas: {analisis.resumen.tablas} · con plantilla: {analisis.resumen.conPlantilla} · sin plantilla: {analisis.resumen.sinPlantilla}
              {' · '}inserts aprox: {analisis.resumen.insertosTotales}
            </p>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-widest text-muted">
                  <th className="pb-1">Tabla del dump</th>
                  <th className="pb-1">Inserts aprox</th>
                  <th className="pb-1">En esquema destino</th>
                  <th className="pb-1">Plantilla</th>
                </tr>
              </thead>
              <tbody>
                {analisis.tablas.map((t) => (
                  <tr key={t.tabla} className="border-t" style={{ borderColor: 'var(--border, #333)' }}>
                    <td className="py-1 font-mono text-xs">{t.tabla}</td>
                    <td className="py-1">{t.inserts}</td>
                    <td className="py-1">{t.enEsquemaDestino === null ? '-' : t.enEsquemaDestino ? 'si' : 'no'}</td>
                    <td className="py-1">
                      {t.plantilla ? (
                        <span>
                          → <strong>{t.plantilla.destino}</strong> · {t.plantilla.instrumento}{' '}
                          <Badge estado={t.plantilla.estado} />
                        </span>
                      ) : (
                        <span className="text-muted">sin plantilla: requiere analisis (LLM + READMEs)</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {analisis.tablas.some((t) => t.plantilla && t.plantilla.nota) && (
              <div className="mt-2 text-xs text-muted space-y-1">
                {analisis.tablas.filter((t) => t.plantilla).map((t) => (
                  <p key={t.tabla}><strong>{t.tabla}:</strong> {t.plantilla.nota}</p>
                ))}
              </div>
            )}
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
