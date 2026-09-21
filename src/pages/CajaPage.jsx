// BookOS - CajaPage.jsx
// ruta: bookos/frontend/src/pages/CajaPage.jsx
// descripcion: arqueo de caja y cierre Z (reglas de bookerp). Estado del turno,
//   movimientos manuales, cierre con diferencia y historial. Integrado al
//   Secretario (contexto de caja).

import { useEffect, useState } from 'react';
import Table from '../ui/Table';
import Modal from '../ui/Modal';
import Input from '../ui/Input';
import Paginador from '../ui/Paginador';
import DebugTag from '../ui/DebugTag';
import { cajaApi, parametrosApi } from '../api/api';
import { descargarCsv, descargarDesdeServidor } from '../utils/exportar';
import { useAppContext } from '../AppContext';
import BotonSecretario from '../ui/BotonSecretario';
import BorradorRestaurado from '../ui/BorradorRestaurado';
import usePersistentWork from '../hooks/usePersistentWork';
import VentasPeriodoPage from './VentasPeriodoPage';

const MONEDA = (n) => `$${Number(n || 0).toLocaleString('es-AR')}`;

function Tarjeta({ titulo, valor, color }) {
  return (
    <div className="card p-3">
      <div className="text-xs uppercase tracking-widest text-muted">{titulo}</div>
      <div className="text-lg font-semibold" style={color ? { color } : {}}>{valor}</div>
    </div>
  );
}

