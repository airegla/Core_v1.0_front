// BookOS - AppContext.jsx
// ruta: bookos/frontend/src/AppContext.jsx
// descripcion: contexto del OS. Lleva el contexto de pantalla que se inyecta al
//   Secretario (ej. el remito que estas viendo) y los ultimos recomendados para
//   cerrar el ciclo de outcome en la venta.

import { createContext, useCallback, useContext, useState } from 'react';

const AppContext = createContext(null);

export function AppProvider({ children }) {
  const [contextoActual, setContextoActual] = useState(null);
  const [ultimosRecomendados, setUltimosRecomendados] = useState([]);
  // CLIENTE ACTIVO: la variable que comparten TODAS las vistas (el buscador F7 la manda como
  // contexto.clienteId; la ventana del Vendedor la muestra). Se PERSISTE en este navegador: se
  // asigna al abrir la ficha del cliente en Clientes y se limpia con la ✕ del Vendedor.
  const [clienteActivo, setClienteActivo] = useState(() => {
    try { return JSON.parse(localStorage.getItem('bookos_cliente_activo')) || null; } catch (_) { return null; }
  });
  const clienteIdActivo = clienteActivo && clienteActivo.id ? clienteActivo.id : null;

  // Acepta { id, nombre } (o null para limpiar) y persiste SOLO lo que sirve fuera de la sesion.
  const cambiarClienteActivo = useCallback((valor) => {
    const normalizado = valor && valor.id ? { id: Number(valor.id), nombre: valor.nombre || null } : null;
    setClienteActivo(normalizado);
    try {
      if (normalizado) localStorage.setItem('bookos_cliente_activo', JSON.stringify(normalizado));
      else localStorage.removeItem('bookos_cliente_activo');
    } catch (_) { /* modo privado */ }
  }, []);
  // Pedido de consulta programado desde cualquier vista ("Preguntar al Secretario").
  const [consultaAutomatica, setConsultaAutomatica] = useState(null);
  // PRELLENADO por ventana (traspaso entre chats, spec 21-Sep): el texto aterriza en el input del
  // chat DESTINO y el operario decide enviarlo (decision D1; no gasta modelo hasta enviar). Va por
  // PERFIL porque las dos ventanas pueden estar montadas a la vez: un slot unico lo recibiria doble.
  const [prellenadoChat, setPrellenadoChat] = useState(null);
  const pedirPrellenado = useCallback((perfil, texto) => {
    setPrellenadoChat(perfil && texto ? { perfil, texto, ts: Date.now() } : null);
  }, []);
  // Bus de instrucciones: el Secretario "opera sobre la vista" emitiendo una
  // instruccion que la pagina activa escucha y aplica (refrescar, agregar item...).
  const [instruccionVista, setInstruccionVista] = useState(null);
  // CSV adjuntado desde una vista para que el Secretario lo procese con la tool que corresponda.
  const [csvAdjunto, setCsvAdjunto] = useState(null);

  const emitirInstruccion = (instruccion) => {
    setInstruccionVista({ ...instruccion, ts: Date.now() });
  };

  return (
    <AppContext.Provider value={{
      contextoActual,
      setContextoActual,
      ultimosRecomendados,
      setUltimosRecomendados,
      clienteIdActivo,
      clienteActivo,
      setClienteActivo: cambiarClienteActivo,
      consultaAutomatica,
      pedirConsulta: setConsultaAutomatica,
      prellenadoChat,
      pedirPrellenado,
      instruccionVista,
      emitirInstruccion,
      csvAdjunto,
      setCsvAdjunto,
    }}>
      {children}
    </AppContext.Provider>
  );
}

export function useAppContext() {
  return useContext(AppContext);
}
