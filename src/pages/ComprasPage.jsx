// BookOS - ComprasPage.jsx
// ruta: bookos/frontend/src/pages/ComprasPage.jsx
// descripcion: ingreso de compras a proveedores (candado FIFE firme/consigna),
//   historial/anulacion + pedido a proveedor (bookerp) en modal. El pedido no
//   afecta stock hasta confirmarse (al confirmar genera la compra).
//   FACTURA_GENERICA: la factura del proveedor cuando el ingreso ya se hizo por
//   remito: asienta la deuda en la CC y NO mueve stock (el caso espejo del remito, que
//   mueve stock y no asienta deuda). Carga de renglones por buscador, Importar CSV
//   (codigo;cantidad;precio;descuento) o Cargar documento (recuperables, con liquidaciones).

import { useEffect, useState } from 'react';
import Table from '../ui/Table';
import TablaItemsPaginada from '../ui/TablaItemsPaginada';
import Input from '../ui/Input';
import Modal from '../ui/Modal';
import DebugTag from '../ui/DebugTag';
import BuscadorArticuloBlock from '../blocks/BuscadorArticuloBlock';
import CargarDocumentoBlock from '../blocks/CargarDocumentoBlock';
import ImportarCsvBlock from '../blocks/ImportarCsvBlock';
import Paginador from '../ui/Paginador';
import { descargarCsv, descargarDesdeServidor } from '../utils/exportar';
import SelectBuscador from '../ui/SelectBuscador';
import { buscarProveedores } from '../utils/selectores';
import { comprasApi, observacionesApi, pedidosProveedorApi } from '../api/api';
import usePersistentWork from '../hooks/usePersistentWork';
import { useAppContext } from '../AppContext';
import BotonSecretario from '../ui/BotonSecretario';
import BorradorRestaurado from '../ui/BorradorRestaurado';

// El remito de proveedor tiene su propia vista ("Remitos"): aca no se ofrece como tipo
// para que exista UN solo flujo (decision del vectorHumano: "que haya dos formas de hacer
// un remito es una confusion").
const TIPOS = [
  ['FACTURA', 'FACTURA — mueve stock'],
  ['FACTURA_CONSIGNA', 'FACTURA_CONSIGNA — mueve stock'],
  ['FACTURA_GENERICA', 'FACTURA_GENERICA — solo CC (no mueve stock)'],
  ['NOTA_CREDITO', 'NOTA_CREDITO — solo CC'],
];
// Comprobantes que NO mueven stock (gestionan deuda, no mercaderia).
const SIN_STOCK = ['FACTURA_GENERICA', 'NOTA_CREDITO'];

