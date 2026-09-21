// BookOS - ReferenciasPage.jsx
// ruta: bookos/frontend/src/pages/ReferenciasPage.jsx
// descripcion: referencias maestras del catalogo — autores, materias y editoriales
//   (bookerp: aut__autores, mtr__materias, editoriales). CRUD completo + "Preguntar
//   al Secretario" + observacion LLM sobre el portfolio de cada editorial.

import { useEffect, useState } from 'react';
import Table from '../ui/Table';
import Modal from '../ui/Modal';
import Paginador from '../ui/Paginador';
import DebugTag from '../ui/DebugTag';
import { autoresApi, materiasApi, editorialesApi, observacionesApi } from '../api/api';
import { useAppContext } from '../AppContext';
import BotonSecretario from '../ui/BotonSecretario';

const TABS = [
  { id: 'autores', label: 'Autores' },
  { id: 'materias', label: 'Materias' },
  { id: 'editoriales', label: 'Editoriales' },
];

const FORM_VACIO = { nombre: '', codigo: '', descripcion: '', padreId: '', raiz: '', nombreFantasia: '' };

export default function ReferenciasPage() {
  const [tab, setTab] = useState('autores');
  const [filas, setFilas] = useState([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState('');
  const [mensaje, setMensaje] = useState('');
  const [modalAbierto, setModalAbierto] = useState(false);
  const [editando, setEditando] = useState(null); // fila en edicion o null para alta
  const [form, setForm] = useState(FORM_VACIO);

  const { setContextoActual, pedirConsulta } = useAppContext();

  const apiDe = (t = tab) => (t === 'autores' ? autoresApi : t === 'materias' ? materiasApi : editorialesApi);
  const nombreEntidad = () => (tab === 'autores' ? 'autor' : tab === 'materias' ? 'materia' : 'editorial');

  const cargar = async (t = tab, p = page) => {
    try {
      const res = await apiDe(t).listar({ search: search || undefined, page: p, limit: 25 });
      setFilas(res.data || []);
      setTotal(res.pagination ? res.pagination.total : (res.data || []).length);
    } catch (err) { setMensaje(`⚠️ ${err.message}`); }
  };

  // Al cambiar de solapa vuelve a la pagina 1 y recarga.
  useEffect(() => { setPage(1); cargar(tab, 1); }, [tab]); // eslint-disable-line
  useEffect(() => { if (page > 1) cargar(tab, page); }, [page]); // eslint-disable-line
  useEffect(() => { setContextoActual({ vista: 'referencias', tab, total }); }, [tab, total]); // eslint-disable-line

  const abrirAlta = () => { setEditando(null); setForm(FORM_VACIO); setModalAbierto(true); };
  const abrirEdicion = (f) => {
    setEditando(f);
    setForm({
      nombre: f.nombre || '',
      codigo: f.codigo || '',
      descripcion: f.descripcion || '',
      padreId: f.padreId ? String(f.padreId) : '',
      raiz: f.raiz || '',
      nombreFantasia: f.nombreFantasia || '',
    });
    setModalAbierto(true);
  };

  const guardar = async () => {
    try {
      let payload;
      if (tab === 'autores') payload = { nombre: form.nombre };
      else if (tab === 'materias') payload = { codigo: form.codigo || null, descripcion: form.descripcion, padreId: form.padreId ? Number(form.padreId) : null };
      else payload = { raiz: form.raiz, nombre: form.nombre, nombreFantasia: form.nombreFantasia };

      if (editando) await apiDe().actualizar(editando.id, payload);
      else await apiDe().crear(payload);
      setMensaje(`${nombreEntidad()} ${editando ? 'actualizado/a' : 'creado/a'} ✓`);
      setModalAbierto(false);
      cargar();
    } catch (err) { setMensaje(`⚠️ ${err.message}`); }
  };

  const eliminar = async (f) => {
    const label = tab === 'autores' ? f.nombre : tab === 'materias' ? f.descripcion : f.nombre;
    if (!window.confirm(`¿Eliminar "${label}"?`)) return;
    try {
      await apiDe().eliminar(f.id);
      setMensaje('Eliminado ✓');
      cargar();
    } catch (err) { setMensaje(`⚠️ ${err.message}`); }
  };

  const observar = async (f) => {
    try {
      const res = await observacionesApi.editorial(f.id);
      setMensaje(`Observación de ${res.data.nombre}: ${res.data.observacion}`);
      cargar();
    } catch (err) { setMensaje(`⚠️ ${err.message}`); }
  };

  function acciones(f) {
    return (
      <div className="flex gap-2">
        {tab === 'editoriales' && f.observacionLlm && <span title={f.observacionLlm} className="text-xs">🧠</span>}
        <button type="button" className="btn btn-ghost text-xs" onClick={() => abrirEdicion(f)}>Editar</button>
        {tab === 'editoriales' && (
          <button type="button" className="btn btn-ghost text-xs" onClick={() => observar(f)}>Observar</button>
        )}
        <button type="button" className="btn btn-ghost text-xs" style={{ color: 'var(--danger)' }} onClick={() => eliminar(f)}>Eliminar</button>
      </div>
    );
  }

  const columnas = tab === 'autores'
    ? [
        { clave: 'id', titulo: 'ID' },
        { clave: 'nombre', titulo: 'Autor' },
        { clave: 'usos', titulo: 'Títulos' },
        { clave: 'acciones', titulo: '', render: acciones },
      ]
    : tab === 'materias'
      ? [
          { clave: 'id', titulo: 'ID' },
          { clave: 'codigo', titulo: 'Código', render: (f) => f.codigo || '—' },
          { clave: 'descripcion', titulo: 'Materia' },
          { clave: 'usos', titulo: 'Títulos' },
          { clave: 'acciones', titulo: '', render: acciones },
        ]
      : [
          { clave: 'id', titulo: 'ID' },
          { clave: 'raiz', titulo: 'Raíz ISBN', render: (f) => f.raiz || '—' },
          { clave: 'nombre', titulo: 'Editorial' },
          { clave: 'nombreFantasia', titulo: 'Fantasía', render: (f) => f.nombreFantasia || '—' },
          { clave: 'titulos', titulo: 'Títulos' },
          { clave: 'acciones', titulo: '', render: acciones },
        ];

  const esAutores = tab === 'autores';
  const esMaterias = tab === 'materias';
  const esEditoriales = tab === 'editoriales';

  return (
    <div>
      <DebugTag nombre="ReferenciasPage" />
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold">Referencias del catálogo</h2>
        <span className="text-xs text-muted">autores · materias · editoriales (bookerp)</span>
      </div>

      {mensaje && <p className="text-sm mb-3">{mensaje}</p>}

      <div className="flex gap-1 mb-4 flex-wrap">
        {TABS.map((t) => (
          <button key={t.id} type="button" className={`btn ${tab === t.id ? 'btn-primary' : 'btn-ghost'}`} onClick={() => { setTab(t.id); setSearch(''); }}>{t.label}</button>
        ))}
      </div>

      <div className="flex items-center gap-2 mb-4">
        <input className="input-os" style={{ maxWidth: 320 }} placeholder={esAutores ? 'Buscar autor...' : esMaterias ? 'Buscar materia...' : 'Buscar editorial...'} value={search} onChange={(e) => setSearch(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { setPage(1); cargar(tab, 1); } }} />
        <button type="button" className="btn btn-ghost text-xs" onClick={() => cargar()}>Buscar</button>
        <div className="flex-1" />
        <BotonSecretario
          className="btn btn-ghost text-xs"
          consulta={`Estoy viendo las referencias (${tab}). Hay ${filas.length} registros. ¿Que me sugeris?`}
        />
        <button type="button" className="btn btn-primary text-xs" onClick={abrirAlta}>{esAutores ? '+ Autor' : esMaterias ? '+ Materia' : '+ Editorial'}</button>
      </div>

      <Table columnas={columnas} filas={filas} vacio={esAutores ? 'Sin autores' : esMaterias ? 'Sin materias' : 'Sin editoriales'} exportable exportarNombre={tab} />
      <Paginador page={page} total={total} limite={25} onCambiar={setPage} etiqueta={tab} />

      <Modal
        abierto={modalAbierto}
        onClose={() => setModalAbierto(false)}
        titulo={editando ? `Editar ${nombreEntidad()}` : `Nuevo ${nombreEntidad()}`}
        ancho="420px"
        footer={
          <>
            <button type="button" className="btn btn-ghost" onClick={() => setModalAbierto(false)}>Cancelar</button>
            <button type="button" className="btn btn-primary" disabled={esAutores ? !form.nombre : esMaterias ? !form.descripcion : !form.nombre} onClick={guardar}>Guardar</button>
          </>
        }
      >
        {esAutores && (
          <label className="block">
            <span className="block text-xs uppercase tracking-widest text-muted mb-1">Nombre del autor</span>
            <input className="input-os" value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} placeholder="Borges, Jorge Luis" />
          </label>
        )}
        {esMaterias && (
          <>
            <label className="block mb-3">
              <span className="block text-xs uppercase tracking-widest text-muted mb-1">Descripción</span>
              <input className="input-os" value={form.descripcion} onChange={(e) => setForm({ ...form, descripcion: e.target.value })} placeholder="INFANTILES, FICCION..." />
            </label>
            <div className="grid gap-3" style={{ gridTemplateColumns: '1fr 1fr' }}>
              <label className="block">
                <span className="block text-xs uppercase tracking-widest text-muted mb-1">Código</span>
                <input className="input-os" value={form.codigo} onChange={(e) => setForm({ ...form, codigo: e.target.value })} placeholder="INF" />
              </label>
              <label className="block">
                <span className="block text-xs uppercase tracking-widest text-muted mb-1">Materia padre (ID)</span>
                <input className="input-os" type="number" value={form.padreId} onChange={(e) => setForm({ ...form, padreId: e.target.value })} placeholder="Opcional" />
              </label>
            </div>
          </>
        )}
        {esEditoriales && (
          <>
            <label className="block mb-3">
              <span className="block text-xs uppercase tracking-widest text-muted mb-1">Nombre (razón social)</span>
              <input className="input-os" value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} placeholder="SUSAETA" />
            </label>
            <div className="grid gap-3" style={{ gridTemplateColumns: '1fr 1fr' }}>
              <label className="block">
                <span className="block text-xs uppercase tracking-widest text-muted mb-1">Raíz ISBN</span>
                <input className="input-os" value={form.raiz} onChange={(e) => setForm({ ...form, raiz: e.target.value })} placeholder="978987" />
              </label>
              <label className="block">
                <span className="block text-xs uppercase tracking-widest text-muted mb-1">Nombre de fantasía</span>
                <input className="input-os" value={form.nombreFantasia} onChange={(e) => setForm({ ...form, nombreFantasia: e.target.value })} placeholder="Tikal" />
              </label>
            </div>
            <p className="text-xs text-muted mt-3">La raíz se guarda limpia (solo dígitos) y sirve para resolver la editorial de un ISBN.</p>
          </>
        )}
      </Modal>
    </div>
  );
}
