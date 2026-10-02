import { CanDeactivateFn } from '@angular/router';
import { Observable } from 'rxjs';

/**
 * Pantalla que puede tener cambios sin guardar.
 *
 * @author Elvis Flores
 */
export interface ConCambiosSinGuardar {
  /**
   * Decide si se puede salir de la pantalla. Si hay cambios sin guardar,
   * la pantalla pide confirmacion y responde cuando el usuario elige.
   *
   * @returns `true` para salir; `false` para quedarse.
   */
  puedeSalir(): boolean | Observable<boolean>;
}

/**
 * Antes de salir de una pantalla con cambios sin guardar (volver, otra
 * pestana, el menu...), le pregunta a la pantalla si puede salir.
 *
 * @param componente Pantalla que se va a dejar.
 * @returns Lo que responda la pantalla; `true` si no implementa la
 * interfaz.
 * @author Elvis Flores
 */
export const cambiosSinGuardarGuard: CanDeactivateFn<ConCambiosSinGuardar> = (componente) =>
  typeof componente?.puedeSalir === 'function' ? componente.puedeSalir() : true;
