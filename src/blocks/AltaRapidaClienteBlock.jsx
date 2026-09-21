// BookOS - AltaRapidaClienteBlock.jsx
// ruta: bookos/frontend/src/blocks/AltaRapidaClienteBlock.jsx
// descripcion: alta RAPIDA de cliente con 3 datos (nombre, celular, email). Lo monta el shell
//   (App.jsx) y se abre con F2 desde cualquier vista; el cliente creado se anuncia por el bus de
//   instrucciones para que la vista activa lo tome como cliente elegido (factura minorista,
//   pedidos). Existe porque cargar un cliente tiene que costar segundos: la ficha es la que
//   alimenta el seguimiento (tematicas, grafo de relaciones y propuestas de titulos).

import { useState } from 'react';
import Modal from '../ui/Modal';
import Input from '../ui/Input';
import BorradorRestaurado from '../ui/BorradorRestaurado';
// Sesion de trabajo: los tres datos tipeados sobreviven al refresco y al cierre del modal.
import usePersistentWork from '../hooks/usePersistentWork';
import { clientesApi } from '../api/api';

export default function AltaRapidaClienteBlock({ abierto, onCerrar, onCreado, contexto = '' }) {
  const [form, setForm, limpiarForm, restaurado] = usePersistentWork('alta_rapida_cliente', { nombre: '', telefono: '', email: '' });
  const { nombre, telefono, email } = form;
  const setNombre = (v) => setForm((f) => ({ ...f, nombre: v }));
  const setTelefono = (v) => setForm((f) => ({ ...f, telefono: v }));
  const setEmail = (v) => setForm((f) => ({ ...f, email: v }));
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');

  // limpiar borra el BORRADOR (el gesto ↺ limpiar); cerrar ya no lo borra: si el operario cierra por
  // error, al volver a abrir encuentra lo que estaba cargando.
  const limpiar = () => {
    limpiarForm();
    setError('');
  };

  const cerrar = () => {
    onCerrar();
  };

  const crear = async () => {
    if (!nombre.trim()) {
      setError('El nombre es obligatorio.');
      return;
    }
    // Sin ningun contacto el cliente existe pero no se puede seguir: se pide uno de los dos.
    if (!telefono.trim() && !email.trim()) {
      setError('Cargá celular o email: sin un contacto el seguimiento queda ciego.');
      return;
    }
    setGuardando(true);
    setError('');
    try {
      // El interceptor devuelve el body, asi que el cliente creado viene en res.data.
      const res = await clientesApi.crear({
        nombre: nombre.trim(),
        telefono: telefono.trim() || undefined,
        email: email.trim() || undefined,
      });
      const cliente = (res && res.data) || res;
      limpiar();
      if (onCreado) onCreado(cliente);
      onCerrar();
    } catch (err) {
      setError(err.message || 'No pude crear el cliente.');
    } finally {
      setGuardando(false);
    }
  };

  const footer = (
    <div className="flex items-center justify-between gap-2 w-full">
      <span className="text-xs text-muted">{contexto}</span>
      <div className="flex gap-2">
        <button type="button" className="btn btn-ghost text-xs" onClick={cerrar} disabled={guardando}>Cancelar</button>
        <button type="button" className="btn btn-primary text-xs" onClick={crear} disabled={guardando}>
          {guardando ? 'Guardando...' : 'Crear cliente'}
        </button>
      </div>
    </div>
  );

  return (
    <Modal abierto={abierto} onClose={cerrar} titulo="Alta rapida de cliente" ancho="460px" footer={footer}>
      <div className="space-y-2">
        <BorradorRestaurado visible={restaurado} onLimpiar={limpiar} />
        <Input label="Nombre" value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Apellido, Nombre" autoFocus />
        <Input label="Celular" value={telefono} onChange={(e) => setTelefono(e.target.value)} placeholder="261 555 1234" />
        <Input label="Email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="para el seguimiento y el newsletter" />
        <p className="text-xs text-muted">
          Con la ficha cargada, el kernel puede seguir al cliente: tematicas, grafo e historial.
        </p>
        {error && <p className="text-xs" style={{ color: 'var(--danger)' }}>{error}</p>}
      </div>
    </Modal>
  );
}
