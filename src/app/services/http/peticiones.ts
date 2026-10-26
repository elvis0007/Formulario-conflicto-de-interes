import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Observable, OperatorFunction, forkJoin, map, of, switchMap } from 'rxjs';
import { environment } from '../../../environments/environment';
import { PaginaApi, RespuestaApi } from '../../models/api';

/**
 * Utilidades comunes de los servicios HTTP del modulo de conflictos:
 * URL base, desenvolver el sobre `{ estado, mensaje, datos }`, pedir todas
 * las paginas de un listado y sacar el mensaje de un error del backend.
 *
 * @author Sebas Constante
 */

/** Tamaño máximo de página que acepta el backend (`Paginas.TAMANO_MAXIMO`). */
export const TAMANO_PAGINA_MAXIMO = 200;

/** Mensaje cuando el navegador no llega al servidor (sin respuesta HTTP). */
export const ERROR_SIN_CONEXION = 'No se pudo conectar con el servidor. Inténtalo de nuevo.';

/**
 * URL completa de un endpoint. La base es la misma que usa
 * `backend.service.ts`: `urlSeguridad` sin el `/auth/` final.
 *
 * @param ruta Ruta que empieza con `/` (p. ej. `/conflictos/12`).
 * @returns URL absoluta.
 * @author Sebas Constante
 */
export function urlApi(ruta: string): string {
  return environment.urlSeguridad.replace('/auth/', '') + ruta;
}

/**
 * Un id del modelo (string) listo para ir en la URL.
 *
 * @param id Id del modelo.
 * @returns El id codificado para la ruta.
 * @author Sebas Constante
 */
export function idEnRuta(id: string): string {
  return encodeURIComponent(id.trim());
}

/**
 * Operador que desenvuelve el sobre de respuesta y emite solo `datos`.
 * Los errores (400, 403, 404, 409...) llegan como `HttpErrorResponse` y no
 * pasan por aqui.
 *
 * @returns Operador `RespuestaApi<T>` → `T` (`undefined` si no trae datos).
 * @author Sebas Constante
 */
export function datosDe<T>(): OperatorFunction<RespuestaApi<T>, T> {
  return map((respuesta) => respuesta.datos as T);
}

/**
 * Pide todas las páginas de un listado paginado (`PaginaApi`) con el
 * tamaño máximo y junta sus filas: primero la página 0 y, si hay más, el
 * resto en paralelo.
 *
 * @param http Cliente HTTP.
 * @param ruta Ruta del listado (p. ej. `/conflictos/expedientes`).
 * @returns Todas las filas, en el orden del backend.
 * @author Sebas Constante
 */
export function todasLasPaginas<T>(http: HttpClient, ruta: string): Observable<T[]> {
  const pagina = (numero: number): Observable<PaginaApi<T>> => http
    .get<RespuestaApi<PaginaApi<T>>>(urlApi(ruta), {
      params: { pagina: numero, tamanoPagina: TAMANO_PAGINA_MAXIMO }
    })
    .pipe(datosDe<PaginaApi<T>>());

  return pagina(0).pipe(
    switchMap((primera) => {
      const total = primera?.TOTAL_PAGINAS ?? 1;
      const resto: Observable<PaginaApi<T>>[] = [];

      for (let numero = 1; numero < total; numero++) {
        resto.push(pagina(numero));
      }

      return (resto.length === 0 ? of([]) : forkJoin(resto)).pipe(
        map((otras) => [primera, ...otras].flatMap((p) => p?.DATOS ?? []))
      );
    })
  );
}

/**
 * Texto para el usuario a partir de un error: el `mensaje` del backend
 * (`{ estado: 'ERROR', mensaje }` en 400, 403, 404 y 409), el aviso de sin
 * conexión, el texto de un `Error` propio del servicio o, si no hay nada de
 * eso, el mensaje por defecto.
 *
 * @param err Error capturado.
 * @param porDefecto Mensaje si el error no trae uno.
 * @returns Mensaje para mostrar.
 * @author Sebas Constante
 */
export function mensajeDeError(err: unknown, porDefecto: string): string {
  if (err instanceof HttpErrorResponse) {
    const mensaje: unknown = (err.error as { mensaje?: unknown } | null)?.mensaje;

    if (typeof mensaje === 'string' && mensaje.trim() !== '') {
      return mensaje;
    }
    return err.status === 0 ? ERROR_SIN_CONEXION : porDefecto;
  }
  if (err instanceof Error && err.message.trim() !== '') {
    return err.message;
  }

  return porDefecto;
}
