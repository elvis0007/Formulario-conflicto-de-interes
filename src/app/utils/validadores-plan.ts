import { AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';

/**
 * Validadores de los formularios de Plan de Acción.
 *
 * @author Elvis Flores
 */

/** Clave del error de una parte del plazo que no es un entero >= 0. */
export const ERROR_PLAZO_ENTERO = 'plazoEntero';

/** Clave del error de un plazo total igual a 0. */
export const ERROR_PLAZO_CERO = 'plazoCero';

/**
 * @param valor Valor de un input numerico (puede llegar `null` si esta
 * vacio, o texto).
 * @returns `true` si es un entero mayor o igual a 0.
 */
function esEnteroNoNegativo(valor: unknown): boolean {
  if (valor === null || valor === undefined || valor === '') {
    return false;
  }

  const numero = Number(valor);

  return Number.isInteger(numero) && numero >= 0;
}

/**
 * Una parte del plazo (meses o dias) debe ser un entero mayor o igual a 0.
 * Vacio tambien es error: se pide escribir 0.
 *
 * @param control Input de meses o de dias.
 * @returns `{ plazoEntero: true }` si no es valido; `null` si lo es.
 * @author Elvis Flores
 */
export const plazoEnteroNoNegativo: ValidatorFn = (
  control: AbstractControl
): ValidationErrors | null =>
  esEnteroNoNegativo(control.value) ? null : { [ERROR_PLAZO_ENTERO]: true };

/**
 * Validador de grupo: el plazo total (meses + dias) no puede ser 0. Solo
 * se evalua cuando las dos partes son enteros validos, para no repetir el
 * error de cada campo.
 *
 * @param nombreMeses Nombre del control de meses dentro del grupo.
 * @param nombreDias Nombre del control de dias dentro del grupo.
 * @returns Validador que pone `{ plazoCero: true }` en el grupo.
 * @author Elvis Flores
 */
export function plazoMayorQueCero(nombreMeses: string, nombreDias: string): ValidatorFn {
  return (grupo: AbstractControl): ValidationErrors | null => {
    const meses = grupo.get(nombreMeses)?.value;
    const dias = grupo.get(nombreDias)?.value;

    if (!esEnteroNoNegativo(meses) || !esEnteroNoNegativo(dias)) {
      return null;
    }

    return Number(meses) + Number(dias) === 0 ? { [ERROR_PLAZO_CERO]: true } : null;
  };
}
