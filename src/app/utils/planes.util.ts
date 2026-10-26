import { Actividad, EstadoActividad, EstadoPlan, PlanAccion, TipoCierre } from '../models';
import { calcularDiasRestantes } from './fechas.util';

/**
 * Utilidades puras de reglas de negocio de planes de accion.
 *
 * @author Elvis Flores
 */

/**
 * Estados de plan que impiden crear otro plan en el mismo conflicto
 * (ver `hayPlanActivo`).
 */
const ESTADOS_PLAN_VIGENTE: readonly EstadoPlan[] = ['BORRADOR', 'FIRMADO'];

/**
 * Estado de una actividad tal como se muestra en pantalla: los del backend
 * mas `VENCIDA`, que NO existe en el backend (se calcula con `estaVencida`).
 * Solo para presentacion (insignias, filtros, barras); nunca se guarda.
 */
export type EstadoActividadVista = EstadoActividad | 'VENCIDA';

/**
 * Estados que cuentan como vencidos cuando pasa la fecha limite: el
 * responsable no ha dejado nada en manos de RRHH. Misma regla del backend
 * (`AvisoVencidasJob`): una actividad `EN_REVISION` no vence porque la
 * pelota esta del lado de RRHH.
 */
const ESTADOS_VENCIBLES: readonly EstadoActividad[] = ['PENDIENTE', 'RECHAZADA'];

/**
 * Indica si una actividad esta vencida: su fecha limite es anterior a hoy y
 * sigue `PENDIENTE` o `RECHAZADA`. El backend no guarda este dato: se
 * calcula con la fecha de hoy.
 *
 * @param actividad Actividad a evaluar.
 * @param hoy Fecha de hoy; por defecto, la actual (se ignora la hora).
 * @returns `true` si esta vencida; `false` si no tiene fecha limite o esta
 * no es una fecha valida.
 * @author Elvis Flores
 */
export function estaVencida(
  actividad: Pick<Actividad, 'estado' | 'fechaLimite'>,
  hoy: Date = new Date()
): boolean {
  if (!actividad.fechaLimite || !ESTADOS_VENCIBLES.includes(actividad.estado)) {
    return false;
  }

  try {
    return calcularDiasRestantes(actividad.fechaLimite, hoy).vencida;
  } catch (err) {
    console.error('[planes.util.estaVencida] Fecha inválida:', actividad.fechaLimite, err);
    return false;
  }
}

/**
 * Indica si un plan en ejecucion (`FIRMADO`) tiene alguna actividad
 * vencida. Un plan en borrador o cerrado nunca la tiene.
 *
 * @param plan Plan de accion.
 * @param hoy Fecha de hoy; por defecto, la actual.
 * @returns `true` si esta firmado y alguna actividad esta vencida.
 * @author Elvis Flores
 */
export function tieneActividadesVencidas(
  plan: Pick<PlanAccion, 'estado' | 'actividades'>,
  hoy: Date = new Date()
): boolean {
  return plan.estado === 'FIRMADO' && plan.actividades.some((a) => estaVencida(a, hoy));
}

/**
 * Estado de presentacion de una actividad: `VENCIDA` si `estaVencida`; si
 * no, su estado del backend.
 *
 * @param actividad Actividad.
 * @param hoy Fecha de hoy; por defecto, la actual.
 * @returns El estado a mostrar.
 * @author Elvis Flores
 */
export function estadoVistaActividad(
  actividad: Pick<Actividad, 'estado' | 'fechaLimite'>,
  hoy: Date = new Date()
): EstadoActividadVista {
  return estaVencida(actividad, hoy) ? 'VENCIDA' : actividad.estado;
}

/**
 * Resultado de `calcularAvance`.
 */
export interface AvancePlan {
  /** Actividades en estado `ACEPTADA`. */
  cumplidas: number;
  total: number;
  /** Porcentaje entero de 0 a 100; 0 si el plan no tiene actividades. */
  porcentaje: number;
}

/**
 * Deduce el estado de un plan a partir de sus actividades.
 *
 * Orden de las reglas:
 * 1. Sin `fechaInicio` (aun no se envio) → `BORRADOR`.
 * 2. Todas las actividades `ACEPTADA` → `CERRADO`.
 * 3. En otro caso → `FIRMADO` (si tiene vencidas, ver
 *    `tieneActividadesVencidas`).
 *
 * Un plan enviado sin actividades queda `FIRMADO`, no `CERRADO`: cerrar un
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
    && actividades.every((a) => a.estado === 'ACEPTADA');

  if (fechaInicio === undefined || fechaInicio === '') {
    return 'BORRADOR';
  }
  if (todasAprobadas) {
    return 'CERRADO';
  }

  return 'FIRMADO';
}

/**
 * Calcula el avance de un plan: actividades aceptadas sobre el total.
 *
 * @param actividades Actividades del plan.
 * @returns Cumplidas, total y porcentaje redondeado (0 si no hay
 * actividades, sin dividir por cero).
 */
