import { Pipe, PipeTransform } from '@angular/core';
import { Conflicto } from '../models';
import { textoGrado } from '../utils/analisis.util';

/**
 * Muestra el grado de parentesco: «1er grado» a «4to grado».
 *
 * Uso: `{{ conflicto.grado | gradoParentesco }}`
 *
 * @author Elvis Flores
 */
@Pipe({
  name: 'gradoParentesco'
})
export class GradoParentescoPipe implements PipeTransform {

  /**
   * @param grado Grado de parentesco (1 a 4).
   * @returns Texto del grado (ver `textoGrado`).
   */
  transform(grado: Conflicto['grado']): string {
    return textoGrado(grado);
  }
}
