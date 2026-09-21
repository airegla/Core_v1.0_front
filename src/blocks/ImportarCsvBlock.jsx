// BookOS - ImportarCsvBlock.jsx
// ruta: bookos/frontend/src/blocks/ImportarCsvBlock.jsx
// descripcion: importador CSV reutilizable. Dos destinos:
//   1) "Cargar en la vista": llama onCargar(filas) para meter las filas en el
//      documento que se esta trabajando (items de venta, remito, liquidacion...).
//   2) "Procesar con el Secretario": adjunta el CSV al contexto y le pide al
//      agente que lo procese con la herramienta que corresponda.

import { useRef, useState } from 'react';
import Modal from '../ui/Modal';
import { parsearCsv } from '../utils/csv';
import { useAppContext } from '../AppContext';

export default function ImportarCsvBlock({ onCargar, etiqueta = 'Importar CSV', maxFilasChat = 200 }) {
  const inputRef = useRef(null);
  const [preview, setPreview] = useState(null);
  const { setCsvAdjunto, pedirConsulta } = useAppContext();

  const alElegir = (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const { encabezados, filas } = parsearCsv(reader.result);
      setPreview({ encabezados, filas });
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const cargarEnVista = () => {
    if (onCargar) onCargar(preview.filas);
    setPreview(null);
  };

  const procesarConSecretario = () => {
    const filas = preview.filas.slice(0, maxFilasChat);
    setCsvAdjunto({ encabezados: preview.encabezados, filas });
    pedirConsulta(`Adjunté un CSV con ${filas.length} filas (columnas: ${preview.encabezados.join(', ')}). Procesalo con la herramienta que corresponda.`);
    setPreview(null);
  };

  return (
    <>
      <input ref={inputRef} type="file" accept=".csv,text/csv" style={{ display: 'none' }} onChange={alElegir} />
      <button type="button" className="btn btn-ghost text-xs" onClick={() => inputRef.current && inputRef.current.click()}>{etiqueta}</button>

      <Modal
        abierto={Boolean(preview)}
        onClose={() => setPreview(null)}
        titulo={`CSV importado (${preview ? preview.filas.length : 0} filas)`}
        ancho="760px"
        footer={
          preview ? (
            <>
              <button type="button" className="btn btn-ghost" onClick={procesarConSecretario}>Procesar con el Secretario</button>
              {onCargar && <button type="button" className="btn btn-primary" onClick={cargarEnVista}>Cargar en la vista</button>}
            </>
          ) : null
        }
      >
        {preview && (
          <table className="table-os">
            <thead><tr>{preview.encabezados.map((h) => <th key={h}>{h}</th>)}</tr></thead>
            <tbody>
              {preview.filas.slice(0, 8).map((f, i) => (
                <tr key={i}>{preview.encabezados.map((h) => <td key={h} className="text-xs">{f[h]}</td>)}</tr>
              ))}
            </tbody>
          </table>
        )}
      </Modal>
    </>
  );
}
