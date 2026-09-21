// BookOS - PropuestasVentaPage.jsx
// ruta: bookos/frontend/src/pages/PropuestasVentaPage.jsx
// descripcion: propuestas de lectura del CRM (doc 06 P5/D6): el operario elige cliente,
//   cantidad y una aclaracion, el asistente arma la propuesta (tematicas + afinidad + stock,
//   seleccion y motivos por LLM) y queda en BORRADOR para revisarla antes de mandarla por mail.
//   P7: si la propuesta ya se envio, se puede medir el outcome (que titulos compro el cliente) y
//   queda a la vista en la columna Resultado.

import { useEffect, useState } from 'react';
import Modal from '../ui/Modal';
import Input from '../ui/Input';
import Paginador from '../ui/Paginador';
import DebugTag from '../ui/DebugTag';
import SelectBuscador from '../ui/SelectBuscador';
import { buscarClientes } from '../utils/selectores';
import { crmApi } from '../api/api';

export default function PropuestasVentaPage() {
  const [filas, setFilas] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [estado, setEstado] = useState('');
  const [mensaje, setMensaje] = useState('');
  const [detalle, setDetalle] = useState(null);
  const [modal, setModal] = useState(false);
  const [armando, setArmando] = useState(false);
  const [form, setForm] = useState({ clienteId: '', cantidad: 5, aclaracion: '' });
  const [clienteNombre, setClienteNombre] = useState('');

  const cargar = async () => {
    try {
      const r = await crmApi.propuestas({ estado: estado || undefined, page, limit: 20 });
      setFilas(r.data.filas || []);
      setTotal(r.data.total || 0);
    } catch (err) {
      setMensaje(`⚠️ ${err.message}`);
    }
  };

  useEffect(() => { cargar(); }, [page, estado]); // eslint-disable-line

  const abrirNueva = async () => {
    setForm({ clienteId: '', cantidad: 5, aclaracion: '' });
    setClienteNombre('');
    setModal(true);
  };

  const armar = async () => {
    setArmando(true);
    setMensaje('Armando la propuesta (el asistente elige entre los títulos en stock)...');
    try {
      const r = await crmApi.armarPropuesta({
        clienteId: Number(form.clienteId),
        cantidad: Number(form.cantidad || 5),
        aclaracion: form.aclaracion || null,
      });
      setMensaje(`Propuesta #${r.data.propuesta.propuestaId} armada con ${(r.data.propuesta.libros || []).length} títulos (BORRADOR).`);
      setModal(false);
      setDetalle(r.data.propuesta);
      cargar();
    } catch (err) {
      setMensaje(`⚠️ ${err.message}`);
    } finally {
      setArmando(false);
    }
  };

  const enviar = async (id) => {
    try {
      const r = await crmApi.enviarPropuesta(id);
      setMensaje(`Propuesta #${id} enviada a ${r.data.mail ? r.data.mail.a : 'el cliente'}.`);
      setDetalle(null);
      cargar();
    } catch (err) {
      setMensaje(`⚠️ ${err.message}`);
    }
  };

  const descartar = async (id) => {
    try {
      await crmApi.descartarPropuesta(id);
      setMensaje(`Propuesta #${id} descartada.`);
      setDetalle(null);
      cargar();
    } catch (err) {
      setMensaje(`⚠️ ${err.message}`);
    }
  };

  // P7: resultado real de las propuestas enviadas (ventas COMPLETADAS del cliente en la ventana).
  const medir = async () => {
    try {
      const r = await crmApi.outcomePropuesta(30);
      const d = r.data || {};
      setMensaje(
        `Outcome (${d.ventanaDias} días): ${d.propuestas} propuestas medidas · ${d.conCompra} con compra · $${Number(d.importe || 0).toLocaleString('es-AR')}.`
      );
      cargar();
    } catch (err) {
      setMensaje(`⚠️ ${err.message}`);
    }
  };

  return (
    <div>
      <DebugTag nombre="PropuestasVentaPage" />
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold">Propuestas de lectura</h2>
        <div className="flex gap-2">
          <button type="button" className="btn btn-ghost" onClick={medir}>Medir resultado</button>
          <button type="button" className="btn btn-primary" onClick={abrirNueva}>Armar propuesta</button>
        </div>
      </div>
      {mensaje && <p className="text-sm mb-3">{mensaje}</p>}

      <div className="card p-3 mb-3 flex items-center gap-3">
        <select className="input-os" style={{ maxWidth: 200 }} value={estado} onChange={(e) => { setEstado(e.target.value); setPage(1); }}>
          <option value="">Todas</option>
          <option value="BORRADOR">Borradores</option>
          <option value="ENVIADA">Enviadas</option>
          <option value="DESCARTADA">Descartadas</option>
        </select>
        <span className="text-xs text-muted">El asistente usa las temáticas del cliente (o siembra los perfiles default) y su historial de compras.</span>
      </div>

      <div className="card p-3">
        <table className="table-os">
          <thead>
            <tr><th>#</th><th>Cliente</th><th>Estado</th><th>Títulos</th><th>Resultado</th><th>Asunto</th><th></th></tr>
          </thead>
          <tbody>
            {filas.length === 0 ? (
              <tr><td colSpan={7} className="text-muted text-center py-8">Sin propuestas todavía</td></tr>
            ) : filas.map((p) => (
              <tr key={p.propuestaId}>
                <td>{p.propuestaId}</td>
                <td>{p.cliente}{p.email ? '' : ' (sin email)'}</td>
                <td><span className="agente-badge">{p.estado}</span></td>
                <td>{Array.isArray(p.libros) ? p.libros.length : 0}</td>
                <td className="text-xs">
                  {p.outcome ? (
                    <span title={`medido ${new Date(p.outcome.medidoEn).toLocaleDateString('es-AR')} · ventana ${p.outcome.dias} días`}>
                      compró {p.outcome.comprados}/{p.outcome.ofrecidos} · ${Number(p.outcome.importe || 0).toLocaleString('es-AR')}
                    </span>
                  ) : p.estado === 'ENVIADA' ? (
                    <span className="text-muted">sin medir</span>
                  ) : (
                    <span className="text-muted">—</span>
                  )}
                </td>
                <td className="text-xs">{p.asunto}</td>
                <td>
                  <div className="flex gap-2">
                    <button type="button" className="btn btn-ghost text-xs" onClick={() => setDetalle(p)}>Ver</button>
                    {p.estado === 'BORRADOR' && p.email && (
                      <button type="button" className="btn text-xs" onClick={() => enviar(p.propuestaId)}>Enviar</button>
                    )}
                    {p.estado === 'BORRADOR' && (
                      <button type="button" className="btn btn-ghost text-xs" onClick={() => descartar(p.propuestaId)}>Descartar</button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <Paginador page={page} total={total} limite={20} onCambiar={setPage} etiqueta="propuestas" />
      </div>

      {detalle && (
        <Modal
          abierto={Boolean(detalle)}
          onClose={() => setDetalle(null)}
          titulo={`Propuesta #${detalle.propuestaId} — ${detalle.cliente || ''}`}
          ancho="820px"
          footer={(
            <>
              <button type="button" className="btn" onClick={() => setDetalle(null)}>Cerrar</button>
              {detalle.estado === 'BORRADOR' && detalle.email && (
                <button type="button" className="btn btn-primary" onClick={() => enviar(detalle.propuestaId)}>
                  Enviar a {detalle.email}
                </button>
              )}
            </>
          )}
        >
          <p className="text-xs text-muted mb-3">
            Temáticas: {Array.isArray(detalle.tematicas) ? detalle.tematicas.map((t) => t.materia).join(' · ') : '—'}
          </p>
          <div className="text-sm mb-4">
            {(detalle.libros || []).map((l, i) => (
              <div key={l.ean13 || i} className="py-2" style={{ borderBottom: '1px solid var(--border)' }}>
                <div><strong>{i + 1}. {l.titulo}</strong> — {l.autor || 's/a'} <span className="text-muted">({l.editorial || 's/e'})</span></div>
                <div className="text-xs text-muted">${Number(l.precio || 0).toLocaleString('es-AR')} · stock {l.stock} · EAN {l.ean13}</div>
                {l.motivo && <div className="text-xs mt-1">Motivo: {l.motivo}</div>}
              </div>
            ))}
          </div>
          {detalle.cuerpo && (
            <div>
              <h4 className="text-sm font-semibold mb-1">Mail que se enviaría</h4>
              <pre className="text-xs" style={{ whiteSpace: 'pre-wrap' }}>{detalle.cuerpo}</pre>
            </div>
          )}
        </Modal>
      )}

      {modal && (
        <Modal
          abierto={modal}
          onClose={() => setModal(false)}
          titulo="Armar propuesta de lectura"
          footer={(
            <>
              <button type="button" className="btn" onClick={() => setModal(false)}>Cancelar</button>
              <button type="button" className="btn btn-primary" disabled={armando || !form.clienteId} onClick={armar}>
                {armando ? 'Armando...' : 'Armar (borrador)'}
              </button>
            </>
          )}
        >
          <div className="form-grid">
            <div>
              <label className="field-label">Cliente</label>
              <SelectBuscador
                valor={form.clienteId || null}
                etiquetaValor={clienteNombre}
                placeholder="Buscar cliente..."
                buscar={(q) => buscarClientes(q, [1])}
                onSeleccionar={(it) => { setForm({ ...form, clienteId: it ? it.id : '' }); setClienteNombre(it ? it.etiqueta : ''); }}
              />
            </div>
            <Input label="Cantidad de títulos" type="number" value={form.cantidad} onChange={(e) => setForm({ ...form, cantidad: e.target.value })} />
            <Input label="Aclaración (opcional)" value={form.aclaracion} onChange={(e) => setForm({ ...form, aclaracion: e.target.value })} placeholder="que sean novedades / para regalar..." />
          </div>
          <p className="text-xs text-muted mt-2">
            Se arma en BORRADOR: podés leer los títulos, los motivos y el mail antes de enviarlo.
          </p>
        </Modal>
      )}
    </div>
  );
}
