# Arquitectura de SISCI (Sistema de Conflicto de Intereses)

Aplicación web de EEASA (Angular 19, componentes standalone) para el
procedimiento de **conflictos de interés** (código PNIP.CI): los empleados
declaran sus posibles conflictos y Recursos Humanos los gestiona hasta
cerrarlos.

Lo que debe hacer cada pantalla de la gestión de conflictos está en la
[especificación del front](Especificacion_Front_PNIP-CI.md). Sus rutas
sugeridas (sección 5) son anteriores a la integración: las vigentes son
`/rrhh/**` y `/responsable/**` (ver `app.paths.ts`).

## Las dos partes de la app

| Parte | Qué hace | Rutas | Datos |
|---|---|---|---|
| **Declaración** | Login, formulario de declaración, «Mis declaraciones», administración de formularios recibidos, gestión de roles y claves temporales para externos. | `/login`, `/`, `/mis-formularios`, `/admin` | **Reales**: backend `wssisci` (vía `BackendService` y `AuthService`). |
| **Gestión de conflictos** | Lo que RRHH hace con las declaraciones: análisis de conflictos, consulta previa, planes de acción, revisión de evidencias, informe general e historial. Y la bandeja de cada responsable de actividades. | `/rrhh/**`, `/responsable/**` | **Reales** con sesión real (servicios de `services/http/`, backend `wssisci`); **simulados** (mock) con la sesión simulada de desarrollo. Ver «Fuente de datos». |

Las dos comparten el mismo layout (cabecera, pie y menú lateral), la misma
sesión (`AuthService`) y los mismos roles.

## Roles

Los roles vienen del backend en la sesión del usuario y se consultan
siempre con `AuthService.hasRole(abreviatura)`.

| Rol | Quién | Declaración | Gestión de conflictos |
|---|---|---|---|
| `A` | Administrador | `/admin`: formularios recibidos y gestión de roles (ícono de persona de la cabecera, modal «Gestión de Roles») | Todo lo de RRHH (`/rrhh/**`) |
| `R` | Jefe de RRHH | `/admin`: formularios recibidos | Todo lo de RRHH (`/rrhh/**`) |
| `P` | Responsable: el backend se lo asigna a quien recibe actividades en un plan de acción | Llena su declaración en `/` y ve «Mis declaraciones» | Su bandeja de actividades (`/responsable/**`) |
| `E` | Usuario externo (entra con cédula y clave temporal) | Llena su declaración en `/` | Ninguna |
| Sin `A`/`R`/`P` | Cualquier otro empleado | Llena su declaración en `/` y ve «Mis declaraciones» | Ninguna |

Un usuario puede tener **más de un rol** a la vez (por ejemplo `R` y `P`):
entonces ve todo lo de cada uno. Dentro de la gestión de conflictos, `A` y
`R` se tratan igual (`RolGestion` `'rrhh'`) y `P` es `'responsable'`
(ver `PerfilUsuarioService`). Cuando hace falta mostrar un solo rol, se
muestra el de mayor nivel: `A` > `R` > `P`.

**Pendiente con backend:** quién asigna el rol `P` y si el modal «Gestión
de Roles» debe permitir asignarlo. Hoy ese modal solo gestiona
administradores y jefes de RRHH; no se le agregó una sección para `P`.

## Cabecera según el rol

La cabecera (`HeaderComponent`) muestra siempre el nombre del usuario
logueado y su rol en texto (el de mayor nivel: A > R > P). Además:

| Ícono | Quién lo ve | Dónde |
|---|---|---|
| Generar código de acceso | `A` y `R` | `/admin`, `/rrhh/**` y `/responsable/**` |
| Gestionar Jefes de RRHH (modal «Gestión de Roles») | Solo `A` | `/admin`, `/rrhh/**` y `/responsable/**` |
| Campana de notificaciones (`shared/notification-bell`, datos simulados) | `A`, `R` y `P` | En toda la app |
| Mis actividades de conflicto de interés (→ `/responsable/dashboard`) | Quien tiene `P` | En toda la app |
| Mis declaraciones, modo oscuro, cerrar sesión | Todos | En toda la app |

El Responsable (`P` sin `A`/`R`) entra por defecto al formulario de
declaración, que no tiene menú lateral: por eso tiene su propio ícono.

## Cómo se controla el acceso

- **Declaración**: `authGuard` en cada ruta, más la comprobación de
  `AppComponent` contra `RUTAS_PERMITIDAS` (`app.routes.ts`), que manda a
  `A`/`R` a `/admin` y al resto a `/`.
- **Gestión de conflictos**: `rolGuard` (`guards/rol.guard.ts`), una vez por
  grupo:
  - `/rrhh/**` exige `A` o `R`.
  - `/responsable/**` exige `P`.
  - Si no cumple, envía a la pantalla de inicio del usuario
    (`PerfilUsuarioService.obtenerRutaInicio()`): con `A`/`R`,
    `/rrhh/dashboard`; solo con `P`, `/responsable/dashboard`; sin
    ninguno, `/`.
  - Sin sesión, los dos envían a `/login`.

