# Análisis del backend `wssisci` frente a la integración del front (26/10/2026)

Análisis **de solo lectura** de cómo está construido el backend, para validar
la integración de Sebas Constante (`38b38ae`, `docs/INTEGRACION_BACKEND.md`)
antes de la entrega del viernes 30/10/2026.

Reglas que se cumplieron:
- En `wssisci` no se modificó, compiló ni ejecutó nada, no hubo conexión a la
  base y no se usó `svn`.
- En el front no se cambió código: este archivo es lo único nuevo.
- Contra el servidor de pruebas solo hubo un `GET /wssisci/v3/api-docs` (Swagger).

Respuestas ya confirmadas por Sebas (punto de partida):
- El módulo de conflictos solo escribe en sus tablas propias y solo lee las
  demás (personal, sisgerh, formularios).
- `172.20.35.209` usa una base de **pruebas con personal real**.

---

## Paso 1 — Versión del backend

| Copia | Revisión | Contenido |
|---|---|---|
| `EEASA\SISCI\APP\wssisci` (copia de trabajo SVN, `svn://172.20.18.70/PROYECTOS_DRI/SISCI`) | **r4095**; el último cambio en `wssisci` es la **r4093** (`fconstante`, 23/10/2026). Leída de `.svn/wc.db` en modo solo lectura | 221 `.java` |
| `EEASA\SISCI_PRUEBAS\APP\wssisci` (sin `.svn`, la que se analizó) | Idéntica a la anterior: `diff -r` sin diferencias | 221 `.java` (152 con fecha 26/10/2026) |

- La guía del front pide la **r4091**: la copia es igual o posterior. ✔
- La copia SVN tiene revisiones mezcladas: `BDD/` sigue en la r4079 (último
  cambio r4045). Por eso **no está** `BDD/rol_responsable.sql`, que el código
  menciona (ver Paso 3.2).
- `pom.xml`: Spring Boot 2.7.18, Java 1.8, `wssisci 0.0.1-SNAPSHOT` (WAR).

El módulo de conflictos **está completo**:

| Parte | Paquete | Controlador | Entidades | DTO |
|---|---|---|---|---|
| Análisis y conflictos | `eeasa_ci_conflicto` | `ConflictoController` | `Analisis`, `Conflicto`, `Proceso` | 10 (`AnalisisDto`, `ConflictoDto`, `ConflictoDetalleDto`, `ExpedienteDto`, `ResumenConflictosDto`…) |
| Planes, actividades, evidencias | `eeasa_ci_plan` | `PlanController`, `ActividadController`, `EvidenciaController` | `PlanAccion`, `Actividad`, `Evidencia`, `Archivo`, `PersonalPlan` | 11 |
| Notificaciones | `eeasa_ci_notificacion` | `NotificacionController` | `Notificacion` | 1 |
| Consulta previa | `eeasa_ci_consulta_previa` | `ConsultaPreviaController` | — (no se guarda) | 3 |
| Logs | `eeasa_ci_logs` | — | `LogAplicacion` | — |
| Seguridad por rol | `auth/seguridad` | — | — | `@RequiereRol`, `RolInterceptor`, `UsuarioActual` |

El Swagger del servidor de pruebas publica **59 rutas**, entre ellas todas las
del módulo. Sus esquemas coinciden con el código de esta copia. **Lo
desplegado en `172.20.35.209` es esta versión.**

---

## Paso 2 — Estructura

- **Framework:**
  - Spring Boot 2.7.18 (Java 8), empaquetado WAR para **WebLogic**
    (`weblogic.xml`, context-root `/wssisci`).
  - Spring Web, Data JPA (Hibernate, `ddl-auto=validate`: no crea ni altera
    tablas), Validation, Security, Mail, Thymeleaf (plantillas de correo).
  - `jjwt 0.9.1`, `ojdbc8`, `springdoc-openapi 1.8.0`, Lombok.
- **Capas por paquete `eeasa_ci_*`:**
  - `controllers/`: REST, devuelve `ApiResponseDto { estado, mensaje, datos }`;
  - `services/`: reglas de negocio, transacciones;
  - `repositories/`: Spring Data JPA, y en algunos casos SQL nativo;
  - `domain/entities` y `domain/dto` (`@JsonProperty` en MAYÚSCULAS);
  - `domain/enums`.
- **`shared/`:**
  - respuestas (`ApiResponseBuilder`, `PaginatedResponseDto` con `TAMAÑO_PAGINA`);
  - `Paginas` (máximo **200** por página);
  - `GlobalExceptionHandler` (400/403/404/409);
  - `PersonalConsulta` (lecturas de `DRI_MA_PERSONAL`);
  - `SQLProcedureHelper`.
