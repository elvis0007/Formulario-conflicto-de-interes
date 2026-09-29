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
| Tipo `RolPnipCi` | Nuevo, en `core/models/rol-pnip-ci.ts` (`'rrhh' \| 'responsable'`) | Hacía falta un tipo para el guard y el servicio. |
| Placeholders | Plantilla inline (`template: '<h2>…</h2>'`) | Son temporales; cuando se construya cada pantalla pasará a `templateUrl` + `styleUrl` como el resto del proyecto. |
| Selectores | Prefijo `app-pnip-` | `angular.json` define el prefijo `app`. |

### Rol y guard (pendiente de confirmar con backend)

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
