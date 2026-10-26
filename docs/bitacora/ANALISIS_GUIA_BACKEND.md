# Análisis: integración con el backend que hizo el compañero

**Fecha:** 26/10/2026 · **Rama revisada:** `feature/integracion-backend`
(`38b38ae`) · **Alcance:** solo lectura. No se modificó ningún archivo
salvo este reporte, ni se hicieron commits, merge, pull, stash ni restore.

> Reemplaza la versión anterior de este archivo (de la mañana del
> 26/10), que concluía que no había guía: el commit del compañero llegó
> después, con un `pull` a las 10:17.

## Resumen

1. **Llegó un solo commit del compañero:** `38b38ae feat: Integra las
   pantallas de conflictos con el backend wssisci`, de **Sebas Constante**
   (`sebastianconstante04@hotmail.com`). Son 129 archivos (+8789 / −1250),
   traídos con `pull` en avance rápido. Sin conflictos.
2. **Ya está integrado, no es solo una guía.** Agrega servicios HTTP con
   los mismos métodos que cada mock, mapeos API → modelo con sus pruebas,
   las interfaces de la API y la elección mock/HTTP en `app.config.ts`.
   La guía es `docs/INTEGRACION_BACKEND.md`.
3. **Cambia los valores de todos los estados** a los del backend
   (MAYÚSCULAS: `ALTO`, `FIRMADO`, `ACEPTADA`, clasificación `D`/`N`/`H`…)
   y reescribe nuestras pantallas, utilidades, datos de ejemplo y pruebas
   para usarlos.
4. **Quita funciones que construimos**: «Deshacer» revisión, consultas
   recientes; el límite de archivo pasa de 10 MB a 5 MB. **Agrega otras**:
   cierre anticipado con motivo, estado de seguimiento del conflicto,
   buscador de responsables con el personal real y descarga con token.
5. **El contrato completo no está en esta máquina.** La guía remite a
   `SISCI/DOCS/DOCUMENTACION_TECNICA/PLAN_MAESTRO_MODULO_CONFLICTOS.md` y a
   un backend en SVN r4091. Las dos copias locales de `wssisci` son de
   septiembre y no tienen ningún endpoint de conflictos, así que los DTO
   solo se pueden contrastar contra las interfaces de `models/api/`.
6. **Sigue pendiente lo de antes:** la limpieza acordada de `9e80ba3` no se
   hizo y la regresión de `?vista=formulario` sigue (este commit no toca
   `admin`).
7. **Compila:** `npx tsc -p tsconfig.app.json --noEmit` termina sin
   errores. No se corrieron pruebas ni builds.

---

## Paso 1 — Estado del repositorio

### 1.1 Rama, commits y estado

- **Rama actual:** `feature/integracion-backend`, al día con su remoto.
- **`git status`:** limpio, salvo este reporte (sin seguimiento).

| Rama | Commit |
|---|---|
| `feature/integracion-backend` (actual) | `38b38ae` |
| `feature/pnip-ci` | `9e80ba3` |
| `feature/mejora-formulario` | `9e80ba3` |
| `main` | `085f47d` |

```
* 38b38ae feat: Integra las pantallas de conflictos con el backend wssisci   ← Sebas Constante
* 9e80ba3 cambios del sebas                                                  ← commit local del 08/10
* 9d099c2 feat: Dashboard de RRHH y alineación de Historial e Informe General…
* 2f7ba83 feat: Informe General, Historial y Consulta Previa
* … (días 1–11)
```

`feature/pnip-ci` y `feature/mejora-formulario` **no tienen** la
integración: siguen en `9e80ba3`.

**Repositorio vacío en la carpeta padre.** `SISCI_PRUEBAS/` tiene un `.git`
del 23/10 (`git init`, sin commits ni remoto, carpeta `gk/` de GitKraken).
No afecta al de la app, pero conviene quitarlo para no anidar
repositorios por error.

### 1.2 Cómo llegaron los cambios

| Fecha | Qué pasó |
|---|---|
| 08/10 21:10 | Commit local `9e80ba3 cambios del sebas` con los 9 archivos que estaban sin guardar. |
| 08/10 21:18 | Se agregó `origin` = `github.com/elvis0007/Formulario-conflicto-de-interes` (privado) y se subió `feature/pnip-ci`. |
| 23/10 | Se creó y subió `feature/mejora-formulario`. |
| 26/10 08:57 | `fetch`: apareció `origin/feature/integracion-backend` (aún en `9e80ba3`). |
| 26/10 09:42–10:13 | Sebas Constante crea y sube `38b38ae` sobre `9e80ba3`. |
| 26/10 10:17 | `pull origin feature/integracion-backend`: avance rápido a `38b38ae`. |

**Del compañero viene solo `38b38ae`.** Archivos nuevos (A) y
modificados (M), agrupados:

