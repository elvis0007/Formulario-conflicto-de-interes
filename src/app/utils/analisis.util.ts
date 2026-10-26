import {
  Clasificacion,
  Conflicto,
  EstadoAnalisis,
  GradoParentesco,
  Riesgo
} from '../models';
import { TODOS } from './filtros-listados.util';

/** Niveles de riesgo en el orden en que se muestran (de mayor a menor). */
export const RIESGOS: readonly Riesgo[] = ['CRITICO', 'ALTO', 'MEDIO', 'BAJO'];

/** Texto de cada nivel de riesgo. `MEDIO` se muestra como «Moderado». */
const TEXTO_RIESGO: Readonly<Record<Riesgo, string>> = {
  CRITICO: 'Crítico',
  ALTO: 'Alto',
  MEDIO: 'Moderado',
  BAJO: 'Bajo'
};

/** Texto de cada clasificacion (nombres de la especificacion). */
const TEXTO_CLASIFICACION: Readonly<Record<Clasificacion, string>> = {
  D: 'Declarado',
  N: 'No declarado (omisión)',
  H: 'Homónimo'
};

/** Texto de un caso sin clasificar (`clasificacion` nula). */
const TEXTO_SIN_CLASIFICAR = 'Pendiente de revisión';

/** Texto de cada estado del analisis. */
const TEXTO_ESTADO_ANALISIS: Readonly<Record<EstadoAnalisis, string>> = {
  BORRADOR: 'Borrador',
  VALIDADO: 'Validado'
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
 * Filtro por clasificacion que llega por URL (`?clasificacion=`):
 * - `SIN_CLASIFICAR`: casos con `clasificacion` nula;
 * - `D_O_N`: declarados o no declarados (el parentesco es real);
 * - `D`, `N`, `H`: esa clasificacion.
 */
export type FiltroClasificacion = Clasificacion | 'SIN_CLASIFICAR' | 'D_O_N';

/** Valores validos de `FiltroClasificacion`, para leerlo de la URL. */
const FILTROS_CLASIFICACION: readonly FiltroClasificacion[] = ['SIN_CLASIFICAR', 'D_O_N', 'D', 'N', 'H'];

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
 * @returns «Crítico», «Alto», «Moderado» o «Bajo».
 * @author Elvis Flores
 */
export function textoRiesgo(riesgo: Riesgo): string {
  return TEXTO_RIESGO[riesgo];
}

/**
 * @param clasificacion Clasificacion de un caso, o `null` si esta sin
 * clasificar.
 * @returns «Pendiente de revisión», «Declarado», «No declarado (omisión)»
 * u «Homónimo».
 * @author Elvis Flores
 */
export function textoClasificacion(clasificacion: Clasificacion | null): string {
  return clasificacion === null ? TEXTO_SIN_CLASIFICAR : TEXTO_CLASIFICACION[clasificacion];
}

/**
 * @param valor Valor leido de la URL (`?clasificacion=`).
 * @returns `true` si es un filtro de clasificacion valido.
 * @author Elvis Flores
 */
export function esFiltroClasificacion(valor: string | null): valor is FiltroClasificacion {
  return FILTROS_CLASIFICACION.some((f) => f === valor);
}

/**
 * @param filtro Filtro de clasificacion.
 * @returns Texto de la franja «Filtrando».
 * @author Elvis Flores
 */
export function textoFiltroClasificacion(filtro: FiltroClasificacion): string {
  if (filtro === 'SIN_CLASIFICAR') {
    return textoClasificacion(null);
  }

  return filtro === 'D_O_N' ? 'Declarado o no declarado' : textoClasificacion(filtro);
}

/**
 * @param conflicto Caso del analisis.
 * @param filtro Filtro de clasificacion.
 * @returns `true` si el caso cumple el filtro.
 * @author Elvis Flores
 */
export function cumpleFiltroClasificacion(conflicto: Conflicto, filtro: FiltroClasificacion): boolean {
  switch (filtro) {
    case 'SIN_CLASIFICAR':
      return conflicto.clasificacion === null;
    case 'D_O_N':
      return conflicto.clasificacion === 'D' || conflicto.clasificacion === 'N';
    default:
      return conflicto.clasificacion === filtro;
  }
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
  const conteo: ConteoRiesgos = { CRITICO: 0, ALTO: 0, MEDIO: 0, BAJO: 0, total: 0 };

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
  return conflictos.filter((c) => c.clasificacion === null).length;
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

/**
 * Parentesco de un caso en una linea: «Hermanos · Consanguinidad, 2do
 * grado», «Tío / Sobrino · Consanguinidad, 3er grado» o «Cónyuges ·
 * Afinidad» (sin grado).
 *
 * @param conflicto Caso.
 * @returns Texto del parentesco.
 * @author Elvis Flores
 */
export function textoParentesco(conflicto: Conflicto): string {
  const roles = rolesInvolucrados(conflicto);
  const quienes = roles.tipo === 'simetrica' ? roles.etiqueta : roles.rolA + ' / ' + roles.rolB;
  const grado = conflicto.grado === null ? '' : ', ' + textoGrado(conflicto.grado);

  return quienes + ' · ' + conflicto.relacion + grado;
}
