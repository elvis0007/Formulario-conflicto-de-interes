import {
  Actividad,
  AnalisisConflictos,
  Conflicto,
  EventoHistorial,
  Evidencia,
  PlanAccion
} from '../models';
import { textoClasificacion, textoParentesco, textoRiesgo } from './analisis.util';
import { formatearFecha, formatearFechaIso, parsearFecha } from './fechas.util';
import { textoPlazo } from './responsable.util';
import { Tono } from './tono.util';

/**
 * Utilidades puras del Historial: arman la linea de tiempo de un conflicto
 * a partir de los datos que ya existen (conflicto, analisis y planes). No
 * hay una lista de eventos aparte: lo que se hace en otras pantallas
 * (clasificar, validar, crear o enviar un plan, subir, aprobar o rechazar
 * evidencias, el cierre) aparece aqui en cuanto se vuelve a consultar.
 *
 * Con el backend, `GET /historial/conflictos/:id` devolvera los eventos ya
 * registrados.
 *
 * @author Elvis Flores
 */

/** Tipo de evento. */
export type TipoEvento = EventoHistorial['tipo'];

/** Autor de los eventos automaticos (deteccion, vencimiento, cierre). */
export const AUTOR_SISTEMA = 'Sistema';

/** Autor cuando no se registro quien lo hizo (datos de ejemplo). */
export const AUTOR_RRHH = 'RRHH';

/** Tipos de evento, en el orden del filtro. */
export const TIPOS_EVENTO: readonly TipoEvento[] = ['info', 'ok', 'rechazo', 'vencido', 'cierre'];

/** Texto de cada tipo para el filtro. */
const TEXTO_TIPO: Readonly<Record<TipoEvento, string>> = {
  info: 'Información',
  ok: 'Aprobaciones',
  rechazo: 'Rechazos',
  vencido: 'Vencimientos',
  cierre: 'Cierres'
};

/** Color del punto de cada tipo. */
const TONO_TIPO: Readonly<Record<TipoEvento, Tono>> = {
  info: 'azul',
  ok: 'verde',
  rechazo: 'naranja',
  vencido: 'rojo',
  cierre: 'gris'
};

/** Una actividad con sus eventos. */
export interface NodoActividad {
  actividad: Actividad;
  eventos: EventoHistorial[];
}

/** Un plan con sus eventos y los de sus actividades. */
export interface NodoPlan {
  plan: PlanAccion;
  eventos: EventoHistorial[];
  actividades: NodoActividad[];
}

/** Arbol del historial de un conflicto (tres niveles). */
export interface HistorialConflicto {
  conflicto: Conflicto;
  eventos: EventoHistorial[];
  /** Planes por numero. */
  planes: NodoPlan[];
}

/** @param tipo Tipo. @returns Texto del filtro. */
export function textoTipoEvento(tipo: TipoEvento): string {
  return TEXTO_TIPO[tipo];
}

/** @param tipo Tipo. @returns Color de su punto. */
export function tonoTipoEvento(tipo: TipoEvento): Tono {
  return TONO_TIPO[tipo];
}

/**
 * Instante de una fecha para ordenar: `aaaa-mm-dd` es el inicio de ese dia
 * (hora local); el resto, ISO 8601 con hora.
 *
 * @param fecha Fecha del evento.
 * @returns Milisegundos; `NaN` si no es valida.
 * @author Elvis Flores
 */
export function instanteDe(fecha: string): number {
  try {
    return /^\d{4}-\d{2}-\d{2}$/.test(fecha) ? parsearFecha(fecha).getTime() : new Date(fecha).getTime();
  } catch {
    return Number.NaN;
  }
}

/**
 * Arma el historial de un conflicto.
 *
 * - Conflicto: deteccion; cada analisis que lo incluyo; su clasificacion
 *   (con quien y cuando, o la fecha de deteccion si el dato de ejemplo no
 *   lo trae); la validacion del analisis.
 * - Plan: creado, documento firmado, enviado y notificado, cerrado.
 * - Actividad: asignada (al enviar), cada evidencia subida y su revision
 *   (tambien las rechazadas que se reemplazaron) y el vencimiento si paso
 *   la fecha limite sin una aprobacion a tiempo.
 *
 * @param conflicto Conflicto (datos base).
 * @param planes Planes del conflicto (vigentes).
 * @param analisis Analisis generados en la sesion, del mas antiguo al mas
 * reciente.
 * @param hoy Fecha de hoy (`RELOJ`), para los vencimientos.
 * @returns El arbol, con los eventos de cada nivel en orden cronologico.
 * @author Elvis Flores
 */
