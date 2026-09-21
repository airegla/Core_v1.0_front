<!--
nombre: README-FRONTEND.md
ruta: bookos/frontend/README-FRONTEND.md
descripcion: como levantar y probar el frontend de BookOS (React + Vite + Tailwind).
-->

# BookOS — Frontend (OS)

> **Documento técnico canónico del frontend.** El `README.md` del repositorio es solo la presentación
> para GitHub; la referencia de instalación, estructura, reglas del OS y tramos vive acá.

React + Vite + Tailwind. Homogeneidad total, todo en modales, **cambiar de pagina no borra trabajo**.

## Instalacion

```bash
npm install
npm run dev   # http://localhost:5174 (proxy /api -> backend 3002)
```

## Estructura

```
src/
  App.jsx            shell: login + navbar (menus por flujo) + layout contenido/Secretario
  AppContext.jsx     contexto de pantalla inyectado al agente
  api/               axiosClient (JWT + envelope) + modulos por dominio
  blocks/            AgenteChatBlock · ManualBlock · CargarDocumentoBlock · BuscadorArticuloBlock
  pages/             27 paginas: Catalogo, Referencias, Ventas (POS/historial/periodo), Compras,
                     Remitos, Caja, CtaCte, Consigna, Inventario, Clientes, Proveedores,
                     Transportes, Mayorista, Newsletter, Usuarios, Parametros, Empresa, Config,
                     Desarrollo y el grupo Kernel (Salud, Agente, Perfiles, Modelo local, Pesos,
                     Banco de pruebas, Propuestas Kernel, Logs, Cola, Memoria)
  ui/                Modal, Table, Paginador, Toggle, Input, DebugTag, Navbar, MermaidDiagram
  hooks/             useAgenteStream (SSE) · usePersistentWork (borradores)
  styles/globals.css UNICO lugar para modificar la identidad visual
  utils/             desarrolloPreguntas.js (instalador extensible)
```

<!-- ARBOL:INICIO (generado por backend/scripts/arbol-readmes.js - no editar a mano) -->
## Arbol de archivos

_Generado desde el encabezado de cada archivo (`node scripts/arbol-readmes.js`)._

