import { MonoTypeOperatorFunction, catchError, of } from 'rxjs';

/**
 * Operador RxJS para el manejo de errores de los servicios de datos del
 * modulo: registra el error con su origen y devuelve un valor seguro, para
 * que el componente siga funcionando (lista vacia, `undefined`...).
 *
 * Hoy los servicios son simulados y no fallan, pero ya lo usan para que al
 * cambiar a `HttpClient` el manejo de errores este en su sitio.
 *
 * @param origen `Clase.metodo` que hizo la consulta, para el log.
 * @param valorPorDefecto Valor que se emite si la consulta falla.
 * @returns Operador que captura el error y emite `valorPorDefecto`.
 * @author EEASA
 */
export function manejarError<T>(
    origen: string,
    valorPorDefecto: T
): MonoTypeOperatorFunction<T> {
    return catchError((err: unknown) => {
        console.error('[' + origen + '] Error al obtener datos:', err);
        return of(valorPorDefecto);
    });
}
