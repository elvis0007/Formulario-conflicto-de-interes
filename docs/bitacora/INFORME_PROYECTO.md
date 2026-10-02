# Informe del proyecto — base para el módulo PNIP-CI

Proyecto analizado: `APP/Formulario-conflicto-de-interes`
(nombre en `angular.json`: `Formulario-Conflicto-Interes`).
Fecha del análisis: 2026-09-29 (Día 1 de 15).

---

## 1. Versión de Angular

| Paquete | Rango en `package.json` | Versión instalada según `package-lock.json` |
|---|---|---|
| `@angular/core` (y resto de `@angular/*`) | `^19.2.0` | 19.2.18 |
| `@angular/cli` / `@angular-devkit/build-angular` | `^19.2.13` | 19.2.19 |
| `typescript` | `~5.7.2` | — |
| `rxjs` | `~7.8.0` | — |
| `zone.js` | `~0.15.0` | — |

- Builder: `@angular-devkit/build-angular:application` (esbuild + Vite en `ng serve`).
- `tsconfig.json` con `strict: true`, `noPropertyAccessFromIndexSignature`,
  `noImplicitReturns` y `strictTemplates`. Todo lo nuevo tiene que compilar
  bajo esas reglas.
- Dependencias SSR (`@angular/ssr`, `@angular/platform-server`, `express`) y un
  script `serve:ssr:…` están en `package.json`, pero **`angular.json` no tiene
  configurado SSR** (no hay `server`/`ssr`/`prerender` en las opciones de build)
  y no existe `server.ts`. En la práctica la app es solo cliente.

## 2. Standalone vs. NgModules

**100 % standalone.** No existe ningún `*.module.ts`.

- `src/main.ts` usa `bootstrapApplication(AppComponent, appConfig)`.
- `src/app/app.config.ts` define los providers (`provideRouter`,
  `provideHttpClient(withInterceptors(...))`, `provideAppInitializer`).
- Todos los componentes declaran `imports: [...]` en su decorador. Algunos
  llevan `standalone: true` explícito (p. ej. `SidebarMenuComponent`) y otros
  no (en Angular 19 es el valor por defecto).

## 3. Librería de UI

**Ninguna.** No hay Angular Material, PrimeNG, Bootstrap ni Tailwind en
`package.json`, ni hojas de estilo de terceros en `angular.json`
(`styles: ["src/styles.scss"]`, `scripts: []`).

La UI está hecha con **HTML + SCSS propio por componente**. Otras librerías
que sí usa el proyecto (no de UI):

- `jspdf` — generación del PDF de la declaración (`services/conflicto-pdf.service.ts`).
- `xlsx` — exportación a Excel desde el panel de administración.
- `@fingerprintjs/fingerprintjs` — huella del navegador que se envía al
  backend al validar tokens.

## 4. Ruteo

- Archivo: `src/app/app.routes.ts` (estilo standalone, `export const routes: Routes`).
- Registrado en `app.config.ts` con
  `provideRouter(routes, withHashLocation())` → **las URLs llevan `#`**
  (p. ej. `http://localhost:4200/#/admin`).
- Rutas existentes, todas con carga **eager** (`component:`) y todas con
  `canActivate: [authGuard]`:

  | Ruta | Componente |
  |---|---|
  | `login` | `LoginComponent` |
  | `''` | `ConflictFormComponent` (el formulario en producción) |
  | `admin` | `AdminComponent` |
  | `mis-formularios` | `MisFormulariosComponent` |
  | `**` | `redirectTo: ''` |

- **No hay lazy loading en ningún sitio.** No hay ejemplo interno que seguir;
  para PNIP-CI se usará el mecanismo estándar de Angular standalone:
  `loadChildren: () => import(...).then(m => m.RUTAS)` y `loadComponent`.

### ⚠️ Hallazgo importante: lista blanca de rutas

`app.routes.ts` exporta `RUTAS_PERMITIDAS = ['/', '/login', '/admin', '/mis-formularios']`
y **dos piezas de código redirigen cualquier URL que no esté en esa lista
(comparación exacta)**:

1. `guards/auth.guard.ts` — si la URL no está en la lista, redirige a `/admin`
   (roles A/R) o a `/`.
2. `app.component.ts` — `validarYRederigirRuta()` (en cada `NavigationEnd`) y
   el manejador de `popstate` hacen la misma redirección.

Consecuencia: una ruta nueva como `/pnip/rrhh/dashboard` sería expulsada
aunque esté registrada en el router. Como las rutas de PNIP-CI tienen
parámetros (`:conflictoId`, `:planId`), tampoco basta con agregarlas a
`RUTAS_PERMITIDAS`. Ver la sección «Decisiones del Día 1» para cómo se
resolvió con el cambio mínimo.

## 5. Usuario autenticado y roles

Sí existe un mecanismo real. Piezas:

| Pieza | Archivo | Qué hace |
|---|---|---|
| `AuthService` | `services/auth.service.ts` | Guarda tokens y usuario en *signals* + `localStorage`. Expone `usuario()`, `roles()`, `getCurrentUser()`, `hasRole(abrev)`, `isAuthenticated()`, `logout()`. |
| `IUsuario` | `models/usuario.ts` | Datos del empleado (`CEDULA`, `NOMBRES`, `CARGO`, `DEPARTAMENTO`, …) y `roles` / `ROLES: string[]`. |
| `provideAppInitializer` | `app.config.ts` | Al arrancar busca un token de Intranet (URL › cookie › `localStorage`), lo valida contra `wssisci/auth/getUsuarioIntranet`, y si no hay token pero sí sesión SISCI (externos) la acepta. |
| `authGuard` (funcional, `CanActivateFn`) | `guards/auth.guard.ts` | Exige sesión, aplica reglas por rol y la lista blanca. |
| `solicitudInterceptor` (funcional) | `interceptors/solicitudes.interceptor.ts` | Añade `Authorization: Bearer <TOKEN-SISTEC>` (o el token crudo de Intranet en dos endpoints). |

Claves en `localStorage`: `TOKEN-INTRANET`, `TOKEN-SISTEC`, `USUARIO-SISTEC`
(JSON del `IUsuario`), y `TOKEN-SISGERH` (leída por el interceptor).

**Roles**: el backend devuelve abreviaturas en `usuario.roles`. Las que usa
el front hoy:

| Abreviatura | Significado (deducido del código) |
|---|---|
| `A` | Administrador |
| `R` | «JEFE DE RECURSOS HUMANOS» (texto literal en `manage-rrhh-modal.component.ts`) |
| `E` | Usuario externo (login con cédula + clave temporal) |
| `I` | Mencionada en un comentario de `usuario.ts`; no se usa en ninguna condición. Significado no confirmado. |

En todo el front, **A y R se tratan igual** («admin o jefe RRHH»).

**No existe ningún rol para «Responsable» de un plan de acción.** Es un
concepto nuevo de PNIP-CI que el backend todavía no expone.

## 6. Estructura de carpetas

```
src/
├── index.html            (lang="es", <base href="/">)
├── main.ts
├── styles.scss           (estilos globales mínimos)
├── typings.d.ts
├── environments/         (environment.ts / environment.prod.ts)
└── app/
    ├── app.component.*   (layout: header + <router-outlet> + footer)
    ├── app.config.ts
    ├── app.routes.ts
    ├── admin/                 AdminComponent (panel RRHH/Admin)
    ├── assign-users-modal/
    ├── conflict-form/         ConflictFormComponent (el formulario en producción)
    ├── footer/
    ├── generate-code-modal/
    ├── header/
    ├── login/
    ├── manage-rrhh-modal/
    ├── mis-formularios/
    ├── sidebar-menu/
    ├── guards/            auth.guard.ts
    ├── interceptors/      solicitudes.interceptor.ts
    ├── models/            usuario.ts, respuesta-login.ts
    └── services/          auth, backend, code-generator, conflicto-pdf
```

«Formulario-conflicto-de-interés» **no es un módulo aislado dentro de la
app: es la app entera**, con estructura plana. Convenciones que se observan:

- Una carpeta por componente en kebab-case, con archivos
  `nombre.component.ts|html|scss` (`templateUrl` + `styleUrl`, nunca inline).
- Selector con prefijo `app-` (`angular.json` → `"prefix": "app"`).
- Carpetas transversales por tipo: `guards/`, `interceptors/`, `models/`,
  `services/`.
- Modelos: un archivo por interfaz, en kebab-case, con prefijo `I`
  (`IUsuario`, `IRespuestaLogin`). Los DTO de backend viven dentro de
  `backend.service.ts` con sufijo `Dto`.
- Servicios `@Injectable({ providedIn: 'root' })`; inyección mezclada
  (`inject()` en los más nuevos, constructor en los antiguos).