**src/**

- `App.jsx` — shell del OS. Login JWT, navbar de 7 vistas y layout contenido + Secretario lateral (persistente). Cambiar de vista no borra nada.
- `AppContext.jsx` — contexto del OS. Lleva el contexto de pantalla que se inyecta al Secretario (ej. el remito que estas viendo) y los ultimos recomendados para cerrar el ciclo de outcome en la venta.
- `constants.js` — Constantes compartidas del frontend (fuente única).
- `main.jsx` — punto de entrada React. Carga la hoja de estilos unica del OS.

**src/api/**

- `api.js` — modulos de acceso a cada dominio del backend.
- `axiosClient.js` — cliente HTTP unico del OS. Inyecta el JWT y desempaqueta el envelope {success, message, data}. En 401 limpia sesion.

**src/blocks/**

- `AgenteChatBlock.jsx` — VENTANA de chat del agente, reutilizable por LADO y PERFIL. El Secretario (perfil 'secretario', lado derecho) y el Vendedor (perfil 'ventas', lado izquierdo: ex pagina del CRM) son la MISMA pieza: en escritorio el aside es una columna del layout; en pantallas chicas se abre a pantalla completa desde su boton flotante.
- `AltaRapidaClienteBlock.jsx` — alta RAPIDA de cliente con 3 datos (nombre, celular, email). Lo monta el shell (App.jsx) y se abre con F2 desde cualquier vista; el cliente creado se anuncia por el bus de instrucciones para que la vista activa lo tome como cliente elegido (factura minorista, pedidos). Existe porque cargar un cliente tiene que costar segundos: la ficha es la que alimenta el seguimiento (tematicas, grafo de relaciones y propuestas de titulos).
- `AsistenteVentasBlock.jsx` — el VENDEDOR: la VENTANA IZQUIERDA del asistente de ventas (perfil 'ventas' del agente). Antes era una pagina dentro de CRM; ahora es una ventana propia que convive con el Secretario (derecha) y comparte el MISMO motor y los MISMOS ajustes (adjuntos, voto del turno, conversaciones, voz, watchdog del stream). Los chips de arriba son los pedidos tipicos del mostrador y los marcadores a la vista.
- `BuscadorArticuloBlock.jsx` — buscador de articulos para agregar a un comprobante (EAN, titulo, autor o editorial) con debounce 300 ms y sugerencias (patron bookerp). Se usa en ventas, compras y remitos para no depender de tipear el EAN de memoria.
- `BuscadorSemanticoBlock.jsx` — F7 — el buscador SEMANTICO del kernel como modal global, con las MISMAS tarjetas del asistente (titulo, score, autor/editorial, precio y stock) y sus acciones: agregar el renglon cuando se esta facturando y preguntarle al Secretario. Desde aca tambien se abre la pagina del Asistente de ventas (hoy: la ventana izquierda del Vendedor). PERSISTENTE: cerrar no pierde nada (texto, resultados y consulta se conservan; una busqueda en curso sigue viva y al volver con F7 esta ahi). El boton Limpiar arranca de cero.
- `BuscadorTecnicoBlock.jsx` — F6 — el buscador TECNICO del mostrador (la busqueda F7 del bookerp): modal global con la sintaxis T titulo / A autor / * codigo / X contiene contra /api/catalogo/f7. Es rapido y practico: LISTADO (no tarjetas), navegacion con flechas, Enter agrega el renglon cuando se esta facturando, y el resultado tecnico (EAN, precio, stock) siempre a la vista.
- `CargarDocumentoBlock.jsx` — carga el contenido de un comprobante de otro modulo dentro del que se esta armando (patron bookerp): elegis un remito/pedido/compra recuperable y sus renglones se copian al borrador actual. Muestra preview antes de cargar.
- `ChatAgente.jsx` — chat del agente, reutilizable por perfil. El Secretario (panel lateral) y el Asistente de ventas (la ventana izquierda del Vendedor) comparten este componente: mismo motor, misma conversacion persistente y mismo render del envelope; cambia la semilla/tools del backend (perfil) y el texto de arranque. Tres zonas: cabecera fija, mensajes con scroll y entrada. Bajo la respuesta viaja el voto del turno (pulgar + escala, plan-rediseno/11 E3): el operario manda sobre cualquier inferencia del evaluador. 18-Sep-2026: (a) el scroll SIGUE al agente —cada mensaje y cada pedazo de texto en streaming se ven sin tocar nada— salvo que el operario haya subido a leer algo: ahi no se lo arrastra; (b) VOZ con lo nativo del navegador (hooks/useVoz.js): micro para dictar el pedido y lectura en voz alta, que se activa sola SOLO si el pedido vino por micro (mas un boton 🔊 por respuesta); (c) IMAGENES: se pueden adjuntar fotos y capturas (el modelo las mira, ver agente.service).
- `ConfigTogglesBlock.jsx` — bloque reutilizable del CATALOGO de interruptores en caliente (runtimeConfig). Cada pagina lo monta con su GRUPO y el backend decide que claves entran: una clave nueva del backend aparece sola en su pantalla, sin tocar el front. Cablea debug_mode al front al vuelo (activarDebug) porque ese toggle es del navegador y los demas son del backend.
- `FormasPagoBlock.jsx` — sub-formas de pago (debito, credito 6 cuotas, promo semanal de Santa Fe...) vinculadas a un metodo de pago madre y a un operador, con su coeficiente y cuotas. Son las lineas que se eligen al cobrar (F10) y al registrar un recibo.
- `ImportarCsvBlock.jsx` — importador CSV reutilizable. Dos destinos: 1) "Cargar en la vista": llama onCargar(filas) para meter las filas en el documento que se esta trabajando (items de venta, remito, liquidacion...). 2) "Procesar con el Secretario": adjunta el CSV al contexto y le pide al agente que lo procese con la herramienta que corresponda.
- `ImportarDocumentoBlock.jsx` — modal "Importar documento" (bookerp: ImportarComprobanteModalBlock). Pestañas por módulo (pedidos, compras, remitos, liquidaciones, devoluciones), búsqueda, selección con vista previa y carga de los libros al trabajo actual.
- `InteresesClienteBlock.jsx` — intereses de un cliente (doc 06 P5): tematicas cargadas con su origen, alta y baja, siembra de un perfil default y la afinidad REAL medida de sus compras. Es el mismo bloque en la ficha ("Ver") y en la edicion del cliente: lo que se ve es lo que se edita.
- `ItemsEditorBlock.jsx` — tabla editable generica para cargar items de un comprobante (venta, remito, liquidacion). Recibe columnas configurables y delega cambios al padre. La lista se pagina de a 20 (los documentos largos - una liquidacion importada, por ejemplo - no rompen la pantalla): los indices que recibe el padre son SIEMPRE los globales del array.
- `ManualBlock.jsx` — el manual vivo de BookOS en un modal con una solapa por tema (uso tecnico, CRM, el Secretario, el Kernel, los flujos y las herramientas). Renderiza el markdown simple del backend (secciones, listas, tablas, notas) y los diagramas Mermaid como graficos.
- `MayoristaCabeceraBlock.jsx` — cabecera de una operacion del mayorista (F-12 §4.4): cliente (con su descuento y plazo), deposito de origen, tipo de operacion, fecha y observaciones. El deposito de destino es SIEMPRE el espejo del cliente elegido (su sabana): se muestra, no se elige.
- `MayoristaTablaBlock.jsx` — renglones de una operacion del mayorista (F-12 §4.4): buscador asincronico de articulos + cantidad + tipo de stock por linea (consigna/firme) + importacion de CSV. Es el mismo bloque para remitos, facturas y devoluciones: cambia lo que la pagina hace con los items. Con conPrecio (facturas) muestra precio, descuento por linea y subtotal; con sabana (baja de consigna) muestra el disponible real del cliente por titulo y avisa si se factura de mas. La lista de renglones se pagina de a 20 (los documentos largos, p. ej. una liquidacion importada, no rompen la pantalla); los indices que editan son siempre los globales.
- `ModeloChicoBlock.jsx` — panel del modelo chico local CON HERRAMIENTAS (laboratorio). Muestra su estado y el de su worker, sus interruptores y topes editables en caliente (los del grupo 'chico' del catalogo del backend, no una lista escrita aca), el indice compacto de las herramientas para ajustarlo a mano (descripcion por modulo; las acciones salen del contrato y no se editan desde aca), la semilla corta y el prompt final que recibe el modelo. Lo monta la pantalla Core > LLM > Modelo local. Regla del laboratorio: lo que el motor usa tiene que poder verse y tocarse desde el front; si algo no esta en esta pantalla, el vectorHumano no puede accederlo.
- `OperadoresPagoBlock.jsx` — mantenimiento de operadores/pasarelas de pago (posnet de Payway, pos de MercadoPago, Fiserv...) con su porcentaje estimado de costo. Es la tabla madre de las sub-formas de pago: cada sub-forma cuelga de un operador.

**src/hooks/**

- `useAgenteStream.js` — consumo del SSE del Secretario (POST + stream). Expone estados, candidatos, la pregunta del agente (confirmacion/clarificacion) y el texto que llega palabra por palabra. El adjunto viaja como { nombre, contenido }.
- `useAtajoGlobal.js` — atajo de teclado GLOBAL (patron del bookerp, adaptado): escucha en window, evita la accion por defecto del navegador y llama al callback. `activo` permite apagarlo (por ejemplo mientras hay un modal abierto, para no re-dispararlo).
- `useIsMobile.js` — Hook para detectar viewport móvil (matchMedia).
- `usePagination.js` — Hook de paginación + búsqueda en memoria para tablas.
- `usePersistentWork.js` — borradores que sobreviven al cambio de pagina y al refresco (localStorage). Regla de oro del OS: cambiar de pagina NO borra trabajo. La clave va POR USUARIO (el id lo deja el login en localStorage): dos operarios en la misma PC no se pisan el borrador. Devuelve ademas `restaurado`, para que la pantalla avise con el indicador "↺ limpiar".
- `useVoz.js` — voz del chat con lo NATIVO del navegador (Web Speech API): dictado por microfono (SpeechRecognition) y lectura en voz alta (speechSynthesis). El audio no sale de la maquina: no hay servidor, clave ni costo por uso. Antes de usarlo se consulta `soportaDictado`/`soportaLectura` y el navegador que no las tiene NO muestra los botones: esconder la funcion es mas honesto que un boton que no hace nada. Idioma por defecto: es-AR. El dictado devuelve el texto COMPLETO de la toma (final + lo que el navegador va adivinando), para que quien lo use escriba en su cuadro sin tener que concatenar.

**src/pages/**

- `AgentePage.jsx` — el agente en el Kernel (es uno solo: Secretario y Asistente de ventas comparten motor). Muestra su estado (LLM, modelo, pasos, presupuesto), sus toggles (prompt completo o hibrido, cuantas herramientas con manual completo, pasos del loop, techo de contexto) y el inventario de herramientas con el uso real (la automejora: lo calibra la reflexion). El MODELO CHICO LOCAL no se ajusta aca: sus toggles, su semilla y su indice viven en Kernel > Modelo local, y su medicion en Kernel > Banco de pruebas.
- `BancoPruebasPage.jsx` — pantalla del BANCO DE PRUEBAS con TRES duenos en pestanas: el BUSCADOR (serie fija de consultas evaluada con el LLM pago; antes vivia dentro de Pesos), el ROUTER (banco de pedidos con ruta esperada: plantilla sin LLM, planificador y selector) y el MODELO CHICO (que herramienta elige el chico para cada consulta de la serie). El foco entra por prop desde el menu (Core > Kernel > Banco del buscador / Router > Banco del router / LLM > Banco del modelo chico). Las tres son instrumentos de MEDICION: ninguna activa nada por si sola. La del buscador, si encuentra mejora, deja una propuesta para aprobar; las otras dos solo dejan el reporte.
- `CajaPage.jsx` — arqueo de caja y cierre Z (reglas de bookerp). Estado del turno, movimientos manuales, cierre con diferencia y historial. Integrado al Secretario (contexto de caja).
- `CampaniasPage.jsx` — campañas del CRM (doc 06 D7). Historial de campañas con su configuración y estado, alta (brief + cantidad de títulos + segmento + vigencia), generación de los borradores por lotes (el asistente arma un mail por cliente con títulos en stock), revisión práctica (aprobar / rechazar de a una o todas) y envío de lo aprobado, respetando el MODO PRUEBA.
- `CatalogoPage.jsx` — catalogo enriquecido. Listado paginado + busqueda hibrida semantica + modal de alta/edicion (todo en modal, nada borra trabajo).
- `ClientesPage.jsx` — ABM de clientes y visualizacion de su grafo de interacciones (EVITA_AUTOR / PREFIERE_EDITORIAL / RECHAZO_IMPLICITO) inferido sin clics.
- `ColaPage.jsx` — panel de Cola del enriquecimiento (E4/E7): estados de la cola, pendientes por prioridad, cobertura del stock activo, breakers de las fuentes externas y presupuesto LLM del dia. Descarga del estado en CSV.
- `ComprasPage.jsx` — ingreso de compras a proveedores (candado FIFE firme/consigna), historial/anulacion + pedido a proveedor (bookerp) en modal. El pedido no afecta stock hasta confirmarse (al confirmar genera la compra).
- `ConfigCrmPage.jsx` — configuracion del CRM (doc 06): mail (SMTP con prueba de envio real), Telegram (bot con prueba) y los toggles del modulo (grupo 'crm' del catalogo: notificaciones, radar, intentos de pedido, envio a proveedor). El password/token nunca vuelven de la API.
- `ConfigPage.jsx` — configuracion del LEDGER: aca viven SOLO los interruptores que tocan stock, caja y cuenta corriente (consigna, depositos, sync del legacy). El resto tiene su casa por dueno: agente (Core > Agent > Agente), enriquecimiento (Core > Kernel > Enriquecimiento), modelo chico (Core > LLM > Modelo local), CRM (CRM > Config CRM), bandeja de precios (Sistema > Importador) y marcas de debug (Sistema > Desarrollo). Los paneles del kernel que vivian aca se mudaron a Core > Kernel > Propuestas Kernel y Core > Logs > Logs del core.
- `ConsignaPage.jsx` — flujo de consignacion: liquidaciones, conciliador de sabanas, devoluciones (motor FIFE) y preparado de devolucion (CSV del proveedor cruzado con el stock de cada local, con descarga general o por sucursal). Interconectado con el Secretario (contexto + consulta + observaciones LLM de cada documento).
- `CrmEnConstruccion.jsx` — placeholder honesto de las paginas del CRM que llegan en etapas posteriores (doc 06): dice que es, para que sirve y en que etapa del plan se construye.
- `CtaCtePage.jsx` — cuenta corriente unificada (clientes y proveedores comparten la misma tabla). Estado de cuenta, recibos, anulacion y observacion de comportamiento del Secretario (LLM estudia los movimientos y se semanticiza).
- `DesarrolloPage.jsx` — instalador PoC. Entrevista simple (nombre, pais, rubro, como te llega el stock, como vendes). Las preguntas viven en utils/desarrolloPreguntas.js: agregar una pregunta no toca codigo core. Las respuestas se guardan en empresa.config (puerta abierta al JSON maestro del LLM en una fase futura).
- `EmpresaPage.jsx` — datos de la empresa (fiscales AR por defecto). Editable, nunca
- `EnriquecimientoPage.jsx` — pantalla del ENRIQUECIMIENTO (Core > Kernel > Enriquecimiento). Reune los interruptores que gobiernan de donde sale el entendimiento del catalogo: las FUENTES de sinopsis, el CICLO automatico de la cola y el WORKER de embeddings (el motor de vectores). Antes vivian repartidos en Sistema > Config, donde no se los encontraba. La cola se mira en Core > Kernel > Cola y el resultado del pipeline en Core > Salud.
- `ImportadorPage.jsx` — importacion masiva por CSV (plan 09). Admin importa catalogo y referencias; todo el equipo actualiza precios (con bloqueo opcional de bajas). Flujo: config -> mapeo de columnas -> preview sin efectos -> aplicacion por lotes -> historial con detalle por fila y descargas. Regla: lo que no se mapea, no se modifica. Incluye la pestana Bandeja (modulo J, admin): subir documentos de precios (CSV/Excel/PDF), procesar, ver las actualizaciones PENDIENTES y aprobarlas o anularlas desde el propio historial.
- `InventarioPage.jsx` — deposito e inventario: stock por articulo, transferencia local<->deposito y ajuste de inventario (firme/consigna).
- `LogsPage.jsx` — panel de Logs. Tres vistas ordenadas (mas nuevo primero): actividad del LLM y del agente (llm_audit_log), pipeline de enriquecimiento (enriquecimiento_intento) y la AUDITORIA DEL RANKING (las ultimas busquedas del kernel, que antes vivian en Sistema > Config). Filtros por modulo/ruta/proveedor/etapa y descarga CSV.
- `MayoristaPage.jsx` — modulo mayorista (F-12). Patron de 3 bloques (cabecera / tabla / chat del Secretario). Estado: E7 — remitos; E8 — facturación (firme / genérica / baja de consigna / NC); E9 — devoluciones (consigna con tope de sábana / firme con NC) + acuse; E10 — pedidos de devolución (individual, lote por CSV, aprobar/enviar/conciliar/acuse); E11 — sábanas (previsualización valorizada + emisión numerada + envío/reenvío + borrado) y ajustes de consignación (INCREMENTO/DECREMENTO con ledger, motivo obligatorio y anulación). Todos los historiales con Ver/CSV/PDF/Mail/Anular/🧠, paginador server-side y buscador con debounce.
- `MemoriaPage.jsx` — panel de Memoria del Secretario. Muestra lo que quedo guardado por tipo (nota, buena_practica, decision, preferencia) y por ESTADO, permite filtrar, descargar y (admin) eliminar entradas. La memoria entra al prompt del agente en cada turno. 18-Sep-2026 (propuestas #46/#47/#48): se fue `ultimo_trabajo` (duplicaba el log de turnos) y las buenas practicas son la CONDUCTA del agente: se ven PROPUESTAS hasta que el operario da la orden con $asentar en el chat. El panel NO asienta: muestra, y la orden es una sola via.
- `ModeloLocalPage.jsx` — pantalla del MODELO LOCAL (Kernel > Modelo local). Reune lo que antes estaba repartido entre Sistema > Config y Kernel > Agente: el panel del modelo chico con herramientas (toggles de encendido y modo, topes, semilla, indice y prompt exacto) y el control de los workers locales, que son los dos procesos de modelo que corren en la maquina. Regla del laboratorio: lo que el motor usa tiene que poder verse y tocarse desde el front; si algo no esta en una pantalla, el vectorHumano no puede accederlo.
- `NewsletterPage.jsx` — suscriptores del newsletter (integrado al CRM). Altas/bajas manuales y listado exportable.
- `ParametrosPage.jsx` — parametros del OS — metodos de pago (bookerp: tipos de pago) y categorias de caja (bookerp: categorias de los movimientos manuales).
- `PedidosPage.jsx` — pedidos de clientes del CRM (doc 06): alta, filtros por estado y busqueda, paginado server-side, cambio de estado por fila y export CSV. Los estados son los 6 del ciclo de vida (Pendiente -> Solicitado -> Ingresado -> Notificado | Agotado | Cancelado).
- `PerfilesPage.jsx` — "Ver perfiles" del Kernel (plan-rediseno/11, E7). Un perfil de usuario por fila con su informacion empatica reunida para ANALISIS RAPIDO: como viene el trato (score contra su target y su tendencia), consentimiento y pausa, cuantos intercambios evaluados tiene, que senales se repiten, el animo, los votos humanos y el APRENDIZAJE que hoy entra al prompt. Al abrir una fila se ve el detalle (las ultimas evaluaciones con la razon del score y la historia de lo que conto el operario) y las acciones de privacidad: pausar, revocar, exportar y dar de baja. El score es informacion INTERNA: vive aca, no en la conversacion con el operario.
- `PesosPage.jsx` — panel de PESOS con DOS duenos en la misma pantalla: el BUSCADOR SEMANTICO (similitud por intencion + terminos y umbrales del ranking) y el ROUTER (diales del selector de rutas y su compuerta). El foco entra por prop desde el menu (Core > Kernel > Pesos del buscador / Core > Router > Pesos del router); guardar crea una version nueva y activa, y la anterior queda para rollback. La medicion vive en Banco del buscador / Banco del router.
- `PlantillasMailPage.jsx` — editor de los mails que manda el sistema (CRM > Plantillas mail). Lista de plantillas con asunto y cuerpo editables, variables que se insertan en el cursor, vista previa en vivo con datos de ejemplo, envio de prueba real y el manual de variables.
- `PropuestasPage.jsx` — panel de Propuestas. La reflexion y el calibrador dejan aca lo que proponen (marcadores, pesos, reglas) con su detalle y observacion; aprobar una propuesta la aplica de verdad (marcador o version de pesos). Solo el admin aprueba o rechaza.
- `PropuestasVentaPage.jsx` — propuestas de lectura del CRM (doc 06 P5/D6): el operario elige cliente, cantidad y una aclaracion, el asistente arma la propuesta (tematicas + afinidad + stock, seleccion y motivos por LLM) y queda en BORRADOR para revisarla antes de mandarla por mail. P7: si la propuesta ya se envio, se puede medir el outcome (que titulos compro el cliente) y queda a la vista en la columna Resultado.
- `ProveedoresPage.jsx` — ABM de proveedores (regla bookerp: no se puede borrar si tiene compras asociadas).
- `RadarPage.jsx` — el Radar del CRM (doc 06): foto de los pedidos por estado, los grupos que se despacharian por proveedor y las corridas del ciclo — verificar ingresos (ledger), notificar ingresos (mail al cliente + aviso interno) y notificar agotados.
- `ReferenciasPage.jsx` — referencias maestras del catalogo — autores, materias y editoriales (bookerp: aut__autores, mtr__materias, editoriales). CRUD completo + "Preguntar al Secretario" + observacion LLM sobre el portfolio de cada editorial.
- `RemitosPage.jsx` — ingreso de remitos en esquema "cabecera + tabla de items" + cruce de faltantes. Interconectado con el Secretario: inyecta el borrador y escucha instrucciones (refrescar, cruzar) para que el agente opere la vista.
- `SaludPage.jsx` — panel de Salud del kernel (doc 01 §8). Muestra el ultimo reporte de la auditoria diaria (checks con nivel y detalle) y la tendencia de las corridas; el admin puede disparar una corrida y descargar la serie.
- `TransportesPage.jsx` — transportes y depositos (eje del modulo mayorista). CRUD simple, stock por deposito y conexion con el Secretario.
- `UsuariosPage.jsx` — ABM de usuarios con la regla indegradable visible: el ultimo admin no se puede borrar, desactivar ni degradar (el backend lo bloquea).
- `VentasPage.jsx` — comprobante de venta en esquema "cabecera + tabla de items". Features bookerp: multi-pago, pendientes/recuperar (PEDIDO/PRESUPUESTO), giftcard (PDF), captura de email/newsletter y F10. Interconectado con el
- `VentasPeriodoPage.jsx` — listado de ventas por periodo (el dia o un rango) con subtotales, filtro por tipo, paginado server-side y descarga CSV. Equivale a los "listados de la venta del dia y por periodo" del sistema legacy. Se puede EMBEBER en un modal (prop `embebido`): en ese caso no repite el titulo ni la marca de debug, porque el modal ya los pone (Caja > Ventas del periodo).

**src/styles/**

- `app.css`
- `globals.css` — base Tailwind + variables del OS (identidad visual de Meta). UNICO LUGAR para modificar estilos globales: colores, tarjetas, botones, tablas, modales y panel del agente. /

**src/ui/**

- `BorradorRestaurado.jsx` — aviso sutil de que la pantalla tiene trabajo recuperado del disco (la sesion del usuario sobrevive al refrescar). El boton "↺ limpiar" arranca de cero: es el unico gesto para descartar el borrador. Vive en un solo lugar para que todas las paginas se vean igual.
- `BotonSecretario.jsx` — boton unico para hablar con el Secretario. Reemplaza los botones sueltos "Preguntar al Secretario" repartidos por el front: el icono, el texto, el tooltip y el comportamiento viven en un solo lugar (si algun dia el boton desaparece, se borra aca). Recibe la consulta ya armada por la vista y la deja en el bus del contexto, que la lleva al chat. Con `alPedir` la vista puede ademas cerrar su modal.
- `CardSistema.jsx` — card de las metricas del SERVIDOR para el panel de Salud: memoria disponible, uso de CPU, disco, carga, uptime y los procesos que mas RAM comen. Cada numero declara DE DONDE SALE (el comando del sistema que lo midio, o la API de Node cuando la plataforma no tiene ese comando): la procedencia no es un adorno, es lo que permite auditar el dato. Se refresca sola cada 30 s y tiene su boton para refrescar a mano.
- `DebugTag.jsx` — marca de identificacion de componente cuando debug_mode esta activo. Dos fuentes y alcanza con una: VITE_DEBUG_MODE (build) y el toggle debug_mode del OS (runtime, Sistema ▾ Desarrollo). Estado REACTIVO unico (useSyncExternalStore) compartido con el shell: el toggle se ve al instante, sin recargar, y VITE_DEBUG_MODE=true sigue siendo el piso. debug_mode=false -> no renderiza nada.
- `Input.jsx` — input estandarizado del OS (clase .input-os).
- `MermaidDiagram.jsx` — renderiza un diagrama Mermaid (texto) como SVG dentro del manual.
- `Modal.jsx` — modal base del OS. Todo lo que crea/edita pasa por aca para no perder trabajo al navegar. Cierra con ESC.
- `Navbar.jsx` — navegacion del OS agrupada en bloques semanticos. En escritorio cada grupo es un desplegable (el grupo que contiene la vista actual queda resaltado); en pantallas chicas la navegacion se muda a una BARRA INFERIOR estilo SO (KDE): lanzador "Menú" + accesos fijos, y el menu completo se abre como panel agrupado por modulos. Cambiar de pagina NO borra trabajo.
- `Paginador.jsx` — controles de paginacion server-side (page / limite / total) para los listados del OS. Patron bookerp: el backend pagina, la vista solo navega.
- `SelectBuscador.jsx` — selector asincronico para maestros grandes (clientes, proveedores, autores, materias, editoriales). Busca en el servidor con debounce a partir de 2 letras (nunca precarga la tabla entera), navega con teclado (flechas/Enter/Escape) y permite limpiar la seleccion. En modo libre, el texto tipeado tambien vale sin elegir sugerencia.
- `TablaItemsPaginada.jsx` — vista de renglones de un documento (modales de detalle: Ver remito, Ver venta, Ver compra, Ver liquidacion...) con paginacion local de a 25 filas: los documentos largos no rompen el modal. Recibe los headers y una funcion que arma cada fila (el indice es el global).
- `Table.jsx` — tabla base del OS (clase .table-os del globals.css). Si recibe exportable=true, agrega un boton "Exportar CSV" que descarga el listado que se esta viendo (usa los datos crudos de cada fila).
- `Toggle.jsx` — switch del OS (clases .toggle-track del globals.css).

**src/utils/**

- `csv.js` — parseo de CSV del lado del cliente + mapeo de columnas por alias. Se usa para importar un listado en el documento actual o adjuntarlo al Secretario.
- `desarrolloPreguntas.js` — preguntas del instalador PoC. Agregar una pregunta = agregar un objeto aca; el formulario se arma solo y las respuestas se guardan en empresa.config. No se toca codigo core.
- `exportar.js` — exportacion del lado del cliente. Dos caminos: - descargarCsv: CSV inmediato desde los datos que YA estan en pantalla (listado, carrito, detalle) sin tocar el backend. - descargarDesdeServidor: baja un archivo generado por el backend (una tool del Secretario o el endpoint /exportacion) usando el JWT.
- `formasPago.js` — costo estimado de una sub-forma de pago (coeficiente del comercio + porcentaje del operador) y su etiqueta legible. Espejo de backend/src/utils/formasPago.helper.js: el mostrador ve lo que absorbe ANTES de cobrar, el backend guarda el mismo numero como snapshot.
- `selectores.js` — busquedas asincronicas para SelectBuscador (maestros grandes). Una sola fuente para todas las pantallas: cada funcion devuelve [{ id, etiqueta, detalle? }] consultando el endpoint con search+limit (nunca se precarga la tabla entera).

<!-- ARBOL:FIN -->

## Reglas del OS

- **Todo modal**: crear/editar nunca navega a otra pagina.
- **Nada borra trabajo**: carrito de venta y borrador de remito persisten en localStorage (`usePersistentWork`).
- **El buscador F7 conserva su estado**: cerrar el modal no borra el texto ni los resultados (volves con F7 y esta igual); se limpia con el boton **Limpiar**.
- **El Secretario es contextual**: al ver un remito/cliente, su JSON se inyecta solo.
- **Estilos en un solo lugar**: `src/styles/globals.css` (colores, tarjetas, modales, panel del
  agente, layout, labels `.field-label` / `.form-grid`, tablas). `app.css` solo ajustes mobile.
- **Layout OS (3 zonas fijas)**: `bookos-app` ocupa `100dvh`; el navbar y el panel del Secretario
  no scrollean. La unica barra de scroll es la del `main` (`.bookos-main`). El chat tiene
  cabecera fija, mensajes con scroll (`.agente-mensajes`) y entrada siempre visible
  (`.agente-input-wrap`). En <=1024px el panel se abre a pantalla completa con el boton flotante.
- **Modal con pie visible**: `Modal.jsx` usa `modal-header` / `modal-body` / `modal-footer`;
  scrollea solo el cuerpo, el titulo y los botones (Guardar/Cancelar) quedan siempre a la vista.
- **debug_mode**: hay dos caminos y alcanza con uno. `VITE_DEBUG_MODE=true` (build) o el toggle
  `debug_mode` del OS en Sistema ▾ Config, que esta CABLEADO: enciende la marca de agua y los
  `<DebugTag />` al instante, sin recompilar. El build es el piso: si la variable esta en true, el
  toggle no lo apaga.
- **Interruptores del OS desde el catalogo**: `ConfigPage` ya no tiene lista propia de toggles:
  renderiza el grupo `sistema` del catalogo del backend (con descripcion y valor efectivo DB >
  default). Una clave nueva del backend aparece sola en la pantalla, y los 7 proveedores de
  sinopsis, el descuento de costo y la bandeja de precios dejaron de ser inalcanzables desde el
  front.
- **Modalidad consigna del mayorista**: si el toggle `usa_consignacion` (Sistema ▾ Config) esta
  apagado, la pantalla Mayorista deshabilita el tipo CONSIGNA con el motivo a la vista y el
  formulario arranca en FIRME. El bloqueo real es del backend, no depende de la UI: lo ya consignado
  se sigue facturando, devolviendo, sabanando y ajustando.
- **El stock no se edita desde el catalogo**: el modal de articulos NO manda campos de stock
  (el backend rechaza el payload si vienen); el stock se ajusta por inventario/transferencia
  (ledger) y en el modal solo se informa el firme actual. `Ver` abre el kardex de movimientos.

## Flujo de prueba PoC

1. Login `admin@bookos.local` / `admin123`.
2. Catalogo: probar "Busqueda semantica" (ej. `ciencia ficcion`).
3. Ventas: buscar EAN, agregar al carrito, elegir comprobante (FACTURA_B/C/PEDIDO/PRESUPUESTO)
   y metodo de pago, cobrar. Reglas bookerp: solo factura descuenta stock; pedido/presupuesto
   exigen cliente; CTA_CTE no aplica a consumidor final. El historial permite **Ver** cada
   documento y **Anular** (restaura stock). En cada detalle: "Preguntar al Secretario".
4. Remitos: cargar items, "Cruzar faltantes". "Ver" abre el detalle del documento e
   inyecta su JSON al Secretario.
5. Secretario: `$autor X`, `$editoriales`, `$faltantes_remito ID`, `$ayuda`, o lenguaje
   natural ("armame un remito con los libros de stock 1", "cruzá el remito 2 y decime que falta").
   Con `DEEPSEEK_API_KEY` el agente decide herramientas por function calling y redacta en streaming.
6. Config: toggles + propuestas del Secretario (aprobar cristaliza un marcador).

## Tramos recientes (E7.9)

- **Buscador de articulos (F1)**: `BuscadorArticuloBlock` busca por titulo, autor, editorial o
  EAN13 en un solo campo (usa `/api/catalogo/f7`) y devuelve renglon listo para el carrito.
- **Paginado (F2)**: `ui/Paginador` (page/limite/total + saltos) aplicado a **Ventas, Compras,
  Remitos, Catalogo, Referencias (autores/materias/editoriales), Clientes, Proveedores, CtaCte,
  Caja, Logs del kernel, Inventario y Newsletter**. Los listados ya no cargan todo de un golpe:
  el backend devuelve `{page, limit, total, totalPages}` y la page pide solo la pagina visible.
- **Menu por flujo (F3)**: navbar agrupada (Operacion, Comercial, Maestros, Kernel) y nueva
  `VentasPeriodoPage` (comprobantes del dia/periodo con totales); el remito es unico (no hay dos
  formas de hacer un remito).
- **Traer comprobante entre modulos (F5)**: `CargarDocumentoBlock` permite cargar renglones de un
  remito/pedido/compra existente en Compras y Remitos (ver seccion del backend).
- **Manual en 6 solapas**: boton **Manual** en la navbar abre `ManualBlock` (Uso clasico, CRM,
  Secretario, Kernel, Flujos con 12 diagramas mermaid renderizados por `MermaidDiagram`, y
  **Herramientas**: el mapa de datos y las 33 herramientas por modulo, generada desde el registro).
- **Logs con detalle**: en la page Logs, **cada fila abre un modal** con los campos del registro
  uno por linea (fecha, modulo, accion, ruta, proveedor, modelo, ms, tokens, outcome, usuario) y
  los textos largos (prompt, salida, herramientas) en bloques `<pre>`.
- **Modal de articulos ajustado (F6.1)**: la edicion **ya persiste** (antes fallaba siempre por
  mandar campos de stock) y se sumaron los campos que el backend ya soportaba sin UI (Autor 2/3,
  Materia/Materia 2 con sugerencias del maestro, Costo) + boton **Ver** con el kardex del articulo.
- **Clientes ajustado al bookerp (F6.2)**: el modal de alta/edicion paso de 2 a **14 campos**
  (fantasia, CUIT, condicion IVA con sugerencias, telefono, email, direccion, localidad, descuento
  fijo %, plazo de pago, mayorista, activo, observaciones) y el boton **Ver** abre la **ficha +
  cuenta corriente** (saldo actual y ultimos 10 movimientos con debe/haber/saldo/vencimiento).
- **Compras "Ver" funciona (F6.3)**: el boton abre el **detalle de la compra** (proveedor, fecha
  de emision, nro, estado, stock afectado, descuento global, renglones con precio/descuento/subtotal
  y total) con **Exportar CSV**, **Anular** (revierte stock) y contexto inyectado al Secretario.
  `comprasApi.obtener(id)` consume `GET /api/compras/:id`.
- **Proveedores ajustado (F6.4)**: modal de 12 campos (razon social, fantasia, codigo interno,
  CUIT, telefono, email, **bonificacion %**, **transporte asignado**, direccion, localidad, activo,
  observaciones) y el boton **Ver** abre la **ficha + cuenta corriente** (saldo con la nota
  "positivo = le debemos" y ultimos 10 movimientos).
- **Alta al vuelo de maestros (F6.5)**: el modal de articulos avisa que los autores/materias
  inexistentes se crean solos al guardar (backend `resolverAutor`/`resolverMateria`/`resolverEditorial`)
  y **completa la editorial por la raiz del ISBN** al salir del campo (como el bookerp).
- **Informe del cierre Z (F6.6)**: el historial de cierres tiene **Ver informe**: KPIs del cierre
  (total ventas, efectivo teorico/declarado, diferencia, tarjetas, transferencias, cheques,
  cantidad de movimientos) + **todos los movimientos del turno** y **Exportar CSV**.
- **Editar medio de pago (F6.6)**: en los movimientos del turno, el boton **Metodo** abre el modal
  para cambiar el medio (EFECTIVO/TARJETA/TRANSFERENCIA/CHEQUE). La regla es la elegida por el
  vectorHumano: **solo movimientos del turno abierto**; un movimiento de un cierre Z ya cerrado
  devuelve error y no se puede tocar.
- **Usuarios (F6.7)**: **Editar** (nombre, rol, activo) y **Reset pass** (nueva contrasena +
  confirmacion, se guarda hasheada). Probado end-to-end con un usuario de prueba: el login con la
  clave nueva dio 200 y el usuario se elimino despues.
- **Ventas (F6.8)**: el badge del historial y el detalle usan `tipoComprobante` (antes mostraba
  `undefined` y el detalle crasheaba por leer `articulos`); el detalle ahora pide `GET /ventas/:id`
  y muestra renglones, cliente y **formas de pago registradas**; los **pendientes** se reconstruyen
  con los items + codigo del articulo; el cobro tiene **Monto recibido** y **Vuelto** calculado.
- **Empresa (F6.10)**: ficha completa — IIBB, inicio de actividades, direccion, localidad,
  provincia, telefono, email de contacto y sitio web (van en `datosFiscales`, sin migracion).
  Logo pendiente de una subida de archivos dedicada.
- **Inventario FIFE (F6.10)**: el modal de ajuste ofrece los **tipos** del bookerp (alta/baja firme,
  alta/baja consigna con su original, firme↔consigna) con la cantidad positiva y el calculo visible
  ("Aplica: firme +2 · consigna −2 · original +0"), mas el modo **personalizado** con deltas a mano.
- **Seña en pedidos (F6.8b)**: en PEDIDO/PRESUPUESTO la suma de pagos puede ser **menor** al total:
  lo cobrado es la seña (entra a caja como "SENA PEDIDO #n") y el modal muestra el **saldo pendiente**;
  la suma nunca puede superar el total.
- **Categorías de caja (F6.9)**: solapa nueva en Parámetros (tabla `parametros` por tipo) y el
  concepto del movimiento manual de caja las sugiere con un datalist. No cambia el esquema de caja.
- **Historial de ajustes de inventario (F6.10b)**: seccion nueva en Inventario con el listado de
  documentos AJUSTE/REVERSO (numero, fecha, articulo, deltas, estado), **Ver** con motivo y stock
  previo, y **Anular (revierte stock)**: aplica los deltas invertidos y deja un documento REVERSO
  con `referenciaId`; el original queda ANULADO (inmutable a partir de ahi).
- **Formato de comprobantes (F4)**: la cabecera de compra tiene **nro de comprobante, fecha de
  emision, vencimiento, descuento global % y observaciones** (los precargados son fecha de hoy y
  FIRME); el detalle permite **descuento por linea %** con subtotal visible por renglon y un pie con
  Subtotal / Descuento / Total en vivo. Ventas y Remitos ya tenian su formato completo
  (cliente/tipo/descuento global y proveedor/nro/fecha/observaciones respectivamente).
- **Chat: ayuda y listados de marcadores (E7.9b)**: el render del envelope suma `ayuda`,
  `editoriales` y `materias` a las claves de lista, muestra `$comando` + su descripcion y corta a
  30 items en la ayuda (8 en los listados). Ventas/Presupuestos ya estaban.
- **Layout de 3 zonas + modales con pie fijo (2026-09-13)**: la ventana no scrollea
  (`.bookos-app` ocupa `100dvh`; el navbar y el panel del Secretario quedan fijos): scrollea solo el
  `main`. El chat tiene cabecera y entrada fijas (solo los mensajes scrollean) y los modales usan
  `modal-header/body/footer`, asi que **Guardar/Cancelar quedan siempre visibles**. Labels
  (`.field-label`), grillas de formulario (`.form-grid`) y el contraste de textos secundarios
  (`--muted` a `#6e6a62`, AA) se centralizaron en `globals.css`; los `th` de tabla quedaron sticky.
- **Propuestas sin cuerpo + clasificacion (2026-09-13)**: el panel de Propuestas marca las que no
  traen cuerpo estructurado (no aprobables) con el motivo visible y el boton **Aprobar**

## Sesion de trabajo, historiales y sub-formas de pago (15-Sep-2026)

- **Sesion de trabajo persistente**: cada page de carga guarda su borrador en disco **por usuario**
  (`hooks/usePersistentWork` usa `bookos_usuario_id`, que deja el login) y la cabecera muestra
  `ui/BorradorRestaurado` ("↺ borrador recuperado" + "↺ limpiar"): Facturar (items + cabecera),
  Caja (movimiento manual), Compras, Remitos, Inventario (busqueda) y los buscadores **F6 y F7**, que
  ahora sobreviven al refresco y al cierre. La clave del borrador se limpia con el gesto ↺.
- **Un solo boton del Secretario**: `ui/BotonSecretario` (icono 💬 + tooltip "Hablar con el
  Secretario") reemplazo el boton suelto en las 15 pages y en las filas de resultado de F6/F7.
- **Historiales en modal**: el historial anulable de Facturar y, dentro de Caja, "Ventas del
  dia/periodo" y "Turnos cerrados (Z)" - que vivian al pie de la page - ahora son modales. En la
  navbar "Ventas del dia/periodo" quedo despues de Caja (es su lugar natural).
- **Ajustes de precio con seguimiento**: el cobro (F10) tiene el campo **nota de la venta** y el
  renglon que sale con descuento o cambio de precio queda asentado por el motor en la misma nota
  estructurada; el detalle del comprobante muestra la nota y el seguimiento, y la tabla de formas de
  pago suma **Sub-forma** y **Costo est.**.
- **Sub-formas de pago en la UI**: `ParametrosPage` suma las solapas **Operadores / pasarelas** (%
  estimado de costo) y **Sub-formas de pago** (metodo madre, operador, subtipo DEBITO/CREDITO/QR/PROMO,
  cuotas y coeficiente "1.10"); en el cobro y en el recibo de cuenta corriente cada linea de pago
  puede llevar su sub-forma y la pantalla muestra el **costo estimado** que absorbe el comercio
  (`utils/formasPago.js`, espejo de la formula del backend para verlo antes de confirmar).
- **Multi-pago**: el "+" agrega una linea con **lo que falta** para cancelar el total, y cambiar el
  metodo de una linea borra su sub-forma (cada sub-forma pertenece a un metodo madre).
- **Numero de cheque y de transaccion (15-Sep)**: en el cobro (F10) cada linea pide el **nro de
  cheque** cuando el metodo es CHEQUE (obligatorio) y el **nro de transaccion** cuando es TARJETA
  (opcional, del ticket); el recibo de cuenta corriente hace lo mismo y el detalle de la venta suma
  la columna **Nro**. Una venta de un solo pago con cheque ahora manda su desglose (antes el numero
  se perdia si no habia sub-forma).
- **Campanas (15-Sep)**: el **historial paso a modal** (como los otros historiales) y el segmento
  **Por clientes puntuales** ya no se tipea con ids: se eligen con el **buscador de clientes** y
  quedan como fichas con ✕. El formulario de campana nueva (con el segmento elegido) persiste como
  borrador.
- **Liquidacion de consigna por corte (15-Sep)**: el modal de liquidacion trae el **corte automatico**
  (diferencia de stock o ventas del periodo, con desde/hasta), un boton **Traer corte** que previsualiza
  el corte del motor y avisa antes de reemplazar lo ya cargado, y un **buscador de articulos** para
  armar los renglones a mano. El modo y el rango quedan registrados en la liquidacion.
- **Borradores persistentes (15-Sep)**: ademas de Facturar, Caja, Compras, Remitos, Inventario,
  Consigna (4) y Mayorista (6), ahora persisten el **alta rapida de cliente** (F2) -que ademas ya no
  se borra al cerrar el modal- y el formulario de **Transportes/depositos**.

## La tarjeta del chat y el texto de los canales sin tarjeta (15-Sep-2026)

- **Desglose por tipo en la tarjeta**: cuando el resultado trae sus numeros abiertos (por ejemplo
  `$resumen_ventas` con comprobantes por tipo), `blocks/ChatAgente` los muestra como una **sub-lista
  debajo de la lista principal** (`SubListas`), con la etiqueta de la clave en palabras
  (`etiquetaClave`: `porTipo` → "Por tipo"). Los items traen su **tipo** (`FACTURA_B`, `NC_X`), que es
  lo que da sentido al renglon; antes la etiqueta salia como `#?`.
- **El mismo dato en los canales sin tarjeta**: Telegram, la agenda y el mail no tienen tarjeta y
  reciben **texto**: desde el 15-Sep lo arma `envelopeTexto.service` en el backend (`CLAVES_LISTA` es
  el contrato compartido con esta pantalla). Si un dato solo viviera en la tarjeta, esos canales
  mostrarian una respuesta vacia; el instrumento `scripts/verificar-texto-canales.js` (backend) lo
  mide de punta a punta, incluido el desglose por tipo.
- **Chat: id de conversacion muerto (15-Sep)**: el interceptor de `axiosClient` **conserva el status**
  del error (antes solo sobrevivia el texto) y el hook descarta el id guardado cuando el backend
  responde 404, en vez de reintentar y fallar en silencio en cada carga.
  deshabilitado; el detalle vacio ya no muestra un `null`. El agente suma `materias_proponer`
  (propone materia para titulos sin materia por vecinos semanticos, exportable a CSV) y
  `materias_asignar` (asignacion en lote con preview y confirmacion).
- **CRM + Asistente de ventas (doc 06, E-BR1)**: menu nuevo **CRM** (Asistente, Pedidos, Radar,
  Propuestas, Campañas, Config CRM) y el chat del agente quedo **extraido a `blocks/ChatAgente.jsx`**
  (reutilizable por perfil): el panel lateral del Secretario y la pagina **Asistente de ventas**
  comparten el mismo componente (mismo motor, misma conversacion persistente; cambia el perfil
  `secretario`/`ventas` y el texto de arranque, con las tarjetas de candidatos y "Agregar a la
  venta" iguales). Las paginas Pedidos/Radar/Propuestas/Campañas/Config CRM indican su etapa del
  plan (`E-BR2`, `E-BR4`, `E-BR1 parte 2`). La vista del kernel paso a llamarse **Propuestas
  Kernel** para no chocar con la del CRM.
- **Config CRM (E-BR1 parte 2)**: la pagina muestra el estado de los dos canales con badge
  **configurado / sin configurar** (el mailer toma la config del servidor cuando no hay nada
  guardado en la base), formularios de mail (host, puerto, usuario, password, remitente) y Telegram
  (token, chat id) con **Guardar** y **Enviar prueba** (el de mail admite destinatario; la clave
  guardada no se devuelve nunca y dejarla vacia no la pisa), y los **interruptores del CRM**:
  `NOTIFICACIONES_ENABLED`, `RADAR_ENABLED`, `TELEGRAM_ENABLED`, `ENVIO_PROVEEDOR_ENABLED`.- **Agente en el Kernel (2026-09-13)**: los toggles del agente salen de Config del CRM (que ahora
  edita solo lo suyo, por el `grupo: 'crm'` del catalogo) y viven en **Kernel ▾ → Agente**: estado
  del LLM (activo/modelos/presupuesto), **prompt completo o hibrido**, cuantas herramientas van con
  manual completo, pasos del loop, techo de contexto y presupuesto diario, mas el **inventario de
  herramientas** (mas usadas por uso real, sin uso — candidatas a poda — y boton Recalibrar ahora).
  El agente es uno solo: la pagina lo dice y unifica Secretario + Asistente de ventas.- **Chat sin descartes silenciosos (2026-09-13)**: si el turno anterior sigue en curso, el mensaje
  NO se pierde: el chat avisa ("todavia estoy resolviendo el pedido anterior") y el texto queda en
  el cuadro para reenviarlo; si el backend termina un turno sin texto, se muestra un aviso util en
  lugar de quedar mudo (antes caia en el generico "no obtuve resultados").- **Pedidos y Radar reales (E-BR2)**: `PedidosPage` (alta en modal —cliente, codigo del catalogo o
titulo libre, cantidad, observaciones—, filtro por estado con contadores, busqueda, paginado,
cambio de estado por fila y Exportar CSV) y `RadarPage` (estados del ciclo, grupos que se
despacharian por proveedor con umbral y email de la ficha, y las corridas: Verificar ingresos,
Notificar ingresos, Notificar agotados, Despachar con mail de control). Ambas son paginas reales
(doc 06 E-BR2) en vez del placeholder de etapa.- **Ciclo y resumen en el Radar (E-BR3)**: el Radar suma **▶️ Correr ciclo completo** (lo mismo que
  corre solo los lunes 9:00: radar → avisos → despacho) y **📨 Resumen diario a control**, con el
  resumen de lo que hizo cada corrida en pantalla.
- **Feedback del trato en el chat (ruta empatica, E3)**: bajo la respuesta del Secretario y del
  Asistente de ventas aparece el voto del turno — 👍/👎 y la escala 1–5, que se combinan (el
  operario manda sobre cualquier inferencia: plan 11, D13). Se vota una vez y queda "✓ Gracias,
  quedó registrado"; si el POST falla se avisa sin romper la conversación. Lo dibuja `VotoTurno` en
  `ChatAgente.jsx`; el `evaluacionId` llega en el evento `resultado` del SSE y lo propaga
  `useAgenteStream`; el POST vive en `agenteApi.feedback` (`api/api.js`).
- **"Ver perfiles" en el Kernel (ruta empatica, E7)**: `PerfilesPage` (`Kernel ▾ → Perfiles`) muestra
  **un perfil de usuario por fila** con su información empática reunida para análisis rápido — cómo
  viene el trato (score contra su target y tendencia), consentimiento y pausa, cuántos intercambios
  evaluados, señales, ánimo, votos y el **aprendizaje que hoy entra al prompt** — y al abrir la fila
  el detalle: las últimas evaluaciones con la **razón del score**, la historia de lo que contó el
  operario, y las acciones de privacidad (pausar, revocar, **exportar JSON y CSV**, dar de baja).
  Arriba hay **Correr retención** (admin): reemplaza la prosa vieja por un resumen del LLM sin borrar
  filas. El score es información **interna**: vive acá, no en la conversación con el operario.
- **Núcleo ordenado en el Kernel (2026-09-15)**: el ajuste del modelo local estaba **duplicado**
  (`LLM_CHICO_ENABLED`, `LLM_CHICO_TOOLS_ENABLED`, `..._PASOS` y `..._MAX_CHARS` se dibujaban en
  Sistema ▾ Config *y* en Kernel ▾ Agente, porque `AgentePage` pintaba el grupo `agente` entero).
  Ahora hay **un solo hogar** para cada cosa: **Kernel ▾ Modelo local** (nuevo: `ModeloLocalPage`) =
  panel del modelo chico + **workers locales** (el del 3011 y el de embeddings del 3010, que antes
  solo se tocaban desde Config); **Kernel ▾ Banco de pruebas** (nuevo: `BancoPruebasPage`) = la serie
  del **ranking** (movida de Pesos) + la serie del **modelo chico**, que mide qué herramienta elige
  el modelo local sobre las mismas consultas (endpoint `POST /kernel/chico/banco`; la corrida tarda
  ~12 s por consulta y por eso esa llamada sola sube su timeout a 15 min). `AgentePage` dejó de
  pintar las claves `LLM_CHICO_*`, `ConfigPage` perdió el panel del chico y los workers, y
  `PesosPage` perdió el banco (ahora explica dónde se mide). Ninguno de los dos bancos activa nada:
  el del ranking deja propuesta, el del chico deja reporte en `logs/chico-banco-<fecha>.json`.
- **Toggles que no mienten (16-Sep-2026)**: un interruptor que ningún código lee ya **no se dibuja con
  interruptor**. El catálogo del backend marca esas claves con `cableada: false` y Sistema ▾ Config
  las muestra con la marca "sin cablear" y su motivo, en vez de ofrecer un control que no hace nada
  (peor que no tenerlo: el operario no puede distinguirlo de uno que sí obra). Son hoy
  `LEGACY_FALLBACK_ENABLED`, `STOCK_STALE_MS`, `STOCK_SYNC_ENABLED` y `usa_deposito`. En el mismo
  criterio, `LLM_ENABLED` (el encendido del LLM pago) **se mudó a Kernel ▾ Agente**: es del motor del
  agente, no del OS, y al lado viven sus topes (`LLM_SIN_TOPE`, `AGENTE_LLM_MAX_DIA`). Y las
  descripciones dejaron de prometer lo que no se sostiene: el panel del chico ya no dice
  "~1,7-2,4 GB de RAM" (medido: 1,5 GB al cargar y un RSS de proceso que crece hasta ~5,4 GB y no
  baja al liberar el modelo) ni nombra un modelo fijo, que lo declara `LLM_CHICO_MODELO`.
- **La copia del chat ya no inventa texto (16-Sep-2026)**: cada turno empujaba al estado un mensaje con
  el payload del evento `resultado`, que en pantalla era una **burbuja vacía** (sin tarjeta, sin
  marcador, sin sugerencias) y que al copiar salía como `Turno sin texto (ruta X)` — una línea que el
  vectorHumano **nunca leyó en el chat** (lo confirmó: "no vi escrito eso, salió al pegar"). Ahora el
  evento solo se agrega si trae algo visible, y `textoParaCopiar` devuelve vacío para un cierre sin
  nada que mostrar: **la copia es lo que el operario vio**, no el cierre interno del turno. Queda sin
  explicar por qué esa línea imprimía `ruta llm` cuando la base registra `llm_chico`; con el fix la
  línea deja de existir.
## Build para el VPS (18-Sep-2026)

El frontend del VPS se sirve en `http://tecnozenit.elmalteslibros.com.ar/tecnozenit/bookos/` y se
compila **en el VPS** (`npm ci && npm run build`): el `dist/` queda justo donde apunta el `Alias` del
vhost (`.../tecnozenit/bookos/frontend/dist`, asi que no hay que copiar nada).

**`VITE_API_URL` tiene que ser `/tecnozenit/bookos/api`**, no el `/api` del repo: el `ProxyPass` de
BookOS vive en esa subcarpeta, y `/tecnozenit/api/` (el otro del vhost) apunta a la app vieja en
`localhost:3001`. El `.env` del VPS lo declara; el resto del build es igual que en desarrollo.

Verificado abriendo la URL publica: el login entra, el catalogo lista articulos reales de la base del
VPS y las acciones (Ver/Editar/Baja) se dibujan â€” se conto lo que el navegador RENDERIZA, no lo que
devuelve la API.
