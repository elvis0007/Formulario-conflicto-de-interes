import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { Notificacion } from '../models';
import { manejarError } from '../utils/manejar-error';
import { NOTIFICACIONES } from './mock-data/notificaciones.data';
import { simularRespuesta } from './mock-data/simular-respuesta';

/**
 * Consulta de notificaciones con datos simulados. Por ahora no se filtran
 * por usuario. Se sustituira por un servicio HTTP con los mismos metodos.
 *
 * @author EEASA
 */
@Injectable({
    providedIn: 'root'
})
export class NotificacionesMockService {

    /**
     * Obtiene todas las notificaciones, de la mas reciente a la mas antigua.
     *
     * @returns Lista de notificaciones; vacia si la consulta falla.
     */
    obtenerNotificaciones(): Observable<Notificacion[]> {
        const ordenadas = [...NOTIFICACIONES]
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
        const noLeidas = NOTIFICACIONES.filter((n) => !n.leida).length;

        return simularRespuesta(noLeidas).pipe(
            manejarError<number>('NotificacionesMockService.contarNoLeidas', 0)
        );
    }
}