export function armarHistorial(
  conflicto: Conflicto,
  planes: readonly PlanAccion[],
  analisis: readonly AnalisisConflictos[],
  hoy: Date
): HistorialConflicto {
  return {
    conflicto,
    eventos: ordenar(eventosDelConflicto(conflicto, analisis)),
    planes: [...planes]
      .sort((a, b) => a.numero - b.numero)
      .map((plan) => ({
        plan,
        eventos: ordenar(eventosDelPlan(plan)),
        actividades: plan.actividades.map((actividad) => ({
          actividad,
          eventos: ordenar(eventosDeActividad(actividad, plan, hoy))
        }))
      }))
  };
}

/**
 * @param historial Arbol.
 * @returns Todos sus eventos, en orden cronologico.
 * @author Elvis Flores
 */
export function todosLosEventos(historial: HistorialConflicto): EventoHistorial[] {
  return ordenar([
    ...historial.eventos,
    ...historial.planes.flatMap((p) => [...p.eventos, ...p.actividades.flatMap((a) => a.eventos)])
  ]);
}

/**
 * @param eventos Eventos.
 * @returns Copia en orden cronologico (los empates mantienen su orden).
 */
function ordenar(eventos: EventoHistorial[]): EventoHistorial[] {
  return eventos
    .map((evento, indice) => ({ evento, indice, instante: instanteDe(evento.fecha) }))
    .sort((a, b) => (a.instante - b.instante) || (a.indice - b.indice))
    .map((x) => x.evento);
}

/**
 * @param conflicto Conflicto.
 * @param analisis Analisis de la sesion.
 * @returns Eventos del nivel conflicto.
 */
function eventosDelConflicto(conflicto: Conflicto, analisis: readonly AnalisisConflictos[]): EventoHistorial[] {
  const refId = conflicto.id;
  const evento = (fecha: string, autor: string, texto: string, tipo: TipoEvento): EventoHistorial =>
    ({ fecha, autor, texto, tipo, nivel: 'conflicto', refId });
  const eventos: EventoHistorial[] = [
    evento(conflicto.fechaDeteccion, AUTOR_SISTEMA,
      'Conflicto detectado: ' + textoParentesco(conflicto) + ' (riesgo '
        + textoRiesgo(conflicto.riesgo).toLowerCase() + ').', 'info')
  ];
  let clasificadoEnSesion = false;

  for (const a of analisis) {
    const caso = a.conflictos.find((c) => c.id === conflicto.id);

    if (caso === undefined || a.id === null) {
      continue;
    }
    if (a.fechaGeneracion) {
      eventos.push(evento(a.fechaGeneracion, AUTOR_RRHH, 'Incluido en el análisis ' + a.id + '.', 'info'));
    }
    if (caso.fechaClasificacion) {
      clasificadoEnSesion = true;
      eventos.push(eventoClasificacion(caso, caso.fechaClasificacion, caso.clasificadoPor ?? AUTOR_RRHH, evento));
    }
    if (a.estado === 'validado' && a.fechaValidacion) {
      eventos.push(evento(a.fechaValidacion, a.validadoPor ?? AUTOR_RRHH, 'Análisis ' + a.id + ' validado.', 'ok'));
    }
  }

  // Dato de ejemplo ya clasificado, sin fecha: se toma la de deteccion.
  if (!clasificadoEnSesion && conflicto.clasificacion !== 'pendiente') {
    eventos.push(eventoClasificacion(conflicto, conflicto.fechaDeteccion, AUTOR_RRHH, evento));
  }

  return eventos;
}

/**
 * @param caso Caso clasificado.
 * @param fecha Fecha del evento.
 * @param autor Quien clasifico.
 * @param evento Constructor del evento.
 * @returns Evento de clasificacion.
 */
function eventoClasificacion(
  caso: Conflicto,
  fecha: string,
  autor: string,
  evento: (fecha: string, autor: string, texto: string, tipo: TipoEvento) => EventoHistorial
): EventoHistorial {
  const observacion = caso.observacionClasificacion ? ' Observación: ' + caso.observacionClasificacion : '';

  if (caso.clasificacion === 'homonimo') {
    return evento(fecha, autor, 'Clasificado como Homónimo: se archiva.' + observacion, 'cierre');
  }
  if (caso.clasificacion === 'pendiente') {
    return evento(fecha, autor, 'Vuelve a Pendiente de revisión.' + observacion, 'info');
  }
  return evento(fecha, autor, 'Clasificado como ' + textoClasificacion(caso.clasificacion) + '.' + observacion, 'ok');
}