## Carpetas

```
docs/
├── ARQUITECTURA.md        este documento
├── Especificacion_Front_PNIP-CI.md  qué debe hacer cada pantalla
├── CONVENCIONES.md        reglas de código del proyecto
├── DESARROLLO_LOCAL.md    correr la app sin intranet (sesión simulada)
└── bitacora/              historial de decisiones (no se actualiza)

src/
├── environments/          URLs del backend; production true/false
├── styles.scss            estilos globales de la app
├── styles/                diseño de las pantallas de gestión de
│                          conflictos (NO globales, ver CONVENCIONES.md)
└── app/
    ├── app.routes.ts      TODAS las rutas
    ├── app.paths.ts       paths de /rrhh y /responsable (única fuente)
    ├── app.config.ts      providers e inicialización de la sesión
    ├── app.component.*    layout: cabecera, pie, menú y <router-outlet>
    │
    ├── header/ footer/    cabecera y pie
    ├── sidebar-menu/      menú lateral único de la app
    │   ├── menu-items.ts  opciones según el rol
    │   └── item-menu.ts   tipo ItemMenu y cálculo del ítem activo
    │
    ├── login/                  ─┐
    ├── conflict-form/           │ pantallas y modales
    ├── mis-formularios/         │ de la declaración
    ├── admin/                   │
    ├── assign-users-modal/      │
    ├── generate-code-modal/     │
    ├── manage-rrhh-modal/      ─┘
    │
    ├── rrhh-dashboard/         ─┐
    ├── analisis-conflicto/      │
    ├── consulta-previa/         │ pantallas de RRHH
    ├── plan-accion-detalle/     │ (/rrhh/**)
    ├── informe-general/         │
    ├── revision-evidencias/     │
    ├── historial/              ─┘
    ├── responsable-dashboard/  ─┐ pantallas del responsable
    ├── mis-planes/              │ (/responsable/**)
    ├── plan-responsable-detalle/┘
    │
    ├── shared/            componentes reutilizables (app-badge,
    │                      app-data-table, app-modal, app-document-viewer...)
    ├── testing/           solo para specs: dobles de prueba
    │                      (PerfilUsuarioFalso); no entra en el build
    ├── pipes/             pipes standalone
    ├── utils/             funciones puras (fechas, planes, tonos...)
    ├── models/            interfaces y tipos (barrel: models/index.ts)
    ├── guards/            authGuard y rolGuard
    ├── dev/               solo desarrollo: selector de rol de la sesión
    │                      simulada ([PNIP-CI DEV], se elimina antes de
    │                      producción)
    ├── interceptors/      token en cada petición HTTP
    ├── models/api/        lo que llega y se envía al backend de conflictos
    │                      (MAYÚSCULAS, tal cual la API)
    └── services/
        ├── auth.service.ts, backend.service.ts...   reales (host)
        ├── perfil-usuario.service.ts   rol de gestión y empleado actual
        ├── *-mock.service.ts           datos simulados (sesión simulada)
        ├── mock-data/                  los datos de ejemplo
        └── http/                       versión real de cada mock
            ├── *-http.service.ts       mismos métodos públicos que su mock
            ├── mapeos/                 API → modelo, funciones puras
            ├── peticiones.ts           URL base, sobre, páginas, errores
            └── fuente-datos.ts         decide mock o backend
```

## Qué es real y qué es simulado

| Siempre real (backend `wssisci`) | Real con sesión real, simulado con la sesión simulada |
|---|---|
| Login, tokens, roles del usuario (`AuthService`) | Análisis, conflictos, planes, actividades, evidencias, revisión, historial, notificaciones, consulta previa y búsqueda de personal de la gestión de conflictos |
| Guardar y consultar declaraciones, formularios recibidos, roles, claves temporales, personal sin formulario (`BackendService`) | El empleado actual (`SISCI-DEV-EMPLEADO` solo con la sesión simulada; con sesión real, `DMPER_CODIGO`) |

El PDF de la declaración (`ConflictoPdfService`) no usa backend: se arma en
el navegador con los datos reales del formulario.

La integración la hizo Sebas Constante (commit `38b38ae`, 26/10/2026). Guía
completa: [INTEGRACION_BACKEND.md](INTEGRACION_BACKEND.md); análisis:
[bitacora/ANALISIS_GUIA_BACKEND.md](bitacora/ANALISIS_GUIA_BACKEND.md).

### Capa `services/http/`

- **Un servicio HTTP por mock** (`AnalisisHttpService`,
  `ConflictosHttpService`, `PlanesHttpService`, `HistorialHttpService`,
  `NotificacionesHttpService`, `ConsultaPreviaHttpService`,
  `PersonasHttpService`), con **los mismos métodos públicos**. Las
  pantallas siguen inyectando el `*MockService`: no saben de dónde vienen
  los datos.
- **`models/api/`**: interfaces de lo que llega del backend (campos en
  MAYÚSCULAS dentro de `{ estado, mensaje, datos }`, listados en `PaginaApi`)
  y de lo que se envía (camelCase).
