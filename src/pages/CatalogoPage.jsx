// BookOS - CatalogoPage.jsx
// ruta: bookos/frontend/src/pages/CatalogoPage.jsx
// descripcion: catalogo enriquecido. Listado paginado + busqueda hibrida semantica
//   + modal de alta/edicion (todo en modal, nada borra trabajo).

import { useEffect, useRef, useState } from 'react';
import Table from '../ui/Table';
import Modal from '../ui/Modal';
import Input from '../ui/Input';
import DebugTag from '../ui/DebugTag';
import Paginador from '../ui/Paginador';
import SelectBuscador from '../ui/SelectBuscador';
import { buscarProveedores, buscarAutores, buscarEditoriales, buscarMaterias } from '../utils/selectores';
import { catalogoApi, editorialesApi } from '../api/api';
import { useAppContext } from '../AppContext';

// El stock vive en el ledger (movimientos_stock): no viaja en el payload de alta/edicion.
const CAMPOS_STOCK = ['stock', 'stockDeposito', 'stockConsigna', 'stockConsignaOriginal', 'esConsignacion', 'stockTotal'];
const sinStock = (fila) => {
  const copia = { ...fila };
  for (const campo of CAMPOS_STOCK) delete copia[campo];
  return copia;
};

// Campo de texto libre con sugerencias asincronicas del maestro (el backend resuelve por
// nombre y crea si falta): lo tipeado vale tal cual, la sugerencia completa con el nombre oficial.
function CampoTexto({ label, campo, form, setForm, buscar, placeholder }) {
  return (
    <label className="block mb-3">
      <span className="field-label">{label}</span>
      <SelectBuscador
        textoInicial={form[campo] || ''}
        placeholder={placeholder || `Buscar ${label.toLowerCase()}...`}
        buscar={buscar}
        onTexto={(texto) => setForm({ ...form, [campo]: texto })}
        onSeleccionar={(it) => setForm({ ...form, [campo]: it ? it.etiqueta : '' })}
      />
    </label>
  );
}

