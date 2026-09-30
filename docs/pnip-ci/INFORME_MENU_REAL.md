# Menú y layout reales de la app — exploración

Fecha: 30/09/2026. Solo lectura: en este paso no se modificó ningún archivo.

Rama `feature/pnip-ci`. Los archivos del host revisados (`sidebar-menu/`,
`admin/`, `header/`, `app.component.*`) no cambian desde el commit base
`085f47d`, salvo la conexión mínima de `app.component.ts` del Día 1.

## Resumen

1. **El menú de íconos no es un menú de rutas.** Sus 3 íconos no navegan:
   emiten eventos que maneja `AdminComponent`, que cambia su propio estado
   interno sin cambiar de URL. Dos de las tres opciones (llenar el
   formulario y ver la lista) son **la misma ruta, `/admin`**, mostrando
   una u otra vista. La tercera descarga un PDF.
2. **El menú no forma parte del layout general.** Solo lo pinta
   `AdminComponent`, dentro de su propia plantilla. `AppComponent` dibuja la
   cabecera, un `<router-outlet>` y el pie, pero ningún menú. En `/`,
   `/mis-formularios` y `/pnip/**` no hay menú.

Esto cambia cómo se puede «ampliar el menú real» sin tocar las pantallas de
Formularios: ver «Decisiones necesarias» al final.

## 1. ¿Dónde vive el menú y cómo recibe sus ítems?

- **Componente:** `src/app/sidebar-menu/sidebar-menu.component.{ts,html,scss}`,
  selector `app-sidebar-menu`, **standalone**.
- **Ítems hardcodeados en la plantilla:** 3 `<button>`, cada uno con su SVG
  en línea y su texto. No recibe un array ni una configuración.
- **Inputs:**
  - `activeSection: 'form' | 'list'`: qué botón se ve activo.
  - `canViewList: boolean`: muestra u oculta el tercer botón.
- **Outputs:** `formClicked`, `excuseClicked`, `listClicked`.
- **Comportamiento:**
  - Colapsado (64 px, solo íconos con el rótulo «MENÚ»).
  - Al pasar el ratón se despliega a 210 px **por encima** del contenido
    (`position: absolute`), sin empujarlo.
  - En móvil (≤ 768 px) va en el flujo y se abre con un botón «Mostrar
    menú», que pinta `AdminComponent`.
- **Estilo:**
  - Tarjeta blanca con borde `#d3dae4`, radio de 10 px y sombra.
  - Íconos de 15 px dentro de una caja con contorno de 26 px.
  - Texto de 13 px `#22314f`; hover `#eaf2fa`.
  - Activo en `#1a5490`, seminegrita.
  - Tipografía heredada: la del sistema, la misma del host.
  - Tokens `--ci-*` declarados en su propio `:host`.

## 2. ¿A qué apunta cada uno de los 3 íconos?

Verificado en `sidebar-menu.component.html` y en `admin.component.ts/html`.

| Ícono (texto al desplegar) | Evento | Qué hace `AdminComponent` | URL |
|---|---|---|---|
| «Formulario de conflicto de interés» | `formClicked` | `toggleView('form')`: muestra `<app-conflict-form>` **incrustado dentro de `/admin`** | se queda en `/admin` |
| «Formulario de excusa» | `excuseClicked` | `downloadExcusePdf()`: descarga `/sisci/assets/FORMULARIO_DE_EXCUSAS_EV_EEASA.pdf` con un `<a download>` temporal | no navega |
| «Ver Formularios» (solo si `canViewList`) | `listClicked` | `toggleView('list')`: muestra la lista, con sus pestañas «Formularios recibidos» / «No han llenado formulario», y recarga datos | se queda en `/admin` |

Además:
- `AdminComponent` abre por defecto la **lista** para A/R y el **formulario**
  para el resto.
- Solo reconoce dos parámetros de URL: `?abrirCodigo=1` y `?abrirRoles=1`
  (los usa la cabecera). **No hay forma de abrir la vista «formulario»
  desde fuera** con una URL.
- El formulario también existe como ruta propia, `''` (`/`, con
  `ConflictFormComponent`), pero `authGuard` redirige ahí a los A/R hacia
  `/admin`.

## 3. ¿Soporta grupos o subítems?

**No.** No hay grupos desplegables ni chevrons en el menú, ni en ninguna otra
parte de la app. Los precedentes más cercanos:

- Las dos pestañas-botón de la lista («Formularios recibidos» / «No han
  llenado formulario», clase `.switch-btn`): son sub-vistas de una sección,
  pero como pestañas, no como submenú.
- El despliegue del propio menú al pasar el ratón.

Un grupo nuevo tendría que ser un diseño nuevo, construido con el mismo
estilo: misma tarjeta, mismos tokens `--ci-*`, misma caja de ícono y un
chevron con el mismo trazo de los SVG que ya usa.

