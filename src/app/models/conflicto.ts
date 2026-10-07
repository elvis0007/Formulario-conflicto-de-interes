import { Persona } from './persona';
import { PlanAccion } from './plan-accion';
import { Clasificacion, GradoParentesco, Relacion, Riesgo } from './tipos-conflicto';

/**
 * Relacion de parentesco detectada entre dos personas de la empresa que
 * puede generar un conflicto de interes.
 *
 * @author Elvis Flores
 */
export interface Conflicto {
  id: string;
  personaA: Persona;
  /** Papel de la persona A en el conflicto (p. ej. `Jefe`). */
  rolA: string;
  personaB: Persona;
  /** Papel de la persona B en el conflicto (p. ej. `Subordinado`). */
  rolB: string;
  /**
   * Texto que describe el vinculo cuando es igual en ambos sentidos
   * (p. ej. `Hermanos`); si no existe se muestran `rolA` y `rolB`.
   */
  etiquetaSimetrica?: string;
  relacion: Relacion;
  /**
   * Grado de parentesco (1 = padres/hijos ... 4 = primos). `null` cuando
   * no hay grado: entre conyuges. La pantalla muestra «No aplica».
   */
  grado: GradoParentesco | null;
  riesgo: Riesgo;
  clasificacion: Clasificacion;
  /** Observacion opcional que RRHH dejo al clasificar el caso. */
  observacionClasificacion?: string;
  /**
   * Cuando se clasifico en el analisis (ISO 8601). Lo usa el Historial;
   * los datos de ejemplo no lo traen (se toma la fecha de deteccion).
   */
  fechaClasificacion?: string;
  /** Quien clasifico el caso. */
  clasificadoPor?: string;
  /** Explicacion de por que se asigno el nivel de `riesgo`. */
  motivoRiesgo: string;
  /** Datos que llevaron a detectar el conflicto (formularios, nombres...). */
  evidenciasDeteccion: string[];
  /** Fecha de deteccion (ISO 8601). */
  fechaDeteccion: string;
  planes: PlanAccion[];
}
