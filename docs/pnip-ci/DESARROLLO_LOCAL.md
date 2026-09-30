# Desarrollo local sin intranet: sesión simulada

Permite abrir la app (y el módulo PNIP-CI) en una máquina de desarrollo sin
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
localStorage.setItem('PNIP-CI-AUTH-SIMULADA', 'true');
localStorage.setItem('PNIP-CI-ROL-DEV', 'R'); // o 'A' o 'E'
// recargar la página
```

`PNIP-CI-ROL-DEV` es opcional: si falta, se usa `'R'` (Jefe de RRHH).

## Desactivar

```js
// Desactivar
localStorage.removeItem('PNIP-CI-AUTH-SIMULADA');
localStorage.removeItem('PNIP-CI-ROL-DEV');
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

- **Con `PNIP-CI-AUTH-SIMULADA = 'true'` y sin producción:**
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

### Limitaciones mientras está activa

- Las llamadas al backend real salen **sin token válido**: el interceptor
  lee `TOKEN-SISTEC` de `localStorage`, y la simulación no lo escribe. Las
  pantallas del host que consultan el backend (por ejemplo `/admin`) darán
  error.
- Las pantallas de PNIP-CI usan datos simulados y funcionan con normalidad.
- **PNIP-CI tiene además su propia simulación de rol**
  (`PNIP-CI-ROL-SIMULADO`, Día 1): en desarrollo trata a cualquiera como
  RRHH. Para ver el comportamiento real del rol elegido en
  `PNIP-CI-ROL-DEV` dentro del módulo (por ejemplo un externo `E`, o un
  empleado que solo ve la vista de Responsable), añade:
  ```js
  localStorage.setItem('PNIP-CI-ROL-SIMULADO', 'ninguno');
  ```
- El código del bloque **sí está** en el JavaScript del build de producción:
  el optimizador no lo elimina. No se ejecuta nunca, porque ahí
  `environment.production` es `true`.

## Dónde está el código (para retirarlo)

Busca `BLOQUE AGREGADO POR ELVIS` en todo el proyecto. Aparece en dos
archivos:

| # | Archivo | Dónde | Qué hay |
|---|---|---|---|
| 1 | `src/app/services/auth.service.ts` | Clase `AuthService`, al final, después de `logout()`, entre `INICIO — BLOQUE AGREGADO POR ELVIS` y `FIN — BLOQUE AGREGADO POR ELVIS` | Método `activarSesionSimuladaDev(rol)` |
| 2 | `src/app/app.config.ts` | Dentro del callback de `provideAppInitializer`, justo después de `const router = inject(Router);`, entre `INICIO` y `FIN — BLOQUE AGREGADO POR ELVIS` | El `if` que activa la simulación y devuelve `true` |
| 2b | `src/app/app.config.ts` | Imports del principio, marcado con `// BLOQUE AGREGADO POR ELVIS: import…` | `import { environment } …`, que solo usa el bloque 2. Se borra junto con él |

Para retirarlo, borra esos bloques completos, comentarios incluidos, y
listo: nada más en el proyecto depende de ellos. También puedes revertir el
commit `chore(pnip-ci): sesión simulada de desarrollo, aislada y reversible`.

## Verificación hecha (Edge headless, 30/09/2026)

Las peticiones al backend real se interceptaron en el navegador de prueba:
quedó registrado el intento, pero no salieron a la red.

| Escenario | Resultado |
|---|---|
| **Producción** + ambas claves + un `TOKEN-INTRANET` | Bandera ignorada: intentó la validación real (`getUsuarioIntranet`), falló, cerró sesión y fue a `/login`. Sin el aviso de sesión simulada. |
| **Producción** + ambas claves, sin token | Bandera ignorada: fue a `/login` sin llamar al backend. |
| Desarrollo + bandera `true` + `R` | Entró directo a `/pnip/rrhh/dashboard` como «Usuario Desarrollo · Jefe de RRHH». Sin `/login` y sin llamadas al backend. |
| Desarrollo + bandera `true` + `A` | `/admin` abre como administrador (sus llamadas al backend fallan, como se espera). |
| Desarrollo + bandera `true`, sin `ROL-DEV` | Usa `R`. |
| Desarrollo sin bandera, o bandera `false`, sin token | `/login`, igual que antes del cambio. |
| Desarrollo sin bandera, o bandera `false`, con `TOKEN-INTRANET` | Validación real contra `getUsuarioIntranet`, igual que antes del cambio. |
