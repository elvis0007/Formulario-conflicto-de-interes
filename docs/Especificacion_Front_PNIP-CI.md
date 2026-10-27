# Especificación del Front-end · Sistema de Conflicto de Interés (PNIP.CI) · EEASA

> **Para quién es este documento:** para Claude (u otro asistente), que a partir de él debe armar un **cronograma de trabajo** y **prompts diarios** para construir **solo el front-end en Angular**.
> El back-end lo desarrolla otra persona: el front debe trabajar contra **servicios con datos simulados (mocks)** que respeten los contratos descritos aquí, para conectarse al API real después sin reescribir pantallas.
>
> **Referencia visual:** `Sistema Conflicto de Interés (PNIP.CI).html` (mockup navegable en esta misma carpeta). Ábrelo en el navegador: arriba hay una barra para cambiar de rol (RRHH / Responsable) y de pantalla. Todo lo descrito aquí está dibujado ahí.

---

## 1. Contexto

- **Qué es:** un módulo para gestionar **conflictos de interés por parentesco** entre empleados de la Empresa Eléctrica Ambato (EEASA). Parte de un formulario que llena cada empleado declarando a sus familiares. Con esos formularios se genera un análisis que detecta parentescos. RRHH clasifica cada caso y crea **planes de acción** con actividades. Los **responsables** de esas actividades suben evidencias, y RRHH las aprueba o rechaza hasta cerrar el plan.
- **Dónde vive:** dentro de la **aplicación Angular existente de EEASA**, la misma donde los empleados llenan el formulario. Esa app ya tiene:
  - una cabecera azul marino con el logo de EEASA;
  - un menú lateral compacto de íconos;
  - un pie de página;
  - una pantalla de "Formularios recibidos", cuyo diseño se copia en este módulo.
- **Alcance del front:**
  - todas las pantallas;
  - navegación y estados visuales;
  - validaciones de formulario;
  - servicios mock;
  - modelos TypeScript.
- **Fuera del alcance del front:**
  - base de datos y API;
  - el algoritmo que detecta parentescos;
  - el envío real de correos y notificaciones;
  - la generación real de PDF y Excel (en el front solo se dispara la descarga).

## 2. Roles y usuarios

| Rol | Qué hace | Pantallas |
|---|---|---|
| **RRHH (Talento Humano)** | Revisa formularios, genera y clasifica el análisis, crea planes, revisa evidencias, consulta informes e historial | Dashboard, Formularios (Conflicto de Interés, Excusas), Conflicto (Análisis, Consulta Previa), Plan de Acción, Informe General, Revisión de Evidencias, Historial |
| **Responsable** | Ejecuta las actividades que le asignan y sube evidencias | Dashboard del responsable, Bandeja (Mis planes de acción) |

El rol viene de la sesión o autenticación de la app host. El front solo lee el rol y muestra el menú correspondiente: se necesita un *guard* por rol.

## 3. Reglas de negocio (el front debe respetarlas y reflejarlas)

1. **Un conflicto** es una relación entre dos personas: un empleado y un familiar, o dos empleados.
   - **Relación:** Consanguinidad o Afinidad.
   - **Grado:** 1er, 2do, 3er o 4to grado.
   - **Riesgo:** Alto, Moderado, Bajo o Ninguno.
2. **Clasificación** de cada caso del análisis: *Pendiente de revisión*, *Conflicto confirmado* u *Homónimo*.
   - Un **homónimo** se archiva y no admite planes.
   - La clasificación se hace **dentro del modal "Ver detalles"**, no en la tabla.
   - Una vez **validado el análisis** ("Validar análisis") ya no se puede reclasificar.
3. **Un conflicto puede tener varios planes de acción, pero nunca más de un plan activo.** Si hay uno activo, los anteriores están **cerrados**. Solo se puede crear un plan nuevo cuando no queda ninguno activo; el botón se deshabilita con un mensaje explicativo.
4. **Estados del plan:**
   - *Borrador*: aún no se envía.
   - *Activo*.
   - *Activo · con vencidas*: tiene al menos una actividad vencida.
   - *Cerrado*: todas sus actividades están cumplidas.
   Un plan cerrado es **solo lectura**.
5. **Al Plan de Acción solo se entra desde Análisis de Conflictos.** No aparece en el menú.
6. **Fecha de inicio del plan:** no se escribe a mano. Se registra automáticamente **el día en que se pulsa "Enviar y notificar"**. Ese botón **solo se habilita si ya se subió el documento firmado (PDF)**. Flujo: crear actividades → subir documento firmado → Enviar y notificar → el plan queda Activo y se notifica a los responsables.
7. **Plazo de las actividades:** no hay fecha fin. Se define un **plazo en meses y días**.
   - **Fecha límite** = fecha de inicio del plan + meses + días.
   - Mientras el plan no se envía, la fecha límite muestra "Se calcula al enviar y notificar".
