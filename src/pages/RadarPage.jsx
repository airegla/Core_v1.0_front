// BookOS - RadarPage.jsx
// ruta: bookos/frontend/src/pages/RadarPage.jsx
// descripcion: el Radar del CRM (doc 06): foto de los pedidos por estado, los grupos que se
//   despacharian por proveedor y las corridas del ciclo — verificar ingresos (ledger),
//   notificar ingresos (mail al cliente + aviso interno) y notificar agotados.

import { useEffect, useState } from 'react';
import DebugTag from '../ui/DebugTag';
import { crmApi } from '../api/api';

const ORDEN = ['Pendiente', 'Solicitado', 'Ingresado', 'Notificado', 'Agotado', 'Cancelado'];

export default function RadarPage() {
  const [resumen, setResumen] = useState(null);
  const [mensaje, setMensaje] = useState('');
  const [corriendo, setCorriendo] = useState('');
  const [grupos, setGrupos] = useState([]);

  const cargar = async () => {
    try {
      const r = await crmApi.resumen();
      setResumen(r.data);
    } catch (err) {
      setMensaje(`⚠️ ${err.message}`);
    }
  };

  useEffect(() => { cargar(); }, []); // eslint-disable-line

  const correr = async (accion, etiqueta) => {
    setCorriendo(accion);
    setMensaje('');
    try {
      const r = await crmApi[accion]();
      const d = r.data || {};
      if (accion === 'verificarIngresos') setMensaje(`Revisados ${d.revisados} pedidos · ${d.ingresados.length} quedaron Ingresado.`);
      else if (accion === 'notificarIngresos') setMensaje(`Avisos: ${(d.mails || []).filter((m) => m.enviado).length} mails enviados · Telegram: ${d.telegram && d.telegram.enviado ? 'enviado' : (d.telegram && d.telegram.motivo) || 'no'} · ${d.notificados} pedidos a Notificado.`);
      else if (accion === 'notificarAgotados') setMensaje(`Avisos de agotado: ${(d.mails || []).filter((m) => m.enviado).length} mails · ${d.avisados} pedidos marcados.`);
      else if (accion === 'despachar') {
        const mail = d.mail || {};
        setMensaje(`Despachados ${(d.despachados || []).length} grupos de ${d.totalPedidos} pedidos. Mail de control: ${mail.enviado ? `enviado a ${mail.a}` : mail.motivo || 'no enviado'}${d.csv ? ` · CSV: ${d.csv.nombre}` : ''}.`);
      } else if (accion === 'ciclo') {
        const v = d.verificacion || {};
        const desp = d.despacho || {};
        setMensaje(`Ciclo completo: verificados ${v.revisados || 0} (${(v.ingresados || []).length} ingresados) · avisos ${d.ingresos && d.ingresos.omitido ? 'sin pendientes' : 'enviados'} · despachados ${(desp.despachados || []).length} grupos · mail de control ${d.mail && d.mail.enviado ? 'enviado' : 'no enviado'}.`);
      } else if (accion === 'resumenDiario') {
        setMensaje(d.enviado ? `Resumen diario enviado a ${d.a || 'control'}.` : `Resumen generado (${d.motivo || 'no enviado'}).`);
      }
      cargar();
    } catch (err) {
      setMensaje(`⚠️ ${err.message}`);
    } finally {
      setCorriendo('');
    }
  };

  const verGrupos = async () => {
    try {
      const r = await crmApi.grupos();
      setGrupos(r.data.grupos || []);
      if (!r.data.grupos.length) setMensaje('No hay pedidos PENDIENTES para agrupar.');
    } catch (err) {
      setMensaje(`⚠️ ${err.message}`);
    }
  };

  const porEstado = resumen ? resumen.porEstado || {} : {};

  return (
    <div>
      <DebugTag nombre="RadarPage" />
      <h2 className="text-lg font-semibold mb-4">Radar de pedidos</h2>
      {mensaje && <p className="text-sm mb-3">{mensaje}</p>}

      {resumen && (
        <div className="card p-4 mb-4">
          <h3 className="font-semibold mb-3">Estado de los pedidos ({resumen.total})</h3>
          <div className="flex flex-wrap gap-3">
            {ORDEN.map((e) => (
              <div key={e} className="text-sm">
                <span className="agente-badge">{e}</span> <strong>{porEstado[e] || 0}</strong>
              </div>
            ))}
          </div>
          <p className="text-xs text-muted mt-3">
            {resumen.sinProveedor} pedidos sin proveedor asignado · {resumen.agotadosSinAvisar} agotados sin avisar al cliente.
          </p>
        </div>
      )}

      <div className="card p-4 mb-4">
        <h3 className="font-semibold mb-3">Corridas del ciclo</h3>
        <div className="flex flex-wrap gap-2">
          <button type="button" className="btn" disabled={corriendo === 'verificarIngresos'} onClick={() => correr('verificarIngresos', 'verificar')}>
            📦 Verificar ingresos
          </button>
          <button type="button" className="btn" disabled={corriendo === 'notificarIngresos'} onClick={() => correr('notificarIngresos', 'notificar')}>
            📧 Notificar ingresos
          </button>
          <button type="button" className="btn" disabled={corriendo === 'notificarAgotados'} onClick={() => correr('notificarAgotados', 'agotados')}>
            ⚠️ Notificar agotados
          </button>
          <button type="button" className="btn" onClick={verGrupos}>👀 Ver grupos pendientes</button>
          <button type="button" className="btn" disabled={corriendo === 'despachar'} onClick={() => correr('despachar', 'despachar')}>
            🚀 Despachar (mail de control)
          </button>
          <button type="button" className="btn btn-primary" disabled={corriendo === 'ciclo'} onClick={() => correr('ciclo', 'ciclo')}>
            ▶️ Correr ciclo completo
          </button>
          <button type="button" className="btn" disabled={corriendo === 'resumenDiario'} onClick={() => correr('resumenDiario', 'resumen diario')}>
            📨 Resumen diario a control
          </button>
        </div>
        <p className="text-xs text-muted mt-3">
          Verificar ingresos mira el <strong>ledger</strong> (movimiento posterior al pedido). Notificar ingresos manda un mail
          consolidado por cliente y el aviso interno "para separar" (idempotente). Despachar agrupa por proveedor, suma un
          intento y manda el mail de control con el CSV adjunto; el envío al proveedor sigue apagado.
          El <strong>ciclo completo</strong> es lo mismo que corre solo los lunes 9:00 (CRM_CRON): radar → avisos → despacho.
        </p>
      </div>

      {grupos.length > 0 && (
        <div className="card p-4">
          <h3 className="font-semibold mb-3">Grupos que se despacharían ({grupos.length})</h3>
          <table className="table-os">
            <thead>
              <tr><th>Proveedor</th><th>Email</th><th>Títulos</th><th>Unidades</th><th>Umbral</th></tr>
            </thead>
            <tbody>
              {grupos.map((g) => (
                <tr key={g.proveedorId}>
                  <td>{g.proveedor}</td>
                  <td>{g.email || <span className="text-muted">sin email en la ficha</span>}</td>
                  <td>{g.renglones.length}</td>
                  <td>{g.unidades}</td>
                  <td>{g.superaUmbral ? 'supera' : `umbral ${g.umbral}`}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
