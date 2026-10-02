import { FormControl, FormGroup } from '@angular/forms';
import {
  ERROR_PLAZO_CERO,
  ERROR_PLAZO_ENTERO,
  plazoEnteroNoNegativo,
  plazoMayorQueCero
} from './validadores-plan';

describe('validadores-plan', () => {
  /**
   * @param valor Valor del input.
   * @returns Errores de `plazoEnteroNoNegativo`.
   */
  function parte(valor: unknown): unknown {
    return plazoEnteroNoNegativo(new FormControl(valor));
  }

  /**
   * @param meses Meses.
   * @param dias Dias.
   * @returns Errores del grupo.
   */
  function plazo(meses: unknown, dias: unknown): unknown {
    return plazoMayorQueCero('meses', 'dias')(new FormGroup({
      meses: new FormControl(meses),
      dias: new FormControl(dias)
    }));
  }

  it('cada parte del plazo: entero mayor o igual a 0', () => {
    expect(parte(0)).toBeNull();
    expect(parte(12)).toBeNull();
    expect(parte('3')).toBeNull();
    expect(parte(-1)).toEqual({ [ERROR_PLAZO_ENTERO]: true });
    expect(parte(1.5)).toEqual({ [ERROR_PLAZO_ENTERO]: true });
    expect(parte(null)).withContext('vacío').toEqual({ [ERROR_PLAZO_ENTERO]: true });
    expect(parte('')).toEqual({ [ERROR_PLAZO_ENTERO]: true });
    expect(parte('abc')).toEqual({ [ERROR_PLAZO_ENTERO]: true });
  });

  it('el plazo total no puede ser 0', () => {
    expect(plazo(0, 0)).toEqual({ [ERROR_PLAZO_CERO]: true });
    expect(plazo(0, 15)).toBeNull();
    expect(plazo(2, 0)).toBeNull();
  });

  it('si una parte no es válida, no repite el error en el grupo', () => {
    expect(plazo(-1, 0)).toBeNull();
    expect(plazo(null, 0)).toBeNull();
  });
});