export default function ComprasPage() {
  const [provNombre, setProvNombre] = useState('');
  const [provPedidoNombre, setProvPedidoNombre] = useState('');
  const [compras, setCompras] = useState([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [pedidos, setPedidos] = useState([]);
  // El stock que ingresa NO se elige: lo determina el TIPO de comprobante (practica [29]: una sola
  // fuente de verdad). FACTURA_CONSIGNA entra en consigna; el resto, firme; los financieros no mueven.
  const [borrador, setBorrador, limpiarBorrador, restaurado] = usePersistentWork('compra', { proveedorId: '', tipoComprobante: 'FACTURA', nroComprobante: '', fechaEmision: '', fechaVencimiento: '', descuentoGlobal: 0, observaciones: '', items: [] });
  // Espejo del mapa del servicio (compra.service.STOCK_POR_TIPO): el stock lo determina el TIPO de
  // comprobante (practica [29]) y aca solo se MUESTRA lo que el backend va a hacer.
  const STOCK_POR_TIPO = { FACTURA: 'FIRME', FACTURA_FIRME: 'FIRME', FACTURA_CONSIGNA: 'CONSIGNA', REMITO: 'CONSIGNA', LIQUIDACION: 'FIRME' };
  const stockAfectado = STOCK_POR_TIPO[borrador.tipoComprobante] || 'FIRME';
  const [ean, setEan] = useState('');
  const [cantidad, setCantidad] = useState('');
  const [precio, setPrecio] = useState('');
  const [descLinea, setDescLinea] = useState('');
  const [mensaje, setMensaje] = useState('');
  const [observacion, setObservacion] = useState(null);
  const [detalle, setDetalle] = useState(null);

  // Pedido a proveedor (modal)
  const [pedidoModal, setPedidoModal] = useState(false);
  const [pedido, setPedido] = useState({ proveedorId: '', tipoStockAfectado: 'FIRME', observaciones: '', items: [] });
  const [pedidoEan, setPedidoEan] = useState('');
  const [pedidoCantidad, setPedidoCantidad] = useState('');
  const [pedidoPrecio, setPedidoPrecio] = useState('');

  const { setContextoActual, pedirConsulta } = useAppContext();

  const observar = async (id) => {
    try {
      const res = await observacionesApi.documento({ tipo: 'compra', id });
      setObservacion(res.data);
      setMensaje('Observación del Secretario generada ✓');
    } catch (err) { setMensaje(`⚠️ ${err.message}`); }
  };

  const cargar = async (p = page) => {
    try {
      const [comp, ped] = await Promise.all([
        comprasApi.listar({ page: p, limit: 30 }),
        pedidosProveedorApi.listar({ page: 1, limit: 30 }),
      ]);
      setCompras(comp.data || []);
      setTotal(comp.pagination ? comp.pagination.total : (comp.data || []).length);
      setPedidos(ped.data || []);
    } catch (err) { setMensaje(`⚠️ ${err.message}`); }
  };

  useEffect(() => { cargar(page); }, [page]); // eslint-disable-line

  const agregarItem = () => {
    if (!ean || !cantidad) return;
    setBorrador({ ...borrador, items: [...borrador.items, { ean13: ean, cantidad: Number(cantidad), precioUnitario: precio ? Number(precio) : 0, descuento: descLinea ? Number(descLinea) : 0 }] });
    setEan(''); setCantidad(''); setPrecio(''); setDescLinea('');
  };

  // Importar CSV (codigo;cantidad;precio;descuento): carga rapida de renglones al documento.
  const importarItemsCsv = (filas) => {
    const nuevos = (filas || [])
      .filter((f) => (f.ean13 || f.codigo) && Number(f.cantidad) > 0)
      .map((f) => ({
        ean13: String(f.ean13 || f.codigo),
        titulo: f.titulo || '',
        cantidad: Number(f.cantidad),
        precioUnitario: Number(f.precio ?? f.costo ?? 0) || 0,
        descuento: Number(f.descuento ?? 0) || 0,
      }));
    if (!nuevos.length) { setMensaje('⚠️ El CSV no trajo renglones con código y cantidad'); return; }
    setBorrador((b) => ({ ...b, items: [...b.items, ...nuevos] }));
    setMensaje(`Cargados ${nuevos.length} renglones del CSV ✓`);
  };

  // Subtotal por renglon y totales del comprobante (con descuento global).
  const subtotalLinea = (it) => (Number(it.cantidad) || 0) * (Number(it.precioUnitario) || 0) * (1 - (Number(it.descuento) || 0) / 100);
  const subtotalCompra = borrador.items.reduce((a, it) => a + subtotalLinea(it), 0);
  const dgCompra = Math.min(Math.max(Number(borrador.descuentoGlobal) || 0, 0), 100);
  const totalCompra = dgCompra ? subtotalCompra - subtotalCompra * (dgCompra / 100) : subtotalCompra;

  const crear = async () => {
    try {
      const res = await comprasApi.crear({
        proveedorId: borrador.proveedorId ? Number(borrador.proveedorId) : null,
        tipoComprobante: borrador.tipoComprobante,
        nroComprobante: borrador.nroComprobante || null,
        fechaEmision: borrador.fechaEmision || null,
        fechaVencimiento: borrador.fechaVencimiento || null,
        descuentoGlobal: dgCompra,
        observaciones: borrador.observaciones || null,
        items: borrador.items,
      });
      setMensaje(`Compra #${res.data.compraId} por $${Number(res.data.importeTotal).toLocaleString('es-AR')} ✓ ${SIN_STOCK.includes(borrador.tipoComprobante) ? '(solo cuenta corriente: no mueve stock)' : `(stock ${stockAfectado} actualizado)`}`);
      setBorrador({ proveedorId: '', tipoComprobante: 'FACTURA', nroComprobante: '', fechaEmision: '', fechaVencimiento: '', descuentoGlobal: 0, observaciones: '', items: [] });
      cargar();
    } catch (err) { setMensaje(`⚠️ ${err.message}`); }
  };

  const anular = async (id) => {
    try {
      await comprasApi.anular(id);
      setMensaje(`Compra #${id} anulada (stock revertido) ✓`);
      cargar();
    } catch (err) { setMensaje(`⚠️ ${err.message}`); }
  };

  // E14: descarga por documento — CSV/PDF al storage y mail con adjuntos (MODO PRUEBA si esta activo).
  const descargarCompra = async (c, formato) => {
    try {
      const res = await comprasApi[formato](c.id);
      const d = res.data || {};
      await descargarDesdeServidor(`/archivos/${d.archivoId}/descarga`, d.nombre);
      setMensaje(`${d.nombre} descargado ✓`);
    } catch (err) { setMensaje(`⚠️ ${err.message}`); }
  };

  const enviarCompraMail = async (c) => {
    try {
      const res = await comprasApi.mail(c.id);
      const d = res.data || {};
      setMensaje(d.enviado
        ? `Comprobante enviado a ${d.a || 'el proveedor'}${d.redirigido ? ' (MODO PRUEBA)' : ''} ✓`
        : `⚠️ No se pudo enviar: ${d.motivo || 'sin configurar'}`);
    } catch (err) { setMensaje(`⚠️ ${err.message}`); }
  };

  // Detalle de compra (bookerp: cabecera + renglones + export). El "Ver" inyecta el contexto al Secretario.
  const verCompra = async (id) => {
    try {
      const res = await comprasApi.obtener(id);
      const compra = res.data || res;
      setDetalle(compra);
      setContextoActual({ compraId: compra.id, tipo: compra.tipoComprobante, items: compra.items });
    } catch (err) { setMensaje(`⚠️ ${err.message}`); }
  };

  const exportarDetalle = (compra) => {
    descargarCsv(`compra-${compra.id}`, [
      { titulo: 'Titulo', clave: 'descripcion' },
      { titulo: 'Cantidad', clave: 'cantidad' },
      { titulo: 'Precio', clave: 'precioUnitario' },
      { titulo: 'Descuento', clave: 'descuentoLinea' },
      { titulo: 'Subtotal', clave: 'subtotal' },
    ], compra.items || []);
  };

  // ---- Pedido a proveedor (bookerp: no afecta stock hasta confirmar) ---------

  const abrirPedido = () => {
    setPedido({ proveedorId: '', tipoStockAfectado: 'FIRME', observaciones: '', items: [] });
    setPedidoEan(''); setPedidoCantidad(''); setPedidoPrecio('');
    setPedidoModal(true);
  };

  const seleccionarLibro = (libro) => {
    if (pedido.items.find((d) => d.ean13 === libro.ean13)) return;
    setPedido({ ...pedido, items: [...pedido.items, { ean13: libro.ean13, titulo: libro.titulo, cantidad: 1, precioUnitario: Number(libro.precio || 0) }] });
  };

  const agregarPedidoItem = () => {
    if (!pedidoEan || !pedidoCantidad) return;
    setPedido({ ...pedido, items: [...pedido.items, { ean13: pedidoEan, titulo: '', cantidad: Number(pedidoCantidad), precioUnitario: pedidoPrecio ? Number(pedidoPrecio) : 0 }] });
    setPedidoEan(''); setPedidoCantidad(''); setPedidoPrecio('');
  };

  const quitarPedidoItem = (i) => setPedido({ ...pedido, items: pedido.items.filter((_, idx) => idx !== i) });

  const pedidoTotal = () => pedido.items.reduce((a, it) => a + Number(it.cantidad) * Number(it.precioUnitario), 0);

  const crearPedido = async () => {
    if (!pedido.proveedorId) { setMensaje('⚠️ Seleccione un proveedor'); return; }
    if (pedido.items.length === 0) { setMensaje('⚠️ El pedido necesita al menos un item'); return; }
    try {
      await pedidosProveedorApi.crear({
        proveedorId: Number(pedido.proveedorId),
        tipoStockAfectado: pedido.tipoStockAfectado,
        observaciones: pedido.observaciones,
        items: pedido.items,
      });
      setMensaje('Pedido a proveedor creado ✓ (pendiente, no afecta stock)');
      setPedidoModal(false);
      cargar();
    } catch (err) { setMensaje(`⚠️ ${err.message}`); }
  };

  const confirmarPedido = async (id) => {
    if (!window.confirm('¿Confirmar este pedido? Genera la compra y recién ahí afecta el stock.')) return;
    try {
      const res = await pedidosProveedorApi.confirmar(id);
      setMensaje(`Pedido #${id} confirmado → Compra #${res.data.compraId} ✓`);
      cargar();
    } catch (err) { setMensaje(`⚠️ ${err.message}`); }
  };

  const anularPedido = async (id) => {
    try {
      await pedidosProveedorApi.anular(id);
      setMensaje(`Pedido #${id} anulado ✓`);
      cargar();
    } catch (err) { setMensaje(`⚠️ ${err.message}`); }
  };

  const columnas = [
    { clave: 'id', titulo: 'ID' },
    { clave: 'tipoComprobante', titulo: 'Comprobante' },
    { clave: 'importeTotal', titulo: 'Importe', render: (c) => `$${Number(c.importeTotal).toLocaleString('es-AR')}` },
    { clave: 'estado', titulo: 'Estado' },
    { clave: 'acciones', titulo: '', render: (c) => (
      <div className="flex gap-2">
        <button type="button" className="btn btn-ghost text-xs" onClick={() => verCompra(c.id)}>Ver</button>
        <button type="button" className="btn btn-ghost text-xs" onClick={() => descargarCompra(c, 'csv')}>CSV</button>
        <button type="button" className="btn btn-ghost text-xs" onClick={() => descargarCompra(c, 'pdf')}>PDF</button>
        <button type="button" className="btn btn-ghost text-xs" onClick={() => enviarCompraMail(c)}>Mail</button>
        <button type="button" className="btn btn-ghost text-xs" onClick={() => observar(c.id)}>🧠</button>
        {c.estado !== 'ANULADA' && <button type="button" className="btn btn-ghost text-xs" style={{ color: 'var(--danger)' }} onClick={() => anular(c.id)}>Anular</button>}
      </div>
    ) },
  ];

  const columnasDetalle = [
    { clave: 'descripcion', titulo: 'Titulo' },
    { clave: 'cantidad', titulo: 'Cantidad' },
    { clave: 'precioUnitario', titulo: 'Precio', render: (i) => `$${Number(i.precioUnitario).toLocaleString('es-AR')}` },
    { clave: 'descuentoLinea', titulo: 'Desc.', render: (i) => (Number(i.descuentoLinea) ? `$${Number(i.descuentoLinea).toLocaleString('es-AR')}` : '') },
    { clave: 'subtotal', titulo: 'Subtotal', render: (i) => `$${Number(i.subtotal).toLocaleString('es-AR')}` },
  ];

  const columnasPedidos = [
    { clave: 'id', titulo: 'ID' },
    { clave: 'estado', titulo: 'Estado' },
    { clave: 'total', titulo: 'Total', render: (p) => `$${Number(p.total).toLocaleString('es-AR')}` },
    { clave: 'tipoStockAfectado', titulo: 'Stock' },
    { clave: 'items', titulo: 'Items', render: (p) => (p.items || []).length },
    { clave: 'acciones', titulo: '', render: (p) => (
      <div className="flex gap-2">
        {p.estado === 'PENDIENTE' && (
          <>
            <button type="button" className="btn btn-ghost text-xs" onClick={() => confirmarPedido(p.id)}>Confirmar</button>
            <button type="button" className="btn btn-ghost text-xs" style={{ color: 'var(--danger)' }} onClick={() => anularPedido(p.id)}>Anular</button>
          </>
        )}
      </div>
    ) },
  ];

  return (
    <div>
      <DebugTag nombre="ComprasPage" />
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold">Compras</h2>
        <div className="flex gap-2">
          <button type="button" className="btn btn-primary" onClick={abrirPedido}>Pedido a proveedor</button>
          <BorradorRestaurado visible={restaurado} onLimpiar={limpiarBorrador} />
          <BotonSecretario consulta="Dame un resumen de compras de los ultimos 30 dias." />
        </div>
      </div>
      {mensaje && <p className="text-sm mb-3">{mensaje}</p>}

      <div className="card p-4 mb-4">
        <h3 className="font-semibold mb-3">Nueva compra</h3>
        <div className="flex gap-2 flex-wrap mb-3">
          <div style={{ minWidth: 240 }}>
            <SelectBuscador
              valor={borrador.proveedorId || null}
              etiquetaValor={provNombre}
              placeholder="Buscar proveedor..."
              buscar={buscarProveedores}
              onSeleccionar={(it) => { setBorrador({ ...borrador, proveedorId: it ? it.id : '' }); setProvNombre(it ? it.etiqueta : ''); }}
            />
          </div>
          <select className="input-os" style={{ maxWidth: 180 }} value={borrador.tipoComprobante} onChange={(e) => setBorrador({ ...borrador, tipoComprobante: e.target.value })}>
            {TIPOS.map(([valor, etiqueta]) => <option key={valor} value={valor}>{etiqueta}</option>)}
          </select>
          <span className="input-os text-xs flex items-center" style={{ maxWidth: 120 }} title="Lo determina el tipo de comprobante">Stock: {stockAfectado}</span>
          <input className="input-os" style={{ maxWidth: 150 }} placeholder="Nro comprobante" value={borrador.nroComprobante} onChange={(e) => setBorrador({ ...borrador, nroComprobante: e.target.value })} />
          <label className="flex items-center gap-1 text-xs text-muted">
            Fecha emision
            <input className="input-os" type="date" style={{ maxWidth: 150 }} value={borrador.fechaEmision} onChange={(e) => setBorrador({ ...borrador, fechaEmision: e.target.value })} />
          </label>
          <label className="flex items-center gap-1 text-xs text-muted">
            Vencimiento
            <input className="input-os" type="date" style={{ maxWidth: 150 }} value={borrador.fechaVencimiento} onChange={(e) => setBorrador({ ...borrador, fechaVencimiento: e.target.value })} />
          </label>
          <label className="flex items-center gap-1 text-xs text-muted">
            Desc. global %
            <input className="input-os" type="number" min="0" max="100" style={{ maxWidth: 90 }} value={borrador.descuentoGlobal} onChange={(e) => setBorrador({ ...borrador, descuentoGlobal: Number(e.target.value) || 0 })} />
          </label>
        </div>
        <input className="input-os mb-3" placeholder="Observaciones (opcional)" value={borrador.observaciones} onChange={(e) => setBorrador({ ...borrador, observaciones: e.target.value })} />
        <div className="mb-3">
          <BuscadorArticuloBlock
            etiqueta="Buscar libro para la compra"
            onSeleccionar={(a) => setBorrador({ ...borrador, items: [...borrador.items, { ean13: a.ean13, titulo: a.titulo, cantidad: 1, precioUnitario: 0 }] })}
          />
        </div>
        <div className="mb-3 flex items-center gap-2 flex-wrap">
          <ImportarCsvBlock etiqueta="Importar CSV" onCargar={importarItemsCsv} />
          <CargarDocumentoBlock
            etiqueta="Cargar remito / pedido / compra"
            proveedorId={borrador.proveedorId ? Number(borrador.proveedorId) : null}
            onCargar={(items, meta) => {
              const nuevos = (items || []).filter((i) => i.ean13).map((i) => ({ ean13: i.ean13, titulo: i.titulo, cantidad: i.cantidad, precioUnitario: Number(i.costo) || 0 }));
              const salteados = (items || []).length - nuevos.length;
              setBorrador((b) => ({
                ...b,
                proveedorId: b.proveedorId || (meta.proveedorId ? String(meta.proveedorId) : ''),
                items: [...b.items, ...nuevos],
              }));
              setMensaje(`Cargados ${nuevos.length} renglones de ${meta.tipo} #${meta.id} ✓${salteados ? ` (${salteados} sin codigo, salteados)` : ''}`);
            }}
          />
          <span className="text-xs text-muted">CSV: código;cantidad;precio;descuento (las columnas de más se ignoran)</span>
        </div>
        <div className="flex gap-2 mb-3">
          <input className="input-os" placeholder="EAN13" value={ean} onChange={(e) => setEan(e.target.value)} />
          <input className="input-os" placeholder="Cantidad" type="number" style={{ maxWidth: 100 }} value={cantidad} onChange={(e) => setCantidad(e.target.value)} />
          <input className="input-os" placeholder="Precio unit." type="number" style={{ maxWidth: 120 }} value={precio} onChange={(e) => setPrecio(e.target.value)} />
          <input className="input-os" placeholder="Desc. %" type="number" min="0" max="100" style={{ maxWidth: 90 }} value={descLinea} onChange={(e) => setDescLinea(e.target.value)} />
          <button type="button" className="btn" onClick={agregarItem}>Agregar</button>
        </div>
        {borrador.items.map((item, i) => (
          <div key={`${item.ean13}-${i}`} className="text-sm py-1 flex items-center gap-2">
            <span className="font-mono text-xs flex-1 truncate">{item.ean13} <span className="text-muted">{item.titulo || ''}</span></span>
            <input
              className="input-os"
              style={{ maxWidth: 90 }}
              type="number"
              min="1"
              title="Cantidad"
              value={item.cantidad}
              onChange={(e) => setBorrador({ ...borrador, items: borrador.items.map((x, idx) => (idx === i ? { ...x, cantidad: Number(e.target.value) || 0 } : x)) })}
            />
            <input
              className="input-os"
              style={{ maxWidth: 130 }}
              type="number"
              min="0"
              title="Precio unitario"
              value={item.precioUnitario}
              onChange={(e) => setBorrador({ ...borrador, items: borrador.items.map((x, idx) => (idx === i ? { ...x, precioUnitario: Number(e.target.value) || 0 } : x)) })}
            />
            <input
              className="input-os"
              style={{ maxWidth: 80 }}
              type="number"
              min="0"
              max="100"
              title="Descuento por linea %"
              value={item.descuento || 0}
              onChange={(e) => setBorrador({ ...borrador, items: borrador.items.map((x, idx) => (idx === i ? { ...x, descuento: Number(e.target.value) || 0 } : x)) })}
            />
            <span className="text-xs font-mono" style={{ minWidth: 90, textAlign: 'right' }}>${subtotalLinea(item).toLocaleString('es-AR')}</span>
            <button type="button" className="btn btn-ghost text-xs" style={{ color: 'var(--danger)' }} onClick={() => setBorrador({ ...borrador, items: borrador.items.filter((_, idx) => idx !== i) })}>✕</button>
          </div>
        ))}
        <div className="flex justify-end gap-4 text-sm mt-3 pt-3" style={{ borderTop: '1px solid var(--border)' }}>
          <span>Subtotal: <strong>${subtotalCompra.toLocaleString('es-AR')}</strong></span>
          <span>Descuento {dgCompra ? `(${dgCompra}%)` : ''}: <strong>-${(subtotalCompra - totalCompra).toLocaleString('es-AR')}</strong></span>
          <span className="font-semibold">Total: <strong>${totalCompra.toLocaleString('es-AR')}</strong></span>
        </div>
        <button type="button" className="btn btn-primary mt-3" disabled={borrador.items.length === 0} onClick={crear}>Guardar compra</button>
        <p className="text-xs text-muted mt-2">Candado FIFE: FACTURA firme no afecta CONSIGNA · FACTURA_CONSIGNA no suma FIRME. FACTURA_GENERICA y NOTA_CREDITO no mueven stock: FACTURA_GENERICA se usa cuando el ingreso ya se hizo por remito (solo asienta la deuda en la CC).</p>
      </div>

      {observacion && (
        <div className="card p-3 mb-4" style={{ borderLeft: '3px solid var(--accent)' }}>
          <div className="text-xs uppercase tracking-widest text-muted mb-1">Observación del Secretario</div>
          <p className="text-sm">{observacion.observacion}</p>
        </div>
      )}

      <h3 className="font-semibold mb-2">Pedidos a proveedor</h3>
      <Table columnas={columnasPedidos} filas={pedidos} vacio="Sin pedidos a proveedor" />

      <h3 className="font-semibold mb-2 mt-5">Historial de compras</h3>
      <Table columnas={columnas} filas={compras} vacio="Sin compras" />
      <Paginador page={page} total={total} limite={30} onCambiar={setPage} etiqueta="compras" />

      <Modal
        abierto={pedidoModal}
        onClose={() => setPedidoModal(false)}
        titulo="Pedido a proveedor"
        ancho="760px"
        footer={
          <>
            <button type="button" className="btn btn-ghost" onClick={() => setPedidoModal(false)}>Cancelar</button>
            <button type="button" className="btn btn-primary" disabled={!pedido.proveedorId || pedido.items.length === 0} onClick={crearPedido}>Guardar pedido</button>
          </>
        }
      >
        <div className="flex gap-2 flex-wrap mb-3">
          <div style={{ minWidth: 260 }}>
            <SelectBuscador
              valor={pedido.proveedorId || null}
              etiquetaValor={provPedidoNombre}
              placeholder="Buscar proveedor..."
              buscar={buscarProveedores}
              onSeleccionar={(it) => { setPedido({ ...pedido, proveedorId: it ? it.id : '' }); setProvPedidoNombre(it ? it.etiqueta : ''); }}
            />
          </div>
          <select className="input-os" style={{ maxWidth: 140 }} value={pedido.tipoStockAfectado} onChange={(e) => setPedido({ ...pedido, tipoStockAfectado: e.target.value })}>
            <option value="FIRME">FIRME</option>
            <option value="CONSIGNA">CONSIGNA</option>
          </select>
        </div>

        <div className="mb-3">
          <BuscadorArticuloBlock etiqueta="Buscar libro para el pedido" onSeleccionar={seleccionarLibro} />
        </div>

        <div className="flex gap-2 mb-3">
          <input className="input-os" placeholder="EAN13 (manual)" value={pedidoEan} onChange={(e) => setPedidoEan(e.target.value)} />
          <input className="input-os" placeholder="Cantidad" type="number" style={{ maxWidth: 100 }} value={pedidoCantidad} onChange={(e) => setPedidoCantidad(e.target.value)} />
          <input className="input-os" placeholder="Precio unit." type="number" style={{ maxWidth: 120 }} value={pedidoPrecio} onChange={(e) => setPedidoPrecio(e.target.value)} />
          <button type="button" className="btn" onClick={agregarPedidoItem}>Agregar</button>
        </div>

        {pedido.items.map((item, i) => (
          <div key={`${item.ean13}-${i}`} className="text-sm py-1 flex justify-between items-center">
            <span className="font-mono">{item.ean13}</span>
            <span className="flex-1 px-3 truncate">{item.titulo}</span>
            <span>{item.cantidad} u × ${Number(item.precioUnitario).toLocaleString('es-AR')}</span>
            <button type="button" className="btn btn-ghost text-xs" style={{ color: 'var(--danger)' }} onClick={() => quitarPedidoItem(i)}>✕</button>
          </div>
        ))}

        <div className="flex justify-between items-center mt-3 pt-3" style={{ borderTop: '1px solid var(--border)' }}>
          <Input label="Observaciones" value={pedido.observaciones} onChange={(e) => setPedido({ ...pedido, observaciones: e.target.value })} />
          <div className="text-right">
            <div className="text-xs text-muted">Total</div>
            <div className="font-semibold">${pedidoTotal().toLocaleString('es-AR')}</div>
          </div>
        </div>
        <p className="text-xs text-muted mt-2">El pedido queda PENDIENTE y no afecta stock. Al confirmarlo se genera la compra (candado FIFE).</p>
      </Modal>

      <Modal
        abierto={Boolean(detalle)}
        onClose={() => setDetalle(null)}
        titulo={detalle ? `Compra #${detalle.id} - ${detalle.tipoComprobante}` : 'Compra'}
        ancho="820px"
        footer={
          detalle ? (
            <div className="flex gap-2">
              <button type="button" className="btn btn-ghost" onClick={() => exportarDetalle(detalle)}>Exportar CSV</button>
              <BotonSecretario consulta={`Resumime la compra #${detalle.id}${detalle.proveedor ? ` de ${detalle.proveedor.nombre}` : ''}.`} />
              {detalle.estado !== 'ANULADA' && (
                <button type="button" className="btn btn-ghost" style={{ color: 'var(--danger)' }} onClick={() => { anular(detalle.id); setDetalle(null); }}>Anular</button>
              )}
              <button type="button" className="btn btn-primary" onClick={() => setDetalle(null)}>Cerrar</button>
            </div>
          ) : null
        }
      >
        {detalle && (
          <>
            <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-sm mb-4">
              <div><span className="text-muted">Proveedor: </span>{detalle.proveedor ? detalle.proveedor.nombre : '-'}</div>
              <div><span className="text-muted">Fecha de emision: </span>{new Date(detalle.fechaEmision).toLocaleDateString('es-AR')}</div>
              <div><span className="text-muted">Nro de comprobante: </span>{detalle.nroComprobante || '-'}</div>
              <div><span className="text-muted">Estado: </span>{detalle.estado}</div>
              <div><span className="text-muted">Stock afectado: </span>{detalle.tipoStockAfectado}</div>
              <div><span className="text-muted">Descuento global: </span>${Number(detalle.descuentoGlobal || 0).toLocaleString('es-AR')}</div>
              {detalle.observaciones && <div className="col-span-2"><span className="text-muted">Observaciones: </span>{detalle.observaciones}</div>}
            </div>
            <TablaItemsPaginada
              items={detalle.items || []}
              headers={columnasDetalle.map((c) => <th key={c.clave}>{c.titulo}</th>)}
              fila={(it, idx) => (
                <tr key={idx}>
                  {columnasDetalle.map((c) => <td key={c.clave}>{c.render ? c.render(it) : it[c.clave]}</td>)}
                </tr>
              )}
              vacio="Sin renglones"
            />
            <div className="text-right mt-3 text-sm">
              Total: <strong>${Number(detalle.importeTotal).toLocaleString('es-AR')}</strong>
            </div>
          </>
        )}
      </Modal>
    </div>
  );
}