- Guard e interceptor **funcionales** (`CanActivateFn`, `HttpInterceptorFn`).
- Comentarios en español, `/** ... */` en algunos métodos, sin `@author`.
- Formato: `.editorconfig` → **2 espacios**, comillas simples en TS.
- Los componentes grandes superan las 1500 líneas
  (`conflict-form.component.ts` ≈ 1800, su `.scss` ≈ 1575).

## 7. Estilos globales

- **SCSS** (`inlineStyleLanguage: scss`, schematic de componentes en `scss`).
- `src/styles.scss` es mínimo: reset (`* { margin:0; padding:0; box-sizing:border-box }`),
  `body` con pila tipográfica del sistema
  (`-apple-system, 'Segoe UI', Roboto, …`), fondo `#f1f4f8`, texto `#22314f`
  y una clase `body.dark-mode`.
- **No hay archivo de tema ni variables SCSS globales, ni Tailwind.**
- Cada componente declara sus propias *custom properties* en `:host`
  con prefijo `--ci-` (p. ej. en `conflict-form` y `admin`:
  `--ci-ink: #163b5f`, `--ci-accent: #1a5490`, `--ci-canvas: #f1f4f8`, …).
  Es un patrón «tokens por componente» sin fuente única.
- La cabecera usa azul `#163b5f`. No hay fuentes web cargadas (ni en
  `index.html` ni en SCSS): todo usa fuentes del sistema.

Para PNIP-CI esto implica: los tokens y las fuentes Barlow deben quedar
**encapsulados** en el módulo; nada de `:root` global.

## 8. Node, CLI y ejecución local

- Node requerido por Angular CLI 19.2: `^18.19.1 || ^20.11.1 || >=22.0.0`.
  En esta máquina: Node v24.13.0, npm 11.6.2.
- Angular CLI: 19.2.x (local en `devDependencies`; no hace falta global,
  se usa vía `npx ng` o los scripts de npm).
- Cómo correrlo:
  ```bash
  npm ci          # o npm install
  npm start       # = ng serve  → configuración development, http://localhost:4200/#/
  npm run build   # = ng build  → configuración production (baseHref /sisci/) + scripts/post-build.js
  ```
- `ng serve` usa `proxy.conf.json` (solo reescribe `/sisci/assets`).
- El backend está en `http://172.20.35.209:7001/wssisci/auth/` (red interna);
  sin acceso a esa red no se puede iniciar sesión real.
- Producción se despliega como WAR (el `post-build.js` crea `META-INF/` y
  `WEB-INF/web.xml`).

## Lo que no se pudo determinar con certeza

1. **Significado del rol `I`** — solo aparece en un comentario.
2. **Si el rol `A` (Administrador) debe tener acceso a la parte RRHH de
   PNIP-CI.** El resto de la app trata A y R igual; se asumió lo mismo.
3. **Cómo se identificará a un «Responsable»** (rol nuevo en backend, o
   derivado de tener actividades asignadas). No hay nada en el front ni en
   las respuestas actuales.
4. **Repositorio git**: la carpeta del proyecto **no es un repositorio git**
   (`git status` → *not a repository*). No se sabe si el repo real está en
   otra ubicación.
5. **SSR**: hay dependencias de SSR pero no está configurado; no se sabe si
   se abandonó o está pendiente.
6. Node 24 cumple el rango `>=22.0.0`, pero no se sabe qué versión de Node
   usa el equipo/servidor de build.

---

## Decisiones del Día 1

### Estructura creada

```
src/app/pnip-ci/
├── .editorconfig                 4 espacios / 80 col. solo para el módulo
├── CONVENTIONS.md
├── pnip-ci.constants.ts          PNIP_CI_RUTA_BASE + esRutaPnipCi()
├── pnip-ci.routes.ts             PNIP_CI_ROUTES (lazy)
├── core/
│   ├── guards/rol.guard.ts       rolGuard (CanActivateFn) + DATO_ROL_REQUERIDO
│   ├── services/rol-pnip-ci.service.ts
│   └── models/                   un archivo por interfaz + tipos.ts + index.ts
├── shared/components/pnip-ci-shell/   shell que aplica tokens y fuentes
├── rrhh/<pantalla>/<pantalla>.component.ts        9 placeholders
├── responsable/<pantalla>/<pantalla>.component.ts 3 placeholders
└── styles/_tokens.scss
```

### Adaptaciones al proyecto real

| Pedido | Qué se hizo | Por qué |
|---|---|---|
| `pnip-ci.routes.ts` o `pnip-ci-routing.module.ts` | `pnip-ci.routes.ts` exportando `PNIP_CI_ROUTES`, cargado con `loadChildren`; cada pantalla con `loadComponent` | El proyecto es 100 % standalone (no hay NgModules). |
| `RolGuard` | `rolGuard` funcional (`CanActivateFn`) en `rol.guard.ts` | Igual que `authGuard`, que es funcional. |
| `:root { ... }` en `_tokens.scss` | Las variables están en un `@mixin variables` que se aplica en el `:host` de `PnipCiShellComponent` | Un `:root` sería global y afectaría al formulario existente. Las custom properties se heredan por el DOM, así que todas las pantallas del módulo las reciben igual. |
| Fuentes Barlow con alcance limitado | `@import url(Google Fonts)` en el SCSS del shell; `font-family: var(--font-sans)` en su `:host`. Se añadieron los tokens `--font-sans` y `--font-condensed` | Los estilos de un componente se inyectan solo cuando se crea, así que la fuente solo se descarga al entrar a `/pnip`. `@font-face` es global por naturaleza, pero nada fuera del módulo usa la familia Barlow. |
| Indentación de 4 espacios | `.editorconfig` anidado en `src/app/pnip-ci/` | El `.editorconfig` raíz dice 2 espacios; así el editor aplica 4 solo dentro del módulo sin tocar el resto. |
| Modelos | Nombres tal cual se pidieron (`Persona`, no `IPersona`), un archivo por interfaz como en `models/` | El proyecto usa prefijo `I` (`IUsuario`), pero la especificación y `CONVENTIONS.md` piden PascalCase sin prefijo. Anotado en `CONVENTIONS.md`. |
| Tipo `RolPnipCi` | Nuevo, en `core/models/rol-pnip-ci.ts`. Día 1: `'rrhh' \| 'responsable'`; **desde el Día 2 solo `'rrhh'`** | Hacía falta un tipo para el guard y el servicio. |
| Placeholders | Plantilla inline (`template: '<h2>…</h2>'`) | Son temporales; cuando se construya cada pantalla pasará a `templateUrl` + `styleUrl` como el resto del proyecto. |
| Selectores | Prefijo `app-pnip-` | `angular.json` define el prefijo `app`. |

### Rol y guard (pendiente de confirmar con backend)

> **Superado el Día 2.** El punto 1 quedó confirmado y el punto 2 se
> corrigió: ver «Decisiones del Día 2».
>
> **Eliminado el 30/09/2026:** la simulación de rol propia del módulo
> (`PNIP-CI-ROL-SIMULADO`, que en desarrollo trataba a todos como RRHH) ya
> no existe. `RolPnipCiService` consulta siempre `AuthService.hasRole()`.
> Para simular un rol en local se usa la sesión simulada de `AuthService`
> (`PNIP-CI-AUTH-SIMULADA` + `PNIP-CI-ROL-DEV`); ver
> `docs/pnip-ci/DESARROLLO_LOCAL.md`. Las menciones a `PNIP-CI-ROL-SIMULADO`
> y a «RRHH (simulado)» que siguen en este informe son históricas.

Sí había un mecanismo real (`AuthService.hasRole()`), así que
`RolPnipCiService` lo usa, con esta traducción:

| Rol backend | Rol PNIP-CI |
|---|---|
| `R` (Jefe RRHH) o `A` (Admin) | `rrhh` |
| — (no existe) | `responsable` |

**Supuestos que hay que confirmar:**

1. **Que `A` (Administrador) deba entrar a la parte RRHH.** Se asumió porque
   el resto de la app trata A y R igual.
2. **Rol «Responsable»: no existe en backend.** Hasta que exista:
   - **Fuera de producción** (`environment.production === false`) se
     **simula** un rol: por defecto `'rrhh'` (constante
     `ROL_SIMULADO_POR_DEFECTO` en `rol-pnip-ci.service.ts`). Se puede cambiar
     sin recompilar desde la consola del navegador:
     ```js
     localStorage.setItem('PNIP-CI-ROL-SIMULADO', 'responsable'); // o 'rrhh'
     localStorage.setItem('PNIP-CI-ROL-SIMULADO', 'ninguno');     // usa solo roles reales
     localStorage.removeItem('PNIP-CI-ROL-SIMULADO');             // vuelve al defecto
     ```
   - **En producción la simulación no se aplica nunca**: solo R/A entran a
     `/pnip/rrhh/**` y **nadie** puede entrar a `/pnip/responsable/**`. Es
     intencionado, para que un despliegue accidental no dé acceso de RRHH a
     todo el mundo.
   - Cuando el backend defina cómo se identifica a un responsable, solo hay
     que cambiar `RolPnipCiService.obtenerRoles()`.
