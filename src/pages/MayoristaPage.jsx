// BookOS - MayoristaPage.jsx
// ruta: bookos/frontend/src/pages/MayoristaPage.jsx
// descripcion: modulo mayorista (F-12). Patron de 3 bloques (cabecera / tabla / chat del
//   Secretario). Estado: E7 — remitos; E8 — facturación (firme / genérica / baja de consigna / NC);
//   E9 — devoluciones (consigna con tope de sábana / firme con NC) + acuse; E10 — pedidos de
//   devolución (individual, lote por CSV, aprobar/enviar/conciliar/acuse); E11 — sábanas
//   (previsualización valorizada + emisión numerada + envío/reenvío + borrado) y ajustes de
//   consignación (INCREMENTO/DECREMENTO con ledger, motivo obligatorio y anulación). Todos los
//   historiales con Ver/CSV/PDF/Mail/Anular/🧠, paginador server-side y buscador con debounce.

import { useEffect, useRef, useState } from 'react';
import Table from '../ui/Table';
import Modal from '../ui/Modal';
import Paginador from '../ui/Paginador';
import TablaItemsPaginada from '../ui/TablaItemsPaginada';
import SelectBuscador from '../ui/SelectBuscador';
import MayoristaCabeceraBlock from '../blocks/MayoristaCabeceraBlock';
import MayoristaTablaBlock from '../blocks/MayoristaTablaBlock';
import ImportarCsvBlock from '../blocks/ImportarCsvBlock';
import CargarDocumentoBlock from '../blocks/CargarDocumentoBlock';
import { mayoristaApi, depositosApi, observacionesApi, configApi } from '../api/api';
import { buscarMayoristas } from '../utils/selectores';
import { descargarDesdeServidor } from '../utils/exportar';
import { useAppContext } from '../AppContext';
import BotonSecretario from '../ui/BotonSecretario';
import BorradorRestaurado from '../ui/BorradorRestaurado';
// Sesion de trabajo: el borrador de cada sub-forma sobrevive al refresco y al cierre.
import usePersistentWork from '../hooks/usePersistentWork';

const TABS = [
  { id: 'resumen', label: 'Resumen' },
  { id: 'remitos', label: 'Remitos' },
  { id: 'ventas', label: 'Facturación' },
  { id: 'devoluciones', label: 'Devoluciones' },
  { id: 'pedidos', label: 'Pedidos de devolución' },
  { id: 'sabanas', label: 'Sábanas' },
  { id: 'ajustes', label: 'Ajustes' },
];

// Cada solapa dice en qué etapa llega su escritura (lo que ya funciona es el historial).
const ETAPA_ESCRITURA = {};

const CABECERA_VACIA = { cliente: null, depositoOrigenId: '', depositoDestinoId: '', tipoRemito: 'CONSIGNA', observaciones: '' };
const FACTURA_VACIA = { cliente: null, tipoComprobante: 'FACTURA_MAYORISTA_FIRME', clase: 'X', mueveStock: true, depositoOrigenId: '', descuentoGlobal: 0, monto: '', descuentoFijo: null, observaciones: '' };
const DEVOLUCION_VACIA = { cliente: null, tipoComprobante: 'DEVOLUCION_CONSIGNA', depositoId: '', totalValorizado: '', descuentoFijo: null, observaciones: '' };
const PEDIDO_VACIO = { cliente: null, observaciones: '' };
// Historiales con paginador server-side (los demas listados se paginan en su etapa).
const PAGINADOS = ['remitos', 'ventas', 'devoluciones', 'pedidos', 'sabanas', 'ajustes'];
const LIMITE = 20;
// Estados del pedido de devolucion con su etiqueta de pantalla.
const ESTADO_PEDIDO = {
  PENDIENTE: 'Pendiente',
  APROBADO: 'Aprobado',
  ENVIADO: 'Enviado',
  CONCILIADO_PARCIAL: 'Conciliado parcial',
  CONCILIADO_TOTAL: 'Conciliado total',
  ANULADO: 'Anulado',
};

