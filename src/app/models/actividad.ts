import { Evidencia } from './evidencia';
import { EstadoActividad } from './tipos-conflicto';

/**
 * Tarea concreta dentro de un plan de accion, asignada a un responsable.
 *
 * @author Elvis Flores
 */
export interface Actividad {
    id: string;
    descripcion: string;
    /** Id de la persona responsable de ejecutar la actividad. */
    responsableId: string;
    /** Nombre del responsable, para mostrarlo sin otra consulta. */
    responsableNombre: string;
    /** Parte en meses del plazo, contado desde el inicio del plan. */
    plazoMeses: number;
    /** Parte en dias del plazo; se suma a `plazoMeses`. */
    plazoDias: number;
    /**
     * Fecha limite calculada (ISO 8601). No existe mientras el plan esta en
     * borrador, porque aun no tiene fecha de inicio.
     */
    fechaLimite?: string;
    estado: EstadoActividad;
    /** Ultima evidencia subida por el responsable, si la hay. */
    evidencia?: Evidencia;
}
