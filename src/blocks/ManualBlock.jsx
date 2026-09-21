// BookOS - ManualBlock.jsx
// ruta: bookos/frontend/src/blocks/ManualBlock.jsx
// descripcion: el manual vivo de BookOS en un modal con una solapa por tema (uso tecnico, CRM,
//   el Secretario, el Kernel, los flujos y las herramientas). Renderiza el markdown simple del backend
//   (secciones, listas, tablas, notas) y los diagramas Mermaid como graficos.

import { useEffect, useState } from 'react';
import Modal from '../ui/Modal';
import DebugTag from '../ui/DebugTag';
import MermaidDiagram from '../ui/MermaidDiagram';
import { manualApi, kernelApi } from '../api/api';

// Negritas: **texto** -> <strong>.
const conNegritas = (texto) => String(texto).split(/\*\*(.+?)\*\*/g).map((parte, i) => (i % 2 === 1 ? <strong key={`b-${i}`}>{parte}</strong> : parte));

// Parser del formato del manual (las mismas marcas que emite el backend).
function renderContenido(contenido, esAdmin = false) {
  const lineas = String(contenido || '').split('\n');
  const out = [];
  let i = 0;
  let clave = 0;

  while (i < lineas.length) {
    const linea = lineas[i];
    const trim = linea.trim();

    if (trim.startsWith('```mermaid')) {
      const buf = [];
      i += 1;
      while (i < lineas.length && !lineas[i].trim().startsWith('```')) { buf.push(lineas[i]); i += 1; }
      i += 1;
      out.push(<MermaidDiagram key={clave++} codigo={buf.join('\n')} />);
      continue;
    }
    if (trim.startsWith('```')) {
      const buf = [];
      i += 1;
      while (i < lineas.length && !lineas[i].trim().startsWith('```')) { buf.push(lineas[i]); i += 1; }
      i += 1;
      out.push(<pre key={clave++} className="text-xs card p-3 my-2" style={{ overflowX: 'auto' }}>{buf.join('\n')}</pre>);
      continue;
    }
    if (trim.startsWith('|')) {
      const filas = [];
      while (i < lineas.length && lineas[i].trim().startsWith('|')) { filas.push(lineas[i].trim()); i += 1; }
      const celdas = filas.map((f) => f.replace(/^\|/, '').replace(/\|$/, '').split('|').map((c) => c.trim()));
      const cabecera = celdas[0] || [];
      const cuerpo = celdas.slice(2); // la fila 1 es el separador ---|---
      out.push(
        <table key={clave++} className="table-os my-3">
          <thead>
            <tr>{cabecera.map((c, idx) => <th key={idx}>{conNegritas(c)}</th>)}</tr>
          </thead>
          <tbody>
            {cuerpo.map((fila, fi) => (
              <tr key={fi}>{fila.map((c, ci) => <td key={ci}>{conNegritas(c)}</td>)}</tr>
            ))}
          </tbody>
        </table>
      );
      continue;
    }
    if (trim.startsWith('- ')) {
      const items = [];
      while (i < lineas.length && lineas[i].trim().startsWith('- ')) { items.push(lineas[i].trim().slice(2)); i += 1; }
      out.push(
        <ul key={clave++} className="list-disc pl-5 my-2 space-y-1 text-sm">
          {items.map((t, idx) => <li key={idx}>{conNegritas(t)}</li>)}
        </ul>
      );
      continue;
    }
    if (/^\d+\.\s/.test(trim)) {
      const items = [];
      while (i < lineas.length && /^\d+\.\s/.test(lineas[i].trim())) { items.push(lineas[i].trim().replace(/^\d+\.\s/, '')); i += 1; }
      out.push(
        <ol key={clave++} className="list-decimal pl-5 my-2 space-y-1 text-sm">
          {items.map((t, idx) => <li key={idx}>{conNegritas(t)}</li>)}
        </ol>
      );
      continue;
    }
    if (trim.startsWith('> EDITABLE: ')) {
      const claveEdit = trim.slice('> EDITABLE: '.length).trim();
      out.push(<EditorPrompt key={claveEdit} clave={claveEdit} esAdmin={esAdmin} />);
      i += 1;
      continue;
    }
    if (trim.startsWith('> ')) {
      out.push(
        <blockquote key={clave++} className="text-sm my-2 pl-3 py-1" style={{ borderLeft: '3px solid var(--accent)', opacity: 0.9 }}>
          {conNegritas(trim.slice(2))}
        </blockquote>
      );
      i += 1;
      continue;
    }
    if (trim.startsWith('### ')) {
      out.push(<h4 key={clave++} className="font-semibold mt-4 mb-1">{conNegritas(trim.slice(4))}</h4>);
      i += 1;
      continue;
    }
    if (trim.startsWith('## ')) {
      out.push(<h3 key={clave++} className="font-semibold text-base mt-5 mb-2">{conNegritas(trim.slice(3))}</h3>);
      i += 1;
      continue;
    }
    if (trim === '') { i += 1; continue; }
    out.push(<p key={clave++} className="text-sm my-2 leading-relaxed">{conNegritas(trim)}</p>);
    i += 1;
  }
  return out;
}

