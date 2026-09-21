// BookOS - InventarioPage.jsx
// ruta: bookos/frontend/src/pages/InventarioPage.jsx
// descripcion: deposito e inventario: stock por articulo, transferencia
//   local<->deposito y ajuste de inventario (firme/consigna).

import { useEffect, useState } from 'react';
import Table from '../ui/Table';
import Modal from '../ui/Modal';
import Paginador from '../ui/Paginador';
import DebugTag from '../ui/DebugTag';
import { inventarioApi } from '../api/api';
import { descargarDesdeServidor } from '../utils/exportar';
import { useAppContext } from '../AppContext';
import BotonSecretario from '../ui/BotonSecretario';
import usePersistentWork from '../hooks/usePersistentWork';

// Tipos FIFE de ajuste (bookerp): cada uno define los deltas; la cantidad siempre es positiva.
// En altas/bajas de consigna el original sigue al actual (el proveedor entrega/retira fisicamente);
// una reclasificacion firme<->consigna NO toca el original.
const TIPOS_AJUSTE = [
  { id: 'ALTA_FIRME', label: 'Alta firme (ingreso)', df: 1, dc: 0, dco: 0 },
  { id: 'BAJA_FIRME', label: 'Baja firme (rotura / perdida)', df: -1, dc: 0, dco: 0 },
  { id: 'ALTA_CONSIGNA', label: 'Alta consigna (reposicion del proveedor)', df: 0, dc: 1, dco: 1 },
  { id: 'BAJA_CONSIGNA', label: 'Baja consigna (retiro del proveedor)', df: 0, dc: -1, dco: -1 },
  { id: 'FIRME_A_CONSIGNA', label: 'Firme -> Consigna (reclasificar)', df: -1, dc: 1, dco: 0 },
  { id: 'CONSIGNA_A_FIRME', label: 'Consigna -> Firme (reclasificar)', df: 1, dc: -1, dco: 0 },
  { id: 'PERSONALIZADO', label: 'Personalizado (deltas a mano)', libre: true },
];

