/**
 * Tipos enumerados del dominio de gestión de conflictos.
 *
 * @author Elvis Flores
 */

/**
 * Nivel de riesgo asignado a un conflicto de interes (valores del backend).
 * La consulta previa sin coincidencias no tiene riesgo: usa `null`.
 */
export type Riesgo = 'BAJO' | 'MEDIO' | 'ALTO' | 'CRITICO';

/**
 * Tipo de parentesco entre las dos personas de un conflicto:
 * por sangre (`Consanguinidad`) o por matrimonio/union (`Afinidad`).
 */
export type Relacion = 'Consanguinidad' | 'Afinidad';

/**
 * Grado de parentesco: 1 (padres/hijos, suegros/yernos) a 4 (primos).
 * Entre conyuges no hay grado: ese caso usa `null` (ver `Conflicto.grado`).
 */
export type GradoParentesco = 1 | 2 | 3 | 4;

/**
 * Resultado de la clasificacion de RRHH sobre un conflicto detectado
 * (valores del backend). Sin clasificar es `null` (ver
 * `Conflicto.clasificacion`).
 *
 * - `D`: declarado, el parentesco es real y el empleado lo declaro.
 * - `N`: no declarado (omision), el parentesco es real pero no se declaro.
 * - `H`: homonimo, coincidencia de nombres sin parentesco real (se descarta).
 */
export type Clasificacion = 'D' | 'N' | 'H';

/**
 * Estado de seguimiento de un conflicto (lo calcula el backend).
 * `FINALIZADO` lo pone solo el sistema al aprobar la ultima evidencia.
 */
export type EstadoSeguimiento =
  | 'DETECTADO'
  | 'EN_ANALISIS'
  | 'EN_PLANIFICACION'
  | 'EN_EJECUCION'
  | 'FINALIZADO'
  | 'DESCARTADO';

/**
 * Estado del analisis de conflictos.
 *
 * - `BORRADOR`: recien generado; RRHH puede clasificar los casos.
 * - `VALIDADO`: RRHH lo valido; ya no se puede reclasificar.
 */
export type EstadoAnalisis = 'BORRADOR' | 'VALIDADO';

/**
 * Estado de un plan de accion.
 *
 * - `BORRADOR`: aun no se firma ni se envia.
 * - `FIRMADO`: en ejecucion.
 * - `CERRADO`: terminado (ver `TipoCierre`).
 *
 * «Con actividades vencidas» ya no es un estado: se calcula con
 * `tieneActividadesVencidas` (`utils/planes.util.ts`).
 */
export type EstadoPlan = 'BORRADOR' | 'FIRMADO' | 'CERRADO';

/**
 * Como se cerro un plan: `CUMPLIDO` (todas las actividades aceptadas) o
 * `ANTICIPADO` (RRHH lo cerro con actividades abiertas; ver
 * `PlanAccion.motivoCierre`).
 */
export type TipoCierre = 'CUMPLIDO' | 'ANTICIPADO';

/**
 * Estado de una actividad de un plan de accion.
 *
 * - `EN_REVISION`: el responsable subio evidencia y RRHH aun no la aprueba
 *   ni la rechaza.
 * - `NO_CUMPLIDA`: quedo abierta cuando el plan se cerro de forma anticipada.
 *
 * «Vencida» ya no es un estado: se calcula con `estaVencida`
 * (`utils/planes.util.ts`).
 */
export type EstadoActividad =
  | 'PENDIENTE'
  | 'EN_REVISION'
  | 'ACEPTADA'
  | 'RECHAZADA'
  | 'NO_CUMPLIDA';
