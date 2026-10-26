import { Actividad, PlanAccion } from '../models';
import { formatearFechaIso } from './fechas.util';
import { EstadoActividadVista } from './planes.util';

/**
 * Utilidades puras de Revisión de Evidencias.
 *
 * @author Elvis Flores
 */

/** Texto de cada estado de actividad en la vista de RRHH (regla 8). */
const TEXTO_ESTADO_RRHH: Readonly<Record<EstadoActividadVista, string>> = {
  PENDIENTE: 'Pendiente de evidencia',
  EN_REVISION: 'En revisión',
  ACEPTADA: 'Aprobada · Cumplida',
  RECHAZADA: 'Rechazada',
  NO_CUMPLIDA: 'No cumplida',
  VENCIDA: 'Vencida'
};

/**
 * Texto de cada estado en la vista del Responsable (regla 8). No tiene
 * «Vencida»: una actividad vencida sigue pendiente de evidencia para el.
 */
const TEXTO_ESTADO_RESPONSABLE: Readonly<Record<EstadoActividadVista, string>> = {
  PENDIENTE: 'Pendiente',
  EN_REVISION: 'En revisión de RRHH',
  ACEPTADA: 'Aprobada',
  RECHAZADA: 'Rechazada',
  NO_CUMPLIDA: 'No cumplida',
  VENCIDA: 'Pendiente'
};

/** Resumen de la cabecera de Revisión de Evidencias. */
export interface ResumenRevision {
  /** Actividades en revision de planes activos. */
  porRevisar: number;
  /** Evidencias aprobadas hoy (por `fechaRevision`). */
  aprobadasHoy: number;
  /** Evidencias rechazadas hoy. */
  rechazadasHoy: number;
}

/** Actividades de un mismo responsable dentro de un plan. */
export interface GrupoResponsable {
  responsableId: string;
  nombre: string;
  /** Una o dos letras para el avatar. */
  iniciales: string;
  actividades: Actividad[];
}

/**
 * @param estado Estado de la actividad (o `VENCIDA`, calculado con
 * `estadoVistaActividad`).
 * @param vistaResponsable `true` en las pantallas del Responsable.
 * @returns Texto de la insignia de estado.
 * @author Elvis Flores
 */
export function textoEstadoActividad(estado: EstadoActividadVista, vistaResponsable: boolean): string {
  return (vistaResponsable ? TEXTO_ESTADO_RESPONSABLE : TEXTO_ESTADO_RRHH)[estado];
}

/**
 * @param plan Plan de accion.
 * @returns `true` si esta firmado, es decir en ejecucion (con o sin
 * actividades vencidas).
 * @author Elvis Flores
 */
export function esPlanActivo(plan: PlanAccion): boolean {
  return plan.estado === 'FIRMADO';
}

/**
 * Iniciales para el avatar de una persona: primera letra del primer
 * nombre y del primer apellido (`Carlos Andrés Mayorga Sánchez` → `CM`).
 * Con dos o tres palabras, las dos primeras.
 *
 * @param nombre Nombres y apellidos.
 * @returns Una o dos letras en mayuscula; `?` si no hay nombre.
 * @author Elvis Flores
 */
export function iniciales(nombre: string): string {
  const palabras = nombre.trim().split(/\s+/).filter((p) => p !== '');

  if (palabras.length === 0) {
    return '?';
  }

  const segunda = palabras.length >= 4 ? palabras[2] : palabras[1];

  return (palabras[0][0] + (segunda?.[0] ?? '')).toUpperCase();
}

/**
 * Cuenta lo que muestra el resumen: actividades en revision de los planes
 * activos, y evidencias aprobadas y rechazadas hoy (en cualquier plan: un
 * plan que se acaba de cerrar tambien cuenta).
 *
 * @param planes Todos los planes.
 * @param hoy Fecha de hoy (`RELOJ`).
 * @returns El resumen.
 * @author Elvis Flores
 */
export function contarResumen(planes: readonly PlanAccion[], hoy: Date): ResumenRevision {
  const diaHoy = formatearFechaIso(hoy);
  const resumen: ResumenRevision = { porRevisar: 0, aprobadasHoy: 0, rechazadasHoy: 0 };

  for (const plan of planes) {
    for (const actividad of plan.actividades) {
      const evidencia = actividad.evidencia;
      const revisadaHoy = evidencia?.fechaRevision !== undefined
        && formatearFechaIso(new Date(evidencia.fechaRevision)) === diaHoy;

      if (esPlanActivo(plan) && actividad.estado === 'EN_REVISION') {
        resumen.porRevisar++;
      }
      if (revisadaHoy && evidencia?.estado === 'APROBADA') {
        resumen.aprobadasHoy++;
      }
      if (revisadaHoy && evidencia?.estado === 'RECHAZADA') {
        resumen.rechazadasHoy++;
      }
    }
  }

  return resumen;
}

/**
 * Agrupa las actividades de un plan por responsable, en el orden en que
 * aparece cada uno.
 *
 * @param actividades Actividades del plan.
 * @returns Un grupo por responsable.
 * @author Elvis Flores
 */
export function agruparPorResponsable(actividades: readonly Actividad[]): GrupoResponsable[] {
  const grupos = new Map<string, GrupoResponsable>();

  for (const actividad of actividades) {
    const existente = grupos.get(actividad.responsableId);

    if (existente) {
      existente.actividades.push(actividad);
    } else {
      grupos.set(actividad.responsableId, {
        responsableId: actividad.responsableId,
        nombre: actividad.responsableNombre,
        iniciales: iniciales(actividad.responsableNombre),
        actividades: [actividad]
      });
    }
  }

  return [...grupos.values()];
}