8. **Estados de una actividad y su evidencia:**

   | Vista | Estados |
   |---|---|
   | RRHH | Pendiente de evidencia, En revisión, Aprobada / Cumplida, Rechazada (con motivo), Vencida |
   | Responsable | Pendiente, En revisión de RRHH, Rechazada, Aprobada |

   - Si se **rechaza**, el motivo es obligatorio y el responsable puede **volver a subir** la evidencia.
   - Una actividad está **vencida** si pasó su fecha límite sin evidencia aprobada.
9. **El responsable solo ve sus propias actividades** dentro de cada plan, aunque el plan tenga más. Se le indica "Solo ves las actividades que te corresponden (2 de 3)".
10. **Notificaciones:** no van en el menú. Se abren desde la **campana de la esquina superior derecha**, que muestra un contador de no leídas, un panel desplegable y "Marcar todas como leídas".

## 4. Sistema de diseño

**Tipografía** (Google Fonts):
- **Barlow** (400, 500, 600, 700) para el texto.
- **Barlow Condensed** (500, 600, 700) para títulos, números grandes y nombres de conflicto.

**Colores** (definirlos como variables CSS globales):

```css
--paper:#FFFFFF; --bg:#F2F2F3; --surface:#E9E9EA; --hairline:#D4D4D7; --border:#B7B7BA;
--text3:#7A7A7D; --text2:#5D5D60; --ink:#1D1F20;
--accent-100:#EEF6FF; --accent-300:#BDD8F2; --accent:#5980A6; --accent-700:#416180; --accent-900:#1D2D3D;
--green:#2F7D43; --green-fill:#E6EFE6; --green-text:#1F5730;
--amber:#B0740A; --amber-fill:#F8EEDA; --amber-text:#7A4F05;
--red:#B3352B; --red-fill:#F9E6E3; --red-text:#8A251D;
--orange:#C1610F; --orange-fill:#FBEADB; --orange-text:#8A4409;
--gray:#7A7A7D; --gray-fill:#E7E7EA; --gray-text:#424244;
--navy-form:#1F3A5F; /* cabeceras de tablas en las pantallas de Formularios (igual a la app host) */
```

**Significado fijo de los colores de estado.** Siempre van con texto, nunca solo color.

| Color | Significado |
|---|---|
| Rojo | Riesgo alto, vencido, "con vencidas" |
| Ámbar | Riesgo moderado, pendiente, borrador |
| Verde | Riesgo bajo, aprobado, cumplido, cerrado |
| Azul (accent) | Activo, en ejecución, información |
| Naranja | Rechazado |
| Gris | En revisión, homónimo, ninguno |

**Componentes visuales:**
- **Tarjetas:** fondo blanco, borde 1px `--hairline`, radio 10–12px, al pasar el mouse sube 1px con sombra suave.
- **Badges (píldoras):** radio 999px, 11–12px, peso 700, fondo `*-fill` y texto `*-text`.
- **Botones:**
  - primario en `--accent` con texto blanco;
  - secundario blanco con borde;
  - peligro o rechazo en naranja;
  - aprobar en verde;
  - acciones de tabla cuadradas de 42×38 con ícono (ojo o flecha).
- **Tablas:**
  - cabecera en `--surface`, o en azul marino `--navy-form` en las pantallas de Formularios;
  - filas alternas `#F6F8FB` en Formularios;
  - la fila se resalta en `--accent-100` al pasar el mouse o al estar expandida.
- **Modales:**
  - fondo oscuro semitransparente;
  - cabecera azul oscura o `--accent-100`;
  - se cierran con la X, clic afuera o Esc;
  - animación corta de aparición (≈160 ms).
- **Íconos:** trazo lineal de 1.8–2px. Se sugiere una librería como Lucide o Tabler.

**Layout:**
- Barra lateral de 240px en `--accent-900`, con grupos desplegables.
- Barra superior de 64px, con breadcrumb a la izquierda y campana a la derecha.
- Contenido con padding de 24–32px.
- Diseñado para **escritorio (≥1366px)**. En pantallas pequeñas las tablas hacen scroll horizontal.

## 5. Estructura de navegación

**Menú RRHH:**
- **Dashboard**
- **Formularios** ▸ (grupo desplegable)
  - Conflicto de Interés
  - Excusas
- **Conflicto** ▸ (grupo desplegable)
  - Análisis de Conflictos
  - Consulta Previa
- **Informe General**
- **Revisión de Evidencias**
- **Historial**

*Plan de Acción no aparece en el menú: se llega desde Análisis. Cuando se está en él, queda resaltado "Análisis de Conflictos".*

**Menú Responsable:**
- Dashboard
- Bandeja de Tareas (Mis planes de acción)

