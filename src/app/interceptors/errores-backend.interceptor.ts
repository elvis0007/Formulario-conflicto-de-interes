import { HttpInterceptorFn, HttpRequest } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, throwError } from 'rxjs';
import { AvisosBackendService } from '../services/http/avisos-backend.service';
import { tipoDeError, urlApi } from '../services/http/peticiones';

/** Rutas del backend de la gestion de conflictos (no las del host). */
const RUTAS_MODULO: readonly string[] = [
  '/conflictos',
  '/planes',
  '/actividades',
  '/evidencias',
  '/notificaciones',
  '/consultas-previas'
];

/**
 * @param peticion Peticion HTTP.
 * @returns `true` si va al backend de la gestion de conflictos.
 */
function esDelModulo(peticion: HttpRequest<unknown>): boolean {
  const base = urlApi('');

  return peticion.url.startsWith(base)
    && RUTAS_MODULO.some((ruta) => peticion.url.slice(base.length).startsWith(ruta));
}

/**
 * Manejo comun de los errores del backend de la gestion de conflictos
 * (solo sus rutas: las del host, como `/plantilla-temporal`, no se tocan):
 *
 * - 401 (cualquier peticion): aviso de sesion vencida, con «Iniciar sesión».
 * - Lectura de una lista (GET con JSON) sin respuesta o con 5xx: aviso
 *   «No se pudo conectar con el servidor» con «Reintentar».
 * - Lectura con 403: aviso «No tienes permiso para esta acción»; la
 *   pantalla sigue con lo que pudo cargar.
 *
 * Las descargas de archivos (blob) y las acciones (POST, PUT, PATCH) no
 * dan aviso general: cada pantalla muestra su mensaje (`mensajeDeError`).
 * El error sigue su camino: los servicios lo manejan como siempre.
 *
 * @author Elvis Flores
 */
export const erroresBackendInterceptor: HttpInterceptorFn = (peticion, siguiente) => {
  if (!esDelModulo(peticion)) {
    return siguiente(peticion);
  }

  const avisos = inject(AvisosBackendService);
  const lecturaDeLista = peticion.method === 'GET' && peticion.responseType === 'json';

  return siguiente(peticion).pipe(
    catchError((err: unknown) => {
      const tipo = tipoDeError(err);

      if (tipo === 'sesion') {
        avisos.avisar('sesion');
      } else if (lecturaDeLista && tipo === 'conexion') {
        avisos.avisar('conexion');
      } else if (lecturaDeLista && tipo === 'permiso') {
        avisos.avisar('permiso');
      }
      return throwError(() => err);
    })
  );
};
