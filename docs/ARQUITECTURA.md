# Arquitectura de SISCI (Sistema de Conflicto de Intereses)

Aplicación web de EEASA (Angular 19, componentes standalone) para el
procedimiento de **conflictos de interés** (código PNIP.CI): los empleados
declaran sus posibles conflictos y Recursos Humanos los gestiona hasta
cerrarlos.

## Las dos partes de la app

| Parte | Qué hace | Rutas | Datos |
|---|---|---|---|
| **Declaración** | Login, formulario de declaración, «Mis declaraciones», administración de formularios recibidos, gestión de roles y claves temporales para externos. | `/login`, `/`, `/mis-formularios`, `/admin` | **Reales**: backend `wssisci` (vía `BackendService` y `AuthService`). |
| **Gestión de conflictos** | Lo que RRHH hace con las declaraciones: análisis de conflictos, consulta previa, planes de acción, revisión de evidencias, informe general e historial. Y la bandeja de cada responsable de actividades. | `/rrhh/**`, `/responsable/**` | **Simulados** (mock), hasta que exista el backend. |

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
    │                      app-data-table, app-modal...)
    ├── pipes/             pipes standalone
    ├── utils/             funciones puras (fechas, planes, tonos...)
    ├── models/            interfaces y tipos (barrel: models/index.ts)
    ├── guards/            authGuard y rolGuard
    ├── interceptors/      token en cada petición HTTP
    └── services/
        ├── auth.service.ts, backend.service.ts...   reales
        ├── perfil-usuario.service.ts   rol de gestión y empleado actual
        ├── *-mock.service.ts           datos simulados
        └── mock-data/                  los datos de ejemplo
```

## Qué es real y qué es simulado

| Real (backend `wssisci`) | Simulado |
|---|---|
| Login, token de intranet, roles del usuario (`AuthService`) | Formularios, conflictos, planes, actividades, evidencias, excusas, notificaciones y personas de la gestión de conflictos (`services/*-mock.service.ts` con `services/mock-data/`) |
| Guardar y consultar declaraciones, formularios recibidos, roles, claves temporales (`BackendService`) | El empleado actual en desarrollo (`SISCI-DEV-EMPLEADO`, ver `PerfilUsuarioService`) |

El PDF de la declaración (`ConflictoPdfService`) no usa backend: se arma en
el navegador con los datos reales del formulario.

Los servicios simulados ya devuelven `Observable` con la misma forma que
tendrá el servicio HTTP: cuando exista el backend, se reemplaza cada
`*MockService` sin tocar las pantallas.

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
