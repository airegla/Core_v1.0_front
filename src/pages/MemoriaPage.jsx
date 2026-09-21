// BookOS - MemoriaPage.jsx
// ruta: bookos/frontend/src/pages/MemoriaPage.jsx
// descripcion: panel de Memoria del Secretario. Muestra lo que quedo guardado por tipo
//   (nota, buena_practica, decision, preferencia) y por ESTADO, permite filtrar, descargar y
//   (admin) eliminar entradas. La memoria entra al prompt del agente en cada turno.
//   18-Sep-2026 (propuestas #46/#47/#48): se fue `ultimo_trabajo` (duplicaba el log de turnos) y las
//   buenas practicas son la CONDUCTA del agente: se ven PROPUESTAS hasta que el operario da la orden
//   con $asentar en el chat. El panel NO asienta: muestra, y la orden es una sola via.

import { useCallback, useEffect, useState } from 'react';
import DebugTag from '../ui/DebugTag';
import { agenteApi } from '../api/api';
import { descargarCsv } from '../utils/exportar';

const TIPOS = ['', 'nota', 'buena_practica', 'decision', 'preferencia'];
const ESTADOS = ['', 'ASENTADA', 'PROPUESTA'];

export default function MemoriaPage({ esAdmin }) {
  const [filas, setFilas] = useState([]);
  const [tipo, setTipo] = useState('');
  const [estado, setEstado] = useState('');
  const [aviso, setAviso] = useState('');
  const [cargando, setCargando] = useState(false);

  const cargar = useCallback(async () => {
    setCargando(true);
    setAviso('');
    try {
      const params = { limit: 200, ...(tipo ? { tipo } : {}), ...(estado ? { estado } : {}) };
      const res = await agenteApi.memoria(params);
      setFilas(res.data || []);
    } catch (err) {
      setAviso(`⚠️ ${err.message}`);
    } finally {
      setCargando(false);
    }
  }, [tipo, estado]);

  useEffect(() => { cargar(); }, [cargar]);

  const eliminar = async (id) => {
    if (!window.confirm(`Eliminar la entrada #${id} de la memoria. ¿Confirmás?`)) return;
    try {
      await agenteApi.memoriaEliminar(id);
      setAviso(`Entrada ${id} eliminada`);
      await cargar();
    } catch (err) {
      setAviso(`⚠️ ${err.message}`);
    }
  };

  const exportar = () => {
    const planas = filas.map((m) => ({ id: m.id, tipo: m.tipo, estado: m.estado || 'ASENTADA', origen: m.origen || 'historica (sin firmar)', usos: m.usos || 0, texto: m.texto, fecha: new Date(m.fecha).toLocaleString('es-AR') }));
    descargarCsv('memoria_secretario', [
      { titulo: 'id', clave: 'id' }, { titulo: 'tipo', clave: 'tipo' }, { titulo: 'estado', clave: 'estado' }, { titulo: 'origen', clave: 'origen' }, { titulo: 'usos', clave: 'usos' }, { titulo: 'texto', clave: 'texto' }, { titulo: 'fecha', clave: 'fecha' },
    ], planas);
  };

  return (
    <div>
      <DebugTag nombre="MemoriaPage" />
      <h2 className="text-lg font-semibold mb-1">Memoria del Secretario</h2>
      <p className="text-sm text-muted mb-4">
        La memoria entra al prompt del agente en cada turno y son <strong>reglas</strong>, no adorno:
        cada linea sale de algo que se observó que funciona o de algo que pediste. Las
        <span className="font-mono"> preferencia</span> son órdenes de trato; las
        <span className="font-mono"> buena_practica</span> son conducta y las escribe el agente (o vos)
        <strong> como propuesta</strong>: no rigen hasta que das la orden con
        <span className="font-mono"> $asentar &lt;id|texto&gt;</span> en el chat — el panel no asienta, sólo muestra.
        Cada entrada va <strong>firmada</strong> con su origen y viaja con su contador de usos: las anteriores a
        la firma dicen <span className="font-mono">sin firmar</span>.
      </p>
      {aviso && <p className="text-sm mb-3">{aviso}</p>}

      <div className="flex items-center gap-2 mb-3 flex-wrap">
        <select className="input-os" style={{ maxWidth: 220 }} value={tipo} onChange={(e) => setTipo(e.target.value)}>
          {TIPOS.map((t) => <option key={t} value={t}>{t === '' ? 'todos los tipos' : t}</option>)}
        </select>
        <select className="input-os" style={{ maxWidth: 200 }} value={estado} onChange={(e) => setEstado(e.target.value)}>
          {ESTADOS.map((e) => <option key={e} value={e}>{e === '' ? 'todos los estados' : e}</option>)}
        </select>
        <button type="button" className="btn btn-ghost text-sm" onClick={cargar} disabled={cargando}>Refrescar</button>
        {filas.length > 0 && <button type="button" className="btn btn-ghost text-sm" onClick={exportar}>⬇ Descargar</button>}
        <span className="text-xs text-muted">{filas.length} entradas</span>
      </div>

      {filas.length === 0 && !cargando && <p className="text-sm text-muted">Sin entradas para ese filtro.</p>}
      <div className="space-y-1">
        {filas.map((m) => (
          <div key={m.id} className="card p-2 flex items-center gap-2">
            <span className="agente-badge">{m.tipo}</span>
            {m.estado === 'PROPUESTA' && <span className="agente-badge" title="Espera la orden del operario: $asentar">propuesta</span>}
            <span className="agente-badge" title="Quien escribio esta entrada">{m.origen || 'sin firmar'}</span>
            <span className="text-sm flex-1">{m.texto}</span>
            {m.usos > 0 && <span className="text-xs text-muted" title="Veces que viajo en el prompt">×{m.usos}</span>}
            <span className="text-xs text-muted font-mono whitespace-nowrap">{new Date(m.fecha).toLocaleString('es-AR')}</span>
            {esAdmin && (
              <button type="button" className="btn btn-ghost text-xs" onClick={() => eliminar(m.id)} title="Eliminar entrada">✕</button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
