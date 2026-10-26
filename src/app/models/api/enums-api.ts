/**
 * Uniones de string equivalentes a los enums del backend. En el JSON los enums
 * viajan como su nombre (`name()`), exactamente con estos valores.
 *
 * @author Integración backend
 */

/** `Riesgo` (eeasa_ci_conflicto). */
export type RiesgoApi = 'BAJO' | 'MEDIO' | 'ALTO' | 'CRITICO';

/** `Clasificacion` (eeasa_ci_conflicto): el Java solo define las letras D, N y H. */
export type ClasificacionApi = 'D' | 'N' | 'H';

/** `EstadoSeguimiento` (eeasa_ci_conflicto). Cerrados: `FINALIZADO` y `DESCARTADO`. */
export type EstadoSeguimientoApi =
  | 'DETECTADO'
  | 'EN_ANALISIS'
  | 'EN_PLANIFICACION'
  | 'EN_EJECUCION'
  | 'FINALIZADO'
  | 'DESCARTADO';

/** `EstadoAnalisis` (eeasa_ci_conflicto). */
export type EstadoAnalisisApi = 'BORRADOR' | 'VALIDADO';

/** `Origen` (eeasa_ci_conflicto). */
export type OrigenApi = 'DECLARADO' | 'DETECTADO_AUTO';

/** `Parentesco` (eeasa_ci_conflicto). */
export type ParentescoApi =
  | 'CONYUGE'
  | 'PADRE'
  | 'HIJO'
  | 'SUEGRO'
  | 'YERNO'
  | 'ABUELO'
  | 'HERMANO'
  | 'NIETO'
  | 'CUNADO'
  | 'BISABUELO'
  | 'TIO'
  | 'SOBRINO'
  | 'BISNIETO'
  | 'PRIMO'
  | 'OTRO';

/** `TipoGrado` (eeasa_ci_conflicto): C = consanguinidad, A = afinidad, O = otro. */
export type TipoGradoApi = 'C' | 'A' | 'O';

/** `TipoRelacion` (eeasa_ci_conflicto): el Java solo define F y P. */
export type TipoRelacionApi = 'F' | 'P';

/** `EstadoPlan` (eeasa_ci_plan). */
export type EstadoPlanApi = 'BORRADOR' | 'FIRMADO' | 'CERRADO';

/** `TipoCierre` (eeasa_ci_plan). */
export type TipoCierreApi = 'CUMPLIDO' | 'ANTICIPADO';

/** `EstadoActividad` (eeasa_ci_plan). */
export type EstadoActividadApi =
  | 'PENDIENTE'
  | 'EN_REVISION'
  | 'ACEPTADA'
  | 'RECHAZADA'
  | 'NO_CUMPLIDA';

/** `EstadoRevision` de una evidencia (eeasa_ci_plan). */
export type EstadoRevisionApi = 'PENDIENTE' | 'APROBADA' | 'RECHAZADA';

/** `MetodoFirma` (eeasa_ci_plan). */
export type MetodoFirmaApi = 'FISICA' | 'ELECTRONICA';

/** `TipoPersonaPlan` (eeasa_ci_plan): tipo de involucrado en un plan. D, F, J o I. */
export type TipoPersonaPlanApi = 'D' | 'F' | 'J' | 'I';

/** `TipoNotificacion` (eeasa_ci_notificacion). */
export type TipoNotificacionApi =
  | 'ACTIVIDAD_ASIGNADA'
  | 'EVIDENCIA_POR_REVISAR'
  | 'EVIDENCIA_APROBADA'
  | 'EVIDENCIA_RECHAZADA'
  | 'ACTIVIDAD_VENCIDA'
  | 'CONFLICTO_FINALIZADO';

/** `TipoConsulta` (eeasa_ci_consulta_previa). */
export type TipoConsultaApi = 'ASPIRANTE' | 'PROVEEDOR';

/** `FuenteCoincidencia` (eeasa_ci_consulta_previa). */
export type FuenteCoincidenciaApi = 'NOMINA' | 'DECLARACION';