| Grupo | Archivos |
|---|---|
| Guía | A `docs/INTEGRACION_BACKEND.md` |
| Servicios HTTP (nuevos) | A `services/http/{analisis,conflictos,consulta-previa,historial,notificaciones,personas,planes}-http.service.ts` + sus `.spec.ts`; A `fuente-datos.ts`, `peticiones.ts` |
| Mapeos (nuevos) | A `services/http/mapeos/{analisis,conflicto,consulta-previa,historial,notificacion,plan,parentesco}.mapeo.ts` + specs |
| Interfaces de la API (nuevas) | A `models/api/{conflicto,consulta-previa,enums,notificacion,plan,respuesta}-api.ts`, `index.ts` |
| Pruebas | A `testing/api-ejemplos.ts`, A `services/consulta-previa-mock.service.spec.ts` |
| Configuración | M `app.config.ts` |
| Modelos | M `models/{analisis,conflicto,evidencia,plan-accion,plan-de-responsable,tipos-conflicto}.ts` |
| Mocks y datos | M `services/{analisis,consulta-previa,planes,personas}-mock.service.ts` (+ specs), M `mock-data/{conflictos,planes}.data.ts`, `mock-data.spec.ts`, `historial-mock.service.spec.ts` |
| Pantallas de gestión | M `analisis-conflicto/` (incluye `detalle-conflicto/`), `consulta-previa/`, `historial/`, `informe-general/`, `mis-planes/`, `plan-accion-detalle/`, `plan-responsable-detalle/`, `responsable-dashboard/`, `revision-evidencias/`, `rrhh-dashboard/` (ts, html, scss y spec) |
| Compartidos | M `shared/barra-avance/`, `shared/document-viewer/`, `shared/kpi-card/` |
| Utilidades | M `utils/{analisis,consulta-previa,dashboard-rrhh,documento,historial,informe,planes,responsable,revision,tono}.util.ts` (+ specs) |
| Host | M `services/auth.service.ts`, `services/backend.service.ts`, `interceptors/solicitudes.interceptor.ts`, `guards/auth.guard.ts`, `conflict-form/conflict-form.component.ts`, `manage-rrhh-modal/manage-rrhh-modal.component.ts` |

### 1.3 Conflictos sin resolver

No hay: el `pull` fue en avance rápido, no existe `MERGE_HEAD` y ningún
archivo tiene marcas `<<<<<<<` o `>>>>>>>`.

### 1.4 Los cambios que estaban sin guardar y la limpieza acordada

Siguen como quedaron el 08/10: **entraron completos en `9e80ba3`** y
`38b38ae` está construido encima. **La limpieza no se hizo:**

| Archivo | Acuerdo | Estado hoy |
|---|---|---|
| `footer` (html, scss) | Guardar | Guardado ✔ |
| `admin.component.scss` | Guardar | Guardado ✔ |
| `data-table.component.scss` | Guardar | Guardado ✔ |
| `mis-formularios.component.ts` | Guardar | Guardado ✔ |
| `admin.component.ts` | Descartar | **Sigue** ✘: falta el bloque `[PNIP-CI]` de `?vista=formulario` (regresión: el menú lateral sigue navegando a `/admin?vista=formulario`, que ya no abre el formulario) |
| `admin.component.html` | Descartar | **Sigue** ✘ |
| `conflict-form.component.html` | Descartar | **Sigue** ✘ (los internos vuelven a ver el tipo de declaración y «Final») |
| Comentarios de `auth.service.ts` | Descartar | **Siguen** ✘; `38b38ae` incluso los reescribe (`USUARIO-SISTEC` → `USUARIO-SISCI`) |

Como todo está publicado, deshacerlo pide un commit nuevo que revierta esas
partes, no reescribir la historia.

### 1.5 Qué toca de nuestro trabajo

Prácticamente todo el módulo. Por archivo o grupo:

| Archivo / grupo | Qué cambió |
|---|---|
| `app.config.ts` | Registra 7 servicios con `proveerFuente(Mock, Http)`: con sesión real se usa el HTTP; con la sesión simulada, el mock. Bloque marcado `[PNIP-CI] Integración backend - 23/10/2026`. |
| `models/tipos-conflicto.ts` | Todos los tipos pasan a los valores del backend (ver §2). Nuevos `EstadoSeguimiento` y `TipoCierre`. |
| `models/conflicto.ts` | `clasificacion` admite `null` (sin clasificar); nuevo `estado: EstadoSeguimiento`. |
| `models/plan-accion.ts` | Nuevos `tipoCierre` y `motivoCierre`. |
| `models/evidencia.ts` | Nuevo `id`; estado en MAYÚSCULAS. |
| `models/plan-de-responsable.ts` | Nuevos `nombreA`, `nombreB`, `parentesco` y `riesgo` (el rol P recibe 403 en `/conflictos`, así que el caso sale de su bandeja). |
| `models/api/*` (nuevo) | Interfaces de lo que llega del backend (MAYÚSCULAS) y de lo que se envía (camelCase). |
| `services/http/*` (nuevo) | Un servicio HTTP por mock, con los mismos métodos; utilidades comunes (`urlApi`, `datosDe`, `todasLasPaginas`, `mensajeDeError`). |
| Mocks y datos de ejemplo | Pasados a los estados nuevos. `PlanesMockService` pierde `deshacerRevision` y gana `cerrarPlan`; `ConsultaPreviaMockService` pierde `obtenerConsultasRecientes`; `PersonasMockService` gana `buscarPersonas`. |
| Pantallas de gestión | Todas adaptadas a los estados nuevos. Novedades por pantalla en §3. |
| `utils/planes.util.ts` | «Vencida» y «plan con vencidas» se calculan con la fecha límite (`estadoVistaActividad`), porque el backend no los guarda. |
| `utils/documento.util.ts` | Tope de 10 MB → **5 MB** (documento firmado y evidencias). |
| `auth.service.ts`, `solicitudes.interceptor.ts`, `auth.guard.ts`, `conflict-form.component.ts`, `manage-rrhh-modal.component.ts` | `TOKEN-SISTEC` / `USUARIO-SISTEC` → `TOKEN-SISCI` / `USUARIO-SISCI`; `generarTokenSistec` → `generarTokenSisci` («alinea con svn r4079»). Renombrado completo: no queda ningún `SISTEC` en el front. **Sin marcadores `[PNIP-CI]`** (24 + 3 + 1 + 1 + 1 líneas). Quien tenga sesión guardada con la clave vieja tendrá que volver a entrar. |
| `backend.service.ts` | Tope de «personal sin formulario»: 500 → 5000 registros. Sin marcador. |
| `shared/kpi-card` | Solo el ejemplo del TSDoc. |
| `app.routes.ts`, `app.paths.ts`, `guards/rol.guard`, `header/`, `sidebar-menu/` | Sin cambios. |
| `docs/` | Solo se agregó `INTEGRACION_BACKEND.md`. **No se actualizó** la bitácora, `ARQUITECTURA.md`, `CONVENCIONES.md` ni `DESARROLLO_LOCAL.md`. |

### 1.6 Compilación

`npx tsc -p tsconfig.app.json --noEmit` → **sin errores**. No se
corrieron `ng test` ni los builds (fuera de lo pedido).

---

## Paso 2 — La guía de integración

### 2.1 Dónde está

`docs/INTEGRACION_BACKEND.md` (100 líneas), leída completa. Remite a dos
fuentes que **no están en esta máquina**:

- Contrato de la API:
  `SISCI/DOCS/DOCUMENTACION_TECNICA/PLAN_MAESTRO_MODULO_CONFLICTOS.md`
  (§10 endpoints, §19.8–19.10). La copia SVN local `EEASA/SISCI/DOCS/`
  solo tiene los formularios `.docx` del proyecto; no hay
  `DOCUMENTACION_TECNICA/`.
- DTO de referencia: `SISCI/APP/wssisci/**/domain/dto/*.java` en **SVN
  r4091**. Las copias locales (`SISCI_PRUEBAS/APP/wssisci` y
  `SISCI/APP/wssisci`) son de septiembre y solo tienen los 7 controladores
  de entonces (auth, email, plantilla temporal, roles, rol-usuario,
  DINARDAP y SISGERH). No hay cliente `svn` instalado para comprobar la
  revisión.

### 2.2 Resumen

- **URL base y entornos:** pruebas `http://172.20.35.209:7001/wssisci`.
  Es la misma `environment.urlSeguridad` sin `/auth/`
  (`peticiones.ts → urlApi`). Producción no se menciona; sigue siendo la
  de `environment.prod.ts`.
- **Autenticación:** el JWT de siempre en `Authorization: Bearer`, puesto
  por `solicitudes.interceptor.ts`, que ahora lee `TOKEN-SISCI`. Sin
  cambios para los servicios HTTP: no ponen cabeceras propias.
- **Fuente de datos:** `services/http/fuente-datos.ts`. Sesión simulada
  activa y fuera de producción → mocks; si no → HTTP. Se decide una vez al
  cargar la app. En producción, siempre HTTP.
- **Formato de respuesta:** `{ estado: 'OK' | 'ERROR', mensaje?, datos? }`.
  Los listados van en `PaginaApi` (`DATOS`, `PAGINA_ACTUAL`,
  `TAMAÑO_PAGINA`, `TOTAL_ELEMENTOS`, `TOTAL_PAGINAS`, `ES_PRIMERA`,
  `ES_ULTIMA`) y el front pide **todas las páginas** de 200 en 200.