/**
 * @param plan Plan.
 * @returns Eventos del nivel plan.
 */
function eventosDelPlan(plan: PlanAccion): EventoHistorial[] {
  const refId = plan.id;
  const autor = plan.creadoPor ?? AUTOR_RRHH;
  const evento = (fecha: string, quien: string, texto: string, tipo: TipoEvento): EventoHistorial =>
    ({ fecha, autor: quien, texto, tipo, nivel: 'plan', refId });
  const eventos: EventoHistorial[] = [];
  const responsables = new Set(plan.actividades.map((a) => a.responsableId)).size;

  if (plan.fechaCreacion) {
    eventos.push(evento(plan.fechaCreacion, autor, 'Plan creado en borrador.', 'info'));
  }
  if (plan.documentoFirmado?.fechaSubida) {
    eventos.push(evento(plan.documentoFirmado.fechaSubida, autor,
      'Documento firmado subido: ' + plan.documentoFirmado.nombre + '.', 'info'));
  }
  if (plan.fechaInicio) {
    eventos.push(evento(plan.fechaInicio, autor, 'Plan enviado y notificado a '
      + (responsables === 1 ? '1 responsable.' : responsables + ' responsables.'), 'info'));
  }
  if (plan.fechaCierre) {
    eventos.push(evento(plan.fechaCierre, AUTOR_SISTEMA, 'Plan cerrado: todas las actividades fueron aprobadas.', 'cierre'));
  }

  return eventos;
}

/**
 * @param actividad Actividad.
 * @param plan Su plan.
 * @param hoy Fecha de hoy.
 * @returns Eventos del nivel actividad.
 */
function eventosDeActividad(actividad: Actividad, plan: PlanAccion, hoy: Date): EventoHistorial[] {
  const refId = actividad.id;
  const evento = (fecha: string, autor: string, texto: string, tipo: TipoEvento): EventoHistorial =>
    ({ fecha, autor, texto, tipo, nivel: 'actividad', refId });
  const eventos: EventoHistorial[] = [];
  const evidencias: Evidencia[] = [...(actividad.evidenciasAnteriores ?? []), ...(actividad.evidencia ? [actividad.evidencia] : [])];

  if (plan.fechaInicio) {
    const limite = actividad.fechaLimite ? ' · vence el ' + fechaCorta(actividad.fechaLimite) : '';

    eventos.push(evento(plan.fechaInicio, plan.creadoPor ?? AUTOR_RRHH,
      'Asignada a ' + actividad.responsableNombre + ' · plazo ' + textoPlazo(actividad) + limite + '.', 'info'));
  }

  for (const e of evidencias) {
    eventos.push(evento(e.fechaSubida, actividad.responsableNombre, 'Evidencia subida: ' + e.archivo.nombre + '.', 'info'));
    if (e.estado === 'aprobada') {
      eventos.push(evento(e.fechaRevision ?? e.fechaSubida, e.revisadoPor ?? AUTOR_RRHH, 'Evidencia aprobada.', 'ok'));
    } else if (e.estado === 'rechazada') {
      eventos.push(evento(e.fechaRevision ?? e.fechaSubida, e.revisadoPor ?? AUTOR_RRHH,
        'Evidencia rechazada: ' + (e.motivoRechazo ?? 'sin motivo') , 'rechazo'));
    }
  }

  const vencimiento = fechaDeVencimiento(actividad, hoy);
  if (vencimiento !== null) {
    eventos.push(evento(vencimiento, AUTOR_SISTEMA, 'Venció sin evidencia aprobada.', 'vencido'));
  }

  return eventos;
}

/**
 * Una actividad vence el dia siguiente a su fecha limite si para entonces
 * no tenia la evidencia aprobada.
 *
 * @param actividad Actividad.
 * @param hoy Fecha de hoy.
 * @returns Dia del vencimiento (`aaaa-mm-dd`), o `null` si no vencio.
 */
function fechaDeVencimiento(actividad: Actividad, hoy: Date): string | null {
  if (!actividad.fechaLimite) {
    return null;
  }

  let siguiente: Date;
  try {
    siguiente = parsearFecha(actividad.fechaLimite);
  } catch {
    return null;
  }
  siguiente.setDate(siguiente.getDate() + 1);

  const aprobada = actividad.evidencia?.estado === 'aprobada'
    ? instanteDe(actividad.evidencia.fechaRevision ?? actividad.evidencia.fechaSubida)
    : Number.NaN;
  const vencioAntesDeAprobar = Number.isNaN(aprobada) || aprobada >= siguiente.getTime();

  return hoy.getTime() >= siguiente.getTime() && vencioAntesDeAprobar ? formatearFechaIso(siguiente) : null;
}

