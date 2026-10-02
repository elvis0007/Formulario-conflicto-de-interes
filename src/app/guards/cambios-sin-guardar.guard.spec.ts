import { ActivatedRouteSnapshot, RouterStateSnapshot } from '@angular/router';
import { of } from 'rxjs';
import { ConCambiosSinGuardar, cambiosSinGuardarGuard } from './cambios-sin-guardar.guard';

describe('cambiosSinGuardarGuard', () => {
  const ruta = {} as ActivatedRouteSnapshot;
  const estado = {} as RouterStateSnapshot;

  /**
   * @param componente Pantalla que se deja.
   * @returns Lo que responde el guard.
   */
  function ejecutar(componente: ConCambiosSinGuardar): unknown {
    return cambiosSinGuardarGuard(componente, ruta, estado, estado);
  }

  it('devuelve lo que responde la pantalla', () => {
    const respuesta = of(false);

    expect(ejecutar({ puedeSalir: () => true })).toBeTrue();
    expect(ejecutar({ puedeSalir: () => respuesta })).toBe(respuesta);
  });

  it('deja salir si la pantalla no implementa la interfaz', () => {
    expect(ejecutar({} as ConCambiosSinGuardar)).toBeTrue();
  });
});
