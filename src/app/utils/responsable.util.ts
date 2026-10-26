import { Actividad, PlanAccion, PlanDeResponsable } from '../models';
import { DiasRestantes, calcularDiasRestantes, formatearFecha, parsearFecha } from './fechas.util';
import { EstadoActividadVista, estadoVistaActividad } from './planes.util';
import { Tono, mapearEstadoActividadATono } from './tono.util';

/**
 * Utilidades puras de las pantallas del Responsable (dashboard, Bandeja de
 * Tareas y detalle del plan). Reciben planes que ya traen solo las
 * actividades del responsable (`PlanDeResponsable`).
 *
 * @author Elvis Flores
 */

/**
 * Filtro de la Bandeja por estado de las actividades del responsable. Usa
 * los estados de presentacion (incluye `VENCIDA`, calculado con la fecha).
 */
export type FiltroEstado = 'todas' | EstadoActividadVista;

/** Opcion del filtro por estado. */
export interface OpcionFiltroEstado {
  valor: FiltroEstado;
  /** Texto de la pildora y del indicador. */
  etiqueta: string;
  tono: Tono;
}

/** Filtros de la Bandeja, en el orden en que se muestran. */
export const FILTROS_ESTADO: readonly OpcionFiltroEstado[] = [
  { valor: 'todas', etiqueta: 'Todas', tono: 'azul' },
  { valor: 'PENDIENTE', etiqueta: 'Pendientes', tono: mapearEstadoActividadATono('PENDIENTE', false) },
  { valor: 'EN_REVISION', etiqueta: 'En revisión', tono: mapearEstadoActividadATono('EN_REVISION', false) },
  { valor: 'RECHAZADA', etiqueta: 'Rechazadas', tono: mapearEstadoActividadATono('RECHAZADA', false) },
  { valor: 'VENCIDA', etiqueta: 'Vencidas', tono: mapearEstadoActividadATono('VENCIDA', false) },
  { valor: 'ACEPTADA', etiqueta: 'Aprobadas', tono: mapearEstadoActividadATono('ACEPTADA', false) }
];

/** Estados con algo por hacer para el responsable. */
const ESTADOS_POR_HACER: readonly EstadoActividadVista[] = ['RECHAZADA', 'VENCIDA', 'PENDIENTE'];

/**
 * Cuantas actividades hay en cada estado de presentacion. Una actividad
 * vencida cuenta como `VENCIDA` y no como `PENDIENTE`/`RECHAZADA`.
 */
export type ConteoEstados = Record<EstadoActividadVista, number>;

/** Una actividad abierta con su plan y lo que falta para su fecha limite. */
export interface ActividadProxima {
  actividad: Actividad;
  plan: PlanAccion;
  /** Fecha limite «dd/mm/aaaa». */
  fechaLimite: string;
  /** «Vence en n días», «Vence hoy» o «Vencida hace n días». */
  dias: DiasRestantes;
}

/**
 * @param valor Valor leido de la URL (`?estado=`).
 * @returns `true` si es un filtro valido.
 * @author Elvis Flores
 */
export function esFiltroEstado(valor: string | null | undefined): valor is FiltroEstado {
  return FILTROS_ESTADO.some((f) => f.valor === valor);
}

/**
 * @param actividades Actividades del responsable.
 * @param hoy Fecha de hoy, para decidir cuales estan vencidas.
 * @returns Cuantas hay en cada estado.
 * @author Elvis Flores
 */
export function contarEstados(actividades: readonly Actividad[], hoy: Date = new Date()): ConteoEstados {
  const conteo: ConteoEstados = {
    PENDIENTE: 0, EN_REVISION: 0, ACEPTADA: 0, RECHAZADA: 0, NO_CUMPLIDA: 0, VENCIDA: 0
  };

  for (const actividad of actividades) {
    conteo[estadoVistaActividad(actividad, hoy)]++;
  }

  return conteo;
}

/**
 * @param planes Planes del responsable.
 * @returns Todas sus actividades.
 * @author Elvis Flores
 */
export function actividadesDe(planes: readonly PlanDeResponsable[]): Actividad[] {
  return planes.flatMap((p) => p.plan.actividades);
}

