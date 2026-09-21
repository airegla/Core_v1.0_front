# BookOS — Frontend

Interfaz web de **BookOS**, el sistema operativo de la librería **El Maltés**: la operación diaria
(ventas, compras, stock, caja, cuentas corrientes) más un **secretario agéntico** integrado que
resuelve pedidos en lenguaje natural sobre los datos reales del negocio.

> 📖 **Documentación técnica completa: [README-FRONTEND.md](./README-FRONTEND.md)**
> El backend (Express + Prisma + MariaDB) vive en su repositorio aparte.

---

## Lo que incluye

| Área | Pantallas |
| --- | --- |
| **Ventas** | Facturar (POS con carrito persistente y señas), Ventas del día/período, Caja (movimientos, cierre Z con informe del turno), Clientes, Cuenta corriente cliente, Newsletter |
| **Compras** | Compras (nro de comprobante, vencimientos, descuentos por línea y global), Remitos con cruce de faltantes, Proveedores, Cuenta corriente proveedor, Consigna y liquidaciones |
| **Stock** | Inventario (ajustes FIFE con historial y anulación), Transportes y depósitos, Mayorista |
| **Catálogo** | Catálogo enriquecido (CRUD + kardex), Referencias (autores, materias, editoriales) |
| **Kernel** | Salud, Propuestas (aprobar/rechazar las del agente), Pesos del ranking, Logs, Cola de enriquecimiento, Memoria |
| **Sistema** | Config, Empresa, Usuarios, Parámetros, Desarrollo |

Todas las vistas comparten el mismo layout de tres zonas: navegación superior, panel de trabajo con
scroll propio y **el Secretario siempre visible a la derecha** (a pantalla completa en mobile).

## El Secretario

Chat lateral persistente conectado por **SSE** al agente del backend:

- entiende **lenguaje natural** ("armame un remito con los libros de stock 1") y **marcadores `$`**
  (`$ayuda`, `$precio`, `$sinopsis`, `$composicion_materias`, ...);
- muestra cada herramienta que ejecuta, los listados que devuelve y las **descargas CSV** que produce;
- las escrituras destructivas piden **preview + confirmación explícita** del operario;
- los **hilos se guardan** (panel de conversaciones para retomar) y el contexto de la pantalla actual
  (remito, cliente, compra) se inyecta solo;
- acepta **adjuntos CSV** para analizar/importar y permite exportar la conversación.

## Stack

- **React 19** + **Vite 5** (ES Modules) · **Tailwind CSS 3** + variables CSS propias
- **Sin router**: la navegación es estado de React (`App.jsx`), con navbar agrupada por flujo
- **SSE** para el streaming del chat y cliente HTTP propio (`src/api/`) con JWT y envelope
- Identidad visual en un solo lugar: `src/styles/globals.css` (`app.css` solo ajustes mobile)
- `VITE_DEBUG_MODE=true` (build) o el toggle `debug_mode` del OS (Sistema ▾ Config, en caliente) activan la marca de agua y los `<DebugTag />` por componente

## Arranque en desarrollo

Requisitos: Node 18+ y el backend corriendo en `http://localhost:3002`.

```bash
npm install
npm run dev     # http://localhost:5174 (proxy /api -> backend 3002)
npm run build   # genera dist/
```

## Estructura

```
src/
  App.jsx            shell: login + navbar + layout de 3 zonas (contenido / Secretario)
  AppContext.jsx     contexto de pantalla que se inyecta al agente
  api/               axiosClient (JWT + envelope) y modulos por dominio
  blocks/            AgenteChatBlock · ManualBlock · CargarDocumentoBlock · BuscadorArticuloBlock
  pages/             27 paginas: catalogo, operacion (ventas/compras/stock/caja), kernel y sistema
  ui/                Modal, Tabla, Paginador, Toggle, Input, DebugTag, Navbar, MermaidDiagram
  hooks/             useAgenteStream (SSE) · usePersistentWork (borradores)
  styles/            globals.css (identidad visual) · app.css (ajustes mobile)
```

## Convenciones del OS

- **Los modales no navegan**: crear/editar siempre en modal (`ui/Modal`), con cabecera y pie fijos y
  scroll solo en el cuerpo.
- **Nada borra trabajo**: el carrito de venta y los borradores de compra/remito persisten en
  `localStorage`; cambiar de pantalla no pierde nada.
- **El stock no se edita**: se ajusta por inventario o transferencias (ledger) y se consulta en el
  kardex; el modal de artículos solo informa el firme actual.
- **El kernel propone, el humano aprueba**: las propuestas del agente (marcadores, informes, pesos)
  se aprueban o rechazan desde los paneles, y recién ahí quedan activas.