**Rutas sugeridas** (lazy loading):
- `/pnip/rrhh/dashboard`
- `/pnip/rrhh/formularios/conflicto-interes`
- `/pnip/rrhh/formularios/excusas`
- `/pnip/rrhh/conflictos/analisis`
- `/pnip/rrhh/conflictos/consulta-previa`
- `/pnip/rrhh/conflictos/:conflictoId/planes/:planId` (plan de acción)
- `/pnip/rrhh/informe-general`
- `/pnip/rrhh/revision-evidencias`
- `/pnip/rrhh/historial`
- `/pnip/responsable/dashboard`
- `/pnip/responsable/planes`
- `/pnip/responsable/planes/:planId`

**Breadcrumb en la barra superior.** Ejemplo: `Conflicto › Análisis de Conflictos › Plan de Acción`.

## 6. Pantallas (detalle)

### 6.1 Shell común
- **Sidebar** con grupos desplegables (chevron que rota), el ítem activo resaltado en `--accent` y el usuario (iniciales, nombre y rol) al pie.
- **Campana de notificaciones:**
  - contador rojo de no leídas;
  - panel desplegable de 410px con la lista: punto de color, título, texto y tiempo relativo;
  - las no leídas llevan fondo tintado;
  - botón "Marcar todas como leídas";
  - pie "Se muestran las notificaciones de los últimos 7 días".
  - Se cierra al hacer clic fuera.

### 6.2 RRHH · Dashboard
- **Selector de periodo:** Este mes / Trimestre / Año / Todo. Filtra todo el dashboard.
- **5 indicadores clicables que filtran la tabla:**
  - Total conflictos (con el número de planes);
  - Conflictos activos;
  - Conflictos sin plan;
  - Actividades vencidas;
  - Conflictos cerrados.
  El indicador activo se marca con un anillo.
- **Franja "Filtrando: …"** con el botón "Limpiar filtros" cuando hay filtros aplicados.
- **Tres tarjetas:**
  - **Conflictos por nivel de riesgo:** barras horizontales clicables que filtran, con tooltip.
  - **Estado de actividades:** barra apilada con tooltips por segmento y leyenda con conteos (cumplido, en ejecución, en revisión, pendiente, vencido).
  - **Formulario de declaración:** porcentaje de empleados que lo llenaron, barras por departamento y enlace "Ver pendientes" a Formularios.
- **Tabla "Conflictos"** con buscador:
  - columnas N.º, Empleado / Familiar, Riesgo, Avance de planes (barra y porcentaje) y Estado;
  - al hacer clic en una fila se despliegan **sus planes y, dentro de cada plan, sus actividades** con el estado de cada una;
  - si no tiene plan, muestra un aviso con el botón "Crear plan desde el análisis".
- **Actividad reciente** con pestañas: Todas / Evidencias / Alertas / Validaciones.

### 6.3 RRHH · Formularios › Conflicto de Interés
*Copia el diseño de la pantalla "Formularios recibidos" de la app host: cabeceras azul marino y tabla con filas alternas.*
- **Encabezado:** título "Formulario de Conflicto de Interés", código PNIP.CI.RG.01 y botón **"Generar análisis de conflictos"**, que lleva a Análisis.
- **Pestañas:** "Formularios recibidos" | "No han llenado formulario (n)".
- **Pestaña Formularios recibidos:**
  - Barra "FORMULARIOS RECIBIDOS (n)".
  - Filtros: origen (Todos / Interno / Externo), tipo de contrato (Ocasional, Permanente, Servicios ocasionales LOEP, Nombramientos provisionales LOEP), rango de fechas (desde / A / hasta), buscador y botón **EXPORTAR** (Excel).
  - Tabla con columnas: Nombre (MAYÚSCULAS, apellidos primero), Cédula, Origen (badge verde Interno / naranja Externo), Tipo (Inicial / Actualización), Tipo de contrato, Fecha (formato "2 de septiembre de 2026 a las 09:14 a. m."), Acciones.
  - Acciones:
    - 👁 abre un modal con el formulario completo: datos del declarante y tabla de familiares declarados (parentesco, nombre, cédula, "Trabaja / No trabaja en la empresa"), y el botón "Descargar PDF";
    - ⌄ expande la fila y muestra los familiares declarados.
  - Paginación: "Mostrar [10] registros", "Página 1 de 1", Anterior / Siguiente.
- **Pestaña No han llenado:**
  - Tabla con Nombre, Cédula, Origen, Cargo, Departamento, Recordatorio (último envío) y Acciones.
  - Acción "Enviar recordatorio" por fila, que cambia a "Enviado ✓".
  - Botón "Enviar recordatorio a todos".