/**
 * @param plan Plan del responsable.
 * @param filtro Filtro elegido.
 * @param hoy Fecha de hoy, para decidir cuales estan vencidas.
 * @returns `true` si tiene al menos una actividad en ese estado (o si el
 * filtro es «Todas»).
 * @author Elvis Flores
 */
export function planCoincideConFiltro(
  plan: PlanDeResponsable,
  filtro: FiltroEstado,
  hoy: Date = new Date()
): boolean {
  return filtro === 'todas'
    || plan.plan.actividades.some((a) => estadoVistaActividad(a, hoy) === filtro);
}

/**
 * @param actividades Actividades del responsable.
 * @param hoy Fecha de hoy, para decidir cuales estan vencidas.
 * @returns Cuantas tienen algo por hacer (rechazadas, vencidas, pendientes).
 * @author Elvis Flores
 */
export function contarPorHacer(actividades: readonly Actividad[], hoy: Date = new Date()): number {
  return actividades.filter((a) => ESTADOS_POR_HACER.includes(estadoVistaActividad(a, hoy))).length;
}

/**
 * Ordena la Bandeja: primero los planes con algo por hacer (los que tienen
 * rechazadas, luego vencidas, luego pendientes), despues los demas activos
 * y al final los cerrados. Dentro de cada grupo, por conflicto y numero.
 *
 * @param planes Planes del responsable.
 * @param hoy Fecha de hoy, para decidir cuales actividades estan vencidas.
 * @returns Copia ordenada.
 * @author Elvis Flores
 */
export function ordenarPorUrgencia(
  planes: readonly PlanDeResponsable[],
  hoy: Date = new Date()
): PlanDeResponsable[] {
  const urgencia = (p: PlanDeResponsable): number => {
    const indice = ESTADOS_POR_HACER.findIndex((e) =>
      p.plan.actividades.some((a) => estadoVistaActividad(a, hoy) === e));

    if (indice >= 0) {
      return indice;
    }
    return p.plan.estado === 'CERRADO' ? ESTADOS_POR_HACER.length + 1 : ESTADOS_POR_HACER.length;
  };

  return [...planes].sort((a, b) => urgencia(a) - urgencia(b)
    || a.plan.conflictoId.localeCompare(b.plan.conflictoId)
    || a.plan.numero - b.plan.numero);
}

/**
 * «Próximas a vencer» del dashboard: actividades pendientes o rechazadas
 * con fecha limite, de la mas cercana (o mas vencida) a la mas lejana.
 *
 * @param planes Planes del responsable.
 * @param hoy Fecha de hoy (`RELOJ`).
 * @returns Actividades con su plan y los dias restantes.
 * @author Elvis Flores
 */
export function proximasAVencer(planes: readonly PlanDeResponsable[], hoy: Date): ActividadProxima[] {
  const proximas: ActividadProxima[] = [];

  for (const { plan } of planes) {
    for (const actividad of plan.actividades) {
      if ((actividad.estado !== 'PENDIENTE' && actividad.estado !== 'RECHAZADA') || !actividad.fechaLimite) {
        continue;
      }
      try {
        proximas.push({
          actividad,
          plan,
          fechaLimite: formatearFecha(parsearFecha(actividad.fechaLimite)),
          dias: calcularDiasRestantes(actividad.fechaLimite, hoy)
        });
      } catch (err) {
        console.error('[responsable.util.proximasAVencer] Fecha inválida:', actividad.id, err);
      }
    }
  }

  return proximas.sort((a, b) => a.dias.dias - b.dias.dias);
}

/**
 * @param actividad Actividad.
 * @returns Plazo legible: «4 meses y 25 días», «1 mes», «15 días».
 * @author Elvis Flores
 */
export function textoPlazo(actividad: Pick<Actividad, 'plazoMeses' | 'plazoDias'>): string {
  const partes: string[] = [];

  if (actividad.plazoMeses > 0) {
    partes.push(actividad.plazoMeses + (actividad.plazoMeses === 1 ? ' mes' : ' meses'));
  }
  if (actividad.plazoDias > 0) {
    partes.push(actividad.plazoDias + (actividad.plazoDias === 1 ? ' día' : ' días'));
  }

  return partes.length > 0 ? partes.join(' y ') : 'Sin plazo';
}
