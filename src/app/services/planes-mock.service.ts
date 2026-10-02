import { Injectable } from '@angular/core';
import { Observable, defer, throwError } from 'rxjs';
import { PlanAccion } from '../models';
import { manejarError } from '../utils/manejar-error';
import { hayPlanActivo } from '../utils/planes.util';
import { PLANES } from './mock-data/planes.data';
import { simularRespuesta } from './mock-data/simular-respuesta';

/**
 * Planes de accion con datos simulados. Se sustituira por un servicio HTTP
 * con los mismos metodos.
 *
 * Es la UNICA fuente de los planes: guarda su propia copia en memoria y
 * los cambios (crear o guardar un borrador) duran toda la sesion.
 * `AnalisisMockService` le pide los planes de cada conflicto, asi un plan
 * creado en Plan de Acción aparece tambien en Análisis de Conflictos.
 *
 * @author Elvis Flores
 */
@Injectable({
  providedIn: 'root'
})
export class PlanesMockService {
  /** Planes en memoria. */
  private readonly planes: PlanAccion[] = structuredClone([...PLANES]);

  /** Ultimo numero de actividad asignado (varias en un mismo guardado). */
  private ultimoIdActividad = 0;

  /**
   * Obtiene todos los planes.
   *
   * @returns Lista de planes; vacia si la consulta falla.
   */
  obtenerPlanes(): Observable<PlanAccion[]> {
    return simularRespuesta(this.planes).pipe(
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
    const plan = this.planes.find((p) => p.id === id);

    return simularRespuesta(plan).pipe(
      manejarError<PlanAccion | undefined>(
        'PlanesMockService.obtenerPlanPorId',
        undefined
      )
    );
  }

  /**
   * Obtiene los planes de un conflicto, por numero (Plan 01, Plan 02...).
   *
   * @param conflictoId Id del conflicto.
   * @returns Planes del conflicto; vacia si no tiene o la consulta falla.
   */
  obtenerPlanesDeConflicto(conflictoId: string): Observable<PlanAccion[]> {
    const planes = this.planes
      .filter((p) => p.conflictoId === conflictoId)
      .sort((a, b) => a.numero - b.numero);

    return simularRespuesta(planes).pipe(
      manejarError<PlanAccion[]>(
        'PlanesMockService.obtenerPlanesDeConflicto',
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
    const planes = this.planes.filter((plan) => plan.actividades.some(
      (actividad) => actividad.responsableId === empleadoId
    ));

    return simularRespuesta(planes).pipe(
      manejarError<PlanAccion[]>(
        'PlanesMockService.obtenerPlanesPorResponsable',
        []
      )
    );
  }

  /**
   * Guarda un plan en borrador.
   *
   * - Si su `id` esta vacio, lo crea: le asigna id y el siguiente numero
   *   dentro de su conflicto. No se crea si el conflicto ya tiene un plan
   *   vigente (solo puede haber uno).
   * - Si no, actualiza el plan existente, que debe seguir en borrador.
   *
   * Las actividades sin id reciben uno. Solo acepta planes en estado
   * `borrador`.
   *
   * @param plan Plan a guardar.
   * @returns El plan guardado (con id y numero), o `null` si no se pudo
   * guardar.
   */
  guardarBorrador(plan: PlanAccion): Observable<PlanAccion | null> {
    return defer(() => {
      const delConflicto = this.planes.filter((p) => p.conflictoId === plan.conflictoId);
      const guardado = structuredClone(plan);
      let indice = -1;

      if (plan.estado !== 'borrador') {
        return throwError(() => new Error('Solo se guardan planes en borrador.'));
      }

      if (guardado.id === '') {
        if (hayPlanActivo(delConflicto)) {
          return throwError(() => new Error('El conflicto ya tiene un plan vigente.'));
        }
        guardado.id = this.siguienteIdPlan();
        guardado.numero = delConflicto.reduce((max, p) => Math.max(max, p.numero), 0) + 1;
      } else {
        indice = this.planes.findIndex((p) => p.id === guardado.id);
        if (indice < 0) {
          return throwError(() => new Error('No existe el plan ' + guardado.id + '.'));
        }
        if (this.planes[indice].estado !== 'borrador') {
          return throwError(() => new Error('El plan ' + guardado.id + ' ya no es un borrador.'));
        }
        guardado.numero = this.planes[indice].numero;
      }

      guardado.actividades = guardado.actividades.map((actividad) => ({
        ...actividad,
        id: actividad.id || this.siguienteIdActividad()
      }));

      if (indice < 0) {
        this.planes.push(guardado);
      } else {
        this.planes[indice] = guardado;
      }

      return simularRespuesta(guardado);
    }).pipe(
      manejarError<PlanAccion | null>('PlanesMockService.guardarBorrador', null)
    );
  }

  /**
   * @returns Siguiente id libre de plan (`PL-008`, `PL-009`...).
   */
  private siguienteIdPlan(): string {
    return 'PL-' + String(this.mayorNumero(this.planes.map((p) => p.id)) + 1).padStart(3, '0');
  }

  /**
   * @returns Siguiente id libre de actividad (`A-015`...).
   */
  private siguienteIdActividad(): string {
    const ids = this.planes.flatMap((p) => p.actividades.map((a) => a.id));

    this.ultimoIdActividad = Math.max(this.ultimoIdActividad, this.mayorNumero(ids)) + 1;
    return 'A-' + String(this.ultimoIdActividad).padStart(3, '0');
  }

  /**
   * @param ids Ids con un numero al final (`PL-007`, `A-014`).
   * @returns El mayor de esos numeros; 0 si no hay.
   */
  private mayorNumero(ids: readonly string[]): number {
    return ids.reduce((max, id) => {
      const numero = Number(/(\d+)$/.exec(id)?.[1] ?? 0);

      return Number.isFinite(numero) ? Math.max(max, numero) : max;
    }, 0);
  }
}
