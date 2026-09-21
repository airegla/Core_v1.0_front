// BookOS - MayoristaCabeceraBlock.jsx
// ruta: bookos/frontend/src/blocks/MayoristaCabeceraBlock.jsx
// descripcion: cabecera de una operacion del mayorista (F-12 §4.4): cliente (con su descuento y
//   plazo), deposito de origen, tipo de operacion, fecha y observaciones. El deposito de destino es
//   SIEMPRE el espejo del cliente elegido (su sabana): se muestra, no se elige.

import SelectBuscador from '../ui/SelectBuscador';
import { buscarMayoristas } from '../utils/selectores';

const TIPOS_REMITO = [
  { valor: 'CONSIGNA', etiqueta: 'Consigna (entra a la sábana del cliente)' },
  { valor: 'FIRME', etiqueta: 'Firme (venta directa: no entra a la sábana)' },
  { valor: 'TRASLADO_INTERNO', etiqueta: 'Traslado interno (entre depósitos nuestros)' },
];

export default function MayoristaCabeceraBlock({ valor, onCambio, depositos = [], tipoRemito = true, consignaHabilitada = true }) {
  const cambio = (campo) => (e) => onCambio(campo, e && e.target ? e.target.value : e);

  const elegirCliente = (item) => {
    onCambio('cliente', item ? { id: item.id, nombre: item.etiqueta, descuentoFijo: item.descuentoFijo, diasPlazoPago: item.diasPlazoPago, deposito: item.deposito } : null);
  };

  const esTraslado = valor.tipoRemito === 'TRASLADO_INTERNO';
  const origen = depositos.find((d) => Number(d.id) === Number(valor.depositoOrigenId));

  return (
    <div className="form-grid">
      <label className="block">
        <span className="field-label">Cliente mayorista</span>
        <SelectBuscador
          valor={valor.cliente ? valor.cliente.id : null}
          etiquetaValor={valor.cliente ? valor.cliente.nombre : ''}
          placeholder="Buscar cliente mayorista..."
          buscar={buscarMayoristas}
          onSeleccionar={elegirCliente}
          vacio="Sin mayoristas con ese nombre"
        />
        {valor.cliente && (
          <span className="text-xs text-muted">
            Descuento {valor.cliente.descuentoFijo != null ? `${valor.cliente.descuentoFijo}%` : 'sin fijar'} · plazo {valor.cliente.diasPlazoPago != null ? `${valor.cliente.diasPlazoPago} días` : 'sin fijar'}
            {valor.cliente.deposito ? ` · sábana: ${valor.cliente.deposito.nombre}` : ' · SIN depósito espejo'}
          </span>
        )}
      </label>

      <label className="block">
        <span className="field-label">Depósito de origen</span>
        <select className="input-os" value={valor.depositoOrigenId || ''} onChange={cambio('depositoOrigenId')}>
          <option value="">— Elegir —</option>
          {depositos.filter((d) => !d.clienteId && d.activo).map((d) => (
            <option key={d.id} value={d.id}>{d.nombre} ({d.tipo})</option>
          ))}
        </select>
      </label>

      {tipoRemito && (
        <label className="block">
          <span className="field-label">Tipo de operación</span>
          <select className="input-os" value={valor.tipoRemito} onChange={cambio('tipoRemito')}>
            {TIPOS_REMITO.map((t) => (
              <option key={t.valor} value={t.valor} disabled={t.valor === 'CONSIGNA' && !consignaHabilitada}>
                {t.etiqueta}{t.valor === 'CONSIGNA' && !consignaHabilitada ? ' — apagada en Sistema ▾ Config' : ''}
              </option>
            ))}
          </select>
          {!consignaHabilitada && (
            <span className="text-xs text-muted">
              La modalidad consigna del mayorista está apagada: no se emiten remitos CONSIGNA nuevos.
              Lo ya consignado se sigue facturando, devolviendo, sabanando y ajustando.
            </span>
          )}
        </label>
      )}

      <label className="block">
        <span className="field-label">Destino</span>
        <input className="input-os" value={esTraslado ? '— (elegí el depósito destino abajo)' : (valor.cliente && valor.cliente.deposito ? valor.cliente.deposito.nombre : 'se completa con el cliente')} readOnly />
      </label>

      {esTraslado && (
        <label className="block">
          <span className="field-label">Depósito destino (traslado)</span>
          <select className="input-os" value={valor.depositoDestinoId || ''} onChange={cambio('depositoDestinoId')}>
            <option value="">— Elegir —</option>
            {depositos.filter((d) => !d.clienteId && d.activo && Number(d.id) !== Number(valor.depositoOrigenId)).map((d) => (
              <option key={d.id} value={d.id}>{d.nombre} ({d.tipo})</option>
            ))}
          </select>
        </label>
      )}

      <label className="block">
        <span className="field-label">Observaciones</span>
        <input className="input-os" value={valor.observaciones || ''} onChange={cambio('observaciones')} placeholder="Nota del remito (opcional)" />
      </label>

      {origen && origen.tipo === 'MAYORISTA' && (
        <p className="text-xs" style={{ color: 'var(--danger)' }}>
          Un depósito espejo no puede ser origen de un remito de envío: elegí el central o una sucursal.
        </p>
      )}
    </div>
  );
}