- **Errores:** 400, 403, 404 y 409 con `{ estado: 'ERROR', mensaje }`; el
  front muestra ese `mensaje` (`mensajeDeError`). Estado 0 → «No se pudo
  conectar con el servidor».
- **Nombres:** lo que llega va en MAYÚSCULAS con guion bajo; lo que se
  envía (cuerpos JSON y parámetros de la URL), en camelCase. Los modelos
  del front siguen en camelCase y se mapean con funciones puras.
- **Ids:** numéricos en el backend; `String(id)` al mapear, `Number(id)` o
  `encodeURIComponent` en la URL.
- **Archivos:** subida `multipart/form-data` (campo `archivo`; el
  documento firmado lleva además `metodoFirma` y `fechaFirma`, la evidencia
  `observacion`). Descarga binaria con token (`responseType: 'blob'`)
  por `GET /planes/{id}/documento` y `GET /evidencias/{id}/archivo`.
  Tope de 5 MB.
- **Reglas que pide seguir** (las aplica el backend; el front solo evita
  ofrecer lo que va a fallar):
  - `FINALIZADO` lo pone solo el sistema, al aprobar la última evidencia.
  - Clasificar `D` o `N` lleva el conflicto de `DETECTADO` a
    `EN_PLANIFICACION` en una llamada; `H` lo descarta y exige comentario.
  - Un plan abierto por conflicto; crear otro sobre un `FINALIZADO` lo
    reabre.
  - Cierre anticipado: plan `FIRMADO`, al menos una actividad vencida,
    ninguna evidencia por revisar y motivo obligatorio. Las no aceptadas
    quedan `NO_CUMPLIDA` y el conflicto vuelve a `EN_PLANIFICACION`.
  - La revisión de una evidencia es definitiva (no hay «deshacer»).
  - Quien sube una evidencia no la revisa; nadie decide sobre su propio
    conflicto (403).
  - Tras cada acción, el servicio vuelve a pedir el conflicto en vez de
    deducir el nuevo estado (el backend cambia en cascada).
- **Para probar:** salir de la sesión simulada y entrar desde la intranet
  con cuentas R y P. El backend de pruebas redirige todos los correos a
  una sola dirección, porque la base tiene personal real.

### 2.3 Endpoints

Tomados de los servicios HTTP y de los comentarios de `models/api/`
(R = respuesta, C = cuerpo).

| Método | URL | Parámetros / cuerpo | Respuesta (`datos`) |
|---|---|---|---|
| GET | `/conflictos/analisis` | — | `AnalisisApi[]` (el primero es el actual) |
| POST | `/conflictos/analisis` | `{}` | `ResumenAnalisisApi` (luego se vuelve a pedir el actual) |
| POST | `/conflictos/analisis/{id}/validar` | `{}` | `AnalisisApi` |
| GET | `/conflictos` | `pagina`, `tamanoPagina`, filtros `FiltroConflictosApi` | `PaginaApi<ConflictoApi>` |
| GET | `/conflictos/expedientes` | `pagina`, `tamanoPagina`, `analisisId?` y filtros | `PaginaApi<ExpedienteApi>` (conflicto + planes; cada actividad trae solo su última evidencia) |
| GET | `/conflictos/{id}` | — | `ConflictoDetalleApi` (conflicto, línea de tiempo, plan actual y planes, ficha, director y jefe inmediato de A y B) |
| POST | `/conflictos/{id}/transicion` | C `{ estadoNuevo, comentario, clasificacion? }` | `ConflictoApi` |
| GET | `/conflictos/actividad-reciente` | `limite` | `ActividadRecienteApi[]` |
| POST | `/conflictos/{id}/plan` | C `{ objetivo?, fechaReunion?, actividades[{descripcion, responsable, plazoMeses?, plazoDias?, orden?}], involucrados[{dmper, tipo}] }` | `PlanApi` |
| PUT | `/planes/{id}` | Mismo cuerpo (solo borrador) | `PlanApi` |
| POST | `/planes/{id}/firmar` | multipart: `archivo`, `metodoFirma` (`FISICA`/`ELECTRONICA`), `fechaFirma?` | `PlanApi` |
| POST | `/planes/{id}/cerrar` | C `{ motivo }` | `PlanApi` |
| GET | `/planes/{id}/documento` | — | binario |
| GET | `/actividades/mias` | `incluirCerrados` | `ActividadBandejaApi[]` |
| POST | `/actividades/{id}/evidencias` | multipart: `archivo`, `observacion?` | `EvidenciaApi` |
| PUT | `/evidencias/{id}/revisar` | C `{ aprobada, motivo? }` | `ResultadoRevisionApi` |
| GET | `/evidencias/{id}/archivo` | — | binario |
| GET | `/notificaciones/mias` | `soloNoLeidas`, `pagina`, `tamanoPagina` | `PaginaApi<NotificacionApi>` |
| PATCH | `/notificaciones/leidas` | `{}` | `{ MARCADAS }` |
| POST | `/consultas-previas` | C `{ tipo (ASPIRANTE/PROVEEDOR), cedula, nombres, nombrePadre?, nombreMadre?, nombreConyuge?, empresa? }` | `ConsultaPreviaApi` (coincidencias, riesgo máximo, advertencias) |

