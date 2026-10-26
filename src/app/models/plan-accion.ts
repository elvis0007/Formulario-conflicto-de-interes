import { Actividad } from './actividad';
import { Archivo } from './archivo';
import { EstadoPlan, TipoCierre } from './tipos-conflicto';

/**
 * Plan de accion definido por RRHH para mitigar un conflicto de interes.
 *
 * @author Elvis Flores
 */
export interface PlanAccion {
  id: string;
  /** Numero correlativo del plan dentro de su conflicto (1, 2, 3...). */
  numero: number;
  nombre: string;
  /** Id del conflicto al que pertenece el plan. */
  conflictoId: string;
  estado: EstadoPlan;
  /** Cuando se creo el borrador (ISO 8601). */
  fechaCreacion?: string;
  /** Quien lo creo (RRHH). */
  creadoPor?: string;
  /** Fecha en que el plan pasa a firmado (en ejecucion) (ISO 8601). */
  fechaInicio?: string;
  /** Fecha en que el plan se cerro (ISO 8601). */
  fechaCierre?: string;
  /** Como se cerro el plan; solo existe si `estado` es `CERRADO`. */
  tipoCierre?: TipoCierre;
  /** Motivo del cierre; obligatorio en el cierre `ANTICIPADO`. */
  motivoCierre?: string;
  /** Documento del plan firmado por las partes. */
  documentoFirmado?: Archivo;
  actividades: Actividad[];
}
