# Convenciones del proyecto

Adaptación del *Manual de estándares de programación* de EEASA
(rev. 11-12-2019) a Angular/TypeScript. Son las reglas para **código nuevo**
en todo el proyecto. El código anterior que no las cumpla se adapta cuando
se modifique por otro motivo, no en cambios dedicados solo a eso.

Ver también [ARQUITECTURA.md](ARQUITECTURA.md) (qué hay en cada carpeta) y
[DESARROLLO_LOCAL.md](DESARROLLO_LOCAL.md) (cómo correr la app sin intranet).

## Documentación

- Comentario TSDoc (`/** ... */`) en cada clase, componente, servicio,
  guard, interfaz, tipo y método o función pública.
- Etiquetas: `@param nombre descripción`, `@returns descripción` y
  `@author` en clases, componentes, servicios, guards e interfaces.
- En interfaces, documentar cada propiedad cuyo significado no sea evidente
  por su nombre (formatos de fecha, unidades, de dónde sale el valor…).
- Comentarios en español. Explican el *por qué*, no repiten el código.
- Los cambios en archivos que ya existían antes de la gestión de conflictos
  se marcan como indica [Cambios en archivos del host](#cambios-en-archivos-del-host).

## Cambios en archivos del host

Son «archivos del host» los que ya existían antes de la gestión de
conflictos: `header`, `sidebar-menu`, `admin`, `app.component`,
`app.routes`, `app.config`, `auth.service`… Todo bloque que se agregue o
modifique en ellos va marcado así (PNIP.CI es el código del procedimiento
de gestión de conflictos de interés):

```ts
// [PNIP-CI] Elvis Flores - dd/mm/aaaa
// Qué hace: <descripción breve de lo que hace este bloque>
... código ...
// [FIN PNIP-CI]
```

Los bloques que existen **solo para desarrollo** y deben eliminarse antes
de producción usan un marcador distinto, para encontrarlos fácil:

```ts
// [PNIP-CI DEV] Elvis Flores - dd/mm/aaaa - ELIMINAR ANTES DE PRODUCCIÓN
// Qué hace: ...
// [FIN PNIP-CI DEV]
```

- En HTML se usa `<!-- ... -->` con el mismo texto; en SCSS, `//`.
- La fecha es la del último cambio del bloque.
- Los métodos nuevos llevan además su TSDoc con `@author Elvis Flores`.
- Las líneas que se quitan del host no dejan marcador; se explican en el
  `Qué hace` del bloque que las reemplaza.
- Buscar `[PNIP-CI` lista todos los cambios en el host;
  `[PNIP-CI DEV]`, solo los de desarrollo.

## Nomenclatura

| Elemento | Estilo | Ejemplo |
|---|---|---|
| Clases, componentes, interfaces, tipos | PascalCase | `AnalisisConflictoComponent`, `PlanAccion`, `EstadoPlan` |
| Métodos, funciones, variables, propiedades | camelCase | `obtenerRutaInicio()`, `fechaLimite` |
| Constantes (valores fijos de archivo) | MAYÚSCULAS con `_` | `const RIESGO_ALTO = 'alto';`, `RUTAS_PERMITIDAS` |
| Archivos y carpetas | kebab-case | `analisis-conflicto.component.ts` |
| Selectores de componentes | prefijo `app-` | `app-rrhh-dashboard`, `app-badge` |
| Selectores de directivas | prefijo `app` en camelCase | `ng-template[appFila]` |

- Nunca empezar un nombre con `_` ni con `$` (salvo los signals privados
  que ya existen en `AuthService`).
- Nombres cortos y descriptivos, en español (salvo sufijos de Angular:
  `Component`, `Service`, `Guard`, `Pipe`, `Directive`).

### Interfaces sin prefijo `I`

Las interfaces nuevas **no** llevan prefijo `I`: `Persona`, `PlanAccion`,
no `IPersona`. TypeScript no lo necesita y la guía de estilo de Angular lo
desaconseja.

`IUsuario` e `IRespuestaLogin` (`src/app/models/`) son anteriores a esta
regla y **no se renombran**: los usa el login y cambiarles el nombre no
aporta nada.

## Visibilidad

- Atributos de clases y servicios `private` por defecto (y `readonly`
  cuando no se reasignan).
- Solo es `public` lo que la plantilla u otras clases necesitan usar.

## Formato

Lo aplica el `.editorconfig` de la raíz:

- Indentación de **2 espacios**.
- Comillas simples en TypeScript.
- Máximo ~80 caracteres por línea cuando sea razonable.
- Una sentencia por línea.

## Tamaño de archivos

- Ningún archivo supera las 2000 líneas. En la práctica un componente debe
  ser **mucho** más pequeño: si crece demasiado, se divide en
  subcomponentes (en `src/app/shared/` si se reutilizan, o junto a la
  pantalla si no).

## Variables

- Declarar las variables al inicio del bloque, con valor inicial cuando sea
  posible.
- Preferir `const`; `let` solo si se reasigna. Nunca `var`.

## Manejo de errores

- Nada de errores sin capturar:
  - Código síncrono que puede fallar (`JSON.parse`, `localStorage`, …) va en
    `try/catch`.
  - Observables: `catchError` en el servicio o callback `error` en el
    `subscribe`; nunca un `subscribe` solo con `next` sobre una llamada HTTP.
- Registrar el error con `console.error('[Clase.metodo] ...', err)` y
  devolver un valor seguro o un mensaje entendible para el usuario.

## Rutas

- **Todas** las rutas están en `src/app/app.routes.ts`. Las pantallas de
  gestión de conflictos se cargan de forma diferida (`loadComponent`, una
  por pantalla).
- Los paths de esas pantallas se definen **una sola vez**, en
  `src/app/app.paths.ts` (`SEGMENTOS` para las rutas, `RUTAS` para las URLs
  absolutas). El menú, los guards, los servicios y las pruebas los importan
  de ahí; nunca se escribe una URL a mano.
- Los grupos `/rrhh` y `/responsable` aplican `rolGuard` una vez para todo
  el grupo, con `data: { rolRequerido: ... }`.

## Menú lateral

- Hay un solo menú, `src/app/sidebar-menu`. Sus opciones de gestión de
  conflictos se declaran en `sidebar-menu/menu-items.ts`. Una pantalla
  nueva que deba aparecer en el menú se añade ahí, con su ícono y su ruta
  tomada de `RUTAS`.

## Servicios de datos

- Todo método de consulta devuelve `Observable`, aunque hoy los datos sean
  simulados, y termina con `manejarError(origen, valorPorDefecto)`
  (`src/app/utils/manejar-error.ts`).
- Los componentes solo dependen de los métodos públicos del servicio: al
  cambiar un `*MockService` por la versión HTTP no se tocan.

## Pruebas

- Cada función de `src/app/utils/` y cada guard tiene su `.spec.ts` al lado.
- Las funciones que dependen de «hoy» reciben la fecha como parámetro
  opcional, para poder probarlas con una fecha fija.

## Estilos

- Los estilos de diseño de las pantallas de gestión de conflictos están en
  `src/styles/` (`_tokens.scss`, `_pantalla.scss`, `_listados.scss`). **No
  son globales**: no se incluyen en `angular.json` ni en `src/styles.scss`.
- Cada pantalla (componente de ruta) aplica la base en su `:host`:
  `@use '../../styles/pantalla';` y `:host { @include pantalla.raiz; }`,
  que da tokens, Barlow y márgenes. Así no afectan a la cabecera, el pie,
  el menú ni las pantallas de la declaración.
- Los componentes usan `var(--token)` y no colores literales.
- Para colores con significado de negocio se usa el tipo `Tono`
  (`src/app/utils/tono.util.ts`) y sus variables `--{tono}`,
  `--{tono}-fill` y `--{tono}-text` (p. ej. `--rojo-fill`). Nunca se decide
  un color de estado a mano en una pantalla: se pasa por `mapear...ATono()`.
- El significado nunca se transmite solo con color: toda insignia lleva
  texto.

## Componentes compartidos (`src/app/shared/`)

| Selector | Para qué |
|---|---|
| `app-badge` | Insignia de estado/riesgo (`tono` + `texto`). |
| `app-kpi-card` | Indicador; clicable como filtro. |
| `app-modal` | Ventana modal (X, fondo, Esc; foco atrapado). |
| `app-pills` | Filtros de un solo valor. **No** para pestañas. |
| `app-tabs` | Pestañas que controlan paneles (`role="tablist"`). |
| `app-data-table` | Tabla con paginación y filas desplegables; celdas en `<ng-template appFila>`, detalle en `<ng-template appDetalle>`, vacío en `[appVacio]`. `variante="navy"` para listados con el estilo de Formularios. |
| `app-expand-arrow-button` | Flecha para desplegar filas o secciones. |
| `app-empty-state` | Lista vacía: ícono, texto y acción opcional. |
| `app-icono` | Íconos SVG en línea (sin librería externa). |

Las pantallas de listado incluyen `@include listados.estilos;`
(`src/styles/_listados.scss`): banda azul marino, panel de filtros y
botones con el mismo aspecto que «Formularios recibidos».

## Accesibilidad de botones de acción

- Un botón que ya cumplió su acción («Exportado ✓», «Enviado ✓») se marca
  con `aria-disabled` y se ignora el clic en el código; **no** con
  `disabled`, porque un botón deshabilitado pierde el foco (y dentro de un
  modal el foco saldría de la trampa).
- Los botones solo con ícono llevan `aria-label` descriptivo.