### 6.4 RRHH · Formularios › Excusas
*Mismo diseño que 6.3; los campos exactos están por confirmar.*
- Barra "EXCUSAS RECIBIDAS (n)".
- Filtros: origen, tipo de proceso (Proceso de selección / Proceso de compra / Evaluación de desempeño), fechas, buscador y Exportar.
- Tabla con columnas: Nombre, Cédula, Origen, Proceso (con su detalle), Familiar relacionado (y su parentesco), Fecha, Acciones.
  - 👁 abre un modal con el formulario completo.
  - ⌄ muestra el motivo de la excusa y el reemplazo designado.

### 6.5 RRHH · Conflicto › Análisis de Conflictos (RG.02)
- **Encabezado:** título, badge Borrador / Validado, código, número de casos pendientes de clasificar, botón "Ver formularios" y botón **"Validar análisis"** (bloquea la clasificación).
- **Filtros por riesgo** en píldoras: Todos, Alto, Moderado, Bajo, Ninguno, con conteos.
- **Tabla:**
  - **Involucrados:** los dos nombres separados por una línea vertical. Debajo de cada uno va su rol.
    - Si el rol es distinto: "Tío | Sobrino", "Hija | Padre".
    - Si es simétrico, **una sola etiqueta centrada**: "Hermanos", "Cónyuges", "Primos".
  - **Relación:** Consanguinidad / Afinidad.
  - **Grado:** 1er–4to grado.
  - **Departamentos:** el de cada persona.
  - **Riesgo:** badge.
  - **Estado:** badge de clasificación.
  - **Detalles:** botón "Ver detalles".
  - **Plan de acción:**
    - *Sin plan* → "+ Crear plan de acción".
    - *1 plan* → botón "Ver plan de acción", que abre ese plan.
    - *Varios planes* → tarjeta del **plan actual**, más el **mismo botón de flecha** que en Formularios. Al hacer clic se abre **debajo de la fila** la lista de todos los planes del conflicto (nombre, estado, inicio, "x de y actividades cumplidas", "Abrir plan →"). El actual se marca con "· actual".
    - *Homónimo* → "Archivado", con la fila atenuada.
- **Modal "Ver detalles":**
  - Cabecera: "Conflicto #id · Nombre A y Nombre B" y badge de riesgo.
  - Franja: Parentesco · Relación · Grado.
  - **Dos tarjetas**, una por persona: cédula, cargo, departamento, jefe inmediato, fecha de ingreso, padre, madre y cónyuge.
  - "Riesgo identificado": texto.
  - "Cómo se detectó": lista de evidencias del cruce.
  - **Clasificación del caso:** 3 opciones tipo *radio card*, observación opcional y los botones "Cancelar" / "Guardar clasificación". Guardar actualiza el badge en la tabla.

### 6.6 RRHH · Plan de Acción (FR.02) · *solo desde Análisis*
- **Cabecera:**
  - enlace "← Volver a Análisis de Conflictos";
  - breadcrumb;
  - código, conflicto, "Plan 02 · Nombre (2 de 2)" y estado;
  - botones "Imprimir formulario", "Guardar borrador" y **"Enviar y notificar"**.
- **"Planes de este conflicto":**
  - una pestaña por plan, con su estado;
  - botón "+ Nuevo plan", **deshabilitado si hay un plan activo**, con el mensaje "Solo puede haber un plan activo…".
- **Tarjeta del caso:** Empleado, Familiar, Parentesco, Departamento, Riesgo.
- **Banner "Fecha de inicio del plan":**
  - *Pendiente · se registra al enviar y notificar*, en ámbar;
  - *dd/mm/aaaa · plan enviado y notificado*, en verde;
  - *dd/mm/aaaa · cerrado el …*, en gris.
- **Tabla de actividades:**
  - Actividad (input de texto).
  - Responsable (select de empleados).
  - **Plazo:** dos inputs numéricos, "[0] meses [15] días".
  - **Fecha límite:** calculada, con el texto "Plazo: 15 días".
  - Botón para quitar la actividad.
  - Botón "+ Agregar actividad".
  - **En un plan cerrado todo queda en solo lectura** y se ocultan los botones de agregar y quitar.
- **Documento del plan:**
  - "Subir documento firmado (PDF)". Si falta, se muestra el aviso "Sube el documento firmado para habilitar «Enviar y notificar»".
  - Ya subido: "archivo.pdf — subido el dd/mm/aaaa".
- **Tras enviar:** aviso "Notificación enviada a la bandeja de tareas de cada responsable".

### 6.7 RRHH · Informe General (RG.03)
- Buscador, filtros (Todos / En ejecución / Con vencidas / Cerrados), "Expandir todo" / "Contraer todo" y "Descargar Excel".
- **Tabla agrupada por conflicto:**
  - columnas: chevron, Conflicto, Empleado / Familiar, Parentesco, Riesgo, **Planes** ("2 planes"), Avance (barra segmentada por actividad, con tooltip) y Estado;
  - al desplegar se muestra **un bloque por plan**: cabecera con nombre, estado, inicio y "x de y cumplidas";
  - debajo, la tabla de actividades con Actividad, Responsable, Plazo, Fecha límite (en rojo si está vencida) y Estado.

