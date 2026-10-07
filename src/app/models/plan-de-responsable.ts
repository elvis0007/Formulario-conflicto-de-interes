import { PlanAccion } from './plan-accion';

/**
 * Un plan de accion visto por uno de sus responsables: `plan.actividades`
 * trae SOLO las actividades de ese empleado (regla 9: el responsable no ve
 * las de los demas). El estado del plan se calcula con todas.
 *
 * Con el backend lo devolvera `GET /responsable/planes` ya filtrado.
 *
 * @author Elvis Flores
 */
export interface PlanDeResponsable {
  /** El plan, con solo las actividades del responsable. */
  plan: PlanAccion;
  /** Cuantas actividades tiene el plan en total (de todos). */
  totalActividades: number;
}
