# Integración con el backend (wssisci)

Cómo pasan las pantallas de gestión de conflictos de los datos simulados
(`*-mock.service.ts`) al backend real. Rama: `feature/integracion-backend`.

- Contrato de la API: `SISCI/DOCS/DOCUMENTACION_TECNICA/PLAN_MAESTRO_MODULO_CONFLICTOS.md`
  (§10 endpoints, §19.8–19.10 cambios de planes múltiples y listados).
- DTOs de referencia: `SISCI/APP/wssisci/src/main/java/**/domain/dto/*.java`.
- Backend de pruebas: `http://172.20.35.209:7001/wssisci` (svn r4091).

## 1. Decisiones

1. **Los estados son los del backend.** Los tipos de `models/tipos-conflicto.ts`
   usan los mismos valores que la API (MAYÚSCULAS). No se traducen ida y
   vuelta: lo que llega es lo que se guarda en el modelo.
2. **Lo que el backend no guarda se calcula.** «Plan con vencidas» y
   «actividad vencida» salen de la fecha límite y el estado
   (`utils/planes.util.ts`), con la fecha de hoy como parámetro opcional.
3. **Los modelos siguen en camelCase.** Las respuestas llegan en
   MAYÚSCULAS dentro de `{ estado, mensaje, datos }`; cada servicio HTTP las
   convierte con funciones puras de `services/http/mapeos/*.ts`, probadas en
   su `.spec.ts`. Las interfaces de lo que llega están en `models/api/`.
4. **Los componentes no se tocan para cambiar de fuente.** Cada
   `XxxHttpService` tiene los mismos métodos públicos que su `XxxMockService`
   y se registra en `app.config.ts` con
   `{ provide: XxxMockService, useClass: XxxHttpService }`.
5. **La sesión simulada sigue usando los mocks.** Con
   `SISCI-DEV-SESION-SIMULADA = 'true'` no hay token real (el backend
   respondería 401), así que se queda con los datos simulados. Con sesión
   real, backend. Ver `services/http/fuente-datos.ts`.
6. **El servicio vuelve a pedir el conflicto tras cada acción** (firmar,
   revisar, cerrar…) en vez de adivinar el nuevo estado: el backend cambia
   en cascada actividades, plan y conflicto.
7. Ids: el backend usa números; los modelos siguen con `string`
   (`String(id)` al mapear, `Number(id)` en la URL).

## 2. Estados

| Tipo | Valores | Antes (mock) |
|---|---|---|
| `Riesgo` | `BAJO` `MEDIO` `ALTO` `CRITICO` | alto/medio/bajo/ninguno |
| `Clasificacion` | `D` declarado, `N` no declarado, `H` homónimo; `null` sin clasificar | pendiente/confirmado/homonimo |
| `EstadoSeguimiento` (nuevo, en `Conflicto.estado`) | `DETECTADO` `EN_ANALISIS` `EN_PLANIFICACION` `EN_EJECUCION` `FINALIZADO` `DESCARTADO` | — |
| `EstadoAnalisis` | `BORRADOR` `VALIDADO` | borrador/validado |
| `EstadoPlan` | `BORRADOR` `FIRMADO` `CERRADO` (+ `tipoCierre`: `CUMPLIDO`/`ANTICIPADO`, `motivoCierre`) | borrador/activo/activo_vencidas/cerrado |
| `EstadoActividad` | `PENDIENTE` `EN_REVISION` `ACEPTADA` `RECHAZADA` `NO_CUMPLIDA` | pendiente/en_revision/aprobada/rechazada/vencida |
| `Evidencia.estado` | `PENDIENTE` `APROBADA` `RECHAZADA` | pendiente/aprobada/rechazada |

Reglas de negocio que el front debe respetar (las aplica el backend; el front
solo evita ofrecer lo que va a fallar):

- `FINALIZADO` lo pone solo el sistema (al aprobar la última evidencia).
- Clasificar `D`/`N` lleva el conflicto de `DETECTADO` a `EN_PLANIFICACION` en
  una sola llamada; `H` lo descarta (comentario obligatorio).
- Un plan abierto por conflicto. Crear otro sobre un `FINALIZADO` lo reabre.
- Cierre anticipado: plan `FIRMADO`, al menos una actividad vencida y ninguna
  evidencia por revisar; motivo obligatorio. Las no aceptadas quedan
  `NO_CUMPLIDA` y el conflicto vuelve a `EN_PLANIFICACION`.
- La revisión de una evidencia es definitiva (no hay «deshacer»).
- Quien sube una evidencia no la revisa; nadie decide sobre su propio
  conflicto (403).

## 3. Métodos del mock y su endpoint

| Mock | Método | Endpoint |
|---|---|---|
| Analisis | `obtenerAnalisisActual`, `obtenerHistorialAnalisis`, `obtenerAnalisisRegistrados` | `GET /conflictos/analisis`, `GET /conflictos?analisis=` |
| | `generarAnalisis` | `POST /conflictos/analisis` |
| | `actualizarClasificacion` | `POST /conflictos/{id}/transicion` |
| | `validarAnalisis` | `POST /conflictos/analisis/{id}/validar` |
| Conflictos | `obtenerConflictos`, `obtenerConflictoPorId` | `GET /conflictos`, `GET /conflictos/{id}` |
| Planes | `obtenerPlanesDeConflicto`, `obtenerPlanPorId` | `GET /conflictos/{id}` (`PLANES`) |
| | `obtenerPlanes` | `GET /conflictos/expedientes` |
| | `guardarBorrador` | `POST /conflictos/{id}/plan` (nuevo) o `PUT /planes/{id}` |
| | `subirDocumentoFirmado` + `enviarYNotificar` | **un solo** `POST /planes/{id}/firmar` (multipart) |
| | `aprobarEvidencia`, `rechazarEvidencia` | `PUT /evidencias/{id}/revisar` |
| | `subirEvidencia` | `POST /actividades/{id}/evidencias` (multipart) |
| | `obtenerPlanesDeResponsable`, `obtenerPlanDeResponsable` | `GET /actividades/mias?incluirCerrados=` |
| | `cerrarPlan` (nuevo) | `POST /planes/{id}/cerrar` |
| Historial | `obtenerConflictos`, `obtenerResumenes`, `obtenerHistorial` | `GET /conflictos/expedientes`, `GET /conflictos/{id}` |
| | `obtenerEventosRecientes` | `GET /conflictos/actividad-reciente?limite=` |
| Notificaciones | `obtenerNotificaciones`, `contarNoLeidas`, `marcarTodasComoLeidas` | `GET /notificaciones/mias`, `PATCH /notificaciones/leidas` |
| ConsultaPrevia | `consultarCandidato` | `POST /consultas-previas` |

Se quitan porque el backend no los tiene: `deshacerRevision`,
`quitarDocumentoFirmado` (queda solo en la pantalla, antes de enviar),
`obtenerConsultasRecientes` (la consulta previa no se guarda) y
`agregarNotificaciones` (las crea el backend). Excusas queda fuera del sprint:
se oculta del menú.

`Formularios`, `Catalogos` y `Personas` ya tienen su versión real en
`backend.service.ts` (plantilla-temporal, sisgerh).

## 4. Para probar con el backend

1. Salir de la sesión simulada (selector de rol → «Salir de la simulación»).
2. Entrar desde la intranet con una cuenta con rol R (y otra con P para el
   responsable).
3. El backend de pruebas redirige todos los correos a una sola dirección
   (`sisci.conflictos.correo-redirigir-a`): la base tiene personal real.