export default function MayoristaPage() {
  const [tab, setTab] = useState('resumen');
  const [resumen, setResumen] = useState(null);
  const [listas, setListas] = useState({ remitos: [], ventas: [], devoluciones: [], pedidos: [], sabanas: [], ajustes: [] });
  const [depositos, setDepositos] = useState([]);
  const [mensaje, setMensaje] = useState('');
  const [observacion, setObservacion] = useState(null);
  const [pags, setPags] = useState({ remitos: 1, ventas: 1, devoluciones: 1, pedidos: 1, sabanas: 1, ajustes: 1 });
  const [busq, setBusq] = useState({ remitos: '', ventas: '', devoluciones: '', pedidos: '', sabanas: '', ajustes: '' });
  const [totales, setTotales] = useState({ remitos: 0, ventas: 0, devoluciones: 0, pedidos: 0, sabanas: 0, ajustes: 0 });
  const timers = useRef({});
  const [verRemito, setVerRemito] = useState(null);
  const [cab, setCab, limpiarCab, restCab] = usePersistentWork('mayorista_remito_cab', CABECERA_VACIA);
  const [consignaHabilitada, setConsignaHabilitada] = useState(true);
  const [items, setItems, limpiarItems, restItems] = usePersistentWork('mayorista_remito_items', []);
  const [fact, setFact, limpiarFact, restFact] = usePersistentWork('mayorista_factura', FACTURA_VACIA);
  const [itemsFact, setItemsFact, limpiarItemsFact, restItemsFact] = usePersistentWork('mayorista_factura_items', []);
  const [sabana, setSabana] = useState(null);
  const [verVenta, setVerVenta] = useState(null);
  const [dev, setDev, limpiarDev, restDev] = usePersistentWork('mayorista_devolucion', DEVOLUCION_VACIA);
  const [itemsDev, setItemsDev, limpiarItemsDev, restItemsDev] = usePersistentWork('mayorista_devolucion_items', []);
  const [sabanaDev, setSabanaDev] = useState(null);
  const [verDev, setVerDev] = useState(null);
  const [ped, setPed, limpiarPed, restPed] = usePersistentWork('mayorista_pedido', PEDIDO_VACIO);
  const [itemsPed, setItemsPed, limpiarItemsPed, restItemsPed] = usePersistentWork('mayorista_pedido_items', []);
  const [sabanaPed, setSabanaPed] = useState(null);
  const [modoPed, setModoPed, limpiarModoPed, restModoPed] = usePersistentWork('mayorista_pedido_modo', 'individual');
  const [fechaLimite, setFechaLimite] = useState('');
  const [lote, setLote] = useState(null);
  const [verPedido, setVerPedido] = useState(null);
  const [conciliando, setConciliando] = useState(null);
  const [sab, setSab, limpiarSab, restSab] = usePersistentWork('mayorista_sabana', { cliente: null, observaciones: '' });
  const [previewSab, setPreviewSab] = useState(null);
  const [verSabana, setVerSabana] = useState(null);
  const [aj, setAj, limpiarAj, restAj] = usePersistentWork('mayorista_ajuste', { cliente: null, tipoAjuste: 'DECREMENTO', depositoOrigenId: '', observaciones: '' });
  const [itemsAj, setItemsAj, limpiarItemsAj, restItemsAj] = usePersistentWork('mayorista_ajuste_items', []);
  const [sabanaAj, setSabanaAj] = useState(null);
  const [verAjuste, setVerAjuste] = useState(null);
  const { setContextoActual, pedirConsulta } = useAppContext();

  const cargarLista = async (t, { page = null, buscar = null } = {}) => {
    try {
      const fn = {
        remitos: mayoristaApi.listarRemitos,
        ventas: mayoristaApi.listarVentas,
        devoluciones: mayoristaApi.listarDevoluciones,
        pedidos: mayoristaApi.listarPedidos,
        sabanas: mayoristaApi.listarSabanas,
        ajustes: mayoristaApi.listarAjustes,
      }[t];
      const esPag = PAGINADOS.includes(t);
      const p = page || (esPag ? pags[t] : 1);
      const b = buscar !== null ? buscar : (esPag ? busq[t] : '');
      const res = esPag
        ? await fn({ page: p, limit: LIMITE, buscar: b || undefined })
        : await fn({ limite: 100 });
      const filas = res.data || [];
      setListas((prev) => ({ ...prev, [t]: filas }));
      if (esPag) {
        setPags((prev) => ({ ...prev, [t]: p }));
        setBusq((prev) => ({ ...prev, [t]: b }));
        setTotales((prev) => ({ ...prev, [t]: res.pagination ? res.pagination.total : filas.length }));
      }
    } catch (e) { /* sin datos todavia */ }
  };

  // Buscador del historial con debounce (el backend pagina y filtra).
  const buscarEn = (t, valor) => {
    setBusq((prev) => ({ ...prev, [t]: valor }));
    clearTimeout(timers.current[t]);
    timers.current[t] = setTimeout(() => cargarLista(t, { page: 1, buscar: valor }), 350);
  };

  const cargar = async () => {
    const [r, d] = await Promise.allSettled([mayoristaApi.resumen(), depositosApi.listar()]);
    if (r.status === 'fulfilled') setResumen(r.value.data || null);
    if (d.status === 'fulfilled') setDepositos(d.value.data || []);
    if (r.status === 'rejected' || d.status === 'rejected') setMensaje('⚠️ El módulo mayorista respondió con errores: revisá el backend');
    // Modalidad consigna del mayorista (toggle usa_consignacion, Sistema ▾ Config): apagada no se
    // emiten remitos CONSIGNA nuevos. El backend lo bloquea igual; aca se evita ofrecer lo que va a
    // fallar y se explica por qué.
    configApi.obtener()
      .then((cfg) => {
        const t = (cfg.data.catalogo || []).find((c) => c.clave === 'usa_consignacion');
        const habilitada = Boolean(t) && !(t.valor === false || t.valor === 'false' || t.valor === '0' || t.valor === '');
        setConsignaHabilitada(habilitada);
        if (!habilitada) setCab((c) => (c.tipoRemito === 'CONSIGNA' ? { ...c, tipoRemito: 'FIRME' } : c));
      })
      .catch(() => {});
    ['remitos', 'ventas', 'devoluciones', 'pedidos', 'sabanas', 'ajustes'].forEach(cargarLista);
  };

  useEffect(() => { cargar(); }, []); // eslint-disable-line

  // Inyecta contexto al Secretario (lo que ve y lo que esta armando).
  useEffect(() => {
    setContextoActual({
      vista: 'mayorista',
      tab,
      borrador: tab === 'remitos' ? { cliente: cab.cliente ? cab.cliente.nombre : null, tipoRemito: cab.tipoRemito, origen: cab.depositoOrigenId, items: items.length, unidades: items.reduce((a, i) => a + Number(i.cantidad || 0), 0) } : undefined,
      borradorFactura: tab === 'ventas' ? { cliente: fact.cliente ? fact.cliente.nombre : null, tipo: fact.tipoComprobante, mueveStock: fact.mueveStock, items: itemsFact.length } : undefined,
      borradorDevolucion: tab === 'devoluciones' ? { cliente: dev.cliente ? dev.cliente.nombre : null, tipo: dev.tipoComprobante, items: itemsDev.length } : undefined,
      borradorPedido: tab === 'pedidos' ? { cliente: ped.cliente ? ped.cliente.nombre : null, modo: modoPed, items: itemsPed.length } : undefined,
      borradorSabana: tab === 'sabanas' ? { cliente: sab.cliente ? sab.cliente.nombre : null, ejemplares: previewSab ? previewSab.totalEjemplares : 0 } : undefined,
      borradorAjuste: tab === 'ajustes' ? { cliente: aj.cliente ? aj.cliente.nombre : null, tipo: aj.tipoAjuste, items: itemsAj.length } : undefined,
    });
  }, [tab, cab, items, fact, itemsFact, dev, itemsDev, ped, itemsPed, modoPed, sab, previewSab, aj, itemsAj]); // eslint-disable-line

  const setCampo = (campo, valor) => setCab((prev) => ({ ...prev, [campo]: valor }));
  const setCampoFact = (campo, valor) => setFact((prev) => ({ ...prev, [campo]: valor }));
  const setCampoDev = (campo, valor) => setDev((prev) => ({ ...prev, [campo]: valor }));
  const setCampoPed = (campo, valor) => setPed((prev) => ({ ...prev, [campo]: valor }));
  const setCampoSab = (campo, valor) => setSab((prev) => ({ ...prev, [campo]: valor }));
  const setCampoAj = (campo, valor) => setAj((prev) => ({ ...prev, [campo]: valor }));

  // ---- Documento por documento (CSV / PDF / Mail / Anular): el mismo flujo para todos los documentos ----
  const docApi = (tipoDoc) => (tipoDoc === 'remito'
    ? { csv: mayoristaApi.csvRemito, pdf: mayoristaApi.pdfRemito, mail: mayoristaApi.mailRemito, anular: mayoristaApi.anularRemito }
    : tipoDoc === 'venta'
      ? { csv: mayoristaApi.csvVenta, pdf: mayoristaApi.pdfVenta, mail: mayoristaApi.mailVenta, anular: mayoristaApi.anularVenta }
      : tipoDoc === 'pedido'
        ? { csv: mayoristaApi.csvPedido, pdf: mayoristaApi.pdfPedido, mail: mayoristaApi.mailPedido, anular: mayoristaApi.anularPedido }
        : tipoDoc === 'sabana'
          ? { csv: mayoristaApi.csvSabana, pdf: mayoristaApi.pdfSabana, mail: mayoristaApi.mailSabana, anular: null }
          : tipoDoc === 'ajuste'
            ? { csv: mayoristaApi.csvAjuste, pdf: mayoristaApi.pdfAjuste, mail: mayoristaApi.mailAjuste, anular: mayoristaApi.anularAjuste }
            : { csv: mayoristaApi.csvDevolucion, pdf: mayoristaApi.pdfDevolucion, mail: mayoristaApi.mailDevolucion, anular: mayoristaApi.anularDevolucion });

  const reimprimir = async (r, formato, tipoDoc = 'remito') => {
    try {
      const res = await docApi(tipoDoc)[formato](r.id);
      const desc = res.data || {};
      await descargarDesdeServidor(`/archivos/${desc.archivoId}/descarga`, desc.nombre);
      setMensaje(`${formato.toUpperCase()} de ${r.numero || r.numeroComprobante} descargado ✓`);
    } catch (e) { setMensaje(`⚠️ ${e.message}`); }
  };

  const enviarMail = async (r, tipoDoc = 'remito') => {
    const numero = r.numero || r.numeroComprobante;
    if (!window.confirm(`¿Enviar ${numero} por mail al cliente? (adjunta PDF + CSV)`)) return;
    try {
      const res = await docApi(tipoDoc).mail(r.id);
      setMensaje(res.data && res.data.enviado ? `${numero} enviado a ${res.data.a}${res.data.redirigido ? ' (MODO PRUEBA)' : ''} ✓` : `El mail no salió: ${(res.data && res.data.motivo) || 'sin detalle'}`);
    } catch (e) { setMensaje(`⚠️ ${e.message}`); }
  };

  const anularDoc = async (r, tipoDoc = 'remito') => {
    const numero = r.numero || r.numeroComprobante;
    if (!window.confirm(`¿Anular ${numero}? Se revierte el stock por el ledger y se contra-asienta la CC si tiene.`)) return;
    try {
      const res = await docApi(tipoDoc).anular(r.id);
      const avisos = (res.data.avisos || []).length ? ` — avisos: ${res.data.avisos.join(' · ')}` : '';
      setMensaje(`${numero} anulado ✓${avisos}`);
      cargarLista(tipoDoc === 'remito' ? 'remitos' : tipoDoc === 'venta' ? 'ventas' : 'devoluciones');
      mayoristaApi.resumen().then((r2) => setResumen(r2.data || null)).catch(() => null);
    } catch (e) { setMensaje(`⚠️ ${e.message}`); }
  };

  // ---- Remitos (E7) ----
  const destinoDelRemito = () => {
    if (cab.tipoRemito === 'TRASLADO_INTERNO') return cab.depositoDestinoId;
    return cab.cliente && cab.cliente.deposito ? cab.cliente.deposito.id : '';
  };

  const crearRemito = async () => {
    const destino = destinoDelRemito();
    if (cab.tipoRemito === 'CONSIGNA' && !consignaHabilitada) {
      setMensaje('⚠️ La modalidad CONSIGNA del mayorista está apagada (Sistema ▾ Config): no se emiten remitos CONSIGNA nuevos. Lo ya consignado se sigue facturando, devolviendo, sabanando y ajustando.');
      return;
    }
    if (cab.tipoRemito !== 'TRASLADO_INTERNO' && !cab.cliente) { setMensaje('⚠️ Elegí el cliente mayorista'); return; }
    if (cab.tipoRemito !== 'TRASLADO_INTERNO' && cab.cliente && !cab.cliente.deposito) { setMensaje('⚠️ Ese cliente no tiene depósito espejo: marcalo como mayorista en su ficha'); return; }
    if (!cab.depositoOrigenId) { setMensaje('⚠️ Elegí el depósito de origen'); return; }
    if (!destino) { setMensaje('⚠️ Falta el destino'); return; }
    if (!items.length) { setMensaje('⚠️ Agregá renglones'); return; }
    try {
      const res = await mayoristaApi.crearRemito({
        depositoOrigenId: Number(cab.depositoOrigenId),
        depositoDestinoId: Number(destino),
        tipoRemito: cab.tipoRemito,
        observaciones: cab.observaciones || null,
        items: items.map((i) => ({ ean13: i.ean13, cantidad: Number(i.cantidad), tipoStock: i.tipoStock || 'CONSIGNA' })),
      });
      const d = res.data || {};
      const avisos = (d.avisos || []).length ? ` — avisos: ${d.avisos.join(' · ')}` : '';
      setMensaje(`Remito ${d.numero} emitido ✓${avisos}`);
      setCab(CABECERA_VACIA);
      setItems([]);
      limpiarCab(); limpiarItems();
      cargarLista('remitos');
      mayoristaApi.resumen().then((r2) => setResumen(r2.data || null)).catch(() => null);
    } catch (e) { setMensaje(`⚠️ ${e.message}`); }
  };

  const verDetalleRemito = async (r) => {
    try {
      const res = await mayoristaApi.obtenerRemito(r.id);
      setVerRemito(res.data);
    } catch (e) { setMensaje(`⚠️ ${e.message}`); }
  };

  // ---- Facturación (E8) ----
  // La sabana del cliente (su deposito espejo) para mostrar el disponible por titulo en la baja de
  // consigna: el operario ve de antemano el tope duro (§4.2.1) y evita el 409.
  const cargarSabana = async (cliente) => {
    if (!cliente || !cliente.deposito) { setSabana(null); return; }
    try {
      const res = await depositosApi.stock(cliente.deposito.id);
      const mapa = {};
      (res.data || []).forEach((f) => { mapa[f.articuloId] = Number(f.consignaActual || 0); });
      setSabana(mapa);
    } catch (e) { setSabana(null); }
  };

  const elegirClienteFact = (c) => {
    setFact((prev) => ({ ...prev, cliente: c || null, descuentoFijo: c && c.descuentoFijo != null ? Number(c.descuentoFijo) : null }));
    if (fact.tipoComprobante === 'FACTURA_BAJA_CONSIGNA') cargarSabana(c);
  };

  const cambiarTipoFact = (tipo) => {
    setFact((prev) => ({ ...prev, tipoComprobante: tipo }));
    if (tipo === 'FACTURA_BAJA_CONSIGNA') cargarSabana(fact.cliente); else setSabana(null);
  };

  const subtotalFact = itemsFact.reduce((a, i) => a + (Number(i.cantidad) || 0) * (Number(i.precioUnitario) || 0) * (1 - (Number(i.descuentoLinea) || 0) / 100), 0);
  const totalFact = Math.max(0, subtotalFact - (Number(fact.descuentoGlobal) || 0));

  const crearVenta = async () => {
    if (!fact.cliente) { setMensaje('⚠️ Elegí el cliente mayorista'); return; }
    const esNC = fact.tipoComprobante === 'NOTA_CREDITO_MAYORISTA';
    const esGenerica = fact.tipoComprobante === 'FACTURA_MAYORISTA_FIRME' && !fact.mueveStock;
    if (esNC && !(Number(fact.monto) > 0)) { setMensaje('⚠️ La nota de crédito necesita un monto'); return; }
    if (esGenerica && !String(fact.observaciones || '').trim()) { setMensaje('⚠️ La factura genérica necesita decir a qué corresponde'); return; }
    if (!esNC && !esGenerica && !itemsFact.length) { setMensaje('⚠️ Agregá renglones'); return; }
    try {
      const payload = {
        clienteId: fact.cliente.id,
        tipoComprobante: fact.tipoComprobante,
        clase: fact.clase || 'X',
        observaciones: fact.observaciones || null,
        ...(esNC || esGenerica
          ? { monto: Number(fact.monto) }
          : {
            items: itemsFact.map((i) => ({ ean13: i.ean13, cantidad: Number(i.cantidad), precioUnitario: Number(i.precioUnitario) || 0, descuentoLinea: i.descuentoLinea })),
            descuentoGlobal: Number(fact.descuentoGlobal) || 0,
          }),
        ...(fact.tipoComprobante === 'FACTURA_MAYORISTA_FIRME'
          ? { mueveStock: fact.mueveStock, depositoOrigenId: fact.mueveStock && fact.depositoOrigenId ? Number(fact.depositoOrigenId) : null }
          : {}),
      };
      const res = await mayoristaApi.crearVenta(payload);
      const d = res.data || {};
      const avisos = (d.avisos || []).length ? ` — avisos: ${d.avisos.join(' · ')}` : '';
      setMensaje(`${d.numeroComprobante} emitido ✓ (total $${Number(d.total).toLocaleString('es-AR')})${avisos}`);
      setFact(FACTURA_VACIA);
      setItemsFact([]);
      limpiarFact(); limpiarItemsFact();
      setSabana(null);
      cargarLista('ventas');
      mayoristaApi.resumen().then((r2) => setResumen(r2.data || null)).catch(() => null);
    } catch (e) { setMensaje(`⚠️ ${e.message}`); }
  };

  const verDetalleVenta = async (v) => {
    try {
      const res = await mayoristaApi.obtenerVenta(v.id);
      setVerVenta(res.data);
    } catch (e) { setMensaje(`⚠️ ${e.message}`); }
  };

  // ---- Devoluciones (E9) ----
  // La sabana del cliente tambien se muestra aca: para la devolucion de consigna es el tope duro
  // (no se puede devolver mas de lo que tiene consignado).
  const cargarSabanaDev = async (cliente) => {
    if (!cliente || !cliente.deposito) { setSabanaDev(null); return; }
    try {
      const res = await depositosApi.stock(cliente.deposito.id);
      const mapa = {};
      (res.data || []).forEach((f) => { mapa[f.articuloId] = Number(f.consignaActual || 0); });
      setSabanaDev(mapa);
    } catch (e) { setSabanaDev(null); }
  };

  const elegirClienteDev = (c) => {
    setDev((prev) => ({ ...prev, cliente: c || null, descuentoFijo: c && c.descuentoFijo != null ? Number(c.descuentoFijo) : null }));
    cargarSabanaDev(c);
  };

  const subtotalDev = itemsDev.reduce((a, i) => a + (Number(i.cantidad) || 0) * (Number(i.precioUnitario) || 0), 0);

  const crearDevolucion = async () => {
    if (!dev.cliente) { setMensaje('⚠️ Elegí el cliente mayorista'); return; }
    if (!dev.depositoId) { setMensaje('⚠️ Elegí el depósito al que vuelven los libros'); return; }
    if (!itemsDev.length) { setMensaje('⚠️ Agregá renglones'); return; }
    try {
      const res = await mayoristaApi.crearDevolucion({
        clienteId: dev.cliente.id,
        tipoComprobante: dev.tipoComprobante,
        depositoId: Number(dev.depositoId),
        items: itemsDev.map((i) => ({ ean13: i.ean13, cantidad: Number(i.cantidad), precioUnitario: Number(i.precioUnitario) || 0 })),
        totalValorizado: dev.tipoComprobante === 'DEVOLUCION_FIRME' && dev.totalValorizado !== '' ? Number(dev.totalValorizado) : null,
        observaciones: dev.observaciones || null,
      });
      const d = res.data || {};
      setMensaje(`${d.numero} registrada ✓ (acuse generado${d.acuse ? ': PDF + CSV' : ''})${d.totalValorizado ? ` · NC de $${Number(d.totalValorizado).toLocaleString('es-AR')} en la CC` : ''}`);
      setDev(DEVOLUCION_VACIA);
      setItemsDev([]);
      limpiarDev(); limpiarItemsDev();
      setSabanaDev(null);
      cargarLista('devoluciones');
      mayoristaApi.resumen().then((r2) => setResumen(r2.data || null)).catch(() => null);
    } catch (e) { setMensaje(`⚠️ ${e.message}`); }
  };

  const verDetalleDev = async (v) => {
    try {
      const res = await mayoristaApi.obtenerDevolucion(v.id);
      setVerDev(res.data);
    } catch (e) { setMensaje(`⚠️ ${e.message}`); }
  };

  // ---- Pedidos de devolucion (E10) ----
  // La sabana del cliente a la vista, igual que en la baja de consigna y la devolucion: el operario
  // arma la solicitud viendo que tiene consignado cada titulo.
  const cargarSabanaPed = async (cliente) => {
    if (!cliente || !cliente.deposito) { setSabanaPed(null); return; }
    try {
      const res = await depositosApi.stock(cliente.deposito.id);
      const mapa = {};
      (res.data || []).forEach((f) => { mapa[f.articuloId] = Number(f.consignaActual || 0); });
      setSabanaPed(mapa);
    } catch (e) { setSabanaPed(null); }
  };

  const elegirClientePed = (c) => {
    setPed((prev) => ({ ...prev, cliente: c || null }));
    cargarSabanaPed(c);
  };

  const crearPedido = async () => {
    if (!ped.cliente) { setMensaje('⚠️ Elegí el cliente mayorista'); return; }
    if (!itemsPed.length) { setMensaje('⚠️ Agregá renglones'); return; }
    try {
      const res = await mayoristaApi.crearPedido({
        clienteId: ped.cliente.id,
        items: itemsPed.map((i) => ({ ean13: i.ean13, cantidad: Number(i.cantidad) })),
        observaciones: ped.observaciones || null,
      });
      setMensaje(`Pedido ${res.data.numero} creado (borrador: aprobalo y se lo envías al cliente) ✓`);
      setPed(PEDIDO_VACIO);
      setItemsPed([]);
      limpiarPed(); limpiarItemsPed(); limpiarModoPed();
      setSabanaPed(null);
      cargarLista('pedidos');
      mayoristaApi.resumen().then((r2) => setResumen(r2.data || null)).catch(() => null);
    } catch (e) { setMensaje(`⚠️ ${e.message}`); }
  };

  // De a lotes: el CSV de codigos viaja al backend, que analiza los espejos con consigna y arma un
  // pedido por cliente (cantidad opcional; sin cantidad se pide todo lo consignado).
  const generarLoteCsv = async (filas) => {
    try {
      const res = await mayoristaApi.generarPedidosCsv({
        filas: filas.map((f) => ({ codigo: String(f.ean13 || f.codigo || ''), cantidad: f.cantidad != null && f.cantidad !== '' ? Number(f.cantidad) : null })),
        fechaLimite: fechaLimite || null,
        observaciones: ped.observaciones || null,
      });
      setLote(res.data || null);
      const n = res.data && res.data.pedidos ? res.data.pedidos.length : 0;
      setMensaje(n ? `${n} pedido(s) generado(s) ✓` : '⚠️ No se generaron pedidos (ver detalle)');
      cargarLista('pedidos');
      mayoristaApi.resumen().then((r2) => setResumen(r2.data || null)).catch(() => null);
    } catch (e) { setMensaje(`⚠️ ${e.message}`); }
  };

  const verDetallePedido = async (p) => {
    try {
      const res = await mayoristaApi.obtenerPedido(p.id);
      setVerPedido(res.data);
    } catch (e) { setMensaje(`⚠️ ${e.message}`); }
  };

  const aprobarPedidoDoc = async (p) => {
    try {
      const res = await mayoristaApi.aprobarPedido(p.id);
      setMensaje(`Pedido ${res.data.numero} aprobado ✓`);
      cargarLista('pedidos');
      if (verPedido && verPedido.id === p.id) verDetallePedido(p);
    } catch (e) { setMensaje(`⚠️ ${e.message}`); }
  };

  const enviarPedidoDoc = async (p) => {
    if (!window.confirm(`¿Enviar el pedido ${p.numero} por mail al cliente? (adjunta PDF + CSV de lo solicitado)`)) return;
    try {
      const res = await mayoristaApi.enviarPedido(p.id);
      const d = res.data || {};
      setMensaje(d.envio && d.envio.enviado ? `Pedido ${p.numero} enviado a ${d.envio.a}${d.envio.redirigido ? ' (MODO PRUEBA)' : ''} ✓` : `El mail no salió: ${(d.envio && d.envio.motivo) || 'sin detalle'}`);
      cargarLista('pedidos');
      if (verPedido && verPedido.id === p.id) verDetallePedido(p);
    } catch (e) { setMensaje(`⚠️ ${e.message}`); }
  };

  const anularPedidoDoc = async (p) => {
    if (!window.confirm(`¿Anular el pedido ${p.numero}? El pedido es una solicitud: no mueve stock ni cuenta corriente.`)) return;
    try {
      const res = await mayoristaApi.anularPedido(p.id);
      setMensaje(`Pedido ${res.data.numero} anulado ✓`);
      cargarLista('pedidos');
      if (verPedido && verPedido.id === p.id) verDetallePedido(p);
    } catch (e) { setMensaje(`⚠️ ${e.message}`); }
  };

  // Conciliar: se eligen las devoluciones recibidas del cliente que todavia no estan vinculadas a un pedido.
  const abrirConciliar = async (p) => {
    try {
      const res = await mayoristaApi.obtenerPedido(p.id);
      const pedido = res.data;
      const devs = await mayoristaApi.listarDevoluciones({ clienteId: pedido.clienteId, limit: 100 });
      const vinculadas = (pedido.devoluciones || []).map((d) => d.id);
      const opciones = (devs.data || []).filter((d) => d.estado !== 'ANULADA' && !vinculadas.includes(d.id) && !d.pedidoDevolucionId);
      setConciliando({ pedido, opciones, devolucionId: opciones.length ? opciones[0].id : '' });
    } catch (e) { setMensaje(`⚠️ ${e.message}`); }
  };

  const confirmarConciliacion = async () => {
    if (!conciliando || !conciliando.devolucionId) return;
    try {
      const res = await mayoristaApi.conciliarPedido(conciliando.pedido.id, { devolucionId: Number(conciliando.devolucionId) });
      const d = res.data || {};
      const avisos = (d.avisos || []).length ? ` — avisos: ${d.avisos.join(' · ')}` : '';
      setMensaje(`Pedido ${d.numero} quedó ${ESTADO_PEDIDO[d.estado] ? ESTADO_PEDIDO[d.estado].toLowerCase() : d.estado} ✓${avisos}`);
      setConciliando(null);
      cargarLista('pedidos');
      if (verPedido && verPedido.id === d.id) setVerPedido(d);
    } catch (e) { setMensaje(`⚠️ ${e.message}`); }
  };

  // ---- Sabanas (E11) ----
  // La vista previa muestra EXACTAMENTE lo que se va a emitir (valorizado con el descuento del
  // cliente): el snapshot sale de la misma logica del backend, la pantalla solo la refleja.
  const elegirClienteSab = async (c) => {
    setSab((prev) => ({ ...prev, cliente: c || null }));
    setPreviewSab(null);
    if (!c) return;
    try {
      const res = await mayoristaApi.previsualizarSabana(c.id);
      setPreviewSab(res.data || null);
    } catch (e) { setMensaje(`⚠️ ${e.message}`); }
  };

  const emitirSabanaDoc = async () => {
    if (!sab.cliente) { setMensaje('⚠️ Elegí el cliente mayorista'); return; }
    try {
      const res = await mayoristaApi.crearSabana({ clienteId: sab.cliente.id, observaciones: sab.observaciones || null });
      const d = res.data || {};
      setMensaje(`Sábana ${d.numero} emitida ✓ (${d.totalEjemplares} ejemplares · $${Number(d.totalValorizado).toLocaleString('es-AR')})`);
      setSab({ cliente: null, observaciones: '' });
      setPreviewSab(null);
      limpiarSab();
      cargarLista('sabanas');
      mayoristaApi.resumen().then((r2) => setResumen(r2.data || null)).catch(() => null);
    } catch (e) { setMensaje(`⚠️ ${e.message}`); }
  };

  const verDetalleSabana = async (s) => {
    try {
      const res = await mayoristaApi.obtenerSabana(s.id);
      setVerSabana(res.data);
    } catch (e) { setMensaje(`⚠️ ${e.message}`); }
  };

  const borrarSabanaDoc = async (s) => {
    if (!window.confirm(`¿Borrar la sábana ${s.numero}? Es la foto valorizada: no toca stock ni cuenta corriente y el registro del envío se pierde.`)) return;
    try {
      const res = await mayoristaApi.borrarSabana(s.id);
      setMensaje(`Sábana ${res.data.numero} borrada ✓`);
      setVerSabana(null);
      cargarLista('sabanas');
      mayoristaApi.resumen().then((r2) => setResumen(r2.data || null)).catch(() => null);
    } catch (e) { setMensaje(`⚠️ ${e.message}`); }
  };

  // ---- Ajustes de consignacion (E11) ----
  // La sabana del cliente a la vista: para DECREMENTO es el tope duro; para INCREMENTO es contexto.
  const cargarSabanaAj = async (cliente) => {
    if (!cliente || !cliente.deposito) { setSabanaAj(null); return; }
    try {
      const res = await depositosApi.stock(cliente.deposito.id);
      const mapa = {};
      (res.data || []).forEach((f) => { mapa[f.articuloId] = Number(f.consignaActual || 0); });
      setSabanaAj(mapa);
    } catch (e) { setSabanaAj(null); }
  };

  const elegirClienteAj = (c) => {
    setAj((prev) => ({ ...prev, cliente: c || null }));
    cargarSabanaAj(c);
  };

  const crearAjusteDoc = async () => {
    if (!aj.cliente) { setMensaje('⚠️ Elegí el cliente mayorista'); return; }
    if (!aj.depositoOrigenId) { setMensaje('⚠️ Elegí el depósito de origen (central o sucursal)'); return; }
    if (!String(aj.observaciones || '').trim()) { setMensaje('⚠️ El ajuste necesita el motivo (observación obligatoria)'); return; }
    if (!itemsAj.length) { setMensaje('⚠️ Agregá renglones'); return; }
    try {
      const res = await mayoristaApi.crearAjuste({
        clienteId: aj.cliente.id,
        tipoAjuste: aj.tipoAjuste,
        depositoOrigenId: Number(aj.depositoOrigenId),
        items: itemsAj.map((i) => ({ ean13: i.ean13, cantidad: Number(i.cantidad) })),
        observaciones: aj.observaciones,
      });
      const d = res.data || {};
      const avisos = (d.avisos || []).length ? ` — avisos: ${d.avisos.join(' · ')}` : '';
      setMensaje(`Ajuste ${d.numero} registrado ✓ (${aj.tipoAjuste === 'INCREMENTO' ? 'sumó a la sábana' : 'restó de la sábana'})${avisos}`);
      setAj({ cliente: null, tipoAjuste: 'DECREMENTO', depositoOrigenId: '', observaciones: '' });
      setItemsAj([]);
      limpiarAj(); limpiarItemsAj();
      setSabanaAj(null);
      cargarLista('ajustes');
      mayoristaApi.resumen().then((r2) => setResumen(r2.data || null)).catch(() => null);
    } catch (e) { setMensaje(`⚠️ ${e.message}`); }
  };

  const verDetalleAjuste = async (a) => {
    try {
      const res = await mayoristaApi.obtenerAjuste(a.id);
      setVerAjuste(res.data);
    } catch (e) { setMensaje(`⚠️ ${e.message}`); }
  };

  const anularAjusteDoc = async (a) => {
    if (!window.confirm(`¿Anular el ajuste ${a.numero}? Se revierte la sábana del cliente y el stock del depósito de origen (por el ledger).`)) return;
    try {
      const res = await mayoristaApi.anularAjuste(a.id);
      const avisos = (res.data.avisos || []).length ? ` — avisos: ${res.data.avisos.join(' · ')}` : '';
      setMensaje(`Ajuste ${res.data.numero} anulado ✓${avisos}`);
      setVerAjuste(null);
      cargarLista('ajustes');
      mayoristaApi.resumen().then((r2) => setResumen(r2.data || null)).catch(() => null);
    } catch (e) { setMensaje(`⚠️ ${e.message}`); }
  };

  const observar = async (tipo, id) => {
    try {
      const res = await observacionesApi.documento({ tipo, id });
      setObservacion(res.data);
    } catch (e) { setMensaje(`⚠️ ${e.message}`); }
  };

  const colRemitos = [
    { clave: 'numero', titulo: 'Nro', render: (r) => <span className="font-mono text-xs">{r.numero}</span> },
    { clave: 'tipoRemito', titulo: 'Tipo' },
    { clave: 'origen', titulo: 'Origen', render: (r) => (r.origen ? r.origen.nombre : '—') },
    { clave: 'destino', titulo: 'Destino', render: (r) => (r.destino ? r.destino.nombre : '—') },
    { clave: 'unidades', titulo: 'Unidades' },
    { clave: 'estado', titulo: 'Estado', render: (r) => <span className="agente-badge">{r.estado}</span> },
    {
      clave: 'acciones',
      titulo: '',
      render: (r) => (
        <div className="flex gap-2">
          <button type="button" className="btn btn-ghost text-xs" onClick={() => verDetalleRemito(r)}>Ver</button>
          <button type="button" className="btn btn-ghost text-xs" onClick={() => reimprimir(r, 'csv', 'remito')}>CSV</button>
          <button type="button" className="btn btn-ghost text-xs" onClick={() => reimprimir(r, 'pdf', 'remito')}>PDF</button>
          <button type="button" className="btn btn-ghost text-xs" onClick={() => enviarMail(r, 'remito')}>Mail</button>
          {r.estado !== 'ANULADO' && <button type="button" className="btn btn-ghost text-xs" style={{ color: 'var(--danger)' }} onClick={() => anularDoc(r, 'remito')}>Anular</button>}
          <button type="button" className="btn btn-ghost text-xs" onClick={() => observar('remito_mayorista', r.id)}>🧠</button>
        </div>
      ),
    },
  ];

  // Facturación (E8): el historial con las mismas acciones por documento + la marca de genérica.
  const colVentas = [
    { clave: 'numeroComprobante', titulo: 'Nro', render: (v) => <span className="font-mono text-xs">{v.numeroComprobante}</span> },
    {
      clave: 'tipoComprobante',
      titulo: 'Tipo',
      render: (v) => (v.tipoComprobante === 'FACTURA_BAJA_CONSIGNA' ? 'Baja de consigna' : v.tipoComprobante === 'NOTA_CREDITO_MAYORISTA' ? 'NC libre' : `Firme${v.mueveStock ? '' : ' (genérica)'}`),
    },
    { clave: 'cliente', titulo: 'Cliente', render: (v) => (v.cliente ? v.cliente.nombre : '—') },
    { clave: 'total', titulo: 'Total', render: (v) => `$${Number(v.total).toLocaleString('es-AR')}` },
    { clave: 'vencimiento', titulo: 'Vence', render: (v) => (v.fechaVencimiento ? new Date(v.fechaVencimiento).toLocaleDateString('es-AR') : '—') },
    { clave: 'estado', titulo: 'Estado', render: (v) => <span className="agente-badge">{v.estado}</span> },
    {
      clave: 'acciones',
      titulo: '',
      render: (v) => (
        <div className="flex gap-2">
          <button type="button" className="btn btn-ghost text-xs" onClick={() => verDetalleVenta(v)}>Ver</button>
          <button type="button" className="btn btn-ghost text-xs" onClick={() => reimprimir(v, 'csv', 'venta')}>CSV</button>
          <button type="button" className="btn btn-ghost text-xs" onClick={() => reimprimir(v, 'pdf', 'venta')}>PDF</button>
          <button type="button" className="btn btn-ghost text-xs" onClick={() => enviarMail(v, 'venta')}>Mail</button>
          {v.estado !== 'ANULADA' && <button type="button" className="btn btn-ghost text-xs" style={{ color: 'var(--danger)' }} onClick={() => anularDoc(v, 'venta')}>Anular</button>}
          <button type="button" className="btn btn-ghost text-xs" onClick={() => observar('venta_mayorista', v.id)}>🧠</button>
        </div>
      ),
    },
  ];

  // Devoluciones (E9): vuelven de la sabana (consigna) o de lo comprado (firme, con NC).
  const colDevoluciones = [
    { clave: 'numero', titulo: 'Nro', render: (d) => <span className="font-mono text-xs">{d.numero}</span> },
    { clave: 'tipoComprobante', titulo: 'Tipo', render: (d) => (d.tipoComprobante === 'DEVOLUCION_CONSIGNA' ? 'Vuelve de consigna' : 'Vuelve de firme') },
    { clave: 'cliente', titulo: 'Cliente', render: (d) => (d.cliente ? d.cliente.nombre : '—') },
    { clave: 'deposito', titulo: 'Vuelven a', render: (d) => (d.deposito ? d.deposito.nombre : '—') },
    { clave: 'unidades', titulo: 'Unidades', render: (d) => d.totalUnidades },
    { clave: 'totalValorizado', titulo: 'Valorizado', render: (d) => (Number(d.totalValorizado) ? `$${Number(d.totalValorizado).toLocaleString('es-AR')}` : '—') },
    { clave: 'estado', titulo: 'Estado', render: (d) => <span className="agente-badge">{d.estado}</span> },
    {
      clave: 'acciones',
      titulo: '',
      render: (d) => (
        <div className="flex gap-2">
          <button type="button" className="btn btn-ghost text-xs" onClick={() => verDetalleDev(d)}>Ver</button>
          <button type="button" className="btn btn-ghost text-xs" onClick={() => reimprimir(d, 'csv', 'devolucion')}>CSV</button>
          <button type="button" className="btn btn-ghost text-xs" onClick={() => reimprimir(d, 'pdf', 'devolucion')}>Acuse PDF</button>
          <button type="button" className="btn btn-ghost text-xs" onClick={() => enviarMail(d, 'devolucion')}>Mail</button>
          {d.estado !== 'ANULADA' && <button type="button" className="btn btn-ghost text-xs" style={{ color: 'var(--danger)' }} onClick={() => anularDoc(d, 'devolucion')}>Anular</button>}
          <button type="button" className="btn btn-ghost text-xs" onClick={() => observar('devolucion_mayorista', d.id)}>🧠</button>
        </div>
      ),
    },
  ];

  // Pedidos de devolucion (E10): acciones segun estado. El pedido no mueve stock ni CC: por eso
  // pasar a ENVIADO es el "Enviar" (mail al cliente) y el acuse recien aparece al conciliar.
  const colPedidos = [
    { clave: 'numero', titulo: 'Nro', render: (p) => <span className="font-mono text-xs">{p.numero}</span> },
    { clave: 'cliente', titulo: 'Cliente', render: (p) => (p.cliente ? p.cliente.nombre : '—') },
    { clave: 'estado', titulo: 'Estado', render: (p) => <span className="agente-badge">{ESTADO_PEDIDO[p.estado] || p.estado}</span> },
    { clave: 'cruce', titulo: 'Solicitado / Recibido', render: (p) => `${p.totalSolicitadas} / ${p.totalConciliadas}${p.conciliado && p.totalDiferencia !== 0 ? ` (${p.totalDiferencia > 0 ? '+' : ''}${p.totalDiferencia})` : ''}` },
    {
      clave: 'acciones',
      titulo: '',
      render: (p) => (
        <div className="flex gap-2">
          <button type="button" className="btn btn-ghost text-xs" onClick={() => verDetallePedido(p)}>Ver</button>
          {p.estado === 'PENDIENTE' && <button type="button" className="btn btn-ghost text-xs" onClick={() => aprobarPedidoDoc(p)}>Aprobar</button>}
          {p.estado === 'APROBADO' && <button type="button" className="btn btn-ghost text-xs" onClick={() => enviarPedidoDoc(p)}>Enviar</button>}
          {['ENVIADO', 'CONCILIADO_PARCIAL'].includes(p.estado) && <button type="button" className="btn btn-ghost text-xs" onClick={() => abrirConciliar(p)}>Conciliar</button>}
          <button type="button" className="btn btn-ghost text-xs" onClick={() => reimprimir(p, 'csv', 'pedido')}>CSV</button>
          <button type="button" className="btn btn-ghost text-xs" onClick={() => reimprimir(p, 'pdf', 'pedido')}>PDF</button>
          <button type="button" className="btn btn-ghost text-xs" onClick={() => enviarMail(p, 'pedido')}>Mail</button>
          {['PENDIENTE', 'APROBADO', 'ENVIADO'].includes(p.estado) && <button type="button" className="btn btn-ghost text-xs" style={{ color: 'var(--danger)' }} onClick={() => anularPedidoDoc(p)}>Anular</button>}
          <button type="button" className="btn btn-ghost text-xs" onClick={() => observar('pedido_devolucion', p.id)}>🧠</button>
        </div>
      ),
    },
  ];

  // Sabanas (E11): emision + envio/reenvio + borrado. El valorizado sale del snapshot (descuento
  // del cliente al emitir).
  const colSabanas = [
    { clave: 'numero', titulo: 'Nro', render: (s) => <span className="font-mono text-xs">{s.numero}</span> },
    { clave: 'cliente', titulo: 'Cliente', render: (s) => (s.cliente ? s.cliente.nombre : '—') },
    { clave: 'fecha', titulo: 'Fecha', render: (s) => new Date(s.fecha).toLocaleDateString('es-AR') },
    { clave: 'totalEjemplares', titulo: 'Ejemplares' },
    { clave: 'totalValorizado', titulo: 'Valorizado', render: (s) => `$${Number(s.totalValorizado).toLocaleString('es-AR')}` },
    { clave: 'enviadoA', titulo: 'Enviada', render: (s) => (s.enviadoA ? <span className="agente-badge">{s.enviadoA}</span> : '—') },
    {
      clave: 'acciones',
      titulo: '',
      render: (s) => (
        <div className="flex gap-2">
          <button type="button" className="btn btn-ghost text-xs" onClick={() => verDetalleSabana(s)}>Ver</button>
          <button type="button" className="btn btn-ghost text-xs" onClick={() => reimprimir(s, 'csv', 'sabana')}>CSV</button>
          <button type="button" className="btn btn-ghost text-xs" onClick={() => reimprimir(s, 'pdf', 'sabana')}>PDF</button>
          <button type="button" className="btn btn-ghost text-xs" onClick={() => enviarMail(s, 'sabana')}>{s.enviadoA ? 'Reenviar' : 'Mail'}</button>
          <button type="button" className="btn btn-ghost text-xs" style={{ color: 'var(--danger)' }} onClick={() => borrarSabanaDoc(s)}>Borrar</button>
          <button type="button" className="btn btn-ghost text-xs" onClick={() => observar('sabana', s.id)}>🧠</button>
        </div>
      ),
    },
  ];

  // Ajustes de consignacion (E11): INCREMENTO suma a la sabana (baja nuestro firme del origen),
  // DECREMENTO resta (con el tope de la sabana) y devuelve a nuestro stock; reversible.
  const colAjustes = [
    { clave: 'numero', titulo: 'Nro', render: (a) => <span className="font-mono text-xs">{a.numero}</span> },
    { clave: 'tipoAjuste', titulo: 'Tipo', render: (a) => (a.tipoAjuste === 'INCREMENTO' ? 'Incremento (+ sábana)' : 'Decremento (− sábana)') },
    { clave: 'cliente', titulo: 'Cliente', render: (a) => (a.cliente ? a.cliente.nombre : '—') },
    { clave: 'deposito', titulo: 'Origen', render: (a) => (a.deposito ? a.deposito.nombre : '—') },
    { clave: 'unidades', titulo: 'Unidades' },
    { clave: 'estado', titulo: 'Estado', render: (a) => <span className="agente-badge">{a.estado}</span> },
    {
      clave: 'acciones',
      titulo: '',
      render: (a) => (
        <div className="flex gap-2">
          <button type="button" className="btn btn-ghost text-xs" onClick={() => verDetalleAjuste(a)}>Ver</button>
          <button type="button" className="btn btn-ghost text-xs" onClick={() => reimprimir(a, 'csv', 'ajuste')}>CSV</button>
          <button type="button" className="btn btn-ghost text-xs" onClick={() => reimprimir(a, 'pdf', 'ajuste')}>PDF</button>
          <button type="button" className="btn btn-ghost text-xs" onClick={() => enviarMail(a, 'ajuste')}>Mail</button>
          {a.estado !== 'ANULADO' && <button type="button" className="btn btn-ghost text-xs" style={{ color: 'var(--danger)' }} onClick={() => anularAjusteDoc(a)}>Anular</button>}
          <button type="button" className="btn btn-ghost text-xs" onClick={() => observar('ajuste_consignacion', a.id)}>🧠</button>
        </div>
      ),
    },
  ];

  // Indicador del borrador de la pestana ACTIVA: cada sub-forma tiene el suyo, y el gesto limpiar
  // borra solo el de la pestana en la que estas.
  const borradorActivo = {
    remitos: { visto: restCab || restItems, limpiar: () => { limpiarCab(); limpiarItems(); } },
    ventas: { visto: restFact || restItemsFact, limpiar: () => { limpiarFact(); limpiarItemsFact(); } },
    devoluciones: { visto: restDev || restItemsDev, limpiar: () => { limpiarDev(); limpiarItemsDev(); } },
    pedidos: { visto: restPed || restItemsPed || restModoPed, limpiar: () => { limpiarPed(); limpiarItemsPed(); limpiarModoPed(); } },
    sabanas: { visto: restSab, limpiar: limpiarSab },
    ajustes: { visto: restAj || restItemsAj, limpiar: () => { limpiarAj(); limpiarItemsAj(); } },
  }[tab];

  return (
    <div>
      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <div>
          <h2 className="text-xl">Mayorista</h2>
          <p className="text-xs text-muted">depósito espejo por cliente (su sábana) · remitos · facturación · devoluciones</p>
        </div>
        <div className="flex-1" />
        <div className="flex gap-1 flex-wrap">
          {TABS.map((t) => (
            <button key={t.id} type="button" className={`btn ${tab === t.id ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setTab(t.id)}>{t.label}</button>
          ))}
        </div>
        <BotonSecretario
          className="btn btn-ghost text-xs"
          consulta={`Estoy en el módulo mayorista (${tab}). ¿Que me sugeris?`}
        />
      </div>

      {mensaje && <p className="text-sm mb-3">{mensaje}</p>}

      {borradorActivo && borradorActivo.visto && <BorradorRestaurado visible onLimpiar={borradorActivo.limpiar} />}

      {observacion && (
        <div className="card p-3 mb-4" style={{ borderLeft: '3px solid var(--accent)' }}>
          <div className="text-xs uppercase tracking-widest text-muted mb-1">Observación del Secretario</div>
          <p className="text-sm">{observacion.observacion}</p>
        </div>
      )}

      {tab === 'resumen' && resumen && (
        <div className="form-grid">
          <div className="card p-3">
            <div className="text-xs uppercase tracking-widest text-muted mb-1">Clientes mayoristas</div>
            <p className="text-2xl">{resumen.clientesMayoristas}</p>
            <p className="text-xs text-muted">
              con sábana en {resumen.depositosEspejo.conConsigna} de {resumen.depositosEspejo.activos} espejos activos · {resumen.depositosEspejo.unidadesConsigna} unidades en consigna
            </p>
          </div>
          <div className="card p-3">
            <div className="text-xs uppercase tracking-widest text-muted mb-1">Documentos</div>
            <p className="text-sm">Remitos: <strong>{resumen.documentos.remitos}</strong> · Facturas: <strong>{resumen.documentos.ventas}</strong> · Devoluciones: <strong>{resumen.documentos.devoluciones}</strong></p>
            <p className="text-sm">Pedidos: <strong>{resumen.documentos.pedidosDevolucion}</strong> · Sábanas: <strong>{resumen.documentos.sabanas}</strong> · Ajustes: <strong>{resumen.documentos.ajustesConsignacion}</strong></p>
          </div>
        </div>
      )}
      {tab === 'resumen' && !resumen && <p className="text-sm text-muted">Sin datos del módulo todavía.</p>}

      {tab === 'remitos' && (
        <>
          <div className="card p-3 mb-4">
            <h3 className="text-sm uppercase tracking-widest text-muted mb-2">Nuevo remito</h3>
            <MayoristaCabeceraBlock valor={cab} onCambio={setCampo} depositos={depositos} consignaHabilitada={consignaHabilitada} />
            <div className="mt-3">
              <MayoristaTablaBlock items={items} onItems={setItems} />
            </div>
            <div className="flex justify-end mt-3">
              <button type="button" className="btn btn-primary" onClick={crearRemito} disabled={!items.length}>Emitir remito</button>
            </div>
          </div>
          <Table columnas={colRemitos} filas={listas.remitos} vacio="Sin remitos mayoristas" exportable exportarNombre="remitos_mayorista" />
          <div className="flex items-center gap-2 mt-2">
            <input className="input-os" style={{ maxWidth: 260 }} placeholder="Buscar por número o cliente..." value={busq.remitos} onChange={(e) => buscarEn('remitos', e.target.value)} />
          </div>
          <Paginador page={pags.remitos} total={totales.remitos} limite={LIMITE} onCambiar={(p) => cargarLista('remitos', { page: p })} etiqueta="remitos" />
        </>
      )}

      {tab === 'ventas' && (
        <>
          <div className="card p-3 mb-4">
            <h3 className="text-sm uppercase tracking-widest text-muted mb-2">Emitir comprobante</h3>
            <div className="flex gap-3 flex-wrap mb-3 items-end">
              <div style={{ minWidth: 240 }}>
                <span className="field-label">Cliente mayorista</span>
                <SelectBuscador
                  valor={fact.cliente ? fact.cliente.id : null}
                  etiquetaValor={fact.cliente ? fact.cliente.nombre : ''}
                  placeholder="Buscar cliente mayorista..."
                  buscar={buscarMayoristas}
                  onSeleccionar={elegirClienteFact}
                />
              </div>
              <div>
                <span className="field-label">Comprobante</span>
                <select className="input-os" style={{ maxWidth: 250 }} value={fact.tipoComprobante} onChange={(e) => cambiarTipoFact(e.target.value)}>
                  <option value="FACTURA_MAYORISTA_FIRME">Factura FIRME</option>
                  <option value="FACTURA_BAJA_CONSIGNA">Factura baja de consigna (rendición)</option>
                  <option value="NOTA_CREDITO_MAYORISTA">Nota de crédito (libre)</option>
                </select>
              </div>
              <div>
                <span className="field-label">Clase fiscal</span>
                <select
                  className="input-os"
                  style={{ maxWidth: 230 }}
                  value={fact.clase}
                  onChange={(e) => setCampoFact('clase', e.target.value)}
                  title="A/B/C se autorizan contra el MOCK de AFIP (CAE ficticio); si el mock falla o está apagado, el número cae al X correlativo interno."
                >
                  <option value="X">X · numeración interna</option>
                  <option value="A">A · mock AFIP</option>
                  <option value="B">B · mock AFIP</option>
                  <option value="C">C · mock AFIP</option>
                </select>
              </div>
              {(fact.tipoComprobante === 'NOTA_CREDITO_MAYORISTA' || (fact.tipoComprobante === 'FACTURA_MAYORISTA_FIRME' && !fact.mueveStock)) && (
                <label className="flex items-center gap-1 text-xs text-muted">
                  Monto $
                  <input className="input-os" type="number" min="0" style={{ maxWidth: 120 }} value={fact.monto} onChange={(e) => setCampoFact('monto', e.target.value)} />
                </label>
              )}
              {fact.tipoComprobante === 'FACTURA_MAYORISTA_FIRME' && (
                <>
                  <label className="flex items-center gap-1 text-xs text-muted" title="Sin marcar = factura genérica: solo asienta la cuenta corriente (la mercadería ya se movió con un remito en firme).">
                    <input type="checkbox" checked={fact.mueveStock} onChange={(e) => setCampoFact('mueveStock', e.target.checked)} />
                    Mueve stock {fact.mueveStock ? '' : '· genérica (solo CC)'}
                  </label>
                  {fact.mueveStock && (
                    <label className="flex items-center gap-1 text-xs text-muted">
                      Sale de (opcional)
                      <select className="input-os" style={{ maxWidth: 190 }} value={fact.depositoOrigenId} onChange={(e) => setCampoFact('depositoOrigenId', e.target.value)}>
                        <option value="">— solo stock global —</option>
                        {depositos.filter((d) => !d.clienteId && d.activo).map((d) => <option key={d.id} value={d.id}>{d.nombre}</option>)}
                      </select>
                    </label>
                  )}
                </>
              )}
              {fact.tipoComprobante !== 'NOTA_CREDITO_MAYORISTA' && !(fact.tipoComprobante === 'FACTURA_MAYORISTA_FIRME' && !fact.mueveStock) && (
                <label className="flex items-center gap-1 text-xs text-muted">
                  Ajuste / desc. global $
                  <input className="input-os" type="number" min="0" style={{ maxWidth: 110 }} value={fact.descuentoGlobal} onChange={(e) => setCampoFact('descuentoGlobal', Number(e.target.value) || 0)} />
                </label>
              )}
            </div>
            {fact.tipoComprobante === 'FACTURA_MAYORISTA_FIRME' && !fact.mueveStock ? (
              <div className="mb-3">
                <span className="field-label">A qué corresponde (obligatorio)</span>
                <input
                  className="input-os"
                  placeholder="Ej.: factura de la mercadería ya remitida con el remito R-0000020"
                  value={fact.observaciones}
                  onChange={(e) => setCampoFact('observaciones', e.target.value)}
                />
              </div>
            ) : (
              <input className="input-os mb-3" placeholder="Observaciones (opcional)" value={fact.observaciones} onChange={(e) => setCampoFact('observaciones', e.target.value)} />
            )}
            {fact.tipoComprobante !== 'NOTA_CREDITO_MAYORISTA' && !(fact.tipoComprobante === 'FACTURA_MAYORISTA_FIRME' && !fact.mueveStock) && (
              <MayoristaTablaBlock
                items={itemsFact}
                onItems={setItemsFact}
                conTipoStock={false}
                conPrecio
                descuentoDefault={fact.descuentoFijo}
                sabana={fact.tipoComprobante === 'FACTURA_BAJA_CONSIGNA' ? sabana : null}
              />
            )}
            <div className="flex justify-between items-center mt-3 flex-wrap gap-2">
              <p className="text-xs text-muted">
                {fact.tipoComprobante === 'FACTURA_BAJA_CONSIGNA'
                  ? 'La columna Sábana es lo que el cliente tiene consignado: no se puede facturar más (regla dura).'
                  : fact.tipoComprobante === 'FACTURA_MAYORISTA_FIRME'
                    ? (fact.mueveStock ? 'Mueve el stock físico (firme primero, resto consigna): igual que un remito en firme, pero asienta la CC.' : 'Genérica: no mueve stock, solo la cuenta corriente (para lo ya movido con un remito en firme).')
                    : 'La NC acredita la cuenta corriente del cliente.'}
              </p>
              {fact.tipoComprobante !== 'NOTA_CREDITO_MAYORISTA' && !(fact.tipoComprobante === 'FACTURA_MAYORISTA_FIRME' && !fact.mueveStock) && (
                <p className="text-sm">Subtotal: <strong>${subtotalFact.toLocaleString('es-AR')}</strong> · Total: <strong>${totalFact.toLocaleString('es-AR')}</strong></p>
              )}
            </div>
            <div className="flex justify-end mt-3">
              <button
                type="button"
                className="btn btn-primary"
                onClick={crearVenta}
                disabled={!fact.cliente
                  || ((fact.tipoComprobante === 'NOTA_CREDITO_MAYORISTA' || (fact.tipoComprobante === 'FACTURA_MAYORISTA_FIRME' && !fact.mueveStock)) ? !(Number(fact.monto) > 0) : !itemsFact.length)
                  || (fact.tipoComprobante === 'FACTURA_MAYORISTA_FIRME' && !fact.mueveStock && !String(fact.observaciones || '').trim())}
              >
                Emitir comprobante
              </button>
            </div>
          </div>
          <Table columnas={colVentas} filas={listas.ventas} vacio="Sin comprobantes mayoristas" exportable exportarNombre="ventas_mayorista" />
          <div className="flex items-center gap-2 mt-2">
            <input className="input-os" style={{ maxWidth: 260 }} placeholder="Buscar por número o cliente..." value={busq.ventas} onChange={(e) => buscarEn('ventas', e.target.value)} />
          </div>
          <Paginador page={pags.ventas} total={totales.ventas} limite={LIMITE} onCambiar={(p) => cargarLista('ventas', { page: p })} etiqueta="comprobantes" />
        </>
      )}

      {tab === 'devoluciones' && (
        <>
          <div className="card p-3 mb-4">
            <h3 className="text-sm uppercase tracking-widest text-muted mb-2">Registrar devolución</h3>
            <div className="flex gap-3 flex-wrap mb-3 items-end">
              <div style={{ minWidth: 240 }}>
                <span className="field-label">Cliente mayorista</span>
                <SelectBuscador
                  valor={dev.cliente ? dev.cliente.id : null}
                  etiquetaValor={dev.cliente ? dev.cliente.nombre : ''}
                  placeholder="Buscar cliente mayorista..."
                  buscar={buscarMayoristas}
                  onSeleccionar={elegirClienteDev}
                />
              </div>
              <div>
                <span className="field-label">Devolución</span>
                <select className="input-os" style={{ maxWidth: 280 }} value={dev.tipoComprobante} onChange={(e) => setCampoDev('tipoComprobante', e.target.value)}>
                  <option value="DEVOLUCION_CONSIGNA">Vuelve de consigna (logística, sin CC)</option>
                  <option value="DEVOLUCION_FIRME">Vuelve de firme (NC: achica el saldo)</option>
                </select>
              </div>
              <label className="flex items-center gap-1 text-xs text-muted">
                Vuelven a
                <select className="input-os" style={{ maxWidth: 190 }} value={dev.depositoId} onChange={(e) => setCampoDev('depositoId', e.target.value)}>
                  <option value="">— Elegir —</option>
                  {depositos.filter((d) => !d.clienteId && d.activo).map((d) => <option key={d.id} value={d.id}>{d.nombre}</option>)}
                </select>
              </label>
              {dev.tipoComprobante === 'DEVOLUCION_FIRME' && (
                <label className="flex items-center gap-1 text-xs text-muted" title="Importe de la NC que acredita la cuenta corriente. Si lo dejás vacío se sugiere la suma de los renglones.">
                  NC / valorizado $
                  <input className="input-os" type="number" min="0" style={{ maxWidth: 120 }} placeholder={subtotalDev ? subtotalDev.toLocaleString('es-AR') : '0'} value={dev.totalValorizado} onChange={(e) => setCampoDev('totalValorizado', e.target.value)} />
                </label>
              )}
            </div>
            <input className="input-os mb-3" placeholder="Observaciones (opcional: a qué corresponden los libros que vuelven)" value={dev.observaciones} onChange={(e) => setCampoDev('observaciones', e.target.value)} />
            <MayoristaTablaBlock
              items={itemsDev}
              onItems={setItemsDev}
              conTipoStock={false}
              conPrecio
              sabana={dev.tipoComprobante === 'DEVOLUCION_CONSIGNA' ? sabanaDev : null}
            />
            <div className="flex justify-between items-center mt-3 flex-wrap gap-2">
              <p className="text-xs text-muted">
                {dev.tipoComprobante === 'DEVOLUCION_CONSIGNA'
                  ? 'Vuelven libros de la sábana del cliente (la columna Sábana es el tope: no se puede devolver más de lo consignado). No mueve la cuenta corriente.'
                  : 'Vuelven libros que el cliente ya compró (no los vendió): entran como firmes y el valorizado genera la NC que achica su saldo.'}
                {' '}Al registrar se genera el <strong>acuse</strong> (PDF + CSV) para informar al cliente lo recibido y conciliar diferencias.
              </p>
              <button type="button" className="btn btn-primary" onClick={crearDevolucion} disabled={!dev.cliente || !dev.depositoId || !itemsDev.length}>
                Registrar devolución
              </button>
            </div>
          </div>
          <Table columnas={colDevoluciones} filas={listas.devoluciones} vacio="Sin devoluciones mayoristas" exportable exportarNombre="devoluciones_mayorista" />
          <div className="flex items-center gap-2 mt-2">
            <input className="input-os" style={{ maxWidth: 260 }} placeholder="Buscar por número o cliente..." value={busq.devoluciones} onChange={(e) => buscarEn('devoluciones', e.target.value)} />
          </div>
          <Paginador page={pags.devoluciones} total={totales.devoluciones} limite={LIMITE} onCambiar={(p) => cargarLista('devoluciones', { page: p })} etiqueta="devoluciones" />
        </>
      )}

      {tab === 'pedidos' && (
        <>
          <div className="card p-3 mb-4">
            <div className="flex items-center gap-2 flex-wrap mb-3">
              <h3 className="text-sm uppercase tracking-widest text-muted">Pedido de devolución</h3>
              <div className="flex-1" />
              <button type="button" className={`btn ${modoPed === 'individual' ? 'btn-primary' : 'btn-ghost'} text-xs`} onClick={() => setModoPed('individual')}>Individual</button>
              <button type="button" className={`btn ${modoPed === 'lote' ? 'btn-primary' : 'btn-ghost'} text-xs`} onClick={() => setModoPed('lote')}>Lote por CSV de códigos</button>
            </div>
            {modoPed === 'individual' ? (
              <>
                <div className="flex gap-3 flex-wrap mb-3 items-end">
                  <div style={{ minWidth: 240 }}>
                    <span className="field-label">Cliente mayorista</span>
                    <SelectBuscador
                      valor={ped.cliente ? ped.cliente.id : null}
                      etiquetaValor={ped.cliente ? ped.cliente.nombre : ''}
                      placeholder="Buscar cliente mayorista..."
                      buscar={buscarMayoristas}
                      onSeleccionar={elegirClientePed}
                    />
                  </div>
                  <div>
                    <span className="field-label">Importar renglones de un documento (opcional)</span>
                    <CargarDocumentoBlock
                      etiqueta="Importar documento"
                      onCargar={(filas) => setItemsPed((prev) => [...prev, ...filas.map((f) => ({ articuloId: f.articuloId || null, ean13: f.ean13 || f.codigo || f.barras || '', titulo: f.titulo || '', cantidad: Number(f.cantidad) || 1 }))])}
                    />
                  </div>
                </div>
                <input className="input-os mb-3" placeholder="Observaciones (opcional: a qué responde el pedido)" value={ped.observaciones} onChange={(e) => setCampoPed('observaciones', e.target.value)} />
                <MayoristaTablaBlock
                  items={itemsPed}
                  onItems={setItemsPed}
                  conTipoStock={false}
                  sabana={sabanaPed}
                  etiquetaVacio="Agregá los títulos que querés pedirle de vuelta al cliente (buscador o CSV código;cantidad)"
                />
                <div className="flex justify-between items-center mt-3 flex-wrap gap-2">
                  <p className="text-xs text-muted">
                    El pedido es una <strong>solicitud</strong>: no mueve stock ni cuenta corriente. La columna Sábana muestra lo
                    que el cliente tiene consignado. Después se aprueba y se envía por mail; cuando llega la devolución se concilia
                    y el acuse muestra el cruce solicitado vs recibido.
                  </p>
                  <button type="button" className="btn btn-primary" onClick={crearPedido} disabled={!ped.cliente || !itemsPed.length}>
                    Crear pedido (borrador)
                  </button>
                </div>
              </>
            ) : (
              <>
                <div className="flex gap-3 flex-wrap mb-3 items-end">
                  <label className="flex items-center gap-1 text-xs text-muted" title="Opcional: pedir solo los títulos cuyo último movimiento en la sábana sea anterior a esta fecha (pedido por antigüedad).">
                    Solo movimientos hasta
                    <input className="input-os" type="date" value={fechaLimite} onChange={(e) => setFechaLimite(e.target.value)} />
                  </label>
                  <div className="flex-1" style={{ minWidth: 240 }}>
                    <span className="field-label">Observaciones (opcional)</span>
                    <input className="input-os" value={ped.observaciones} onChange={(e) => setCampoPed('observaciones', e.target.value)} />
                  </div>
                </div>
                <ImportarCsvBlock etiqueta="Generar pedidos por CSV de códigos" onCargar={generarLoteCsv} />
                <div className="flex justify-between items-center mt-2 flex-wrap gap-2">
                  <p className="text-xs text-muted">
                    El CSV lleva códigos (EAN/código; la cantidad es opcional: sin cantidad se pide <strong>todo</strong> lo
                    consignado). Se arma <strong>un pedido por cliente</strong> con los títulos que tenga en su sábana.
                  </p>
                  <p className="text-xs text-muted">CSV: código;cantidad</p>
                </div>
                {lote && (
                  <div className="card p-2 mt-2" style={{ borderLeft: '3px solid var(--accent)' }}>
                    <p className="text-sm">Pedidos generados: <strong>{lote.pedidos.length}</strong>{lote.pedidos.length ? ` (${lote.pedidos.map((p) => p.numero).join(', ')})` : ''}</p>
                    {lote.avisos.length > 0 && <p className="text-xs text-muted">Avisos: {lote.avisos.join(' · ')}</p>}
                    {lote.noEncontrados.length > 0 && <p className="text-xs text-muted">No encontrados: {lote.noEncontrados.join(', ')}</p>}
                    {lote.sinConsigna.length > 0 && <p className="text-xs text-muted">Sin consigna en ninguna sábana: {lote.sinConsigna.join(', ')}</p>}
                  </div>
                )}
              </>
            )}
          </div>
          <Table columnas={colPedidos} filas={listas.pedidos} vacio="Sin pedidos de devolución" exportable exportarNombre="pedidos_devolucion" />
          <div className="flex items-center gap-2 mt-2">
            <input className="input-os" style={{ maxWidth: 260 }} placeholder="Buscar por número o cliente..." value={busq.pedidos} onChange={(e) => buscarEn('pedidos', e.target.value)} />
          </div>
          <Paginador page={pags.pedidos} total={totales.pedidos} limite={LIMITE} onCambiar={(p) => cargarLista('pedidos', { page: p })} etiqueta="pedidos" />
        </>
      )}

      {tab === 'sabanas' && (
        <>
          <div className="card p-3 mb-4">
            <h3 className="text-sm uppercase tracking-widest text-muted mb-2">Emitir sábana</h3>
            <div className="flex gap-3 flex-wrap mb-3 items-end">
              <div style={{ minWidth: 240 }}>
                <span className="field-label">Cliente mayorista</span>
                <SelectBuscador
                  valor={sab.cliente ? sab.cliente.id : null}
                  etiquetaValor={sab.cliente ? sab.cliente.nombre : ''}
                  placeholder="Buscar cliente mayorista..."
                  buscar={buscarMayoristas}
                  onSeleccionar={elegirClienteSab}
                />
              </div>
              <div className="flex-1" style={{ minWidth: 240 }}>
                <span className="field-label">Observaciones (opcional)</span>
                <input className="input-os" value={sab.observaciones} onChange={(e) => setCampoSab('observaciones', e.target.value)} />
              </div>
            </div>
            {previewSab && (
              <>
                <p className="text-xs text-muted mb-1">
                  Vista previa: lo consignado por el cliente, valorizado con su descuento del {previewSab.descuento}%
                </p>
                <TablaItemsPaginada
                  items={previewSab.items}
                  headers={[<th key="ean">EAN</th>, <th key="tit">Título</th>, <th key="cant">Consigna</th>, <th key="pl">Precio lista</th>, <th key="net">Neto</th>, <th key="sub">Subtotal</th>]}
                  fila={(i, idx) => (
                    <tr key={idx}>
                      <td className="font-mono text-xs">{i.codigoBarras || '—'}</td>
                      <td>{i.titulo}</td>
                      <td>{i.stockConsigna}</td>
                      <td>${i.precioLista.toLocaleString('es-AR')}</td>
                      <td>${i.neto.toLocaleString('es-AR')}</td>
                      <td>${i.subtotal.toLocaleString('es-AR')}</td>
                    </tr>
                  )}
                />
              </>
            )}
            <div className="flex justify-between items-center mt-3 flex-wrap gap-2">
              <p className="text-xs text-muted">
                La sábana es la <strong>foto valorizada</strong> de la consigna del cliente: no mueve stock ni cuenta corriente.
                Se numera SAB- y se envía por mail con PDF + CSV; se puede reenviar y borrar del historial.
                {previewSab ? ` · ${previewSab.totalEjemplares} ejemplares · $${Number(previewSab.totalValorizado).toLocaleString('es-AR')}` : ''}
              </p>
              <button type="button" className="btn btn-primary" onClick={emitirSabanaDoc} disabled={!sab.cliente || !previewSab || !previewSab.items.length}>
                Emitir sábana
              </button>
            </div>
          </div>
          <Table columnas={colSabanas} filas={listas.sabanas} vacio="Sin sábanas emitidas" exportable exportarNombre="sabanas_mayorista" />
          <div className="flex items-center gap-2 mt-2">
            <input className="input-os" style={{ maxWidth: 260 }} placeholder="Buscar por número o cliente..." value={busq.sabanas} onChange={(e) => buscarEn('sabanas', e.target.value)} />
          </div>
          <Paginador page={pags.sabanas} total={totales.sabanas} limite={LIMITE} onCambiar={(p) => cargarLista('sabanas', { page: p })} etiqueta="sábanas" />
        </>
      )}

      {tab === 'ajustes' && (
        <>
          <div className="card p-3 mb-4">
            <h3 className="text-sm uppercase tracking-widest text-muted mb-2">Nuevo ajuste de consignación</h3>
            <div className="flex gap-3 flex-wrap mb-3 items-end">
              <div style={{ minWidth: 240 }}>
                <span className="field-label">Cliente mayorista</span>
                <SelectBuscador
                  valor={aj.cliente ? aj.cliente.id : null}
                  etiquetaValor={aj.cliente ? aj.cliente.nombre : ''}
                  placeholder="Buscar cliente mayorista..."
                  buscar={buscarMayoristas}
                  onSeleccionar={elegirClienteAj}
                />
              </div>
              <div>
                <span className="field-label">Ajuste</span>
                <select className="input-os" style={{ maxWidth: 320 }} value={aj.tipoAjuste} onChange={(e) => setCampoAj('tipoAjuste', e.target.value)}>
                  <option value="DECREMENTO">Decremento: resta de la sábana y vuelve a nuestro stock</option>
                  <option value="INCREMENTO">Incremento: suma a la sábana y baja de nuestro stock</option>
                </select>
              </div>
              <label className="flex items-center gap-1 text-xs text-muted">
                Nuestro depósito de origen
                <select className="input-os" style={{ maxWidth: 190 }} value={aj.depositoOrigenId} onChange={(e) => setCampoAj('depositoOrigenId', e.target.value)}>
                  <option value="">— Elegir —</option>
                  {depositos.filter((d) => !d.clienteId && d.activo).map((d) => <option key={d.id} value={d.id}>{d.nombre}</option>)}
                </select>
              </label>
            </div>
            <input className="input-os mb-3" placeholder="Motivo del ajuste (obligatorio: es la única vía manual de corrección de la sábana)" value={aj.observaciones} onChange={(e) => setCampoAj('observaciones', e.target.value)} />
            <MayoristaTablaBlock
              items={itemsAj}
              onItems={setItemsAj}
              conTipoStock={false}
              sabana={aj.tipoAjuste === 'DECREMENTO' ? sabanaAj : null}
              etiquetaVacio="Agregá renglones (buscador o CSV código;cantidad)"
            />
            <div className="flex justify-between items-center mt-3 flex-wrap gap-2">
              <p className="text-xs text-muted">
                {aj.tipoAjuste === 'DECREMENTO'
                  ? 'Resta de la sábana del cliente (la columna Sábana es el tope) y devuelve los libros a nuestro depósito de origen.'
                  : 'Suma a la sábana del cliente y descuenta de nuestro depósito de origen (si queda negativo se avisa: no frena).'}
                {' '}Anular revierte todo por el ledger.
              </p>
              <button type="button" className="btn btn-primary" onClick={crearAjusteDoc} disabled={!aj.cliente || !aj.depositoOrigenId || !String(aj.observaciones || '').trim() || !itemsAj.length}>
                Registrar ajuste
              </button>
            </div>
          </div>
          <Table columnas={colAjustes} filas={listas.ajustes} vacio="Sin ajustes de consignación" exportable exportarNombre="ajustes_consignacion" />
          <div className="flex items-center gap-2 mt-2">
            <input className="input-os" style={{ maxWidth: 260 }} placeholder="Buscar por número, motivo o cliente..." value={busq.ajustes} onChange={(e) => buscarEn('ajustes', e.target.value)} />
          </div>
          <Paginador page={pags.ajustes} total={totales.ajustes} limite={LIMITE} onCambiar={(p) => cargarLista('ajustes', { page: p })} etiqueta="ajustes" />
        </>
      )}

      {/* Ver remito */}
      <Modal abierto={!!verRemito} onClose={() => setVerRemito(null)} titulo={verRemito ? `Remito ${verRemito.numero}` : ''} ancho="720px">
        {verRemito && (
          <>
            <p className="text-sm mb-2">
              {verRemito.tipoRemito} · {verRemito.origen ? verRemito.origen.nombre : '—'} → {verRemito.destino ? verRemito.destino.nombre : '—'} · {verRemito.estado}
            </p>
            <TablaItemsPaginada
              items={verRemito.items}
              headers={[<th key="ean">EAN</th>, <th key="tit">Título</th>, <th key="cant">Cantidad</th>, <th key="sd">Sale de</th>]}
              fila={(i, idx) => (
                <tr key={idx}>
                  <td className="font-mono text-xs">{i.barras || '—'}</td>
                  <td>{i.titulo || i.descripcion}</td>
                  <td>{i.cantidad}</td>
                  <td>{i.tipoStock === 'FIRME' ? 'Firme' : 'Consigna'}</td>
                </tr>
              )}
            />
            {verRemito.observaciones && <p className="text-xs text-muted mt-2">{verRemito.observaciones}</p>}
          </>
        )}
      </Modal>

      {/* Ver comprobante de facturación */}
      <Modal abierto={!!verVenta} onClose={() => setVerVenta(null)} titulo={verVenta ? `${verVenta.tipoComprobante} ${verVenta.numeroComprobante}` : ''} ancho="760px">
        {verVenta && (
          <>
            <p className="text-sm mb-2">
              {verVenta.cliente ? verVenta.cliente.nombre : '—'} · {verVenta.estado}
              {verVenta.tipoComprobante === 'FACTURA_MAYORISTA_FIRME' && (verVenta.mueveStock ? ' · movió stock' : ' · genérica (solo CC)')}
              {verVenta.deposito ? ` · ${verVenta.deposito.nombre}` : ''}
            </p>
            <p className="text-xs text-muted mb-2">
              Emitido: {new Date(verVenta.fechaEmision).toLocaleDateString('es-AR')}
              {verVenta.fechaVencimiento ? ` · Vence: ${new Date(verVenta.fechaVencimiento).toLocaleDateString('es-AR')}` : ''}
              {verVenta.cae ? ` · CAE ${verVenta.cae}${verVenta.caeVencimiento ? ` (vto. ${new Date(verVenta.caeVencimiento).toLocaleDateString('es-AR')})` : ''}` : ''}
            </p>
            {verVenta.items.length > 0 ? (
              <TablaItemsPaginada
                items={verVenta.items}
                headers={[<th key="ean">EAN</th>, <th key="tit">Título</th>, <th key="cant">Cant.</th>, <th key="pr">Precio</th>, <th key="ds">Desc.</th>, <th key="sub">Subtotal</th>]}
                fila={(i, idx) => (
                  <tr key={idx}>
                    <td className="font-mono text-xs">{i.barras || '—'}</td>
                    <td>{i.titulo || i.descripcion}</td>
                    <td>{i.cantidad}</td>
                    <td>${i.precioUnitario.toLocaleString('es-AR')}</td>
                    <td>{i.descuentoLinea == null ? '—' : `${i.descuentoLinea}%`}</td>
                    <td>${i.subtotal.toLocaleString('es-AR')}</td>
                  </tr>
                )}
              />
            ) : (
              <p className="text-sm mb-2">
                <span className="text-xs text-muted">Observación:</span> {verVenta.observaciones || '—'}{' '}
                <span className="font-mono">${Number(verVenta.total).toLocaleString('es-AR')}</span>
              </p>
            )}
            <div className="flex justify-end gap-4 text-sm mt-3">
              <span>Subtotal: <strong>${verVenta.subtotal.toLocaleString('es-AR')}</strong></span>
              <span>Desc. global: <strong>-${verVenta.descuentoGlobal.toLocaleString('es-AR')}</strong></span>
              <span>Total: <strong>${verVenta.total.toLocaleString('es-AR')}</strong></span>
            </div>
            {verVenta.observaciones && verVenta.items.length > 0 && <p className="text-xs text-muted mt-2">{verVenta.observaciones}</p>}
          </>
        )}
      </Modal>

      {/* Ver devolución (acuse de recepción) */}
      <Modal abierto={!!verDev} onClose={() => setVerDev(null)} titulo={verDev ? `Acuse de recepción ${verDev.numero}` : ''} ancho="760px">
        {verDev && (
          <>
            <p className="text-sm mb-2">
              {verDev.tipoComprobante === 'DEVOLUCION_CONSIGNA' ? 'Vuelve de consigna (logística, sin CC)' : 'Vuelve de firme (con NC)'}
              {' · '}{verDev.cliente ? verDev.cliente.nombre : '—'} · {verDev.estado}
              {verDev.deposito ? ` · vuelven a ${verDev.deposito.nombre}` : ''}
            </p>
            <p className="text-xs text-muted mb-2">
              Fecha: {new Date(verDev.fecha).toLocaleDateString('es-AR')} · {verDev.totalUnidades} unidades
              {Number(verDev.totalValorizado) ? ` · valorizado $${Number(verDev.totalValorizado).toLocaleString('es-AR')} (NC en la CC)` : ''}
            </p>
            <TablaItemsPaginada
              items={verDev.items}
              headers={[<th key="ean">EAN</th>, <th key="tit">Título</th>, <th key="cant">Cant.</th>, <th key="pr">Precio</th>, <th key="sub">Subtotal</th>]}
              fila={(i, idx) => (
                <tr key={idx}>
                  <td className="font-mono text-xs">{i.barras || '—'}</td>
                  <td>{i.titulo || i.descripcion}</td>
                  <td>{i.cantidad}</td>
                  <td>${i.precioUnitario.toLocaleString('es-AR')}</td>
                  <td>${i.subtotal.toLocaleString('es-AR')}</td>
                </tr>
              )}
            />
            <p className="text-xs text-muted mt-2">Se deja constancia de los libros recibidos. Si hay diferencias con lo devuelto, comunicarse para conciliarlas.</p>
            {verDev.observaciones && <p className="text-xs text-muted mt-1">{verDev.observaciones}</p>}
          </>
        )}
      </Modal>

      {/* Ver pedido de devolución (solicitud + cruce solicitado/recibido) */}
      <Modal abierto={!!verPedido} onClose={() => setVerPedido(null)} titulo={verPedido ? `Pedido de devolución ${verPedido.numero}` : ''} ancho="780px">
        {verPedido && (
          <>
            <p className="text-sm mb-2">
              {verPedido.cliente ? verPedido.cliente.nombre : '—'} · <span className="agente-badge">{ESTADO_PEDIDO[verPedido.estado] || verPedido.estado}</span>
              {verPedido.enviadoA ? ` · enviado a ${verPedido.enviadoA}${verPedido.enviadoEn ? ` (${new Date(verPedido.enviadoEn).toLocaleDateString('es-AR')})` : ''}` : ''}
            </p>
            <p className="text-xs text-muted mb-2">
              Fecha: {new Date(verPedido.fecha).toLocaleDateString('es-AR')} · {verPedido.items.length} títulos · solicitado {verPedido.totalSolicitadas} u
              {verPedido.conciliado ? ` · recibido ${verPedido.totalConciliadas} u · diferencia ${verPedido.totalDiferencia > 0 ? '+' : ''}${verPedido.totalDiferencia}` : ''}
            </p>
            <TablaItemsPaginada
              items={verPedido.items}
              headers={[<th key="ean">EAN</th>, <th key="tit">Título</th>, <th key="sol">Solicitado</th>, <th key="rec">Recibido</th>, <th key="dif">Diferencia</th>, <th key="est">Estado</th>]}
              fila={(i, idx) => (
                <tr key={idx}>
                  <td className="font-mono text-xs">{i.barras || '—'}</td>
                  <td>{i.titulo || i.descripcion}</td>
                  <td>{i.cantidadSolicitada}</td>
                  <td>{i.cantidadConciliada}</td>
                  <td>{i.cantidadConciliada - i.cantidadSolicitada > 0 ? '+' : ''}{i.cantidadConciliada - i.cantidadSolicitada}</td>
                  <td>{{ PENDIENTE: 'Falta', PARCIAL: 'Parcial', COMPLETO: 'Completo', EXCEDENTE: 'De más' }[i.estadoRenglon] || i.estadoRenglon}</td>
                </tr>
              )}
            />
            {verPedido.devoluciones.length > 0 && (
              <p className="text-xs text-muted mt-2">Devoluciones recibidas: {verPedido.devoluciones.map((d) => `${d.numero} (${d.totalUnidades} u)`).join(' · ')}</p>
            )}
            {verPedido.observaciones && <p className="text-xs text-muted mt-1">{verPedido.observaciones}</p>}
            <div className="flex gap-2 flex-wrap mt-3">
              {verPedido.estado === 'PENDIENTE' && <button type="button" className="btn btn-primary text-xs" onClick={() => aprobarPedidoDoc(verPedido)}>Aprobar</button>}
              {verPedido.estado === 'APROBADO' && <button type="button" className="btn btn-primary text-xs" onClick={() => enviarPedidoDoc(verPedido)}>Enviar por mail</button>}
              {['ENVIADO', 'CONCILIADO_PARCIAL'].includes(verPedido.estado) && <button type="button" className="btn btn-primary text-xs" onClick={() => abrirConciliar(verPedido)}>Conciliar con devolución...</button>}
              {['PENDIENTE', 'APROBADO', 'ENVIADO'].includes(verPedido.estado) && <button type="button" className="btn btn-ghost text-xs" style={{ color: 'var(--danger)' }} onClick={() => anularPedidoDoc(verPedido)}>Anular</button>}
            </div>
          </>
        )}
      </Modal>

      {/* Conciliar: elegir la devolución recibida que responde al pedido */}
      <Modal
        abierto={!!conciliando}
        onClose={() => setConciliando(null)}
        titulo={conciliando ? `Conciliar ${conciliando.pedido.numero}` : ''}
        ancho="640px"
        footer={conciliando ? (
          <>
            <button type="button" className="btn btn-ghost" onClick={() => setConciliando(null)}>Cancelar</button>
            <button type="button" className="btn btn-primary" onClick={confirmarConciliacion} disabled={!conciliando.devolucionId}>Conciliar</button>
          </>
        ) : null}
      >
        {conciliando && (
          <>
            <p className="text-sm mb-2">Pedido {conciliando.pedido.numero} · solicitado {conciliando.pedido.totalSolicitadas} u (recibido hasta ahora {conciliando.pedido.totalConciliadas} u)</p>
            {conciliando.opciones.length === 0 ? (
              <p className="text-sm text-muted">No hay devoluciones recibidas de este cliente sin conciliar. Registrá primero la devolución (solapa Devoluciones) y después conciliá.</p>
            ) : (
              <>
                <span className="field-label">Devolución recibida</span>
                <select className="input-os mb-2" value={conciliando.devolucionId} onChange={(e) => setConciliando((prev) => ({ ...prev, devolucionId: e.target.value }))}>
                  {conciliando.opciones.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.numero} · {d.tipoComprobante === 'DEVOLUCION_CONSIGNA' ? 'vuelve de consigna' : 'vuelve de firme'} · {d.totalUnidades} u · {new Date(d.fecha).toLocaleDateString('es-AR')}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-muted">El cruce se hace por título: lo recibido se acumula contra lo solicitado. El acuse (CSV/PDF/Mail) muestra solicitado vs recibido con las diferencias.</p>
              </>
            )}
          </>
        )}
      </Modal>

      {/* Ver sábana (foto valorizada de la consigna) */}
      <Modal abierto={!!verSabana} onClose={() => setVerSabana(null)} titulo={verSabana ? `Sábana de consignación ${verSabana.numero}` : ''} ancho="780px">
        {verSabana && (
          <>
            <p className="text-sm mb-2">
              {verSabana.cliente ? verSabana.cliente.nombre : '—'}
              {verSabana.enviadoA ? ` · enviada a ${verSabana.enviadoA}${verSabana.enviadoEn ? ` (${new Date(verSabana.enviadoEn).toLocaleDateString('es-AR')})` : ''}` : ' · sin enviar todavía'}
            </p>
            <p className="text-xs text-muted mb-2">
              Fecha: {new Date(verSabana.fecha).toLocaleDateString('es-AR')} · {verSabana.totalEjemplares} ejemplares · valorizado ${Number(verSabana.totalValorizado).toLocaleString('es-AR')}
            </p>
            <TablaItemsPaginada
              items={verSabana.items}
              headers={[<th key="ean">EAN</th>, <th key="tit">Título</th>, <th key="cant">Consigna</th>, <th key="pl">Lista</th>, <th key="ds">Desc.</th>, <th key="net">Neto</th>, <th key="sub">Subtotal</th>]}
              fila={(i, idx) => (
                <tr key={idx}>
                  <td className="font-mono text-xs">{i.codigoBarras || i.barras || '—'}</td>
                  <td>{i.titulo}</td>
                  <td>{i.stockConsigna}</td>
                  <td>${i.precioLista.toLocaleString('es-AR')}</td>
                  <td>{i.descuento}%</td>
                  <td>${i.neto.toLocaleString('es-AR')}</td>
                  <td>${i.subtotal.toLocaleString('es-AR')}</td>
                </tr>
              )}
            />
            {verSabana.observaciones && <p className="text-xs text-muted mt-2">{verSabana.observaciones}</p>}
            <div className="flex gap-2 flex-wrap mt-3">
              <button type="button" className="btn btn-ghost text-xs" onClick={() => reimprimir(verSabana, 'csv', 'sabana')}>CSV</button>
              <button type="button" className="btn btn-ghost text-xs" onClick={() => reimprimir(verSabana, 'pdf', 'sabana')}>PDF</button>
              <button type="button" className="btn btn-secondary text-xs" onClick={() => enviarMail(verSabana, 'sabana')}>{verSabana.enviadoA ? 'Reenviar por mail' : 'Enviar por mail'}</button>
              <button type="button" className="btn btn-ghost text-xs" style={{ color: 'var(--danger)' }} onClick={() => borrarSabanaDoc(verSabana)}>Borrar</button>
            </div>
          </>
        )}
      </Modal>

      {/* Ver ajuste (efecto + motivo) */}
      <Modal abierto={!!verAjuste} onClose={() => setVerAjuste(null)} titulo={verAjuste ? `Ajuste de consignación ${verAjuste.numero}` : ''} ancho="720px">
        {verAjuste && (
          <>
            <p className="text-sm mb-2">
              {verAjuste.tipoAjuste === 'INCREMENTO' ? 'Incremento: sumó a la sábana (bajó de nuestro stock)' : 'Decremento: restó de la sábana (volvió a nuestro stock)'}
              {' · '}{verAjuste.cliente ? verAjuste.cliente.nombre : '—'} · <span className="agente-badge">{verAjuste.estado}</span>
              {verAjuste.deposito ? ` · origen ${verAjuste.deposito.nombre}` : ''}
            </p>
            <p className="text-xs text-muted mb-2">
              Fecha: {new Date(verAjuste.createdAt).toLocaleDateString('es-AR')} · {verAjuste.unidades} unidades
            </p>
            <TablaItemsPaginada
              items={verAjuste.items}
              headers={[<th key="ean">EAN</th>, <th key="tit">Título</th>, <th key="cant">Cantidad</th>]}
              fila={(i, idx) => (
                <tr key={idx}>
                  <td className="font-mono text-xs">{i.barras || i.codigo || '—'}</td>
                  <td>{i.titulo || i.descripcion}</td>
                  <td>{i.cantidad}</td>
                </tr>
              )}
            />
            {verAjuste.observaciones && <p className="text-xs text-muted mt-2">Motivo: {verAjuste.observaciones}</p>}
            <div className="flex gap-2 flex-wrap mt-3">
              <button type="button" className="btn btn-ghost text-xs" onClick={() => reimprimir(verAjuste, 'csv', 'ajuste')}>CSV</button>
              <button type="button" className="btn btn-ghost text-xs" onClick={() => reimprimir(verAjuste, 'pdf', 'ajuste')}>PDF</button>
              <button type="button" className="btn btn-ghost text-xs" onClick={() => enviarMail(verAjuste, 'ajuste')}>Mail</button>
              {verAjuste.estado !== 'ANULADO' && <button type="button" className="btn btn-ghost text-xs" style={{ color: 'var(--danger)' }} onClick={() => anularAjusteDoc(verAjuste)}>Anular</button>}
            </div>
          </>
        )}
      </Modal>
    </div>
  );
}