Mencionados en `models/api/` pero **sin uso** en ningún servicio: ver §3.2.

Personas: `PersonasHttpService.buscarPersonas` usa el
`BackendService.buscarPersonal` que ya existía
(`/sisgerh/personal/buscar`). **`obtenerPersonas()` devuelve `[]` y
`obtenerPersonaPorId()` devuelve `undefined`** con sesión real.

### 2.4 Código ya escrito

Sí, todo. Servicios en `src/app/services/http/`, mapeos en
`services/http/mapeos/`, interfaces en `src/app/models/api/`, ejemplos
de respuestas para las pruebas en `src/app/testing/api-ejemplos.ts`. Cada
servicio y cada mapeo tiene su `.spec.ts`. No hay interceptor nuevo: se
reutiliza `solicitudes.interceptor.ts`.

---

## Paso 3 — Cruce con lo que construimos

### 3.1 Métodos de los mocks → endpoint

| Servicio · método | Endpoint (versión HTTP) | Nota |
|---|---|---|
| **Analisis** · `obtenerAnalisisActual` | `GET /conflictos/analisis` + `GET /conflictos/expedientes?analisisId=` (todas las páginas) | La guía dice `GET /conflictos?analisis=`; el código usa `/expedientes?analisisId=`. |
| · `generarAnalisis` | `POST /conflictos/analisis` | Luego vuelve a pedir el actual. |
| · `obtenerHistorialAnalisis` | `GET /conflictos/analisis` | |
| · `obtenerAnalisisRegistrados` | `GET /conflictos/analisis` + expedientes de cada uno | |
| · `actualizarClasificacion` | `POST /conflictos/{id}/transicion` | Ya no se puede volver a «sin clasificar»; `H` exige observación. |
| · `validarAnalisis` | `POST /conflictos/analisis/{id}/validar` | |
| **Conflictos** · `obtenerConflictos` | `GET /conflictos/expedientes` (todas las páginas) | |
| · `obtenerConflictoPorId` | `GET /conflictos/{id}` | 403 para el rol P. |
| **Planes** · `obtenerPlanes` | `GET /conflictos/expedientes` | |
| · `obtenerPlanPorId`, `obtenerPlanesDeConflicto` | `GET /conflictos/{id}` (`PLANES`) | |
| · `obtenerPlanesDeResponsable`, `obtenerPlanDeResponsable` | `GET /actividades/mias?incluirCerrados=true` | |
| · `guardarBorrador` | `POST /conflictos/{id}/plan` o `PUT /planes/{id}` | |
| · `subirDocumentoFirmado` | sin endpoint propio | Guarda el archivo en memoria hasta enviar. |
| · `quitarDocumentoFirmado` | sin endpoint | Solo en la pantalla. |
| · `enviarYNotificar` | `POST /planes/{id}/firmar` (multipart) | Firma y envío en **un solo paso**. |
| · `aprobarEvidencia`, `rechazarEvidencia` | `PUT /evidencias/{id}/revisar` | |
| · `deshacerRevision` | **eliminado** | La revisión es definitiva. |
| · `subirEvidencia` | `POST /actividades/{id}/evidencias` (multipart) | |
| · `cerrarPlan` (nuevo) | `POST /planes/{id}/cerrar` | Cierre anticipado. |
| · `obtenerDocumentoPlan`, `obtenerArchivoEvidencia` (nuevos) | `GET /planes/{id}/documento`, `GET /evidencias/{id}/archivo` | Visor y descargas con token. |
| **Historial** · `obtenerConflictos` | `GET /conflictos` (todas las páginas) | La guía dice `/conflictos/expedientes`. |
| · `obtenerResumenes` | `GET /conflictos/expedientes` | |
| · `obtenerHistorial` | `GET /conflictos/{id}` (`LINEA_DE_TIEMPO` + planes) | |
| · `obtenerEventosRecientes` | `GET /conflictos/actividad-reciente?limite=` | |
| **Notificaciones** · `obtenerNotificaciones` | `GET /notificaciones/mias?soloNoLeidas=false` | |
| · `contarNoLeidas` | `GET /notificaciones/mias?soloNoLeidas=true&tamanoPagina=1` (usa `TOTAL_ELEMENTOS`) | |
| · `marcarTodasComoLeidas` | `PATCH /notificaciones/leidas` | |
| · `agregarNotificaciones` | **eliminado del contrato** | Las crea el backend. |
| **ConsultaPrevia** · `consultarCandidato` | `POST /consultas-previas` | Ahora exige cédula, nombres y apellidos. |
| · `obtenerConsultasRecientes` | **eliminado** | El backend no guarda las consultas. |
| **Personas** · `buscarPersonas` (nuevo) | `/sisgerh/personal/buscar` (vía `BackendService`) | Buscador de responsables. |
| · `obtenerPersonas`, `obtenerPersonaPorId` | **sin endpoint**: `[]` / `undefined` | Con sesión real, el saludo del dashboard del Responsable cae al nombre de la sesión (correcto: es el usuario real). |
| Formularios, Catálogos, Excusas | sin cambio | Sin uso en nuestras pantallas desde el Día 4. La guía dice que Excusas «se oculta del menú», pero el menú no se tocó. Hoy solo tiene la descarga del PDF de excusa, que es del host. |