### 6.8 RRHH · Revisión de Evidencias
- **Resumen:** badges "n por revisar", "n aprobadas hoy" y "n rechazadas hoy".
- **Tarjetas** en cuadrícula de 3 columnas, **una por conflicto con plan activo**: número, riesgo, personas, plan activo, "n por revisar" y "x de y aprobadas".
- **Al hacer clic en una tarjeta se abre un MODAL:**
  - Cabecera: "Conflicto #0231 — Plan 02 · Nombre", estado, personas y la X para cerrar.
  - **Actividades agrupadas por responsable:** a la izquierda las iniciales y el nombre del responsable; a la derecha sus actividades.
  - Cada actividad muestra la descripción, la fecha límite y el archivo de evidencia (nombre y fecha de subida). Si no hay evidencia: "Sin evidencia todavía".
  - Acciones de cada actividad: **Ver documento · Aprobar · Rechazar**.
    - Rechazar pide el motivo en un textarea y luego "Confirmar rechazo".
    - Una actividad ya resuelta muestra su badge y la opción "Deshacer".
  - **Visor de documento:** al pulsar "Ver documento", el modal se ensancha y el documento se muestra **a la izquierda**, al estilo de un visor de PDF. La lista de actividades queda a la derecha.
    - Barra del visor: nombre del archivo, quién lo subió y cuándo, zoom − / + y **Descargar**, que cambia a "Descargado ✓".
    - La actividad que se está viendo queda resaltada ("Viendo documento").

### 6.9 RRHH · Historial
- Buscador y filtros (Todos / Activos / Cerrados).
- **Tarjetas** en 4 columnas, una por conflicto: número, estado, personas, parentesco, riesgo, número de planes y fecha de detección.
- **Al hacer clic se abre un MODAL con un árbol desplegable** que se va abriendo con cada clic:

  ```
  Conflicto #0231
  ├─ Eventos del conflicto → (detectado, confirmado…)
  ├─ Plan 01 · … [Cerrado]
  │   ├─ eventos del plan (creado, enviado, cerrado)
  │   ├─ Actividad 1 [Cumplida] → sus eventos (asignada, evidencia subida, aprobada…)
  │   └─ Actividad 2 …
  └─ Plan 02 · … [Activo]
      └─ …
  ```

  - Cada evento lleva un punto de color, el texto y la línea "fecha · autor".
  - Botones "Expandir todo" y "Contraer todo".

### 6.10 RRHH · Conflicto › Consulta Previa a Contratación
- Formulario de búsqueda por cédula, nombres o apellidos de un candidato.
- Botón "Consultar": muestra si el candidato tiene familiares dentro de la empresa antes de contratarlo.
- Tiene estado vacío ("aún no se ha buscado") y estado con resultados.

### 6.11 Responsable · Dashboard
- Saludo "Hola, {nombre}" y botón "Ir a mi bandeja".
- **Alerta roja** si tiene actividades vencidas, con el botón "Ver vencidas".
- **Indicadores clicables** que filtran la lista: Pendientes, Rechazadas, En revisión y Aprobadas. También un **Avance general** en barra apilada.
- **"Mis actividades abiertas":**
  - conflicto · personas · plan;
  - estado, "Vence en n días" o "Vencida hace n días";
  - botón "Subir evidencia" / "Volver a subir".
- **"Próximos vencimientos":** cajita con el día y el mes, y los días restantes.
- **"Avance por conflicto":** acordeón conflicto › plan › actividades.

### 6.12 Responsable · Bandeja (Mis planes de acción)
- **Lista:** las actividades llegan agrupadas como **tarjetas de plan** ("Conflicto #0231 · Plan 02 · Nombre"), separadas en "Planes activos" y "Planes cerrados".
  - Cada tarjeta muestra chips con conteo por estado ("1 rechazada", "1 en revisión"), "Tus actividades: 2 de 3 del plan", el próximo vencimiento o las vencidas, y "Ver plan →".
- **Detalle del plan:**
  - enlace "← Mis planes de acción";
  - cabecera con conflicto, plan y estado;
  - datos: Involucrados, Parentesco, Riesgo, Inicio del plan, Asignado por y Mis actividades;
  - aviso "Solo ves las actividades que te corresponden";
  - **tarjetas de sus actividades**: descripción, plazo y fecha límite, badge de vencimiento, estado, archivo subido, motivo del rechazo (en caja naranja) y botón **"Subir evidencia" / "Volver a subir evidencia"**.
  - Al subir la evidencia, la actividad pasa a "En revisión de RRHH".

## 7. Modelo de datos del front (interfaces TypeScript sugeridas)

