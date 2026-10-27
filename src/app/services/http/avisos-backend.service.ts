import { Injectable, signal } from '@angular/core';
import { ERROR_SIN_CONEXION, MENSAJE_SESION_VENCIDA, MENSAJE_SIN_PERMISO } from './peticiones';

/**
 * Aviso general de un error del backend que no es de una sola accion:
 * - `sesion`: 401, hay que volver a iniciar sesion;
 * - `conexion`: una lista no cargo (sin respuesta o 5xx), se puede reintentar;
 * - `permiso`: 403 al leer, la pantalla sigue (con lo que pudo cargar).
 *
 * @author Elvis Flores
 */
export interface AvisoBackend {
  tipo: 'sesion' | 'conexion' | 'permiso';
  mensaje: string;
}

/** Mensaje de cada aviso. */
const MENSAJES: Readonly<Record<AvisoBackend['tipo'], string>> = {
  sesion: MENSAJE_SESION_VENCIDA,
  conexion: ERROR_SIN_CONEXION,
  permiso: MENSAJE_SIN_PERMISO
};

/** Prioridad: un aviso no reemplaza a otro mas importante. */
const PRIORIDAD: Readonly<Record<AvisoBackend['tipo'], number>> = {
  sesion: 3,
  conexion: 2,
  permiso: 1
};

/**
 * Aviso vigente de error del backend. Lo llena `erroresBackendInterceptor`
 * y lo muestra `AvisoBackendComponent`. Las acciones (guardar, enviar,
 * revisar...) siguen mostrando su propio mensaje en la pantalla.
 *
 * @author Elvis Flores
 */
@Injectable({
  providedIn: 'root'
})
export class AvisosBackendService {
  private readonly actual = signal<AvisoBackend | null>(null);

  /** Aviso a mostrar; `null` si no hay. */
  readonly aviso = this.actual.asReadonly();

  /**
   * Muestra un aviso, salvo que ya haya uno mas importante (la sesion
   * vencida no se tapa con un problema de conexion).
   *
   * @param tipo Tipo de aviso.
   * @author Elvis Flores
   */
  avisar(tipo: AvisoBackend['tipo']): void {
    const vigente = this.actual();

    if (vigente === null || PRIORIDAD[tipo] >= PRIORIDAD[vigente.tipo]) {
      this.actual.set({ tipo, mensaje: MENSAJES[tipo] });
    }
  }

  /**
   * Quita el aviso.
   *
   * @author Elvis Flores
   */
  cerrar(): void {
    this.actual.set(null);
  }
}
