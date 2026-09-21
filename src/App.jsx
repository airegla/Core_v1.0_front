// BookOS - App.jsx
// ruta: bookos/frontend/src/App.jsx
// descripcion: shell del OS. Login JWT, navbar de 7 vistas y layout
//   contenido + Secretario lateral (persistente). Cambiar de vista no borra nada.

import { useCallback, useEffect, useState } from 'react';
import Navbar from './ui/Navbar';
import AgenteChatBlock from './blocks/AgenteChatBlock';
import BuscadorTecnicoBlock from './blocks/BuscadorTecnicoBlock';
import BuscadorSemanticoBlock from './blocks/BuscadorSemanticoBlock';
import AltaRapidaClienteBlock from './blocks/AltaRapidaClienteBlock';
import useAtajoGlobal from './hooks/useAtajoGlobal';
import CatalogoPage from './pages/CatalogoPage';
import VentasPage from './pages/VentasPage';
import VentasPeriodoPage from './pages/VentasPeriodoPage';
import RemitosPage from './pages/RemitosPage';
import CajaPage from './pages/CajaPage';
import ComprasPage from './pages/ComprasPage';
import ProveedoresPage from './pages/ProveedoresPage';
import ClientesPage from './pages/ClientesPage';
import CtaCtePage from './pages/CtaCtePage';
import TransportesPage from './pages/TransportesPage';
import ConsignaPage from './pages/ConsignaPage';
import MayoristaPage from './pages/MayoristaPage';
import InventarioPage from './pages/InventarioPage';
import NewsletterPage from './pages/NewsletterPage';
import ParametrosPage from './pages/ParametrosPage';
import ReferenciasPage from './pages/ReferenciasPage';
import ConfigPage from './pages/ConfigPage';
import EnriquecimientoPage from './pages/EnriquecimientoPage';
import EmpresaPage from './pages/EmpresaPage';
import UsuariosPage from './pages/UsuariosPage';
import DesarrolloPage from './pages/DesarrolloPage';
import SaludPage from './pages/SaludPage';
import PerfilesPage from './pages/PerfilesPage';
import PropuestasPage from './pages/PropuestasPage';
import PesosPage from './pages/PesosPage';
import BancoPruebasPage from './pages/BancoPruebasPage';
import ModeloLocalPage from './pages/ModeloLocalPage';
import LogsPage from './pages/LogsPage';
import ColaPage from './pages/ColaPage';
import MemoriaPage from './pages/MemoriaPage';
import AgentePage from './pages/AgentePage';
import PedidosPage from './pages/PedidosPage';
import RadarPage from './pages/RadarPage';
import PropuestasVentaPage from './pages/PropuestasVentaPage';
import CampaniasPage from './pages/CampaniasPage';
import AsistenteVentasBlock from './blocks/AsistenteVentasBlock';
import ConfigCrmPage from './pages/ConfigCrmPage';
import PlantillasMailPage from './pages/PlantillasMailPage';
import ImportadorPage from './pages/ImportadorPage';
import { authApi, configApi } from './api/api';
import { activarDebug, useDebugActivo } from './ui/DebugTag';
import { useAppContext } from './AppContext';

