// BookOS - BuscadorSemanticoBlock.jsx
// ruta: bookos/frontend/src/blocks/BuscadorSemanticoBlock.jsx
// descripcion: F7 — el buscador SEMANTICO del kernel como modal global, con las MISMAS tarjetas
//   del asistente (titulo, score, autor/editorial, precio y stock) y sus acciones: agregar el
//   renglon cuando se esta facturando y preguntarle al Secretario. Desde aca tambien se abre la
//   pagina del Asistente de ventas (hoy: la ventana izquierda del Vendedor). PERSISTENTE: cerrar no pierde nada (texto, resultados y
//   consulta se conservan; una busqueda en curso sigue viva y al volver con F7 esta ahi). El
//   boton Limpiar arranca de cero.

import { useEffect, useRef, useState } from 'react';
import Modal from '../ui/Modal';
import BotonSecretario from '../ui/BotonSecretario';
import usePersistentWork from '../hooks/usePersistentWork';
import { kernelApi, crmApi } from '../api/api';
import { useAppContext } from '../AppContext';

const money = (n) => `$${Number(n || 0).toLocaleString('es-AR')}`;
const stockDe = (a) => Number(a.stock || 0) + Number(a.stockDeposito || 0);

// Portada por EAN13: servicio de tapas recuperado del bookrm (GET /api/tapas/:ean13, publico y
// cacheado 1 dia). Si el libro no tiene tapa cargada, cae a un marcador sin romper la tarjeta.
function TapaLibro({ ean }) {
  const [fallo, setFallo] = useState(false);
  if (!ean || fallo) return <div className="f7-tapa-vacia" title="Sin portada cargada">📕</div>;
  return (
    <img
      className="f7-tapa"
      src={`/api/tapas/${encodeURIComponent(ean)}`}
      alt=""
      loading="lazy"
      onError={() => setFallo(true)}
    />
  );
}

// Resultado de un $comando que no es una lista de titulos (ayuda, reflexion de $llm, agregados):
// se muestra como texto legible en vez de una tarjeta vacia.
function textoDeComando(d) {
  if (!d || typeof d !== 'object') return String(d || '');
  if (d.modo === 'ayuda' && Array.isArray(d.ayuda)) return d.ayuda.map((c) => `${c.comando} — ${c.descripcion}`).join('\n');
  if (d.veredicto) {
    const propuestas = (d.propuestas || []).map((p) => `• ${p.titulo}: ${p.cambio}`).join('\n');
    return [d.veredicto, propuestas && `PROPUESTAS:\n${propuestas}`].filter(Boolean).join('\n\n');
  }
  if (d.valor !== undefined) return `${d.operacion || d.agruparPor || 'resultado'}: ${d.valor}`;
  if (Array.isArray(d.grupos)) return d.grupos.map((g) => Object.values(g).join(' · ')).join('\n');
  return JSON.stringify(d, null, 2);
}

