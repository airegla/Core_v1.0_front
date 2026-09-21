// BookOS - RemitosPage.jsx
// ruta: bookos/frontend/src/pages/RemitosPage.jsx
// descripcion: ingreso de remitos en esquema "cabecera + tabla de items" + cruce
//   de faltantes. Interconectado con el Secretario: inyecta el borrador y escucha
//   instrucciones (refrescar, cruzar) para que el agente opere la vista.

import { useEffect, useState } from 'react';
import Table from '../ui/Table';
import Modal from '../ui/Modal';
import TablaItemsPaginada from '../ui/TablaItemsPaginada';
import DebugTag from '../ui/DebugTag';
import ItemsEditorBlock from '../blocks/ItemsEditorBlock';
import ImportarCsvBlock from '../blocks/ImportarCsvBlock';
import ImportarDocumentoBlock from '../blocks/ImportarDocumentoBlock';
import BuscadorArticuloBlock from '../blocks/BuscadorArticuloBlock';
import CargarDocumentoBlock from '../blocks/CargarDocumentoBlock';
import Paginador from '../ui/Paginador';
import SelectBuscador from '../ui/SelectBuscador';
import { buscarProveedores } from '../utils/selectores';
import { remitosApi } from '../api/api';
import { descargarDesdeServidor } from '../utils/exportar';
import { mapearFilas } from '../utils/csv';
import usePersistentWork from '../hooks/usePersistentWork';
import { useAppContext } from '../AppContext';
import BotonSecretario from '../ui/BotonSecretario';
import BorradorRestaurado from '../ui/BorradorRestaurado';

