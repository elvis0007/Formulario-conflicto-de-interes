import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { PlanAccion } from '../models';
import { manejarError } from '../utils/manejar-error';
import { PLANES } from './mock-data/planes.data';
import { simularRespuesta } from './mock-data/simular-respuesta';

/**
 * Consulta de planes de accion con datos simulados. Se sustituira por un
 * servicio HTTP con los mismos metodos.
 *
 * @author Elvis Flores
 */
@Injectable({
  providedIn: 'root'
})
export class PlanesMockService {

  /**
   * Obtiene todos los planes.
   *
   * @returns Lista de planes; vacia si la consulta falla.
   */
  obtenerPlanes(): Observable<PlanAccion[]> {
    return simularRespuesta([...PLANES]).pipe(
      manejarError<PlanAccion[]>('PlanesMockService.obtenerPlanes', [])
    );
  }

  /**
   * Obtiene un plan por id.
   *
   * @param id Id del plan.
   * @returns El plan, o `undefined` si no existe o la consulta falla.
   */
  obtenerPlanPorId(id: string): Observable<PlanAccion | undefined> {
    const plan = PLANES.find((p) => p.id === id);

    return simularRespuesta(plan).pipe(
      manejarError<PlanAccion | undefined>(
        'PlanesMockService.obtenerPlanPorId',
        undefined
      )
    );
  }

  /**
   * Obtiene los planes de un conflicto.
   *
   * @param conflictoId Id del conflicto.
   * @returns Planes del conflicto; vacia si no tiene o la consulta falla.
   */
  obtenerPlanesPorConflicto(conflictoId: string): Observable<PlanAccion[]> {
    const planes = PLANES.filter((p) => p.conflictoId === conflictoId);

    return simularRespuesta(planes).pipe(
      manejarError<PlanAccion[]>(
        'PlanesMockService.obtenerPlanesPorConflicto',
        []
      )
    );
  }

  /**
   * Obtiene los planes en los que un empleado es responsable de al menos
   * una actividad (vista de responsable). Incluye planes en cualquier
   * estado: la pantalla decide cuales mostrar.
   *
   * @param empleadoId Id del empleado (`Actividad.responsableId`).
   * @returns Planes del responsable; vacia si no tiene o si falla.
   */
  obtenerPlanesPorResponsable(empleadoId: string): Observable<PlanAccion[]> {
    const planes = PLANES.filter((plan) => plan.actividades.some(
      (actividad) => actividad.responsableId === empleadoId
    ));

    return simularRespuesta(planes).pipe(
      manejarError<PlanAccion[]>(
        'PlanesMockService.obtenerPlanesPorResponsable',
        []
      )
    );
  }
}