export default function CatalogoPage() {
  const [filas, setFilas] = useState([]);
  const [provNombre, setProvNombre] = useState('');
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [semantico, setSemantico] = useState(null);
  const [modal, setModal] = useState(false);
  const [editando, setEditando] = useState(null);
  const [form, setForm] = useState({});
  const [error, setError] = useState('');
  const [stockActual, setStockActual] = useState(null);
  const [kardex, setKardex] = useState(null);
  const { instruccionVista, emitirInstruccion } = useAppContext();
  const ultimaInstruccion = useRef(null);

  const cargar = async () => {
    try {
      const res = await catalogoApi.listar({ page, limit: 20, search });
      setFilas(res.data || []);
      setTotal(res.pagination ? res.pagination.total : 0);
    } catch (err) { setError(err.message); }
  };

  // Debounce 400 ms: recarga mientras se tipea (volviendo a pagina 1) o al cambiar de pagina.
  useEffect(() => {
    const t = setTimeout(() => { cargar(); }, 400);
    return () => clearTimeout(t);
  }, [page, search]); // eslint-disable-line

  const buscarSemantico = async () => {
    setSemantico(null);
    try {
      const res = await catalogoApi.buscar(search, 15);
      setSemantico(res.data);
    } catch (err) { setError(err.message); }
  };

  // El buscador F6 (que vive en el shell, desde cualquier vista) puede pedir abrir la ficha de un
  // articulo. La instruccion se consume UNA vez y se limpia, para no reabrirla al volver aca.
  useEffect(() => {
    if (!instruccionVista || instruccionVista.dominio !== 'catalogo' || instruccionVista.accion !== 'abrir_ficha') return;
    if (instruccionVista.ts === ultimaInstruccion.current) return;
    ultimaInstruccion.current = instruccionVista.ts;
    const articuloId = instruccionVista.data && instruccionVista.data.articuloId;
    if (articuloId) verKardex({ id: articuloId });
    emitirInstruccion(null);
  }, [instruccionVista]); // eslint-disable-line

  const abrirNuevo = () => { setEditando(null); setForm({}); setStockActual(null); setError(''); setProvNombre(''); setModal(true); };
  const abrirEditar = (fila) => {
    setEditando(fila);
    setForm(sinStock(fila));
    setStockActual(fila.stockTotal ?? ((fila.stock || 0) + (fila.stockDeposito || 0)));
    setProvNombre(fila.proveedor || '');
    setError('');
    setModal(true);
  };

  const verKardex = async (fila) => {
    try {
      const res = await catalogoApi.kardex(fila.id);
      setKardex(res.data || res);
    } catch (err) { setError(err.message); }
  };

  // bookerp: si no hay editorial escrita, se resuelve por la raiz del ISBN al salir del campo.
  const resolverEditorialPorIsbn = async (isbn) => {
    if (!isbn || form.editorial) return;
    try {
      const res = await editorialesApi.resolver(isbn);
      const ed = res.data || res;
      if (ed && ed.nombre) setForm((f) => ({ ...f, editorial: ed.nombre }));
    } catch { /* sin coincidencia: no interrumpe la carga */ }
  };

  const guardar = async () => {
    try {
      const payload = sinStock(form);
      if (editando) await catalogoApi.actualizar(editando.id, payload);
      else await catalogoApi.crear(payload);
      setModal(false);
      cargar();
    } catch (err) { setError(err.message); }
  };

  const eliminar = async (f) => {
    if (!window.confirm(`¿Dar de baja "${f.titulo}"? (baja logica, bookerp)`)) return;
    try {
      await catalogoApi.eliminar(f.id);
      cargar();
    } catch (err) { setError(err.message); }
  };

  const columnasKardex = [
    { clave: 'fecha', titulo: 'Fecha', render: (m) => new Date(m.fecha).toLocaleDateString('es-AR') },
    { clave: 'tipo', titulo: 'Tipo' },
    { clave: 'tipoStock', titulo: 'Stock' },
    { clave: 'cantidad', titulo: 'Cantidad', render: (m) => (m.cantidad > 0 ? `+${m.cantidad}` : String(m.cantidad)) },
    { clave: 'origen', titulo: 'Origen', render: (m) => `${m.origenTipo}${m.origenId ? ` #${m.origenId}` : ''}` },
    { clave: 'deposito', titulo: 'Deposito', render: (m) => (m.deposito ? m.deposito.nombre : '-') },
  ];

  const columnas = [
    { clave: 'ean13', titulo: 'EAN13', render: (f) => <span className="font-mono text-xs">{f.ean13}</span> },
    { clave: 'titulo', titulo: 'Titulo' },
    { clave: 'autor', titulo: 'Autor' },
    { clave: 'editorial', titulo: 'Editorial' },
    { clave: 'precio', titulo: 'Precio', render: (f) => `$${Number(f.precio).toLocaleString('es-AR')}` },
    { clave: 'stock', titulo: 'Stock', render: (f) => f.stock + f.stockDeposito },
    { clave: 'acciones', titulo: '', render: (f) => (
      <div className="flex gap-2">
        <button type="button" className="btn btn-ghost text-xs" onClick={() => verKardex(f)}>Ver</button>
        <button type="button" className="btn btn-ghost text-xs" onClick={() => abrirEditar(f)}>Editar</button>
        <button type="button" className="btn btn-ghost text-xs" style={{ color: 'var(--danger)' }} onClick={() => eliminar(f)}>Baja</button>
      </div>
    ) },
  ];

  return (
    <div>
      <DebugTag nombre="CatalogoPage" />
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <h2 className="text-lg font-semibold">Catalogo enriquecido</h2>
        <button type="button" className="btn btn-primary" onClick={abrirNuevo}>Nuevo articulo</button>
      </div>

      <div className="flex gap-2 mb-4 flex-wrap">
        <input
          className="input-os"
          style={{ minWidth: 200, flex: '1 1 200px' }}
          placeholder="Buscar titulo, autor, editorial, EAN..."
          value={search}
          onChange={(e) => { setSearch(e.target.value); if (page !== 1) setPage(1); }}
          onKeyDown={(e) => { if (e.key === 'Enter') cargar(); }}
        />
        <button type="button" className="btn" onClick={cargar}>Filtrar</button>
        <button type="button" className="btn" onClick={buscarSemantico}>Busqueda semantica</button>
      </div>

      {error && <p className="text-sm mb-3" style={{ color: 'var(--danger)' }}>{error}</p>}

      {semantico && (
        <div className="mb-4">
          <div className="text-xs text-muted mb-2">
            Intencion: {semantico.intencion} · pesos {JSON.stringify(semantico.perfil)} · desglose auditado
          </div>
          {semantico.resultados.slice(0, 10).map((r) => (
            <div key={r.ean13} className="card p-3 mb-2 flex justify-between items-center">
              <div>
                <div className="font-medium text-sm">{r.titulo}</div>
                <div className="text-xs text-muted">{r.autor} · {r.editorial}</div>
              </div>
              <div className="text-right">
                <div className="text-xs font-mono text-muted">{(r.score || 0).toFixed(3)}</div>
                <div className="text-xs">{r.stock + r.stockDeposito} en stock</div>
              </div>
            </div>
          ))}
        </div>
      )}

      <Table columnas={columnas} filas={filas} vacio="Cargando catalogo..." />

      <Paginador page={page} total={total} limite={20} onCambiar={setPage} etiqueta="articulos" />

      <Modal
        abierto={modal}
        onClose={() => setModal(false)}
        titulo={editando ? 'Editar articulo' : 'Nuevo articulo'}
        ancho={680}
        footer={(
          <div className="flex gap-2">
            <button type="button" className="btn" onClick={() => setModal(false)}>Cancelar</button>
            <button type="button" className="btn btn-primary" onClick={guardar}>Guardar</button>
          </div>
        )}
      >
        {error && <p className="text-sm mb-3" style={{ color: 'var(--danger)' }}>{error}</p>}
        <div className="form-grid">
          <Input label="EAN13 / barras" value={form.ean13 || ''} onChange={(e) => setForm({ ...form, ean13: e.target.value })} disabled={Boolean(editando)} />
          <Input label="ISBN" value={form.isbn || ''} onChange={(e) => setForm({ ...form, isbn: e.target.value })} onBlur={() => resolverEditorialPorIsbn(form.isbn)} />
        </div>
        <Input label="Titulo" value={form.titulo || ''} onChange={(e) => setForm({ ...form, titulo: e.target.value })} />
        <p className="text-xs text-muted mb-3">
          Autores y materias que no existan se crean solos al guardar (unico por nombre).
          Si el ISBN tiene editorial conocida, se completa al salir de ese campo.
        </p>
        <div className="form-grid">
          <CampoTexto label="Autor" campo="autor" form={form} setForm={setForm} buscar={buscarAutores} />
          <CampoTexto label="Editorial" campo="editorial" form={form} setForm={setForm} buscar={buscarEditoriales} />
          <CampoTexto label="Autor 2" campo="autor2" form={form} setForm={setForm} buscar={buscarAutores} />
          <CampoTexto label="Autor 3" campo="autor3" form={form} setForm={setForm} buscar={buscarAutores} />
          <CampoTexto label="Materia" campo="tema" form={form} setForm={setForm} buscar={buscarMaterias} />
          <CampoTexto label="Materia 2" campo="tema2" form={form} setForm={setForm} buscar={buscarMaterias} />
          <Input label="Costo" type="number" value={form.costo ?? ''} onChange={(e) => setForm({ ...form, costo: e.target.value === '' ? null : Number(e.target.value) })} />
          <Input label="Precio de lista" type="number" value={form.precio ?? ''} onChange={(e) => setForm({ ...form, precio: e.target.value === '' ? null : Number(e.target.value) })} />
        </div>
        <label className="block mb-3">
          <span className="field-label">Proveedor</span>
          <SelectBuscador
            valor={form.proveedorId || null}
            etiquetaValor={provNombre}
            placeholder="Buscar proveedor..."
            buscar={buscarProveedores}
            onSeleccionar={(it) => { setForm({ ...form, proveedorId: it ? it.id : null }); setProvNombre(it ? it.etiqueta : ''); }}
          />
        </label>
        {editando ? (
          <p className="text-xs text-muted">
            Stock firme actual: <strong>{stockActual ?? 0}</strong>. Se ajusta por inventario (ledger), no se edita aca.
          </p>
        ) : (
          <p className="text-xs text-muted">
            El stock no se carga en el alta: ingresa por compra, inventario o transferencia.
          </p>
        )}
      </Modal>

      <Modal
        abierto={Boolean(kardex)}
        onClose={() => setKardex(null)}
        titulo={kardex ? `Kardex - ${kardex.titulo}` : 'Kardex'}
        ancho={820}
      >
        {kardex && (
          <>
            <div className="text-xs text-muted mb-3">
              {kardex.ean13} · codigo {kardex.codigo} · ultimos {kardex.movimientos.length} movimientos del ledger
            </div>
            <Table columnas={columnasKardex} filas={kardex.movimientos} vacio="Sin movimientos de stock" />
          </>
        )}
      </Modal>
    </div>
  );
}
