// BookOS - Navbar.jsx
// ruta: bookos/frontend/src/ui/Navbar.jsx
// descripcion: navegacion del OS agrupada en bloques semanticos. En escritorio cada grupo es un
//   desplegable (el grupo que contiene la vista actual queda resaltado); en pantallas chicas la
//   navegacion se muda a una BARRA INFERIOR estilo SO (KDE): lanzador "Menú" + accesos fijos, y
//   el menu completo se abre como panel agrupado por modulos. Cambiar de pagina NO borra trabajo.

import { useEffect, useRef, useState } from 'react';
import ManualBlock from '../blocks/ManualBlock';

// Estructura extensible: agrega vistas nuevas dentro de su grupo (o crea uno nuevo).
// La division es por FLUJO (decision del vectorHumano, 2026-09-12):
//   Ventas  = entra dinero, sale mercaderia.
//   Compras = entra mercaderia, sale dinero (incluye remitos y consigna).
const GRUPOS = [
  { nombre: 'Ventas', items: ['Facturar', 'Caja', 'Ventas del dia/periodo', 'Clientes', 'Cuenta corriente cliente', 'Newsletter'] },
  { nombre: 'Compras', items: ['Compras', 'Remitos', 'Proveedores', 'Cuenta corriente proveedor', 'Consigna'] },
  { nombre: 'Stock', items: ['Inventario', 'Transportes', 'Mayorista'] },
  { nombre: 'Catalogo', items: ['Catalogo', 'Referencias'] },
  { nombre: 'CRM', items: ['Pedidos', 'Radar', 'Propuestas', 'Campañas', 'Config CRM', 'Plantillas mail'] },
  {
    // Core agrupa los cuatro modulos portables (pedido del vectorHumano, 2026-09-20): kernel,
    // router, agent y llm, en espejo de `backend/src/core/`. `directos` = lo que se EXIME de los
    // submenus (Salud: sus tarjetas no son configuracion de un modulo). `submenus` = la
    // configuracion de cada modulo, con su rotulo propio cuando la vista sirve a dos modulos.
    nombre: 'Core',
    directos: [{ vista: 'Salud', label: 'Salud (exenta)' }],
    submenus: [
      { nombre: 'Kernel', items: [{ vista: 'Pesos del buscador' }, { vista: 'Banco del buscador' }, { vista: 'Enriquecimiento' }, { vista: 'Propuestas Kernel' }, { vista: 'Cola' }, { vista: 'Memoria' }] },
      { nombre: 'Router', items: [{ vista: 'Pesos del router' }, { vista: 'Banco del router' }] },
      { nombre: 'Agent', items: [{ vista: 'Agente' }, { vista: 'Perfiles' }] },
      { nombre: 'LLM', items: [{ vista: 'Modelo local' }, { vista: 'Banco del modelo chico' }] },
      { nombre: 'Logs', items: [{ vista: 'Logs', label: 'Logs del core' }] },
    ],
  },
  { nombre: 'Sistema', items: ['Config', 'Empresa', 'Usuarios', 'Parametros', 'Importador', 'Desarrollo'] },
];

// Accesos fijos de la barra movil (los que se usan en el mostrador). El resto vive en el lanzador.
const PINNADOS = [
  { vista: 'Facturar', label: 'Facturar', icono: '🧾' },
  { vista: 'Caja', label: 'Caja', icono: '💵' },
  { vista: 'Catalogo', label: 'Catálogo', icono: '📚' },
];

