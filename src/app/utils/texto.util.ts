/**
 * Utilidades puras de texto para busquedas.
 *
 * @author Elvis Flores
 */

/**
 * Pasa a minusculas y quita tildes y espacios de los extremos, para comparar
 * sin que importen las mayusculas ni los acentos (`Álvarez` = `alvarez`).
 *
 * @param texto Texto a normalizar.
 * @returns Texto normalizado.
 */
export function normalizarTexto(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim();
}

/**
 * Indica si algun campo contiene el termino buscado (sin distinguir
 * mayusculas ni tildes). Un termino vacio coincide con todo.
 *
 * @param campos Valores donde buscar; se ignoran `null` y `undefined`.
 * @param termino Texto escrito por el usuario.
 * @returns `true` si hay coincidencia.
 */
export function contieneTexto(
  campos: readonly (string | null | undefined)[],
  termino: string
): boolean {
  const buscado = normalizarTexto(termino);

  if (buscado === '') {
    return true;
  }

  return campos.some(
    (campo) => campo != null && normalizarTexto(campo).includes(buscado)
  );
}
