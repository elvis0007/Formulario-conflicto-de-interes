import { ParentescoApi } from '../../../models/api';

/**
 * Textos de los parentescos del backend. Los usan el mapeo de conflictos
 * (`rolA`, `rolB`) y el de la bandeja del responsable. Funciones puras.
 *
 * Sentido (plan maestro §4): `PARENTESCO` es qué es B para A (`PADRE` = B
 * es el padre de A).
 *
 * @author Integración backend
 */

/** Texto de cada parentesco. */
const TEXTO_PARENTESCO: Readonly<Record<ParentescoApi, string>> = {
  CONYUGE: 'Cónyuge',
  PADRE: 'Padre',
  HIJO: 'Hijo',
  SUEGRO: 'Suegro',
  YERNO: 'Yerno',
  ABUELO: 'Abuelo',
  HERMANO: 'Hermano',
  NIETO: 'Nieto',
  CUNADO: 'Cuñado',
  BISABUELO: 'Bisabuelo',
  TIO: 'Tío',
  SOBRINO: 'Sobrino',
  BISNIETO: 'Bisnieto',
  PRIMO: 'Primo',
  OTRO: 'Otro'
};

/** Etiqueta de los vínculos simétricos (igual en los dos sentidos). */
const ETIQUETA_SIMETRICA: Readonly<Partial<Record<ParentescoApi, string>>> = {
  CONYUGE: 'Cónyuges',
  HERMANO: 'Hermanos',
  CUNADO: 'Cuñados',
  PRIMO: 'Primos',
  OTRO: 'Otro vínculo'
};

/**
 * @param parentesco Parentesco del backend.
 * @returns Su texto («Padre»); el código tal cual si no se conoce; vacío
 * si no viene.
 * @author Integración backend
 */
export function textoDeParentesco(parentesco: string | null): string {
  return parentesco === null ? '' : TEXTO_PARENTESCO[parentesco as ParentescoApi] ?? parentesco;
}

/**
 * @param parentesco Parentesco del backend.
 * @returns Etiqueta si el vínculo es simétrico («Hermanos»); `undefined`
 * si no lo es.
 * @author Integración backend
 */
export function etiquetaSimetrica(parentesco: string | null): string | undefined {
  return parentesco === null ? undefined : ETIQUETA_SIMETRICA[parentesco as ParentescoApi];
}

/**
 * Parentesco de la bandeja (`ActividadBandejaApi.PARENTESCO`, qué es B para
 * A) en una línea: «Hermanos» si es simétrico; si no, «Padre de
 * {nombre A}».
 *
 * @param parentesco Parentesco del backend.
 * @param nombreA Nombre de la persona A.
 * @returns El texto; vacío si no viene.
 * @author Integración backend
 */
export function textoParentescoBandeja(parentesco: string | null, nombreA: string): string {
  const simetrica = etiquetaSimetrica(parentesco);
  const texto = textoDeParentesco(parentesco);

  if (simetrica !== undefined || texto === '') {
    return simetrica ?? '';
  }

  return nombreA === '' ? texto : texto + ' de ' + nombreA;
}