3. **Sesión**: `rolGuard` exige `AuthService.isAuthenticated()` igual que
   `authGuard`; sin sesión redirige a `/login`. Sin el rol pedido, redirige
   al inicio del rol que sí tenga (`/pnip/rrhh/dashboard` o
   `/pnip/responsable/dashboard`), o a `/` si no tiene ninguno.
4. `/pnip` a secas redirige al inicio del rol del usuario.

### Archivos existentes modificados (conexión mínima)

Solo dos, y solo con adiciones:

1. **`src/app/app.routes.ts`**
   - `+ import { PNIP_CI_RUTA_BASE } from './pnip-ci/pnip-ci.constants';`
   - `+` una ruta `{ path: 'pnip', loadChildren: () => import('./pnip-ci/pnip-ci.routes')… }`
     antes del comodín `**`.
   - `RUTAS_PERMITIDAS` **no** se tocó.
2. **`src/app/app.component.ts`** (no estaba previsto, pero es necesario)
   - `+ import { esRutaPnipCi } from './pnip-ci/pnip-ci.constants';`
   - `+ if (esRutaPnipCi(url)) { return; }` en dos sitios: en el manejador
     de `popstate` y en `validarYRederigirRuta()`, **después** de la
     comprobación de sesión (un usuario sin sesión sigue yendo a `/login`).

   Motivo: `AppComponent` redirige, en cada navegación, cualquier URL que no
   esté exactamente en `RUTAS_PERMITIDAS` (ver «Hallazgo importante» en la
   sección 4). Sin este cambio `/pnip/...` se registraría pero se expulsaría
   de inmediato a `/admin` o `/`. Para las URLs que no empiezan por `/pnip`
   el comportamiento es idéntico al anterior.

`auth.guard.ts` no se tocó: las rutas de PNIP-CI no lo usan.

### Verificación

- `ng build` en **development** y **production**: compilan sin errores. Los
  avisos de producción («CommonJS dependencies» de `jspdf`/`canvg`) son
  preexistentes.
- `pnip-ci.routes` y cada pantalla salen como *lazy chunks*; ni los tokens ni
  la URL de Google Fonts aparecen en `main.js` ni en `styles.css`.
- `ng serve` + Edge headless, simulando sesión en `localStorage`:
  - Rol `R` (simulación por defecto `rrhh`): las 9 rutas RRHH muestran su
    `<h2>`; `/pnip/responsable/**` redirige a `/pnip/rrhh/dashboard`;
    `/admin` y `/mis-formularios` siguen funcionando.
  - Simulación `responsable`: las 3 rutas de responsable cargan;
    `/pnip/rrhh/**` redirige a `/pnip/responsable/dashboard`.
  - Rol `E` sin simulación: `/pnip/**` redirige a `/`; `/admin` a `/`;
    ruta inexistente a `/` (igual que antes).
  - Rol `R` sin simulación (rol real): entra a RRHH; `/` sigue yendo a `/admin`.
  - Sin sesión: `/pnip/rrhh/dashboard` → `/login`.
  - Dentro del módulo: `--accent = #5980A6` y fuente `Barlow`; en `body`
    `--accent` no existe y la fuente sigue siendo la del sistema.

### Otros

- La carpeta del proyecto **no era un repositorio git**. Por decisión de
  Elvis se creó un repo **local** (sin remoto): commit base en `main` con el
  proyecto tal como estaba, y el trabajo del Día 1 en la rama
  `feature/pnip-ci`. `git diff main feature/pnip-ci -- src/app/app.*`
  muestra exactamente la conexión mínima. Si existe un repo oficial, habrá
  que llevar estos cambios allí.
- Se ejecutó `npm ci` para poder compilar (no había `node_modules`); no se
  cambió `package.json` ni `package-lock.json`.

---

## Decisiones del Día 2

### Paso 0 — «Responsable» deja de ser un rol

Confirmado por Elvis:

1. El Administrador (`A`) entra a RRHH igual que el Jefe de RRHH (`R`).
   Ya era así; no cambió.
2. **«Responsable» no es ni será un rol de autenticación.** Cualquier
   empleado autenticado puede ser responsable de una o varias actividades,
   porque el backend se las asigna dentro de un plan. Ser responsable es una
   relación con una actividad concreta (`Actividad.responsableId`), no un
   permiso. Por eso tratarlo como rol (Día 1) era un error de modelo.

Cambios:

| Archivo | Cambio |
|---|---|
| `core/models/rol-pnip-ci.ts` | `RolPnipCi` pasa de `'rrhh' \| 'responsable'` a solo `'rrhh'`. |
| `core/guards/rol.guard.ts` | `data.rolRequerido` admite `null` = «solo sesión». Con `'rrhh'` exige R/A. Si la ruta **no declara** la clave, el guard niega el paso (así, si alguien la olvida, nunca se abre una pantalla de RRHH). Sin el rol pedido redirige a `/pnip/responsable/dashboard`, que siempre es accesible. |
| `pnip-ci.routes.ts` | `/pnip/responsable/**` usa `data: { rolRequerido: null }`. `/pnip` redirige al dashboard de RRHH si el usuario es R/A y, si no, al de responsable. |
| `core/services/rol-pnip-ci.service.ts` | Eliminada la simulación del rol `'responsable'` (en `PNIP-CI-ROL-SIMULADO` solo valen `rrhh` o `ninguno`). Añadido `obtenerEmpleadoActualId()`. |

La sesión se comprueba con `AuthService.isAuthenticated()`, el mismo
mecanismo que usa `auth.guard.ts`.

**Consecuencia a tener en cuenta:** los usuarios externos (rol `E`, entran
con cédula y clave temporal) también están autenticados, así que pueden abrir
`/pnip/responsable/**`. No verán nada, porque no tienen código de empleado y
nunca serán responsables de actividades. Si se quiere bloquearlos
explícitamente, basta con una condición más en el guard. ~~**Pendiente de
decidir.**~~ **Resuelto el Día 3:** los externos quedan bloqueados.

### Empleado actual (`obtenerEmpleadoActualId()`)

- **Fuera de producción:** el valor de
  `localStorage.getItem('PNIP-CI-EMPLEADO-SIMULADO')` o, si no hay, `EMP-010`
  (Fernando José Andrade Vela). Por defecto es él porque tiene actividades
  aprobadas, rechazadas y pendientes en varios planes.
  ```js
  localStorage.setItem('PNIP-CI-EMPLEADO-SIMULADO', 'EMP-001'); // ver datos de otro empleado
  ```
- **En producción:** `AuthService.getCurrentUser()` **sí expone** un código
  de empleado: `DMPER_CODIGO` (o `CODIGO`). Se toma igual que ya lo hace
  `BackendService` al guardar el formulario
  (`currentUser?.DMPER_CODIGO || currentUser?.CODIGO`).
- **Pendiente de confirmar con backend:** que `Actividad.responsableId`
  vendrá con **ese mismo código** (DMPER) y no con la cédula u otro id.
- **Adaptación:** devuelve `string | null` en vez de `string`, porque hay
  sesiones sin código de empleado (externos). Devolver `''` escondería ese
  caso.

### Servicios mock y datos de ejemplo

- Servicios en `core/services/*-mock.service.ts` y datos en
  `core/services/mock-data/*.data.ts`. Separarlos deja cada servicio pequeño y
  permite que conflictos y planes compartan los mismos objetos: los planes de
  cada conflicto se enlazan desde `PLANES` por `conflictoId`, en lugar de
  copiarse.
- Todos devuelven `Observable` con 300 ms de latencia simulada
  (`simularRespuesta`) y una **copia profunda** (`structuredClone`): si un
  componente modifica lo que recibe, no altera los datos de ejemplo del resto
  de la app.
- Todos llevan ya `manejarError(origen, valorPorDefecto)`
  (`core/utils/manejar-error.ts`): registra el error y emite una lista vacía o
  `undefined`.
- Métodos extra, además de los pedidos:
  `PlanesMockService.obtenerPlanesPorConflicto()`,
  `obtenerPlanesPorResponsable()`,
  `FormulariosMockService.obtenerEmpleadosSinFormulario()` y
  `NotificacionesMockService.contarNoLeidas()`.
