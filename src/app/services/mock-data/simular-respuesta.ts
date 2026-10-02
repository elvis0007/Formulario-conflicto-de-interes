import { Observable, delay, of } from 'rxjs';

/** Latencia simulada de red, en milisegundos. */
export const LATENCIA_SIMULADA_MS = 300;

/**
 * Emite una copia profunda de los datos tras una latencia simulada, como
 * haria una respuesta HTTP.
 *
 * La copia evita que un componente que modifique lo recibido altere los
 * datos de ejemplo compartidos por toda la app.
 *
 * @param datos Datos a devolver.
 * @param latenciaMs Espera antes de emitir; por defecto
 * `LATENCIA_SIMULADA_MS`.
 * @returns Observable que emite la copia y completa.
 * @author Elvis Flores
 */
export function simularRespuesta<T>(
  datos: T,
  latenciaMs: number = LATENCIA_SIMULADA_MS
): Observable<T> {
  return of(structuredClone(datos)).pipe(delay(latenciaMs));
}