export default function Navbar({ vista, onCambiarVista, usuario, onLogout, asistenteAbierto = false, onAlternarAsistente = null, secretarioAbierto = false, onAlternarSecretario = null }) {
  const [abierto, setAbierto] = useState(null);
  const [subAbierto, setSubAbierto] = useState(null);
  const ref = useRef(null);
  const [manualAbierto, setManualAbierto] = useState(false);
  // Barra movil (estilo SO): el lanzador abre el menu completo agrupado por modulos.
  const [sheetAbierto, setSheetAbierto] = useState(false);

  useEffect(() => {
    const alClicFuera = (e) => { if (ref.current && !ref.current.contains(e.target)) { setAbierto(null); setSubAbierto(null); } };
    const alEscape = (e) => { if (e.key === 'Escape') { setAbierto(null); setSubAbierto(null); setSheetAbierto(false); } };
    document.addEventListener('mousedown', alClicFuera);
    document.addEventListener('keydown', alEscape);
    return () => {
      document.removeEventListener('mousedown', alClicFuera);
      document.removeEventListener('keydown', alEscape);
    };
  }, []);

  const elegir = (item) => { onCambiarVista(item); setAbierto(null); setSubAbierto(null); setSheetAbierto(false); };

  const abrirManual = () => setManualAbierto(true);

  return (
    <>
    <header
      ref={ref}
      className="relative flex items-center gap-1 px-4 py-3 flex-wrap"
      style={{ borderBottom: '1px solid var(--border)', background: 'var(--card)', zIndex: 50 }}
    >
      <span className="font-black tracking-tight mr-4">Book<span style={{ color: 'var(--accent)' }}>OS</span></span>

      <nav className="nav-escritorio flex gap-1 flex-1 flex-wrap">
        {GRUPOS.map((grupo) => {
          const itemsDe = (g) => (g.submenus ? [...(g.directos || []), ...g.submenus.flatMap((s) => s.items)] : g.items.map((i) => ({ vista: i, label: i })));
          const activo = itemsDe(grupo).some((it) => it.vista === vista);
          const desplegado = abierto === grupo.nombre;
          const rotulo = (it) => it.label || it.vista;
          return (
            <div key={grupo.nombre} className="relative">
              <button
                type="button"
                className={`btn ${activo ? 'btn-primary' : 'btn-ghost'}`}
                onClick={() => { setAbierto(desplegado ? null : grupo.nombre); setSubAbierto(null); }}
              >
                {grupo.nombre} <span className="text-xs opacity-70">▾</span>
              </button>
              {desplegado && (
                <div className="absolute left-0 top-full mt-1 card p-1 z-50 min-w-[200px]">
                  {grupo.submenus ? (
                    <>
                      {(grupo.directos || []).map((it) => (
                        <button
                          key={`directo-${it.vista}`}
                          type="button"
                          className={`w-full text-left px-3 py-2 rounded text-sm ${vista === it.vista ? 'btn-primary' : 'btn-ghost'}`}
                          onClick={() => elegir(it.vista)}
                        >
                          {rotulo(it)}
                        </button>
                      ))}
                      {grupo.submenus.map((sub) => {
                        const subActivo = sub.items.some((it) => it.vista === vista);
                        const subDesplegado = subAbierto === sub.nombre;
                        return (
                          <div
                            key={sub.nombre}
                            className="relative"
                            onMouseEnter={() => setSubAbierto(sub.nombre)}
                            onMouseLeave={() => setSubAbierto(null)}
                          >
                            <button
                              type="button"
                              className={`w-full text-left px-3 py-2 rounded text-sm flex items-center justify-between ${subActivo ? 'btn-primary' : 'btn-ghost'}`}
                              onClick={() => setSubAbierto(subDesplegado ? null : sub.nombre)}
                            >
                              <span>{sub.nombre}</span><span className="text-xs opacity-70">›</span>
                            </button>
                            {subDesplegado && (
                              <div className="absolute left-full top-0 ml-1 card p-1 z-50 min-w-[200px]">
                                {sub.items.map((it) => (
                                  <button
                                    key={`${sub.nombre}-${it.vista}-${it.label || ''}`}
                                    type="button"
                                    className={`w-full text-left px-3 py-2 rounded text-sm ${vista === it.vista ? 'btn-primary' : 'btn-ghost'}`}
                                    onClick={() => elegir(it.vista)}
                                  >
                                    {rotulo(it)}
                                  </button>
                                ))}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </>
                  ) : (
                    grupo.items.map((item) => (
                      <button
                        key={item}
                        type="button"
                        className={`w-full text-left px-3 py-2 rounded text-sm ${vista === item ? 'btn-primary' : 'btn-ghost'}`}
                        onClick={() => elegir(item)}
                      >
                        {item}
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>
          );
        })}
      </nav>

      <span className="text-xs text-muted hidden md:block">{usuario ? usuario.nombre : ''}</span>
      {typeof onAlternarAsistente === 'function' && (
        <button
          type="button"
          className={`btn text-xs whitespace-nowrap ${asistenteAbierto ? 'btn-primary' : 'btn-ghost'}`}
          onClick={onAlternarAsistente}
          title={asistenteAbierto ? 'Cerrar el Vendedor' : 'Abrir el Vendedor (asistente de ventas, ventana izquierda)'}
        >
          💬 Vendedor
        </button>
      )}
      <button type="button" className="btn btn-ghost text-xs whitespace-nowrap" onClick={abrirManual}>Manual</button>
      {typeof onAlternarSecretario === 'function' && (
        <button
          type="button"
          className={`btn text-xs whitespace-nowrap ${secretarioAbierto ? 'btn-primary' : 'btn-ghost'}`}
          onClick={onAlternarSecretario}
          title={secretarioAbierto ? 'Cerrar el Secretario' : 'Abrir el Secretario (ventana derecha)'}
        >
          💬 Secretario
        </button>
      )}
      <button type="button" className="btn btn-ghost text-muted" onClick={onLogout}>Salir</button>

      <ManualBlock abierto={manualAbierto} onClose={() => setManualAbierto(false)} esAdmin={Boolean(usuario && usuario.rol === 'admin')} />
    </header>

    {/* Barra inferior movil (estilo SO): lanzador + accesos fijos, al alcance del pulgar. */}
    <nav className="nav-movil">
      <button
        type="button"
        className={`nav-movil-btn${sheetAbierto ? ' activo' : ''}`}
        onClick={() => setSheetAbierto((v) => !v)}
      >
        <span className="nav-movil-icono">☰</span>
        <span>Menú</span>
      </button>
      {PINNADOS.map((fijo) => (
        <button
          key={fijo.vista}
          type="button"
          className={`nav-movil-btn${vista === fijo.vista ? ' activo' : ''}`}
          onClick={() => elegir(fijo.vista)}
        >
          <span className="nav-movil-icono">{fijo.icono}</span>
          <span>{fijo.label}</span>
        </button>
      ))}
    </nav>

    {sheetAbierto && (
      <>
        <div className="nav-sheet-overlay" onClick={() => setSheetAbierto(false)} />
        <section className="nav-sheet" aria-label="Menú de aplicaciones">
          <div className="nav-sheet-header">
            <span>Menú</span>
            <button type="button" className="btn btn-ghost text-xs" onClick={() => setSheetAbierto(false)}>✕</button>
          </div>
          <div className="nav-sheet-grupos">
            {GRUPOS.map((grupo) => (
              <div key={grupo.nombre} className="nav-sheet-grupo">
                <div className="nav-sheet-titulo">{grupo.nombre}</div>
                {grupo.submenus ? (
                  <>
                    {(grupo.directos || []).map((it) => (
                      <button
                        key={`m-${it.vista}`}
                        type="button"
                        className={`nav-sheet-item${vista === it.vista ? ' activo' : ''}`}
                        onClick={() => elegir(it.vista)}
                      >
                        {it.label || it.vista}
                      </button>
                    ))}
                    {grupo.submenus.map((sub) => (
                      <div key={sub.nombre} className="nav-sheet-sub">
                        <div className="nav-sheet-subtitulo">{sub.nombre}</div>
                        <div className="nav-sheet-items">
                          {sub.items.map((it) => (
                            <button
                              key={`m-${sub.nombre}-${it.vista}-${it.label || ''}`}
                              type="button"
                              className={`nav-sheet-item${vista === it.vista ? ' activo' : ''}`}
                              onClick={() => elegir(it.vista)}
                            >
                              {it.label || it.vista}
                            </button>
                          ))}
                        </div>
                      </div>
                    ))}
                  </>
                ) : (
                  <div className="nav-sheet-items">
                    {grupo.items.map((item) => (
                      <button
                        key={item}
                        type="button"
                        className={`nav-sheet-item${vista === item ? ' activo' : ''}`}
                        onClick={() => elegir(item)}
                      >
                        {item}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>
      </>
    )}
    </>
  );
}