```ts
type Riesgo = 'alto' | 'medio' | 'bajo' | 'ninguno';
type Relacion = 'Consanguinidad' | 'Afinidad';
type Clasificacion = 'pendiente' | 'confirmado' | 'homonimo';
type EstadoPlan = 'borrador' | 'activo' | 'activo_vencidas' | 'cerrado';
type EstadoActividad = 'pendiente' | 'en_revision' | 'aprobada' | 'rechazada' | 'vencida';

interface Persona { id: string; nombres: string; cedula: string; cargo: string; departamento: string;
  jefeInmediato?: string; fechaIngreso?: string; padre?: string; madre?: string; conyuge?: string; }

interface Conflicto { id: string; personaA: Persona; rolA: string; personaB: Persona; rolB: string;
  etiquetaSimetrica?: string; relacion: Relacion; grado: 1|2|3|4; riesgo: Riesgo;
  clasificacion: Clasificacion; motivoRiesgo: string; evidenciasDeteccion: string[];
  fechaDeteccion: string; planes: PlanAccion[]; }

interface PlanAccion { id: string; numero: number; nombre: string; conflictoId: string;
  estado: EstadoPlan; fechaInicio?: string; fechaCierre?: string;
  documentoFirmado?: Archivo; actividades: Actividad[]; }

interface Actividad { id: string; descripcion: string; responsableId: string; responsableNombre: string;
  plazoMeses: number; plazoDias: number; fechaLimite?: string; estado: EstadoActividad;
  evidencia?: Evidencia; }

interface Evidencia { archivo: Archivo; fechaSubida: string; estado: 'pendiente'|'aprobada'|'rechazada';
  motivoRechazo?: string; revisadoPor?: string; }

interface Archivo { nombre: string; url: string; tipo: 'pdf'|'png'|'jpg'; }

interface FormularioCI { id: string; nombre: string; cedula: string; origen: 'Interno'|'Externo';
  tipo: 'Inicial'|'Actualización'; tipoContrato: string; fecha: string; cargo: string;
  departamento: string; estadoCivil: string; correo: string; familiares: FamiliarDeclarado[]; }

interface FamiliarDeclarado { parentesco: string; nombre: string; cedula: string; trabajaEnEmpresa: boolean; }

interface Excusa { id: string; nombre: string; cedula: string; origen: 'Interno'|'Externo';
  proceso: string; detalleProceso: string; familiar: string; parentesco: string;
  motivo: string; reemplazo: string; fecha: string; }

interface EventoHistorial { fecha: string; autor: string; texto: string;
  tipo: 'info'|'ok'|'rechazo'|'vencido'|'cierre'; nivel: 'conflicto'|'plan'|'actividad'; refId: string; }

interface Notificacion { id: string; titulo: string; texto: string; fecha: string; leida: boolean;
  tipo: 'info'|'ok'|'rechazo'|'vencido'|'alerta'; }
```

**Cálculos que hace el front** (en un servicio o *pipe* reutilizable):
- **Fecha límite:** `inicio + meses + días`.
- **Días restantes:** "Vence en n días" o "Vencida hace n días".
- **Estado del plan:** derivado del estado de sus actividades.
- **Avance:** cumplidas / total.
- **Formato de fechas:** `dd/mm/aaaa` y el formato largo "2 de septiembre de 2026 a las 09:14 a. m.".

## 8. Contratos de API esperados (a mockear; el back los implementa)

| Método | Endpoint (sugerido) | Uso |
|---|---|---|
| GET | `/formularios/conflicto-interes?origen&contrato&desde&hasta&q&page` | Formularios recibidos |
| GET | `/formularios/conflicto-interes/pendientes` | Empleados que no han llenado |
| POST | `/formularios/conflicto-interes/recordatorios` `{cedulas[]}` | Enviar recordatorio |
| GET | `/formularios/excusas?...` | Excusas |
| POST | `/analisis/generar` · GET `/analisis/actual` | Generar y obtener el análisis |
| PATCH | `/analisis/casos/:id/clasificacion` `{clasificacion, observacion}` | Clasificar un caso |
| POST | `/analisis/:id/validar` | Validar el análisis |
| GET | `/conflictos/:id` · GET `/conflictos/:id/planes` | Detalle y planes |
| POST/PUT | `/planes` · `/planes/:id` | Crear o guardar un borrador |
| POST | `/planes/:id/documento` (multipart) | Subir el documento firmado |
| POST | `/planes/:id/enviar` | Enviar y notificar (el back fija la fecha de inicio) |
| GET | `/evidencias/pendientes` · GET `/planes/:id/actividades` | Revisión de evidencias |
| POST | `/actividades/:id/evidencia` (multipart) | El responsable sube una evidencia |
| POST | `/actividades/:id/aprobar` · `/rechazar` `{motivo}` | RRHH revisa |
| GET | `/archivos/:id` (blob) | Ver o descargar un documento |
| GET | `/historial/conflictos/:id` | Árbol de eventos |
| GET | `/informes/general?...` · `/informes/general/excel` | Informe y exportación |
| GET | `/dashboard/rrhh?periodo` · `/dashboard/responsable` | Indicadores |
| GET | `/responsable/planes` · `/responsable/planes/:id` | Planes y actividades del responsable |
| GET/POST | `/notificaciones` · `/notificaciones/leer-todas` | Campana |
| GET | `/consulta-previa?cedula&nombres&apellidos` | Consulta previa |