- **Motor de parentesco** (`eeasa_ci_conflicto/motor`): Java puro, compara
  nómina y declaraciones (`MotorParentesco`, `SimilitudNombres`,
  `CatalogoParentesco`).
- **Conexión a la base:** `src/main/resources/application.properties`.
  - En pruebas: `spring.datasource.jndi-name=serverORCL`. El datasource lo da
    WebLogic, así que la URL y el usuario reales no están en el código.
  - Hay un bloque `LOCAL` comentado que apunta a
    `jdbc:oracle:thin:@//172.20.35.209:1521/testorcl`, usuario `ROOTSISGERH`.
  - Las tablas viven en el esquema `ROOTSISGERH`.
- **Tareas programadas** (`TareasConfig`):
  - aviso diario de vencidas a las 06:00 (`sisci.conflictos.cron-vencidas`);
  - purga de logs a las 03:30, con 180 días de retención.
- **Pruebas unitarias:** 30 clases en `src/test`. Cubren el motor, la máquina
  de estados, el plan, las actividades, las notificaciones, los correos y los
  roles. No se ejecutaron.

---

## Paso 3 — Login y sesión

### 3.1 Endpoints de autenticación (`auth/controllers/AuthController`)

| Endpoint | Público | Recibe | Devuelve | Token |
|---|---|---|---|---|
| `POST /auth/getUsuarioIntranet` | Sí | Cabecera `Authorization: <token de intranet>` (sin `Bearer`) y cuerpo `{ "agent": "<huella>" }` | `{ token, usuario: { DSGUS_CUENTA, DMPER_CODIGO, DMPER_CEDULA, CARGO, NOMBRES, DEPARTAMENTO, UBICACION_INTERNA, ROLES } }` | Llama a `WSIntranet …/getUsuarioInformacionToken` (pruebas: `http://172.20.35.209:7001/WSIntranet/rest/intranet/`) con ese token y el agente. Con la cuenta busca a la persona en SISGERH (`PKG_SISGERH_SERVICES.SP_SELECT_DRI_SG_USUARIO_DP`) y **genera el JWT de SISCI** (`generateTokenAgent`). |
| `POST /auth/getUsuarioSisci` | No (`Bearer <JWT>`) | Cuerpo ignorado | El mismo `usuario`, con `token: null` | Revalida un JWT que ya existe. Si la cuenta no está en SISGERH, busca un externo en `DRI_CI_PLANTILLA_TEMPORAL` → rol `E`. |
| `POST /auth/verificarClave` | Sí | `{ cedula, claveTemporal }` | `{ cedula, token }` | Externos: valida contra `DRI_CI_PLANTILLA_TEMPORAL` y genera el JWT con la cédula como sujeto. |
| `POST /auth/ingresarNuevoUsuario` | No | `{ cedula }` | `{ cedula, claveTemporal }` | Crea la clave temporal de un externo (12 caracteres) o devuelve la que ya existe. Lo usa «Generar código». |
| `ingresarUsuario` | — | — | — | **No es de `wssisci`**: es de `WSIntranet` (usuario/clave en Base64 + agente → token de intranet). El front lo tiene en `AuthService.obtenerValidacionUsuario`, pero **ninguna pantalla lo usa**. |
| `verificarClave` con usuario/clave de intranet | — | — | — | No existe: el personal interno solo entra con el token de intranet. |

Cómo funciona el JWT (`JWTServices`, `AuthFilter`):
- HS256 con `jwt.secret`. El sujeto (cuenta SISGERH, o cédula si es externo)
  va cifrado con AES (`AESConIV`), y también los claims `huellaDigital` y
  `dmper`.
- `AuthFilter` lee `Authorization: Bearer …`, descifra el sujeto y comprueba
  que coincida. Si algo falla responde **401** con
  `{"estado":"ERROR","mensaje":"Token inválido o expirado"}`.
- ⚠ **El JWT no tiene fecha de expiración** (`createToken` no llama a
  `setExpiration`). Sirve hasta que cambie `jwt.secret`.
- ⚠ **La huella está desactivada**: `validarHuellaToken` siempre devuelve
  `true`.
- Seguridad sin sesión (STATELESS) y sin CSRF. Son públicos `getUsuarioIntranet`,
  `verificarClave`, `/ws/**` y Swagger; todo lo demás exige token.

### 3.2 Roles A, R, P, E

- `A`, `R` y **`P`** se guardan en `DRI_CI_ROL_USUARIO`, por `DMPER_CODIGO`,
  con el catálogo `DRI_CI_ROL`. `I` y `E` no se guardan: se deducen
  (`resolverRoles`):
  - con código de nómina → roles de la tabla + `I`;
  - sin código pero con clave temporal → `E`.
