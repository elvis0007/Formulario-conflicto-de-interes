# Desarrollo local sin intranet: sesión simulada

Permite abrir la app (la declaración y las pantallas de gestión de
conflictos) en una máquina de desarrollo sin
token de intranet ni acceso a la red de la empresa.

- **Apagada por defecto.** Si no se activa a mano, la app se comporta
  exactamente igual que siempre: valida el token real de intranet o manda a
  `/login`.
- **Nunca actúa en producción.** Si `environment.production` es `true`, el
  bloque de `app.config.ts` ni siquiera entra, y el método de `AuthService`
  sale en la primera línea.

## Activar

En la consola del navegador (F12), con la app abierta en `ng serve`:

```js
// Activar
localStorage.setItem('SISCI-DEV-SESION-SIMULADA', 'true');
localStorage.setItem('SISCI-DEV-ROL', 'R'); // o 'A' o 'E'
// recargar la página
```

`SISCI-DEV-ROL` es opcional: si falta, se usa `'R'` (Jefe de RRHH).

Esta es **la única forma de simular un rol** en toda la app. `authGuard`,
`rolGuard` y `PerfilUsuarioService` consultan siempre
`AuthService.hasRole()`, y la sesión simulada llena exactamente ese dato.

### Qué ve cada rol en las pantallas de gestión de conflictos

Se ven dentro del layout de la app: cabecera, pie y el menú lateral «MENÚ»
de siempre, ampliado. `/rrhh` y `/responsable` a secas llevan al dashboard
de su grupo.

| `SISCI-DEV-ROL` | `/rrhh/**` | `/responsable/**` | Menú lateral |
|---|---|---|---|
| `R` (Jefe de RRHH) | Entra | Entra | Dashboard, Formularios ▸, Conflicto ▸, Informe General, Revisión de Evidencias, Historial |
| `A` (Administrador) | Entra | Entra | Igual que `R` |
| `E` (externo) | Bloqueado → `/` | Bloqueado → `/` (un externo no es empleado) | Ninguno (en `/` no hay menú, como siempre) |
| Otro, p. ej. `I` (empleado sin R/A) | Bloqueado → `/responsable/dashboard` | Entra | Dashboard, Bandeja de Tareas |

### Qué actividades ve el Responsable

Es otro concepto: no es un rol, sino **qué empleado** está usando la app. En
desarrollo se elige con `SISCI-DEV-EMPLEADO`; por defecto es
`EMP-010`, de los datos de ejemplo:

```js
localStorage.setItem('SISCI-DEV-EMPLEADO', 'EMP-001');
```

## Desactivar

```js
// Desactivar
localStorage.removeItem('SISCI-DEV-SESION-SIMULADA');
localStorage.removeItem('SISCI-DEV-ROL');
// recargar la página
```

La sesión simulada **no escribe nada** en `localStorage`, ni tokens ni
usuario: vive solo en memoria mientras la página está abierta. Al quitar la
bandera y recargar, no queda ningún rastro que haya que limpiar.

## Qué hace exactamente

`isAuthenticated()` y `hasRole()` de `AuthService` leen hoy tres signals
internos, que el login real llena a partir de la respuesta del backend:

| Signal | Qué comprueba | Qué pone la simulación |
|---|---|---|
| `_tokenSistec` / `_tokenIntranet` | `isAuthenticated()`: ¿hay algún token? | `_tokenSistec = 'TOKEN-DEV-SIMULADO'` |
| `_usuario` | `isAuthenticated()`: ¿hay usuario? También lo leen `usuario()` y `getCurrentUser()` | Usuario ficticio «Usuario Desarrollo», cédula `0000000000` |
| `_roles` | `hasRole(x)` | `[rol]`, calculado con el mismo `actualizarRolesDesdeUsuario()` del login real |

Paso a paso al cargar la app (`provideAppInitializer` en `app.config.ts`):

- **Con `SISCI-DEV-SESION-SIMULADA = 'true'` y sin producción:**
  1. Se llama a `activarSesionSimuladaDev(rol)`, que llena los tres signals.
  2. Se devuelve `true` sin ejecutar nada de lo de abajo: no se lee el
     token de URL, cookie ni `localStorage` y no se llama a
     `getUsuarioIntranet`.
  3. Guards y componentes ven una sesión válida con ese rol.
- **Sin la bandera, o con cualquier otro valor (`'false'`, vacío…):** la
  condición es falsa y se ejecuta la lógica real, que no cambió:
  1. Busca el token de intranet en la URL, la cookie o `localStorage`.
  2. Si lo encuentra, lo valida contra el backend.
  3. Si no hay ninguna sesión, manda a `/login`.

### Cambios de URL sin recargar (corregido el 30/09/2026)

El initializer solo corre al **cargar** la página. En la primera versión
había dos casos en que la sesión simulada faltaba y `rolGuard` mandaba a
`/login`:

1. Se ponía la bandera con la app ya abierta y se escribía en la barra una
   URL que solo cambia lo que va tras el `#`. El navegador **no recarga** en
   ese caso.
2. Se pasaba por `/login`. Su `authGuard` llama a `logout()`, que es la
   lógica real e intencional: «ir al login cierra la sesión». Eso borraba
   la sesión simulada, y al volver a `/rrhh` sin recargar ya no había
   sesión.

