// BookOS - ConfigCrmPage.jsx
// ruta: bookos/frontend/src/pages/ConfigCrmPage.jsx
// descripcion: configuracion del CRM (doc 06): mail (SMTP con prueba de envio real), Telegram
//   (bot con prueba) y los toggles del modulo (grupo 'crm' del catalogo: notificaciones, radar,
//   intentos de pedido, envio a proveedor). El password/token nunca vuelven de la API.

import { useEffect, useState } from 'react';
import Toggle from '../ui/Toggle';
import DebugTag from '../ui/DebugTag';
import Input from '../ui/Input';
import { configApi, mailerApi, telegramApi, crmApi } from '../api/api';

export default function ConfigCrmPage() {
  const [catalogo, setCatalogo] = useState([]);
  const [mailer, setMailer] = useState(null);
  const [mailForm, setMailForm] = useState({ host: '', port: '', user: '', pass: '', from: '', redirigirA: '' });
  const [pruebaMail, setPruebaMail] = useState('');
  const [avisos, setAvisos] = useState(null);
  const [avisoMail, setAvisoMail] = useState('');
  const [telegram, setTelegram] = useState(null);
  const [tgForm, setTgForm] = useState({ token: '', chatId: '' });
  const [bot, setBot] = useState(null);
  const [botError, setBotError] = useState(null);
  const [botLeidoEn, setBotLeidoEn] = useState(null);
  const [botChatIds, setBotChatIds] = useState('');
  const [botOffset, setBotOffset] = useState('0');
  const [mensaje, setMensaje] = useState('');
  const [cargando, setCargando] = useState(false);

  // Cada bloque se carga por separado: si uno falla (p. ej. un 500 en config), los demas se
  // refrescan igual y no quedan mostrando datos viejos como si fueran actuales (QA F-03).
  const cargar = async () => {
    let fallo = false;
    const aviso = (err) => { fallo = true; setMensaje(`⚠️ ${err.message}`); };
    try {
      const cfg = await configApi.obtener();
      setCatalogo(cfg.data.catalogo || []);
    } catch (err) { aviso(err); }
    try {
      const m = await mailerApi.estado();
      setMailer(m.data);
      setMailForm((prev) => ({
        host: m.data.host || '',
        port: m.data.port || '',
        user: m.data.user || '',
        pass: '',
        from: m.data.from || '',
        redirigirA: m.data.redirigirA || '',
      }));
      setPruebaMail((prev) => prev || m.data.from || '');
    } catch (err) { aviso(err); }
    try {
      const a = await crmApi.config();
      setAvisos(a.data);
      setAvisoMail((prev) => prev || a.data.emailControl || '');
    } catch (err) { aviso(err); }
    try {
      const t = await telegramApi.estado();
      setTelegram(t.data);
      setTgForm({ token: '', chatId: t.data.chatId || '' });
    } catch (err) { aviso(err); }
    try {
      const b = await telegramApi.bot();
      setBot(b.data);
      setBotError(null);
      setBotLeidoEn(new Date());
      setBotChatIds((prev) => prev || (Array.isArray(b.data.chatIds) ? b.data.chatIds.join(', ') : (b.data.chatId ? String(b.data.chatId) : '')));
      setBotOffset((prev) => prev || String(Number(b.data.offset || 0)));
    } catch (err) {
      setBotError(err.message);
    }
    // El aviso de error viejo se limpia solo cuando esta recarga salio bien (QA F-02).
    setMensaje((m) => (m.startsWith('⚠️') && !fallo ? '' : m));
  };

  useEffect(() => { cargar(); }, []); // eslint-disable-line

  // El catalogo trae el valor efectivo (DB > default) y la descripcion de cada toggle del CRM.
  const activoDe = (t) => !(t.valor === false || t.valor === 'false' || t.valor === '0' || t.valor === '');
  const togglesCrm = catalogo.filter((t) => t.grupo === 'crm');

  const cambiarToggle = async (clave, valor) => {
    try {
      await configApi.setToggle(clave, valor);
      setMensaje(`Toggle ${clave} → ${valor ? 'activo' : 'apagado'}`);
      cargar();
    } catch (err) {
      setMensaje(`⚠️ ${err.message}`);
    }
  };

  // Toggles numericos (MAX_INTENTOS_PEDIDO, CRM_UMBRAL_PEDIDO): mismo patron que Kernel > Agente
  // (input number que guarda al salir del campo). Antes eran un Toggle y guardaban true/false.
  const cambiarNumero = async (clave, valor) => {
    try {
      await configApi.setToggle(clave, valor);
      setMensaje(`Toggle ${clave} → ${valor}`);
      cargar();
    } catch (err) {
      setMensaje(`⚠️ ${err.message}`);
    }
  };

  const guardarMail = async () => {
    setCargando(true);
    setMensaje('');
    try {
      const r = await mailerApi.guardar({
        host: mailForm.host,
        port: Number(mailForm.port) || undefined,
        user: mailForm.user,
        from: mailForm.from,
        // MODO PRUEBA: se guarda lo que este en el campo (vacio = apagado: los mails salen a los
        // destinatarios reales).
        redirigirA: mailForm.redirigirA,
        ...(mailForm.pass ? { pass: mailForm.pass } : {}),
      });
      setMensaje(`Mail guardado (${r.data.configurado ? 'configurado' : 'incompleto: falta host/usuario/password'}).`);
      cargar();
    } catch (err) {
      setMensaje(`⚠️ ${err.message}`);
    } finally {
      setCargando(false);
    }
  };

  const probarMail = async () => {
    setCargando(true);
    setMensaje('');
    try {
      const r = await mailerApi.probar(pruebaMail);
      setMensaje(`✓ ${r.message || `Prueba enviada a ${pruebaMail}`}`);
    } catch (err) {
      setMensaje(`⚠️ ${err.message}`);
    } finally {
      setCargando(false);
    }
  };

  // Avisos internos (mail de control): destino de los mails de control del sistema (despacho de
  // pedidos, resumen diario, y los ciclos automaticos). Vacio = remitente del mailer.
  const guardarAviso = async () => {
    setCargando(true);
    setMensaje('');
    try {
      const r = await crmApi.configGuardar({ emailControl: avisoMail });
      setAvisos(r.data);
      setMensaje(r.data.emailControl
        ? `Mail de control guardado: ${r.data.emailControl}`
        : 'Mail de control vacio: los avisos van al remitente del mailer.');
      cargar();
    } catch (err) {
      setMensaje(`⚠️ ${err.message}`);
    } finally {
      setCargando(false);
    }
  };

  const guardarTg = async () => {
    setCargando(true);
    setMensaje('');
    try {
      const r = await telegramApi.guardar({
        chatId: tgForm.chatId,
        ...(tgForm.token ? { token: tgForm.token } : {}),
      });
      setMensaje(`Telegram guardado (${r.data.configurado ? 'configurado' : 'incompleto: falta token/chat'}).`);
      cargar();
    } catch (err) {
      setMensaje(`⚠️ ${err.message}`);
    } finally {
      setCargando(false);
    }
  };

  const probarTg = async () => {
    setCargando(true);
    setMensaje('');
    try {
      const r = await telegramApi.probar();
      setMensaje(`✓ ${r.message || 'Mensaje de prueba enviado'}`);
    } catch (err) {
      setMensaje(`⚠️ ${err.message}`);
    } finally {
      setCargando(false);
    }
  };

  // Escucha del Secretario (E-BR5): reiniciar sirve cuando se acaba de encender el toggle.
  const reiniciarBot = async () => {
    setCargando(true);
    setMensaje('');
    try {
      const r = await telegramApi.botReiniciar();
      setMensaje(`✓ ${r.message || 'Escucha reiniciada'}`);
      setBot(r.data);
    } catch (err) {
      setMensaje(`⚠️ ${err.message}`);
    } finally {
      setCargando(false);
    }
  };

  const guardarBot = async () => {
    setCargando(true);
    setMensaje('');
    try {
      const ids = String(botChatIds || '')
        .split(',')
        .map((v) => String(v).trim())
        .filter(Boolean);
      const r = await telegramApi.botActualizar({
        chatIds: ids,
        offset: Number(botOffset) || 0,
        conversacionId: bot && bot.conversacionId ? Number(bot.conversacionId) : null,
      });
      setMensaje(`✓ Estado del bot guardado (${r.data.chatIds ? r.data.chatIds.length : 0} chats autorizados, offset ${r.data.offset || 0}).`);
      cargar();
    } catch (err) {
      setMensaje(`⚠️ ${err.message}`);
    } finally {
      setCargando(false);
    }
  };

  return (
    <div>
      <DebugTag nombre="ConfigCrmPage" />
      <h2 className="text-lg font-semibold mb-1">Configuracion del CRM</h2>
      <p className="text-sm text-muted mb-4">
        Mail y Telegram del modulo, y los interruptores de notificaciones. Las claves se guardan en la base
        (nunca se devuelven completas) y las pruebas mandan un mensaje real.
      </p>
      {mensaje && <p className="text-sm mb-3">{mensaje}</p>}

      <div className="card p-4 mb-4">
        <div className="flex items-center gap-2 mb-3">
          <h3 className="font-semibold">Mail (SMTP)</h3>
          <span className="agente-badge" style={{ color: mailer && mailer.configurado ? '#15803d' : 'var(--danger)' }}>
            {mailer ? (mailer.configurado ? 'configurado' : 'sin configurar') : '...'}
          </span>
        </div>
        <div className="form-grid">
          <Input label="Servidor (host)" value={mailForm.host} onChange={(e) => setMailForm({ ...mailForm, host: e.target.value })} placeholder="smtp.gmail.com" />
          <Input label="Puerto" type="number" value={mailForm.port} onChange={(e) => setMailForm({ ...mailForm, port: e.target.value })} placeholder="587" />
          <Input label="Usuario" value={mailForm.user} onChange={(e) => setMailForm({ ...mailForm, user: e.target.value })} placeholder="cuenta@gmail.com" />
          <Input label="Password (dejar vacío para no cambiarla)" type="password" value={mailForm.pass} onChange={(e) => setMailForm({ ...mailForm, pass: e.target.value })} placeholder={mailer && mailer.pass ? mailer.pass : ''} />
          <Input label="Remitente (from)" value={mailForm.from} onChange={(e) => setMailForm({ ...mailForm, from: e.target.value })} placeholder="Librería El Maltés <cuenta@gmail.com>" />
          <Input
            label="MODO PRUEBA: redirigir TODOS los mails a"
            value={mailForm.redirigirA}
            onChange={(e) => setMailForm({ ...mailForm, redirigirA: e.target.value })}
            placeholder="airegla@gmail.com (vacío = manda a los destinatarios reales)"
          />
        </div>
        {mailer && mailer.redirigirA ? (
          <p className="text-xs mt-2" style={{ color: '#b45309', fontWeight: 600 }}>
            ⚠️ MODO PRUEBA ACTIVO: ningún mail sale a clientes reales; todos van a <span className="font-mono">{mailer.redirigirA}</span> (con el destinatario original en el asunto).
          </p>
        ) : (
          <p className="text-xs text-muted mt-2">
            Sin redirección: los mails salen a los destinatarios reales (clientes y proveedores).
          </p>
        )}
        <div className="flex items-end gap-2 flex-wrap mt-1">
          <button type="button" className="btn btn-primary text-sm" disabled={cargando} onClick={guardarMail}>Guardar mail</button>
          <label className="text-sm flex-1 min-w-[220px]">
            <span className="field-label">Probar envío a</span>
            <input className="input-os" value={pruebaMail} onChange={(e) => setPruebaMail(e.target.value)} placeholder="destino@ejemplo.com" />
          </label>
          <button type="button" className="btn text-sm" disabled={cargando || !pruebaMail} onClick={probarMail}>Enviar prueba</button>
        </div>
      </div>

      <div className="card p-4 mb-4">
        <div className="flex items-center gap-2 mb-3">
          <h3 className="font-semibold">Avisos internos (mail de control)</h3>
          <span className="agente-badge" style={{ color: avisos && avisos.emailControl ? '#15803d' : undefined }}>
            {avisos ? (avisos.emailControl ? 'propio' : (avisos.remitente ? 'remitente del mailer' : 'sin destino')) : '...'}
          </span>
        </div>
        <p className="text-sm text-muted mb-3">
          Destinatario de los avisos internos: el mail de control de pedidos despachados, el resumen
          diario y los avisos de los ciclos automaticos. Vacío = usa el remitente del mailer.
        </p>
        <div className="flex items-end gap-2 flex-wrap">
          <label className="text-sm flex-1 min-w-[260px]">
            <span className="field-label">Mail de control</span>
            <input className="input-os" value={avisoMail} onChange={(e) => setAvisoMail(e.target.value)} placeholder="airegla@gmail.com" />
          </label>
          <button type="button" className="btn btn-primary text-sm" disabled={cargando} onClick={guardarAviso}>Guardar</button>
        </div>
        {avisos && <p className="text-xs text-muted mt-2">Efectivo ahora: <span className="font-mono">{avisos.efectivo || '-'}</span></p>}
      </div>

      <div className="card p-4 mb-4">
        <div className="flex items-center gap-2 mb-3">
          <h3 className="font-semibold">Telegram (avisos internos)</h3>
          <span className="agente-badge" style={{ color: telegram && telegram.configurado ? '#15803d' : 'var(--danger)' }}>
            {telegram ? (telegram.configurado ? 'configurado' : 'sin configurar') : '...'}
          </span>
        </div>
        <div className="form-grid">
          <Input label="Token del bot" value={tgForm.token} onChange={(e) => setTgForm({ ...tgForm, token: e.target.value })} placeholder={telegram && telegram.token ? telegram.token : '123456:ABC-DEF...'} />
          <Input label="Chat id" value={tgForm.chatId} onChange={(e) => setTgForm({ ...tgForm, chatId: e.target.value })} placeholder="-1001234567890" />
        </div>
        <div className="flex items-center gap-2 flex-wrap mt-1">
          <button type="button" className="btn btn-primary text-sm" disabled={cargando} onClick={guardarTg}>Guardar Telegram</button>
          <button type="button" className="btn text-sm" disabled={cargando || !(telegram && telegram.configurado)} onClick={probarTg}>Enviar prueba</button>
          <span className="text-xs text-muted">Creá el bot con @BotFather y pasale el chat id del grupo o chat interno.</span>
        </div>
      </div>

      <div className="card p-4 mb-4">
        <div className="flex items-center gap-2 mb-2">
          <h3 className="font-semibold">Secretario por Telegram</h3>
          <span className="agente-badge" style={{ color: botError ? '#b45309' : bot && bot.activo ? '#15803d' : 'var(--danger)' }}>
            {botError ? 'sin lectura' : bot ? (bot.activo ? 'escuchando' : 'en pausa') : '...'}
          </span>
        </div>
        <p className="text-sm text-muted mb-3">
          Con el interruptor <span className="font-mono text-xs">TELEGRAM_SECRETARIO_ENABLED</span> encendido, el bot
          atiende como el Secretario en el chat autorizado (long-polling: no hace falta URL pública).
          Los demás chats reciben el rechazo y quedan registrados.
        </p>
        <div className="text-xs text-muted grid grid-cols-2 md:grid-cols-4 gap-2 mb-3">
          <div><span className="text-muted">Chat autorizado: </span><span className="font-mono">{bot && bot.chatId ? bot.chatId : '-'}</span></div>
          <div><span className="text-muted">Conversación: </span>{bot && bot.conversacionId ? `#${bot.conversacionId}` : '-'}</div>
          <div><span className="text-muted">Mensajes: </span>{bot ? bot.procesados : '-'}</div>
          <div><span className="text-muted">Rechazados: </span>{bot ? bot.rechazados : '-'}</div>
          <div><span className="text-muted">Offset: </span>{bot ? bot.offset : '-'}</div>
          <div className="col-span-2"><span className="text-muted">Último mensaje: </span>{bot && bot.ultimoMensajeEn ? new Date(bot.ultimoMensajeEn).toLocaleString('es-AR') : '-'}</div>
          <div className="col-span-2"><span className="text-muted">Último error: </span>{bot && bot.ultimoError ? bot.ultimoError : '-'}</div>
        </div>
        {botError && (
          <p className="text-xs mb-2" style={{ color: '#b45309', fontWeight: 600 }}>
            ⚠️ No se pudo leer el estado del bot ({botError}): los valores de arriba pueden ser viejos. Usá «Refrescar estado».
          </p>
        )}
        {bot && !botError && botLeidoEn && (
          <p className="text-xs text-muted mb-2">Estado leído: {botLeidoEn.toLocaleTimeString('es-AR')}</p>
        )}
        {bot && !bot.activo && bot.motivo && <p className="text-xs mb-2" style={{ color: '#b45309', fontWeight: 600 }}>⚠️ En pausa: {bot.motivo}</p>}
        <div className="form-grid mt-3">
          <label className="text-sm">
            <span className="field-label">Chats autorizados (lista)</span>
            <input className="input-os" value={botChatIds} onChange={(e) => setBotChatIds(e.target.value)} placeholder="-100123,-100456" />
          </label>
          <label className="text-sm">
            <span className="field-label">Offset del polling</span>
            <input className="input-os" type="number" value={botOffset} onChange={(e) => setBotOffset(e.target.value)} placeholder="0" />
          </label>
        </div>
        <div className="flex items-center gap-2 flex-wrap mt-3">
          <button type="button" className="btn btn-primary text-sm" disabled={cargando} onClick={guardarBot}>Guardar bot</button>
          <button type="button" className="btn text-sm" disabled={cargando} onClick={reiniciarBot}>Reiniciar escucha</button>
          <button type="button" className="btn btn-ghost text-sm" onClick={cargar}>Refrescar estado</button>
          <span className="text-xs text-muted">Comandos: /nueva (tema aparte) · /ayuda · `confirmar` para las escrituras pendientes.</span>
        </div>
      </div>

      <div className="card p-4">
        <h3 className="font-semibold mb-3">Interruptores del CRM</h3>
        <div className="space-y-3">
          {togglesCrm.map((t) => (
            <div key={t.clave}>
              <div className="flex items-center gap-3">
                {t.tipo === 'bool' ? (
                  <>
                    <Toggle activo={activoDe(t)} onChange={(v) => cambiarToggle(t.clave, v)} />
                    <span className="text-sm font-mono">{t.clave}</span>
                  </>
                ) : (
                  <>
                    <span className="text-sm font-mono">{t.clave}</span>
                    <input
                      type="number"
                      className="input-os"
                      style={{ maxWidth: 120 }}
                      defaultValue={t.valor}
                      onBlur={(e) => {
                        const v = e.target.value;
                        if (String(v) !== String(t.valor)) cambiarNumero(t.clave, v);
                      }}
                    />
                  </>
                )}
              </div>
              <p className="text-xs text-muted mt-1">{t.descripcion}</p>
            </div>
          ))}
        </div>
        <p className="text-xs text-muted mt-3">
          Los interruptores del <strong>agente</strong> (prompt, pasos, manuales de herramientas) viven en Core ▾ Agent ▾ Agente.
        </p>
      </div>
    </div>
  );
}
