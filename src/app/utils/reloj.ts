import { InjectionToken } from '@angular/core';

/**
 * Reloj de la app: devuelve «ahora». Se inyecta en vez de llamar a
 * `new Date()` donde importa la fecha de hoy (p. ej. la fecha de inicio de
 * un plan), para que las pruebas usen una fecha fija:
 *
 * ```ts
 * providers: [{ provide: RELOJ, useValue: () => new Date(2026, 9, 2, 10, 0) }]
 * ```
 *
 * @author Elvis Flores
 */
export const RELOJ = new InjectionToken<() => Date>('RELOJ', {
  providedIn: 'root',
  factory: () => () => new Date()
});