- En cada petición protegida el backend **vuelve a leer los roles de la base**
  (`UsuarioActual`, caché de 5 minutos). Nunca usa los roles que el front
  guarda en `USUARIO-SISCI`.
- Permisos (`@RequiereRol`, 403 «No tiene permisos para realizar esta accion»):

  | Ruta | Roles |
  |---|---|
  | `/conflictos/**`, `/consultas-previas`, `/planes/**` (incluido `/planes/{id}/documento`), `PUT /evidencias/{id}/revisar` | `A`, `R` |
  | `/actividades/**`, `GET /evidencias/{id}/archivo` | `A`, `R`, `P` |
  | `/notificaciones/**` | Cualquier usuario autenticado |
  | `/roles/**`, `/rol-usuario/**` | `A` |

- **El rol `P` se asigna solo, al firmar un plan.** Lo hace
  `PlanAccionService.firmar` → `RolUsuarioService.asignarSiFalta("P", responsables, cuenta)`:
  inserta en `DRI_CI_ROL_USUARIO` a cada responsable que no lo tenga y limpia
  su caché. También lo puede asignar a mano un `A` con `POST /rol-usuario`.
- ⚠ Si el rol `P` **no existe o está inactivo** en `DRI_CI_ROL`,
  `asignarSiFalta` lanza `IllegalStateException` («falta correr
  BDD/rol_responsable.sql») **dentro de la transacción de firmar**, y la firma
  falla. Ese script no está en ninguna copia local.

### 3.3 Cómo entra el front hoy (`app.config.ts` + `auth.service.ts`)

Cuando no hay sesión simulada, el `provideAppInitializer`:
1. Busca un **token de intranet**, en este orden:
   - en la URL (`obtenerTokenDesdeUrl`): parámetros `token`, `tokenIntranet`,
     `authToken`, `TOKEN-INTRANET`, `t` o `auth`, en `?…` o tras el `#`;
     después los borra de la URL;
   - en una cookie (`TOKEN-INTRANET`, `token`, `authToken`…);
   - en `localStorage['TOKEN-INTRANET']`.
2. Si lo encuentra:
   - calcula la huella con FingerprintJS;
   - llama a `POST /auth/getUsuarioIntranet`. El interceptor manda el token
     **sin** `Bearer`, que es lo que espera el backend;
   - con la respuesta guarda `TOKEN-SISCI` (el JWT) y `USUARIO-SISCI` (el
     usuario con `ROLES`).
3. Si no hay token de intranet pero hay `TOKEN-SISCI` y `USUARIO-SISCI` en
   `localStorage`, `isAuthenticated()` es `true` y entra **sin consultar al
   backend**.
4. Si no hay nada, va a `/login`. Ahí solo existe el ingreso de externos
   (cédula + código → `verificarClave` → rol `E`).

Para el personal interno, entonces, **no hay pantalla de login en local**:
hace falta un token de intranet o una sesión SISCI copiada. Los pasos
concretos están en el apartado final.

### 3.4 CORS

- `AuthConfig.corsConfigurationSource` y `WebConfig.addCorsMappings` permiten
  **`http://localhost:4200`** y `http://172.20.35.209:7001`, todos los
  métodos y cabeceras, con credenciales.
- Desde `localhost:4200` sí se puede. Desde otro puerto (por ejemplo `4300`)
  el navegador bloquea las llamadas.
- No se sabe si `WSIntranet` permite `localhost`: no es parte de este código.

### 3.5 `TOKEN-SISTEC` → `TOKEN-SISCI`

- **El backend no lo exige.** En `wssisci` no aparece `TOKEN-SISCI` ni
  `SISTEC`: el backend solo lee la cabecera `Authorization`.
- El nombre de la clave de `localStorage` es una **decisión del front**. El
  comentario del front que dice «alineado con el backend, svn r4079» no se
  puede comprobar aquí: `wc.db` no guarda los mensajes de commit.
- Efecto: quien tenía sesión guardada como `TOKEN-SISTEC` vuelve a validar
  con su token de intranet. No rompe nada.
- Qué otros sistemas usan esos nombres: no se puede saber desde este código.
  Queda para Sebas.
- El interceptor del front todavía tiene ramas para `generarTokenSisci` y
  `getUsuarioInformacionSisgerh`, que **no existen** en el backend. Son ramas
  muertas e inofensivas.

---

## Paso 4 — Endpoints del módulo

### 4.1 Endpoints frente a `services/http/`

Prefijo de todas las rutas: `http://172.20.35.209:7001/wssisci`. Envoltura:
`{ estado, mensaje, datos }`.

