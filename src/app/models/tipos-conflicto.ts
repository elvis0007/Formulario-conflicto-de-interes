/**
 * Tipos enumerados del dominio de gestión de conflictos.
 *
 * @author Elvis Flores
 */

/** Nivel de riesgo asignado a un conflicto de interes. */
export type Riesgo = 'alto' | 'medio' | 'bajo' | 'ninguno';

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
 * Resultado de la revision de RRHH sobre un conflicto detectado.
 *
 * - `pendiente`: aun no revisado.
 * - `confirmado`: el parentesco es real.
 * - `homonimo`: coincidencia de nombres sin parentesco real (se descarta).
 */
export type Clasificacion = 'pendiente' | 'confirmado' | 'homonimo';

/**
 * Estado del analisis de conflictos.
 *
 * - `borrador`: recien generado; RRHH puede clasificar los casos.
 * - `validado`: RRHH lo valido; ya no se puede reclasificar.
 */
export type EstadoAnalisis = 'borrador' | 'validado';

/**
 * Estado de un plan de accion.
 *
 * `activo_vencidas` es un plan en ejecucion que tiene al menos una
 * actividad vencida.
 */
export type EstadoPlan = 'borrador' | 'activo' | 'activo_vencidas' | 'cerrado';

/**
 * Estado de una actividad de un plan de accion.
 *
 * `en_revision` significa que el responsable subio evidencia y RRHH aun no la
 * aprueba ni la rechaza.
 */
export type EstadoActividad =
  | 'pendiente'
  | 'en_revision'
  | 'aprobada'
  | 'rechazada'
  | 'vencida';
