// BookOS - AsistenteVentasBlock.jsx
// ruta: bookos/frontend/src/blocks/AsistenteVentasBlock.jsx
// descripcion: el VENDEDOR: la VENTANA IZQUIERDA del asistente de ventas (perfil 'ventas' del
//   agente). Antes era una pagina dentro de CRM; ahora es una ventana propia que convive con el
//   Secretario (derecha) y comparte el MISMO motor y los MISMOS ajustes (adjuntos, voto del turno,
//   conversaciones, voz, watchdog del stream). Los chips de arriba son los pedidos tipicos del
//   mostrador y los marcadores a la vista.

import { useState } from 'react';
import AgenteChatBlock from './AgenteChatBlock';
import { useAppContext } from '../AppContext';

// Pedidos tipicos del mostrador: se mandan tal cual al asistente (cero tipeo).
const ACCIONES = [
  { etiqueta: 'Recomendar para regalar', pedido: 'Recomendame entre 5 y 8 titulos para regalar, combinando novedades y fondo, con un motivo breve para cada uno.' },
  { etiqueta: 'Novedades que entraron', pedido: 'Que novedades ingresaron en las ultimas semanas? Mostrame primero las mas vendibles.' },
  { etiqueta: 'Buscar un titulo', pedido: 'Busco un titulo puntual: decime autor, editorial, precio y stock.' },
  { etiqueta: 'Pedidos pendientes', pedido: 'Que pedidos de clientes estan pendientes de reposicion y para que proveedor irian?' },
  { etiqueta: 'Que le ofrezco a este cliente', pedido: 'Con el cliente activo a la vista, armame una recomendacion con titulos en stock y el motivo de cada uno.' },
];

// Marcadores del perfil de ventas (doc 06): viven en la semilla del agente; aca se muestran para
// usarlos sin memorizarlos. Se copian al portapapeles (se completan en el chat); $ayuda se manda.
const MARCADORES = [
  { comando: '$autor X', detalle: 'por autor' },
  { comando: '$titulo X', detalle: 'por titulo' },
  { comando: '$editorial X', detalle: 'por editorial' },
  { comando: '$materia X', detalle: 'por materia' },
  { comando: '$precio MIN MAX', detalle: 'por rango de precio' },
  { comando: '$sinopsis X', detalle: 'por lo que dice el libro' },
  { comando: '$ayuda', detalle: 'todos los comandos' },
];

export default function AsistenteVentasBlock({ abierto = false, onAlternar = null, abiertoMobile = null, setAbiertoMobile = null, onAbrirOtraVentana = null }) {
  const { contextoActual, clienteIdActivo, clienteActivo, setClienteActivo, pedirConsulta } = useAppContext();
  const [copiado, setCopiado] = useState('');
  // Los atajos del mostrador arrancan PLEGADOS: la ventana es para chatear y las cinco acciones
  // mas los marcadores comian media pantalla. Un boton los despliega cuando hacen falta.
  const [atajos, setAtajos] = useState(false);
  const cliente = (contextoActual && contextoActual.nombre) || (clienteActivo && clienteActivo.nombre) || null;
  const hayCliente = Boolean(cliente || clienteIdActivo);

  const usarMarcador = async (m) => {
    if (m.comando === '$ayuda') {
      pedirConsulta('$ayuda');
      return;
    }
    try {
      await navigator.clipboard.writeText(m.comando.replace(' X', ' '));
      setCopiado(m.comando);
      setTimeout(() => setCopiado(''), 2500);
    } catch (e) {
      setCopiado('');
    }
  };

  const extras = (
    <div className="agente-historial px-4 py-2">
      <div className="flex items-center gap-2 flex-wrap">
        <button
          type="button"
          className="btn btn-ghost text-xs"
          onClick={() => setAtajos((v) => !v)}
          title="Pedidos típicos del mostrador y marcadores, sin tipear"
        >
          ⚡ Atajos {atajos ? '▴' : '▾'}
        </button>
        {hayCliente
          ? (
            <span className="agente-badge" style={{ color: '#15803d' }}>
              cliente: {cliente || `#${clienteIdActivo}`}
              <button
                type="button"
                className="btn btn-ghost text-xs px-1"
                onClick={() => setClienteActivo(null)}
                title="Quitar el cliente activo (lo deja de usar el buscador y el asistente)"
              >
                ✕
              </button>
            </span>
          )
          : <span className="text-xs text-muted">sin cliente activo (abrí una ficha en Clientes)</span>}
      </div>
      {atajos && (
        <>
          <div className="flex gap-1 flex-wrap mt-2">
            {ACCIONES.map((a) => (
              <button
                key={a.etiqueta}
                type="button"
                className="btn btn-ghost text-xs"
                disabled={a.etiqueta === 'Que le ofrezco a este cliente' && !hayCliente}
                onClick={() => pedirConsulta(a.pedido)}
                title={a.pedido}
              >
                {a.etiqueta}
              </button>
            ))}
          </div>
          <div className="lista-chips mt-2">
            {MARCADORES.map((m) => (
              <button
                key={m.comando}
                type="button"
                className="chip-tema"
                title={`${m.detalle}${m.comando === '$ayuda' ? '' : ' · se copia y se completa en el chat'}`}
                onClick={() => usarMarcador(m)}
              >
                {copiado === m.comando ? 'copiado ✓' : m.comando}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );

  return (
    <AgenteChatBlock
      abierto={abierto}
      onAlternar={onAlternar}
      abiertoMobile={abiertoMobile}
      setAbiertoMobile={setAbiertoMobile}
      onAbrirOtraVentana={onAbrirOtraVentana}
      perfil="ventas"
      titulo="Asistente de ventas"
      lado="izq"
      extras={extras}
    />
  );
}