- Hay 12 personas ficticias (pedidas ~10), con parentescos coherentes entre
  sí: los padres, los cónyuges y los apellidos cuadran con cada conflicto.
  Las tablas de cobertura (riesgo, relación, grado, clasificación, número de
  planes, estados) están en el TSDoc de `conflictos.data.ts` y
  `planes.data.ts`. Los correos usan `@ejemplo.com` y las URLs de archivos
  apuntan a `/mock/pnip-ci/…`, que no existe.
- `mock-data.spec.ts` verifica que los datos respetan las propias reglas: el
  estado de cada plan coincide con `derivarEstadoPlan`, cada fecha límite con
  `calcularFechaLimite`, ningún conflicto tiene más de un plan vigente, y todo
  responsable existe.

### Utilidades y pipes

Ubicación: el proyecto no tenía carpeta de utilidades.

- **Funciones puras de dominio** en `core/utils/`: `fechas.util.ts`,
  `planes.util.ts` y `manejar-error.ts`. Son lógica de negocio sin interfaz
  visual.
- **Pipes** en `shared/pipes/`, porque son de presentación.

Decisiones:

| Función | Decisión |
|---|---|
| `calcularFechaLimite` | Suma primero los meses y después los días. Si el día no existe en el mes destino, usa el **último día del mes** (31/01 + 1 mes = 28/02), no desborda al mes siguiente como `Date.setMonth`. Acepta `aaaa-mm-dd` y `dd/mm/aaaa`. Lanza `RangeError` si la fecha o el plazo no son válidos. |
| `calcularDiasRestantes` | Recibe `hoy` como segundo parámetro opcional, para poder probarla. La fecha límite **es el último día válido**: si es hoy devuelve `Vence hoy` con `vencida: false`. `dias` lleva signo (negativo si ya venció); el texto usa el valor absoluto, con singular «1 día». |
| `derivarEstadoPlan` | **Adaptación de firma:** `derivarEstadoPlan(actividades, fechaInicio)`. Solo con las actividades no se puede saber si el plan se envió. Un plan enviado **sin actividades** queda `activo`, no `cerrado`. |
| `calcularAvance` | Cuenta como cumplidas solo las `aprobada`. Porcentaje entero redondeado; 0 si no hay actividades. |
| **`hayPlanActivo`** | **Un plan en `borrador` SÍ cuenta** y bloquea «+ Nuevo plan». Si no contara, se podría crear un borrador junto a un plan activo y, al enviarlo, quedarían dos activos; o se podrían acumular varios borradores y enviarlos todos. Con esta regla cada conflicto tiene como máximo un plan vigente (`borrador`, `activo` o `activo_vencidas`), y solo se crea otro cuando todos están `cerrado`. |
| `FechaLargaPipe` | Implementado a mano: registrar el locale `es` para `DatePipe` afectaría a toda la app. Si la fecha no trae hora, omite «a las …». Si la fecha no es válida, devuelve el texto tal cual para que el error se vea. |
| `PlazoTextoPipe` | El pedido mezclaba «0 meses 15 días» y «Plazo: 15 días». No pude comprobarlo en el mockup porque el HTML está empaquetado y comprimido. Por eso admite tres formatos: `compacto` (por defecto, omite la unidad en cero: `15 días`), `etiqueta` (`Plazo: 15 días`) y `completo` (`0 meses 15 días`). Recibe el objeto (`{{ actividad \| plazoTexto }}`), no dos números. |

### Pruebas

- Specs del módulo:
  - `fechas.util.spec.ts`
  - `planes.util.spec.ts`
  - `rol.guard.spec.ts`
  - `shared/pipes/pipes.spec.ts`
  - `mock-data.spec.ts`
- Para correrlas en esta máquina (no hay Chrome, se usa Edge):
  ```bash
  CHROME_BIN="C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe" \
    npx ng test --watch=false --browsers=ChromeHeadless \
    --include='src/app/pnip-ci/**/*.spec.ts'
  ```
- Resultado del módulo: **52 de 52 correctas**.
- `ng test` completo: **52 correctas y 3 fallidas.** Las 3 son del spec
  **preexistente** `src/app/app.component.spec.ts`: `No provider for
  HttpClient`, y además esperaba el `<h1>Hello, …</h1>` de la plantilla
  inicial de Angular. Ese spec y `AuthService` no han cambiado desde `main`,
  y fallan igual sin los cambios de PNIP-CI. No se tocó, porque está fuera
  del módulo. **Pendiente:** decidir si se arregla o se elimina.

### Verificación

- `ng build` en development y en production: compilan sin errores.
  - Avisos de producción, todos preexistentes: dependencias CommonJS de
    `jspdf`/`canvg`, y el presupuesto de estilos de
    `conflict-form.component.scss`, que ocupa 25,24 kB con un límite de
    20 kB.
- `ng serve` + Edge headless:
  - Con rol `E` y sin simulación: `/pnip/responsable/**` carga; `/pnip/rrhh/**`
    y `/pnip` redirigen a `/pnip/responsable/dashboard`.
  - Con `R` y con `A`: entran a RRHH y a responsable; `/pnip` va a RRHH.
  - Sin sesión: `/login`.
  - `/`, `/admin` y `/mis-formularios` se comportan igual que antes.

---

## Decisiones del Día 3

> **No hay un documento de especificación en el proyecto.** Lo que el
> pedido llama «secciones 5 y 8» (menús y nombres de estado de cada vista)
> se tomó del propio pedido. El mockup `Sistema Conflicto de Interés
> (PNIP.CI).html` está empaquetado y comprimido y no se pudo consultar. Si
> la especificación dice algo distinto, hay que revisarlo.

### Paso 0 — Ajustes

- **Externos (`E`) bloqueados en `/pnip/responsable/**`**: un externo no
  es empleado. `rolGuard` usa `RolPnipCiService.esEmpleado()`, que mira
  siempre el rol real, nunca el simulado.
- Para no crear bucles de redirección, `obtenerRutaInicio()` devuelve `/`
  (fuera del módulo) a los externos. Si los mandara al dashboard de
  responsable, el guard los rechazaría y los volvería a mandar allí sin fin.
- `/pnip/rrhh/**` sigue exigiendo `R` o `A`.
- **`PlazoTextoPipe`** ahora recibe `true`/`false` como segundo parámetro;
  se quitaron los formatos del Día 2:
  - `{{ a | plazoTexto }}` → `2 meses 15 días`
  - `{{ a | plazoTexto:true }}` → `Plazo: 2 meses 15 días`

### Paso 1 — Tonos (`core/utils/tono.util.ts`)

- `Tono = 'rojo' | 'ambar' | 'verde' | 'azul' | 'naranja' | 'gris'`, con
  `mapearRiesgoATono`, `mapearEstadoPlanATono`,
  `mapearEstadoActividadATono` y, añadida para la campana,
  `mapearTipoNotificacionATono` (`ok` → verde, `rechazo` → naranja,
  `vencido`/`alerta` → rojo, `info` → azul).
- En `_tokens.scss` se añadieron **alias por tono** (`--rojo`,
  `--rojo-fill`, `--rojo-text`…) que apuntan a los colores existentes, para
  poder armar `var(--{tono}-fill)` como pedía el Badge. Los tokens no tenían
  un azul propio: `azul` usa la escala de acento (`--accent`,
  `--accent-100`, `--accent-700`).
- **Decisión: una actividad `vencida` usa tono ámbar en la vista del
  Responsable.** Esa vista no tiene el estado «Vencida» y se la muestra como
  «Pendiente», así que la insignia toma el tono de pendiente. El
  vencimiento se comunica con el texto de plazo en rojo. En la vista de RRHH
  sigue en rojo; los demás estados tienen el mismo tono en ambas vistas.
  **Pendiente de confirmar** con la especificación.

### Paso 2 — Componentes compartidos

| Componente | Notas |
|---|---|
| `BadgePnipComponent` | `tono` y `texto` obligatorios; colores de `var(--{tono}-fill)` y `var(--{tono}-text)`. |
| `KpiCardComponent` | Si es `clicable` se pinta como `<button>` con `aria-pressed`; si no, `<div>`. Número en Barlow Condensed con color `var(--{tono})`. `activo` añade un anillo en `--accent`. |
| `ModalPnipComponent` | Emite `cerrar` con la X, con Esc (`@HostListener`, que se limpia solo) y con clic en el fondo. El clic solo cuenta si el `mousedown` también empezó en el fondo, para que seleccionar texto y soltar fuera no lo cierre. El foco entra al abrir, Tab/Shift+Tab quedan atrapados y al cerrar vuelve a quien lo abrió. Animación de 160 ms (se desactiva con `prefers-reduced-motion`). `ancho: 'ancho'` = 1080 px. `role="dialog"`, `aria-modal`, `aria-labelledby`. Limitación: con dos modales abiertos a la vez, Esc cerraría los dos. |
| `PillsPnipComponent` | Botones con `aria-pressed` en un `role="group"`. La seleccionada lleva el fondo sólido de su tono (azul por defecto). |

