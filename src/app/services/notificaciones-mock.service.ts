import { Injectable, inject } from '@angular/core';
import { Observable, Subject } from 'rxjs';
import { Notificacion } from '../models';
import { manejarError } from '../utils/manejar-error';
import { RELOJ } from '../utils/reloj';
import { NOTIFICACIONES } from './mock-data/notificaciones.data';
import { simularRespuesta } from './mock-data/simular-respuesta';

/**
 * Notificaciones con datos simulados. Por ahora no se filtran por usuario
 * (PENDIENTE hasta tener backend: cada una guarda su `destinatarioId`).
 *
 * Guarda su propia copia de los datos para poder simular cambios de estado
 * (marcar como leidas, agregar nuevas) durante la sesion. `cambios` avisa
 * cuando cambian, para que la campana se actualice sola. Se sustituira por un servicio
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

  /** Correlativo de las notificaciones nuevas (N-101, N-102...). */
  private correlativo = 100;

  /** Emite cada vez que se agregan o se marcan notificaciones. */
  private readonly cambiosSujeto = new Subject<void>();

  /** Avisa cuando las notificaciones cambian. */
  readonly cambios: Observable<void> = this.cambiosSujeto.asObservable();

  private readonly reloj = inject(RELOJ);

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
    this.cambiosSujeto.next();

    return simularRespuesta<void>(undefined).pipe(
      manejarError<void>(
        'NotificacionesMockService.marcarTodasComoLeidas',
        undefined
      )
    );
  }

  /**
   * Agrega notificaciones nuevas (sin leer, con la fecha de ahora) y avisa
   * del cambio. En el backend real las creara el servidor al enviar un
   * plan; aqui las crea el servicio de planes simulado.
   *
   * @param nuevas Titulo, texto, tipo y destinatario de cada una.
   * @returns Las notificaciones creadas; vacia si falla.
   */
  agregarNotificaciones(
    nuevas: readonly Pick<Notificacion, 'titulo' | 'texto' | 'tipo' | 'destinatarioId'>[]
  ): Observable<Notificacion[]> {
    const fecha = this.reloj().toISOString();
    const creadas = nuevas.map((n): Notificacion => ({
      ...n,
      id: 'N-' + (++this.correlativo),
      fecha,
      leida: false
    }));

    this.notificaciones.unshift(...creadas);
    this.cambiosSujeto.next();
    return simularRespuesta(creadas).pipe(
      manejarError<Notificacion[]>('NotificacionesMockService.agregarNotificaciones', [])
    );
  }
}
