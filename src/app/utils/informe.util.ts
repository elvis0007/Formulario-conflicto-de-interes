import { Actividad, Conflicto, EstadoPlan, PlanAccion, Riesgo } from '../models';
import { TODOS } from './filtros-listados.util';
import { obtenerPlanActual } from './planes.util';
import { contieneTexto } from './texto.util';

/**
 * Utilidades puras del Informe General (PNIP.CI.RG.03).
 *
 * @author Elvis Flores
 */

/** Estados del plan que se pueden filtrar (un borrador no entra al informe). */
export type EstadoPlanInforme = Exclude<EstadoPlan, 'borrador'>;

/** Filtros del informe; `TODOS` (cadena vacia) = sin filtro. */
export interface FiltrosInforme {
  estado: EstadoPlanInforme | typeof TODOS;
  riesgo: Riesgo | typeof TODOS;
  /** Id del responsable (`Actividad.responsableId`). */
  responsableId: string;
  /** Nombre de una persona o responsable, o numero de conflicto. */
  texto: string;
}

/** Un grupo del informe: un conflicto, su plan actual y sus actividades. */
export interface GrupoInforme {
  conflicto: Conflicto;
  /** Plan actual del conflicto, sin contar borradores. */
  plan: PlanAccion;
  /** Actividades que se muestran (todas, o las del responsable filtrado). */
  actividades: Actividad[];
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
 * Arma un grupo por cada conflicto con plan de accion enviado (los
 * borradores no cuentan). El plan del grupo es el actual: el activo o, si
 * todos estan cerrados, el mas reciente.
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
    const enviados = planes.filter((p) => p.conflictoId === conflicto.id && p.estado !== 'borrador');
    const plan = obtenerPlanActual(enviados);

    if (plan !== null) {
      grupos.push({ conflicto, plan, actividades: plan.actividades });
    }
  }

  return grupos.sort((a, b) => a.conflicto.id.localeCompare(b.conflicto.id));
}

/**
 * Aplica los filtros, combinados entre si:
 * - estado del plan actual y riesgo del conflicto;
 * - responsable: el grupo queda si tiene actividades suyas, y solo se
 *   muestran esas;
 * - texto: nombre de las personas del caso o de un responsable, o el
 *   numero del conflicto (`C-002`, `002`), sin distinguir acentos ni
 *   mayusculas.
 *
 * @param grupos Grupos del informe.
 * @param filtros Filtros elegidos.
 * @returns Grupos que pasan, con sus actividades visibles.
 * @author Elvis Flores
 */
export function filtrarInforme(grupos: readonly GrupoInforme[], filtros: FiltrosInforme): GrupoInforme[] {
  return grupos
    .filter((g) => filtros.estado === TODOS || g.plan.estado === filtros.estado)
    .filter((g) => filtros.riesgo === TODOS || g.conflicto.riesgo === filtros.riesgo)
    .filter((g) => contieneTexto([
      g.conflicto.id,
      g.conflicto.personaA.nombres,
      g.conflicto.personaB.nombres,
      ...g.plan.actividades.map((a) => a.responsableNombre)
    ], filtros.texto))
    .map((g) => ({
      ...g,
      actividades: filtros.responsableId === TODOS
        ? g.plan.actividades
        : g.plan.actividades.filter((a) => a.responsableId === filtros.responsableId)
    }))
    .filter((g) => g.actividades.length > 0 || filtros.responsableId === TODOS);
}

/**
 * @param grupos Grupos del informe.
 * @returns Responsables de las actividades, sin repetir, por nombre.
 * @author Elvis Flores
 */
export function responsablesDelInforme(grupos: readonly GrupoInforme[]): ResponsableInforme[] {
  const porId = new Map<string, string>();

  for (const g of grupos) {
    for (const a of g.plan.actividades) {
      porId.set(a.responsableId, a.responsableNombre);
    }
  }

  return [...porId.entries()]
    .map(([id, nombre]) => ({ id, nombre }))
    .sort((a, b) => a.nombre.localeCompare(b.nombre));
}
