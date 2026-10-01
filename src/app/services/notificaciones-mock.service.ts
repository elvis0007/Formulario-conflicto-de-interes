import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { Notificacion } from '../models';
import { manejarError } from '../utils/manejar-error';
import { NOTIFICACIONES } from './mock-data/notificaciones.data';
import { simularRespuesta } from './mock-data/simular-respuesta';

/**
 * Notificaciones con datos simulados. Por ahora no se filtran por usuario.
 *
 * Guarda su propia copia de los datos para poder simular cambios de estado
 * (marcar como leidas) durante la sesion. Se sustituira por un servicio
 * HTTP con los mismos metodos.
 *
 * @author Elvis Flores
 */
@Injectable({
  providedIn: 'root'
})
export class NotificacionesMockService {
  /** Estado en memoria de las notificaciones. */
  private readonly notificaciones: Notificacion[] =
    structuredClone([...NOTIFICACIONES]);

  /**
   * Obtiene todas las notificaciones, de la mas reciente a la mas antigua.
   *
   * @returns Lista de notificaciones; vacia si la consulta falla.
   */
  obtenerNotificaciones(): Observable<Notificacion[]> {
    const ordenadas = [...this.notificaciones]
      .sort((a, b) => b.fecha.localeCompare(a.fecha));

    return simularRespuesta(ordenadas).pipe(
      manejarError<Notificacion[]>(
        'NotificacionesMockService.obtenerNotificaciones',
        []
      )
    );
  }

  /**
   * Cuenta las notificaciones sin leer.
   *
   * @returns Numero de notificaciones no leidas; 0 si la consulta falla.
   */
  contarNoLeidas(): Observable<number> {
    const noLeidas = this.notificaciones.filter((n) => !n.leida).length;

    return simularRespuesta(noLeidas).pipe(
      manejarError<number>('NotificacionesMockService.contarNoLeidas', 0)
    );
  }

  /**
   * Marca todas las notificaciones como leidas.
   *
   * @returns Observable que completa cuando el cambio esta guardado.
   */
  marcarTodasComoLeidas(): Observable<void> {
    for (const notificacion of this.notificaciones) {
      notificacion.leida = true;
    }

    return simularRespuesta<void>(undefined).pipe(
      manejarError<void>(
        'NotificacionesMockService.marcarTodasComoLeidas',
        undefined
      )
    );
  }
}