*Todo el acceso a datos pasa por servicios Angular. Cada servicio tiene una implementación mock con datos de ejemplo iguales a los del mockup y otra HTTP; se cambia de una a otra con una bandera en `environment` o con un interceptor.*

## 9. Recomendaciones técnicas para el front (Angular)

- **Integración:** construirlo como una **feature lazy-loaded** dentro de la app host, con su propio routing y estilos encapsulados, sin romper los estilos globales de la host.
- **Componentes standalone.** Si la versión de Angular lo permite, usar *signals* o `BehaviorSubject` para el estado de UI (filtros, expandidos, modales) y formularios reactivos con validaciones.
- **Componentes compartidos a construir primero:**
  - `Badge`, `KpiCard`, `DataTable` (con filas expandibles, paginación y filtros);
  - `ExpandArrowButton`, `Modal`, `DocumentViewer` (visor de PDF con zoom y descarga);
  - `Tabs/Pills`, `Timeline/TreeView`, `NotificationBell`, `Sidebar` con grupos, `Breadcrumb`;
  - `EmptyState`, `ConfirmReject` (textarea con motivo obligatorio).
- **Pipes y servicios utilitarios:**
  - `fechaLarga`, `diasRestantes`, `plazoTexto`;
  - `estadoPlan`, que deriva el estado a partir de las actividades.
- **Accesibilidad:**
  - `aria-label` en los botones de ícono;
  - cerrar los modales con Esc y manejar el foco dentro de ellos;
  - los estados siempre con texto además del color.
- **Calidad:**
  - pruebas unitarias de los cálculos (fechas, plazos, estado del plan, regla de un solo plan activo);
  - pruebas de componentes clave;
  - ESLint y Prettier.

## 10. Datos por confirmar antes o durante el desarrollo

1. **App host:**
   - versión de Angular;
   - librería de UI que usa (Angular Material, PrimeNG, Bootstrap…);
   - cómo se obtienen el usuario y el rol;
   - si el sidebar de este módulo convive con el menú de íconos de la host o lo reemplaza.
2. **Excusas:** campos definitivos del formulario de excusas.
3. **Consulta Previa:** estructura del resultado.
4. **Exportar y descargas:** si el Excel y el PDF los genera el back (recomendado) o el front.
5. **Visor de documentos:** si se usa un componente de PDF (por ejemplo `ngx-extended-pdf-viewer`) o un `<iframe>` con la URL del archivo.
6. **Catálogos:** tipos de contrato, departamentos, parentescos y grados que vienen del back.

## 11. Orden sugerido de trabajo (para armar el cronograma)

1. **Base:**
   - estructura de la feature;
   - routing y guards por rol;
   - variables de diseño y tipografías;
   - modelos TypeScript;
   - servicios mock con los datos de ejemplo.
2. **Shell:**
   - sidebar con grupos desplegables;
   - barra superior con breadcrumb;
   - campana de notificaciones.
3. **Componentes compartidos:** badge, tabla, modal, flecha expandible, tabs, KPI y visor de documento.
4. **Formularios:** Conflicto de Interés (las dos pestañas y el modal) y Excusas.
5. **Análisis de Conflictos:**
   - tabla de involucrados;
   - modal "Ver detalles" con clasificación;
   - columna de planes con la flecha;
   - validar el análisis.
6. **Plan de Acción:**
   - pestañas de planes;
   - regla de un solo plan activo;
   - actividades con plazo en meses y días;
   - subir documento → Enviar y notificar;
   - modo solo lectura.
7. **Revisión de Evidencias:** tarjetas, modal por responsable, aprobar y rechazar, visor de documento a la izquierda.
8. **Responsable:** bandeja por planes, detalle del plan, subir evidencia y dashboard del responsable.
9. **Informe General e Historial:** tabla agrupada y árbol en el modal.
10. **Dashboard RRHH:** indicadores, filtros cruzados y gráficos.
11. **Consulta Previa.**
12. **Pulido:**
    - estados vacíos, de carga y de error;
    - accesibilidad y pruebas;
    - revisión visual contra el mockup;
    - preparación para conectar el API real.

*Complejidad relativa:*
- **Alta:** Plan de Acción, Análisis, Revisión de Evidencias y Dashboard RRHH.
- **Media:** Formularios, Bandeja del responsable, Historial e Informe.
- **Baja:** Excusas, Consulta Previa y Dashboard del responsable.

