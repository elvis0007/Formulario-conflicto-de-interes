import { Actividad, Conflicto, PlanAccion, Riesgo } from '../models';
import { TODOS } from './filtros-listados.util';
import { obtenerPlanActual, tieneActividadesVencidas } from './planes.util';
import { contieneTexto } from './texto.util';

/**
 * Utilidades puras del Informe General (PNIP.CI.RG.03).
 *
 * @author Elvis Flores
 */

/**
 * Filtro por estado del plan actual (§6.7):
 * - `en-ejecucion`: firmado, con o sin vencidas;
 * - `con-vencidas`: firmado con actividades vencidas;
 * - `cerrados`: cerrado.
 */
export type EstadoInforme = 'en-ejecucion' | 'con-vencidas' | 'cerrados';

/** Opciones del filtro de estado, en el orden de las pildoras. */
export const ESTADOS_INFORME: readonly { valor: EstadoInforme; etiqueta: string }[] = [
  { valor: 'en-ejecucion', etiqueta: 'En ejecución' },
  { valor: 'con-vencidas', etiqueta: 'Con vencidas' },
  { valor: 'cerrados', etiqueta: 'Cerrados' }
];

/** Filtros del informe; `TODOS` (cadena vacia) = sin filtro. */
export interface FiltrosInforme {
  estado: EstadoInforme | typeof TODOS;
  riesgo: Riesgo | typeof TODOS;
  /** Id del responsable (`Actividad.responsableId`). */
  responsableId: string;
  /** Nombre de una persona o responsable, o numero de conflicto. */
  texto: string;
}

/** Un plan del conflicto con las actividades que se muestran. */
export interface BloquePlan {
  plan: PlanAccion;
  /** Todas, o solo las del responsable filtrado. */
  actividades: Actividad[];
}

/** Un grupo del informe: un conflicto con sus planes enviados. */
export interface GrupoInforme {
  conflicto: Conflicto;
  /** Plan actual (sin contar borradores): el de la barra de avance y el estado. */
  plan: PlanAccion;
  /** Un bloque por cada plan enviado, por numero. */
  bloques: BloquePlan[];
}

/** Un responsable para el filtro. */
export interface ResponsableInforme {
  id: string;
  nombre: string;
}

/** @returns Filtros sin ningun criterio. */
export function filtrosInformeVacios(): FiltrosInforme {
  return { estado: TODOS, riesgo: TODOS, responsableId: TODOS, texto: '' };
}

/**
 * @param valor Valor leido de la URL (`?estado=`).
 * @returns `true` si es un estado del filtro.
 * @author Elvis Flores
 */
export function esEstadoInforme(valor: string | null): valor is EstadoInforme {
  return ESTADOS_INFORME.some((e) => e.valor === valor);
}

/**
 * @param plan Plan.
 * @param estado Filtro.
 * @param hoy Fecha de hoy, para el filtro «con vencidas».
 * @returns `true` si el plan cumple el filtro de estado.
 * @author Elvis Flores
 */
export function cumpleEstado(
  plan: PlanAccion,
  estado: EstadoInforme | typeof TODOS,
  hoy: Date = new Date()
): boolean {
  switch (estado) {
    case 'en-ejecucion':
      return plan.estado === 'FIRMADO';
    case 'con-vencidas':
      return tieneActividadesVencidas(plan, hoy);
    case 'cerrados':
      return plan.estado === 'CERRADO';
    default:
      return true;
  }
}

/**
 * Arma un grupo por cada conflicto con al menos un plan enviado (los
 * borradores no cuentan). El grupo trae todos sus planes enviados; el
 * actual es el activo o, si todos estan cerrados, el mas reciente.
 *
 * @param conflictos Conflictos.
 * @param planes Todos los planes.
 * @returns Grupos ordenados por numero de conflicto.
 * @author Elvis Flores
 */
export function armarGruposInforme(
  conflictos: readonly Conflicto[],
  planes: readonly PlanAccion[]
): GrupoInforme[] {
  const grupos: GrupoInforme[] = [];

  for (const conflicto of conflictos) {
    const enviados = planes
      .filter((p) => p.conflictoId === conflicto.id && p.estado !== 'BORRADOR')
      .sort((a, b) => a.numero - b.numero);
    const plan = obtenerPlanActual(enviados);

    if (plan !== null) {
      grupos.push({ conflicto, plan, bloques: enviados.map((p) => ({ plan: p, actividades: p.actividades })) });
    }
  }

  return grupos.sort((a, b) => a.conflicto.id.localeCompare(b.conflicto.id));
}

/**
 * Aplica los filtros, combinados entre si:
 * - estado del plan actual y riesgo del conflicto;
 * - responsable: el grupo queda si tiene actividades suyas en algun plan,
 *   y en cada plan solo se muestran las suyas (los planes sin ninguna
 *   suya se ocultan);
 * - texto: nombre de las personas del caso o de un responsable, o el
 *   numero del conflicto (`C-002`, `002`), sin distinguir acentos.
 *
 * @param grupos Grupos del informe.
 * @param filtros Filtros elegidos.
 * @param hoy Fecha de hoy, para el filtro «con vencidas».
 * @returns Grupos que pasan, con sus bloques visibles.
 * @author Elvis Flores
 */
export function filtrarInforme(
  grupos: readonly GrupoInforme[],
  filtros: FiltrosInforme,
  hoy: Date = new Date()
): GrupoInforme[] {
  return grupos
    .filter((g) => cumpleEstado(g.plan, filtros.estado, hoy))
    .filter((g) => filtros.riesgo === TODOS || g.conflicto.riesgo === filtros.riesgo)
    .filter((g) => contieneTexto([
      g.conflicto.id,
      g.conflicto.personaA.nombres,
      g.conflicto.personaB.nombres,
      ...g.bloques.flatMap((b) => b.plan.actividades.map((a) => a.responsableNombre))
    ], filtros.texto))
    .map((g) => filtros.responsableId === TODOS
      ? g
      : {
        ...g,
        bloques: g.bloques
          .map((b) => ({ ...b, actividades: b.plan.actividades.filter((a) => a.responsableId === filtros.responsableId) }))
          .filter((b) => b.actividades.length > 0)
      })
    .filter((g) => g.bloques.length > 0);
}

/**
 * @param grupos Grupos del informe.
 * @returns Responsables de las actividades de todos los planes, sin
 * repetir, por nombre.
 * @author Elvis Flores
 */
export function responsablesDelInforme(grupos: readonly GrupoInforme[]): ResponsableInforme[] {
  const porId = new Map<string, string>();

  for (const g of grupos) {
    for (const b of g.bloques) {
      for (const a of b.plan.actividades) {
        porId.set(a.responsableId, a.responsableNombre);
      }
    }
  }

  return [...porId.entries()]
    .map(([id, nombre]) => ({ id, nombre }))
    .sort((a, b) => a.nombre.localeCompare(b.nombre));
}