| Método y ruta | Parámetros / cuerpo | `datos` | Roles | Lo usa el front | ¿Coincide? |
|---|---|---|---|---|---|
| `POST /conflictos/analisis` | — | `ResumenAnalisisDto` (409 si ya hay una ejecución en curso) | A, R | `AnalisisHttpService` (generar) | ✔ |
| `GET /conflictos/analisis` | — | `AnalisisDto[]` | A, R | Análisis actual | ✔ |
| `POST /conflictos/analisis/{id}/validar` | — | `AnalisisDto` | A, R | Validar | ✔ |
| `GET /conflictos` | `riesgo, estado, clasificacion, departamento, analisisId, cedula, vencido, pagina=0, tamanoPagina=20` (≤ 200) | Página de `ConflictoDto` | A, R | Historial (`todasLasPaginas`, 200) | ✔ |
| `GET /conflictos/expedientes` | Mismos filtros y páginas | Página de `ExpedienteDto` (conflicto + planes + actividades + última evidencia) | A, R | Análisis, conflictos, planes e historial (`todasLasPaginas`, 200; `?analisisId=`) | ✔ |
| `GET /conflictos/reporte` | Mismos filtros, sin páginas | `ConflictoDto[]` | A, R | No | — |
| `GET /conflictos/resumen` | — | `ResumenConflictosDto` | A, R | No | — |
| `GET /conflictos/actividad-reciente` | `limite` (1–50, por defecto 10) | `ActividadRecienteDto[]` | A, R | Historial | ✔ |
| `GET /conflictos/persona/{cedula}` | `incluirDescartados` | `ConflictoDto[]` | A, R | No | — |
| `GET /conflictos/{id}` | — | `ConflictoDetalleDto` (incluye `LINEA_DE_TIEMPO`, `PLANES`, directores y fichas) | A, R | Conflictos, historial y planes | ✔ |
| `POST /conflictos/{id}/transicion` | `{ estadoNuevo, clasificacion?, observacion? }` | `ConflictoDto` | A, R | Clasificar | ✔ |
| `GET /conflictos/{id}/plan/sugerencia` | — | `ActividadSugeridaDto[]` | A, R | No | — |
| `POST /conflictos/{id}/plan` | `CrearPlanRequestDto` | `PlanDto` | A, R | `guardarBorrador` (nuevo) | ✔ |
| `PUT /planes/{id}` | `CrearPlanRequestDto` | `PlanDto` | A, R | `guardarBorrador` (existente) | ✔ |
| `POST /planes/{id}/firmar` | multipart: `archivo`, `metodoFirma` (`FISICA`/`ELECTRONICA`), `fechaFirma?` (ISO) | `PlanDto` | A, R | `enviarYNotificar` (`FISICA` + fecha de hoy) | ✔ |
| `POST /planes/{id}/cerrar` | `{ motivo }` | `PlanDto` | A, R | Cierre anticipado | ✔ |
| `GET /planes/{id}/documento` | — | Binario | **A, R** | **Visor del plan, también desde el detalle del Responsable** | ⚠ ver 4.5 |
| `GET /actividades/mias` | `incluirCerrados` | `ActividadBandejaDto[]` | A, R, P | Bandeja y dashboard del Responsable (`incluirCerrados=true`) | ✔ |
| `POST /actividades/{id}/evidencias` | multipart: `archivo`, `observacion?` | `EvidenciaDto` | A, R, P | Subir evidencia (`observacion=''`) | ✔ |
| `PUT /evidencias/{id}/revisar` | `{ aprobada, motivo? }` (motivo ≤ 2000) | `ResultadoRevisionDto` | A, R | Aprobar / rechazar | ✔ |
| `GET /evidencias/{id}/archivo` | — | Binario | A, R, P | Visor de evidencias | ✔ |
| `GET /notificaciones/mias` | `soloNoLeidas, pagina, tamanoPagina` | Página de `NotificacionDto` | Autenticado | Campana | ✔ |
| `PATCH /notificaciones/{id}/leida` | — | — | Autenticado | No | — |
| `PATCH /notificaciones/leidas` | — | `{ marcadas }` | Autenticado | Marcar todas | ✔ |
| `POST /consultas-previas` | `{ tipo, cedula, nombres, apellidos, … }` | `ConsultaPreviaDto` | A, R | Consulta previa | ✔ |

**Comparación de campos.** Se cotejaron automáticamente los campos de los DTO
Java, los esquemas del Swagger desplegado y las interfaces de `models/api/`:
- **Las 30 interfaces coinciden campo por campo.** También coinciden la
  página (`TAMAÑO_PAGINA` con Ñ) y todos los valores de los enums: `Riesgo`,
  `Clasificacion` D/N/H, `EstadoSeguimiento`, `EstadoPlan`, `EstadoActividad`,
  `EstadoRevision`, `TipoCierre`, `MetodoFirma`, `TipoNotificacion`,
  `TipoConsulta` y `FuenteCoincidencia`.
