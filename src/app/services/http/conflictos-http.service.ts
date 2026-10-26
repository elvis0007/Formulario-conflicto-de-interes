import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { Conflicto } from '../../models';
import { ConflictoDetalleApi, ExpedienteApi, RespuestaApi } from '../../models/api';
import { manejarError } from '../../utils/manejar-error';
import { ConflictosMockService } from '../conflictos-mock.service';
import { mapearConflicto, mapearConflictoDetalle } from './mapeos/conflicto.mapeo';
import { datosDe, idEnRuta, todasLasPaginas, urlApi } from './peticiones';

/**
 * Consulta de conflictos contra el backend. Mismos métodos públicos que
 * `ConflictosMockService`; se registra en su lugar en `app.config.ts`.
 *
 * Los endpoints de `/conflictos` son solo de A y R: con el rol P
 * (responsable) el backend responde 403 y aquí se devuelve la lista vacía.
 *
 * @author Integración backend
 */
@Injectable({
  providedIn: 'root'
})
export class ConflictosHttpService implements Pick<ConflictosMockService, keyof ConflictosMockService> {
  private readonly http = inject(HttpClient);

  /**
   * Todos los conflictos con sus planes: `GET /conflictos/expedientes`,
   * todas las páginas. Se usa el expediente y no `GET /conflictos` porque
   * las pantallas leen `Conflicto.planes` (como en el mock). Cada actividad
   * trae solo su última evidencia.
   *
   * @returns Lista de conflictos; vacía si la consulta falla.
   */
  obtenerConflictos(): Observable<Conflicto[]> {
    return todasLasPaginas<ExpedienteApi>(this.http, '/conflictos/expedientes').pipe(
      map((expedientes) => expedientes.map((e) => mapearConflicto(e.CONFLICTO, e.PLANES))),
      manejarError<Conflicto[]>('ConflictosHttpService.obtenerConflictos', [])
    );
  }

  /**
   * Un conflicto con su detalle completo: `GET /conflictos/{id}` (todos
   * los planes y evidencias, ficha y jefe inmediato de A y B).
   *
   * @param id Id del conflicto.
   * @returns El conflicto, o `undefined` si no existe o la consulta falla.
   */
  obtenerConflictoPorId(id: string): Observable<Conflicto | undefined> {
    return this.http.get<RespuestaApi<ConflictoDetalleApi>>(urlApi('/conflictos/' + idEnRuta(id))).pipe(
      datosDe<ConflictoDetalleApi>(),
      map((detalle) => detalle ? mapearConflictoDetalle(detalle) : undefined),
      manejarError<Conflicto | undefined>('ConflictosHttpService.obtenerConflictoPorId', undefined)
    );
  }
}