export default function BuscadorSemanticoBlock({ abierto, onCerrar, enFacturar = false, onAbrirAsistente }) {
  const { emitirInstruccion, clienteIdActivo } = useAppContext();
  // PERSISTENTE: cerrar el modal o REFRESCAR la pagina no pierde nada (texto, resultados y
  // comando quedan en disco). El boton ↺ Limpiar arranca de cero.
  const [memoria, setMemoria, limpiarMemoria] = usePersistentWork('buscador_f7', { texto: '', resultados: [], consultado: '', comandoTexto: '' });
  const { texto, resultados, consultado, comandoTexto } = memoria;
  const setTexto = (v) => setMemoria((m) => ({ ...m, texto: v }));
  const setResultados = (v) => setMemoria((m) => ({ ...m, resultados: v }));
  const setConsultado = (v) => setMemoria((m) => ({ ...m, consultado: v }));
  const setComandoTexto = (v) => setMemoria((m) => ({ ...m, comandoTexto: v }));
  const [error, setError] = useState('');
  const [cargando, setCargando] = useState(false);
  const [creandoPedido, setCreandoPedido] = useState('');
  const [aviso, setAviso] = useState('');
  const inputRef = useRef(null);

  // El modal es PERSISTENTE: cerrar NO borra nada (texto, resultados y consulta sobreviven; la
  // busqueda en curso sigue viva porque el componente no se desmonta). Para empezar de cero
  // esta el boton Limpiar.
  useEffect(() => {
    if (!abierto) return undefined;
    const t = setTimeout(() => inputRef.current && inputRef.current.focus(), 80);
    return () => clearTimeout(t);
  }, [abierto]);

  const buscar = async () => {
    const consulta = texto.trim();
    if (!consulta) return;
    setCargando(true);
    setError('');
    setComandoTexto('');
    try {
      // Los $comandos (marcadores) NO se buscan como texto: se EJECUTAN. El buscador semantico no
      // pasaba por el agente, asi que "$titulo X" se interpretaba como busqueda literal y el
      // comando nunca corria (bug reportado).
      if (consulta.startsWith('$')) {
        const res = await kernelApi.comando(consulta);
        const data = res.data || {};
        setConsultado(consulta);
        if (!data.esComando) {
          setError(`"${consulta}" no es un comando valido. Proba $ayuda para ver los disponibles.`);
          setResultados([]);
          return;
        }
        const r = data.resultado || {};
        if (r.ok === false) {
          setError((r.error && r.error.mensaje) || `No pude ejecutar ${data.comando}`);
          setResultados([]);
          return;
        }
        const d = r.data || {};
        const lista = d.articulos || d.editoriales || d.materias || null;
        setResultados(lista || []);
        setComandoTexto(lista ? '' : textoDeComando(d));
        return;
      }
      const res = await kernelApi.buscar({
        texto: consulta,
        limite: 12,
        // Con cliente activo la busqueda se mide como recomendacion para ese cliente (zeta/contexto).
        contexto: clienteIdActivo ? { clienteId: clienteIdActivo, uso: 'recomendacion' } : { uso: 'agente' },
      });
      const data = res.data || {};
      setResultados(data.resultados || data.candidatos || []);
      setConsultado(consulta);
    } catch (err) {
      setError(err.message);
      setResultados([]);
    } finally {
      setCargando(false);
    }
  };

  const eanDe = (a) => a.ean13 || a.barras || a.codigo || '';

  // En stock: el titulo se carga en la factura MINORISTA abierta. El bus de instrucciones llega a
  // la pagina activa, asi que el boton se muestra siempre y solo tiene efecto cuando se esta
  // facturando (que es el caso de uso real de F7 en el mostrador).
  const agregarAFactura = (a) => {
    emitirInstruccion({ dominio: 'ventas', accion: 'agregar_item', item: { ean13: eanDe(a), titulo: a.titulo, precio: a.precio } });
    if (!enFacturar) setAviso('Lo cargue para facturar: abri Facturar (Ventas) y ahi va a estar el renglon.');
    else onCerrar();
  };

  // A pedir: el pedido de cliente es una accion REAL (no una instruccion de vista), asi que se
  // crea por API y queda en CRM > Pedidos con su cliente asociado.
  const agregarPedido = async (a) => {
    if (!clienteIdActivo) {
      setAviso('Para asociar el pedido necesito un cliente activo: elegi uno y volve a intentar.');
      return;
    }
    const clave = eanDe(a) || a.codigo;
    setCreandoPedido(clave);
    setAviso('');
    try {
      await crmApi.crearPedido({
        clienteId: clienteIdActivo,
        codigo: clave,
        descripcionTexto: clave ? undefined : a.titulo,
        cantidad: 1,
        observaciones: 'Pedido desde el buscador F7',
      });
      setAviso(`Pedido creado: "${a.titulo}". Queda en CRM > Pedidos.`);
    } catch (err) {
      setAviso(`No pude crear el pedido: ${err.message}`);
    } finally {
      setCreandoPedido('');
    }
  };

  // ↺ Limpiar: borra el borrador guardado (texto, resultados y comando) y arranca de cero.
  const limpiar = () => {
    limpiarMemoria();
    setError('');
    if (inputRef.current) inputRef.current.focus();
  };

  const footer = (
    <div className="flex items-center justify-between gap-2 w-full">
      <span className="text-xs text-muted">
        Busca por significado en todo el catalogo{clienteIdActivo ? ' (con el cliente activo como contexto)' : ''}. Enter para buscar · escribi <span className="font-mono">$ayuda</span> para ver los comandos.
        {cargando
          ? ' Buscando... (el primer buscar del dia arma el indice: puede tardar unos segundos; podes cerrar y volver con F7, el resultado queda).'
          : ' La busqueda se conserva al cerrar: volve con F7 y sigue ahi.'}
      </span>
      <div className="flex gap-2">
        {onAbrirAsistente && (
          <button type="button" className="btn btn-ghost text-xs" onClick={() => { onCerrar(); onAbrirAsistente(); }}>
            Abrir el Asistente
          </button>
        )}
        <button type="button" className="btn btn-ghost text-xs" title="Empezar de cero (borra la busqueda guardada)" onClick={limpiar}>↺ Limpiar</button>
        <button type="button" className="btn btn-ghost text-xs" onClick={onCerrar}>Cerrar (Esc)</button>
      </div>
    </div>
  );

  return (
    <Modal abierto={abierto} onClose={onCerrar} titulo="Buscador semantico (F7)" ancho="900px" footer={footer}>
      <div className="flex gap-2 mb-3">
        <input
          ref={inputRef}
          className="input-os flex-1"
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); buscar(); } }}
          placeholder="que le regalo a alguien que le gusta el policial argentino"
        />
        <button type="button" className="btn btn-primary text-sm" disabled={cargando || !texto.trim()} onClick={buscar}>
          {cargando ? 'Buscando...' : 'Buscar'}
        </button>
      </div>
      {error && <p className="text-sm mb-2" style={{ color: 'var(--danger)' }}>{error}</p>}
      {aviso && <p className="text-xs mb-2" style={{ color: 'var(--accent)' }}>{aviso}</p>}
      {consultado && !error && <p className="text-xs text-muted mb-2">{resultados.length} resultado(s) para «{consultado}»</p>}
      {comandoTexto && (
        <pre className="text-xs whitespace-pre-wrap mb-2" style={{ maxHeight: '56vh', overflowY: 'auto' }}>{comandoTexto}</pre>
      )}
      <div className="space-y-2" style={{ maxHeight: '56vh', overflowY: 'auto' }}>
        {resultados.map((a, i) => {
          const disponible = stockDe(a) > 0;
          return (
          <div key={eanDe(a) || a.articuloId || i} className="f7-card">
            <div className="f7-tarjeta">
              <TapaLibro ean={eanDe(a)} />
              <div className="f7-cuerpo">
                <div className="f7-titulo-fila">
                  <h4 className="f7-titulo">{a.titulo}</h4>
                  <span className={`f7-badge${disponible ? '' : ' pedir'}`}>
                    {disponible ? `Stock: ${stockDe(a)}` : 'A Pedir'}
                  </span>
                </div>
                <p className="f7-meta">{[a.autor, a.editorial].filter(Boolean).join(' — ')}</p>
                {(a.digestoCorto || a.digesto) && <p className="f7-digesto">{a.digestoCorto || a.digesto}</p>}
                {a.tipVenta && <p className="f7-tip"><strong>Tip:</strong> {a.tipVenta}</p>}
                {a.justificacion && <p className="f7-tip"><strong>¿Por qué?:</strong> {a.justificacion}</p>}
                {eanDe(a) && <p className="f7-ean">EAN13: <span className="f7-mono">{eanDe(a)}</span></p>}
                <p className="f7-precio">{money(a.precio)} · score {Number(a.score || 0).toFixed(3)}</p>
              </div>
            </div>
            <div className="f7-acciones">
              <BotonSecretario
                className="btn btn-ghost text-xs"
                consulta={`Pregunta de mostrador: ${consultado}. Que me decis de "${a.titulo}"?`}
                alPedir={onCerrar}
              />
              {disponible ? (
                <button
                  type="button"
                  className="btn btn-primary text-xs"
                  onClick={() => agregarAFactura(a)}
                  title="Carga el titulo en la factura minorista"
                >
                  Agregar a factura
                </button>
              ) : (
                <button
                  type="button"
                  className="btn text-xs"
                  disabled={creandoPedido === (eanDe(a) || a.codigo)}
                  onClick={() => agregarPedido(a)}
                  title="Crea el pedido del cliente (queda en CRM > Pedidos)"
                >
                  {creandoPedido === (eanDe(a) || a.codigo) ? 'Pidiendo...' : 'Agregar pedido'}
                </button>
              )}
            </div>
          </div>
          );
        })}
        {!resultados.length && !error && (
          <p className="text-sm text-muted">
            Describi lo que buscas en lenguaje natural (tema, clima, a quien le puede gustar) y apreta Enter.
          </p>
        )}
      </div>
    </Modal>
  );
}