Dashboards e Informe General siguen **calculándose en el front** a partir
de `obtenerPlanes` y `obtenerConflictos` (todas las páginas).

### 3.2 Endpoints que ninguna pantalla usa

Aparecen en los comentarios de `models/api/` pero ningún servicio los
llama:

- `GET /conflictos/resumen` (`ResumenConflictosApi`: totales por riesgo,
  por estado y vencidas). Serviría al **Dashboard de RRHH**, que hoy baja
  todos los expedientes para contar.
- `GET /conflictos/reporte`: lista para el **Informe General** o el Excel
  (hoy «Descargar Excel» solo confirma).
- `GET /conflictos/persona/{cedula}`.
- `GET /conflictos/{id}/plan/sugerencia` (`ActividadSugeridaApi`):
  actividades sugeridas para un plan nuevo.
- `PATCH /notificaciones/{id}/leida`: marcar una sola.
- Los filtros de servidor de `FiltroConflictosApi` (riesgo, estado,
  clasificación, departamento, vencido…): el front baja todo y filtra en
  el navegador.

Del backend que ya existía: `/identidad/{cedula}` (DINARDAP) sigue sin uso
y podría completar la Consulta Previa.

### 3.3 Diferencias de datos que obligan a mapear

Las resuelven los mapeos de `services/http/mapeos/`; se listan para saber
qué cambió en nuestros modelos.

| Tema | Backend | Nuestro modelo (antes → ahora) |
|---|---|---|
| Valores de estado | MAYÚSCULAS | **Se adoptaron tal cual** en los modelos (antes minúsculas propias). Ver la tabla de la guía. |
| Riesgo | `BAJO`/`MEDIO`/`ALTO`/`CRITICO` | Antes `alto`/`medio`/`bajo`/`ninguno`: aparece **Crítico** y desaparece **Ninguno**. |
| Clasificación | `D`/`N`/`H` o `null` | Antes `pendiente`/`confirmado`/`homonimo`: «confirmado» se divide en **declarado** y **no declarado**; «pendiente» pasa a `null`. |
| Estado del conflicto | `ESTADO_SEGUIMIENTO` (6 valores) | **Nuevo** `Conflicto.estado`. |
| Plan | `BORRADOR`/`FIRMADO`/`CERRADO` + `TIPO_CIERRE`, `MOTIVO_CIERRE` | Antes con `activo_vencidas`: ahora **«con vencidas» se calcula** con la fecha límite. |
| Actividad | `ACEPTADA`, `NO_CUMPLIDA`, `VENCIDA` (booleano) | Antes `aprobada` y `vencida` (estado): ahora **«vencida» se calcula** y aparece `NO_CUMPLIDA` (tras el cierre anticipado). |
| Evidencia | `CODIGO`, `ESTADO_REVISION`, `ARCHIVO {CODIGO, NOMBRE, TIPO_MIME, TAMANIO}` | Nuevo `Evidencia.id`; el archivo se descarga por id. |
| Ids | Números | Siguen `string` (`'1408'` en vez de `'C-001'`). |
| Responsable | `RESPONSABLE` = `DMPER_CODIGO` | `responsableId` = DMPER. **Resuelve el pendiente del Día 2.** |
| Parentesco | `PARENTESCO`, `PARENTESCO_INVERSO`, `TIPO_GRADO` (C/A/O), `GRADO` | Mapeado con `parentesco.mapeo.ts` a `rolA`/`rolB`/`relacion`/`grado`. |
| Persona del caso | `NOMBRE_A`, `CEDULA_A`, `DEPARTAMENTO_A`; ficha con cargo, ingreso, padre, madre y cónyuge; director y jefe inmediato | Ahora sí llegan padre, madre y cónyuge (`FichaPersonaApi`), pero solo en el detalle. |
| Fechas | ISO | Sin cambio. |
| Plan del responsable | `ActividadBandejaApi` (actividad + caso + plan) | `PlanDeResponsable` gana `nombreA`, `nombreB`, `parentesco` y `riesgo`. |

