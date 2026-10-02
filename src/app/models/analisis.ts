import { Conflicto } from './conflicto';
import { EstadoAnalisis } from './tipos-conflicto';

/**
 * Analisis de conflictos vigente (PNIP.CI.RG.02): el resultado de cruzar
 * los formularios y fichas de personal para detectar parentescos.
 *
 * Hay un analisis «actual». Generar uno nuevo lo crea en Borrador y el
 * anterior (Borrador o Validado) pasa al historial sin cambios.
 *
 * @author Elvis Flores
 */
export interface AnalisisConflictos {
  /** Identificador del analisis; `null` si nunca se genero. */
  id: string | null;
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

/**
 * Fila del historial de analisis: lo que se muestra de un analisis
 * anterior (solo lectura).
 *
 * @author Elvis Flores
 */
export interface ResumenAnalisis {
  id: string;
  /** Fecha y hora de generacion (ISO 8601). */
  fechaGeneracion: string;
  estado: EstadoAnalisis;
  /** Numero de casos detectados. */
  totalCasos: number;
  /** Cuantos quedaron como conflicto confirmado. */
  confirmados: number;
}
