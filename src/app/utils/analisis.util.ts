import {
  Clasificacion,
  Conflicto,
  EstadoAnalisis,
  GradoParentesco,
  Riesgo
} from '../models';
import { TODOS } from './filtros-listados.util';

/** Niveles de riesgo en el orden en que se muestran (de mayor a menor). */
export const RIESGOS: readonly Riesgo[] = ['alto', 'medio', 'bajo', 'ninguno'];

/** Texto de cada nivel de riesgo. `medio` se muestra como «Moderado». */
const TEXTO_RIESGO: Readonly<Record<Riesgo, string>> = {
  alto: 'Alto',
  medio: 'Moderado',
  bajo: 'Bajo',
  ninguno: 'Ninguno'
};

/** Texto de cada clasificacion (nombres de la especificacion). */
const TEXTO_CLASIFICACION: Readonly<Record<Clasificacion, string>> = {
  pendiente: 'Pendiente de revisión',
  confirmado: 'Conflicto confirmado',
  homonimo: 'Homónimo'
};

/** Texto de cada estado del analisis. */
const TEXTO_ESTADO_ANALISIS: Readonly<Record<EstadoAnalisis, string>> = {
  borrador: 'Borrador',
  validado: 'Validado'
};

/** Texto cuando no hay grado de parentesco (conyuges). */
export const TEXTO_SIN_GRADO = 'No aplica';

/** Ordinal abreviado de cada grado de parentesco. */
const ORDINAL_GRADO: Readonly<Record<GradoParentesco, string>> = {
  1: '1er',
  2: '2do',
  3: '3er',
  4: '4to'
};

/**
 * Filtro de riesgo de la tabla: un nivel o `TODOS` (`''`).
 */
export type FiltroRiesgo = Riesgo | typeof TODOS;

/**
 * Cuantos casos hay de cada nivel de riesgo, mas el total.
 */
export type ConteoRiesgos = Record<Riesgo, number> & { total: number };

/**
 * Como se muestran los roles bajo los nombres de los involucrados.
 *
 * - `simetrica`: una sola etiqueta centrada bajo ambos («Hermanos»).
 * - `roles`: un rol bajo cada nombre («Tío» | «Sobrino»).
 */
export type RolesInvolucrados =
  | { tipo: 'simetrica'; etiqueta: string }
  | { tipo: 'roles'; rolA: string; rolB: string };

/**
 * @param riesgo Nivel de riesgo.
 * @returns «Alto», «Moderado», «Bajo» o «Ninguno».
 * @author Elvis Flores
 */
export function textoRiesgo(riesgo: Riesgo): string {
  return TEXTO_RIESGO[riesgo];
}

/**
 * @param clasificacion Clasificacion de un caso.
 * @returns «Pendiente de revisión», «Conflicto confirmado» u «Homónimo».
 * @author Elvis Flores
 */
export function textoClasificacion(clasificacion: Clasificacion): string {
  return TEXTO_CLASIFICACION[clasificacion];
}

/**
 * @param estado Estado del analisis.
 * @returns «Borrador» o «Validado».
 * @author Elvis Flores
 */
export function textoEstadoAnalisis(estado: EstadoAnalisis): string {
  return TEXTO_ESTADO_ANALISIS[estado];
}

/**
 * Texto del grado de parentesco.
 *
 * @param grado Grado (1 a 4), o `null` si no hay grado (conyuges).
 * @returns «1er grado», «2do grado», «3er grado», «4to grado» o
 * «No aplica».
 * @author Elvis Flores
 */
export function textoGrado(grado: GradoParentesco | null): string {
  return grado === null ? TEXTO_SIN_GRADO : ORDINAL_GRADO[grado] + ' grado';
}

/**
 * Cuenta los casos de cada nivel de riesgo. Se calcula siempre sobre
 * TODOS los casos, no sobre los filtrados, para que los contadores de las
 * pildoras no cambien al filtrar.
 *
 * @param conflictos Todos los casos del analisis.
 * @returns Conteo por riesgo y total.
 * @author Elvis Flores
 */
export function contarPorRiesgo(conflictos: readonly Conflicto[]): ConteoRiesgos {
  const conteo: ConteoRiesgos = { alto: 0, medio: 0, bajo: 0, ninguno: 0, total: 0 };

  for (const conflicto of conflictos) {
    conteo[conflicto.riesgo]++;
    conteo.total++;
  }

  return conteo;
}

/**
 * @param conflictos Casos del analisis.
 * @param filtro Nivel de riesgo, o `TODOS`.
 * @returns Los casos de ese nivel (todos si el filtro es `TODOS`).
 * @author Elvis Flores
 */
export function filtrarPorRiesgo(
  conflictos: readonly Conflicto[],
  filtro: FiltroRiesgo
): Conflicto[] {
  return filtro === TODOS
    ? [...conflictos]
    : conflictos.filter((c) => c.riesgo === filtro);
}

/**
 * @param conflictos Casos del analisis.
 * @returns Cuantos siguen pendientes de clasificar.
 * @author Elvis Flores
 */
export function contarPendientes(conflictos: readonly Conflicto[]): number {
  return conflictos.filter((c) => c.clasificacion === 'pendiente').length;
}

/**
 * Decide como mostrar los roles de los involucrados: si el conflicto
 * tiene etiqueta simetrica («Hermanos», «Cónyuges»), una sola etiqueta; si
 * no, el rol de cada persona («Tío» | «Sobrino»).
 *
 * @param conflicto Caso del analisis.
 * @returns La forma de mostrar los roles.
 * @author Elvis Flores
 */
export function rolesInvolucrados(conflicto: Conflicto): RolesInvolucrados {
  const etiqueta = (conflicto.etiquetaSimetrica ?? '').trim();

  return etiqueta !== ''
    ? { tipo: 'simetrica', etiqueta }
    : { tipo: 'roles', rolA: conflicto.rolA, rolB: conflicto.rolB };
}