- La única diferencia es que `FiltroConflictosApi` lleva `pagina` y
  `tamanoPagina`, que en Java son parámetros aparte. Es inofensiva.
- **No hay diferencias de URL, parámetros, nombres de campo ni tipos** en lo
  que llama el front.

### 4.2 Personal para `obtenerPersonas` / `obtenerPersonaPorId`

| Endpoint | Qué da | Límite |
|---|---|---|
| `GET /sisgerh/personal?pagina&tamanoPagina` | `CODIGO, NOMBRE_COMPLETO, CARGO, DEPARTAMENTO` (sin cédula), personal activo | Paginado |
| `GET /sisgerh/personal/buscar?termino&limite` | `CODIGO, CEDULA, NOMBRE_COMPLETO` | Mínimo 3 caracteres, máximo 50 resultados |
| `GET /sisgerh/personal/{codigo}/ubicacion` | Departamento y cargo de una persona | Una persona |

No hay `GET /sisgerh/personal/{codigo}` con la ficha completa. Hoy no hace
falta:
- `obtenerPersonas()` solo alimenta las opciones de responsable del plan, y
  esa pantalla ya usa el buscador (`/sisgerh/personal/buscar`) más los
  responsables que ya están en el plan.
- `obtenerPersonaPorId()` solo se usa con la **sesión simulada** (saludo del
  dashboard del Responsable). Con sesión real no se llama.

Que devuelvan vacío es **coherente con el diseño**. Si se quisiera,
`/sisgerh/personal` podría llenar `obtenerPersonas` (sin cédula).

### 4.3 `/conflictos/resumen`, `/conflictos/reporte`, `/plan/sugerencia`

Según la documentación del propio código:
- **`/conflictos/resumen`:** los indicadores del dashboard (total, por riesgo,
  por estado, actividades por estado, actividades vencidas, conflictos
  vencidos). El front los calcula bajando todos los expedientes; podría usar
  este endpoint.
- **`/conflictos/reporte`:** «Sin paginar, con los mismos filtros: alimenta
  los Excel RG.01, RG.02 y RG.03». Es la fuente para exportar el Informe
  General y el Análisis.
- **`/conflictos/{id}/plan/sugerencia`:** plantilla de actividades sugeridas
  para un conflicto («paso C6 del flujo»). Es un catálogo en código y no se
  guarda: RRHH la edita y después crea el plan. Plazo por defecto de un mes,
  seguimiento a los seis.

### 4.4 Archivos

- `ValidadorArchivo`:
  - **5 MB** por archivo;
  - tipo decidido por los **primeros bytes**: solo **PDF, PNG o JPEG**, sin
    importar extensión ni Content-Type;
  - nombre de hasta 255 caracteres.
- `application.properties`: `max-file-size=5MB` y `max-request-size=6MB`.
- Vale lo mismo para el plan firmado y para las evidencias.
- El front exige **solo PDF** para el plan firmado. Es más estricto que el
  backend y no es un error.

### 4.5 Diferencia encontrada: el Responsable no puede abrir el documento del plan

- `plan-responsable-detalle` («Ver documento del plan») usa el visor de
  documentos → `PlanesHttpService.obtenerDocumentoPlan` →
  `GET /planes/{id}/documento`.
- `PlanController` exige **A o R**. Un usuario que es **solo `P`** recibe
  **403**, y el visor queda sin documento.
- Con `R+P` funciona.
- Para corregirlo hay que decidir si el backend debe permitir `P` (solo en
  sus planes) o si el front debe ocultar el botón. **Se pregunta a Sebas.**

---

## Paso 5 — Base de datos (según el código)

### 5.1 Tablas que escribe el módulo de conflictos

| Tabla (`ROOTSISGERH`) | Operaciones | Dónde |
|---|---|---|
| `DRI_CI_ANALISIS` | insert / update | `MotorParentescoService`, `ConflictoService` |
| `DRI_CI_CONFLICTO` | insert / update | idem |
| `DRI_CI_PROCESO` (línea de tiempo) | insert | idem |
| `DRI_CI_PLAN_ACCION` | insert / update | `PlanAccionService`, `ConflictoService` |
| `DRI_CI_ACTIVIDAD` | insert / update / **delete** (al reemplazar las actividades de un borrador) | `PlanAccionService`, `ActividadService` |
| `DRI_CI_PERSONAL_PLAN` | insert / **delete** (idem, involucrados) | `PlanAccionService` |
| `DRI_CI_EVIDENCIA` | insert / update | `ActividadService` |
| `DRI_CI_ARCHIVO` (binarios) | insert | `ArchivoService` |
| `DRI_CI_NOTIFICACION` | insert / update (leída, correo enviado) | `NotificacionService`, `CorreoNotificacionService`, `AvisoVencidasJob` |
| `DRI_CI_LOGS` | insert / **delete** (purga de más de 180 días) | `LogBdEscritor`, `PurgaLogsJob` |
| **`DRI_CI_ROL_USUARIO`** | **insert** (rol `P` al firmar) | `PlanAccionService.firmar` → `RolUsuarioService.asignarSiFalta` |

