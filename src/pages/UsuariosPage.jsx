// BookOS - UsuariosPage.jsx
// ruta: bookos/frontend/src/pages/UsuariosPage.jsx
// descripcion: ABM de usuarios con la regla indegradable visible: el ultimo admin
//   no se puede borrar, desactivar ni degradar (el backend lo bloquea).

import { useEffect, useState } from 'react';
import Table from '../ui/Table';
import Paginador from '../ui/Paginador';
import Modal from '../ui/Modal';
import Input from '../ui/Input';
import DebugTag from '../ui/DebugTag';
import { usuariosApi } from '../api/api';

export default function UsuariosPage({ esAdmin }) {
  const [usuarios, setUsuarios] = useState([]);
  const [paginaU, setPaginaU] = useState(1);
  const LIMITE_PAG = 25;
  const [modal, setModal] = useState(false);
  const [editando, setEditando] = useState(null);
  const [resetUsuario, setResetUsuario] = useState(null);
  const [passNueva, setPassNueva] = useState('');
  const [passRepetir, setPassRepetir] = useState('');
  const [form, setForm] = useState({});
  const [mensaje, setMensaje] = useState('');

  const cargar = async () => {
    try {
      const res = await usuariosApi.listar();
      setUsuarios(res.data || []);
    } catch (err) { setMensaje(`⚠️ ${err.message}`); }
  };

  useEffect(() => { cargar(); }, []); // eslint-disable-line

  if (!esAdmin) {
    return <p className="text-muted">Solo administradores gestionan usuarios.</p>;
  }

  const guardar = async () => {
    try {
      await usuariosApi.crear(form);
      setModal(false);
      setForm({});
      cargar();
    } catch (err) { setMensaje(`⚠️ ${err.message}`); }
  };

  const cambiarRol = async (usuario) => {
    const nuevoRol = usuario.rol === 'admin' ? 'vendedor' : 'admin';
    try {
      await usuariosApi.actualizar(usuario.id, { rol: nuevoRol });
      cargar();
    } catch (err) { setMensaje(`⚠️ ${err.message}`); }
  };

  const abrirEditar = (u) => {
    setEditando(u);
    setForm({ nombre: u.nombre || '', rol: u.rol || 'vendedor', activo: u.activo !== false });
  };

  const guardarEdicion = async () => {
    try {
      await usuariosApi.actualizar(editando.id, { nombre: form.nombre, rol: form.rol, activo: form.activo });
      setMensaje(`Usuario ${editando.email} actualizado ✓`);
      setEditando(null);
      cargar();
    } catch (err) { setMensaje(`⚠️ ${err.message}`); }
  };

  const abrirReset = (u) => { setResetUsuario(u); setPassNueva(''); setPassRepetir(''); };

  const guardarReset = async () => {
    if (!passNueva) { setMensaje('⚠️ La contrasena nueva no puede estar vacia'); return; }
    if (passNueva !== passRepetir) { setMensaje('⚠️ Las contrasenas no coinciden'); return; }
    try {
      await usuariosApi.actualizar(resetUsuario.id, { password: passNueva });
      setMensaje(`Contrasena de ${resetUsuario.email} actualizada ✓`);
      setResetUsuario(null);
    } catch (err) { setMensaje(`⚠️ ${err.message}`); }
  };

  const eliminar = async (usuario) => {
    if (!window.confirm(`¿Eliminar el usuario ${usuario.email}?`)) return;
    try {
      await usuariosApi.eliminar(usuario.id);
      cargar();
    } catch (err) { setMensaje(`⚠️ ${err.message}`); }
  };

  const columnas = [
    { clave: 'email', titulo: 'Email' },
    { clave: 'nombre', titulo: 'Nombre' },
    { clave: 'rol', titulo: 'Rol' },
    { clave: 'activo', titulo: 'Activo', render: (u) => (u.activo === false ? 'No' : 'Si') },
    { clave: 'acciones', titulo: '', render: (u) => (
      <div className="flex gap-2">
        <button type="button" className="btn btn-ghost text-xs" onClick={() => abrirEditar(u)}>Editar</button>
        <button type="button" className="btn btn-ghost text-xs" onClick={() => abrirReset(u)}>Reset pass</button>
        <button type="button" className="btn btn-ghost text-xs" onClick={() => cambiarRol(u)}>
          {u.rol === 'admin' ? 'Degradar' : 'Hacer admin'}
        </button>
        <button type="button" className="btn btn-ghost text-xs" style={{ color: 'var(--danger)' }} onClick={() => eliminar(u)}>
          Eliminar
        </button>
      </div>
    ) },
  ];

  return (
    <div>
      <DebugTag nombre="UsuariosPage" />
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold">Usuarios</h2>
        <button type="button" className="btn btn-primary" onClick={() => setModal(true)}>Nuevo usuario</button>
      </div>
      {mensaje && <p className="text-sm mb-3">{mensaje}</p>}
      <p className="text-xs text-muted mb-3">Regla indegradable: no se puede eliminar, desactivar ni degradar al ultimo admin.</p>
      <Table columnas={columnas} filas={usuarios.slice((paginaU - 1) * LIMITE_PAG, paginaU * LIMITE_PAG)} />
      <Paginador page={paginaU} total={usuarios.length} limite={LIMITE_PAG} onCambiar={setPaginaU} etiqueta="usuarios" />

      <Modal abierto={modal} onClose={() => setModal(false)} titulo="Nuevo usuario" ancho="420px"
        footer={<button type="button" className="btn btn-primary" onClick={guardar}>Crear</button>}
      >
        <Input label="Email" value={form.email || ''} onChange={(e) => setForm({ ...form, email: e.target.value })} />
        <Input label="Nombre" value={form.nombre || ''} onChange={(e) => setForm({ ...form, nombre: e.target.value })} />
        <label className="block mb-3">
          <span className="block text-xs uppercase tracking-widest text-muted mb-1">Rol</span>
          <select className="input-os" value={form.rol || 'vendedor'} onChange={(e) => setForm({ ...form, rol: e.target.value })}>
            <option value="vendedor">vendedor</option>
            <option value="admin">admin</option>
          </select>
        </label>
        <Input label="Password" type="password" value={form.password || ''} onChange={(e) => setForm({ ...form, password: e.target.value })} />
      </Modal>

      <Modal abierto={Boolean(editando)} onClose={() => setEditando(null)} titulo={editando ? `Editar usuario - ${editando.email}` : ''} ancho="420px"
        footer={(
          <>
            <button type="button" className="btn btn-ghost" onClick={() => setEditando(null)}>Cancelar</button>
            <button type="button" className="btn btn-primary" disabled={!form.nombre} onClick={guardarEdicion}>Guardar</button>
          </>
        )}
      >
        <Input label="Nombre" value={form.nombre || ''} onChange={(e) => setForm({ ...form, nombre: e.target.value })} />
        <label className="block mb-3">
          <span className="block text-xs uppercase tracking-widest text-muted mb-1">Rol</span>
          <select className="input-os" value={form.rol || 'vendedor'} onChange={(e) => setForm({ ...form, rol: e.target.value })}>
            <option value="vendedor">vendedor</option>
            <option value="admin">admin</option>
          </select>
        </label>
        <label className="flex items-center gap-2 text-sm mb-3">
          <input type="checkbox" checked={form.activo !== false} onChange={(e) => setForm({ ...form, activo: e.target.checked })} /> Activo
        </label>
        <p className="text-xs text-muted">El email no se cambia (es la identidad del login). Para la clave esta "Reset pass".</p>
      </Modal>

      <Modal abierto={Boolean(resetUsuario)} onClose={() => setResetUsuario(null)} titulo={resetUsuario ? `Reset de contrasena - ${resetUsuario.email}` : ''} ancho="420px"
        footer={(
          <>
            <button type="button" className="btn btn-ghost" onClick={() => setResetUsuario(null)}>Cancelar</button>
            <button type="button" className="btn btn-primary" onClick={guardarReset}>Cambiar contrasena</button>
          </>
        )}
      >
        <Input label="Contrasena nueva" type="password" value={passNueva} onChange={(e) => setPassNueva(e.target.value)} />
        <Input label="Repetir contrasena" type="password" value={passRepetir} onChange={(e) => setPassRepetir(e.target.value)} />
        <p className="text-xs text-muted">La contrasena se guarda hasheada (bcrypt), igual que en el alta.</p>
      </Modal>
    </div>
  );
}