**Pills y Tabs serán dos componentes separados.** `PillsPnipComponent`
es solo para filtros de un único valor (Análisis, días 5-6). Las pestañas de
«Planes de este conflicto» (días 7-8) serán un `TabsPnipComponent` aparte,
porque se comportan distinto:
- controlan un panel de contenido (`role="tablist"`/`tab`/`tabpanel`,
  `aria-controls`, flechas del teclado);
- cada pestaña muestra el estado de su plan con su insignia;
- la de un plan cerrado se ve atenuada.

Meter todo eso en Pills lo complicaría para su uso principal. Tabs no se
crea hoy porque todavía no hay pantalla que lo use.

### Paso 3 — Shell

- **Un solo layout parametrizado (`LayoutPnipComponent`)** en vez de dos
  shells. Lo único que cambia entre RRHH y Responsable es el menú, que llega
  por `data.menu` de la ruta (`MENU_RRHH` / `MENU_RESPONSABLE`, en
  `pnip-ci.menus.ts`). Dos componentes serían dos copias de la misma
  estructura.
- Rutas: `rrhh` y `responsable` son ahora rutas con componente
  (`LayoutPnipComponent`), guard, menú e hijas. **Las URLs no cambiaron.**
  Cada ruta hoja declara `data.breadcrumb`.
- **«Análisis de Conflictos» resaltado en Plan de Acción.** Lo resuelve
  `buscarItemActivo(menu, url)` (`sidebar-pnip/item-menu.ts`), que compara
  por prefijo de URL:
  1. Gana la hoja cuya `ruta` es prefijo de la URL por segmentos completos
     (`/a/b` coincide con `/a/b/c`, no con `/a/bc`); entre varias, la más
     larga.
  2. Si ninguna coincide, gana la hoja con el `prefijosAdicionales` más
     largo que coincida. «Análisis de Conflictos» declara
     `['/pnip/rrhh/conflictos/']`.

  Resultado:
  - `/pnip/rrhh/conflictos/C-001/planes/PL-002` → Análisis de Conflictos.
  - `/pnip/rrhh/conflictos/consulta-previa` → Consulta Previa (por su
    propia ruta).
  - `/pnip/responsable/planes/PL-003` → Bandeja de Tareas.

  No se usa `routerLinkActive` porque no sabe resaltar pantallas que no
  están en el menú.
- El grupo que contiene el ítem activo se expande al cargar y al navegar;
  los demás solo se abren y cierran a mano.
- **Pie del sidebar.** `AuthService` sí expone `NOMBRES` y `APELLIDOS`, así
  que no queda pendiente.
  - Nombre: mismo criterio que la cabecera existente.
  - Iniciales: primer nombre + primer apellido (`LF`).
  - Rol: `Administrador`, `Jefe de RRHH`, `RRHH (simulado)`, `Empleado` o
    `Usuario externo`.
- **Breadcrumb:** `obtenerBreadcrumb()` usa el `data.breadcrumb` de la ruta
  activa más profunda que lo declare.
- **Campana:**
  - El mock guarda estado en memoria: «marcar todas como leídas» dura toda
    la sesión.
  - **El filtro de 7 días ya está implementado** (`esDeUltimosDias` en
    `fechas.util.ts`). Para que funcione cualquier día que se pruebe, las
    fechas de ejemplo son relativas al momento de carga, y dos
    notificaciones tienen más de 7 días para ver que el filtro actúa.
  - El contador cuenta solo las no leídas visibles (últimos 7 días).
  - No había un pipe de tiempo relativo en el proyecto; se creó
    `TiempoRelativoPipe` (`hace 25 min`, `hace 3 h`, `ayer`, `hace 4 días`,
    y `dd/mm/aaaa` a partir de 7 días).
  - **Pendiente con backend:** las notificaciones no se filtran por
    usuario, así que el Responsable ve las mismas que RRHH.
- ~~**El módulo ocupa toda la ventana**~~ **Superado el Día 4:** el módulo
  convive con la cabecera y el pie del host (ver «Decisiones del Día 4»).
  Texto original: el módulo ocupaba toda la ventana (`position: fixed`, `z-index: 1000`),
  por encima de la cabecera y el pie que `AppComponent` pinta en **todas**
  las rutas. Ocultarlos exigiría tocar `AppComponent`, y eso queda fuera de
  lo acordado.
  - Consecuencia: dentro de `/pnip` no se ven cerrar sesión, modo oscuro ni
    «Mis formularios».
  - **Pendiente de decidir:** aceptarlo así o autorizar ese cambio mínimo
    en `AppComponent`.
- **Vitrina temporal:** `VitrinaPnipComponent`, dentro del placeholder del
  dashboard de RRHH, sirve para revisar insignias, KPIs, píldoras y el
  modal. Se elimina al construir el dashboard. **Eliminada el Día 4.**
- El menú no tiene iconos por ahora; solo el chevron de los grupos.

### Pruebas

- **Módulo: 101 de 101 correctas** en tres ejecuciones seguidas (Jasmine
  ordena al azar).
  - Nuevos specs: tonos, Badge, KpiCard, Modal (X, fondo, Esc, foco, Tab),
    Pills, `buscarItemActivo` y sidebar (Plan de Acción → Análisis),
    breadcrumb, campana y `TiempoRelativoPipe`.
  - Actualizados: guard (externos) y `PlazoTextoPipe`.
  - Un spec de la campana fallaba de forma intermitente según el orden
    aleatorio. Era un error del propio test (`afterEach` sin fixture) y ya
    está corregido.
- `ng test` completo: solo los 3 fallos preexistentes de
  `app.component.spec.ts` (ver Día 2).
- `ng build` development y production: sin errores; los avisos son los
  preexistentes.

### Verificación visual (Edge headless, clics y teclas reales)

- **Usuario `R`:**
  - `/pnip` → dashboard de RRHH.
  - En Plan de Acción: breadcrumb «Conflicto › Análisis de Conflictos ›
    Plan de Acción», grupo «Conflicto» expandido y «Análisis de
    Conflictos» resaltado.
  - Los grupos se abren y cierran; «Excusas» navega y queda resaltado.
  - Pie: «LF · Lucía Alejandra Freire Ortiz · Jefe de RRHH».
- **Modal:**
  - El foco entra al abrir; 6×Tab y 6×Shift+Tab no salen del diálogo.
  - Se cierra con la X (el foco vuelve a «Abrir modal»), con clic en el
    fondo y con Esc.
  - Un clic en el contenido no lo cierra.
  - El modal ancho mide 1080 px.
- **Campana:**
  - Contador 5; panel de 410 px con 8 de las 10 notificaciones (las 2
    antiguas quedan fuera).
  - «Marcar todas» quita el contador y el tintado.
  - Se cierra con clic fuera y con Esc.
- **Empleado sin rol especial (`I`):**
  - `/pnip` → dashboard del responsable, con menú de 2 ítems.
  - El detalle de un plan resalta «Bandeja de Tareas».
  - `/pnip/rrhh/**` lo devuelve a su dashboard.
- **Externo (`E`):** `/pnip/responsable/dashboard` → `/`.
- **Fuera del módulo:** `/admin` sigue con la cabecera de siempre, sin el
  shell de PNIP-CI.
- En frío, la primera entrada a `/pnip` tarda ~1 s en el servidor de
  desarrollo, porque carga el chunk diferido.

---

## Decisiones del Día 4

### Paso 0.1 — Autoría

Se cambiaron las 61 apariciones de `@author EEASA` por `@author Elvis
Flores` en `src/app/pnip-ci/`, incluido `CONVENTIONS.md`. Solo se tocaron
comentarios. En `CONVENTIONS.md` sigue la mención al «Manual de estándares
de programación de EEASA», porque se refiere a la empresa, no a la autoría.

### Paso 0.2 — Layout conviviendo con la app host

- **Hallazgo:** el menú lateral de íconos (`app-sidebar-menu`) **no lo pinta
  `AppComponent`**, sino `AdminComponent`, y solo en la ruta `/admin`. En
  `/pnip` nunca aparece.
- Por eso **no hizo falta tocar ningún archivo del host**:
  - ni una salida temprana más en `AppComponent`;
  - ni una condición en su plantilla.
  
  `app.component.ts` y `app.routes.ts` siguen exactamente como quedaron el
  Día 1.