- **ALERTA (moderada):** `DRI_CI_ROL_USUARIO` **no es una tabla propia del
  módulo de conflictos**. Es la tabla de roles de SISCI que comparte con la
  declaración: ahí están los `A` y `R` que administra «Gestionar Jefes de
  RRHH».
  - El módulo solo **inserta** filas del rol `P` y nunca borra ni modifica las
    demás.
  - Sigue siendo `DRI_CI_*` (SISCI), no personal ni SISGERH.
  - Contradice la frase «solo escribe en sus tablas propias». Hay que
    confirmarlo con Sebas y RRHH.
- **Ninguna escritura** toca tablas de personal o SISGERH (`DRI_MA_*`,
  `DRI_HTR_*`, vistas `V_DRI_CI_*`). No hay `INSERT`, `UPDATE`, `DELETE` ni
  `MERGE` nativos.
- Los procedimientos que se llaman se llaman todos `SP_SELECT_*` (lectura por
  el nombre). Su cuerpo está en la base y no se pudo revisar.
- **Fuera del módulo (host), para que conste:** `AuthController` y
  `PlantillaTemporalService` escriben `DRI_CI_PLANTILLA_TEMPORAL` (claves y
  declaraciones), y `RolService`/`RolUsuarioService` escriben `DRI_CI_ROL` y
  `DRI_CI_ROL_USUARIO` desde la administración de roles.

### 5.2 Tablas y vistas que solo se leen

- **Personal y estructura:**
  - `DRI_MA_PERSONAL` (incluida la función `F_CONTACTO_CONCAT` para el correo);
  - `DRI_MA_ASIG_CARGO`, `DRI_MA_CARGO`, `DRI_MA_CARGO_ESCALA`, `DRI_MA_ESCALA`,
    `DRI_MA_GRUPO_ESCALA`;
  - `DRI_MA_ESTRUC_ORG`, `DRI_MA_ESTRUC_ZONA`, `DRI_REGIMEN_LABORAL`,
    `DRI_HTR_PERSON_CARGO`;
  - `DRI_MA_PARAM_GENERAL` (parámetros del servicio de correo).
- **Vistas del motor:**
  - `V_DRI_CI_PERSONAL_ACTIVO`, `V_DRI_CI_FAMILIAR`, `V_DRI_CI_DECLARACION`,
    `V_DRI_CI_PROVEEDOR`;
  - `DRI_CI_PLANTILLA_TEMPORAL` (declaraciones).
- **Procedimientos:**
  - `PKG_SISGERH_SERVICES.SP_SELECT_DRI_SG_USUARIO_DP` y
    `SP_SELECT_SS_PERSONAL_EEASA`;
  - `PKG_DRI_CI_PLANTILLA_TEMPORAL.SP_SELECT_PERS_SIN_FORMULARIO`,
    `SP_SELECT_UBICACION_PERSONAL` y `SP_SELECT_PERSONAL_EMAIL`.
- `DRI_CI_ROL` (catálogo; el módulo no lo escribe).

### 5.3 Correos: `sisci.conflictos.correo-redirigir-a`

- Está en `src/main/resources/application.properties`, bloque «DESPLIEGUE
  PRUEBAS».
- La lee `CorreoNotificacionService`. Si tiene valor, **todos** los correos
  del módulo van a esa dirección con el asunto `[PRUEBA para <destinatario
  real>] …`.
- ⚠ **ALERTA: en el repositorio está VACÍO** (`sisci.conflictos.correo-redirigir-a=`).
  - El comentario dice «poner la del equipo antes de empaquetar el WAR de
    pruebas». Con el valor vacío, los correos **van a las personas reales** de
    la base de pruebas.
  - Lo que hay dentro del WAR desplegado en `172.20.35.209` no se puede ver
    desde el código ni desde el Swagger. **Hay que confirmarlo con Sebas antes
    de probar.**
- Qué dispara correos: cada notificación que se crea (correo `@Async` después
  del commit):
  - actividad asignada (al **firmar** un plan);
  - evidencia por revisar (al **subir**);
  - evidencia aprobada o rechazada (al **revisar**);
  - conflicto finalizado;
  - **el aviso diario de vencidas a las 06:00**, que corre solo, sin que nadie
    pruebe nada.
- Los correos del **host** (`/email/notificar-sin-formulario`, el envío que
  agregó Sebas en `/admin`) **no** pasan por esta redirección.

---

## Apartado final

