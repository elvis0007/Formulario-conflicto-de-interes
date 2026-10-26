import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { Conflicto } from '../../models';
import {
  ActividadRecienteApi,
  ConflictoApi,
  ConflictoDetalleApi,
  ExpedienteApi,
  RespuestaApi
} from '../../models/api';
import {
  EventoReciente,
  HistorialConflicto,
  ResumenHistorial,
  armarHistorial,
  estadoDeConflicto,
  instanteDe
} from '../../utils/historial.util';
import { manejarError } from '../../utils/manejar-error';
import { RELOJ } from '../../utils/reloj';
import { HistorialMockService } from '../historial-mock.service';
import { mapearConflicto, mapearConflictoDetalle } from './mapeos/conflicto.mapeo';
import { mapearActividadReciente, mapearProceso } from './mapeos/historial.mapeo';
import { datosDe, idEnRuta, todasLasPaginas, urlApi } from './peticiones';

/** Máximo de `limite` que acepta `GET /conflictos/actividad-reciente`. */
const LIMITE_MAXIMO_RECIENTES = 50;

/**
 * Historial de los conflictos contra el backend (wssisci). Mismos métodos
 * públicos que `HistorialMockService`, al que sustituye en `app.config.ts`.
 *
 * Lo que el backend NO guarda como eventos: solo la línea de tiempo del
 * conflicto (`LINEA_DE_TIEMPO`, cambios de estado) es un registro real. Los
 * eventos de plan y de actividad (creado, firmado, evidencia subida o
 * revisada, vencimiento) se siguen derivando de las fechas del plan con
 * `armarHistorial`, igual que en el mock; no tienen autor real.
 *
 * @author Sebas Constante
 */
@Injectable({
  providedIn: 'root'
})
export class HistorialHttpService implements Pick<HistorialMockService, keyof HistorialMockService> {
  private readonly http = inject(HttpClient);
  private readonly reloj = inject(RELOJ);

  /**
   * Conflictos que se pueden consultar (`GET /conflictos`, todas las
   * páginas), por número.
   *
   * @returns Conflictos sin planes; vacía si falla.
   */
  obtenerConflictos(): Observable<Conflicto[]> {
    return todasLasPaginas<ConflictoApi>(this.http, '/conflictos').pipe(
      map((filas) => filas.map((c) => mapearConflicto(c)).sort(porId)),
      manejarError<Conflicto[]>('HistorialHttpService.obtenerConflictos', [])
    );
  }

  /**
   * Un resumen por conflicto para las tarjetas (`GET /conflictos/expedientes`,
   * todas las páginas). El estado se calcula con `estadoDeConflicto`.
   *
   * @returns Resúmenes por número de conflicto; vacía si falla.
   */
  obtenerResumenes(): Observable<ResumenHistorial[]> {
    return todasLasPaginas<ExpedienteApi>(this.http, '/conflictos/expedientes').pipe(
      map((expedientes) => expedientes
        .map((e) => mapearConflicto(e.CONFLICTO, e.PLANES))
        .sort(porId)
        .map((conflicto) => {
          const planes = [...conflicto.planes].sort((a, b) => a.numero - b.numero);

          return { conflicto, planes, estado: estadoDeConflicto(conflicto, planes) };
        })),
      manejarError<ResumenHistorial[]>('HistorialHttpService.obtenerResumenes', [])
    );
  }

  /**
   * Los últimos movimientos de todos los conflictos
   * (`GET /conflictos/actividad-reciente?limite=`).
   *
   * @param limite Cuántos devolver (el backend acepta de 1 a 50).
   * @returns Eventos del más reciente al más antiguo; vacía si falla.
   */
  obtenerEventosRecientes(limite: number): Observable<EventoReciente[]> {
    const tope = Math.min(LIMITE_MAXIMO_RECIENTES, Math.max(1, Math.trunc(limite)));

    return this.http
      .get<RespuestaApi<ActividadRecienteApi[]>>(urlApi('/conflictos/actividad-reciente'), { params: { limite: tope } })
      .pipe(
        datosDe<ActividadRecienteApi[]>(),
        map((filas) => (filas ?? []).map(mapearActividadReciente)),
        manejarError<EventoReciente[]>('HistorialHttpService.obtenerEventosRecientes', [])
      );
  }

  /**
   * Historial de un conflicto (`GET /conflictos/{id}`): los eventos del
   * conflicto vienen de su línea de tiempo y los de cada plan y actividad
   * se derivan de sus fechas (ver el TSDoc de la clase).
   *
   * @param conflictoId Id del conflicto.
   * @returns El árbol, o `null` si el conflicto no existe o si falla.
   */
  obtenerHistorial(conflictoId: string): Observable<HistorialConflicto | null> {
    return this.http
      .get<RespuestaApi<ConflictoDetalleApi>>(urlApi('/conflictos/' + idEnRuta(conflictoId)))
      .pipe(
        datosDe<ConflictoDetalleApi>(),
        map((detalle): HistorialConflicto | null => {
          if (detalle === undefined) {
            return null;
          }

          const conflicto = mapearConflictoDetalle(detalle);
          const arbol = armarHistorial(conflicto, conflicto.planes, [], this.reloj());
          const eventos = (detalle.LINEA_DE_TIEMPO ?? [])
            .map((proceso) => mapearProceso(proceso, conflicto.id))
            .sort((a, b) => instanteDe(a.fecha) - instanteDe(b.fecha));

          return { ...arbol, eventos };
        }),
        manejarError<HistorialConflicto | null>('HistorialHttpService.obtenerHistorial', null)
      );
  }
}

/**
 * @param a Conflicto.
 * @param b Conflicto.
 * @returns Orden por número de conflicto (como el mock).
 */
function porId(a: Conflicto, b: Conflicto): number {
  return a.id.localeCompare(b.id, undefined, { numeric: true });
}