- Qué cambió en el módulo:
  - **Shell (`PnipCiShellComponent`):** ya no es `position: fixed`; se
    pinta en el flujo normal entre la cabecera y el pie del host. Mide el
    alto **real** de la cabecera (`app-header`, con `ResizeObserver`, en
    solo lectura) y lo publica en `--alto-cabecera-host`. Así no se asume
    `100vh` ni 64 px fijos: la cabecera puede crecer si su título ocupa dos
    líneas.
  - **Layout:** `min-height: calc(100vh - --alto-cabecera-host)`. La página
    hace scroll normal y el pie del host queda al final.
  - **Topbar:** se fija justo bajo la cabecera del host (`sticky`,
    `top: --alto-cabecera-host`).
  - **Sidebar:** su fondo ocupa todo el alto del layout. Su contenido se fija
    bajo la cabecera con su **altura natural**, como máximo el alto visible.

    La primera versión fijaba el sidebar a alto completo, y la verificación
    visual mostró un problema: al llegar al final de la página, el pie del
    host empujaba el sidebar hacia arriba y la marca y los primeros ítems
    quedaban tapados por la cabecera.

    Consecuencia de la corrección: el bloque de usuario queda justo debajo
    del menú, no pegado al fondo de la ventana.
  - **Modal:** `z-index` subido a 1000, por encima de la cabecera sticky del
    host (100).
- **Vitrina temporal eliminada** del dashboard de RRHH.
- **Cerrar sesión desde `/pnip`:** funciona.
  - `HeaderComponent.logout()` borra los tokens y redirige a la intranet
    (`https://app.eeasa.com.ec/intranet#/inicio`). Verificado: el navegador
    fue a esa URL.
  - Al volver después a `/pnip/rrhh/dashboard`, `rolGuard` no ve sesión y
    manda a `/login`. No queda ningún estado intermedio.
  - Nota de la prueba: quise bloquear esa URL en el navegador de prueba y
    no funcionó. Edge headless cargó la página pública de la intranet
    real, sin tokens, porque la sesión ya se había borrado.
- **Modo oscuro dentro de `/pnip`:** el botón del host funciona (pone
  `body.dark-mode`, lo guarda en `localStorage` y cambia el ícono). **PNIP-CI
  no tiene tema oscuro propio**, así que su contenido no cambia.
  **Pendiente de decidir** si el módulo debe soportarlo; con los tokens
  bastaría redefinirlos bajo `:host-context(body.dark-mode)` en el shell.

### Paso 0.3 — Referencia: «Formularios recibidos» existente

Se revisaron `admin.component.html/.scss/.ts` sin modificarlos.

**No hay un componente de tabla reutilizable:** la tabla, los filtros y la
paginación están escritos directamente en `AdminComponent`, con sus estilos
en su SCSS. Se **copió el estilo, no el código**.

| Tomado del host | Cómo quedó en PNIP-CI |
|---|---|
| Banda oscura con el título en mayúsculas y el total: «Formularios Recibidos (n)» | Clase `.banda` (`--navy-form`) en `styles/_listados.scss`. |
| Panel blanco de filtros pegado bajo la banda: selects de tipo y contrato, fechas «desde/hasta», buscador y botón azul «EXPORTAR» con ícono de Excel | Clase `.filtros`, con etiquetas visibles en cada campo (el host no las tiene). Filtro de origen añadido. |
| Tabla con cabecera oscura en mayúsculas de 11 px, filas pares sombreadas, hover azul claro y borde inferior por fila | `DataTablePnipComponent`, `variante="navy"`. |
| Columnas: Nombre, Cédula, Origen, Tipo, Tipo de contrato, Fecha, Acciones | Las mismas. |
| Badge de origen verde (Interno) / naranja (Externo) | `BadgePnipComponent` con tono `verde` / `naranja`. |
| Acciones: botón 👁 (ver PDF) y ⌄ (desplegar historial) con borde | 👁 abre el modal; ⌄ despliega los familiares (`ExpandArrowButtonPnipComponent`). |
| Paginación «Mostrar [5/10/15] registros · Página X de Y · « Anterior / Siguiente »», 10 por defecto | La misma, dentro de `DataTablePnipComponent`. |
| Filtro de fechas comparando solo `aaaa-mm-dd` | `estaEnRangoFechas()`. |
| Pestañas «Formularios recibidos» / «No han llenado formulario» | `TabsPnipComponent` (el host usa dos botones sueltos). |
| Fecha con `toLocaleDateString('es-EC', …)` y hora | `FechaLargaPipe`. |

Lo construido nuevo, sin equivalente en el host:
- modal con el formulario completo;
- fila desplegable con los familiares declarados;
- filtros combinados sin distinguir tildes;
- estado vacío con «Limpiar filtros»;
- confirmación visual de Exportar y Descargar PDF;
- recordatorios con estado «Enviado ✓».

### Paso 1 — Componentes compartidos nuevos

| Componente | Decisión |
|---|---|
| `DataTablePnipComponent` | Las celdas se escriben en plantillas (`<ng-template pnipFila>`, `<ng-template pnipDetalle>`), no en una configuración de columnas. Las directivas reciben la lista (`[pnipFilaDe]`) solo para que `strictTemplates` conozca el tipo de la fila. La tabla guarda qué filas están desplegadas (por `claveFila`) y pasa a la plantilla `expandida`, `alternar()` e `idDetalle` (para `aria-controls`). Vuelve a la página 1 cuando cambian las filas, por ejemplo al filtrar. |
| `ExpandArrowButtonPnipComponent` | `aria-expanded`, `aria-label` «Mostrar/Ocultar …» y `aria-controls` opcional. La flecha rota 180°. |
| `EmptyStatePnipComponent` | Ícono, texto y botón opcional, con `role="status"`. |
| `TabsPnipComponent` | Creado hoy, porque ya hay pantalla que lo usa (decisión del Día 3). Usa `tablist`/`tab`, `aria-selected`, *roving tabindex* y flechas, Inicio y Fin. La pantalla pinta los paneles con `role="tabpanel"`. Los dos paneles se renderizan y el inactivo se oculta con `hidden`, para que el contador de «No han llenado formulario (n)» se conozca sin abrir la pestaña. Admite `atenuada` para los planes cerrados de los días 7-8. |
| `IconoPnipComponent` | **No se agregó una librería de íconos.** El Día 3 no se eligió ninguna (solo SVG en línea), y la app host también dibuja sus íconos como SVG en línea estilo Feather. Se usan trazos de Lucide/Feather (licencia ISC/MIT) en un componente, sin dependencias. |

### Pasos 2 y 3 — Pantallas

- **Formularios › Conflicto de Interés.** La pestaña «No han llenado» es un
  subcomponente propio (`PestanaSinFormularioComponent`). El modal usa
  `DetalleFormularioComponent`, y la tabla de familiares
  (`TablaFamiliaresComponent`) se reutiliza en la fila desplegada y en el
  modal. Así cada archivo queda pequeño, como pide `CONVENTIONS.md`.
- **Formularios › Excusas.** Mismo patrón. La flecha despliega el motivo y
  el reemplazo designado; el modal (`DetalleExcusaComponent`) muestra todos
  los campos.
- **Filtros.** Funciones puras en `core/utils/filtros-listados.util.ts`
  (`filtrarFormularios`, `filtrarExcusas`), probadas aparte. Todos los
  filtros se combinan. La búsqueda de texto no distingue mayúsculas ni
  tildes, y en formularios también busca en los nombres de los familiares
  declarados.
- **Exportar y Descargar PDF.** Solo muestran «Exportado ✓» o «PDF
  descargado ✓» durante 2 s (`ConfirmacionTemporal`), sin generar archivos.
- **Recordatorios.**
  - `FormulariosMockService.enviarRecordatorio()` guarda la fecha en
    memoria; no hay llamada real.
  - Cada fila pasa a «Enviado ✓» y la columna «Recordatorio» muestra la
    fecha del envío.
  - «Enviar recordatorio a todos» se aplica a toda la lista de esa pestaña,
    que no tiene filtros.
- **Botones de acciones ya hechas.** Usan `aria-disabled`, no `disabled`,
  para no perder el foco (regla añadida a `CONVENTIONS.md`).
- **Nombre en MAYÚSCULAS con apellidos primero** (`NombreFormalPipe`, no
  existía un pipe equivalente).
  - Los datos traen el nombre completo en un solo campo, así que se asume
    que las dos últimas palabras son los apellidos.
  - Las partículas (`de`, `del`, `la`…) se unen a la palabra siguiente para
    no partir apellidos compuestos.
  - **Pendiente:** si el backend envía nombres y apellidos por separado,
    usarlos.
- **Modelo nuevo `EmpleadoSinFormulario`** (persona + origen + fecha del
  último recordatorio). `Persona` no tiene esos datos. Se añadió un
  externo de ejemplo que no está en `PERSONAS`.
