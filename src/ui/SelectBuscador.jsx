// BookOS - SelectBuscador.jsx
// ruta: bookos/frontend/src/ui/SelectBuscador.jsx
// descripcion: selector asincronico para maestros grandes (clientes, proveedores, autores,
//   materias, editoriales). Busca en el servidor con debounce a partir de 2 letras (nunca
//   precarga la tabla entera), navega con teclado (flechas/Enter/Escape) y permite limpiar
//   la seleccion. En modo libre, el texto tipeado tambien vale sin elegir sugerencia.

import { useEffect, useRef, useState } from 'react';

export default function SelectBuscador({
  valor = null, // id seleccionado (null = sin seleccion)
  etiquetaValor = '', // texto que representa al valor precargado
  onSeleccionar = () => {}, // recibe el item elegido ({ id, etiqueta, ... }) o null al limpiar
  buscar, // async (q) => [{ id, etiqueta }]
  onTexto = null, // modo libre: avisa el texto tipeado aunque no se elija sugerencia
  textoInicial = '', // modo libre: texto precargado (formulario en edicion)
  placeholder = 'Buscar...',
  minimo = 2,
  debounceMs = 300,
  vacio = 'Sin resultados',
  deshabilitado = false,
}) {
  const [abierto, setAbierto] = useState(false);
  const [consulta, setConsulta] = useState('');
  const [resultados, setResultados] = useState([]);
  const [resaltado, setResaltado] = useState(-1);
  const [cargando, setCargando] = useState(false);
  // Texto del item elegido: cada vista mapea las sugerencias a su manera (etiqueta / nombre) y no
  // siempre puede reconstruir la etiqueta despues. Sin memorizarla, el input quedaba VACIO tras
  // elegir (bug reportado en Facturar: se seleccionaba el cliente y no se veia el nombre).
  const [etiquetaElegida, setEtiquetaElegida] = useState('');
  const cajaRef = useRef(null);
  const inputRef = useRef(null);

  // Cierra el desplegable al tocar afuera (mousedown: el blur del input no alcanza).
  useEffect(() => {
    const onDown = (e) => {
      if (cajaRef.current && !cajaRef.current.contains(e.target)) setAbierto(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, []);

  // Si el padre limpia la seleccion (valor vacio), la etiqueta memorizada tambien se va.
  useEffect(() => {
    if (valor === null || valor === undefined || valor === '') setEtiquetaElegida('');
  }, [valor]);

  // Busqueda con debounce: a partir de `minimo` letras, sin precarga sincronica.
  useEffect(() => {
    if (!abierto || consulta.trim().length < minimo) {
      setResultados([]);
      setCargando(false);
      return undefined;
    }
    let vigente = true;
    setCargando(true);
    const t = setTimeout(async () => {
      try {
        const filas = await buscar(consulta.trim());
        if (vigente) setResultados(Array.isArray(filas) ? filas : []);
      } catch {
        if (vigente) setResultados([]);
      } finally {
        if (vigente) setCargando(false);
      }
    }, debounceMs);
    return () => { vigente = false; clearTimeout(t); };
  }, [consulta, abierto, minimo, debounceMs]); // eslint-disable-line

  const elegir = (item) => {
    setEtiquetaElegida(item ? (item.etiqueta || item.nombre || '') : '');
    onSeleccionar(item);
    setAbierto(false);
    setConsulta('');
    setResaltado(-1);
  };

  const limpiar = () => {
    setEtiquetaElegida('');
    onSeleccionar(null);
    setConsulta('');
    setResultados([]);
    setResaltado(-1);
    if (inputRef.current) inputRef.current.focus();
  };

  const tipear = (e) => {
    const texto = e.target.value;
    setConsulta(texto);
    setAbierto(true);
    setResaltado(-1);
    if (onTexto) onTexto(texto);
  };

  const tecla = (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (!abierto) { setAbierto(true); return; }
      setResaltado((r) => Math.min(r + 1, resultados.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setResaltado((r) => Math.max(r - 1, 0));
    } else if (e.key === 'Enter') {
      if (abierto && resaltado >= 0 && resultados[resaltado]) {
        e.preventDefault();
        elegir(resultados[resaltado]);
      } else if (abierto && consulta.trim() && onTexto) {
        // Modo libre: Enter confirma lo tipeado sin sugerencia elegida.
        e.preventDefault();
        onTexto(consulta.trim());
        setAbierto(false);
      }
    } else if (e.key === 'Escape') {
      setAbierto(false);
      setConsulta('');
    }
  };

  const hayValor = (valor !== null && valor !== undefined && valor !== '') || Boolean(textoInicial);

  return (
    <div ref={cajaRef} style={{ position: 'relative' }}>
      <div className="flex gap-1 items-center">
        <input
          ref={inputRef}
          className="input-os"
          style={{ width: '100%' }}
          placeholder={placeholder}
          disabled={deshabilitado}
          value={abierto ? consulta : (etiquetaValor || etiquetaElegida || textoInicial || '')}
          onFocus={() => { setAbierto(true); setConsulta(''); }}
          onChange={tipear}
          onKeyDown={tecla}
          role="combobox"
          aria-expanded={abierto}
        />
        {hayValor && (
          <button type="button" className="btn btn-ghost text-xs" title="Limpiar" onClick={limpiar}>✕</button>
        )}
      </div>
      {abierto && (
        <div
          style={{
            position: 'absolute', zIndex: 40, left: 0, right: 0, top: 'calc(100% + 2px)',
            background: 'var(--card, #fff)', border: '1px solid var(--border)', borderRadius: 6,
            maxHeight: 220, overflowY: 'auto', boxShadow: '0 6px 18px rgba(0,0,0,0.12)',
          }}
        >
          {consulta.trim().length < minimo && (
            <div className="text-xs text-muted p-2">Escribi {minimo} letras para buscar.</div>
          )}
          {consulta.trim().length >= minimo && cargando && <div className="text-xs text-muted p-2">Buscando...</div>}
          {consulta.trim().length >= minimo && !cargando && resultados.length === 0 && (
            <div className="text-xs text-muted p-2">{vacio}</div>
          )}
          {resultados.map((item, i) => (
            <div
              key={item.id ?? i}
              role="option"
              aria-selected={i === resaltado}
              className="text-sm"
              style={{
                padding: '6px 10px', cursor: 'pointer',
                background: i === resaltado ? 'var(--accent, #eef)' : 'transparent',
              }}
              onMouseEnter={() => setResaltado(i)}
              onMouseDown={(e) => { e.preventDefault(); elegir(item); }}
            >
              {item.etiqueta}
              {item.detalle ? <span className="text-xs text-muted"> · {item.detalle}</span> : null}
            </div>
          ))}
          {onTexto && consulta.trim().length >= minimo && (
            <div
              className="text-xs"
              style={{ padding: '6px 10px', cursor: 'pointer', borderTop: '1px solid var(--border)' }}
              onMouseDown={(e) => { e.preventDefault(); onTexto(consulta.trim()); setAbierto(false); }}
            >
              Usar "{consulta.trim()}" tal cual
            </div>
          )}
        </div>
      )}
    </div>
  );
}
