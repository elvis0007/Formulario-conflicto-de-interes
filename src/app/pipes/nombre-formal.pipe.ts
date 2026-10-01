import { Pipe, PipeTransform } from '@angular/core';

/** Palabras que forman parte del apellido o nombre siguiente. */
const PARTICULAS: ReadonlySet<string> = new Set([
  'de', 'del', 'la', 'las', 'los', 'san', 'santa', 'y'
]);

/** Cuantos apellidos se asumen al final del nombre completo. */
const APELLIDOS_ASUMIDOS = 2;

/**
 * Muestra un nombre como en los listados de la institucion: MAYUSCULAS y
 * apellidos primero.
 *
 * `Carlos Andrés Mayorga Sánchez` → `MAYORGA SÁNCHEZ CARLOS ANDRÉS`.
 *
 * Los datos solo traen el nombre completo en un campo, asi que se asume
 * que las dos ultimas «palabras» son los apellidos. Las particulas se unen
 * a la palabra siguiente para no partir apellidos compuestos:
 * `Juan Carlos de la Torre Vela` → `DE LA TORRE VELA JUAN CARLOS`.
 * Con dos palabras, la segunda es el apellido.
 *
 * PENDIENTE: si el backend envia nombres y apellidos por separado (como
 * `IUsuario.NOMBRES`/`APELLIDOS`), usarlos y dejar esta heuristica.
 *
 * Uso: `{{ formulario.nombre | nombreFormal }}`
 *
 * @author Elvis Flores
 */
@Pipe({
  name: 'nombreFormal'
})
export class NombreFormalPipe implements PipeTransform {

  /**
   * @param valor Nombre completo en orden «nombres apellidos».
   * @returns Nombre en mayusculas con los apellidos primero; `''` si no
   * hay valor.
   */
  transform(valor: string | null | undefined): string {
    const grupos = this.agrupar((valor ?? '').trim());
    const corte = grupos.length <= APELLIDOS_ASUMIDOS
      ? grupos.length - 1
      : grupos.length - APELLIDOS_ASUMIDOS;
    let ordenado: string[] = [];

    if (grupos.length <= 1) {
      return grupos.join(' ').toLocaleUpperCase('es');
    }

    ordenado = [...grupos.slice(corte), ...grupos.slice(0, corte)];

    return ordenado.join(' ').toLocaleUpperCase('es');
  }

  /**
   * Separa en palabras, uniendo cada particula con la palabra siguiente.
   *
   * @param texto Nombre completo.
   * @returns Grupos (`['Juan', 'Carlos', 'de la Torre', 'Vela']`).
   */
  private agrupar(texto: string): string[] {
    const grupos: string[] = [];
    let pendiente: string[] = [];

    for (const palabra of texto.split(/\s+/).filter((p) => p !== '')) {
      pendiente.push(palabra);
      if (!PARTICULAS.has(palabra.toLocaleLowerCase('es'))) {
        grupos.push(pendiente.join(' '));
        pendiente = [];
      }
    }
    if (pendiente.length > 0) {
      grupos.push(pendiente.join(' '));
    }

    return grupos;
  }
}
