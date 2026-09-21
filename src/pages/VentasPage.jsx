// BookOS - VentasPage.jsx
// ruta: bookos/frontend/src/pages/VentasPage.jsx
// descripcion: comprobante de venta en esquema "cabecera + tabla de items".
//   Features bookerp: multi-pago, pendientes/recuperar (PEDIDO/PRESUPUESTO),
//   giftcard (PDF), captura de email/newsletter y F10. Interconectado con el
//   Secretario: inyecta el borrador y escucha instrucciones para operar la vista.

import { useCallback, useEffect, useState } from 'react';
import Table from '../ui/Table';
import Modal from '../ui/Modal';
import TablaItemsPaginada from '../ui/TablaItemsPaginada';
import DebugTag from '../ui/DebugTag';
import SelectBuscador from '../ui/SelectBuscador';
import ItemsEditorBlock from '../blocks/ItemsEditorBlock';
import ImportarCsvBlock from '../blocks/ImportarCsvBlock';
import ImportarDocumentoBlock from '../blocks/ImportarDocumentoBlock';
import BuscadorArticuloBlock from '../blocks/BuscadorArticuloBlock';
import Paginador from '../ui/Paginador';
import { ventasApi, clientesApi, agenteApi, exportacionApi, parametrosApi, crmApi } from '../api/api';
import { descargarDesdeServidor } from '../utils/exportar';
import { mapearFilas } from '../utils/csv';
import { costoEstimadoDeForma, etiquetaForma, formasDelMetodo } from '../utils/formasPago';
import usePersistentWork from '../hooks/usePersistentWork';
import { useAppContext } from '../AppContext';
import BotonSecretario from '../ui/BotonSecretario';
import BorradorRestaurado from '../ui/BorradorRestaurado';

const TIPOS = ['FACTURA_B', 'FACTURA_C', 'PEDIDO', 'PRESUPUESTO', 'GIFTCARD'];
const METODOS = ['EFECTIVO', 'TARJETA', 'TRANSFERENCIA', 'CTA_CTE'];

const fmt = (n) => `$${Number(n || 0).toLocaleString('es-AR')}`;

// P6: el genero declarado sugiere el perfil de tematicas (docente se elige a mano).
const sugerirPerfil = (genero) => (genero === 'M' ? 'lectura_masculina' : genero === 'F' ? 'lectura_femenina' : '');

function BadgeEstado({ venta }) {
  const color = venta.estado === 'ANULADA' ? 'var(--danger)' : 'var(--success)';
  const numero = venta.numeroComprobante ? ` ${venta.numeroComprobante}` : '';
  return (
    <span className="agente-badge" style={{ borderColor: color, color }}>
      {venta.tipoComprobante || venta.tipo}{numero} · {venta.estado}
    </span>
  );
}

// Una nota (NC/ND) no se anula como si fuera una venta nueva: primero se anula la original.
const esNota = (v) => {
  const t = String((v && (v.tipoComprobante || v.tipo)) || '');
  return t.startsWith('NC') || t.startsWith('ND');
};

