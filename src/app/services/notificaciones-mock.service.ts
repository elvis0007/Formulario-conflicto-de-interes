import { Injectable, Injector, inject } from '@angular/core';
import { Observable, Subject } from 'rxjs';
import { Notificacion } from '../models';
import { manejarError } from '../utils/manejar-error';
import { RELOJ } from '../utils/reloj';
import { NOTIFICACIONES } from './mock-data/notificaciones.data';
import { simularRespuesta } from './mock-data/simular-respuesta';
import { PerfilUsuarioService } from './perfil-usuario.service';

/**
 * Notificaciones con datos simulados.
 *
 * Cada usuario ve solo las suyas:
 * - una notificacion con `destinatarioId` la ve solo el empleado con ese id
 *   (`PerfilUsuarioService.obtenerEmpleadoActualId()`);
 * - una sin `destinatarioId` es para RRHH: la ven los usuarios con R o A;
 * - quien tiene R (o A) y P ve las dos.
 *
 * En el backend real este filtro lo hara el SERVIDOR segun la sesion
 * (`GET /notificaciones` devolvera solo las del usuario); aqui lo hace el
 * servicio simulado para poder probarlo.
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
   * Para resolver `PerfilUsuarioService` solo al consultar: asi crear este
   * servicio (p. ej. desde `PlanesMockService`) no exige la sesion.
   */
  private readonly injector = inject(Injector);

  /**
   * Obtiene todas las notificaciones, de la mas reciente a la mas antigua.
   *
   * @returns Lista de notificaciones; vacia si la consulta falla.
   */
  obtenerNotificaciones(): Observable<Notificacion[]> {
    const ordenadas = this.visibles()
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
    const noLeidas = this.visibles().filter((n) => !n.leida).length;

    return simularRespuesta(noLeidas).pipe(
      manejarError<number>('NotificacionesMockService.contarNoLeidas', 0)
    );
  }

  /**
   * Marca como leidas todas las notificaciones que ve el usuario.
   *
   * @returns Observable que completa cuando el cambio esta guardado.
   */
  marcarTodasComoLeidas(): Observable<void> {
    for (const notificacion of this.visibles()) {
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

  /**
   * Notificaciones que ve el usuario actual (ver el TSDoc de la clase).
   *
   * @returns Las notificaciones del usuario, en el orden guardado.
   */
  private visibles(): Notificacion[] {
    const perfil = this.injector.get(PerfilUsuarioService);
    const empleadoId = perfil.obtenerEmpleadoActualId();
    const esRrhh = perfil.tieneRol('rrhh');

    return this.notificaciones.filter((n) =>
      n.destinatarioId ? n.destinatarioId === empleadoId : esRrhh);
  }
}
