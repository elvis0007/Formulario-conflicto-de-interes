import { Archivo } from './archivo';

/**
 * Evidencia que sube un responsable para demostrar que cumplio una
 * actividad, y el resultado de su revision por RRHH.
 *
 * @author Elvis Flores
 */
export interface Evidencia {
  /** Identificador de la evidencia (el backend lo usa para revisarla). */
  id: string;
  archivo: Archivo;
  /** Fecha y hora de subida, en formato ISO 8601. */
  fechaSubida: string;
  /** Resultado de la revision de RRHH. */
  estado: 'PENDIENTE' | 'APROBADA' | 'RECHAZADA';
  /** Explicacion de RRHH; solo existe si `estado` es `RECHAZADA`. */
  motivoRechazo?: string;
  /** Nombre de quien reviso la evidencia. */
  revisadoPor?: string;
  /**
   * Fecha y hora de la revision (ISO 8601); solo si se aprobo o rechazo.
   * Sirve para contar «aprobadas hoy» y «rechazadas hoy».
   */
  fechaRevision?: string;
}
