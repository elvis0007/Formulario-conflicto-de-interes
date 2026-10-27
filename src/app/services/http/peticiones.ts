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

/** Mensaje cuando el navegador no llega al servidor (sin respuesta HTTP) o el servidor falla (5xx). */
export const ERROR_SIN_CONEXION = 'No se pudo conectar con el servidor. Inténtalo de nuevo.';

/** 401: el token ya no sirve. */
export const MENSAJE_SESION_VENCIDA = 'Tu sesión venció. Vuelve a iniciar sesión.';

/** 403 sin una explicación propia del backend. */
export const MENSAJE_SIN_PERMISO = 'No tienes permiso para esta acción.';

/** 413: el servidor rechazó el archivo antes de leerlo. */
export const MENSAJE_ARCHIVO_RECHAZADO = 'El archivo no se aceptó: debe ser PDF, PNG o JPG y pesar hasta 5 MB.';

/**
 * Mensaje del 403 de `RolInterceptor` (falta el rol). No dice nada que el
 * usuario pueda usar: se cambia por `MENSAJE_SIN_PERMISO`.
 */
const MENSAJE_403_GENERICO_BACKEND = 'No tiene permisos para realizar esta accion';

/** Señales de un mensaje técnico (excepción, SQL, Java) que no se muestra. */
const PATRON_MENSAJE_TECNICO = /exception|java\.|ora-\d|\bsql\b|hibernate|jdbc|nullpointer|stack ?trace/i;

/** Largo máximo de un mensaje del backend que se muestra tal cual. */
const LARGO_MAXIMO_MENSAJE = 300;

/**
 * Tipo de error de una petición al backend:
 * - `sesion`: 401, el token venció o no es válido;
 * - `permiso`: 403;
 * - `archivo`: 413, archivo demasiado grande;
 * - `conexion`: sin respuesta (0) o error del servidor (5xx);
 * - `otro`: el resto (400, 404, 409...), con su `mensaje`.
 *
 * @author Elvis Flores
 */
export type TipoErrorApi = 'sesion' | 'permiso' | 'archivo' | 'conexion' | 'otro';

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
 * @param err Error capturado.
 * @returns Su tipo, o `null` si no es un error HTTP.
 * @author Elvis Flores
 */
export function tipoDeError(err: unknown): TipoErrorApi | null {
  if (!(err instanceof HttpErrorResponse)) {
    return null;
  }
  if (err.status === 401) {
    return 'sesion';
  }
  if (err.status === 403) {
    return 'permiso';
  }
  if (err.status === 413) {
    return 'archivo';
  }

  return err.status === 0 || err.status >= 500 ? 'conexion' : 'otro';
}

/**
 * @param mensaje `mensaje` de `{ estado, mensaje }`.
 * @returns `true` si se puede mostrar tal cual: texto no vacío, corto y
 * sin rastros técnicos (excepciones, SQL, Java).
 * @author Elvis Flores
 */
export function esMensajeEntendible(mensaje: unknown): mensaje is string {
  return typeof mensaje === 'string'
    && mensaje.trim() !== ''
    && mensaje.length <= LARGO_MAXIMO_MENSAJE
    && !PATRON_MENSAJE_TECNICO.test(mensaje);
}

/**
 * Texto para el usuario a partir de un error:
 *
 * - 401: «Tu sesión venció…»;
 * - 0 o 5xx: «No se pudo conectar con el servidor…» (el 500 del backend
 *   solo dice «Contacte al administrador»);
 * - 413: el límite de 5 MB y los tipos permitidos;
 * - 403: el `mensaje` del backend si explica el motivo (p. ej. nadie decide
 *   sobre su propio conflicto); si es el genérico de falta de rol,
 *   «No tienes permiso para esta acción»;
 * - 400, 404, 409: el `mensaje` del backend si es entendible;
 * - un `Error` propio del servicio: su texto;
 * - si no, el mensaje por defecto.
 *
 * @param err Error capturado.
 * @param porDefecto Mensaje si el error no trae uno.
 * @returns Mensaje para mostrar.
 * @author Sebas Constante
 * @author Elvis Flores
 */
export function mensajeDeError(err: unknown, porDefecto: string): string {
  if (err instanceof HttpErrorResponse) {
    const mensaje: unknown = (err.error as { mensaje?: unknown } | null)?.mensaje;
    const entendible = esMensajeEntendible(mensaje) ? mensaje.trim() : null;

    switch (tipoDeError(err)) {
      case 'sesion':
        return MENSAJE_SESION_VENCIDA;
      case 'conexion':
        return ERROR_SIN_CONEXION;
      case 'archivo':
        return MENSAJE_ARCHIVO_RECHAZADO;
      case 'permiso':
        return entendible !== null && entendible !== MENSAJE_403_GENERICO_BACKEND ? entendible : MENSAJE_SIN_PERMISO;
      default:
        return entendible ?? porDefecto;
    }
  }
  if (err instanceof Error && err.message.trim() !== '') {
    return err.message;
  }

  return porDefecto;
}