- El botón «Generar análisis de conflictos» es un enlace (`routerLink`),
  porque por ahora solo navega. La lógica real llega el Día 5.

### Catálogos PROVISIONALES (pendientes de confirmar con backend)

Viven en `core/services/mock-data/catalogos.data.ts` y se sirven con
`CatalogosMockService`.

| Catálogo | Valores | Por qué es provisional |
|---|---|---|
| Tipo de contrato | Ocasional, Permanente, Servicios ocasionales LOEP, Nombramientos provisionales LOEP | La app host usa el catálogo de modalidades de nómina por régimen, que tiene muchos más valores. Hay que decidir cuál usa PNIP-CI. |
| Tipo de proceso (excusas) | Proceso de selección, Proceso de compra, Evaluación de desempeño | La especificación dice que los campos exactos del formulario de excusa están por confirmar. |

Los datos de ejemplo de formularios y excusas se ajustaron a estos
catálogos. Un spec lo comprueba.

### Pruebas y verificación

- **Módulo: 147 de 147 correctas**, en dos ejecuciones seguidas.
  - Specs nuevos: DataTable (paginación, cambio de tamaño, vuelta a la
    página 1, detalle, variante navy, vacío), ExpandArrow, EmptyState, Tabs
    (ARIA y teclado), filtros combinados, texto, rango de fechas,
    `ConfirmacionTemporal`, `NombreFormalPipe`, las dos pantallas completas
    y la coherencia de los mocks con los catálogos.
- **Builds de development y production:** sin errores. Solo queda el aviso
  preexistente del presupuesto de estilos de `conflict-form`.
- **Verificación visual** (usuario `R`, Edge headless, eventos reales):
  - **Convivencia con el host:** cabecera (64 px) y pie visibles, sin menú de
    íconos ni vitrina. Sidebar y topbar empiezan justo bajo la cabecera y, al
    final de la página, la marca sigue visible con el pie a la vista.
  - **Formularios recibidos:**
    - 6 filas con nombre formal.
    - Filtros combinados: Interno → 5, + Permanente → 2, + «freire» → 1,
      + Externo → 0; «Limpiar filtros» → 6.
    - Exportar → «Exportado ✓» y vuelve a su texto a los 2 s.
    - La flecha despliega los familiares; el 👁 abre el modal con
      «Descargar PDF ✓», y se cierra con Esc.
  - **No han llenado (5):** «Nunca» en 3; enviar una fila → «Enviado ✓» con
    la fecha de hoy; enviar a todos → «Enviado a todos ✓» y ya ningún
    «Nunca».
  - **Excusas:** 4 filas; «Proceso de compra» → 2, + Externo → 1. La flecha
    muestra motivo y reemplazo; el 👁 abre el modal.
  - **Modo oscuro y cerrar sesión:** ver Paso 0.2.
- **Servidor de desarrollo:** había un `node` escuchando en el puerto 4200
  que no se lanzó en esta sesión (posiblemente un `ng serve` de Elvis). No
  se tocó; la verificación usó el puerto 4300.

---

## Integración en el layout y menú reales (30/09/2026)

**Cambio de arquitectura confirmado por Elvis.** Las pantallas de
Formularios ya existen, están conectadas a datos reales y no se tocan. El
módulo deja de tener shell propio: sus pantallas viven dentro del layout
real de la app y se llega a ellas desde el menú lateral real, ampliado.

La exploración previa está en `docs/pnip-ci/INFORME_MENU_REAL.md`.
Hallazgos clave:
- el menú de íconos solo lo pinta `AdminComponent`, en `/admin`;
- sus 3 opciones no son rutas: dos son vistas internas de `/admin` y la
  tercera, una descarga.

Elvis eligió:
- que `AppComponent` pinte el menú en `/pnip/**`;
- que `AdminComponent` lea `?vista=formulario`.

### Qué se retiró (borrado, recuperable desde git)

| Retirado | Por qué |
|---|---|
| Shell propio (`PnipCiShellComponent`), `LayoutPnipComponent`, sidebar oscuro (`SidebarPnipComponent`), barra superior (`TopbarPnipComponent` y sus migas de pan) y `NotificationBellPnipComponent` (días 1, 3 y 4) | El módulo vive en el layout del host: su cabecera, su pie y su menú. |
| Pantallas mock «Formularios › Conflicto de Interés» y «Formularios › Excusas» del Día 4, con sus subcomponentes, rutas y specs | Las pantallas reales ya existen fuera del módulo, en `AdminComponent`. |
| Datos `breadcrumb` y `menu` en las rutas | Los usaban la barra superior y el layout retirados. |

Se conservan:
- los componentes compartidos genéricos: Badge, KpiCard, Modal, Pills,
  DataTable, ExpandArrowButton, EmptyState, Tabs e Icono;
- los pipes, los modelos y los servicios mock;
- las utilidades y los datos de ejemplo del Día 4 (filtros de listados,
  catálogos, `EmpleadoSinFormulario`);
- `rolGuard` y `RolPnipCiService`;
- la lógica de ítem activo del sidebar retirado, que se movió a
  `core/utils/menu.util.ts` y ahora la usa el menú real.

En `RolPnipCiService`, `obtenerEtiquetaRol()`, `obtenerNombreUsuario()` y
`obtenerIniciales()` quedaron sin uso (eran para el pie del sidebar
retirado). No se borraron.

### Cómo quedó

**Rutas (`pnip-ci.routes.ts`):**
- Sin shell ni layout.
- `rrhh` y `responsable` son grupos sin componente que solo aplican
  `rolGuard`.
- Cada pantalla se monta en el `<router-outlet>` de `AppComponent`.
- Las URLs no cambiaron.

**Estilos del módulo:**
- Como ya no hay un contenedor común, cada pantalla aplica en su propio
  `:host` la base de `styles/_pantalla.scss`: tokens, Barlow y márgenes.
- Siguen sin afectar a la cabecera, el pie, el menú ni las pantallas del
  host.

**Layout (`AppComponent`):** en `/pnip/**` pinta el `<app-sidebar-menu>` del
host junto al contenido, con el mismo acomodo que en `/admin`: sticky bajo
la cabecera de 64 px y contenido flexible. En el resto de rutas el DOM no
cambia. Son unas líneas en `app.component.{ts,html,scss}`, marcadas
«PNIP-CI».

**Menú real (`src/app/sidebar-menu`):** mismo estilo del host (tarjeta
blanca, tokens `--ci-*`, íconos en caja), sin tokens ni fuente del módulo.

- **RRHH (`R`/`A`):**
  - Dashboard
  - Formularios ▸, con los 3 botones de siempre
  - Conflicto ▸ (Análisis de Conflictos, Consulta Previa)
  - Informe General
  - Revisión de Evidencias
  - Historial
- **Sin R/A:** Dashboard y Bandeja de Tareas.
- **Rol:** sale de `AuthService.hasRole()`, como en `rolGuard`.
- **Grupos:**
  - Chevron que gira al desplegar.
  - Se abren solos si contienen la opción activa (en `/admin`, siempre
    «Formularios»).
  - Con el menú colapsado se ven como íconos en columna.
- **Ítem activo:** por prefijo de URL; Plan de Acción resalta «Conflicto ›
  Análisis de Conflictos».
- Los ítems del módulo se declaran en `pnip-ci.menus.ts`.

**Los 3 botones de Formularios:**
- **Dentro de `/admin`** emiten sus eventos como siempre y `AdminComponent`
  hace exactamente lo mismo que antes.
- **Fuera de `/admin`** nadie escucha esos eventos (el menú lo comprueba con
  `EventEmitter.observed`), así que:
  - «Formulario de conflicto de interés» → `/admin?vista=formulario`;
  - «Formulario de excusa» → descarga el mismo PDF que `AdminComponent`;
  - «Ver Formularios» → `/admin`.

**`AdminComponent`:** único cambio, 5 líneas añadidas (un comentario y un
`if`) en la suscripción a `queryParamMap`, con el mismo patrón que
`?abrirCodigo`: `?vista=formulario` abre la vista del formulario. Su HTML y
su SCSS no cambian.

### Verificación

- **Pantallas de Formularios, comparadas con `70fb6d0` (commit anterior a
  hoy):** 0 líneas cambiadas en `conflict-form/`, `mis-formularios/`,
  `admin.component.html`, `admin.component.scss`, `login/`, `header/`,
  `footer/`, los modales, `backend.service.ts`, `conflicto-pdf.service.ts`,
  `guards/` y `app.routes.ts`. En `admin.component.ts`, solo las 5 líneas
  añadidas de `?vista=formulario`.
