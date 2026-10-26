import { Provider, Type } from '@angular/core';
import { environment } from '../../../environments/environment';

/** Bandera de la sesión simulada (ver docs/DESARROLLO_LOCAL.md). */
const CLAVE_SESION_SIMULADA = 'SISCI-DEV-SESION-SIMULADA';

/**
 * Indica si las pantallas deben leer del backend.
 *
 * La sesión simulada no tiene token real (el backend respondería 401), así
 * que mientras está activa se siguen usando los datos simulados.
 *
 * @returns `false` solo con la sesión simulada activa fuera de producción.
 * @author Integración backend
 */
export function usarBackend(): boolean {
  if (environment.production) {
    return true;
  }
  try {
    return localStorage.getItem(CLAVE_SESION_SIMULADA) !== 'true';
  } catch {
    // Sin localStorage (render en servidor): no hay sesión simulada.
    return true;
  }
}

/**
 * Registra la versión HTTP de un servicio en lugar de su mock, cuando
 * corresponde. Los componentes siguen inyectando el mock y no cambian.
 *
 * Se decide una vez, al cargar la app: activar o salir de la sesión
 * simulada ya recarga la página.
 *
 * @param mock Clase del servicio simulado que inyectan los componentes.
 * @param http Clase con los mismos métodos públicos, contra el backend.
 * @returns Proveedor para `app.config.ts`.
 * @author Integración backend
 */
export function proveerFuente<T>(
  mock: Type<T>,
  // Solo la parte pública: los mocks tienen miembros privados propios.
  http: Type<Pick<T, keyof T>>
): Provider {
  return { provide: mock, useClass: usarBackend() ? http : mock };
}