function Login({ onLogin }) {
  const [email, setEmail] = useState('admin@bookos.local');
  const [password, setPassword] = useState('admin123');
  const [error, setError] = useState('');
  const [cargando, setCargando] = useState(false);

  const entrar = async (e) => {
    e.preventDefault();
    setCargando(true);
    setError('');
    try {
      const res = await authApi.login(email, password);
      localStorage.setItem('bookos_token', res.data.token);
      // La clave de los borradores es por usuario: el id se guarda para usePersistentWork.
      if (res.data.user && res.data.user.id) localStorage.setItem('bookos_usuario_id', String(res.data.user.id));
      onLogin(res.data.user);
    } catch (err) {
      setError(err.message);
    } finally {
      setCargando(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--bg)' }}>
      <form className="card p-8 w-full max-w-sm" onSubmit={entrar}>
        <h1 className="text-2xl font-black mb-6">
          Book<span style={{ color: 'var(--accent)' }}>OS</span>
        </h1>
        <label className="block mb-3">
          <span className="block text-xs uppercase tracking-widest text-muted mb-1">Email</span>
          <input className="input-os" value={email} onChange={(e) => setEmail(e.target.value)} />
        </label>
        <label className="block mb-4">
          <span className="block text-xs uppercase tracking-widest text-muted mb-1">Password</span>
          <input className="input-os" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
        </label>
        {error && <p className="text-sm mb-3" style={{ color: 'var(--danger)' }}>{error}</p>}
        <button type="submit" className="btn btn-primary w-full" disabled={cargando}>
          {cargando ? 'Entrando...' : 'Entrar'}
        </button>
      </form>
    </div>
  );
}

export default function App() {
  const [usuario, setUsuario] = useState(null);
  const [vista, setVista] = useState('Catalogo');
  const [cargando, setCargando] = useState(true);
  const { setContextoActual, emitirInstruccion } = useAppContext();
  const debug = useDebugActivo();

  useEffect(() => {
    const token = localStorage.getItem('bookos_token');
    if (!token) {
      setCargando(false);
      return;
    }
    authApi.me()
      .then((res) => {
        setUsuario(res.data);
        if (res.data && res.data.id) localStorage.setItem('bookos_usuario_id', String(res.data.id));
      })
      .catch(() => {
        localStorage.removeItem('bookos_token');
        localStorage.removeItem('bookos_usuario_id');
      })
      .finally(() => setCargando(false));
    // Marcas de debug: el toggle debug_mode del OS manda en caliente (Sistema > Desarrollo), sin
    // recompilar el front. VITE_DEBUG_MODE sigue siendo el piso: si esta en true, no lo apaga.
    configApi.obtener()
      .then((res) => {
        const t = (res.data.catalogo || []).find((c) => c.clave === 'debug_mode');
        const encendido = Boolean(t) && !(t.valor === false || t.valor === 'false' || t.valor === '0' || t.valor === '');
        activarDebug(encendido);
      })
      .catch(() => {});
  }, []);

  const cambiarVista = (nueva) => {
    setVista(nueva);
    setContextoActual(null);
  };

  // CONTEXTO DE PANTALLA para los chats: las vistas que no fijan el suyo estrenan uno GENERICO con
  // su nombre (las que si lo fijan — cliente, venta, remito... — lo pisan con su JSON mas rico,
  // porque sus efectos corren antes que este). Usuarios y Config quedan EXCLUIDAS: sus datos no
  // van al modelo. El MISMO contexto viaja a las DOS ventanas: es la pantalla, no el agente.
  const VISTAS_SIN_CONTEXTO = ['Usuarios', 'Config'];
  useEffect(() => {
    if (VISTAS_SIN_CONTEXTO.includes(vista)) return;
    setContextoActual((prev) => prev || { vista: String(vista).toLowerCase() });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vista]);

  // Teclas del OS (doc 06 D9): F2 = alta rapida de cliente, F6 = busqueda tecnica del mostrador,
  // F7 = busqueda semantica. Dos VENTANAS de chat, una por lado: el Secretario (derecha) y el
  // Vendedor (izquierda: el asistente de ventas que antes era pagina del CRM). Cada una se abre
  // y se cierra con su boton y no se pisan entre si. CON QUE ARRANCA cada una es preferencia del
  // operario (boton "arranque:" en la cabecera del chat, guardado en este navegador).
  const [panelAbierto, setPanelAbierto] = useState(() => {
    try { return (localStorage.getItem('bookos_arranque_secretario') || 'expandido') !== 'minimizado'; } catch (_) { return true; }
  });
  const [asistenteAbierto, setAsistenteAbierto] = useState(() => {
    try { return (localStorage.getItem('bookos_arranque_vendedor') || 'minimizado') === 'expandido'; } catch (_) { return false; }
  });
  // Botones de las DOS ventanas de chat: viven en la barra de arriba (navbar), una sola puerta por
  // ventana en todas las medidas. En pantallas chicas el mismo boton abre el panel a pantalla
  // completa: ese estado lo controla App (el boton flotante de adentro se saco el 21-Sep-2026
  // porque se duplicaba con el de la barra y tapaba el contenido en el celular).
  const [vendedorMobile, setVendedorMobile] = useState(false);
  const [secretarioMobile, setSecretarioMobile] = useState(false);
  const alternarVendedor = () => {
    if (typeof window !== 'undefined' && window.matchMedia('(max-width: 1024px)').matches) setVendedorMobile((v) => !v);
    else setAsistenteAbierto((v) => !v);
  };
  const alternarSecretario = () => {
    if (typeof window !== 'undefined' && window.matchMedia('(max-width: 1024px)').matches) setSecretarioMobile((v) => !v);
    else setPanelAbierto((v) => !v);
  };
  // ABRIR (no alternar) la ventana destino de un traspaso: en pantallas chicas el overlay, en
  // escritorio el panel. Si ya estaba abierta no hace nada (no la cierra).
  const abrirVentana = (destino) => {
    const chica = typeof window !== 'undefined' && window.matchMedia('(max-width: 1024px)').matches;
    if (destino === 'ventas') {
      if (chica) setVendedorMobile(true);
      else setAsistenteAbierto(true);
    } else if (chica) setSecretarioMobile(true);
    else setPanelAbierto(true);
  };
  const [buscadorTecnico, setBuscadorTecnico] = useState(false);
  const [buscadorSemantico, setBuscadorSemantico] = useState(false);
  const [altaCliente, setAltaCliente] = useState(false);

  const alternarTecnico = useCallback(() => {
    setBuscadorTecnico((v) => !v);
    setBuscadorSemantico(false);
  }, []);
  const alternarSemantico = useCallback(() => {
    setBuscadorSemantico((v) => !v);
    setBuscadorTecnico(false);
  }, []);

  useAtajoGlobal('F6', alternarTecnico);
  useAtajoGlobal('F7', alternarSemantico);

  // F2 abre el alta rapida (no alterna): la tecla tiene que ser segura en el mostrador. Se apaga
  // mientras el modal esta abierto y ESC lo cierra.
  const abrirAltaCliente = useCallback(() => setAltaCliente(true), []);
  useAtajoGlobal('F2', abrirAltaCliente, { activo: !altaCliente });

  const salir = () => {
    localStorage.removeItem('bookos_token');
    localStorage.removeItem('bookos_usuario_id');
    setUsuario(null);
  };

  if (cargando) return <div className="min-h-screen" style={{ background: 'var(--bg)' }} />;
  if (!usuario) return <Login onLogin={setUsuario} />;

  const esAdmin = usuario.rol === 'admin';

  return (
    <div className={`bookos-app${debug ? ' debug-watermark' : ''}`}>
      <Navbar
        vista={vista}
        onCambiarVista={cambiarVista}
        usuario={usuario}
        onLogout={salir}
        asistenteAbierto={asistenteAbierto || vendedorMobile}
        onAlternarAsistente={alternarVendedor}
        secretarioAbierto={panelAbierto || secretarioMobile}
        onAlternarSecretario={alternarSecretario}
      />
      <div className={`bookos-layout${panelAbierto ? '' : ' agente-cerrado'}${asistenteAbierto ? '' : ' asistente-cerrado'}`}>
        <AsistenteVentasBlock abierto={asistenteAbierto} onAlternar={() => setAsistenteAbierto((v) => !v)} abiertoMobile={vendedorMobile} setAbiertoMobile={setVendedorMobile} onAbrirOtraVentana={abrirVentana} />
        <main className="bookos-main p-6">
          {vista === 'Catalogo' && <CatalogoPage />}
          {vista === 'Facturar' && <VentasPage />}
          {vista === 'Ventas del dia/periodo' && <VentasPeriodoPage />}
          {vista === 'Remitos' && <RemitosPage />}
          {vista === 'Caja' && <CajaPage />}
          {vista === 'Compras' && <ComprasPage />}
          {vista === 'Proveedores' && <ProveedoresPage />}
          {vista === 'Clientes' && <ClientesPage />}
          {vista === 'Cuenta corriente cliente' && <CtaCtePage lado="cliente" />}
          {vista === 'Cuenta corriente proveedor' && <CtaCtePage lado="proveedor" />}
          {vista === 'Transportes' && <TransportesPage />}
          {vista === 'Consigna' && <ConsignaPage />}
          {vista === 'Mayorista' && <MayoristaPage />}
          {vista === 'Inventario' && <InventarioPage />}
          {vista === 'Newsletter' && <NewsletterPage />}
          {vista === 'Parametros' && <ParametrosPage />}
          {vista === 'Importador' && <ImportadorPage esAdmin={esAdmin} />}
          {vista === 'Referencias' && <ReferenciasPage />}
          {vista === 'Config' && <ConfigPage esAdmin={esAdmin} />}
          {vista === 'Empresa' && <EmpresaPage />}
          {vista === 'Usuarios' && <UsuariosPage esAdmin={esAdmin} />}
          {vista === 'Desarrollo' && <DesarrolloPage esAdmin={esAdmin} />}
          {vista === 'Salud' && <SaludPage esAdmin={esAdmin} />}
          {vista === 'Agente' && <AgentePage esAdmin={esAdmin} />}
          {vista === 'Perfiles' && <PerfilesPage esAdmin={esAdmin} />}
          {vista === 'Propuestas Kernel' && <PropuestasPage esAdmin={esAdmin} />}
          {vista === 'Pesos del buscador' && <PesosPage esAdmin={esAdmin} foco="sem" />}
          {vista === 'Pesos del router' && <PesosPage esAdmin={esAdmin} foco="router" />}
          {vista === 'Enriquecimiento' && <EnriquecimientoPage esAdmin={esAdmin} />}
          {vista === 'Banco del buscador' && <BancoPruebasPage esAdmin={esAdmin} foco="sem" />}
          {vista === 'Banco del router' && <BancoPruebasPage esAdmin={esAdmin} foco="router" />}
          {vista === 'Banco del modelo chico' && <BancoPruebasPage esAdmin={esAdmin} foco="chico" />}
          {vista === 'Modelo local' && <ModeloLocalPage esAdmin={esAdmin} />}
          {vista === 'Logs' && <LogsPage />}
          {vista === 'Cola' && <ColaPage />}
          {vista === 'Memoria' && <MemoriaPage esAdmin={esAdmin} />}
          {vista === 'Pedidos' && <PedidosPage />}
          {vista === 'Radar' && <RadarPage />}
          {vista === 'Propuestas' && <PropuestasVentaPage />}
          {vista === 'Campañas' && <CampaniasPage />}
          {vista === 'Config CRM' && <ConfigCrmPage />}
          {vista === 'Plantillas mail' && <PlantillasMailPage />}
        </main>
        <AgenteChatBlock abierto={panelAbierto} onAlternar={() => setPanelAbierto((v) => !v)} abiertoMobile={secretarioMobile} setAbiertoMobile={setSecretarioMobile} onAbrirOtraVentana={abrirVentana} />
      </div>
      <BuscadorTecnicoBlock
        abierto={buscadorTecnico}
        onCerrar={() => setBuscadorTecnico(false)}
        enFacturar={vista === 'Facturar'}
        onIrACatalogo={() => cambiarVista('Catalogo')}
      />
      <BuscadorSemanticoBlock
        abierto={buscadorSemantico}
        onCerrar={() => setBuscadorSemantico(false)}
        enFacturar={vista === 'Facturar'}
        onAbrirAsistente={() => setAsistenteAbierto(true)}
      />
      {/* F2 desde cualquier vista. El cliente creado se anuncia por el bus de instrucciones (una
          sola vez): la vista que sepa tomarlo lo elige (la factura minorista y los pedidos). */}
      <AltaRapidaClienteBlock
        abierto={altaCliente}
        onCerrar={() => setAltaCliente(false)}
        contexto="Queda elegido en la factura o en el pedido"
        onCreado={(cliente) => emitirInstruccion({ dominio: 'clientes', accion: 'cliente_creado', cliente })}
      />
    </div>
  );
}