## 4. ¿Dónde vive el layout y cómo reparte el espacio?

- **`AppComponent`** (`app.component.html`): `.app-container` (flex en
  columna, `min-height: 100vh`) con `<app-header>`, `<main class="app-main">`
  (`flex: 1`) con el `<router-outlet>`, y `<app-footer>`. Cabecera y pie se
  ocultan solo en `/login`.
  - `HeaderComponent` es `sticky` (`top: 0`, `z-index: 100`) y mide unos
    64 px.
  - El pie va al final del flujo.
- **El menú no está aquí.** Lo coloca `AdminComponent` en su propio
  `.admin-layout`:
  - `display: flex`;
  - `<app-sidebar-menu>` fijo con `position: sticky`,
    `top: var(--ci-cabecera)` (64 px) y un ancho de 80 px;
  - `.admin-content` (`flex: 1`), donde van el formulario o la lista.
- Cada pantalla decide su propio ancho: el formulario usa `max-width:
  1180px` y la lista, 1200 px, centrados.

## 5. Íconos de la cabecera: ¿hay campana o historial reutilizable?

Los 5 íconos de `header.component.html`, de izquierda a derecha:

| Ícono | Título | Cuándo se ve | Qué hace |
|---|---|---|---|
| Candado con documento | «Generar código de acceso» | solo en `/admin` | abre en `/admin` el modal de clave temporal para externos (`?abrirCodigo=1`) |
| Persona | «Gestionar Jefes de RRHH» | solo en `/admin` y con rol `A` | abre el modal de roles (`?abrirRoles=1`) |
| Reloj con flecha | «Mis declaraciones» | siempre | navega a `/mis-formularios`: historial de las declaraciones **del propio usuario** |
| Sol / luna | (sin título) | siempre | modo oscuro (clase `body.dark-mode`) |
| Salir | «Cerrar sesión» | siempre | `logout()` y redirige a la intranet |

- **No hay campana ni ningún mecanismo de avisos.**
- El reloj es un historial **personal** de declaraciones, no un historial
  general de eventos. Se podría reutilizar su estilo de botón
  (`.header-icon-btn`), pero no su función.
- Si más adelante se quiere una campana del módulo en la cabecera, habría
  que añadirla a `HeaderComponent`, que es del host.

## 6. ¿El menú distingue por rol?

- **Solo un ítem:** «Ver Formularios» se oculta si `canViewList` es falso.
  `AdminComponent` lo calcula con `hasRole('A') || hasRole('R')`.
- **En la práctica, solo A/R ven el menú.** Vive en `/admin`, y `authGuard`
  solo deja entrar a `/admin` a A/R.
- Un empleado o un externo **nunca ve ningún menú**. Entra a `/`, que es el
  formulario a pantalla completa.

## 7. ¿Menú y layout están fuera de `pnip-ci`?

Sí:
- el menú, en `src/app/sidebar-menu/`;
- el contenedor que lo coloca, en `src/app/admin/`;
- el layout general, en `src/app/app.component.*`.

Todo existía antes del módulo; está en el commit base.

## Decisiones necesarias antes de seguir (Pasos 1–2)

El plan asumía que el menú vive en el layout general y que sus 3 íconos
son rutas. Ninguna de las dos cosas se cumple, y eso choca con «no tocar las
pantallas de Formularios»:

- **A. Dónde se pinta el menú en `/pnip/**`.** Hoy no aparece ahí. Opciones:
  1. `AppComponent` lo pinta para las rutas `/pnip` (unas líneas más en
     `app.component.html/.scss`, como la excepción que ya se hizo el Día
     1). `/admin` sigue pintando el suyo como hasta ahora.
  2. Una ruta contenedora mínima en `pnip-ci` que pinte el
     `<app-sidebar-menu>` del host junto al `<router-outlet>`. No toca el
     host, pero es un «mini-shell» nuestro.
- **B. «Llenar formulario de conflicto» desde `/pnip/**`.** Esa vista solo
  existe como estado interno de `AdminComponent`. Opciones:
  1. Un cambio aditivo mínimo en `AdminComponent`: leer un
     `?vista=formulario`, igual que ya lee `?abrirCodigo`.
  2. No tocar `AdminComponent`: desde `/pnip` ese ítem lleva a `/admin`
     (que para A/R abre la lista) y hay que volver a pulsarlo.
- **En ambos casos**, ampliar el menú exige modificar `SidebarMenuComponent`
  (añadir ítems, grupos y roles). Las 3 salidas actuales se conservan tal
  cual, así que `AdminComponent` sigue funcionando sin cambios dentro de
  `/admin`.

**Decidido por Elvis (30/09/2026):** A.1, que el menú lo pinte `AppComponent`
en `/pnip/**`, y B.1, que `AdminComponent` lea `?vista=formulario`. Cómo
quedó: ver «Integración en el layout y menú reales» en `INFORME_PROYECTO.md`.