export default function VentasPage() {
  // BORRADOR PERSISTENTE (por usuario): items + cabecera sobreviven al refresco y al cambio de
  // pagina. La cabecera avisa con el indicador ↺ y ofrece limpiar.
  const [borrador, setBorrador, limpiarBorrador, restaurado] = usePersistentWork('venta', {
    items: [], tipo: 'FACTURA_B', clienteId: null, clienteElegido: null,
    metodoPago: 'EFECTIVO', descuentoGlobal: 0, emailComprobante: '', enviarEmail: false,
  });
  const { items, tipo, clienteId, clienteElegido, metodoPago, descuentoGlobal, emailComprobante, enviarEmail } = borrador;
  const setItems = (v) => setBorrador((b) => ({ ...b, items: typeof v === 'function' ? v(b.items) : v }));
  const setClienteElegido = (v) => setBorrador((b) => ({ ...b, clienteElegido: typeof v === 'function' ? v(b.clienteElegido) : v }));
  const setClienteId = (v) => setBorrador((b) => ({ ...b, clienteId: v }));
  const setTipo = (v) => setBorrador((b) => ({ ...b, tipo: v }));
  const setMetodoPago = (v) => setBorrador((b) => ({ ...b, metodoPago: v }));
  const setDescuentoGlobal = (v) => setBorrador((b) => ({ ...b, descuentoGlobal: v }));
  const setEmailComprobante = (v) => setBorrador((b) => ({ ...b, emailComprobante: v }));
  const setEnviarEmail = (v) => setBorrador((b) => ({ ...b, enviarEmail: v }));
  const [metodos, setMetodos] = useState(METODOS);
  // El historial era el listado al pie de la pagina; ahora es un modal (15-09).
  const [historialAbierto, setHistorialAbierto] = useState(false);
  const [cobrarAbierto, setCobrarAbierto] = useState(false);
  const [recibido, setRecibido] = useState('');
  const [mensaje, setMensaje] = useState('');

  const [historial, setHistorial] = useState([]);
  const [detalle, setDetalle] = useState(null);
  const [page, setPage] = useState(1);
  const [totalHistorial, setTotalHistorial] = useState(0);

  // Notas de venta: credito (devolucion, repone stock FIFE) y debito (cargo en CC).
  const [ncAbierto, setNcAbierto] = useState(false);
  const [ncCantidades, setNcCantidades] = useState({});
  const [ncMotivo, setNcMotivo] = useState('');
  const [ndAbierto, setNdAbierto] = useState(false);
  const [ndMonto, setNdMonto] = useState('');
  const [ndMotivo, setNdMotivo] = useState('');

  // multi-pago, ficha marcada, pendientes
  const [pagos, setPagos] = useState([]);
  // Sub-formas de pago activas (debito, credito 6 cuotas, promos): propiedad de COMO paga el cliente.
  const [formas, setFormas] = useState([]);
  const [notaVenta, setNotaVenta] = useState('');
  const [ficha, setFicha] = useState(null); // cliente marcado (nacio en el POS con solo el mail)
  const [fichaForm, setFichaForm] = useState({});
  const [perfiles, setPerfiles] = useState([]);
  const [pendientesAbierto, setPendientesAbierto] = useState(false);
  const [pendientes, setPendientes] = useState([]);

  const { ultimosRecomendados, setUltimosRecomendados, setContextoActual, pedirConsulta, instruccionVista, emitirInstruccion } = useAppContext();

  const clienteActual = clienteElegido;

  // Busqueda de clientes en el servidor (nunca se precarga la tabla entera).
  // `nombre` es el nombre canonico del modelo: la cabecera lo lee de aca para mostrar el elegido.
  const buscarClientes = async (q) => {
    const res = await clientesApi.listar({ search: q, limit: 20 });
    return (res.data || []).map((c) => ({ id: c.id, etiqueta: c.nombre, nombre: c.nombre, detalle: c.telefono || c.documento || '' }));
  };

  useEffect(() => {
    parametrosApi.metodosPago()
      .then((res) => {
        const activos = (res.data || []).filter((m) => m.activo).map((m) => m.nombre);
        if (activos.length) setMetodos(activos);
      })
      .catch(() => {});
    parametrosApi.formasPago().then((res) => setFormas(res.data || [])).catch(() => {});
  }, []);

  // El mail de la ficha precarga el comprobante: lo que se manda es lo que se ve (se puede pisar).
  useEffect(() => {
    const em = clienteActual?.email || '';
    setEmailComprobante(em);
    setEnviarEmail(Boolean(em));
  }, [clienteId]); // eslint-disable-line

  useEffect(() => { crmApi.perfiles().then((res) => setPerfiles(res.data || [])).catch(() => {}); }, []);

  const cargarHistorial = async (p = page) => {
    try {
      const res = await ventasApi.listar({ page: p, limit: 30 });
      setHistorial(res.data || []);
      setTotalHistorial(res.pagination ? res.pagination.total : (res.data || []).length);
    } catch (err) { setMensaje(`⚠️ ${err.message}`); }
  };

  useEffect(() => { cargarHistorial(page); }, [page]); // eslint-disable-line

  // F10: abrir cobro.
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'F10') { e.preventDefault(); if (items.length > 0) abrirCobro(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [items.length, tipo, clienteId, descuentoGlobal, metodoPago]); // eslint-disable-line

  const agregarItem = useCallback((articulo) => {
    if (!articulo || !articulo.ean13) return;
    setItems((prev) => {
      const existe = prev.find((i) => i.ean13 === articulo.ean13);
      if (existe) return prev.map((i) => (i.ean13 === articulo.ean13 ? { ...i, cantidad: (Number(i.cantidad) || 1) + 1 } : i));
      return [...prev, { ean13: articulo.ean13, titulo: articulo.titulo || articulo.ean13, cantidad: 1, precio: Number(articulo.precio) || 0, descuento: 0 }];
    });
  }, [setItems]);

  const importarItems = (raw) => {
    const filas = mapearFilas(raw, ['ean13', 'titulo', 'cantidad', 'precio']);
    const nuevos = filas
      .filter((f) => f.ean13)
      .map((f) => ({ ean13: String(f.ean13), titulo: f.titulo || String(f.ean13), cantidad: Number(f.cantidad) || 1, precio: Number(f.precio) || 0, descuento: 0 }));
    setItems((prev) => [...prev, ...nuevos]);
    if (nuevos.length) setMensaje(`Importados ${nuevos.length} items ✓`);
  };

  const importarDocumento = (list) => {
    const nuevos = list.filter((i) => i.ean13).map((i) => ({ ean13: i.ean13, titulo: i.titulo || i.ean13, cantidad: i.cantidad, precio: i.precio, descuento: 0 }));
    setItems((prev) => [...prev, ...nuevos]);
    if (nuevos.length) setMensaje(`Importados ${nuevos.length} libros del documento ✓`);
  };

  // El cliente creado con F2 (alta rapida del shell) se toma como cliente de la factura: es el
  // dato que alimenta el seguimiento, asi que cargarlo tiene que caer directo en el borrador.
  useEffect(() => {
    if (!instruccionVista || instruccionVista.dominio !== 'clientes' || instruccionVista.accion !== 'cliente_creado') return;
    const c = instruccionVista.cliente;
    if (c && c.id) {
      setClienteId(Number(c.id));
      setClienteElegido({ id: Number(c.id), nombre: c.nombre, email: c.email });
    }
    emitirInstruccion(null);
  }, [instruccionVista]); // eslint-disable-line

  // El Secretario opera la vista: refrescar historial o agregar item al borrador.
  useEffect(() => {
    if (!instruccionVista || instruccionVista.dominio !== 'ventas') return;
    if (instruccionVista.accion === 'refrescar') {
      cargarHistorial();
      if (instruccionVista.mensaje) setMensaje(instruccionVista.mensaje);
    }
    if (instruccionVista.accion === 'agregar_item') agregarItem(instruccionVista.item);
  }, [instruccionVista]); // eslint-disable-line

  // Inyecta el borrador al Secretario.
  useEffect(() => {
    setContextoActual({
      vista: 'ventas',
      tipo,
      clienteId,
      metodoPago,
      descuentoGlobal,
      items: items.map((i) => ({ ean13: i.ean13, titulo: i.titulo, cantidad: i.cantidad, precio: i.precio, descuento: i.descuento })),
    });
  }, [items, tipo, clienteId, metodoPago, descuentoGlobal]); // eslint-disable-line

  const subtotal = items.reduce((acc, i) => acc + (Number(i.precio) || 0) * (Number(i.cantidad) || 0) * (1 - (Number(i.descuento) || 0) / 100), 0);
  const total = Math.max(0, subtotal - (Number(descuentoGlobal) || 0));
  const sumaPagos = pagos.reduce((a, p) => a + (Number(p.monto) || 0), 0);
  // Lo que absorbe el comercio por las sub-formas elegidas (coeficiente + % del operador).
  const costoTotalPagos = pagos.reduce((a, p) => {
    const forma = formasDelMetodo(formas, p.metodoPago).find((f) => f.id === p.formaPagoId) || null;
    return a + costoEstimadoDeForma(forma, p.monto);
  }, 0);
  // Vuelto = lo que entrego el cliente menos el total (control visual del mostrador).
  const vuelto = (Number(recibido) || 0) - total;

  const abrirCobro = () => {
    if ((tipo === 'PEDIDO' || tipo === 'PRESUPUESTO') && !clienteId && !emailComprobante.trim()) {
      setMensaje('⚠️ Pedido/Presupuesto requieren un cliente o un mail (el mail crea la ficha).');
      return;
    }
    setPagos([{ metodoPago, monto: total, formaPagoId: null }]);
    setRecibido('');
    setNotaVenta('');
    setCobrarAbierto(true);
  };

  const setPago = (i, campo, valor) => {
    setPagos((prev) => prev.map((p, idx) => {
      if (idx !== i) return p;
      if (campo === 'monto') return { ...p, monto: Number(valor) || 0 };
      // Cambiar el metodo borra la sub-forma: cada sub-forma cuelga de un metodo madre.
      if (campo === 'metodoPago') return { ...p, metodoPago: valor, formaPagoId: null };
      return { ...p, [campo]: valor };
    }));
  };
  const agregarPago = () => setPagos((prev) => {
    // Lo que FALTA para cancelar el total viaja como monto de la linea nueva: el mostrador no
    // tiene que calcular el saldo a mano al partir el pago en dos formas.
    const pagado = prev.reduce((a, p) => a + (Number(p.monto) || 0), 0);
    return [...prev, { metodoPago: 'EFECTIVO', monto: Math.max(0, Math.round((total - pagado) * 100) / 100), formaPagoId: null }];
  });
  const quitarPago = (i) => setPagos((prev) => prev.filter((_, idx) => idx !== i));

  // P6: el mail es la identidad. Si ya existe ficha, el cliente se selecciona solo; si nacio en
  // el mostrador y quedo incompleta (datosPendientes), salta el modal para completarla.
  const revisarEmail = async () => {
    const em = emailComprobante.trim();
    if (!em.includes('@')) return;
    try {
      const res = await clientesApi.porEmail(em);
      const lista = res.data?.clientes || [];
      if (!lista.length) return;
      const c = lista[0];
      setClienteId(c.id);
      setClienteElegido({ id: c.id, nombre: c.nombre, email: c.email });
      if (c.datosPendientes) {
        setFichaForm({ nombre: c.nombre || '', telefono: c.telefono || '', genero: c.genero || '', perfil: c.perfil || '' });
        setFicha(c);
      }
    } catch (err) { /* el reconocimiento del mail no debe molestar al mostrador */ }
  };

  const guardarFicha = async () => {
    if (!ficha) return;
    try {
      await clientesApi.actualizar(ficha.id, {
        nombre: fichaForm.nombre,
        telefono: fichaForm.telefono,
        genero: fichaForm.genero || null,
        perfil: fichaForm.perfil || null,
        datosPendientes: false,
      });
      setMensaje(fichaForm.perfil ? `Ficha completada · perfil "${fichaForm.perfil}" guardado ✓` : `Ficha de ${fichaForm.nombre} completada ✓`);
      setFicha(null);
      setClienteElegido((c) => (c && c.id === ficha.id ? { ...c, nombre: fichaForm.nombre } : c));
    } catch (err) { setMensaje(`⚠️ ${err.message}`); }
  };

  const cobrar = async () => {
    try {
      const payload = {
        articulos: items.map((i) => ({ ean13: i.ean13, cantidad: i.cantidad, descuento: i.descuento || 0 })),
        tipo,
        metodoPago,
        clienteId: clienteId || null,
        descuentoGlobal,
        emailComprobante: emailComprobante.trim() || null,
        enviarComprobante: enviarEmail && Boolean(emailComprobante.trim()),
        // Nota libre del vendedor: el motor le agrega el seguimiento de precios en el mismo campo.
        nota: notaVenta.trim() || null,
      };
      // Si alguna linea lleva sub-forma o los numeros del papel (cheque/posnet), el desglose viaja completo.
      const hayDetalle = pagos.some((p) => p.formaPagoId || p.numeroCheque || p.numeroTransaccion);
      if (pagos.length > 1 || tipo === 'PEDIDO' || tipo === 'PRESUPUESTO' || hayDetalle) {
        const esPendiente = tipo === 'PEDIDO' || tipo === 'PRESUPUESTO';
        const suma = pagos.reduce((a, p) => a + (Number(p.monto) || 0), 0);
        if (suma > total + 0.01) { setMensaje(`⚠️ La suma de pagos (${fmt(suma)}) supera el total (${fmt(total)})`); return; }
        if (!esPendiente && Math.abs(suma - total) > 0.01) { setMensaje(`⚠️ La suma de pagos (${fmt(suma)}) no coincide con el total (${fmt(total)})`); return; }
        payload.pagos = pagos;
      } else if (pagos.length === 1) {
        payload.metodoPago = pagos[0].metodoPago;
      }

      const res = await ventasApi.procesar(payload);
      const ventaId = res.data.ventaId;
      const vendidos = items.map((i) => i.ean13);
      if (clienteId && ultimosRecomendados.length > 0) {
        await agenteApi.outcome({ clienteId, recomendados: ultimosRecomendados, vendidos });
        setUltimosRecomendados([]);
      }

      if (tipo === 'GIFTCARD') {
        const p = await exportacionApi.pdf({
          nombre: `giftcard_${ventaId}`,
          titulo: 'GIFT CARD',
          numero: fmt(res.data.total),
          cliente: 'Presenta esta tarjeta en el local para canjear tu regalo.',
          lineas: [`Codigo de validacion: #${ventaId}`],
        });
        await descargarDesdeServidor(p.data.url).catch(() => {});
      }

      const envio = res.data.envio;
      const comprobante = res.data.numeroComprobante || `${res.data.tipo} #${ventaId}`;
      setMensaje(`${comprobante} por ${fmt(res.data.total)} ✓${res.data.fichaCreada ? ' · ficha nueva por el mail' : ''}${
        envio ? (envio.enviado ? ` · comprobante enviado${envio.redirigido ? ' (MODO PRUEBA)' : ''}` : ` · mail no enviado: ${envio.motivo || 'sin configurar'}`) : ''}`);
      setCobrarAbierto(false);
      setItems([]);
      setDescuentoGlobal(0);
      setTipo('FACTURA_B');
      setEmailComprobante('');
      setEnviarEmail(false);
      cargarHistorial();
    } catch (err) {
      setMensaje(`⚠️ ${err.message}`);
    }
  };

  const cargarPendientes = async () => {
    try {
      const res = await ventasApi.pendientes();
      setPendientes(res.data || []);
      setPendientesAbierto(true);
    } catch (err) { setMensaje(`⚠️ ${err.message}`); }
  };

  const recuperarPendiente = (p) => {
    // Los items del comprobante guardan descripcion y el articulo para reponer el codigo.
    const reconstruidos = (p.items || []).map((it) => ({
      ean13: (it.articulo && (it.articulo.barras || it.articulo.codigo)) || '',
      titulo: it.descripcion || '',
      cantidad: Number(it.cantidad) || 0,
      precio: Number(it.precioUnitario) || 0,
      descuento: Number(it.bonificacion) || 0,
    }));
    const utiles = reconstruidos.filter((it) => it.ean13);
    setItems(utiles);
    if (p.clienteId) {
      setClienteId(Number(p.clienteId));
      setClienteElegido(p.cliente ? { id: p.cliente.id, nombre: p.cliente.nombre } : { id: Number(p.clienteId), nombre: `Cliente #${p.clienteId}` });
    }
    setTipo('FACTURA_B');
    setPendientesAbierto(false);
    const perdidos = reconstruidos.length - utiles.length;
    setMensaje(`Pedido #${p.id} cargado para facturar ✓${perdidos ? ` (${perdidos} item/s sin codigo, salteados)` : ''}`);
  };

  const verDetalle = async (venta) => {
    try {
      const res = await ventasApi.obtener(venta.id);
      const completa = res.data || res;
      setDetalle(completa);
      setContextoActual({ ventaId: completa.id, tipo: completa.tipoComprobante, estado: completa.estado, items: completa.items, total: Number(completa.total) });
    } catch (err) { setMensaje(`⚠️ ${err.message}`); }
  };

  const anular = async () => {
    if (!window.confirm(`¿Anular la venta #${detalle.id}? Se revierte el stock, la caja y la cuenta corriente.`)) return;
    try {
      await ventasApi.anular(detalle.id);
      setMensaje(`Venta #${detalle.id} anulada (stock restaurado) ✓`);
      setDetalle(null);
      cargarHistorial();
    } catch (err) { setMensaje(`⚠️ ${err.message}`); }
  };

  // E14: descarga por documento — CSV/PDF al storage y mail con adjuntos (MODO PRUEBA si esta activo).
  const descargar = async (v, formato) => {
    try {
      const res = await ventasApi[formato](v.id);
      const d = res.data || {};
      await descargarDesdeServidor(`/archivos/${d.archivoId}/descarga`, d.nombre);
      setMensaje(`${d.nombre} descargado ✓`);
    } catch (err) { setMensaje(`⚠️ ${err.message}`); }
  };

  const enviarPorMail = async (v) => {
    try {
      const res = await ventasApi.mail(v.id);
      const d = res.data || {};
      setMensaje(d.enviado
        ? `Comprobante enviado a ${d.a || 'el cliente'}${d.redirigido ? ' (MODO PRUEBA)' : ''} ✓`
        : `⚠️ No se pudo enviar: ${d.motivo || 'sin configurar'}`);
    } catch (err) { setMensaje(`⚠️ ${err.message}`); }
  };

  // Nota de credito: abre el modal con las cantidades a devolver (renglon por renglon).
  const abrirNc = () => {
    const inicial = {};
    (detalle.items || []).forEach((it) => { inicial[it.id] = Number(it.cantidad) || 0; });
    setNcCantidades(inicial);
    setNcMotivo('');
    setNcAbierto(true);
  };

  const emitirNc = async () => {
    const items = Object.entries(ncCantidades)
      .map(([id, cant]) => ({ ventaItemId: Number(id), cantidad: Number(cant) || 0 }))
      .filter((i) => i.cantidad > 0);
    if (!items.length) { setMensaje('⚠️ indica al menos una cantidad a devolver'); return; }
    try {
      const res = await ventasApi.notaCredito(detalle.id, { items, motivo: ncMotivo || null });
      const nc = res.data || {};
      setMensaje(`Nota de credito ${nc.numero || ''} emitida (stock repuesto y saldo a favor) ✓`);
      setNcAbierto(false);
      setDetalle(null);
      cargarHistorial();
    } catch (err) { setMensaje(`⚠️ ${err.message}`); }
  };

  const emitirNd = async () => {
    const monto = Number(ndMonto) || 0;
    if (monto <= 0) { setMensaje('⚠️ el monto del debito tiene que ser mayor a cero'); return; }
    try {
      const res = await ventasApi.notaDebito(detalle.id, { monto, motivo: ndMotivo || null });
      const nd = res.data || {};
      setMensaje(`Nota de debito ${nd.numero || ''} emitida (cargo en la cuenta corriente) ✓`);
      setNdAbierto(false);
      setDetalle(null);
      cargarHistorial();
    } catch (err) { setMensaje(`⚠️ ${err.message}`); }
  };

  const columnasItems = [
    { clave: 'ean13', titulo: 'EAN', editable: true, ancho: 130 },
    { clave: 'titulo', titulo: 'Titulo', editable: true, ancho: 260 },
    { clave: 'cantidad', titulo: 'Cant.', editable: true, tipo: 'number', ancho: 70 },
    { clave: 'precio', titulo: 'Precio', editable: true, tipo: 'number', ancho: 100 },
    { clave: 'descuento', titulo: 'Desc. %', editable: true, tipo: 'number', ancho: 80 },
    { clave: 'subtotal', titulo: 'Subtotal', render: (it) => fmt((Number(it.precio) || 0) * (Number(it.cantidad) || 0) * (1 - (Number(it.descuento) || 0) / 100)) },
  ];

  const columnasHistorial = [
    { clave: 'id', titulo: 'ID' },
    { clave: 'tipo', titulo: 'Comprobante', render: (v) => <BadgeEstado venta={v} /> },
    { clave: 'total', titulo: 'Total', render: (v) => fmt(v.total), valorExport: (v) => Number(v.total) },
    { clave: 'fecha', titulo: 'Fecha', render: (v) => new Date(v.createdAt).toLocaleString('es-AR'), valorExport: (v) => new Date(v.createdAt).toLocaleString('es-AR') },
    { clave: 'acciones', titulo: '', render: (v) => (
      <div className="flex gap-2">
        <button type="button" className="btn btn-ghost text-xs" onClick={() => { setHistorialAbierto(false); verDetalle(v); }}>Ver</button>
        <button type="button" className="btn btn-ghost text-xs" onClick={() => descargar(v, 'csv')}>CSV</button>
        <button type="button" className="btn btn-ghost text-xs" onClick={() => descargar(v, 'pdf')}>PDF</button>
        <button type="button" className="btn btn-ghost text-xs" onClick={() => enviarPorMail(v)}>Mail</button>
      </div>
    ) },
  ];

  return (
    <div>
      <DebugTag nombre="VentasPage" />
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-semibold">Ventas</h2>
          <BorradorRestaurado visible={restaurado} onLimpiar={limpiarBorrador} />
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-muted">factura descuenta stock · pedido/presupuesto exigen cliente · anular revierte stock, caja y CC · F10 cobrar · F2 cliente rapido</span>
          <button type="button" className="btn btn-ghost text-xs" onClick={() => setHistorialAbierto(true)}>Historial</button>
        </div>
      </div>

      {mensaje && <p className="text-sm mb-3">{mensaje}</p>}

      {/* CABECERA */}
      <div className="card p-4 mb-4">
        <h3 className="font-semibold mb-3">Cabecera del comprobante</h3>
        <div className="grid md:grid-cols-4 gap-3">
          <label className="block">
            <span className="block text-xs uppercase tracking-widest text-muted mb-1">Tipo</span>
            <select className="input-os" value={tipo} onChange={(e) => setTipo(e.target.value)}>
              {TIPOS.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </label>
          <label className="block">
            <span className="block text-xs uppercase tracking-widest text-muted mb-1">Cliente</span>
            <SelectBuscador
              valor={clienteId}
              etiquetaValor={clienteActual ? clienteActual.nombre : ''}
              placeholder="Consumidor final — buscar cliente (o F2 para el alta rapida)..."
              buscar={buscarClientes}
              onSeleccionar={(it) => { setClienteId(it ? it.id : null); setClienteElegido(it); }}
            />
          </label>
          <label className="block">
            <span className="block text-xs uppercase tracking-widest text-muted mb-1">Metodo de pago</span>
            <select className="input-os" value={metodoPago} onChange={(e) => setMetodoPago(e.target.value)}>
              {metodos.map((m) => <option key={m} value={m}>{m}</option>)}
            </select>
          </label>
          <label className="block">
            <span className="block text-xs uppercase tracking-widest text-muted mb-1">Desc. global ($)</span>
            <input className="input-os" type="number" min="0" value={descuentoGlobal} onChange={(e) => setDescuentoGlobal(Number(e.target.value) || 0)} />
          </label>
        </div>
        <div className="grid md:grid-cols-4 gap-3 mt-3">
          <label className="block md:col-span-2">
            <span className="block text-xs uppercase tracking-widest text-muted mb-1">Email del comprobante</span>
            <input className="input-os" type="email" placeholder="cliente@mail.com" value={emailComprobante} onChange={(e) => setEmailComprobante(e.target.value)} onBlur={revisarEmail} />
          </label>
          <label className="flex items-center gap-2 text-sm md:mt-5 md:col-span-2">
            <input type="checkbox" checked={enviarEmail} disabled={!emailComprobante.trim()} onChange={(e) => setEnviarEmail(e.target.checked)} />
            <span>Enviar el comprobante por mail</span>
          </label>
        </div>
        <p className="text-xs text-muted mt-2">
          Sin cliente elegido, el mail crea la ficha (marcada) y la venta queda a su nombre: es la identidad del seguimiento y del newsletter.
        </p>
        <div className="flex justify-end gap-2 mt-3">
          <button type="button" className="btn btn-ghost text-xs" onClick={cargarPendientes}>Pendientes</button>
          <BotonSecretario
            className="btn btn-ghost text-xs"
            consulta={`Estoy armando una ${tipo} con ${items.length} items. Sugerime titulos para completarla.`}
          />
        </div>
      </div>

      {/* BUSQUEDA (EAN, titulo, autor o editorial — con debounce) */}
      <div className="card p-4 mb-4">
        <BuscadorArticuloBlock etiqueta="Agregar a la venta" onSeleccionar={agregarItem} />
      </div>

      {/* TABLA DE ITEMS */}
      <div className="card p-4 mb-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold">Items ({items.length})</h3>
          <div className="flex items-center gap-2">
            <ImportarCsvBlock etiqueta="Importar CSV" onCargar={importarItems} />
            <ImportarDocumentoBlock onCargar={importarDocumento} />
            <span className="text-xs text-muted">Editable en linea · persiste al navegar</span>
          </div>
        </div>
        <ItemsEditorBlock
          items={items}
          onChange={setItems}
          onRemove={(i) => setItems(items.filter((_, idx) => idx !== i))}
          columnas={columnasItems}
          vacio="Agrega items desde la busqueda o pidiendo al Secretario"
        />
        <div className="flex justify-end mt-4 gap-6">
          <div className="text-sm">Subtotal: <strong>{fmt(subtotal)}</strong></div>
          <div className="text-sm">Desc. global: <strong>-{fmt(descuentoGlobal)}</strong></div>
          <div className="text-base font-semibold">Total: {fmt(total)}</div>
        </div>
        <div className="flex justify-end mt-3 gap-2">
          <button type="button" className="btn btn-ghost" disabled={items.length === 0} onClick={() => setItems([])}>Vaciar</button>
          <button type="button" className="btn btn-primary" disabled={items.length === 0} onClick={abrirCobro}>Cobrar (F10)</button>
        </div>
      </div>

      {/* HISTORIAL DE VENTAS EN MODAL (15-09): era el listado al pie de la pagina. El listado de
          ventas del dia/periodo vive en Caja (submenu de caja). */}
      <Modal abierto={historialAbierto} onClose={() => setHistorialAbierto(false)} titulo="Historial de ventas (documentos)" ancho="1000px"
        footer={<button type="button" className="btn btn-primary" onClick={() => setHistorialAbierto(false)}>Cerrar</button>}
      >
        <Table columnas={columnasHistorial} filas={historial} vacio="Sin ventas" exportable exportarNombre="ventas" />
        <Paginador page={page} total={totalHistorial} limite={30} onCambiar={setPage} etiqueta="ventas" />
      </Modal>

      {/* COBRO (multi-pago) */}
      <Modal abierto={cobrarAbierto} onClose={() => setCobrarAbierto(false)} titulo={`Cobrar ${tipo}`} ancho="480px"
        footer={
          <>
            <button type="button" className="btn btn-ghost" onClick={() => setCobrarAbierto(false)}>Volver</button>
            <button type="button" className="btn btn-primary" onClick={cobrar}>Confirmar</button>
          </>
        }
      >
        <p className="text-sm mb-3">Total: <strong>{fmt(total)}</strong> · Suma pagos: {fmt(sumaPagos)}</p>
        {(tipo === 'PEDIDO' || tipo === 'PRESUPUESTO') && (
          <p className="text-xs mb-2" style={{ color: 'var(--accent)' }}>
            {tipo}: lo cobrado ahora es la <strong>seña</strong> (puede ser menor al total); el saldo queda pendiente.
            {sumaPagos < total && <> Saldo pendiente: <strong>{fmt(total - sumaPagos)}</strong>.</>}
          </p>
        )}
        <div className="grid grid-cols-2 gap-3 mb-3">
          <label className="block">
            <span className="block text-xs uppercase tracking-widest text-muted mb-1">Monto recibido</span>
            <input className="input-os" type="number" min="0" placeholder="Opcional" value={recibido} onChange={(e) => setRecibido(e.target.value)} />
          </label>
          <div>
            <span className="block text-xs uppercase tracking-widest text-muted mb-1">Vuelto</span>
            <div className="text-lg font-semibold" style={{ color: recibido === '' ? undefined : vuelto < 0 ? 'var(--danger)' : 'var(--success)' }}>
              {recibido === '' ? '-' : fmt(vuelto)}
            </div>
          </div>
        </div>
        {pagos.map((p, i) => {
          const subFormas = formasDelMetodo(formas, p.metodoPago);
          const forma = subFormas.find((f) => f.id === p.formaPagoId) || null;
          const costo = costoEstimadoDeForma(forma, p.monto);
          return (
            <div key={i} className="mb-2">
              <div className="flex gap-2 items-center">
                <select className="input-os" value={p.metodoPago} onChange={(e) => setPago(i, 'metodoPago', e.target.value)}>
                  {metodos.map((m) => <option key={m} value={m}>{m}</option>)}
                </select>
                <input className="input-os" type="number" min="0" value={p.monto} onChange={(e) => setPago(i, 'monto', e.target.value)} style={{ maxWidth: 130 }} />
                {pagos.length > 1 && <button type="button" className="btn btn-ghost text-xs" onClick={() => quitarPago(i)}>✕</button>}
              </div>
              {subFormas.length > 0 && (
                <div className="flex gap-2 items-center mt-1">
                  <select className="input-os" value={p.formaPagoId || ''} onChange={(e) => setPago(i, 'formaPagoId', e.target.value ? Number(e.target.value) : null)}>
                    <option value="">Sub-forma (opcional)...</option>
                    {subFormas.map((f) => <option key={f.id} value={f.id}>{etiquetaForma(f)}</option>)}
                  </select>
                  {costo > 0 && <span className="text-xs text-muted whitespace-nowrap">costo est. {fmt(costo)}</span>}
                </div>
              )}
              {p.metodoPago === 'CHEQUE' && (
                <input className="input-os mt-1" placeholder="Nro de cheque (obligatorio)" value={p.numeroCheque || ''} onChange={(e) => setPago(i, 'numeroCheque', e.target.value)} />
              )}
              {p.metodoPago === 'TARJETA' && (
                <input className="input-os mt-1" placeholder="Nro de transacción del ticket (opcional)" value={p.numeroTransaccion || ''} onChange={(e) => setPago(i, 'numeroTransaccion', e.target.value)} />
              )}
            </div>
          );
        })}
        <div className="flex justify-between items-center">
          <button type="button" className="btn btn-ghost text-xs" onClick={agregarPago}>+ Agregar pago</button>
          {costoTotalPagos > 0 && <span className="text-xs text-muted">Costo estimado de las sub-formas: {fmt(costoTotalPagos)}</span>}
        </div>
        <label className="block mt-3">
          <span className="block text-xs uppercase tracking-widest text-muted mb-1">Nota de la venta (opcional)</span>
          <input className="input-os" placeholder="Observacion del vendedor: queda guardada con la venta" value={notaVenta} onChange={(e) => setNotaVenta(e.target.value)} />
        </label>
        <p className="text-xs text-muted mt-1">
          Si un renglon sale con descuento o cambio de precio, el motor lo asienta solo en la misma nota
          (seguimiento) y sale tambien en el documento.
        </p>
        <p className="text-xs text-muted mt-2">
          {tipo === 'PEDIDO' || tipo === 'PRESUPUESTO'
            ? `${tipo} no descuenta stock y requiere cliente seleccionado.`
            : tipo === 'GIFTCARD'
              ? 'La giftcard no descuenta stock; se genera un PDF al confirmar.'
              : 'Al confirmar se descuenta stock y se registra el outcome de las recomendaciones del Secretario.'}
        </p>
      </Modal>

      {/* P6: ficha marcada incompleta (nacio en el mostrador con solo el mail) */}
      <Modal abierto={Boolean(ficha)} onClose={() => setFicha(null)} titulo={ficha ? `Completar ficha - ${ficha.nombre}` : ''} ancho="500px"
        footer={
          <>
            <button type="button" className="btn btn-ghost" onClick={() => setFicha(null)}>Dejar para despues</button>
            <button type="button" className="btn btn-primary" disabled={!fichaForm.nombre} onClick={guardarFicha}>Guardar</button>
          </>
        }
      >
        <p className="text-sm mb-3">
          Este mail ya es un cliente: se creo en el mostrador con solo la direccion.
          Completa lo que sepas y la proxima vez no se pregunta.
        </p>
        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className="block text-xs uppercase tracking-widest text-muted mb-1">Nombre</span>
            <input className="input-os" value={fichaForm.nombre || ''} onChange={(e) => setFichaForm({ ...fichaForm, nombre: e.target.value })} />
          </label>
          <label className="block">
            <span className="block text-xs uppercase tracking-widest text-muted mb-1">Telefono</span>
            <input className="input-os" value={fichaForm.telefono || ''} onChange={(e) => setFichaForm({ ...fichaForm, telefono: e.target.value })} />
          </label>
          <label className="block">
            <span className="block text-xs uppercase tracking-widest text-muted mb-1">Genero</span>
            <select className="input-os" value={fichaForm.genero || ''} onChange={(e) => { const g = e.target.value; setFichaForm((f) => ({ ...f, genero: g, perfil: f.perfil || sugerirPerfil(g) })); }}>
              <option value="">—</option>
              <option value="M">M</option>
              <option value="F">F</option>
              <option value="X">X</option>
            </select>
          </label>
          <label className="block">
            <span className="block text-xs uppercase tracking-widest text-muted mb-1">Perfil de lectura</span>
            <select className="input-os" value={fichaForm.perfil || ''} onChange={(e) => setFichaForm({ ...fichaForm, perfil: e.target.value })}>
              <option value="">—</option>
              {perfiles.map((p) => <option key={p.clave} value={p.clave}>{p.etiqueta || p.clave}</option>)}
            </select>
          </label>
        </div>
        <p className="text-xs text-muted mt-3">
          El perfil siembra las materias del cliente como intereses y lo hace entrar en las campanas por perfil.
        </p>
      </Modal>

      {/* PENDIENTES */}
      <Modal abierto={pendientesAbierto} onClose={() => setPendientesAbierto(false)} titulo="Pendientes (pedidos / presupuestos)" ancho="560px">
        {pendientes.length === 0 && <p className="text-sm text-muted">Sin comprobantes pendientes.</p>}
        {pendientes.map((p) => (
          <div key={p.id} className="flex justify-between items-center py-2" style={{ borderBottom: '1px solid var(--border)' }}>
            <div>
              <span className="agente-badge mr-2">{p.tipo}</span>
              <span className="text-sm">#{p.id} · {fmt(p.total)} · {(p.items || []).length} items</span>
            </div>
            <button type="button" className="btn btn-primary text-xs" onClick={() => recuperarPendiente(p)}>Cargar en venta</button>
          </div>
        ))}
      </Modal>

      {/* DETALLE */}
      <Modal abierto={Boolean(detalle) && !ncAbierto && !ndAbierto} onClose={() => setDetalle(null)} titulo={detalle ? `Venta #${detalle.id}` : ''} ancho="640px"
        footer={
          detalle ? (
            <>
              <BotonSecretario consulta={`Analiza la venta #${detalle.id}: ${(detalle.items || []).length} items por ${fmt(detalle.total)}. ¿Que ves?`} />
              {detalle.estado === 'COMPLETADA' && !esNota(detalle) && (
                <>
                  <button type="button" className="btn btn-ghost" onClick={abrirNc}>Nota de credito</button>
                  <button type="button" className="btn btn-ghost" onClick={() => { setNdMonto(''); setNdMotivo(''); setNdAbierto(true); }}>Nota de debito</button>
                </>
              )}
              {detalle.estado !== 'ANULADA' && (
                <button type="button" className="btn btn-ghost" style={{ color: 'var(--danger)' }} onClick={anular}>Anular</button>
              )}
              <button type="button" className="btn btn-primary" onClick={() => setDetalle(null)}>Cerrar</button>
            </>
          ) : null
        }
      >
        {detalle && (
          <div>
            <div className="flex items-center gap-2 mb-3">
              <BadgeEstado venta={detalle} />
              <span className="text-sm">{new Date(detalle.fechaEmision || detalle.createdAt).toLocaleString('es-AR')}</span>
              <span className="text-sm text-muted">{detalle.cliente ? detalle.cliente.nombre : 'Consumidor final'}</span>
            </div>
            <TablaItemsPaginada
              items={detalle.items || []}
              headers={[<th key="tit">Titulo</th>, <th key="cant">Cant.</th>, <th key="pr">Precio</th>, <th key="sub">Subtotal</th>]}
              fila={(item, idx) => (
                <tr key={idx}>
                  <td>{item.descripcion}</td>
                  <td>{item.cantidad}</td>
                  <td>{fmt(item.precioUnitario)}</td>
                  <td>{fmt(item.subtotalLinea)}</td>
                </tr>
              )}
            />
            <div className="flex justify-end font-semibold mt-3">Total: {fmt(detalle.total)}</div>
            {detalle.nota && (
              <div className="mt-3 text-sm" style={{ borderLeft: '3px solid var(--accent)', paddingLeft: 8 }}>
                {detalle.nota.texto && <p><strong>Nota:</strong> {detalle.nota.texto}</p>}
                {(detalle.nota.seguimiento || []).map((s, idx) => (
                  <p key={idx} className="text-xs text-muted">
                    {s.tipo === 'PRECIO_BAJA' ? 'Baja' : 'Sube'} de precio: {s.item} · lista {fmt(s.precioLista)} → vendido {fmt(s.precioVendido)} ({s.diferencia > 0 ? '+' : ''}{s.diferencia})
                  </p>
                ))}
              </div>
            )}
            {(detalle.pagos || []).length > 0 && (
              <div className="mt-4">
                <h4 className="font-semibold text-sm mb-1">Formas de pago</h4>
                <table className="table-os">
                  <thead><tr><th>Metodo</th><th>Sub-forma</th><th>Nro</th><th>Monto</th><th>Costo est.</th></tr></thead>
                  <tbody>
                    {detalle.pagos.map((p) => (
                      <tr key={p.id}>
                        <td>{p.metodoPagoNombre}</td>
                        <td>{p.formaPagoNombre || '—'}</td>
                        <td>{p.numeroCheque ? `cheque ${p.numeroCheque}` : p.numeroTransaccion ? `op. ${p.numeroTransaccion}` : '—'}</td>
                        <td>{fmt(p.monto)}</td>
                        <td>{p.costoEstimado ? fmt(p.costoEstimado) : '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </Modal>

      {/* NOTA DE CREDITO (devolucion de cliente: repone stock FIFE y deja saldo a favor) */}
      <Modal abierto={ncAbierto} onClose={() => setNcAbierto(false)} titulo={`Nota de credito de la venta #${detalle ? detalle.id : ''}`} ancho="560px"
        footer={
          <>
            <button type="button" className="btn btn-ghost" onClick={() => setNcAbierto(false)}>Volver</button>
            <button type="button" className="btn btn-primary" onClick={emitirNc}>Emitir nota de credito</button>
          </>
        }
      >
        {detalle && (
          <div>
            <p className="text-sm mb-2">
              Cantidades que vuelven: el stock se repone con la regla FIFE (consigna primero, firme despues) y
              {detalle.clienteId ? ' queda saldo a favor en la cuenta corriente del cliente.' : ' sale del efectivo como egreso de caja.'}
            </p>
            <table className="table-os">
              <thead><tr><th>Titulo</th><th>Vendido</th><th>Devolver</th></tr></thead>
              <tbody>
                {(detalle.items || []).map((it) => (
                  <tr key={it.id}>
                    <td>{it.descripcion}</td>
                    <td>{it.cantidad}</td>
                    <td>
                      <input
                        className="input-os"
                        type="number"
                        min="0"
                        max={it.cantidad}
                        style={{ maxWidth: 90 }}
                        value={ncCantidades[it.id] ?? 0}
                        onChange={(e) => setNcCantidades({ ...ncCantidades, [it.id]: Math.min(Number(it.cantidad), Math.max(0, Number(e.target.value) || 0)) })}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <label className="block mt-3">
              <span className="block text-xs uppercase tracking-widest text-muted mb-1">Motivo</span>
              <input className="input-os" value={ncMotivo} onChange={(e) => setNcMotivo(e.target.value)} placeholder="Devolucion, error de precio..." />
            </label>
          </div>
        )}
      </Modal>

      {/* NOTA DE DEBITO (cargo a la cuenta corriente del cliente) */}
      <Modal abierto={ndAbierto} onClose={() => setNdAbierto(false)} titulo={`Nota de debito de la venta #${detalle ? detalle.id : ''}`} ancho="440px"
        footer={
          <>
            <button type="button" className="btn btn-ghost" onClick={() => setNdAbierto(false)}>Volver</button>
            <button type="button" className="btn btn-primary" onClick={emitirNd}>Emitir nota de debito</button>
          </>
        }
      >
        {detalle && (
          <div>
            {detalle.clienteId ? (
              <>
                <p className="text-sm mb-3">Carga un importe a la cuenta corriente de {detalle.cliente ? detalle.cliente.nombre : `cliente #${detalle.clienteId}`} (intereses, gastos, responsabilidad). No mueve stock.</p>
                <label className="block mb-2">
                  <span className="block text-xs uppercase tracking-widest text-muted mb-1">Monto</span>
                  <input className="input-os" type="number" min="0" value={ndMonto} onChange={(e) => setNdMonto(e.target.value)} />
                </label>
                <label className="block">
                  <span className="block text-xs uppercase tracking-widest text-muted mb-1">Motivo</span>
                  <input className="input-os" value={ndMotivo} onChange={(e) => setNdMotivo(e.target.value)} placeholder="Intereses por mora, gastos..." />
                </label>
              </>
            ) : (
              <p className="text-sm">La venta no tiene cliente con cuenta corriente: la nota de debito necesita una ficha para asentar el cargo.</p>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}