export default function InventarioPage() {
  // El buscador sobrevive al refrescar (el ajuste/transferencia son atomicos por articulo: ahi no
  // hay borrador que guardar sin riesgo de precargar cantidades sobre otro libro).
  const [busqueda, setBusqueda] = usePersistentWork('inventario_busqueda', '');
  const [filas, setFilas] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [mensaje, setMensaje] = useState('');

  const [transferir, setTransferir] = useState(null); // articulo
  const [tCantidad, setTCantidad] = useState('');
  const [tHacia, setTHacia] = useState(true);

  const [ajustar, setAjustar] = useState(null); // articulo
  const [aTipo, setATipo] = useState('ALTA_FIRME');
  const [aCantidad, setACantidad] = useState('');
  const [aFirme, setAFirme] = useState(0);
  const [aConsigna, setAConsigna] = useState(0);
  const [aMotivo, setAMotivo] = useState('');

  const [ajustes, setAjustes] = useState([]);
  const [ajPage, setAjPage] = useState(1);
  const [ajTotal, setAjTotal] = useState(0);
  const [ajusteVer, setAjusteVer] = useState(null);

  const { setContextoActual, pedirConsulta } = useAppContext();

  const cargar = async (q = busqueda, p = page) => {
    try {
      const res = await inventarioApi.stock({ search: q, page: p, limit: 50 });
      setFilas(res.data?.filas || []);
      setTotal(res.data?.total || 0);
    } catch (err) { setMensaje(`⚠️ ${err.message}`); }
  };

  useEffect(() => { cargar('', 1); }, []); // eslint-disable-line
  useEffect(() => { if (page > 1) cargar(busqueda, page); }, [page]); // eslint-disable-line

  const buscar = () => { setPage(1); cargar(busqueda, 1); };

  const cargarAjustes = async (p = ajPage) => {
    try {
      const res = await inventarioApi.ajustes({ page: p, limit: 20 });
      const data = res.data || res;
      setAjustes(data.filas || []);
      setAjTotal(data.total || 0);
    } catch (err) { setMensaje(`⚠️ ${err.message}`); }
  };

  useEffect(() => { cargarAjustes(ajPage); }, [ajPage]); // eslint-disable-line

  const anularAjuste = async (a) => {
    if (!window.confirm(`¿Anular el ajuste ${a.numero || `#${a.id}`}? Se revierte el stock.`)) return;
    try {
      await inventarioApi.anularAjuste(a.id);
      setMensaje(`Ajuste ${a.numero || `#${a.id}`} anulado (stock revertido) ✓`);
      setAjusteVer(null);
      cargarAjustes();
      cargar();
    } catch (err) { setMensaje(`⚠️ ${err.message}`); }
  };

  // E14: descarga por documento del ajuste (CSV / PDF / mail con destinatario).
  const descargarAjuste = async (a, formato) => {
    try {
      const metodo = formato === 'csv' ? inventarioApi.csvAjuste : inventarioApi.pdfAjuste;
      const res = await metodo(a.id);
      const d = res.data || res;
      await descargarDesdeServidor(`/archivos/${d.archivoId}/descarga`, d.nombre);
      setMensaje(`Descarga ${formato.toUpperCase()} del ajuste ${a.numero || `#${a.id}`} ✓`);
    } catch (err) { setMensaje(`⚠️ ${err.message}`); }
  };

  const enviarAjusteMail = async (a) => {
    const destinatario = window.prompt('Mail del aviso del ajuste (documento interno: departamento o responsable):');
    if (!destinatario) return;
    try {
      const res = await inventarioApi.mailAjuste(a.id, { destinatario });
      const d = res.data || {};
      setMensaje(d.enviado
        ? `Ajuste ${a.numero || `#${a.id}`} enviado a ${d.a || destinatario}${d.redirigido ? ' (MODO PRUEBA)' : ''} ✓`
        : `⚠️ No se pudo enviar: ${d.motivo || 'sin configurar'}`);
    } catch (err) { setMensaje(`⚠️ ${err.message}`); }
  };

  useEffect(() => { setContextoActual({ vista: 'inventario', articulos: total }); }, [total]); // eslint-disable-line

  const ejecutarTransferencia = async () => {
    try {
      await inventarioApi.transferir({ ean13: transferir.ean13, cantidad: Number(tCantidad), haciaDeposito: tHacia });
      setMensaje(`Transferencia de ${tCantidad} u aplicada ✓`);
      setTransferir(null); setTCantidad('');
      cargar();
    } catch (err) { setMensaje(`⚠️ ${err.message}`); }
  };

  const tipoSel = TIPOS_AJUSTE.find((t) => t.id === aTipo) || TIPOS_AJUSTE[0];
  const cantidadAjuste = Math.abs(Number(aCantidad) || 0);

  const columnasAjustes = [
    { clave: 'numero', titulo: 'Numero', render: (a) => a.numero || `#${a.id}` },
    { clave: 'fecha', titulo: 'Fecha', render: (a) => new Date(a.fecha).toLocaleString('es-AR') },
    { clave: 'tipoMovimiento', titulo: 'Tipo' },
    { clave: 'articulos', titulo: 'Articulo', render: (a) => (a.items || []).map((i) => (i.articulo ? i.articulo.titulo : `#${i.articuloId}`)).join(', ').slice(0, 60) },
    { clave: 'deltas', titulo: 'Deltas', render: (a) => (a.items || []).map((i) => `F${i.deltaFirme >= 0 ? '+' : ''}${i.deltaFirme} C${i.deltaConsignaActual >= 0 ? '+' : ''}${i.deltaConsignaActual} O${i.deltaConsignaOriginal >= 0 ? '+' : ''}${i.deltaConsignaOriginal}`).join(' · ') },
    { clave: 'estado', titulo: 'Estado', render: (a) => <span className="agente-badge">{a.estado}</span> },
    { clave: 'acciones', titulo: '', render: (a) => (
      <div className="flex gap-2">
        <button type="button" className="btn btn-ghost text-xs" onClick={() => setAjusteVer(a)}>Ver</button>
        <button type="button" className="btn btn-ghost text-xs" onClick={() => descargarAjuste(a, 'csv')}>CSV</button>
        <button type="button" className="btn btn-ghost text-xs" onClick={() => descargarAjuste(a, 'pdf')}>PDF</button>
        <button type="button" className="btn btn-ghost text-xs" onClick={() => enviarAjusteMail(a)}>Mail</button>
        {a.tipoMovimiento === 'AJUSTE' && a.estado === 'ACTIVO' && (
          <button type="button" className="btn btn-ghost text-xs" style={{ color: 'var(--danger)' }} onClick={() => anularAjuste(a)}>Anular</button>
        )}
      </div>
    ) },
  ];

  const ejecutarAjuste = async () => {
    const payload = { ean13: ajustar.ean13, motivo: aMotivo };
    if (tipoSel.libre) {
      payload.deltaFirme = Number(aFirme) || 0;
      payload.deltaConsigna = Number(aConsigna) || 0;
      if (!payload.motivo) payload.motivo = 'Ajuste personalizado';
    } else {
      if (cantidadAjuste <= 0) { setMensaje('⚠️ La cantidad tiene que ser mayor a cero'); return; }
      payload.deltaFirme = tipoSel.df * cantidadAjuste;
      payload.deltaConsigna = tipoSel.dc * cantidadAjuste;
      payload.deltaConsignaOriginal = tipoSel.dco * cantidadAjuste;
      if (!payload.motivo) payload.motivo = `${tipoSel.id}: ${cantidadAjuste} u`;
    }
    try {
      await inventarioApi.ajustar(payload);
      setMensaje(`Ajuste ${tipoSel.libre ? 'personalizado' : tipoSel.id} aplicado ✓`);
      setAjustar(null); setACantidad(''); setAFirme(0); setAConsigna(0); setAMotivo('');
      cargar();
    } catch (err) { setMensaje(`⚠️ ${err.message}`); }
  };

  const columnas = [
    { clave: 'ean13', titulo: 'EAN', render: (a) => <span className="font-mono text-xs">{a.ean13}</span> },
    { clave: 'titulo', titulo: 'Titulo' },
    { clave: 'stock', titulo: 'Firme', render: (a) => a.stock },
    { clave: 'stockDeposito', titulo: 'Depósito', render: (a) => a.stockDeposito },
    { clave: 'stockConsigna', titulo: 'Consigna', render: (a) => a.stockConsigna },
    { clave: 'acciones', titulo: '', render: (a) => (
      <div className="flex gap-2">
        <button type="button" className="btn btn-ghost text-xs" onClick={() => { setTransferir(a); setTHacia(true); }}>Transferir</button>
        <button type="button" className="btn btn-ghost text-xs" onClick={() => setAjustar(a)}>Ajustar</button>
      </div>
    ) },
  ];

  return (
    <div>
      <DebugTag nombre="InventarioPage" />
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold">Depósito e Inventario</h2>
        <span className="text-xs text-muted">stock firme · depósito · consigna</span>
      </div>

      {mensaje && <p className="text-sm mb-3">{mensaje}</p>}

      <div className="flex gap-2 mb-4">
        <input className="input-os" style={{ maxWidth: 320 }} placeholder="EAN o titulo..." value={busqueda} onChange={(e) => setBusqueda(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') buscar(); }} />
        <button type="button" className="btn" onClick={buscar}>Buscar</button>
        <div className="flex-1" />
        <BotonSecretario
          className="btn btn-ghost text-xs"
          consulta={`Estoy viendo el inventario (${total} articulos). ¿Que me sugeris reponer o ajustar?`}
        />
      </div>

      <Table columnas={columnas} filas={filas} vacio="Busca un articulo" exportable exportarNombre="inventario" />
      <Paginador page={page} total={total} limite={50} onCambiar={setPage} etiqueta="articulos" />

      <Modal abierto={Boolean(transferir)} onClose={() => setTransferir(null)} titulo={transferir ? `Transferir ${transferir.titulo}` : ''} ancho="420px"
        footer={
          <>
            <button type="button" className="btn btn-ghost" onClick={() => setTransferir(null)}>Cancelar</button>
            <button type="button" className="btn btn-primary" disabled={!tCantidad || Number(tCantidad) <= 0} onClick={ejecutarTransferencia}>Transferir</button>
          </>
        }
      >
        {transferir && <p className="text-sm mb-3">Firme: {transferir.stock} · Depósito: {transferir.stockDeposito}</p>}
        <label className="block mb-3">
          <span className="block text-xs uppercase tracking-widest text-muted mb-1">Cantidad</span>
          <input className="input-os" type="number" min="1" value={tCantidad} onChange={(e) => setTCantidad(e.target.value)} />
        </label>
        <label className="block mb-3">
          <span className="block text-xs uppercase tracking-widest text-muted mb-1">Dirección</span>
          <select className="input-os" value={tHacia} onChange={(e) => setTHacia(e.target.value === 'true')}>
            <option value="true">Local → Depósito</option>
            <option value="false">Depósito → Local</option>
          </select>
        </label>
      </Modal>

      <Modal abierto={Boolean(ajustar)} onClose={() => setAjustar(null)} titulo={ajustar ? `Ajustar ${ajustar.titulo}` : ''} ancho="460px"
        footer={
          <>
            <button type="button" className="btn btn-ghost" onClick={() => setAjustar(null)}>Cancelar</button>
            <button type="button" className="btn btn-primary" disabled={!tipoSel.libre && cantidadAjuste <= 0} onClick={ejecutarAjuste}>Aplicar</button>
          </>
        }
      >
        {ajustar && <p className="text-sm mb-3">Firme: {ajustar.stock} · Depósito: {ajustar.stockDeposito} · Consigna: {ajustar.stockConsigna}</p>}
        <label className="block mb-3">
          <span className="block text-xs uppercase tracking-widest text-muted mb-1">Tipo de ajuste</span>
          <select className="input-os" value={aTipo} onChange={(e) => setATipo(e.target.value)}>
            {TIPOS_AJUSTE.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
          </select>
        </label>
        {tipoSel.libre ? (
          <>
            <label className="block mb-3">
              <span className="block text-xs uppercase tracking-widest text-muted mb-1">Delta firme (+/-)</span>
              <input className="input-os" type="number" value={aFirme} onChange={(e) => setAFirme(Number(e.target.value) || 0)} />
            </label>
            <label className="block mb-3">
              <span className="block text-xs uppercase tracking-widest text-muted mb-1">Delta consigna (+/-)</span>
              <input className="input-os" type="number" value={aConsigna} onChange={(e) => setAConsigna(Number(e.target.value) || 0)} />
            </label>
          </>
        ) : (
          <>
            <label className="block mb-3">
              <span className="block text-xs uppercase tracking-widest text-muted mb-1">Cantidad</span>
              <input className="input-os" type="number" min="1" value={aCantidad} onChange={(e) => setACantidad(e.target.value)} />
            </label>
            <p className="text-xs text-muted mb-3">
              Aplica: firme {tipoSel.df >= 0 ? '+' : ''}{tipoSel.df * cantidadAjuste} ·
              consigna {tipoSel.dc >= 0 ? '+' : ''}{tipoSel.dc * cantidadAjuste} ·
              original {tipoSel.dco >= 0 ? '+' : ''}{tipoSel.dco * cantidadAjuste}
            </p>
          </>
        )}
        <label className="block mb-3">
          <span className="block text-xs uppercase tracking-widest text-muted mb-1">Motivo / nota (opcional)</span>
          <input className="input-os" value={aMotivo} onChange={(e) => setAMotivo(e.target.value)} />
        </label>
        <p className="text-xs text-muted">El ajuste queda en el ledger de stock con su motivo; no modifica comprobantes.</p>
      </Modal>

      <h3 className="font-semibold mb-2 mt-6">Historial de ajustes</h3>
      <Table columnas={columnasAjustes} filas={ajustes} vacio="Sin ajustes registrados" />
      <Paginador page={ajPage} total={ajTotal} limite={20} onCambiar={setAjPage} etiqueta="ajustes" />

      <Modal abierto={Boolean(ajusteVer)} onClose={() => setAjusteVer(null)} titulo={ajusteVer ? `Ajuste ${ajusteVer.numero || `#${ajusteVer.id}`}` : ''} ancho="680px"
        footer={ajusteVer ? (
          <div className="flex gap-2">
            {ajusteVer.tipoMovimiento === 'AJUSTE' && ajusteVer.estado === 'ACTIVO' && (
              <button type="button" className="btn btn-ghost" style={{ color: 'var(--danger)' }} onClick={() => anularAjuste(ajusteVer)}>Anular (revierte stock)</button>
            )}
            <button type="button" className="btn btn-primary" onClick={() => setAjusteVer(null)}>Cerrar</button>
          </div>
        ) : null}
      >
        {ajusteVer && (
          <>
            <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-sm mb-3">
              <div><span className="text-muted">Fecha: </span>{new Date(ajusteVer.fecha).toLocaleString('es-AR')}</div>
              <div><span className="text-muted">Tipo: </span>{ajusteVer.tipoMovimiento}</div>
              <div><span className="text-muted">Estado: </span>{ajusteVer.estado}</div>
              <div><span className="text-muted">Referencia: </span>{ajusteVer.referenciaId || '-'}</div>
              {ajusteVer.observaciones && <div className="col-span-2"><span className="text-muted">Motivo: </span>{ajusteVer.observaciones}</div>}
            </div>
            <table className="table-os">
              <thead><tr><th>Articulo</th><th>Firme</th><th>Consigna</th><th>Original</th><th>Stock previo (F/C/O)</th></tr></thead>
              <tbody>
                {(ajusteVer.items || []).map((i) => (
                  <tr key={i.id}>
                    <td>{i.articulo ? i.articulo.titulo : `#${i.articuloId}`}</td>
                    <td>{i.deltaFirme >= 0 ? '+' : ''}{i.deltaFirme}</td>
                    <td>{i.deltaConsignaActual >= 0 ? '+' : ''}{i.deltaConsignaActual}</td>
                    <td>{i.deltaConsignaOriginal >= 0 ? '+' : ''}{i.deltaConsignaOriginal}</td>
                    <td className="text-xs text-muted">{i.stockFirmePrevio} / {i.stockConsignaActualPrevio} / {i.stockConsignaOriginalPrevio}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}
      </Modal>
    </div>
  );
}
