// BookOS - ConsignaPage.jsx
// ruta: bookos/frontend/src/pages/ConsignaPage.jsx
// descripcion: flujo de consignacion: liquidaciones, conciliador de sabanas, devoluciones (motor
//   FIFE) y preparado de devolucion (CSV del proveedor cruzado con el stock de cada local, con
//   descarga general o por sucursal). Interconectado con el Secretario (contexto + consulta +
//   observaciones LLM de cada documento).

import { useEffect, useState } from 'react';
import Table from '../ui/Table';
import Modal from '../ui/Modal';
import Paginador from '../ui/Paginador';
import TablaItemsPaginada from '../ui/TablaItemsPaginada';
import DebugTag from '../ui/DebugTag';
import ItemsEditorBlock from '../blocks/ItemsEditorBlock';
import ImportarCsvBlock from '../blocks/ImportarCsvBlock';
import ImportarDocumentoBlock from '../blocks/ImportarDocumentoBlock';
import BuscadorArticuloBlock from '../blocks/BuscadorArticuloBlock';
import SelectBuscador from '../ui/SelectBuscador';
import { buscarProveedores } from '../utils/selectores';
import { consignaApi, preparadosApi, observacionesApi } from '../api/api';
import { descargarDesdeServidor } from '../utils/exportar';
import { mapearFilas } from '../utils/csv';
import { useAppContext } from '../AppContext';
import BotonSecretario from '../ui/BotonSecretario';
import BorradorRestaurado from '../ui/BorradorRestaurado';
// Sesion de trabajo: el borrador de cada sub-forma sobrevive al refresco y al cierre.
import usePersistentWork from '../hooks/usePersistentWork';

const fmt = (n) => `$${Number(n || 0).toLocaleString('es-AR')}`;