### A. Cómo iniciar sesión real en local (`localhost:4200` → backend de pruebas)

Requisitos comunes:
- El front corre en **`http://localhost:4200`** (CORS no admite otro puerto),
  con `environment.ts` apuntando a `http://172.20.35.209:7001/wssisci/auth/`
  (ya es así).
- Hay acceso a la red de la empresa.
- **La redirección de correos está confirmada** (ver 5.3).
- En la consola del navegador, sobre `localhost:4200`, se limpia la sesión
  simulada y cualquier sesión anterior:
  ```js
  ['SISCI-DEV-SESION-SIMULADA','SISCI-DEV-ROL','SISCI-DEV-EMPLEADO',
   'TOKEN-SISCI','USUARIO-SISCI','TOKEN-INTRANET'].forEach(k => localStorage.removeItem(k));
  ```

**Camino 1 — Token de intranet de PRUEBAS (es el flujo real):**
1. Se inicia sesión con el usuario propio en la **intranet de pruebas**: la
   que valida `http://172.20.35.209:7001/WSIntranet`. Su URL **no está en
   este código** (preguntar a Sebas).
2. En DevTools de la intranet → Application → Local Storage (o Cookies), se
   copia el token de intranet. El host lo llama `TOKEN-INTRANET`; el nombre
   exacto en la intranet está por confirmar.
3. Se abre `http://localhost:4200/?token=<TOKEN>`, o se guarda con
   `localStorage.setItem('TOKEN-INTRANET','<TOKEN>')` y se recarga.
4. El front llama a `getUsuarioIntranet` y guarda `TOKEN-SISCI` y
   `USUARIO-SISCI` con los roles reales.
5. Riesgo: si `WSIntranet` exige que el `agent` coincida con la huella de
   cuando se inició sesión, la huella de `localhost` puede no coincidir. En
   ese caso responde «Error al solicitar información del usuario en Intranet».
   **Por confirmar con Sebas.**

**Camino 2 — Copiar una sesión SISCI de pruebas:** funciona porque el JWT no
expira y el backend relee los roles de la base.
1. Se entra a la app SISCI desplegada en pruebas
   (`http://172.20.35.209:7001/sisci`, según `sisci.public-base-url`) desde la
   intranet, con el usuario propio.
2. En su Local Storage se copian el JWT y el usuario: `TOKEN-SISCI` y
   `USUARIO-SISCI`, o `TOKEN-SISTEC` y `USUARIO-SISTEC` si lo desplegado es
   anterior al cambio de nombre. Es el mismo JWT.
3. En `localhost:4200` se pegan **con los nombres nuevos**:
   ```js
   localStorage.setItem('TOKEN-SISCI', '<JWT>');
   localStorage.setItem('USUARIO-SISCI', '<JSON del usuario, con ROLES>');
   ```
   Hay que comprobar que **no** quede `TOKEN-INTRANET` y recargar. Entra sin
   pasar por la intranet.
4. El menú sale de los `ROLES` de `USUARIO-SISCI`; los permisos reales los
   decide el backend. Si el rol cambia en la base, hay que volver a copiar el
   usuario (o usar el Camino 1) para que el menú se actualice.

**Rol R:**
- El usuario debe tener `R` activo en `DRI_CI_ROL_USUARIO`. Se lo asigna un
  `A` desde «Gestionar Jefes de RRHH» (`POST /rol-usuario`).
- Hay que confirmar con Sebas qué cuenta de prueba tiene `R` (o `A`).

**Rol P:**
- Llega solo cuando se **firma un plan** en el que la persona es responsable
  de una actividad. También se puede asignar a mano con `A`.
- Para tener `R+P` con la cuenta propia: como `R`, se crea un plan, se pone a
  uno mismo como responsable y se firma. Después hay que volver a entrar para
  que `USUARIO-SISCI` traiga `P`.
  - ⚠ La firma notifica y **manda correo** a los responsables.
  - ⚠ Si el rol `P` no existe en `DRI_CI_ROL`, la firma falla (ver 3.2).
- Para probar **solo `P`** hace falta otra cuenta sin `A` ni `R`. En una base
  con personal real, eso significa coordinar con una persona de verdad o con
  una cuenta de prueba que dé Sebas.

**Lo que falta para poder hacerlo:**
1. La URL de la intranet de pruebas y el nombre exacto del token (Camino 1),
   o el acceso a la app SISCI de pruebas (Camino 2).
2. Una cuenta con `R` y, si se quiere `P` puro, una segunda cuenta.
3. La confirmación de que el WAR de pruebas tiene
   `correo-redirigir-a` con la dirección del equipo.
4. La confirmación de que el rol `P` existe en `DRI_CI_ROL` de pruebas.

### B. Diferencias entre front y backend que hay que corregir antes de probar

