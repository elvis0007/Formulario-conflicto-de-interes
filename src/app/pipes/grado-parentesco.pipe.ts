import { Pipe, PipeTransform } from '@angular/core';
import { GradoParentesco } from '../models';
import { textoGrado } from '../utils/analisis.util';

/**
 * Muestra el grado de parentesco: «1er grado» a «4to grado», o
 * «No aplica» si no hay grado (conyuges).
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
   * @param grado Grado de parentesco (1 a 4) o `null`.
   * @returns Texto del grado (ver `textoGrado`).
   */
  transform(grado: GradoParentesco | null): string {
    return textoGrado(grado);
  }
}
