import { PlanAccion } from './plan-accion';
import { Riesgo } from './tipos-conflicto';

/**
 * Un plan de accion visto por uno de sus responsables: `plan.actividades`
 * trae SOLO las actividades de ese empleado (regla 9: el responsable no ve
 * las de los demas). El estado del plan se calcula con todas.
 *
 * Con el backend sale de `GET /actividades/mias`, ya filtrado. El rol P no
 * puede pedir `/conflictos` (403): los datos del caso que muestran sus
 * pantallas vienen aqui, tal como los trae la bandeja.
 *
 * @author Elvis Flores
 */
export interface PlanDeResponsable {
  /** El plan, con solo las actividades del responsable. */
  plan: PlanAccion;
  /** Cuantas actividades tiene el plan en total (de todos). */
  totalActividades: number;
  /** Nombre de la persona A del conflicto (`NOMBRE_A`); vacio si no viene. */
  nombreA: string;
  /** Nombre de la persona B del conflicto (`NOMBRE_B`); vacio si no viene. */
  nombreB: string;
  /** Parentesco entre A y B en una linea; vacio si no viene. */
  parentesco: string;
  /** Riesgo del conflicto; `null` si no viene. */
  riesgo: Riesgo | null;
}