| # | Diferencia | Impacto | Quién |
|---|---|---|---|
| 1 | `GET /planes/{id}/documento` exige A/R, pero «Ver documento del plan» del Responsable lo llama | 403 para usuarios que son solo `P` | Decidir con Sebas: abrir a `P` (sus planes) en el backend u ocultar el botón en el front |
| 2 | `correo-redirigir-a` vacío en la configuración de pruebas del repo | Correos reales a personal real, también el aviso diario de las 06:00 | Sebas (WAR de pruebas). **Bloqueante** |
| 3 | No hay login local para el personal interno (`obtenerValidacionUsuario` existe, pero ninguna pantalla lo usa) | No se puede probar con sesión real sin copiar un token | Seguir el apartado A; no hace falta código para el viernes |
| 4 | Interceptor con ramas `generarTokenSisci` / `getUsuarioInformacionSisgerh`, que no existen en el backend | Ninguno (código muerto) | Opcional, más adelante |
| 5 | El JWT no expira y la huella está desactivada | Un token copiado sirve para siempre | Seguridad del backend: avisar a Sebas, no bloquea la prueba |

Los contratos (URL, parámetros, campos, tipos, enums, paginación y límites)
**coinciden** entre front, código del backend y Swagger desplegado.

### C. Preguntas abiertas de la bitácora (26/10/2026)

| # | Pregunta | Respuesta |
|---|---|---|
| 1 | `PLAN_MAESTRO` / r4091 / Swagger | **Resuelta en parte:** el código r4093 está en local y el Swagger responde en `…/wssisci/v3/api-docs` (y `swagger-ui.html`). El `PLAN_MAESTRO_MODULO_CONFLICTOS.md` sigue sin estar en local. |
| 2 | Cómo iniciar sesión real en local | **Resuelta en parte:** ver el apartado A. Falta la URL de la intranet de pruebas y las cuentas. |
| 3 | `TOKEN-SISCI`, ¿lo pide el backend? | **Resuelta:** no. El backend solo lee `Authorization`; fue decisión del front. **Abierta:** qué otros sistemas usan esos nombres. |
| 4 | `/conflictos/resumen` y filtros de servidor | **Resuelta:** existen. `resumen` da los indicadores del dashboard y `/conflictos` y `/expedientes` filtran por riesgo, estado, clasificación, departamento, análisis, cédula y vencido. Usarlos es una mejora, no hace falta para el viernes. |
| 5 | `/conflictos/reporte` y `/plan/sugerencia` | **Resuelta:** ver 4.3 (Excel RG.01–03 y plantilla de actividades). |
| 6 | Endpoint de personal | **Resuelta:** `/sisgerh/personal` (paginado, sin cédula), `/buscar` y `/{codigo}/ubicacion`. Que `obtenerPersonas`/`PorId` devuelvan vacío es coherente (4.2). |
| 7 | Cómo se asigna el rol `P` | **Resuelta:** automático al firmar un plan, a los responsables (o a mano con `A`). **Abierta:** si `BDD/rol_responsable.sql` ya corrió en pruebas. |
| 8 | Excusas oculta | Sigue abierta: decisión de producto, el backend no tiene nada de Excusas. |
| 9 | `CRITICO` y D/N/H | El backend los define así (enums). Sigue abierta **con RRHH**. |
| 10 | 5 MB | **Resuelta en el código:** 5 MB, PDF/PNG/JPEG por contenido, en plan y evidencias. Si es definitivo lo decide RRHH. |
| 11 | Sin «Deshacer» ni «Consultas recientes» | **Confirmado en el código:** no hay endpoint para deshacer una revisión y la consulta previa no se guarda. Sigue abierta **con RRHH**. |

**Preguntas nuevas para Sebas:**
1. ¿Qué valor tiene `sisci.conflictos.correo-redirigir-a` **en el WAR
   desplegado** en `172.20.35.209`? Si está vacío, no se prueba hasta
   corregirlo.
2. ¿Corrió `BDD/rol_responsable.sql` en pruebas (rol `P` en `DRI_CI_ROL`)? No
   está en el SVN local (`BDD/` en r4079).
3. ¿Está bien que el módulo inserte en `DRI_CI_ROL_USUARIO` (tabla compartida
   con la administración de roles)?
4. ¿El Responsable `P` debe poder ver el documento firmado de su plan
   (`GET /planes/{id}/documento`)?
5. URL de la intranet de pruebas, nombre del token y si `WSIntranet` valida el
   `agent`. ¿Qué cuentas de prueba tienen `R` y `P`?
6. ¿Se va a poner fecha de expiración al JWT y reactivar la huella?
7. ¿Qué otros sistemas usaban `TOKEN-SISTEC` / `USUARIO-SISTEC`?