export default function CajaPage() {
  const [actual, setActual] = useState(null);
  const [cierres, setCierres] = useState([]);
  const [categorias, setCategorias] = useState([]);
  // El movimiento manual es un documento que se esta cargando: tipo, concepto y medio de pago
  // sobreviven al refrescar. El MONTO se deja afuera A PROPOSITO: un importe viejo precargado es
  // un error contable esperando.
  const [ultimoMov, setUltimoMov, limpiarUltimoMov, restaurado] = usePersistentWork('caja_movimiento', { tipo: 'INGRESO', concepto: '', metodoPago: 'EFECTIVO' });
  const [form, setForm] = useState({ ...ultimoMov, monto: '' });
  const [cierreForm, setCierreForm] = useState({ saldoRealDeclarado: '', montoApertura: '', observaciones: '' });
  const [cerrarAbierto, setCerrarAbierto] = useState(false);
  const [detalleCierre, setDetalleCierre] = useState(null);
  const [pageCierres, setPageCierres] = useState(1);
  const [totalCierres, setTotalCierres] = useState(0);
  const [pagC, setPagC] = useState(1);
  const [pagoEditando, setPagoEditando] = useState(null);
  const [metodoNuevo, setMetodoNuevo] = useState('EFECTIVO');
  const [mensaje, setMensaje] = useState('');
  // Historiales en modal (15-09): el listado de ventas del dia/periodo y los turnos cerrados.
  const [ventasPeriodoAbierto, setVentasPeriodoAbierto] = useState(false);
  const [turnosAbierto, setTurnosAbierto] = useState(false);
  const { setContextoActual, pedirConsulta } = useAppContext();

  const cargar = async (p = pageCierres) => {
    try {
      const res = await cajaApi.actual();
      setActual(res.data);
      const hist = await cajaApi.cierres({ page: p, limit: 20 });
      const data = hist.data || {};
      setCierres(Array.isArray(data) ? data : data.filas || []);
      setTotalCierres(Array.isArray(data) ? data.length : data.total || 0);
    } catch (err) { setMensaje(`⚠️ ${err.message}`); }
  };

  useEffect(() => { cargar(pageCierres); }, []); // eslint-disable-line
  useEffect(() => { if (pageCierres > 1) cargar(pageCierres); }, [pageCierres]); // eslint-disable-line

  useEffect(() => {
    parametrosApi.categoriasCaja().then((res) => setCategorias(res.data || [])).catch(() => {});
  }, []);

  // Lo que se tipea en el movimiento manual queda guardado (menos el monto).
  useEffect(() => {
    setUltimoMov({ tipo: form.tipo, concepto: form.concepto, metodoPago: form.metodoPago });
  }, [form.tipo, form.concepto, form.metodoPago]); // eslint-disable-line

  useEffect(() => {
    if (actual) setContextoActual({ vista: 'caja', totales: actual.totales });
  }, [actual]); // eslint-disable-line

  const registrar = async () => {
    try {
      await cajaApi.movimiento(form);
      setMensaje('Movimiento registrado ✓');
      setForm({ tipo: 'INGRESO', concepto: '', monto: '', metodoPago: 'EFECTIVO' });
      cargar();
    } catch (err) { setMensaje(`⚠️ ${err.message}`); }
  };

  const cerrarCaja = async () => {
    try {
      const res = await cajaApi.cerrar(cierreForm);
      setMensaje(`Cierre Z #${res.data.cierreId} ✓ diferencia ${MONEDA(res.data.diferencia)}`);
      setCerrarAbierto(false);
      setCierreForm({ saldoRealDeclarado: '', montoApertura: '', observaciones: '' });
      cargar();
    } catch (err) { setMensaje(`⚠️ ${err.message}`); }
  };

  const abrirMetodo = (mov) => {
    setPagoEditando(mov);
    setMetodoNuevo(mov.metodoPagoNombre || 'EFECTIVO');
  };

  // Solo movimientos del turno abierto (el backend rechaza los ya cerrados).
  const guardarMetodo = async () => {
    try {
      await cajaApi.editarMetodo(pagoEditando.id, metodoNuevo);
      setMensaje(`Movimiento #${pagoEditando.id}: medio de pago actualizado a ${metodoNuevo} ✓`);
      setPagoEditando(null);
      cargar();
    } catch (err) { setMensaje(`⚠️ ${err.message}`); }
  };

  const verCierre = async (id) => {
    try {
      const res = await cajaApi.detalleCierre(id);
      setDetalleCierre(res.data || res);
    } catch (err) { setMensaje(`⚠️ ${err.message}`); }
  };

  const exportarCierre = (detalle) => {
    descargarCsv(`cierre-z-${detalle.cierre.id}`, [
      { titulo: 'Fecha', clave: 'fecha' },
      { titulo: 'Tipo', clave: 'tipo' },
      { titulo: 'Concepto', clave: 'concepto' },
      { titulo: 'Metodo', clave: 'metodoPagoNombre' },
      { titulo: 'Monto', clave: 'monto' },
    ], detalle.movimientos || []);
  };

  // E14: descarga por documento del cierre Z (CSV / PDF guardado / mail interno).
  const descargarCierreServidor = async (id, formato) => {
    try {
      const metodo = formato === 'csv' ? cajaApi.csvCierre : cajaApi.pdfCierre;
      const res = await metodo(id);
      const d = res.data || res;
      await descargarDesdeServidor(`/archivos/${d.archivoId}/descarga`, d.nombre);
      setMensaje(`Descarga ${formato.toUpperCase()} del cierre Z #${id} ✓`);
    } catch (err) { setMensaje(`⚠️ ${err.message}`); }
  };

  const enviarCierreMail = async (id) => {
    const destinatario = window.prompt('Mail del informe de cierre Z (documento interno: administracion o responsable):');
    if (!destinatario) return;
    try {
      const res = await cajaApi.mailCierre(id, { destinatario });
      const d = res.data || {};
      setMensaje(d.enviado
        ? `Cierre Z #${id} enviado a ${d.a || destinatario}${d.redirigido ? ' (MODO PRUEBA)' : ''} ✓`
        : `⚠️ No se pudo enviar: ${d.motivo || 'sin configurar'}`);
    } catch (err) { setMensaje(`⚠️ ${err.message}`); }
  };

  const columnas = [
    { clave: 'fecha', titulo: 'Fecha', render: (m) => new Date(m.fecha).toLocaleString('es-AR') },
    { clave: 'tipo', titulo: 'Tipo' },
    { clave: 'concepto', titulo: 'Concepto' },
    { clave: 'monto', titulo: 'Monto', render: (m) => <span style={{ color: m.tipo === 'EGRESO' ? 'var(--danger)' : 'var(--success)' }}>{MONEDA(m.monto)}</span> },
    { clave: 'metodoPagoNombre', titulo: 'Metodo' },
    { clave: 'acciones', titulo: '', render: (m) => (
      <button type="button" className="btn btn-ghost text-xs" onClick={() => abrirMetodo(m)}>Metodo</button>
    ) },
  ];

  const columnasDetalleCierre = [
    { clave: 'fecha', titulo: 'Fecha', render: (m) => new Date(m.fecha).toLocaleString('es-AR') },
    { clave: 'tipo', titulo: 'Tipo' },
    { clave: 'concepto', titulo: 'Concepto' },
    { clave: 'metodoPagoNombre', titulo: 'Metodo' },
    { clave: 'monto', titulo: 'Monto', render: (m) => <span style={{ color: m.tipo === 'EGRESO' ? 'var(--danger)' : 'var(--success)' }}>{MONEDA(m.monto)}</span> },
  ];

  const columnasCierres = [
    { clave: 'id', titulo: 'ID' },
    { clave: 'fecha', titulo: 'Fecha', render: (c) => new Date(c.createdAt).toLocaleString('es-AR') },
    { clave: 'totalVentas', titulo: 'Total ventas', render: (c) => MONEDA(c.totalVentas) },
    { clave: 'diferenciaEfectivo', titulo: 'Diferencia', render: (c) => <span style={{ color: Number(c.diferenciaEfectivo) === 0 ? 'var(--muted)' : 'var(--danger)' }}>{MONEDA(c.diferenciaEfectivo)}</span> },
    { clave: 'acciones', titulo: '', render: (c) => (
      <button type="button" className="btn btn-ghost text-xs" onClick={() => { setTurnosAbierto(false); verCierre(c.id); }}>Ver informe</button>
    ) },
  ];

  return (
    <div>
      <DebugTag nombre="CajaPage" />
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-semibold">Caja</h2>
          <BorradorRestaurado visible={restaurado} onLimpiar={limpiarUltimoMov} />
        </div>
        <div className="flex gap-2">
          <BotonSecretario consulta="¿Como esta la caja? Dame un resumen del turno abierto." />
          <button type="button" className="btn btn-ghost text-xs" onClick={() => setVentasPeriodoAbierto(true)}>Ventas del periodo</button>
          <button type="button" className="btn btn-ghost text-xs" onClick={() => setTurnosAbierto(true)}>Turnos (Z)</button>
          <button type="button" className="btn btn-primary" onClick={() => setCerrarAbierto(true)}>Cierre Z</button>
        </div>
      </div>

      {mensaje && <p className="text-sm mb-3">{mensaje}</p>}

      {actual && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          <Tarjeta titulo="Saldo teorico efectivo" valor={MONEDA(actual.totales.saldoTeoricoEfectivo)} />
          <Tarjeta titulo="Ingresos efectivo" valor={MONEDA(actual.totales.ingresosEfectivo)} color="var(--success)" />
          <Tarjeta titulo="Egresos efectivo" valor={MONEDA(actual.totales.egresosEfectivo)} color="var(--danger)" />
          <Tarjeta titulo="Total ventas dia" valor={MONEDA(actual.totales.totalVentasDia)} />
          <Tarjeta titulo="Tarjetas" valor={MONEDA(actual.totales.totalTarjetas)} />
          <Tarjeta titulo="Transferencias" valor={MONEDA(actual.totales.totalTransferencias)} />
          <Tarjeta titulo="Cheques" valor={MONEDA(actual.totales.totalCheques)} />
        </div>
      )}

      <div className="grid md:grid-cols-2 gap-4 mb-6">
        <div className="card p-4">
          <h3 className="font-semibold mb-3">Movimiento manual</h3>
          <div className="flex gap-2 mb-3">
            <select className="input-os" value={form.tipo} onChange={(e) => setForm({ ...form, tipo: e.target.value })}>
              <option value="INGRESO">INGRESO</option>
              <option value="EGRESO">EGRESO</option>
            </select>
            <select className="input-os" value={form.metodoPago} onChange={(e) => setForm({ ...form, metodoPago: e.target.value })}>
              <option value="EFECTIVO">EFECTIVO</option>
              <option value="TARJETA">TARJETA</option>
              <option value="TRANSFERENCIA">TRANSFERENCIA</option>
              <option value="CHEQUE">CHEQUE</option>
            </select>
          </div>
          <Input label="Concepto" list="dl-categorias-caja" value={form.concepto} onChange={(e) => setForm({ ...form, concepto: e.target.value })} />
          <datalist id="dl-categorias-caja">{categorias.map((c) => <option key={c.id} value={c.nombre} />)}</datalist>
          <Input label="Monto" type="number" value={form.monto} onChange={(e) => setForm({ ...form, monto: e.target.value })} />
          <button type="button" className="btn btn-primary" onClick={registrar}>Registrar</button>
        </div>
        <div className="card p-4">
          <h3 className="font-semibold mb-3">Movimientos del turno</h3>
          <Table columnas={columnas} filas={actual ? actual.movimientos.slice((pagC - 1) * 15, pagC * 15) : []} vacio="Sin movimientos" />
          {actual && actual.movimientos.length > 15 && (
            <Paginador page={pagC} total={actual.movimientos.length} limite={15} onCambiar={setPagC} etiqueta="movimientos del turno" />
          )}
        </div>
      </div>

      {/* HISTORIALES EN MODAL (15-09): lo que estaba al pie de la pagina. */}
      <Modal abierto={ventasPeriodoAbierto} onClose={() => setVentasPeriodoAbierto(false)} titulo="Ventas del dia / periodo" ancho="1000px">
        <VentasPeriodoPage embebido />
      </Modal>

      <Modal abierto={turnosAbierto} onClose={() => setTurnosAbierto(false)} titulo="Turnos cerrados (cierres Z)" ancho="900px"
        footer={<button type="button" className="btn btn-primary" onClick={() => setTurnosAbierto(false)}>Cerrar</button>}
      >
        <Table columnas={columnasCierres} filas={cierres} vacio="Sin cierres" />
        <Paginador page={pageCierres} total={totalCierres} limite={20} onCambiar={setPageCierres} etiqueta="cierres" />
      </Modal>

      <Modal abierto={cerrarAbierto} onClose={() => setCerrarAbierto(false)} titulo="Cierre Z (arqueo)" ancho="420px"
        footer={
          <>
            <button type="button" className="btn btn-ghost" onClick={() => setCerrarAbierto(false)}>Cancelar</button>
            <button type="button" className="btn btn-primary" onClick={cerrarCaja}>Cerrar caja</button>
          </>
        }
      >
        <Input label="Saldo real declarado (efectivo)" type="number" value={cierreForm.saldoRealDeclarado} onChange={(e) => setCierreForm({ ...cierreForm, saldoRealDeclarado: e.target.value })} />
        <Input label="Monto de apertura" type="number" value={cierreForm.montoApertura} onChange={(e) => setCierreForm({ ...cierreForm, montoApertura: e.target.value })} />
        <Input label="Observaciones" value={cierreForm.observaciones} onChange={(e) => setCierreForm({ ...cierreForm, observaciones: e.target.value })} />
        <p className="text-xs text-muted">Al cerrar se vincula el turno y se asienta el ajuste por sobrante/faltante automatico.</p>
      </Modal>

      <Modal abierto={Boolean(detalleCierre)} onClose={() => setDetalleCierre(null)} titulo={detalleCierre ? `Informe del cierre Z #${detalleCierre.cierre.id}` : ''} ancho="880px"
        footer={detalleCierre ? (
          <div className="flex gap-2">
            <button type="button" className="btn btn-ghost" onClick={() => exportarCierre(detalleCierre)}>Exportar CSV</button>
            <button type="button" className="btn btn-ghost" onClick={() => descargarCierreServidor(detalleCierre.cierre.id, 'pdf')}>PDF</button>
            <button type="button" className="btn btn-ghost" onClick={() => enviarCierreMail(detalleCierre.cierre.id)}>Enviar mail</button>
            <button type="button" className="btn btn-primary" onClick={() => setDetalleCierre(null)}>Cerrar</button>
          </div>
        ) : null}
      >
        {detalleCierre && (
          <>
            <div className="text-xs text-muted mb-3">
              Apertura: {new Date(detalleCierre.cierre.fechaApertura).toLocaleString('es-AR')} ·
              Cierre: {new Date(detalleCierre.cierre.fechaCierre).toLocaleString('es-AR')} ·
              Apertura declarada: {MONEDA(detalleCierre.cierre.montoApertura)}
              {detalleCierre.cierre.observaciones ? ` · ${detalleCierre.cierre.observaciones}` : ''}
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
              <Tarjeta titulo="Total ventas" valor={MONEDA(detalleCierre.cierre.totalVentas)} />
              <Tarjeta titulo="Efectivo teorico" valor={MONEDA(detalleCierre.cierre.totalEfectivoTeorico)} />
              <Tarjeta titulo="Efectivo declarado" valor={MONEDA(detalleCierre.cierre.totalEfectivoDeclarado)} />
              <Tarjeta titulo="Diferencia" valor={MONEDA(detalleCierre.cierre.diferenciaEfectivo)} color={Number(detalleCierre.cierre.diferenciaEfectivo) === 0 ? undefined : 'var(--danger)'} />
              <Tarjeta titulo="Tarjetas" valor={MONEDA(detalleCierre.cierre.totalTarjetas)} />
              <Tarjeta titulo="Transferencias" valor={MONEDA(detalleCierre.cierre.totalTransferencias)} />
              <Tarjeta titulo="Cheques" valor={MONEDA(detalleCierre.cierre.totalCheques)} />
              <Tarjeta titulo="Movimientos del turno" valor={(detalleCierre.movimientos || []).length} />
            </div>
            <Table columnas={columnasDetalleCierre} filas={detalleCierre.movimientos || []} vacio="Sin movimientos" />
          </>
        )}
      </Modal>

      <Modal abierto={Boolean(pagoEditando)} onClose={() => setPagoEditando(null)} titulo={pagoEditando ? `Editar medio de pago - movimiento #${pagoEditando.id}` : ''} ancho="420px"
        footer={(
          <>
            <button type="button" className="btn btn-ghost" onClick={() => setPagoEditando(null)}>Cancelar</button>
            <button type="button" className="btn btn-primary" onClick={guardarMetodo}>Guardar</button>
          </>
        )}
      >
        {pagoEditando && (
          <>
            <p className="text-sm mb-3">
              {pagoEditando.concepto} · <strong>{MONEDA(pagoEditando.monto)}</strong>
              <span className="text-muted"> (actual: {pagoEditando.metodoPagoNombre || '-'})</span>
            </p>
            <label className="block mb-3">
              <span className="block text-xs uppercase tracking-widest text-muted mb-1">Nuevo medio de pago</span>
              <select className="input-os" value={metodoNuevo} onChange={(e) => setMetodoNuevo(e.target.value)}>
                <option value="EFECTIVO">EFECTIVO</option>
                <option value="TARJETA">TARJETA</option>
                <option value="TRANSFERENCIA">TRANSFERENCIA</option>
                <option value="CHEQUE">CHEQUE</option>
              </select>
            </label>
            <p className="text-xs text-muted">Solo movimientos del turno abierto: un cierre Z ya cerrado queda inmutable.</p>
          </>
        )}
      </Modal>
    </div>
  );
}