export default function RemitosPage() {
  const [remitos, setRemitos] = useState([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [borrador, setBorrador, limpiarBorrador, restaurado] = usePersistentWork('remito', { proveedor: '', numero: '', fecha: '', observaciones: '', tipoStockAfectado: 'CONSIGNA', items: [] });
  const [itemEan, setItemEan] = useState('');
  const [itemCantidad, setItemCantidad] = useState('');
  const [itemCosto, setItemCosto] = useState('');
  const [detalle, setDetalle] = useState(null);
  const [verRemito, setVerRemito] = useState(null);
  const [mensaje, setMensaje] = useState('');
  const { setContextoActual, pedirConsulta, instruccionVista } = useAppContext();

  const cargar = async (p = page) => {
    try {
      const res = await remitosApi.listar({ page: p, limit: 50 });
      setRemitos(res.data || []);
      setTotal(res.pagination ? res.pagination.total : (res.data || []).length);
    } catch (err) { setMensaje(`⚠️ ${err.message}`); }
  };

  useEffect(() => { cargar(page); }, [page]); // eslint-disable-line

  const setItems = (items) => setBorrador({ ...borrador, items });
  const setCampo = (campo, valor) => setBorrador({ ...borrador, [campo]: valor });

  const importarItems = (raw) => {
    const filas = mapearFilas(raw, ['ean13', 'titulo', 'cantidad', 'costo']);
    const nuevos = filas
      .filter((f) => f.ean13)
      .map((f) => ({ ean13: String(f.ean13), titulo: f.titulo || String(f.ean13), cantidad: Number(f.cantidad) || 1, costo: f.costo ? Number(f.costo) : null }));
    setItems([...borrador.items, ...nuevos]);
    if (nuevos.length) setMensaje(`Importados ${nuevos.length} items ✓`);
  };

  const importarDocumento = (list) => {
    const nuevos = list.filter((i) => i.ean13).map((i) => ({ ean13: i.ean13, titulo: i.titulo || i.ean13, cantidad: i.cantidad, costo: i.costo }));
    setItems([...borrador.items, ...nuevos]);
    if (nuevos.length) setMensaje(`Importados ${nuevos.length} libros del documento ✓`);
  };

  const agregarItem = () => {
    if (!itemEan || !itemCantidad) return;
    setItems([...borrador.items, {
      ean13: itemEan,
      titulo: itemEan,
      cantidad: Number(itemCantidad),
      costo: itemCosto ? Number(itemCosto) : null,
    }]);
    setItemEan(''); setItemCantidad(''); setItemCosto('');
  };

  const crear = async () => {
    try {
      const res = await remitosApi.crear({
        proveedor: borrador.proveedor,
        numero: borrador.numero || null,
        fecha: borrador.fecha || null,
        observaciones: borrador.observaciones || null,
        tipoStockAfectado: borrador.tipoStockAfectado || 'CONSIGNA',
        items: borrador.items,
      });
      setMensaje(`Remito #${res.data.id} creado ✓`);
      limpiarBorrador();
      cargar();
    } catch (err) { setMensaje(`⚠️ ${err.message}`); }
  };

  // Ingreso del remito: suma los libros al stock con la regla FIFE del tipo elegido.
  const confirmarIngreso = async (id) => {
    try {
      await remitosApi.confirmar(id);
      setMensaje(`Remito #${id} confirmado: stock ingresado ✓`);
      cargar();
    } catch (err) { setMensaje(`⚠️ ${err.message}`); }
  };

  const anularRem = async (id) => {
    if (!window.confirm(`¿Anular el remito #${id}? Se revierte el stock ingresado.`)) return;
    try {
      await remitosApi.anular(id);
      setMensaje(`Remito #${id} anulado ✓`);
      cargar();
    } catch (err) { setMensaje(`⚠️ ${err.message}`); }
  };

  const ver = (remito) => {
    setVerRemito(remito);
    setContextoActual({ remitoId: remito.id, items: remito.items, estado: remito.estado });
  };

  // E14: descarga por documento — CSV/PDF al storage y mail con adjuntos (MODO PRUEBA si esta activo).
  const descargarRemito = async (r, formato) => {
    try {
      const res = await remitosApi[formato](r.id);
      const d = res.data || {};
      await descargarDesdeServidor(`/archivos/${d.archivoId}/descarga`, d.nombre);
      setMensaje(`${d.nombre} descargado ✓`);
    } catch (err) { setMensaje(`⚠️ ${err.message}`); }
  };

  const enviarRemitoMail = async (r) => {
    try {
      const res = await remitosApi.mail(r.id);
      const d = res.data || {};
      setMensaje(d.enviado
        ? `Remito enviado a ${d.a || 'el proveedor'}${d.redirigido ? ' (MODO PRUEBA)' : ''} ✓`
        : `⚠️ No se pudo enviar: ${d.motivo || 'sin configurar'}`);
    } catch (err) { setMensaje(`⚠️ ${err.message}`); }
  };

  const cruzar = async (id) => {
    try {
      const res = await remitosApi.cruzar(id);
      setDetalle(res.data);
      setContextoActual({ remitoId: id, items: res.data.remito.items, faltantes: res.data.faltantes });
      cargar();
    } catch (err) { setMensaje(`⚠️ ${err.message}`); }
  };

  // El Secretario opera la vista: refrescar listado o mostrar cruce de faltantes.
  useEffect(() => {
    if (!instruccionVista || instruccionVista.dominio !== 'remitos') return;
    if (instruccionVista.accion === 'refrescar') {
      cargar();
      if (instruccionVista.mensaje) setMensaje(instruccionVista.mensaje);
    }
    if (instruccionVista.accion === 'cruzar' && instruccionVista.data) {
      setDetalle(instruccionVista.data);
    }
  }, [instruccionVista]); // eslint-disable-line

  // Inyecta el borrador al Secretario.
  useEffect(() => {
    setContextoActual({ vista: 'remitos', proveedor: borrador.proveedor, numero: borrador.numero, fecha: borrador.fecha, items: borrador.items });
  }, [borrador]); // eslint-disable-line

  const columnasItems = [
    { clave: 'ean13', titulo: 'EAN', editable: true, ancho: 130 },
    { clave: 'titulo', titulo: 'Titulo', editable: true, ancho: 260 },
    { clave: 'cantidad', titulo: 'Cant.', editable: true, tipo: 'number', ancho: 80 },
    { clave: 'costo', titulo: 'Costo', editable: true, tipo: 'number', ancho: 110 },
  ];

  const columnas = [
    { clave: 'id', titulo: 'ID' },
    { clave: 'numero', titulo: 'Nro', render: (r) => r.numero || '—' },
    // El listado devuelve el proveedor como objeto {id, nombre}: render explicito (antes crasheaba el <td>).
    { clave: 'proveedor', titulo: 'Proveedor', render: (r) => (r.proveedor ? r.proveedor.nombre : '—'), valorExport: (r) => (r.proveedor ? r.proveedor.nombre : '') },
    { clave: 'tipoStockAfectado', titulo: 'Ingreso', render: (r) => <span className="agente-badge">{r.tipoStockAfectado || 'CONSIGNA'}</span> },
    { clave: 'fecha', titulo: 'Fecha', render: (r) => (r.fecha ? new Date(r.fecha).toLocaleDateString('es-AR') : '—') },
    { clave: 'estado', titulo: 'Estado' },
    { clave: 'acciones', titulo: '', render: (r) => (
      <div className="flex gap-2">
        <button type="button" className="btn btn-ghost text-xs" onClick={() => ver(r)}>Ver</button>
        <button type="button" className="btn btn-ghost text-xs" onClick={() => descargarRemito(r, 'csv')}>CSV</button>
        <button type="button" className="btn btn-ghost text-xs" onClick={() => descargarRemito(r, 'pdf')}>PDF</button>
        <button type="button" className="btn btn-ghost text-xs" onClick={() => enviarRemitoMail(r)}>Mail</button>
        <button type="button" className="btn btn-ghost text-xs" onClick={() => cruzar(r.id)}>Cruzar faltantes</button>
        {(r.estado === 'pendiente' || r.estado === 'cruzado') && (
          <button type="button" className="btn btn-primary text-xs" onClick={() => confirmarIngreso(r.id)}>Confirmar ingreso</button>
        )}
        {r.estado === 'ingresado' && (
          <button type="button" className="btn btn-ghost text-xs" style={{ color: 'var(--danger)' }} onClick={() => anularRem(r.id)}>Anular</button>
        )}
      </div>
    ) },
  ];

  return (
    <div>
      <DebugTag nombre="RemitosPage" />
      <h2 className="text-lg font-semibold mb-4">Remitos</h2>

      {mensaje && <p className="text-sm mb-3">{mensaje}</p>}

      {/* CABECERA */}
      <div className="card p-4 mb-4">
        <div className="flex items-end justify-between mb-3">
          <h3 className="font-semibold">Cabecera del remito</h3>
          <BorradorRestaurado visible={restaurado} onLimpiar={limpiarBorrador} />
          <BotonSecretario
            className="btn btn-ghost text-xs"
            consulta={`Estoy armando un remito para ${borrador.proveedor || 'un proveedor'} con ${borrador.items.length} items. ¿Que me falta pedir?`}
          />
        </div>
        <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))' }}>
          <label className="block">
            <span className="block text-xs uppercase tracking-widest text-muted mb-1">Proveedor</span>
            <SelectBuscador
              textoInicial={borrador.proveedor || ''}
              placeholder="Buscar o escribir proveedor..."
              buscar={buscarProveedores}
              onTexto={(texto) => setCampo('proveedor', texto)}
              onSeleccionar={(it) => setCampo('proveedor', it ? it.etiqueta : '')}
            />
          </label>
          <label className="block">
            <span className="block text-xs uppercase tracking-widest text-muted mb-1">Número de remito</span>
            <input className="input-os" placeholder="Nro del comprobante" value={borrador.numero} onChange={(e) => setCampo('numero', e.target.value)} />
          </label>
          <label className="block">
            <span className="block text-xs uppercase tracking-widest text-muted mb-1">Fecha</span>
            <input className="input-os" type="date" value={borrador.fecha} onChange={(e) => setCampo('fecha', e.target.value)} />
          </label>
          <label className="block">
            <span className="block text-xs uppercase tracking-widest text-muted mb-1">Tipo de ingreso (FIFE)</span>
            <select className="input-os" value={borrador.tipoStockAfectado || 'CONSIGNA'} onChange={(e) => setCampo('tipoStockAfectado', e.target.value)}>
              <option value="CONSIGNA">Consigna (actual + original)</option>
              <option value="FIRME">Firme (stock propio)</option>
            </select>
          </label>
          <label className="block">
            <span className="block text-xs uppercase tracking-widest text-muted mb-1">Observaciones</span>
            <input className="input-os" placeholder="Observaciones (opc.)" value={borrador.observaciones} onChange={(e) => setCampo('observaciones', e.target.value)} />
          </label>
        </div>
        <p className="text-xs text-muted mt-2">El remito <strong>nunca genera deuda</strong>: solo mueve los libros y se valoriza (el costo por línea alimenta la rentabilidad). La deuda nace con la factura del proveedor.</p>
      </div>

      {/* TABLA DE ITEMS */}
      <div className="card p-4 mb-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold">Items ({borrador.items.length})</h3>
          <div className="flex items-center gap-2">
            <ImportarCsvBlock etiqueta="Importar CSV" onCargar={importarItems} />
            <ImportarDocumentoBlock onCargar={importarDocumento} />
            <span className="text-xs text-muted">Editable en linea · persiste al navegar</span>
          </div>
        </div>
        <div className="mb-3">
          <BuscadorArticuloBlock
            etiqueta="Buscar libro para el remito"
            onSeleccionar={(a) => setItems([...borrador.items, { ean13: a.ean13, titulo: a.titulo, cantidad: 1, costo: null }])}
          />
        </div>
        <div className="mb-3">
          <CargarDocumentoBlock
            etiqueta="Cargar pedido / compra"
            onCargar={(items, meta) => {
              const nuevos = (items || []).filter((i) => i.ean13).map((i) => ({ ean13: i.ean13, titulo: i.titulo, cantidad: i.cantidad, costo: i.costo }));
              setItems([...borrador.items, ...nuevos]);
              setMensaje(`Cargados ${nuevos.length} renglones de ${meta.tipo} #${meta.id} ✓`);
            }}
          />
        </div>
        <div className="flex gap-2 mb-3">
          <input className="input-os" placeholder="EAN13" value={itemEan} onChange={(e) => setItemEan(e.target.value)} />
          <input className="input-os" placeholder="Cantidad" type="number" value={itemCantidad} onChange={(e) => setItemCantidad(e.target.value)} style={{ maxWidth: 100 }} />
          <input className="input-os" placeholder="Costo (opc.)" type="number" value={itemCosto} onChange={(e) => setItemCosto(e.target.value)} style={{ maxWidth: 120 }} />
          <button type="button" className="btn" onClick={agregarItem}>Agregar</button>
        </div>
        <ItemsEditorBlock
          items={borrador.items}
          onChange={setItems}
          onRemove={(i) => setItems(borrador.items.filter((_, idx) => idx !== i))}
          columnas={columnasItems}
          vacio="Agrega items con EAN + cantidad (o pediselo al Secretario)"
        />
        <div className="flex justify-end mt-3">
          <button type="button" className="btn btn-primary" disabled={!borrador.proveedor || borrador.items.length === 0} onClick={crear}>
            Guardar remito
          </button>
        </div>
      </div>

      <Table columnas={columnas} filas={remitos} vacio="Sin remitos" exportable exportarNombre="remitos" />
      <Paginador page={page} total={total} limite={50} onCambiar={setPage} etiqueta="remitos" />

      <Modal abierto={Boolean(verRemito)} onClose={() => setVerRemito(null)} titulo={verRemito ? `Remito #${verRemito.id}` : ''} ancho="640px"
        footer={
          verRemito ? (
            <>
              <BotonSecretario consulta={`Este es el remito #${verRemito.id} de ${verRemito.proveedor} (estado ${verRemito.estado}). ¿Que hay que pedir?`} />
              <button type="button" className="btn btn-primary" onClick={() => { cruzar(verRemito.id); setVerRemito(null); }}>Cruzar faltantes</button>
              <button type="button" className="btn btn-ghost" onClick={() => setVerRemito(null)}>Cerrar</button>
            </>
          ) : null
        }
      >
        {verRemito && (
          <div>
            <div className="text-sm mb-3">
              <span className="agente-badge">{verRemito.estado}</span>
              {' '}Proveedor: <strong>{verRemito.proveedor}</strong>
              {verRemito.numero && <> · Nro: <strong>{verRemito.numero}</strong></>}
              {' '}· {verRemito.fecha ? new Date(verRemito.fecha).toLocaleString('es-AR') : new Date(verRemito.createdAt).toLocaleString('es-AR')}
            </div>
            {verRemito.observaciones && <p className="text-sm text-muted mb-3">{verRemito.observaciones}</p>}
            <TablaItemsPaginada
              items={verRemito.items || []}
              headers={[<th key="ean">EAN13</th>, <th key="tit">Titulo</th>, <th key="cant">Cantidad</th>]}
              fila={(item, idx) => (
                <tr key={idx}>
                  <td className="font-mono text-xs">{item.ean13}</td>
                  <td>{item.titulo}</td>
                  <td>{item.cantidad}</td>
                </tr>
              )}
            />
          </div>
        )}
      </Modal>

      <Modal abierto={Boolean(detalle)} onClose={() => setDetalle(null)} titulo="Cruce de faltantes" ancho="640px">
        {detalle && (detalle.faltantes || []).length === 0 && (
          <p className="text-sm text-muted">Sin faltantes: todo el remito esta cubierto por el stock.</p>
        )}
        {detalle && (detalle.faltantes || []).length > 0 && (
          <table className="table-os">
            <thead>
              <tr><th>EAN13</th><th>Titulo</th><th>Recibido</th><th>Stock</th><th>Pedir</th></tr>
            </thead>
            <tbody>
              {detalle.faltantes.map((f) => (
                <tr key={f.ean13}>
                  <td className="font-mono text-xs">{f.ean13}</td>
                  <td>{f.titulo}</td>
                  <td>{f.recibido}</td>
                  <td>{f.stockActual}</td>
                  <td className="font-semibold" style={{ color: 'var(--danger)' }}>{f.pedido}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Modal>
    </div>
  );
}