// Editor de la parte EDITABLE de un prompt: la semilla del modelo chico vive en config (no en el
// codigo), asi que el manual la muestra editable y el guardado rige en el proximo turno. El resto
// de los prompts es codigo versionado y solo se muestra. Solo el administrador puede guardarla.
function EditorPrompt({ clave, esAdmin }) {
  const [valor, setValor] = useState(null);
  const [valorDefault, setValorDefault] = useState('');
  const [aviso, setAviso] = useState('');
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    if (clave !== 'LLM_CHICO_TOOLS_SEMILLA') return;
    kernelApi.chicoEstado()
      .then((res) => {
        const d = res && res.data !== undefined && !Array.isArray(res) ? res.data : res;
        setValor(d.semilla || '');
        setValorDefault(d.semillaDefault || '');
      })
      .catch((e) => setAviso(`⚠️ ${e.message}`));
  }, [clave]);

  if (clave !== 'LLM_CHICO_TOOLS_SEMILLA') {
    return (
      <blockquote className="text-xs my-2 pl-3 py-1" style={{ borderLeft: '3px solid var(--accent)' }}>
        La clave <span className="font-mono">{clave}</span> se edita desde su modulo del Core.
      </blockquote>
    );
  }
  if (!esAdmin) {
    return (
      <blockquote className="text-xs my-2 pl-3 py-1" style={{ borderLeft: '3px solid var(--accent)' }}>
        La semilla del modelo chico (<span className="font-mono">{clave}</span>) la edita el administrador.
      </blockquote>
    );
  }
  const guardar = async (payload) => {
    setGuardando(true);
    setAviso('');
    try {
      const res = await kernelApi.chicoGuardar(payload);
      const d = res && res.data !== undefined && !Array.isArray(res) ? res.data : res;
      setValor((d && d.semilla !== undefined ? d.semilla : (payload.reset ? valorDefault : valor)) || '');
      setAviso('✓ Guardada: rige en el proximo turno del modelo chico');
    } catch (e) {
      setAviso(`⚠️ ${e.message}`);
    } finally {
      setGuardando(false);
    }
  };
  return (
    <div className="card p-3 my-2">
      <div className="text-xs text-muted mb-1">
        Semilla del modelo chico (<span className="font-mono">{clave}</span>) — editable aca: se guarda en config y rige al instante.
      </div>
      {valor == null ? (
        <p className="text-xs text-muted">Cargando... {aviso}</p>
      ) : (
        <>
          <textarea className="input-os" rows={4} value={valor} onChange={(e) => setValor(e.target.value)} />
          <div className="flex items-center gap-2 mt-2 flex-wrap">
            <button type="button" className="btn btn-primary text-xs" disabled={guardando} onClick={() => guardar({ semilla: valor })}>Guardar semilla</button>
            <button type="button" className="btn btn-ghost text-xs" disabled={guardando} onClick={() => guardar({ reset: true })}>Volver al default</button>
            <span className="text-xs text-muted">{aviso}</span>
          </div>
        </>
      )}
    </div>
  );
}

export default function ManualBlock({ abierto, onClose, esAdmin = false }) {
  const [solapas, setSolapas] = useState([]);
  const [activa, setActiva] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!abierto || solapas.length) return;
    manualApi.obtener()
      .then((res) => {
        // axiosClient desempaqueta el envelope: `res` ya es el payload.
        const payload = res && res.data !== undefined && !Array.isArray(res) ? res.data : res;
        const lista = (payload && payload.solapas) || [];
        setSolapas(lista);
        if (lista.length && !activa) setActiva(lista[0].id);
      })
      .catch((e) => setError(e.message));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [abierto]);

  const actual = solapas.find((s) => s.id === activa);

  return (
    <Modal abierto={abierto} onClose={onClose} titulo="Manual de BookOS" ancho="980px">
      <DebugTag nombre="ManualBlock" />
      <div className="flex gap-1 mb-3 flex-wrap" style={{ borderBottom: '1px solid var(--border)', paddingBottom: 8 }}>
        {solapas.map((s) => (
          <button
            key={s.id}
            type="button"
            className={`btn text-xs ${activa === s.id ? 'btn-primary' : 'btn-ghost'}`}
            onClick={() => setActiva(s.id)}
          >
            {s.titulo}
          </button>
        ))}
      </div>
      {error && <p className="text-sm" style={{ color: 'var(--danger)' }}>{error}</p>}
      {!actual && !error && <p className="text-sm text-muted">Cargando manual...</p>}
      {actual && (
        <div style={{ maxHeight: '72vh', overflowY: 'auto', paddingRight: 8 }}>
          {renderContenido(actual.contenido, esAdmin)}
        </div>
      )}
    </Modal>
  );
}