/**
 * @param fecha `aaaa-mm-dd`.
 * @returns «dd/mm/aaaa», o la misma cadena si no es valida.
 */
function fechaCorta(fecha: string): string {
  try {
    return formatearFecha(parsearFecha(fecha));
  } catch {
    return fecha;
  }
}

/**
 * Estado de un conflicto en el Historial:
 * - `activo`: tiene un plan activo (con o sin vencidas);
 * - `borrador`: su plan vigente esta en borrador;
 * - `cerrado`: todos sus planes estan cerrados;
 * - `sin-plan`: confirmado o pendiente, sin ningun plan;
 * - `archivado`: homonimo.
 */
export type EstadoConflictoHistorial = 'activo' | 'borrador' | 'cerrado' | 'sin-plan' | 'archivado';

/** Texto de cada estado. */
const TEXTO_ESTADO_CONFLICTO: Readonly<Record<EstadoConflictoHistorial, string>> = {
  activo: 'Activo',
  borrador: 'Plan en borrador',
  cerrado: 'Cerrado',
  'sin-plan': 'Sin plan',
  archivado: 'Archivado'
};

/** Tono de cada estado. */
const TONO_ESTADO_CONFLICTO: Readonly<Record<EstadoConflictoHistorial, Tono>> = {
  activo: 'azul',
  borrador: 'ambar',
  cerrado: 'verde',
  'sin-plan': 'gris',
  archivado: 'gris'
};

/** Un conflicto en las tarjetas del Historial. */
export interface ResumenHistorial {
  conflicto: Conflicto;
  /** Sus planes (incluidos los borradores), por numero. */
  planes: PlanAccion[];
  estado: EstadoConflictoHistorial;
}

/** Un evento reciente con su conflicto. */
export interface EventoReciente {
  evento: EventoHistorial;
  /**
   * Conflicto del evento; `null` si es de varios a la vez (p. ej. «Incluido
   * en el análisis AN-001» o su validacion), que se muestra una sola vez.
   */
  conflictoId: string | null;
}

/**
 * @param conflicto Conflicto.
 * @param planes Sus planes.
 * @returns Su estado en el Historial.
 * @author Elvis Flores
 */
export function estadoDeConflicto(conflicto: Conflicto, planes: readonly PlanAccion[]): EstadoConflictoHistorial {
  if (conflicto.clasificacion === 'homonimo') {
    return 'archivado';
  }
  if (planes.some((p) => p.estado === 'activo' || p.estado === 'activo_vencidas')) {
    return 'activo';
  }
  if (planes.some((p) => p.estado === 'borrador')) {
    return 'borrador';
  }
  return planes.length > 0 ? 'cerrado' : 'sin-plan';
}

/** @param estado Estado. @returns Texto de la insignia. */
export function textoEstadoConflicto(estado: EstadoConflictoHistorial): string {
  return TEXTO_ESTADO_CONFLICTO[estado];
}

/** @param estado Estado. @returns Tono de la insignia. */
export function tonoEstadoConflicto(estado: EstadoConflictoHistorial): Tono {
  return TONO_ESTADO_CONFLICTO[estado];
}

/**
 * Los eventos mas recientes de varios historiales, sin los que tienen
 * fecha futura respecto de hoy. Un mismo evento de varios conflictos (los
 * del analisis: mismo texto, fecha y autor) se cuenta una sola vez, sin
 * conflicto.
 *
 * @param historiales Historiales.
 * @param hoy Fecha de hoy.
 * @param limite Cuantos devolver.
 * @returns Eventos del mas reciente al mas antiguo.
 * @author Elvis Flores
 */
export function eventosRecientes(
  historiales: readonly HistorialConflicto[],
  hoy: Date,
  limite: number
): EventoReciente[] {
  const unicos = new Map<string, EventoReciente>();

  for (const h of historiales) {
    for (const evento of todosLosEventos(h)) {
      const clave = evento.texto + '|' + evento.fecha + '|' + evento.autor;
      const previo = unicos.get(clave);

      if (previo === undefined) {
        unicos.set(clave, { evento, conflictoId: h.conflicto.id });
      } else if (previo.conflictoId !== h.conflicto.id) {
        previo.conflictoId = null;
      }
    }
  }

  return [...unicos.values()]
    .filter((e) => instanteDe(e.evento.fecha) <= hoy.getTime())
    .sort((a, b) => instanteDe(b.evento.fecha) - instanteDe(a.evento.fecha))
    .slice(0, limite);
}
