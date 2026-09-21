// BookOS - NewsletterPage.jsx
// ruta: bookos/frontend/src/pages/NewsletterPage.jsx
// descripcion: suscriptores del newsletter (integrado al CRM). Altas/bajas
//   manuales y listado exportable.

import { useEffect, useRef, useState } from 'react';
import Table from '../ui/Table';
import Modal from '../ui/Modal';
import Paginador from '../ui/Paginador';
import DebugTag from '../ui/DebugTag';
import { newsletterApi } from '../api/api';
import { useAppContext } from '../AppContext';
import BotonSecretario from '../ui/BotonSecretario';

export default function NewsletterPage() {
  const [suscriptores, setSuscriptores] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [mensaje, setMensaje] = useState('');

  const [modalAbierto, setModalAbierto] = useState(false);
  const [email, setEmail] = useState('');
  const [nombre, setNombre] = useState('');
  const [estadoFiltro, setEstadoFiltro] = useState('');
  const primerFiltro = useRef(true);

  const { setContextoActual, pedirConsulta } = useAppContext();

  const cargar = async (p = page) => {
    try {
      const res = await newsletterApi.listar({ page: p, limit: 25, estado: estadoFiltro || undefined });
      setSuscriptores(res.data?.filas || res.data || []);
      setTotal(res.data?.total || 0);
    } catch (err) { setMensaje(`⚠️ ${err.message}`); }
  };

  useEffect(() => { cargar(1); }, []); // eslint-disable-line
  useEffect(() => { if (page > 1) cargar(page); }, [page]); // eslint-disable-line
  useEffect(() => {
    if (primerFiltro.current) { primerFiltro.current = false; return; }
    setPage(1);
    cargar(1);
  }, [estadoFiltro]); // eslint-disable-line
  useEffect(() => { setContextoActual({ vista: 'newsletter', suscriptores: total }); }, [total]); // eslint-disable-line

  const suscribir = async () => {
    try {
      await newsletterApi.suscribir({ email, nombre: nombre || null });
      setMensaje('Suscripto ✓');
      setModalAbierto(false); setEmail(''); setNombre('');
      cargar();
    } catch (err) { setMensaje(`⚠️ ${err.message}`); }
  };

  const darDeBaja = async (em) => {
    if (!window.confirm(`¿Dar de baja a ${em}? Deja de recibir y una venta posterior no lo revive.`)) return;
    try {
      await newsletterApi.darDeBaja(em);
      setMensaje('Baja aplicada ✓ (logica: aunque vuelva a comprar, sigue de baja)');
      cargar();
    } catch (err) { setMensaje(`⚠️ ${err.message}`); }
  };

  // Alta explicita: es la unica via que reactiva una baja.
  const reactivar = async (em) => {
    try {
      await newsletterApi.suscribir({ email: em });
      setMensaje('Suscriptor reactivado ✓');
      cargar();
    } catch (err) { setMensaje(`⚠️ ${err.message}`); }
  };

  const columnas = [
    { clave: 'id', titulo: 'ID' },
    { clave: 'email', titulo: 'Email' },
    { clave: 'nombre', titulo: 'Nombre' },
    { clave: 'estado', titulo: 'Estado', render: (s) => (
      <span className="agente-badge" style={{ color: s.estado === 'BAJA' ? 'var(--danger)' : 'var(--success)', borderColor: s.estado === 'BAJA' ? 'var(--danger)' : 'var(--success)' }}>{s.estado}</span>
    ) },
    { clave: 'cliente', titulo: 'Cliente', render: (s) => (s.cliente ? s.cliente.nombre : '—'), valorExport: (s) => (s.cliente ? s.cliente.nombre : '') },
    { clave: 'origen', titulo: 'Origen', render: (s) => <span className="agente-badge">{s.origen}</span> },
    { clave: 'fechaRegistro', titulo: 'Fecha', render: (s) => new Date(s.fechaRegistro).toLocaleDateString('es-AR'), valorExport: (s) => new Date(s.fechaRegistro).toLocaleDateString('es-AR') },
    { clave: 'acciones', titulo: '', render: (s) => (s.estado === 'BAJA'
      ? <button type="button" className="btn btn-ghost text-xs" onClick={() => reactivar(s.email)}>Reactivar</button>
      : <button type="button" className="btn btn-ghost text-xs" style={{ color: 'var(--danger)' }} onClick={() => darDeBaja(s.email)}>Dar de baja</button>) },
  ];

  return (
    <div>
      <DebugTag nombre="NewsletterPage" />
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold">Newsletter</h2>
        <span className="text-xs text-muted">{total} suscriptores · integrado al CRM</span>
      </div>

      {mensaje && <p className="text-sm mb-3">{mensaje}</p>}

      <div className="flex justify-end gap-2 mb-4">
        <select className="input-os" style={{ maxWidth: 170 }} value={estadoFiltro} onChange={(e) => setEstadoFiltro(e.target.value)}>
          <option value="">Todos los estados</option>
          <option value="ALTA">Solo activos</option>
          <option value="BAJA">Solo bajas</option>
        </select>
        <BotonSecretario
          className="btn btn-ghost text-xs"
          consulta={`Tengo ${total} suscriptores al newsletter. ¿Que me sugeris?`}
        />
        <button type="button" className="btn btn-primary text-xs" onClick={() => setModalAbierto(true)}>+ Suscriptor</button>
      </div>

      <Table columnas={columnas} filas={suscriptores} vacio="Sin suscriptores" exportable exportarNombre="newsletter" />
      <Paginador page={page} total={total} limite={25} onCambiar={setPage} etiqueta="suscriptores" />
      <Paginador page={page} total={total} limite={25} onCambiar={setPage} etiqueta="suscriptores" />

      <Modal abierto={modalAbierto} onClose={() => setModalAbierto(false)} titulo="Nuevo suscriptor" ancho="420px"
        footer={
          <>
            <button type="button" className="btn btn-ghost" onClick={() => setModalAbierto(false)}>Cancelar</button>
            <button type="button" className="btn btn-primary" disabled={!email} onClick={suscribir}>Suscribir</button>
          </>
        }
      >
        <label className="block mb-3">
          <span className="block text-xs uppercase tracking-widest text-muted mb-1">Email</span>
          <input className="input-os" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        </label>
        <label className="block mb-3">
          <span className="block text-xs uppercase tracking-widest text-muted mb-1">Nombre (opcional)</span>
          <input className="input-os" value={nombre} onChange={(e) => setNombre(e.target.value)} />
        </label>
      </Modal>
    </div>
  );
}