### 3.4 Reglas de negocio: mock frente a backend

| Regla | Antes (solo mock) | Ahora |
|---|---|---|
| Clasificar y validar el análisis | Mock | **Backend** (transición de estado). El front ya no deja volver a «sin clasificar» y exige observación para `H`. |
| Un plan vigente por conflicto | Mock | **Backend**. Crear sobre un `FINALIZADO` lo reabre. |
| Enviar y notificar | Mock: documento + actividades completas, fecha de inicio, fechas límite, avisos | **Backend**, en un solo `POST /firmar`. |
| Aprobar o rechazar | Mock | **Backend**. Además: quien sube no revisa y nadie decide sobre su propio conflicto (403). |
| Deshacer revisión | Mock | **Eliminada** (el backend no la tiene). |
| Cierre automático | Mock | **Backend** (`FINALIZADO` al aprobar la última). |
| Cierre anticipado | No existía | **Nuevo**, en el backend: motivo obligatorio y condiciones. |
| Subir evidencia | Mock: dueño, plan activo, estado, tipo, 10 MB | **Backend**; el front valida antes, con 5 MB. |
| Vencimiento | Dato fijo en los ejemplos | **Se calcula en el front** con la fecha límite (el backend lo informa con `VENCIDA`). |
| Notificaciones | Las creaba el mock | **Backend**; filtrado por usuario en el servidor. |
| Historial | Armado desde los datos | **Backend** (`LINEA_DE_TIEMPO`, `actividad-reciente`). |
| Consulta previa | Coincidencias calculadas en el front | **Backend** (nómina y declaraciones, con confianza y advertencias). |

Con la sesión simulada, los mocks siguen aplicando las reglas, adaptadas a
los estados nuevos.

### 3.5 Contradicciones con nuestra arquitectura y convenciones

1. **`@author`:** 74 bloques nuevos llevan `@author Integración backend`.
   `CONVENCIONES.md` pide `@author Elvis Flores`.
2. **Marcadores `[PNIP-CI]`:**
   - En `app.config.ts` el formato es `[PNIP-CI] Integración backend -
     23/10/2026`, cuando la convención es `[PNIP-CI] Elvis Flores -
     dd/mm/aaaa` + `// Qué hace:`.
   - Los cambios en archivos del host (`auth.service`, interceptor,
     `auth.guard`, `conflict-form.ts`, `manage-rrhh-modal`,
     `backend.service`) van **sin marcadores**.
3. **Renombrado de tokens del host** (`TOKEN-SISTEC` → `TOKEN-SISCI`):
   cambia el comportamiento del login de toda la app, no solo del módulo.
   La guía lo justifica con «svn r4079», pero `ARQUITECTURA.md` dice que
   los archivos del host se tocan solo cuando hace falta y marcados.
4. **Sesión simulada:** compatible. Sigue siendo solo de desarrollo, y
   ahora además decide mock o backend (`fuente-datos.ts`). `fuente-datos.ts`
   lee `SISCI-DEV-SESION-SIMULADA` por su cuenta, en vez de usar
   `PerfilUsuarioService.esSesionSimulada()`, que ya existía.
5. **Roles A, R, P y E:** sin cambios en el front (`rolGuard`, menú). El
   backend da 403 al rol P en `/conflictos`, por eso el Responsable usa su
   bandeja. Sigue sin documentarse cómo se asigna el rol P en el backend.
6. **Documentación:** la arquitectura (nueva capa `services/http/` y
   `models/api/`), `DESARROLLO_LOCAL.md` (mock con sesión simulada, HTTP
   con sesión real) y la bitácora no se actualizaron.
7. **Especificación:** se quitan cosas que pedían los prompts y la
   especificación (deshacer revisión, consultas recientes, 10 MB) y se
   agregan otras (cierre anticipado, Crítico, D/N). Falta reflejarlo en
   `Especificacion_Front_PNIP-CI.md`.

---

## Paso 4 — Riesgos, preguntas y plan

### Riesgos o bloqueos

1. **No se puede verificar el contrato desde aquí.** El `PLAN_MAESTRO` y
   el backend r4091 no están en esta máquina (copia SVN de septiembre y
   sin cliente `svn`). Las interfaces de `models/api/` son la única
   referencia local.
2. **Rendimiento:** dashboards, Informe e Historial bajan **todas** las
   páginas de `/conflictos/expedientes` (200 por página) y filtran en el
   navegador. Con datos reales puede ser lento; existen `/conflictos/resumen`
   y los filtros de servidor, sin usar.
3. **Personas con sesión real:** `obtenerPersonas` y `obtenerPersonaPorId`
   devuelven vacío. Cualquier pantalla que dependa de ellos se queda sin
   datos.
