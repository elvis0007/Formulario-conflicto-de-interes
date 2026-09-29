# Convenciones del módulo PNIP-CI

Adaptación del *Manual de estándares de programación* de EEASA
(rev. 11-12-2019) a Angular/TypeScript. Aplica **solo** dentro de
`src/app/pnip-ci/`; el resto del proyecto conserva su estilo actual.

## Documentación

- Comentario TSDoc (`/** ... */`) en cada clase, componente, servicio,
  guard, interfaz, tipo y método o función pública.
- Etiquetas: `@param nombre descripción`, `@returns descripción` y
  `@author EEASA` en clases, componentes, servicios, guards e interfaces.
- En interfaces, documentar cada propiedad cuyo significado no sea evidente
  por su nombre (formatos de fecha, unidades, de dónde sale el valor…).
- Comentarios en español. Explican el *por qué*, no repiten el código.

## Nomenclatura

| Elemento | Estilo | Ejemplo |
|---|---|---|
| Clases, componentes, interfaces, tipos | PascalCase | `AnalisisConflictoComponent`, `PlanAccion`, `EstadoPlan` |
| Métodos, funciones, variables, propiedades | camelCase | `obtenerRol()`, `fechaLimite` |
| Constantes (valores fijos de módulo) | MAYÚSCULAS con `_` | `const RIESGO_ALTO = 'alto';`, `PNIP_CI_ROUTES` |
| Archivos y carpetas | kebab-case | `analisis-conflicto.component.ts` |
| Selectores de componentes | prefijo `app-pnip-` | `app-pnip-rrhh-dashboard` |

- Nunca empezar un nombre con `_` ni con `$`.
- Nombres cortos y descriptivos, en español (salvo sufijos de Angular:
  `Component`, `Service`, `Guard`).
- Las interfaces de dominio del módulo **no** llevan prefijo `I`
  (`Persona`, no `IPersona`).

## Visibilidad

- Atributos de clases y servicios `private` por defecto (y `readonly`
  cuando no se reasignan).
- Solo es `public` lo que la plantilla u otras clases necesitan usar.

## Formato

- Indentación de **4 espacios** (hay un `.editorconfig` en esta carpeta que
  lo aplica solo al módulo).
- Máximo ~80 caracteres por línea cuando sea razonable.
- Una sentencia por línea.
- Comillas simples en TypeScript.

## Tamaño de archivos

- Ningún archivo supera las 2000 líneas. En la práctica, un componente de
  este módulo debe ser **mucho** más pequeño: si crece demasiado, se divide
  en subcomponentes (en `shared/components/` si se reutilizan, o junto a la
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

## Estructura del módulo

```
pnip-ci/
├── CONVENTIONS.md
├── pnip-ci.constants.ts   constantes que usa la app principal
├── pnip-ci.routes.ts      rutas (carga diferida)
├── core/
│   ├── guards/            guards funcionales (CanActivateFn)
│   ├── services/          servicios providedIn: 'root'
│   └── models/            interfaces y tipos de dominio
├── shared/components/     componentes reutilizables (incluye el shell)
├── rrhh/                  pantallas del rol RRHH
├── responsable/           pantallas del rol Responsable
└── styles/_tokens.scss    variables de diseño (solo dentro del módulo)
```

## Estilos

- Los tokens de `styles/_tokens.scss` se aplican en el `:host` del shell
  del módulo, nunca en `:root` ni en `src/styles.scss`: así no afectan al
  formulario de conflicto de interés existente.
- Los componentes usan `var(--token)` y no colores literales.