## 12. Cambios por la integración con el backend (26/10/2026)

La integración con el backend `wssisci` (Sebas Constante, commit `38b38ae`)
cambió algunas cosas respecto de lo que RRHH aprobó en esta especificación y
en los mockups. Donde esta sección contradice a las anteriores, **manda esta
sección** (es lo que hace el código). Los puntos marcados «por confirmar»
están en la lista de preguntas de la bitácora (26/10/2026).

| Tema | Lo aprobado (§3, §6, §7) | Lo que hace ahora | Estado |
|---|---|---|---|
| Clasificación del conflicto | Confirmado / pendiente / descartado | `D` declarado, `N` no declarado, `H` homónimo; `null` sin clasificar. `H` exige observación y descarta el caso | Por confirmar con RRHH |
| Nivel de riesgo | Ninguno, Bajo, Moderado, Alto | `BAJO`, `MEDIO` (se muestra «Moderado»), `ALTO`, **`CRITICO`**; desaparece «Ninguno» | Por confirmar con RRHH |
| Estado del conflicto | Derivado en el front (sin plan, en ejecución, con vencidas, cerrado) | Lo da el backend: `DETECTADO`, `EN_ANALISIS`, `EN_PLANIFICACION`, `EN_EJECUCION`, `FINALIZADO`, `DESCARTADO`. «Con vencidas» sigue calculándose en el front | Hecho |
| Análisis | Se guarda | Además se **valida** (`BORRADOR` → `VALIDADO`) | Hecho |
| Firma del plan | Subir el documento firmado y luego enviar | Firmar y enviar en **un solo paso** (`POST /planes/{id}/firmar`, multipart). «Quitar documento» solo existe en la pantalla, antes de enviar | Hecho |
| Cierre del plan | Automático al aprobar la última actividad | Automático (`CUMPLIDO`) **y anticipado** (`ANTICIPADO`) con motivo obligatorio | Hecho |
| Revisión de evidencias | Aprobar / rechazar, con «Deshacer» | Aprobar / rechazar es **definitivo**: **sin «Deshacer»** (el backend no lo tiene) | Por confirmar con RRHH |
| Actividad no cumplida | No existía | Estado `NO_CUMPLIDA` (lo pone el backend) | Hecho |
| Consulta previa | Con «Consultas recientes» | **Sin «Consultas recientes»** (el backend no guarda las consultas). Pide cédula, nombres y apellidos | Por confirmar con RRHH |
| Tamaño máximo de archivos | 10 MB | **5 MB** para el plan firmado y las evidencias (PDF, PNG o JPG) | Por confirmar |
| Excusas | Pantalla §6.4 | **Fuera del sprint, oculta.** La guía dice «se oculta del menú»; el menú no se tocó y solo tiene la descarga del PDF de excusa de siempre | Por confirmar |
| Notificaciones | El front las agrega | Las crea y filtra el backend; el front solo las muestra y marca como leídas | Hecho |
| Reglas de permisos | Las aplicaba el front | Las aplica el backend (403): quien sube no revisa y nadie decide sobre su propio conflicto. El front muestra el mensaje | Hecho |
| Descargar Excel (Análisis RG.02, Informe General RG.03) | Solo confirmación visual | Descarga el `.xlsx` real con los datos de `GET /conflictos/reporte` (27/10/2026). Una fila por conflicto: el Excel del RG.03 no trae el detalle de planes y actividades. Con la sesión simulada: «Disponible con sesión real» | Hecho; por confirmar columnas con RRHH |
| Plan de mitigación sugerido (§3) | El sistema sugiere y RRHH completa | «Cargar actividades sugeridas» en el borrador (27/10/2026): excusa y seguimiento siempre; reasignar la supervisión con riesgo Alto o Crítico; evaluar la reubicación con Crítico. Se agregan sin responsable; si la tabla ya tiene actividades, pide confirmación | Hecho |
| Errores del backend | — | Sesión vencida: aviso con «Iniciar sesión». Sin conexión: aviso con «Reintentar». Sin permiso: aviso, la pantalla sigue. Archivos: límite de 5 MB y tipos permitidos (27/10/2026) | Hecho |
| Documento del plan para el Responsable (§6.12) | El responsable ve el plan firmado | El backend solo deja verlo a RRHH: quien es solo `P` ve «El documento del plan solo lo puede ver RRHH.» | **Pendiente con Sebas** |

Con la sesión simulada de desarrollo, los mocks siguen estas mismas reglas
y estados. Detalle técnico: [ARQUITECTURA.md](ARQUITECTURA.md#qué-es-real-y-qué-es-simulado)
y [INTEGRACION_BACKEND.md](INTEGRACION_BACKEND.md).
