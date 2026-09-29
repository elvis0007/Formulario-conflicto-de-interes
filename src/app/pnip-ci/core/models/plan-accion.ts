import { Actividad } from './actividad';
import { Archivo } from './archivo';
import { EstadoPlan } from './tipos';

/**
 * Plan de accion definido por RRHH para mitigar un conflicto de interes.
 *
 * @author EEASA
 */
export interface PlanAccion {
    id: string;
    /** Numero correlativo del plan dentro de su conflicto (1, 2, 3...). */
    numero: number;
    nombre: string;
    /** Id del conflicto al que pertenece el plan. */
    conflictoId: string;
    estado: EstadoPlan;
    /** Fecha en que el plan pasa a activo (ISO 8601). */
    fechaInicio?: string;
    /** Fecha en que el plan se cerro (ISO 8601). */
    fechaCierre?: string;
    /** Documento del plan firmado por las partes. */
    documentoFirmado?: Archivo;
    actividades: Actividad[];
}