export function calcularAvance(actividades: readonly Actividad[]): AvancePlan {
  const total = actividades.length;
  const cumplidas = actividades
    .filter((a) => a.estado === 'ACEPTADA').length;
  const porcentaje = total === 0 ? 0 : Math.round(cumplidas * 100 / total);

  return { cumplidas, total, porcentaje };
}

/**
 * Regla de negocio: un conflicto nunca tiene mas de un plan activo a la
 * vez. Se usa para deshabilitar «+ Nuevo plan».
 *
 * DECISION: un plan en `BORRADOR` TAMBIEN cuenta. Si no contara, RRHH
 * podria crear un borrador mientras hay otro plan activo y, al enviarlo,
 * quedarian dos activos; o tener varios borradores y enviarlos todos. Con
 * esta regla cada conflicto tiene como maximo un plan «vigente»
 * (`BORRADOR` o `FIRMADO`), y solo se puede crear otro cuando todos los
 * anteriores estan `CERRADO`.
 *
 * @param planes Planes del conflicto.
 * @returns `true` si hay algun plan vigente y no se debe crear otro.
 */
export function hayPlanActivo(planes: readonly PlanAccion[]): boolean {
  return planes.some((plan) => ESTADOS_PLAN_VIGENTE.includes(plan.estado));
}

/** Texto de cada estado de plan (especificacion, seccion 3). */
const TEXTO_ESTADO_PLAN: Readonly<Record<EstadoPlan, string>> = {
  BORRADOR: 'Borrador',
  FIRMADO: 'Activo',
  CERRADO: 'Cerrado'
};

/** Texto de cada tipo de cierre de un plan. */
const TEXTO_TIPO_CIERRE: Readonly<Record<TipoCierre, string>> = {
  CUMPLIDO: 'Cumplido',
  ANTICIPADO: 'Cierre anticipado'
};

/**
 * @param tipo Como se cerro un plan (`PlanAccion.tipoCierre`).
 * @returns «Cumplido» o «Cierre anticipado»; vacio si no se sabe.
 * @author Sebas Constante
 */
export function textoTipoCierre(tipo: TipoCierre | undefined): string {
  return tipo ? TEXTO_TIPO_CIERRE[tipo] : '';
}

/**
 * @param estado Estado de un plan de accion.
 * @param conVencidas `true` si el plan tiene actividades vencidas (ver
 * `tieneActividadesVencidas`); solo afecta a `FIRMADO`.
 * @param tipoCierre Como se cerro (`PlanAccion.tipoCierre`); solo afecta a
 * `CERRADO`. Si no se pasa, el cerrado dice solo «Cerrado».
 * @returns «Borrador», «Activo», «Activo · con vencidas», «Cerrado»,
 * «Cerrado · Cumplido» o «Cerrado · Cierre anticipado».
 * @author Elvis Flores
 */
export function textoEstadoPlan(estado: EstadoPlan, conVencidas = false, tipoCierre?: TipoCierre): string {
  if (estado === 'CERRADO' && tipoCierre) {
    return TEXTO_ESTADO_PLAN.CERRADO + ' · ' + textoTipoCierre(tipoCierre);
  }

  return estado === 'FIRMADO' && conVencidas
    ? 'Activo · con vencidas'
    : TEXTO_ESTADO_PLAN[estado];
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
  const vigente = planes.find((plan) => plan.estado !== 'CERRADO');

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

/**
 * Una actividad esta completa si tiene descripcion, responsable y un
 * plazo valido: meses y dias enteros >= 0 y no ambos en 0. Es lo que
 * exige «Enviar y notificar».
 *
 * @param actividad Actividad del plan.
 * @returns `true` si esta completa.
 * @author Elvis Flores
 */
export function actividadCompleta(
  actividad: Pick<Actividad, 'descripcion' | 'responsableId' | 'plazoMeses' | 'plazoDias'>
): boolean {
  const { plazoMeses, plazoDias } = actividad;
  const plazoValido = Number.isInteger(plazoMeses) && Number.isInteger(plazoDias)
    && plazoMeses >= 0 && plazoDias >= 0 && plazoMeses + plazoDias > 0;

  return actividad.descripcion.trim() !== '' && actividad.responsableId.trim() !== '' && plazoValido;
}

/** Un responsable de un plan y cuantas actividades tiene. */
export interface ResponsablePlan {
  id: string;
  nombre: string;
  actividades: number;
}

/**
 * Responsables distintos de un plan, en el orden en que aparecen, con
 * cuantas actividades tiene cada uno. Omite las actividades sin
 * responsable.
 *
 * @param actividades Actividades del plan.
 * @returns Un elemento por responsable.
 * @author Elvis Flores
 */
export function responsablesDelPlan(actividades: readonly Actividad[]): ResponsablePlan[] {
  const porId = new Map<string, ResponsablePlan>();

  for (const actividad of actividades) {
    if (!actividad.responsableId) {
      continue;
    }

    const existente = porId.get(actividad.responsableId);

    if (existente) {
      existente.actividades++;
    } else {
      porId.set(actividad.responsableId, {
        id: actividad.responsableId,
        nombre: actividad.responsableNombre,
        actividades: 1
      });
    }
  }

  return [...porId.values()];
}