- **`mapeos/`**: funciones puras API → modelo del front (camelCase), con su
  `.spec.ts`. Los ids numéricos del backend pasan a `string`.
- **`peticiones.ts`**: URL base (`environment.urlSeguridad` sin `/auth/`),
  desenvolver el sobre, pedir todas las páginas de un listado (200 por
  página) y sacar el mensaje de un error (`mensaje` del backend en 400, 403,
  404 y 409; «No se pudo conectar» si no hay respuesta).
- El token lo pone el interceptor de siempre (`TOKEN-SISCI`).

### Fuente de datos: mock o backend

`services/http/fuente-datos.ts` registra en `app.config.ts`, para cada
servicio, `{ provide: XxxMockService, useClass: … }`:

| Situación | Servicio que reciben las pantallas |
|---|---|
| Producción | Siempre el HTTP (backend). |
| Desarrollo con `SISCI-DEV-SESION-SIMULADA = 'true'` | El mock (no hay token real: el backend respondería 401). |
| Desarrollo con sesión real | El HTTP (backend de pruebas). |

Se decide una sola vez, al cargar la app: activar o salir de la sesión
simulada ya recarga la página. `fuente-datos.ts` lee la bandera de
`localStorage` por su cuenta, porque corre al armar los proveedores, antes
de que exista el inyector (no puede usar `PerfilUsuarioService`).

### Estados (los del backend)

Los tipos de `models/tipos-conflicto.ts` usan los mismos valores que la
API, sin traducir:

| Tipo | Valores |
|---|---|
| `Riesgo` | `BAJO`, `MEDIO` (se muestra «Moderado»), `ALTO`, `CRITICO` |
| `Clasificacion` | `D` declarado, `N` no declarado, `H` homónimo; `null` sin clasificar |
| `EstadoSeguimiento` (`Conflicto.estado`) | `DETECTADO`, `EN_ANALISIS`, `EN_PLANIFICACION`, `EN_EJECUCION`, `FINALIZADO`, `DESCARTADO` |
| `EstadoAnalisis` | `BORRADOR`, `VALIDADO` |
| `EstadoPlan` | `BORRADOR`, `FIRMADO`, `CERRADO` (+ `tipoCierre`: `CUMPLIDO` / `ANTICIPADO`, `motivoCierre`) |
| `EstadoActividad` | `PENDIENTE`, `EN_REVISION`, `ACEPTADA`, `RECHAZADA`, `NO_CUMPLIDA` |
| `Evidencia.estado` | `PENDIENTE`, `APROBADA`, `RECHAZADA` |

«Plan con vencidas» y «actividad vencida» no son estados del backend: se
calculan en el front con la fecha límite (`utils/planes.util.ts`).

### Qué hace el backend y qué hace el front

| El backend (fuente de verdad) | El front |
|---|---|
| Clasificar (transición de estado del conflicto) y validar el análisis | No ofrece lo que va a fallar: no deja volver a «sin clasificar» y exige observación para `H` |
| Un plan abierto por conflicto; crear otro sobre un `FINALIZADO` lo reabre | Muestra el estado y el error del backend si lo rechaza |
| Firmar y enviar el plan en un solo paso (`POST /planes/{id}/firmar`), fechas límite, avisos a responsables | Valida el PDF (≤ 5 MB) antes de enviar; «Quitar documento» es solo de la pantalla |
| Revisar evidencias (definitivo, sin «deshacer»); quien sube no revisa; nadie decide sobre su propio conflicto (403) | Valida la evidencia (PDF, PNG o JPG, ≤ 5 MB) antes de subir |
| Cierre automático (`FINALIZADO` al aprobar la última) y cierre anticipado (motivo, condiciones) | Ofrece el cierre anticipado solo cuando se puede |
| Notificaciones (las crea y filtra por usuario) | Las muestra en la campana |
| Historial (`LINEA_DE_TIEMPO`, actividad reciente) | Lo dibuja |
| Consulta previa (coincidencias con nómina y declaraciones) | Formulario y resultado |
| — | Vencimientos, dashboards, Informe General y filtros: se calculan en el navegador con los listados completos |

Tras cada acción, el servicio HTTP vuelve a pedir el conflicto en vez de
deducir el nuevo estado, porque el backend cambia en cascada actividades,
plan y conflicto.

Con la sesión simulada, los mocks aplican las mismas reglas sobre los datos
de ejemplo.

## Correr la app en local

```bash
npm install
ng serve          # http://localhost:4200/
ng test           # pruebas unitarias (Karma)
ng build          # build de producción
```

Sin acceso a la intranet, la app manda a `/login`. Para entrar en una
máquina de desarrollo con un rol simulado (`R`, `A`, `E`...) se usa la
**sesión simulada**, que solo existe fuera de producción y está apagada por
defecto. Cómo activarla, qué ve cada rol y cómo retirarla:
[DESARROLLO_LOCAL.md](DESARROLLO_LOCAL.md).

## Convenciones

Las reglas de código (nombres, documentación, formato de 2 espacios,
manejo de errores, rutas, estilos y componentes compartidos) están en
[CONVENCIONES.md](CONVENCIONES.md).