Ningún guard del host revisa otra condición: todos usan
`isAuthenticated()`. Lo que faltaba era volver a activar la simulación.
Ahora el mismo bloque registra, **solo fuera de producción**, un listener de
`popstate`/`hashchange`. Ese listener reactiva la sesión simulada en cada
cambio de URL, **solo si** la bandera está en `'true'` **y** no hay ninguna
sesión (una sesión real no se toca). Se registra antes que los listeners del
Router y de `AppComponent`, así que actúa antes que los guards.

Por eso, a partir de ahora, **no hace falta recargar para activar** la
simulación. **Para desactivarla sí hay que recargar**: la sesión que ya está
en memoria sigue viva hasta la recarga.

### Limitaciones mientras está activa

- Las llamadas al backend real salen **sin token válido**: el interceptor
  lee `TOKEN-SISTEC` de `localStorage`, y la simulación no lo escribe. Las
  pantallas del host que consultan el backend (por ejemplo `/admin`) darán
  error.
- Las pantallas de gestión de conflictos usan datos simulados y funcionan
  con normalidad.
- El código del bloque **sí está** en el JavaScript del build de producción:
  el optimizador no lo elimina. No se ejecuta nunca, porque ahí
  `environment.production` es `true`.

## Dónde está el código (para retirarlo)

Todo lo que existe solo para desarrollo está marcado con `[PNIP-CI DEV]`
(ver [CONVENCIONES.md](CONVENCIONES.md#cambios-en-archivos-del-host)).
Busca `[PNIP-CI DEV]` en todo el proyecto: cada bloque empieza con
`// [PNIP-CI DEV] Elvis Flores - dd/mm/aaaa - ELIMINAR ANTES DE PRODUCCIÓN`
y termina con `// [FIN PNIP-CI DEV]`. Hoy son:

| # | Archivo | Dónde | Qué hay |
|---|---|---|---|
| 1 | `src/app/services/auth.service.ts` | Clase `AuthService`, al final, después de `logout()` | Método `activarSesionSimuladaDev(rol)` |
| 2 | `src/app/app.config.ts` | Dentro del callback de `provideAppInitializer`, justo después de `const router = inject(Router);` | El listener `reactivarSesionSimuladaDev` (cambios de URL sin recarga) y el `if` que activa la simulación al cargar y devuelve `true` |
| 2b | `src/app/app.config.ts` | Imports del principio | `import { environment } …`, que solo usa el bloque 2. Se borra junto con él |

Para retirarlo, borra esos bloques completos, marcadores incluidos: nada
más en el proyecto depende de ellos.

## Verificación hecha (Edge headless, 30/09/2026 y 01/10/2026)

Las peticiones al backend real se interceptaron en el navegador de prueba:
quedó registrado el intento, pero no salieron a la red.

| Escenario | Resultado |
|---|---|
| **Producción** + ambas claves + un `TOKEN-INTRANET` | Bandera ignorada: intentó la validación real (`getUsuarioIntranet`), falló, cerró sesión y fue a `/login`. Sin el aviso de sesión simulada. |
| **Producción** + ambas claves, sin token | Bandera ignorada: fue a `/login` sin llamar al backend. |
| Desarrollo + bandera `true` + `R` | Entró directo a `/rrhh/dashboard` como «Usuario Desarrollo · Jefe de RRHH». Sin `/login` y sin llamadas al backend. |
| Desarrollo + bandera `true` + `A` | `/admin` abre como administrador (sus llamadas al backend fallan, como se espera). |
| Desarrollo + bandera `true`, sin `ROL-DEV` | Usa `R`. |
| Desarrollo sin bandera, o bandera `false`, sin token | `/login`, igual que antes del cambio. |
| Desarrollo sin bandera, o bandera `false`, con `TOKEN-INTRANET` | Validación real contra `getUsuarioIntranet`, igual que antes del cambio. |
| Desarrollo: app abierta en `/login`, se pone la bandera y se escribe `#/rrhh/dashboard` sin recargar | **Antes:** `/login`. **Ahora:** entra al dashboard. |
| Desarrollo: sesión simulada activa, se pasa por `/login` y luego se escribe `#/rrhh/...` sin recargar | **Antes:** `/login`. **Ahora:** entra al dashboard. |
| Desarrollo sin bandera: en `/login` se escribe `#/rrhh/...` sin recargar | `/login`, igual que antes (el listener no actúa sin bandera). |
| **Producción**, los mismos casos anteriores | Siempre `/login`: la bandera y el listener se ignoran. |
| Roles en gestión de conflictos (sesión simulada) | `R` y `A` entran a RRHH. `E` queda bloqueado en RRHH y en Responsable, y va a `/`, aunque tenga guardada la clave antigua `PNIP-CI-ROL-SIMULADO=rrhh`. `I` entra solo a Responsable. |
| URLs nuevas (01/10/2026), con recarga y sin ella | `R` y `A` entran a las 7 pantallas de `/rrhh/**` y a las 3 de `/responsable/**`. `I` entra a `/responsable/**` y desde `/rrhh/**` va a `/responsable/dashboard`. `E` va a `/` desde ambas. `/rrhh` y `/responsable` llevan al dashboard de su grupo. Sin sesión, todas van a `/login`. |
| URL vieja `/pnip/rrhh/dashboard` (01/10/2026) | Ya no abre ninguna pantalla de gestión: cae en `**` y la app la lleva a `/admin` (`R`/`A`) o a `/` (`I`/`E`), igual que cualquier URL desconocida. |
| `/`, `/login`, `/admin`, `/mis-formularios` (01/10/2026) | Igual que antes para los 4 roles: `R`/`A` van a `/admin`; `I`/`E` a `/`; `/mis-formularios` abre para todos. |