- **Pruebas:**
  - Módulo + menú: 134 de 134 correctas.
  - `ng test` completo: solo los 3 fallos preexistentes de
    `app.component.spec.ts`.
  - Specs nuevos: `menu.util.spec.ts` (ítem activo) y
    `sidebar-menu.component.spec.ts` (menú por rol, orden, los 3 botones
    emitiendo dentro de `/admin` y sus equivalentes fuera).
- **Build de producción:** sin errores.
- **Edge headless con sesión simulada** (backend real y descargas
  interceptados):
  - **`R` en `/pnip/rrhh/dashboard`:** cabecera y pie del host, un solo
    menú, con los ítems y grupos esperados.
  - **Cada ítem nuevo** navega a su pantalla y queda resaltado.
  - **Plan de Acción** resalta «Conflicto › Análisis de Conflictos».
  - **Formularios desde `/pnip`:**
    - Excusa → descarga `/sisci/assets/FORMULARIO_DE_EXCUSAS_EV_EEASA.pdf`.
    - Conflicto → `/admin` con el formulario abierto.
    - «Ver Formularios» → la lista.
  - **Dentro de `/admin`, igual que antes:** abre la lista; los 3 botones
    hacen lo de siempre. Desde ahí también se llega a las pantallas nuevas.
  - **`I` (sin R/A):** menú con Dashboard y Bandeja de Tareas; el detalle
    de un plan resalta Bandeja.
  - **`E`:** va a `/` (formulario), sin menú, como siempre.
  - **`/mis-formularios`:** sin menú, como siempre.

### Pendiente / a tener en cuenta

- **Un empleado sin R/A no tiene cómo llegar a `/pnip/responsable/**`
  desde la app:** su pantalla de inicio es `/` (el formulario), que no tiene
  menú. Hay que decidir el acceso, por ejemplo un ícono en la cabecera o que
  su menú también se muestre en `/`.
- **`?vista=formulario` desaparece de la URL enseguida.** No lo hace nuestro
  código: al iniciarse, `ConflictFormComponent` hace
  `router.navigate(['/admin'])` si el usuario es A/R. Es comportamiento
  preexistente y pasa igual al abrirlo desde dentro de `/admin`. Como es la
  misma ruta, `AdminComponent` no se recrea y el formulario sigue visible.
  El resultado es idéntico a pulsar el botón dentro de `/admin`, y al
  recargar se abre la lista, como siempre. Verificado con una traza de
  `pushState`.
- **Sin campana de notificaciones:** se retiró con la barra superior propia
  y la cabecera del host no tiene una (ver `INFORME_MENU_REAL.md`, punto 5).
  `NotificacionesMockService` y `TiempoRelativoPipe` se conservan.

## Integración a la estructura del proyecto (01/10/2026)

- `src/app/pnip-ci/` se repartió en la estructura del proyecto con `git mv`
  (115 renombres detectados por git): `models/`, `services/`, `guards/`,
  `utils/`, `pipes/`, `shared/`, una carpeta por pantalla y `src/styles/`.
- Las URLs perdieron el prefijo `/pnip`: ahora son `/rrhh/**` y
  `/responsable/**`. Las rutas están en `app.routes.ts` y sus paths, en un
  solo lugar: `app.paths.ts`.
- `AppComponent` acepta esas rutas con `esRutaPermitida()` (las de
  `RUTAS_PERMITIDAS` más los prefijos de gestión), en lugar de salidas
  tempranas.
- Claves de desarrollo renombradas a `SISCI-DEV-*`.
- Commits: `refactor: integra el módulo…` (movimientos y renombres con la
  indentación original) y `style: …` (solo el cambio a 2 espacios).

## Rol P, cabecera, campana y selector de rol (01–02/10/2026)

### Información confirmada

- Roles: `A` (Administrador), `R` (Jefe de RRHH) y el nuevo `P`
  (Responsable), que el backend asignará a quien reciba actividades en un
  plan de acción. `A` tiene todo lo de `R` y además gestiona roles.
- Un usuario puede tener varios roles a la vez (por ejemplo `R` y `P`).
- Se pueden editar archivos del host sin cambiar su lógica ni su diseño,
  marcando cada cambio.
- Para probar como `A`/`R`/`P` se usa siempre la sesión simulada: el login
  real de RRHH/Admin redirige a la intranet y no vuelve a `localhost`
  (limitación conocida del SSO).

### Decisiones

- **Marcadores** (`CONVENCIONES.md`, «Cambios en archivos del host»):
  `[PNIP-CI] Elvis Flores - fecha` / `Qué hace:` / `[FIN PNIP-CI]`, y
  `[PNIP-CI DEV] … ELIMINAR ANTES DE PRODUCCIÓN` para lo que solo existe en
  desarrollo. Se uniformaron todos los marcadores anteriores.
- **Rol P:** `RolGestion = 'rrhh' | 'responsable'`. `/responsable/**` exige
  `P`; desaparece la regla anterior «cualquier empleado no externo puede
  ser responsable» (y `esEmpleado()`). Pantalla de inicio: `R`/`A` →
  `/rrhh/dashboard`; solo `P` → `/responsable/dashboard`; ninguno → `/`.
  Etiqueta del rol: el de mayor nivel (A > R > P).
- **Menú lateral:** `R`/`A` → menú de RRHH; solo `P` → Dashboard y Bandeja
  de Tareas; `R`/`A` + `P` → menú de RRHH más «Mis actividades»
  (`obtenerMenu()` en `menu-items.ts`).
- **Cabecera:** nombre y rol del usuario (se ocultan bajo 1280 px para que
  el título no pase a dos líneas); «Generar código» y «Gestionar Jefes de
  RRHH» también en `/rrhh/**` y `/responsable/**`. Fuera de `/admin`,
  «Generar código» exige `A` o `R`: antes su única condición era estar en
  `/admin`, a donde solo llegan `A`/`R`, así que la regla de rol efectiva no
  cambia. Ícono «Mis actividades de conflicto de interés» para `P`.
- **Campana:** se recuperó del historial el componente del shell retirado y
  se adaptó al estilo de la cabecera (`shared/notification-bell`). Visible
  para `A`, `R` y `P`. Resuelve el pendiente «Sin campana de
  notificaciones» de la sección del 30/09.
- **Acceso del Responsable:** el ícono de la cabecera resuelve el pendiente
  «Un empleado sin R/A no tiene cómo llegar a responsable» del 30/09 (ahora
  es el rol `P`).
- **Selector de rol de desarrollo:** panel flotante con A, R, P, R+P y
  «Salir de la simulación» (`src/app/dev/`, todo `[PNIP-CI DEV]`).

### Verificación (02/10/2026, sesión simulada, Edge headless)

| Caso | Resultado |
|---|---|
| `A` | Menú RRHH; cabecera con nombre, «Administrador», campana y 5 íconos (generar código, gestionar roles, mis declaraciones, modo oscuro, cerrar sesión), también en `/rrhh/**`. `/responsable/**` → `/rrhh/dashboard`. |
| `R` | Igual que `A` sin «Gestionar Jefes de RRHH»; rol «Jefe de RRHH». |
| `P` | Entra al formulario (`/`), con el ícono «Mis actividades» y la campana. En `/responsable/**` ve su menú de 2 opciones. `/rrhh/**` → `/responsable/dashboard`; `/admin` → `/`. |
| `R,P` | Menú RRHH con «Mis actividades»; entra a `/rrhh/**` y a `/responsable/**`. |
| `I` (sin roles) | Sin campana ni ícono; `/rrhh/**` y `/responsable/**` → `/`. |
| `E` | Igual que antes: formulario y «Mis declaraciones»; sin campana ni menú. |
| Campana | Panel de 410 px, 8 notificaciones de los últimos 7 días, contador 5; se cierra con Esc y con clic afuera; se ve bien en modo oscuro. |
| Selector de rol | Cambiar a `R+P` y a `P` recarga con el rol nuevo; «Salir» borra las claves y lleva a `/login`. |

### Pendiente / a tener en cuenta

- **Pendiente con backend:** quién asigna el rol `P` y si el modal
  «Gestión de Roles» debe gestionarlo. No se le agregó una sección.
- **`obtenerValidacionUsuario`** (corrección del 30/09 en `auth.service.ts`,
  commit `fix(auth)` aparte) no lleva marcadores `[PNIP-CI]`: no es parte de
  la gestión de conflictos. Hay que decidir si se marca.
- **Cabecera en móvil:** ya se desbordaba antes de estos cambios (título
  largo más íconos); la campana suma un ícono más. No se tocó el diseño
  del host.
- **Modo oscuro de la cabecera:** la regla preexistente
  `body.dark-mode .app-header` no se aplica por el encapsulamiento de
  estilos de Angular, así que la cabecera sigue azul en modo oscuro.
  Preexistente; no se tocó.
