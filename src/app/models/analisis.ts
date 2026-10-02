import { Conflicto } from './conflicto';
import { EstadoAnalisis } from './tipos-conflicto';

/**
 * Analisis de conflictos vigente (PNIP.CI.RG.02): el resultado de cruzar
 * los formularios y fichas de personal para detectar parentescos.
 *
 * Solo existe un analisis «actual». Volver a generarlo lo reemplaza y lo
 * deja en Borrador.
 *
 * @author Elvis Flores
 */
export interface AnalisisConflictos {
  /**
   * `borrador` (se puede reclasificar), `validado` (ya no) o `null` si
   * nunca se genero un analisis.
   */
  estado: EstadoAnalisis | null;
  /** Fecha y hora de la ultima generacion (ISO 8601); `null` si nunca. */
  fechaGeneracion: string | null;
  /** Casos detectados; vacio si nunca se genero. */
  conflictos: Conflicto[];
}