4. **Regresión de `?vista=formulario`** y **limpieza de `9e80ba3`**:
   siguen sin resolver y ahora están debajo del trabajo del compañero.
5. **Ramas desalineadas:** `feature/pnip-ci` no tiene la integración. Si
   se sigue trabajando ahí, habrá conflictos grandes (129 archivos y
   valores de estado distintos).
6. **Tokens del host renombrados:** cualquier otra app que comparta
   `localStorage` y espere `TOKEN-SISTEC` dejaría de verlo, y los usuarios
   con sesión guardada deberán volver a entrar.
7. **Convenciones** (`@author`, marcadores) y **documentación** sin
   actualizar.
8. **Pruebas:** no se corrieron (fuera de lo pedido). El commit dice
   haberse probado de punta a punta contra el backend de pruebas
   (conflicto 1408).
9. **Repositorio vacío** en `SISCI_PRUEBAS/`.

### Preguntas para el compañero o para el backend

1. ¿Puedes subir o compartir `PLAN_MAESTRO_MODULO_CONFLICTOS.md` y el
   `wssisci` de r4091 (o la URL del Swagger de pruebas)?
2. ¿La rama de trabajo pasa a ser `feature/integracion-backend`? ¿Qué se
   hace con `feature/pnip-ci` y `feature/mejora-formulario`?
3. ¿El cambio a `TOKEN-SISCI` lo pidió el backend (r4079)? ¿Afecta a otras
   apps de la intranet?
4. ¿Se puede usar `GET /conflictos/resumen` para el dashboard, y los
   filtros de servidor en lugar de bajar todas las páginas?
5. ¿Para qué son `/conflictos/reporte` (¿el Excel del informe?) y
   `/conflictos/{id}/plan/sugerencia`?
6. ¿Hay endpoint para la lista de personal completa o por código, para
   `obtenerPersonas` y `obtenerPersonaPorId`?
7. ¿Cómo se asigna el rol P y quién lo hace?
8. ¿Excusas se oculta del menú, como dice la guía? Hoy solo descarga el PDF.
9. ¿Se mantiene `CRITICO` y la clasificación `D`/`N` en las pantallas y en
   la especificación (RRHH aprobó mockups con «Confirmado» y sin
   «Crítico»)?
10. ¿5 MB es definitivo para documentos y evidencias?
11. ¿Está bien que «Deshacer» y «Consultas recientes» desaparezcan? RRHH
    los vio en los recorridos.

### Plan de integración propuesto por pantalla (sin aplicar)

La integración ya está hecha en el código. Lo que queda es **validarla**
y cerrar lo pendiente, en este orden:

**0. Antes de nada**
- Decidir la rama base: `feature/integracion-backend`.
- Revertir lo que se iba a descartar de `9e80ba3` y recuperar
  `?vista=formulario` (commit nuevo).
- Pedir el `PLAN_MAESTRO` y el Swagger para contrastar los DTO.
- Correr `ng test` y los builds sobre `38b38ae`.

**1. Ajustes transversales**
- Marcadores `[PNIP-CI]` en los archivos del host tocados; `@author`
  según la convención.
- Usar `PerfilUsuarioService.esSesionSimulada()` en `fuente-datos.ts`.
- Actualizar `ARQUITECTURA.md`, `DESARROLLO_LOCAL.md`, la especificación
  y la bitácora.

| Orden | Pantalla | Qué validar contra el backend de pruebas (cuentas R y P) |
|---|---|---|
| 2 | Campana | `/notificaciones/mias`, contador, «marcar todas»; que cada usuario vea solo las suyas. |
| 3 | Análisis de Conflictos | Generar, listar casos (paginación), clasificar D/N/H, validar; filtros por URL del dashboard con los valores nuevos. |
| 4 | Plan de Acción (RRHH) | Crear y guardar borrador, buscador de responsables, firmar (multipart, 5 MB), cierre anticipado, descarga del documento. |
| 5 | Revisión de Evidencias | Aprobar y rechazar, 403 si revisa quien subió, cierre automático a `FINALIZADO`, visor con descarga por token. |
| 6 | Responsable (dashboard, bandeja, detalle) | `/actividades/mias`, subir evidencia, caso desde la bandeja (403 en `/conflictos`), saludo con el nombre real. |
| 7 | Historial | Tarjetas desde expedientes, línea de tiempo desde `LINEA_DE_TIEMPO`, actividad reciente. |
| 8 | Informe General | Todas las páginas de expedientes; evaluar `/conflictos/reporte` para el Excel. |
| 9 | Dashboard de RRHH | Evaluar `/conflictos/resumen` en vez de contar en el front; enlaces con los valores nuevos. |
| 10 | Consulta Previa | `POST /consultas-previas`, advertencias y truncado; decidir sobre las consultas recientes. |

Cada paso con su recorrido contra el backend de pruebas y su entrada en la
bitácora.
