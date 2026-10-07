import { Injectable, inject } from '@angular/core';
import { Observable, forkJoin, map, of, switchMap } from 'rxjs';
import { Conflicto } from '../models';
import { HistorialConflicto, armarHistorial } from '../utils/historial.util';
import { manejarError } from '../utils/manejar-error';
import { RELOJ } from '../utils/reloj';
import { AnalisisMockService } from './analisis-mock.service';
import { ConflictosMockService } from './conflictos-mock.service';
import { PlanesMockService } from './planes-mock.service';

/**
 * Historial de los conflictos con datos simulados.
 *
 * No guarda eventos propios: los arma en cada consulta (`armarHistorial`)
 * con lo que ya existe en `ConflictosMockService`, `AnalisisMockService` y
 * `PlanesMockService`. Asi lo que se hace hoy en otras pantallas (por
 * ejemplo aprobar una evidencia en Revisión de Evidencias) aparece en el
 * Historial sin recargar.
 *
 * Con el backend: `GET /historial/conflictos/:id`.
 *
 * @author Elvis Flores
 */
@Injectable({
  providedIn: 'root'
})
export class HistorialMockService {
  private readonly conflictosServicio = inject(ConflictosMockService);
  private readonly planesServicio = inject(PlanesMockService);
  private readonly analisisServicio = inject(AnalisisMockService);
  private readonly reloj = inject(RELOJ);

  /**
   * Conflictos que se pueden consultar (el selector del Historial).
   *
   * @returns Conflictos por numero; vacia si falla.
   * @author Elvis Flores
   */
  obtenerConflictos(): Observable<Conflicto[]> {
    return this.conflictosServicio.obtenerConflictos().pipe(
      map((conflictos) => [...conflictos].sort((a, b) => a.id.localeCompare(b.id))),
      manejarError<Conflicto[]>('HistorialMockService.obtenerConflictos', [])
    );
  }

  /**
   * Historial de un conflicto: eventos del conflicto, de cada plan y de
   * cada actividad.
   *
   * @param conflictoId Id del conflicto.
   * @returns El arbol, o `null` si el conflicto no existe o si falla.
   * @author Elvis Flores
   */
  obtenerHistorial(conflictoId: string): Observable<HistorialConflicto | null> {
    return this.conflictosServicio.obtenerConflictoPorId(conflictoId).pipe(
      switchMap((conflicto) => conflicto === undefined
        ? of(null)
        : forkJoin({
          planes: this.planesServicio.obtenerPlanesDeConflicto(conflictoId),
          analisis: this.analisisServicio.obtenerAnalisisRegistrados()
        }).pipe(map(({ planes, analisis }) => armarHistorial(conflicto, planes, analisis, this.reloj())))),
      manejarError<HistorialConflicto | null>('HistorialMockService.obtenerHistorial', null)
    );
  }
}
