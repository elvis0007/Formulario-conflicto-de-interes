import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, Subject, map, of, tap } from 'rxjs';
import { Notificacion } from '../../models';
import { MarcadasApi, NotificacionApi, PaginaApi, RespuestaApi } from '../../models/api';
import { manejarError } from '../../utils/manejar-error';
import { NotificacionesMockService } from '../notificaciones-mock.service';
import { mapearNotificacion } from './mapeos/notificacion.mapeo';
import { datosDe, urlApi } from './peticiones';

/** Cuántas notificaciones trae la lista de la campana (primera página). */
const TAMANO_LISTA_CAMPANA = 50;

/**
 * Notificaciones contra el backend (wssisci). Mismos métodos públicos que
 * `NotificacionesMockService`, al que sustituye en `app.config.ts`.
 *
 * El backend filtra por el usuario del token y crea él mismo las
 * notificaciones, por eso no existe `agregarNotificaciones`.
 *
 * @author Integración backend
 */
@Injectable({
  providedIn: 'root'
})
export class NotificacionesHttpService implements Pick<NotificacionesMockService, keyof NotificacionesMockService> {
  private readonly http = inject(HttpClient);

  /** Emite cada vez que se marcan las notificaciones como leídas. */
  private readonly cambiosSujeto = new Subject<void>();

  /** Avisa cuando las notificaciones cambian. */
  readonly cambios: Observable<void> = this.cambiosSujeto.asObservable();

  /**
   * Las notificaciones más recientes del usuario (`GET /notificaciones/mias`,
   * solo la primera página de 50).
   *
   * @returns Notificaciones de la más reciente a la más antigua; vacía si
   * falla.
   */
  obtenerNotificaciones(): Observable<Notificacion[]> {
    return this.http
      .get<RespuestaApi<PaginaApi<NotificacionApi>>>(urlApi('/notificaciones/mias'), {
        params: { soloNoLeidas: false, pagina: 0, tamanoPagina: TAMANO_LISTA_CAMPANA }
      })
      .pipe(
        datosDe<PaginaApi<NotificacionApi>>(),
        map((pagina) => (pagina?.DATOS ?? []).map(mapearNotificacion)),
        manejarError<Notificacion[]>('NotificacionesHttpService.obtenerNotificaciones', [])
      );
  }

  /**
   * Cuenta las no leídas. No hay endpoint de conteo: se pide solo una fila
   * de las no leídas y se usa el total de la página (`TOTAL_ELEMENTOS`).
   *
   * @returns Número de no leídas; 0 si falla.
   */
  contarNoLeidas(): Observable<number> {
    return this.http
      .get<RespuestaApi<PaginaApi<NotificacionApi>>>(urlApi('/notificaciones/mias'), {
        params: { soloNoLeidas: true, pagina: 0, tamanoPagina: 1 }
      })
      .pipe(
        datosDe<PaginaApi<NotificacionApi>>(),
        map((pagina) => pagina?.TOTAL_ELEMENTOS ?? 0),
        manejarError<number>('NotificacionesHttpService.contarNoLeidas', 0)
      );
  }

  /**
   * Marca como leídas todas las del usuario (`PATCH /notificaciones/leidas`)
   * y avisa del cambio.
   *
   * @returns Observable que completa cuando el cambio está guardado.
   */
  marcarTodasComoLeidas(): Observable<void> {
    return this.http.patch<RespuestaApi<MarcadasApi>>(urlApi('/notificaciones/leidas'), {}).pipe(
      tap(() => this.cambiosSujeto.next()),
      map(() => undefined),
      manejarError<void>('NotificacionesHttpService.marcarTodasComoLeidas', undefined)
    );
  }

  /**
   * No existe en el backend: las notificaciones las crea el servidor al
   * enviar un plan, revisar una evidencia, etc. No hace nada.
   *
   * @param nuevas Ignoradas.
   * @returns Lista vacía.
   */
  agregarNotificaciones(
    nuevas: readonly Pick<Notificacion, 'titulo' | 'texto' | 'tipo' | 'destinatarioId'>[]
  ): Observable<Notificacion[]> {
    console.warn(
      '[NotificacionesHttpService.agregarNotificaciones] El backend crea las notificaciones; se ignoran '
        + nuevas.length + '.'
    );
    return of<Notificacion[]>([]);
  }
}
