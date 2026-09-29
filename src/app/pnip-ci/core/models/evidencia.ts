import { Archivo } from './archivo';

/**
 * Evidencia que sube un responsable para demostrar que cumplio una
 * actividad, y el resultado de su revision por RRHH.
 *
 * @author EEASA
 */
export interface Evidencia {
    archivo: Archivo;
    /** Fecha y hora de subida, en formato ISO 8601. */
    fechaSubida: string;
    /** Resultado de la revision de RRHH. */
    estado: 'pendiente' | 'aprobada' | 'rechazada';
    /** Explicacion de RRHH; solo existe si `estado` es `rechazada`. */
    motivoRechazo?: string;
    /** Nombre de quien reviso la evidencia. */
    revisadoPor?: string;
}