export default function ConsignaPage() {
  const [tab, setTab] = useState('liquidaciones');
  const [provNombres, setProvNombres] = useState({}); // id -> nombre (los que el operario elige)
  const [liquidaciones, setLiquidaciones] = useState([]);
  const [conciliaciones, setConciliaciones] = useState([]);
  const [devoluciones, setDevoluciones] = useState([]);
  const [preparados, setPreparados] = useState([]);
  const [mensaje, setMensaje] = useState('');

  // liquidacion nueva
  const [liqAbierto, setLiqAbierto] = useState(false);
  // BORRADOR PERSISTENTE por usuario: cabecera y renglones de la liquidacion sobreviven al refresco.
  const [liq, setLiq, limpiarLiq, liqRestaurado] = usePersistentWork('consigna_liquidacion', { proveedor: '', items: [], desc: 0, obs: '', modo: 'diferencia', desde: '', hasta: '' });
  const { proveedor: liqProveedor, items: liqItems, desc: liqDesc, obs: liqObs, modo: liqModo, desde: liqDesde, hasta: liqHasta } = liq;
  const setLiqProveedor = (v) => setLiq((b) => ({ ...b, proveedor: v }));
  const setLiqDesc = (v) => setLiq((b) => ({ ...b, desc: v }));
  const setLiqObs = (v) => setLiq((b) => ({ ...b, obs: v }));
  const setLiqModo = (v) => setLiq((b) => ({ ...b, modo: v }));
  const setLiqDesde = (v) => setLiq((b) => ({ ...b, desde: v }));
  const setLiqHasta = (v) => setLiq((b) => ({ ...b, hasta: v }));
  const setLiqItems = (v) => setLiq((b) => ({ ...b, items: typeof v === 'function' ? v(b.items) : v }));

  // conciliador
  const [concAbierto, setConcAbierto] = useState(false);
  // La sabana pegada es trabajo del operario: se guarda mientras pega y mientras cruza.
  const [conc, setConc, limpiarConc, concRestaurado] = usePersistentWork('consigna_conciliacion', { proveedor: '', texto: '' });
  const { proveedor: concProveedor, texto: concTexto } = conc;
  const setConcProveedor = (v) => setConc((b) => ({ ...b, proveedor: v }));
  const setConcTexto = (v) => setConc((b) => ({ ...b, texto: v }));
  const [concPrev, setConcPrev] = useState(null);
  const [concAplicar, setConcAplicar] = useState(null); // preview del ajuste sugerido (A-3b)
  const [concAplicando, setConcAplicando] = useState(false);

  // devolucion nueva
  const [devAbierto, setDevAbierto] = useState(false);
  // Borrador persistente: la devolucion a medio armar no se pierde al navegar.
  const [dev, setDev, limpiarDev, devRestaurado] = usePersistentWork('consigna_devolucion', { proveedor: '', items: [], motivo: '' });
  const { proveedor: devProveedor, items: devItems, motivo: devMotivo } = dev;
  const setDevProveedor = (v) => setDev((b) => ({ ...b, proveedor: v }));
  const setDevMotivo = (v) => setDev((b) => ({ ...b, motivo: v }));
  const setDevItems = (v) => setDev((b) => ({ ...b, items: typeof v === 'function' ? v(b.items) : v }));

  // facturar liquidacion
  const [facturar, setFacturar] = useState(null); // liquidacion
  const [compraId, setCompraId] = useState('');

  // observaciones + detalle
  const [observacion, setObservacion] = useState(null);
  const [detalle, setDetalle] = useState(null);

  // preparado de devolucion (Keops PD): CSV del proveedor cruzado con el stock de cada local
  const [prepAbierto, setPrepAbierto] = useState(false);
  // Borrador persistente: el CSV del proveedor ya cruzado no se pierde (el cruce se recalcula).
  const [prep, setPrep, limpiarPrep, prepRestaurado] = usePersistentWork('consigna_preparado', { proveedor: '', filas: [], obs: '' });
  const { proveedor: prepProveedor, filas: prepFilas, obs: prepObs } = prep;
  const setPrepProveedor = (v) => setPrep((b) => ({ ...b, proveedor: v }));
  const setPrepFilas = (v) => setPrep((b) => ({ ...b, filas: typeof v === 'function' ? v(b.filas) : v }));
  const setPrepObs = (v) => setPrep((b) => ({ ...b, obs: v }));
  const [prepCruce, setPrepCruce] = useState(null);
  const [prepDetalle, setPrepDetalle] = useState(null);

  const { setContextoActual, pedirConsulta } = useAppContext();

  const elegirProveedor = (setter, it) => {
    setter(it ? it.id : '');
    if (it) setProvNombres((m) => ({ ...m, [it.id]: it.etiqueta }));
  };

  const nombreProv = (fila) => {
    if (!fila) return '';
    if (fila.proveedor && typeof fila.proveedor === 'object') return fila.proveedor.nombre || `#${fila.proveedorId}`;
    if (typeof fila.proveedor === 'string' && fila.proveedor) return fila.proveedor;
    return provNombres[fila.proveedorId] || `#${fila.proveedorId}`;
  };

  const cargar = async () => {
    // Cada listado con su paginador (allSettled: que un endpoint pendiente no deje ciega a toda la pagina).
    ['liq', 'dev', 'conc', 'prep'].forEach((t) => cargarLista(t));
  };

  const LIMITE_PAG = 30;
  const [paginacion, setPaginacion] = useState({ liq: { page: 1, total: 0 }, dev: { page: 1, total: 0 }, conc: { page: 1, total: 0 }, prep: { page: 1, total: 0 } });

  const cargarLista = async (t, page = null) => {
    try {
      const p = page || paginacion[t].page;
      let filas = [];
      let total = 0;
      if (t === 'liq') {
        const r = await consignaApi.liquidaciones({ page: p, limit: LIMITE_PAG });
        filas = (r.data && r.data.filas) || []; total = (r.data && r.data.total) || 0; setLiquidaciones(filas);
      } else if (t === 'dev') {
        const r = await consignaApi.listarDevoluciones({ page: p, limit: LIMITE_PAG });
        filas = (r.data && r.data.filas) || []; total = (r.data && r.data.total) || 0; setDevoluciones(filas);
      } else if (t === 'conc') {
        const r = await consignaApi.listarConciliaciones({ page: p, limit: LIMITE_PAG });
        filas = (r.data && r.data.filas) || []; total = (r.data && r.data.total) || 0; setConciliaciones(filas);
      } else {
        const r = await preparadosApi.listar({ page: p, limit: LIMITE_PAG });
        filas = (r.data && r.data.filas) || []; total = (r.data && r.data.total) || 0; setPreparados(filas);
      }
      setPaginacion((prev) => ({ ...prev, [t]: { page: p, total } }));
    } catch (e) { /* el listado queda vacio */ }
  };

  useEffect(() => {
    cargar();
  }, []); // eslint-disable-line

  useEffect(() => {
    setContextoActual({
      vista: 'consigna',
      tab,
      liquidaciones: liquidaciones.length,
      conciliaciones: conciliaciones.length,
      devoluciones: devoluciones.length,
      preparados: preparados.length,
    });
  }, [tab, liquidaciones.length, conciliaciones.length, devoluciones.length, preparados.length]); // eslint-disable-line

  const observar = async (tipo, id) => {
    try {
      const res = await observacionesApi.documento({ tipo, id });
      setObservacion(res.data);
      setMensaje('Observación del Secretario generada ✓');
    } catch (err) { setMensaje(`⚠️ ${err.message}`); }
  };

  const importarLiq = (raw) => {
    const filas = mapearFilas(raw, ['ean13', 'titulo', 'cantidad', 'precio']);
    const nuevos = filas.filter((f) => f.ean13).map((f) => ({ ean13: String(f.ean13), titulo: f.titulo || String(f.ean13), cantidad: Number(f.cantidad) || 1, precioUnitario: Number(f.precio) || 0 }));
    setLiqItems((prev) => [...prev, ...nuevos]);
  };

  const importarDev = (raw) => {
    const filas = mapearFilas(raw, ['ean13', 'titulo', 'cantidad']);
    const nuevos = filas.filter((f) => f.ean13).map((f) => ({ ean13: String(f.ean13), titulo: f.titulo || String(f.ean13), cantidad: Number(f.cantidad) || 1 }));
    setDevItems((prev) => [...prev, ...nuevos]);
  };

  const importarLiqDoc = (list) => {
    const nuevos = list.filter((i) => i.ean13).map((i) => ({ ean13: i.ean13, titulo: i.titulo || i.ean13, cantidad: i.cantidad, precioUnitario: i.precio }));
    setLiqItems((prev) => [...prev, ...nuevos]);
  };

  const importarDevDoc = (list) => {
    const nuevos = list.filter((i) => i.ean13).map((i) => ({ ean13: i.ean13, titulo: i.titulo || i.ean13, cantidad: i.cantidad }));
    setDevItems((prev) => [...prev, ...nuevos]);
  };

  // ---- Liquidaciones ----
  const totalLiq = liqItems.reduce((a, i) => a + (Number(i.precioUnitario) || 0) * (Number(i.cantidad) || 0), 0);

  // TRAE EL CORTE: el motor ya sabe cortar por diferencia de stock o por periodo (con su preview).
  // Si el operario ya cargo renglones a mano, se le pregunta antes de reemplazarlos.
  const traerCorte = async () => {
    if (!liqProveedor) { setMensaje('⚠️ Elegí el proveedor antes de traer el corte'); return; }
    if (liqModo === 'periodo' && (!liqDesde || !liqHasta)) { setMensaje('⚠️ El corte por período necesita desde y hasta'); return; }
    if (liqItems.length > 0 && !window.confirm(`Ya hay ${liqItems.length} renglón(es) cargados: ¿los reemplazo por el corte?`)) return;
    try {
      const res = await consignaApi.previsualizarLiquidacion({
        proveedorId: Number(liqProveedor), modo: liqModo, desde: liqDesde || undefined, hasta: liqHasta || undefined, porcentajeDescuento: Number(liqDesc) || 0,
      });
      const corte = res.data || {};
      const filas = (corte.items || []).map((i) => ({ articuloId: i.articuloId, ean13: i.codigo, titulo: i.titulo, cantidad: Number(i.cantidad) || 0, precioUnitario: Number(i.precioUnitario) || 0 }));
      setLiqItems(filas);
      setMensaje(filas.length
        ? `Corte ${corte.modo} de ${corte.proveedor}: ${filas.length} título(s) por $${Number(corte.total || 0).toLocaleString('es-AR')} ✓`
        : 'El corte no encontró consigna para liquidar con esos parámetros');
    } catch (err) { setMensaje(`⚠️ ${err.message}`); }
  };

  const crearLiquidacion = async () => {
    try {
      await consignaApi.crearLiquidacion({
        proveedorId: Number(liqProveedor),
        totalEstimado: totalLiq,
        porcentajeDescuento: Number(liqDesc) || 0,
        observaciones: liqObs || null,
        // El modo y el rango viajan al motor: la liquidacion queda registrada con COMO se corto.
        modo: liqModo,
        desde: liqModo === 'periodo' ? liqDesde : null,
        hasta: liqModo === 'periodo' ? liqHasta : null,
        // Los renglones viajan como overrides (el servicio los cruza por articuloId).
        items: liqItems.map((i) => ({ articuloId: i.articuloId || null, cantidad: Number(i.cantidad) || 0, precioUnitario: Number(i.precioUnitario) || 0 })),
      });
      setMensaje('Liquidación creada ✓');
      setLiqAbierto(false);
      limpiarLiq();
      cargar();
    } catch (err) { setMensaje(`⚠️ ${err.message}`); }
  };

  const confirmarFacturar = async () => {
    try {
      await consignaApi.facturarLiquidacion(facturar.id, Number(compraId));
      setMensaje(`Liquidación #${facturar.id} facturada ✓`);
      setFacturar(null); setCompraId('');
      cargar();
    } catch (err) { setMensaje(`⚠️ ${err.message}`); }
  };

  // ---- Conciliador ----
  const parsearFilas = () => concTexto
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => {
      const [codigo, cantidad] = l.split(/[;,\t]/).map((x) => x.trim());
      return { codigo, cantidad: parseInt(cantidad, 10) || 0 };
    })
    .filter((f) => f.codigo);

  const previsualizar = async () => {
    try {
      const res = await consignaApi.previsualizarConciliacion({ proveedorId: Number(concProveedor), filas: parsearFilas() });
      setConcPrev(res.data || []);
    } catch (err) { setMensaje(`⚠️ ${err.message}`); }
  };

  const guardarConciliacion = async () => {
    try {
      const detalle = (concPrev || []).map((r) => ({
        ean13: r.ean13, titulo: r.titulo, stockLocal: r.stockLocal, stockProveedor: r.stockProveedor, diferencia: r.diferencia, accion: r.accion,
      }));
      await consignaApi.guardarConciliacion({ proveedorId: Number(concProveedor), detalle });
      setMensaje('Conciliación guardada ✓');
      setConcAbierto(false); setConcPrev(null);
      limpiarConc();
      cargar();
    } catch (err) { setMensaje(`⚠️ ${err.message}`); }
  };

  // ---- Devoluciones ----
  const crearDevolucion = async () => {
    try {
      await consignaApi.registrarDevolucion({
        tipo: 'PROVEEDOR',
        proveedorId: Number(devProveedor),
        motivo: devMotivo || null,
        items: devItems.map((i) => ({ ean13: i.ean13, cantidad: Number(i.cantidad), tipoSolicitada: i.tipoSolicitada || 'AUTO' })),
      });
      setMensaje('Devolución registrada ✓');
      setDevAbierto(false);
      limpiarDev();
      cargar();
    } catch (err) { setMensaje(`⚠️ ${err.message}`); }
  };

  const anularLiquidacion = async (id) => { try { await consignaApi.anularLiquidacion(id); setMensaje('Liquidación anulada ✓'); cargar(); } catch (e) { setMensaje(`⚠️ ${e.message}`); } };
  const anularConciliacion = async (id) => { try { await consignaApi.anularConciliacion(id); setMensaje('Conciliación anulada ✓'); cargar(); } catch (e) { setMensaje(`⚠️ ${e.message}`); } };

  // Aplicar el ajuste sugerido (espejo FIFE: actual + original) — preview primero, nunca automático.
  const abrirAplicar = async (c) => {
    try {
      const res = await consignaApi.previsualizarAplicarConciliacion(c.id);
      setConcAplicar({ conc: c, ...res.data });
    } catch (err) { setMensaje(`⚠️ ${err.message}`); }
  };

  const confirmarAplicar = async () => {
    if (!concAplicar) return;
    setConcAplicando(true);
    try {
      const res = await consignaApi.aplicarConciliacion(concAplicar.conc.id);
      const d = res.data || {};
      const omitidas = (d.omitidas || []).length;
      setMensaje(`Ajustes aplicados: ${(d.aplicadas || []).length}${omitidas ? ` · ${omitidas} omitidas` : ''}${d.aplicada === false ? ' (nada para aplicar)' : ''}`);
      setConcAplicar(null);
      cargar();
    } catch (err) { setMensaje(`⚠️ ${err.message}`); } finally { setConcAplicando(false); }
  };
  const anularDevolucion = async (id) => { try { await consignaApi.anularDevolucion(id); setMensaje('Devolución anulada ✓'); cargar(); } catch (e) { setMensaje(`⚠️ ${e.message}`); } };

  // ---- Preparado de devolución (CSV del proveedor × stock de los locales) ----
  const importarPrep = (raw) => {
    const filas = mapearFilas(raw, ['ean13', 'titulo', 'cantidad']);
    const nuevos = filas.filter((f) => f.ean13).map((f) => ({ ean13: String(f.ean13), titulo: f.titulo || '', cantidad: Number(f.cantidad) || 1 }));
    if (!nuevos.length) { setMensaje('⚠️ el CSV no tiene filas con código y cantidad'); return; }
    setPrepFilas(nuevos);
    setPrepCruce(null);
    previsualizarPrep(nuevos);
  };

  const previsualizarPrep = async (filas = prepFilas) => {
    if (!filas.length) { setMensaje('⚠️ importá primero el CSV del proveedor'); return; }
    try {
      const res = await preparadosApi.previsualizar({ filas });
      setPrepCruce(res.data || null);
    } catch (err) { setMensaje(`⚠️ ${err.message}`); }
  };

  const emitirPrep = async () => {
    if (!prepProveedor) { setMensaje('⚠️ elegí el proveedor que solicita la devolución'); return; }
    try {
      const res = await preparadosApi.crear({ proveedorId: Number(prepProveedor), filas: prepFilas, observaciones: prepObs || null });
      setMensaje(`Preparado ${res.data.numero} emitido (${res.data.items} renglones${res.data.faltantes ? `, ${res.data.faltantes} sin encontrar` : ''}) ✓`);
      setPrepAbierto(false);
      limpiarPrep();
      cargar();
    } catch (err) { setMensaje(`⚠️ ${err.message}`); }
  };

  const verPrep = async (p) => {
    try {
      const res = await preparadosApi.obtener(p.id);
      setPrepDetalle(res.data || null);
    } catch (err) { setMensaje(`⚠️ ${err.message}`); }
  };

  const anularPrep = async (id) => {
    if (!window.confirm(`¿Anular el preparado #${id}? No mueve stock: solo deja de estar vigente.`)) return;
    try { await preparadosApi.anular(id); setMensaje('Preparado anulado ✓'); setPrepDetalle(null); cargar(); } catch (e) { setMensaje(`⚠️ ${e.message}`); }
  };

  // Descarga del CSV (general o el de un local, para repartir a cada sucursal).
  const descargarPrep = async (id, { modo = 'general', localId = null } = {}) => {
    try {
      const res = await preparadosApi.exportar(id, modo === 'por-local' ? { modo, localId } : { modo });
      const desc = res.data || {};
      await descargarDesdeServidor(`/archivos/${desc.archivoId}/descarga`, desc.nombre);
      setMensaje(`CSV ${desc.nombre} descargado ✓`);
    } catch (err) { setMensaje(`⚠️ ${err.message}`); }
  };

  // E14: descarga por documento de liquidaciones y devoluciones (CSV/PDF/mail).
  const descargarDoc = async (apiMetodo, doc, formato, etiqueta) => {
    try {
      const res = await consignaApi[apiMetodo](doc.id);
      const d = res.data || {};
      await descargarDesdeServidor(`/archivos/${d.archivoId}/descarga`, d.nombre);
      setMensaje(`${d.nombre} descargado ✓`);
    } catch (err) { setMensaje(`⚠️ ${err.message}`); }
  };

  const enviarDocMail = async (apiMetodo, doc, etiqueta) => {
    try {
      const res = await consignaApi[apiMetodo](doc.id);
      const d = res.data || {};
      setMensaje(d.enviado
        ? `${etiqueta} enviada a ${d.a || 'el proveedor'}${d.redirigido ? ' (MODO PRUEBA)' : ''} ✓`
        : `⚠️ No se pudo enviar: ${d.motivo || 'sin configurar'}`);
    } catch (err) { setMensaje(`⚠️ ${err.message}`); }
  };

  // Valores del snapshot congelado de un renglón, por local.
  const valorPrep = (item, depositoId, campo) => {
    const fila = (item.snapshot || []).find((s) => s.depositoId === depositoId);
    return fila ? Number(fila[campo] || 0) : 0;
  };

  const colLiqItems = [
    { clave: 'ean13', titulo: 'EAN', editable: true, ancho: 130 },
    { clave: 'titulo', titulo: 'Titulo', editable: true, ancho: 240 },
    { clave: 'cantidad', titulo: 'Cant.', editable: true, tipo: 'number', ancho: 70 },
    { clave: 'precioUnitario', titulo: 'Precio', editable: true, tipo: 'number', ancho: 100 },
  ];

  const colDevItems = [
    { clave: 'ean13', titulo: 'EAN', editable: true, ancho: 150 },
    { clave: 'titulo', titulo: 'Titulo', editable: true, ancho: 260 },
    { clave: 'cantidad', titulo: 'Cant.', editable: true, tipo: 'number', ancho: 80 },
    {
      clave: 'tipoSolicitada',
      titulo: 'Sale de',
      ancho: 140,
      render: (it, i, setCampo) => (
        <select className="input-os" style={{ padding: '4px 8px' }} value={it.tipoSolicitada || 'AUTO'} onChange={(e) => setCampo(i, 'tipoSolicitada', e.target.value)}>
          <option value="AUTO">Auto (C → F)</option>
          <option value="CONSIGNA">Consigna</option>
          <option value="FIRME">Firme</option>
        </select>
      ),
    },
  ];

  const colLiquidaciones = [
    { clave: 'id', titulo: 'ID' },
    { clave: 'proveedor', titulo: 'Proveedor', render: (l) => nombreProv(l) },
    { clave: 'estado', titulo: 'Estado', render: (l) => <span className="agente-badge">{l.estado}</span> },
    { clave: 'totalEstimado', titulo: 'Total', render: (l) => fmt(l.totalEstimado), valorExport: (l) => Number(l.totalEstimado) },
    { clave: 'acciones', titulo: '', render: (l) => (
      <div className="flex gap-2">
        <button type="button" className="btn btn-ghost text-xs" onClick={() => setDetalle({ tipo: 'liquidacion', doc: l })}>Ver</button>
        <button type="button" className="btn btn-ghost text-xs" onClick={() => descargarDoc('csvLiquidacion', l, 'csv', 'Liquidación')}>CSV</button>
        <button type="button" className="btn btn-ghost text-xs" onClick={() => descargarDoc('pdfLiquidacion', l, 'pdf', 'Liquidación')}>PDF</button>
        <button type="button" className="btn btn-ghost text-xs" onClick={() => enviarDocMail('mailLiquidacion', l, 'Liquidación')}>Mail</button>
        {l.estado === 'PENDIENTE' && <button type="button" className="btn btn-ghost text-xs" onClick={() => setFacturar(l)}>Facturar</button>}
        {l.estado !== 'ANULADA' && <button type="button" className="btn btn-ghost text-xs" style={{ color: 'var(--danger)' }} onClick={() => anularLiquidacion(l.id)}>Anular</button>}
        <button type="button" className="btn btn-ghost text-xs" onClick={() => observar('liquidacion', l.id)}>🧠</button>
      </div>
    ) },
  ];

  const colConciliaciones = [
    { clave: 'id', titulo: 'ID' },
    { clave: 'proveedor', titulo: 'Proveedor', render: (c) => nombreProv(c) },
    { clave: 'estado', titulo: 'Estado', render: (c) => <span className="agente-badge">{c.estado}{c.aplicada ? ' · ajustada' : ''}</span> },
    { clave: 'acciones', titulo: '', render: (c) => (
      <div className="flex gap-2">
        <button type="button" className="btn btn-ghost text-xs" onClick={() => setDetalle({ tipo: 'conciliacion', doc: c })}>Ver</button>
        {c.estado !== 'ANULADA' && !c.aplicada && <button type="button" className="btn btn-ghost text-xs" onClick={() => abrirAplicar(c)}>Aplicar</button>}
        {c.estado !== 'ANULADA' && <button type="button" className="btn btn-ghost text-xs" style={{ color: 'var(--danger)' }} onClick={() => anularConciliacion(c.id)}>Anular</button>}
        <button type="button" className="btn btn-ghost text-xs" onClick={() => observar('conciliacion', c.id)}>🧠</button>
      </div>
    ) },
  ];

  const colDevoluciones = [
    { clave: 'id', titulo: 'ID' },
    { clave: 'nroRemito', titulo: 'Nro', render: (d) => <span className="font-mono text-xs">{d.nroRemito}</span> },
    { clave: 'estado', titulo: 'Estado', render: (d) => <span className="agente-badge">{d.estado}</span> },
    { clave: 'motivo', titulo: 'Motivo' },
    { clave: 'acciones', titulo: '', render: (d) => (
      <div className="flex gap-2">
        <button type="button" className="btn btn-ghost text-xs" onClick={() => descargarDoc('csvDevolucion', d, 'csv', 'Devolución')}>CSV</button>
        <button type="button" className="btn btn-ghost text-xs" onClick={() => descargarDoc('pdfDevolucion', d, 'pdf', 'Devolución')}>PDF</button>
        <button type="button" className="btn btn-ghost text-xs" onClick={() => enviarDocMail('mailDevolucion', d, 'Devolución')}>Mail</button>
        {d.estado !== 'ANULADA' && <button type="button" className="btn btn-ghost text-xs" style={{ color: 'var(--danger)' }} onClick={() => anularDevolucion(d.id)}>Anular</button>}
        <button type="button" className="btn btn-ghost text-xs" onClick={() => observar('devolucion', d.id)}>🧠</button>
      </div>
    ) },
  ];

  const colPreparados = [
    { clave: 'numero', titulo: 'Nro', render: (p) => <span className="font-mono text-xs">{p.numero}</span> },
    { clave: 'fecha', titulo: 'Fecha', render: (p) => new Date(p.fecha).toLocaleDateString('es-AR'), valorExport: (p) => new Date(p.fecha).toLocaleDateString('es-AR') },
    { clave: 'proveedor', titulo: 'Proveedor', render: (p) => nombreProv(p) },
    { clave: 'items', titulo: 'Títulos', render: (p) => p.items },
    { clave: 'unidades', titulo: 'Solicitado', render: (p) => p.unidades },
    { clave: 'faltantes', titulo: 'Sin encontrar', render: (p) => (p.faltantes ? <span style={{ color: 'var(--danger)' }}>{p.faltantes}</span> : '—') },
    { clave: 'estado', titulo: 'Estado', render: (p) => <span className="agente-badge">{p.estado}</span> },
    { clave: 'acciones', titulo: '', render: (p) => (
      <div className="flex gap-2">
        <button type="button" className="btn btn-ghost text-xs" onClick={() => verPrep(p)}>Ver</button>
        <button type="button" className="btn btn-ghost text-xs" onClick={() => descargarPrep(p.id)}>CSV</button>
        {p.estado !== 'ANULADO' && <button type="button" className="btn btn-ghost text-xs" style={{ color: 'var(--danger)' }} onClick={() => anularPrep(p.id)}>Anular</button>}
        <button type="button" className="btn btn-ghost text-xs" onClick={() => observar('preparado', p.id)}>🧠</button>
      </div>
    ) },
  ];

  // Columnas del detalle: las sucursales llevan el físico; el central, original/actual/físico.
  const colPrepItems = prepDetalle ? (() => {
    const sucursales = prepDetalle.locales.filter((l) => l.tipo !== 'CENTRAL');
    const central = prepDetalle.locales.find((l) => l.tipo === 'CENTRAL');
    const columnas = [
      { clave: 'cantidadSolicitada', titulo: 'Solicitado', ancho: 80 },
      { clave: 'ean13', titulo: 'EAN', ancho: 130 },
      { clave: 'titulo', titulo: 'Título', render: (it) => (it.articulo ? it.articulo.titulo : (it.tituloProveedor || 'NO ENCONTRADO')), ancho: 240 },
      { clave: 'autor', titulo: 'Autor', render: (it) => (it.articulo && it.articulo.autorPrincipal ? it.articulo.autorPrincipal.nombre : '') },
      { clave: 'editorial', titulo: 'Editorial', render: (it) => (it.articulo && it.articulo.editorial ? it.articulo.editorial.nombre : '') },
    ];
    for (const l of sucursales) {
      columnas.push({ clave: `loc${l.id}`, titulo: l.nombre, ancho: 90, render: (it) => (it.faltante ? 'NO ENCONTRADO' : valorPrep(it, l.id, 'fisico')) });
    }
    if (central) {
      columnas.push({ clave: `c${central.id}o`, titulo: `${central.nombre} orig.`, ancho: 90, render: (it) => (it.faltante ? '—' : valorPrep(it, central.id, 'original')) });
      columnas.push({ clave: `c${central.id}a`, titulo: `${central.nombre} consigna`, ancho: 90, render: (it) => (it.faltante ? '—' : valorPrep(it, central.id, 'consigna')) });
      columnas.push({ clave: `c${central.id}f`, titulo: `${central.nombre} físico`, ancho: 90, render: (it) => (it.faltante ? '—' : valorPrep(it, central.id, 'fisico')) });
    }
    columnas.push({
      clave: 'total',
      titulo: 'Total',
      ancho: 80,
      render: (it) => (it.faltante ? '—' : prepDetalle.locales.reduce((a, l) => a + valorPrep(it, l.id, 'fisico'), 0)),
    });
    return columnas;
  })() : [];

  return (
    <div>
      <DebugTag nombre="ConsignaPage" />
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold">Consignación</h2>
        <span className="text-xs text-muted">liquidaciones · sábanas · devoluciones (FIFE: consigna / firme / auto)</span>
      </div>

      {mensaje && <p className="text-sm mb-3">{mensaje}</p>}

      <div className="flex items-center gap-3 mb-4">
        <div className="flex gap-1">
          <button type="button" className={`btn ${tab === 'liquidaciones' ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setTab('liquidaciones')}>Liquidaciones</button>
          <button type="button" className={`btn ${tab === 'conciliador' ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setTab('conciliador')}>Conciliador</button>
          <button type="button" className={`btn ${tab === 'devoluciones' ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setTab('devoluciones')}>Devoluciones</button>
          <button type="button" className={`btn ${tab === 'preparados' ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setTab('preparados')}>Preparado devolución</button>
        </div>
        <div className="flex-1" />
        <BotonSecretario
          className="btn btn-ghost text-xs"
          consulta={`Estoy en la vista de consignación (${tab}). ¿Que me sugeris?`}
        />
        <button type="button" className="btn btn-primary text-xs" onClick={() => {
          if (tab === 'liquidaciones') setLiqAbierto(true);
          if (tab === 'conciliador') setConcAbierto(true);
          if (tab === 'devoluciones') setDevAbierto(true);
          // El borrador NO se borra al abrir el modal: si hay uno restaurado, el operario sigue donde estaba.
          if (tab === 'preparados') { setPrepAbierto(true); }
        }}>
          + {tab === 'liquidaciones' ? 'Liquidación' : tab === 'conciliador' ? 'Conciliación' : tab === 'devoluciones' ? 'Devolución' : 'Preparado'}
        </button>
      </div>

      {observacion && (
        <div className="card p-3 mb-4" style={{ borderLeft: '3px solid var(--accent)' }}>
          <div className="text-xs uppercase tracking-widest text-muted mb-1">Observación del Secretario</div>
          <p className="text-sm">{observacion.observacion}</p>
        </div>
      )}

      {tab === 'liquidaciones' && (
        <>
          <Table columnas={colLiquidaciones} filas={liquidaciones} vacio="Sin liquidaciones" exportable exportarNombre="liquidaciones" />
          <Paginador page={paginacion.liq.page} total={paginacion.liq.total} limite={LIMITE_PAG} onCambiar={(p) => cargarLista('liq', p)} etiqueta="liquidaciones" />
        </>
      )}
      {tab === 'conciliador' && (
        <>
          <Table columnas={colConciliaciones} filas={conciliaciones} vacio="Sin conciliaciones" exportable exportarNombre="conciliaciones" />
          <Paginador page={paginacion.conc.page} total={paginacion.conc.total} limite={LIMITE_PAG} onCambiar={(p) => cargarLista('conc', p)} etiqueta="conciliaciones" />
        </>
      )}
      {tab === 'devoluciones' && (
        <>
          <Table columnas={colDevoluciones} filas={devoluciones} vacio="Sin devoluciones" exportable exportarNombre="devoluciones" />
          <Paginador page={paginacion.dev.page} total={paginacion.dev.total} limite={LIMITE_PAG} onCambiar={(p) => cargarLista('dev', p)} etiqueta="devoluciones" />
        </>
      )}
      {tab === 'preparados' && (
        <>
          <p className="text-xs text-muted mb-2">
            Lo que el proveedor solicita de vuelta, cruzado con el stock físico de cada local: no mueve stock ni genera deuda.
            El CSV se descarga general o por local (para repartir a cada sucursal).
          </p>
          <Table columnas={colPreparados} filas={preparados} vacio="Sin preparados de devolución" exportable exportarNombre="preparados_devolucion" />
          <Paginador page={paginacion.prep.page} total={paginacion.prep.total} limite={LIMITE_PAG} onCambiar={(p) => cargarLista('prep', p)} etiqueta="preparados" />
        </>
      )}

      {/* Nueva liquidacion */}
      <Modal abierto={liqAbierto} onClose={() => setLiqAbierto(false)} titulo="Nueva liquidación" ancho="720px"
        footer={
          <>
            <button type="button" className="btn btn-ghost" onClick={() => setLiqAbierto(false)}>Cancelar</button>
            <button type="button" className="btn btn-primary" disabled={!liqProveedor || liqItems.length === 0} onClick={crearLiquidacion}>Guardar</button>
          </>
        }
      >
        <BorradorRestaurado visible={liqRestaurado} onLimpiar={limpiarLiq} />
        <div className="grid grid-cols-3 gap-3 mb-3">
          <label className="block">
            <span className="block text-xs uppercase tracking-widest text-muted mb-1">Proveedor</span>
            <SelectBuscador
              valor={liqProveedor || null}
              etiquetaValor={provNombres[liqProveedor] || ''}
              placeholder="Buscar proveedor..."
              buscar={buscarProveedores}
              onSeleccionar={(it) => elegirProveedor(setLiqProveedor, it)}
            />
          </label>
          <label className="block">
            <span className="block text-xs uppercase tracking-widest text-muted mb-1">Desc. %</span>
            <input className="input-os" type="number" min="0" value={liqDesc} onChange={(e) => setLiqDesc(Number(e.target.value) || 0)} />
          </label>
          <label className="block">
            <span className="block text-xs uppercase tracking-widest text-muted mb-1">Observaciones</span>
            <input className="input-os" value={liqObs} onChange={(e) => setLiqObs(e.target.value)} />
          </label>
          <label className="block">
            <span className="block text-xs uppercase tracking-widest text-muted mb-1">Corte</span>
            <select className="input-os" value={liqModo} onChange={(e) => setLiqModo(e.target.value)}>
              <option value="diferencia">Diferencia de stock</option>
              <option value="periodo">Ventas del período</option>
            </select>
          </label>
          {liqModo === 'periodo' && (
            <>
              <label className="block">
                <span className="block text-xs uppercase tracking-widest text-muted mb-1">Desde</span>
                <input className="input-os" type="date" value={liqDesde} onChange={(e) => setLiqDesde(e.target.value)} />
              </label>
              <label className="block">
                <span className="block text-xs uppercase tracking-widest text-muted mb-1">Hasta</span>
                <input className="input-os" type="date" value={liqHasta} onChange={(e) => setLiqHasta(e.target.value)} />
              </label>
            </>
          )}
        </div>
        <BuscadorArticuloBlock
          etiqueta="Agregar a la liquidación"
          onSeleccionar={(a) => setLiqItems((prev) => [...prev, { articuloId: a.articuloId || a.id || null, ean13: a.ean13, titulo: a.titulo, cantidad: 1, precioUnitario: Number(a.precio) || 0 }])}
        />
        <div className="flex justify-end mb-3">
          <button type="button" className="btn btn-ghost text-xs" disabled={!liqProveedor} onClick={traerCorte}>Traer corte</button>
        </div>
        <ItemsEditorBlock items={liqItems} onChange={setLiqItems} onRemove={(i) => setLiqItems(liqItems.filter((_, idx) => idx !== i))} columnas={colLiqItems} vacio="Agrega renglones con EAN + cantidad + precio, o traelos con el corte" />
        <div className="flex justify-between mt-3">
          <div className="flex gap-2">
            <button type="button" className="btn btn-ghost text-xs" onClick={() => setLiqItems([...liqItems, { ean13: '', titulo: '', cantidad: 1, precioUnitario: 0 }])}>+ Renglón</button>
            <ImportarCsvBlock etiqueta="Importar CSV" onCargar={importarLiq} />
            <ImportarDocumentoBlock etiqueta="Importar documento" onCargar={importarLiqDoc} />
          </div>
          <span className="text-sm">Total: <strong>{fmt(totalLiq)}</strong></span>
        </div>
      </Modal>

      {/* Conciliador */}
      <Modal abierto={concAbierto} onClose={() => setConcAbierto(false)} titulo="Conciliador de sábanas" ancho="720px"
        footer={
          concPrev
            ? <button type="button" className="btn btn-primary" disabled={(concPrev || []).length === 0} onClick={guardarConciliacion}>Guardar conciliación</button>
            : <button type="button" className="btn btn-primary" disabled={!concProveedor || !concTexto.trim()} onClick={previsualizar}>Previsualizar</button>
        }
      >
        <div className="flex gap-3 mb-3">
          <label className="block flex-1">
            <span className="block text-xs uppercase tracking-widest text-muted mb-1">Proveedor</span>
            <SelectBuscador
              valor={concProveedor || null}
              etiquetaValor={provNombres[concProveedor] || ''}
              placeholder="Buscar proveedor..."
              buscar={buscarProveedores}
              onSeleccionar={(it) => elegirProveedor(setConcProveedor, it)}
            />
          </label>
        </div>
        <label className="block mb-3">
          <span className="block text-xs uppercase tracking-widest text-muted mb-1">Filas de la sábana (código;cantidad por línea)</span>
          <BorradorRestaurado visible={concRestaurado} onLimpiar={limpiarConc} />
          <textarea className="input-os resize-none" rows={6} placeholder={'9789500431859;5\n9789500204378;2'} value={concTexto} onChange={(e) => setConcTexto(e.target.value)} />
        </label>
        {concPrev && (
          <TablaItemsPaginada
            items={concPrev}
            headers={[<th key="ean">EAN</th>, <th key="tit">Titulo</th>, <th key="loc">Local</th>, <th key="prov">Proveedor</th>, <th key="acc">Acción</th>]}
            fila={(r, idx) => (
              <tr key={idx}>
                <td className="font-mono text-xs">{r.ean13 || '—'}</td>
                <td>{r.titulo}</td>
                <td>{r.stockLocal}</td>
                <td>{r.stockProveedor}</td>
                <td className="font-semibold" style={{ color: r.diferencia > 0 ? 'var(--danger)' : 'var(--success)' }}>{r.accion}</td>
              </tr>
            )}
          />
        )}
      </Modal>

      {/* Aplicar el ajuste sugerido de una conciliacion (espejo FIFE: actual + original) */}
      <Modal abierto={!!concAplicar} onClose={() => setConcAplicar(null)} titulo={`Aplicar ajuste ${concAplicar ? concAplicar.conc.numero : ''}`} ancho="880px"
        footer={
          <>
            <button type="button" className="btn btn-ghost" onClick={() => setConcAplicar(null)}>Cancelar</button>
            <button type="button" className="btn btn-primary" disabled={concAplicando || !concAplicar || concAplicar.totales.aAplicar === 0} onClick={confirmarAplicar}>
              {concAplicando ? 'Aplicando...' : `Aplicar ${concAplicar ? concAplicar.totales.aAplicar : 0} ajustes`}
            </button>
          </>
        }
      >
        {concAplicar && (
          <>
            <p className="text-sm mb-3">
              Cada diferencia se aplica por el <strong>ajuste de inventario</strong> (queda auditable y reversible en Inventario):
              sube o baja la <strong>consigna actual y la original juntas</strong>, así el título queda reconocido por el proveedor y vendible.
            </p>
            <p className="text-xs text-muted mb-3">
              Subir: +{concAplicar.totales.subir} · Bajar: {concAplicar.totales.bajar} · No aplicables: {concAplicar.totales.noAplicables}
            </p>
            <table className="table-os">
              <thead><tr><th>EAN</th><th>Titulo</th><th>Acción</th><th>Actual</th><th>Original</th><th>Estado</th></tr></thead>
              <tbody>
                {concAplicar.filas.map((f, i) => (
                  <tr key={i}>
                    <td className="font-mono text-xs">{f.ean13}</td>
                    <td>{f.titulo || '—'}</td>
                    <td className="text-xs">{f.accion}</td>
                    <td className="font-mono text-xs">{f.actual === null ? '—' : `${f.actual} → ${f.nuevoActual}`}</td>
                    <td className="font-mono text-xs">{f.original === null ? '—' : `${f.original} → ${f.nuevoOriginal}`}</td>
                    <td>{f.aplicable
                      ? <span style={{ color: 'var(--success)' }}>Se aplica</span>
                      : <span style={{ color: 'var(--danger)' }}>{f.motivo}</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}
      </Modal>

      {/* Nueva devolucion */}
      <Modal abierto={devAbierto} onClose={() => setDevAbierto(false)} titulo="Nueva devolución a proveedor" ancho="640px"
        footer={
          <>
            <button type="button" className="btn btn-ghost" onClick={() => setDevAbierto(false)}>Cancelar</button>
            <button type="button" className="btn btn-primary" disabled={!devProveedor || devItems.length === 0} onClick={crearDevolucion}>Guardar</button>
          </>
        }
      >
        <BorradorRestaurado visible={prepRestaurado} onLimpiar={limpiarPrep} />
        <div className="grid grid-cols-2 gap-3 mb-3">
          <label className="block">
            <span className="block text-xs uppercase tracking-widest text-muted mb-1">Proveedor</span>
            <SelectBuscador
              valor={devProveedor || null}
              etiquetaValor={provNombres[devProveedor] || ''}
              placeholder="Buscar proveedor..."
              buscar={buscarProveedores}
              onSeleccionar={(it) => elegirProveedor(setDevProveedor, it)}
            />
          </label>
          <label className="block">
            <span className="block text-xs uppercase tracking-widest text-muted mb-1">Motivo</span>
            <input className="input-os" value={devMotivo} onChange={(e) => setDevMotivo(e.target.value)} />
          </label>
        </div>
        <BorradorRestaurado visible={devRestaurado} onLimpiar={limpiarDev} />
        <ItemsEditorBlock items={devItems} onChange={setDevItems} onRemove={(i) => setDevItems(devItems.filter((_, idx) => idx !== i))} columnas={colDevItems} vacio="Agrega items con EAN + cantidad" />
        <div className="flex gap-2 mt-3">
          <button type="button" className="btn btn-ghost text-xs" onClick={() => setDevItems([...devItems, { ean13: '', titulo: '', cantidad: 1, tipoSolicitada: 'AUTO' }])}>+ Item</button>
          <ImportarCsvBlock etiqueta="Importar CSV" onCargar={importarDev} />
          <ImportarDocumentoBlock etiqueta="Importar documento" onCargar={importarDevDoc} />
        </div>
      </Modal>

      {/* Facturar */}
      <Modal abierto={Boolean(facturar)} onClose={() => setFacturar(null)} titulo={facturar ? `Facturar liquidación #${facturar.id}` : ''} ancho="420px"
        footer={
          <>
            <button type="button" className="btn btn-ghost" onClick={() => setFacturar(null)}>Cancelar</button>
            <button type="button" className="btn btn-primary" disabled={!compraId} onClick={confirmarFacturar}>Facturar</button>
          </>
        }
      >
        <label className="block">
          <span className="block text-xs uppercase tracking-widest text-muted mb-1">ID de compra vinculada</span>
          <input className="input-os" type="number" value={compraId} onChange={(e) => setCompraId(e.target.value)} />
        </label>
      </Modal>

      {/* Detalle */}
      <Modal abierto={Boolean(detalle)} onClose={() => setDetalle(null)} titulo={detalle ? `Detalle #${detalle.doc.id}` : ''} ancho="640px">
        {detalle && detalle.tipo === 'liquidacion' && (
          <TablaItemsPaginada
            items={detalle.doc.detalle || []}
            headers={[<th key="tit">Titulo</th>, <th key="ean">EAN</th>, <th key="cant">Cant.</th>, <th key="pr">Precio</th>]}
            fila={(r, i) => (
              <tr key={i}><td>{r.titulo}</td><td className="font-mono text-xs">{r.ean13}</td><td>{r.cantidad}</td><td>{fmt(r.precioUnitario)}</td></tr>
            )}
          />
        )}
        {detalle && detalle.tipo === 'conciliacion' && (
          <TablaItemsPaginada
            items={detalle.doc.detalle || []}
            headers={[<th key="tit">Titulo</th>, <th key="loc">Local</th>, <th key="prov">Proveedor</th>, <th key="acc">Acción</th>]}
            fila={(r, i) => (
              <tr key={i}><td>{r.titulo}</td><td>{r.stockLocal}</td><td>{r.stockProveedor}</td><td>{r.accion}</td></tr>
            )}
          />
        )}
      </Modal>

      {/* Nuevo preparado de devolución (CSV del proveedor × stock de los locales) */}
      <Modal abierto={prepAbierto} onClose={() => setPrepAbierto(false)} titulo="Nuevo preparado de devolución" ancho="900px"
        footer={
          <>
            <button type="button" className="btn btn-ghost" onClick={() => setPrepAbierto(false)}>Cancelar</button>
            <button type="button" className="btn btn-ghost" disabled={!prepFilas.length} onClick={() => previsualizarPrep()}>Ver cruce</button>
            <button type="button" className="btn btn-primary" disabled={!prepProveedor || !prepFilas.length} onClick={emitirPrep}>Emitir preparado</button>
          </>
        }
      >
        <div className="grid grid-cols-2 gap-3 mb-3">
          <label className="block">
            <span className="block text-xs uppercase tracking-widest text-muted mb-1">Proveedor que solicita</span>
            <SelectBuscador
              valor={prepProveedor || null}
              etiquetaValor={provNombres[prepProveedor] || ''}
              placeholder="Buscar proveedor..."
              buscar={buscarProveedores}
              onSeleccionar={(it) => elegirProveedor(setPrepProveedor, it)}
            />
          </label>
          <label className="block">
            <span className="block text-xs uppercase tracking-widest text-muted mb-1">Observaciones</span>
            <input className="input-os" value={prepObs} onChange={(e) => setPrepObs(e.target.value)} />
          </label>
        </div>
        <div className="flex items-center gap-2 mb-3">
          <ImportarCsvBlock etiqueta="Importar CSV del proveedor" onCargar={importarPrep} />
          <span className="text-xs text-muted">El CSV trae código (EAN13/ISBN), título y cantidad. Siempre es consigna: no mueve stock.</span>
        </div>
        {prepCruce ? (
          <>
            <table className="table-os">
              <thead>
                <tr>
                  <th>Solicitado</th><th>EAN</th><th>Título</th>
                  {prepCruce.locales.map((l) => <th key={l.id}>{l.nombre}{l.tipo === 'CENTRAL' ? ' físico' : ''}</th>)}
                </tr>
              </thead>
              <tbody>
                {prepCruce.filas.map((f, i) => (
                  <tr key={i}>
                    <td>{f.cantidadSolicitada}</td>
                    <td className="font-mono text-xs">{f.ean13}</td>
                    <td>
                      {f.encontrado
                        ? f.titulo
                        : <span style={{ color: 'var(--danger)' }}>NO ENCONTRADO{f.tituloProveedor ? ` · ${f.tituloProveedor}` : ''}</span>}
                    </td>
                    {prepCruce.locales.map((l) => {
                      const s = (f.snapshot || []).find((x) => x.depositoId === l.id);
                      return <td key={l.id}>{s ? Number(s.fisico || 0) : '—'}</td>;
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="text-xs text-muted mt-2">
              {prepCruce.renglones} renglones · {prepCruce.unidades} unidades solicitadas · {prepCruce.faltantes} sin encontrar.
              Al emitir se guarda esta foto del stock (el CSV después se descarga igual a como se ve acá).
            </p>
          </>
        ) : (
          <p className="text-sm text-muted">Importá el CSV del proveedor para ver el cruce contra el stock de cada local.</p>
        )}
      </Modal>

      {/* Detalle del preparado (con la foto del stock por local) */}
      <Modal abierto={Boolean(prepDetalle)} onClose={() => setPrepDetalle(null)} titulo={prepDetalle ? `Preparado ${prepDetalle.numero}` : ''} ancho="1020px"
        footer={
          prepDetalle ? (
            <>
              <button type="button" className="btn btn-ghost" onClick={() => descargarPrep(prepDetalle.id)}>CSV general</button>
              {prepDetalle.locales.map((l) => (
                <button key={l.id} type="button" className="btn btn-ghost" onClick={() => descargarPrep(prepDetalle.id, { modo: 'por-local', localId: l.id })}>
                  CSV {l.nombre}
                </button>
              ))}
              {prepDetalle.estado !== 'ANULADO' && (
                <button type="button" className="btn btn-ghost" style={{ color: 'var(--danger)' }} onClick={() => anularPrep(prepDetalle.id)}>Anular</button>
              )}
              <button type="button" className="btn btn-primary" onClick={() => setPrepDetalle(null)}>Cerrar</button>
            </>
          ) : null
        }
      >
        {prepDetalle && (
          <div>
            <div className="flex items-center gap-3 mb-3">
              <span className="agente-badge">{prepDetalle.estado}</span>
              <span className="text-sm">{nombreProv(prepDetalle)}</span>
              <span className="text-sm">{new Date(prepDetalle.fechaEmision).toLocaleDateString('es-AR')}</span>
              <span className="text-xs text-muted">origen {prepDetalle.origen}</span>
            </div>
            {prepDetalle.observaciones && <p className="text-sm mb-3">{prepDetalle.observaciones}</p>}
            <Table columnas={colPrepItems} filas={prepDetalle.items} vacio="Sin renglones" />
            <p className="text-xs text-muted mt-2">
              Foto del stock al momento de emitir: las sucursales muestran el físico; el central, la consigna original,
              la consigna actual y el físico. Cada local puede recibir su propio CSV para separar sin cuentas.
            </p>
          </div>
        )}
      </Modal>
    </div>
  );
}
