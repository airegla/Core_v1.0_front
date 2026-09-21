// BookOS - AgenteChatBlock.jsx
// ruta: bookos/frontend/src/blocks/AgenteChatBlock.jsx
// descripcion: VENTANA de chat del agente, reutilizable por LADO y PERFIL. El Secretario (perfil
//   'secretario', lado derecho) y el Vendedor (perfil 'ventas', lado izquierdo: ex pagina del CRM)
//   son la MISMA pieza: en escritorio el aside es una columna del layout; en pantallas chicas se
//   abre a pantalla completa. UNA sola puerta por ventana en todas las medidas: su boton vive en la
//   barra de arriba (navbar) y el boton flotante de adentro se saco el 21-Sep-2026 porque se
//   duplicaba con el de la barra y tapaba el contenido (medido en el celular).

import { useState } from 'react';
import ChatAgente from './ChatAgente';
import DebugTag from '../ui/DebugTag';

export default function AgenteChatBlock({
  abierto = true,
  onAlternar = null,
  perfil = 'secretario',
  titulo = 'El Secretario',
  lado = 'der',
  extras = null,
  claveArranque = null,
  arranqueDefault = null,
  // Abre (no alterna) la otra ventana cuando un pedido se le traspasa (spec 21-Sep).
  onAbrirOtraVentana = null,
  // La puerta del TELEFONO la controla App cuando el boton vive en el navbar. Sin props cae en su
  // estado interno: el bloque sigue sirviendo suelto.
  abiertoMobile: abiertoMobileProp = null,
  setAbiertoMobile: setAbiertoMobileProp = null,
}) {
  const [abiertoMobileInterno, setAbiertoMobileInterno] = useState(false);
  const abiertoMobile = abiertoMobileProp === null ? abiertoMobileInterno : abiertoMobileProp;
  const setAbiertoMobile = setAbiertoMobileProp || setAbiertoMobileInterno;
  const plegable = typeof onAlternar === 'function';
  const visible = abierto || abiertoMobile;
  const claseLado = lado === 'izq' ? ' izquierda' : '';
  // Preferencia de arranque por VENTANA (clave + default segun el lado): el mismo par lo usa App
  // para decidir con que estado abre. Se puede cambiar desde el boton de la cabecera del chat.
  const claveArranqueFinal = claveArranque || (lado === 'izq' ? 'bookos_arranque_vendedor' : 'bookos_arranque_secretario');
  const arranqueDefaultFinal = arranqueDefault || (lado === 'izq' ? 'minimizado' : 'expandido');

  // En pantallas chicas el panel se muestra como CHAT a pantalla completa: `abiertoMobile` es la
  // puerta propia del telefono, porque el estado de escritorio (`abierto`) puede estar en false
  // (el layout ocupa todo el ancho) y antes el boton flotante no hacia nada en ese caso: el
  // operario tocaba el boton y el panel no volvia a aparecer (se sentia colgado).
  const cerrar = () => {
    setAbiertoMobile(false);
    if (plegable && abierto) onAlternar();
  };

  return (
    <>
      {visible && (
        <aside className={`agente-panel${claseLado} ${plegable ? 'plegable' : ''} ${abiertoMobile ? 'agente-abierto' : ''}`}>
          <DebugTag nombre={lado === 'izq' ? 'AsistenteVentasBlock' : 'AgenteChatBlock'} />
          {extras}
          <ChatAgente perfil={perfil} titulo={titulo} onCerrarMobile={cerrar} claveArranque={claveArranqueFinal} arranqueDefault={arranqueDefaultFinal} onAbrirOtraVentana={onAbrirOtraVentana} />
        </aside>
      )}
    </>
  );
}
