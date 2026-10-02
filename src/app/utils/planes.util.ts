import { Actividad, EstadoPlan, PlanAccion } from '../models';

/**
 * Utilidades puras de reglas de negocio de planes de accion.
 *
 * @author Elvis Flores
 */

/**
 * Estados de plan que impiden crear otro plan en el mismo conflicto
 * (ver `hayPlanActivo`).
 */
const ESTADOS_PLAN_VIGENTE: readonly EstadoPlan[] = [
  'borrador',
  'activo',
  'activo_vencidas'
];

/**
 * Resultado de `calcularAvance`.
 */
export interface AvancePlan {
  /** Actividades en estado `aprobada`. */
  cumplidas: number;
  total: number;
  /** Porcentaje entero de 0 a 100; 0 si el plan no tiene actividades. */
  porcentaje: number;
}

/**
 * Deduce el estado de un plan a partir de sus actividades.
 *
 * Orden de las reglas:
 * 1. Sin `fechaInicio` (aun no se envio) → `borrador`.
 * 2. Todas las actividades `aprobada` → `cerrado`.
 * 3. Alguna actividad `vencida` → `activo_vencidas`.
 * 4. En otro caso → `activo`.
 *
 * Un plan enviado sin actividades queda `activo`, no `cerrado`: cerrar un
 * plan vacio no tiene sentido.
 *
 * ADAPTACION: se pidio `derivarEstadoPlan(actividades)`, pero las
 * actividades no indican si el plan se envio; por eso recibe tambien la
 * `fechaInicio` del plan.
 *
 * @param actividades Actividades del plan.
 * @param fechaInicio `PlanAccion.fechaInicio`; `undefined` si no se envio.
 * @returns Estado derivado del plan.
 */
export function derivarEstadoPlan(
  actividades: readonly Actividad[],
  fechaInicio: string | undefined
): EstadoPlan {
  const todasAprobadas = actividades.length > 0
    && actividades.every((a) => a.estado === 'aprobada');
  const algunaVencida = actividades.some((a) => a.estado === 'vencida');

  if (fechaInicio === undefined || fechaInicio === '') {
    return 'borrador';
  }
  if (todasAprobadas) {
    return 'cerrado';
  }
  if (algunaVencida) {
    return 'activo_vencidas';
  }

  return 'activo';
}

/**
 * Calcula el avance de un plan: actividades aprobadas sobre el total.
 *
 * @param actividades Actividades del plan.
 * @returns Cumplidas, total y porcentaje redondeado (0 si no hay
 * actividades, sin dividir por cero).
 */
export function calcularAvance(actividades: readonly Actividad[]): AvancePlan {
  const total = actividades.length;
  const cumplidas = actividades
    .filter((a) => a.estado === 'aprobada').length;
  const porcentaje = total === 0 ? 0 : Math.round(cumplidas * 100 / total);

  return { cumplidas, total, porcentaje };
}

/**
 * Regla de negocio: un conflicto nunca tiene mas de un plan activo a la
 * vez. Se usa para deshabilitar «+ Nuevo plan».
 *
 * DECISION: un plan en `borrador` TAMBIEN cuenta. Si no contara, RRHH
 * podria crear un borrador mientras hay otro plan activo y, al enviarlo,
 * quedarian dos activos; o tener varios borradores y enviarlos todos. Con
 * esta regla cada conflicto tiene como maximo un plan «vigente»
 * (`borrador`, `activo` o `activo_vencidas`), y solo se puede crear otro
 * cuando todos los anteriores estan `cerrado`.
 *
 * @param planes Planes del conflicto.
 * @returns `true` si hay algun plan vigente y no se debe crear otro.
 */
export function hayPlanActivo(planes: readonly PlanAccion[]): boolean {
  return planes.some((plan) => ESTADOS_PLAN_VIGENTE.includes(plan.estado));
}

/** Texto de cada estado de plan (especificacion, seccion 3). */
const TEXTO_ESTADO_PLAN: Readonly<Record<EstadoPlan, string>> = {
  borrador: 'Borrador',
  activo: 'Activo',
  activo_vencidas: 'Activo · con vencidas',
  cerrado: 'Cerrado'
};

/**
 * @param estado Estado de un plan de accion.
 * @returns «Borrador», «Activo», «Activo · con vencidas» o «Cerrado».
 * @author Elvis Flores
 */
export function textoEstadoPlan(estado: EstadoPlan): string {
  return TEXTO_ESTADO_PLAN[estado];
}

/**
 * Plan «actual» de un conflicto: el que no esta cerrado (solo puede haber
 * uno, ver `hayPlanActivo`) o, si todos estan cerrados, el mas reciente
 * (mayor `numero`).
 *
 * @param planes Planes del conflicto.
 * @returns El plan actual, o `null` si no hay planes.
 * @author Elvis Flores
 */
export function obtenerPlanActual(planes: readonly PlanAccion[]): PlanAccion | null {
  const vigente = planes.find((plan) => plan.estado !== 'cerrado');

  if (vigente !== undefined) {
    return vigente;
  }

  return planes.reduce<PlanAccion | null>(
    (masReciente, plan) => masReciente === null || plan.numero > masReciente.numero
      ? plan
      : masReciente,
    null
  );
}
