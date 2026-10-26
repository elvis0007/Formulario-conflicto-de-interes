import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { MonoTypeOperatorFunction, Observable, catchError, map, of, pipe, switchMap, tap } from 'rxjs';
import { AnalisisConflictos, Clasificacion, Conflicto, ResumenAnalisis } from '../../models';
import { AnalisisApi, ConflictoApi, ExpedienteApi, RespuestaApi, TransicionRequestApi } from '../../models/api';
import { manejarError } from '../../utils/manejar-error';
import { AnalisisMockService } from '../analisis-mock.service';
import { crearAnalisisVacio, mapearAnalisis, mapearResumenAnalisis } from './mapeos/analisis.mapeo';
import { mapearConflicto } from './mapeos/conflicto.mapeo';
import { datosDe, idEnRuta, mensajeDeError, todasLasPaginas, urlApi } from './peticiones';

/** Mensaje si el backend no explica por qué falló una acción. */
const ERROR_ACCION = 'No se pudo completar la acción. Inténtalo de nuevo.';

/**
 * Análisis de conflictos contra el backend (wssisci). Mismos métodos
 * públicos que `AnalisisMockService`, al que sustituye en `app.config.ts`.
 *
 * - El análisis «actual» es el más reciente de `GET /conflictos/analisis`.
 *   Sus casos salen de `GET /conflictos/expedientes?analisisId=` (y no de
 *   `GET /conflictos`) porque la pantalla necesita también los planes de
 *   cada caso para decidir si ofrece «Crear plan».
 * - Clasificar es una transición de estado
 *   (`POST /conflictos/{id}/transicion`). Es definitiva: una vez fuera de
 *   `DETECTADO` el backend responde 409 si se intenta cambiar.
 * - Las acciones que devuelven vacío o `false` al fallar dejan el `mensaje`
 *   del backend en `ultimoError`.
 *
 * @author Sebas Constante
 */
@Injectable({
  providedIn: 'root'
})
export class AnalisisHttpService implements Pick<AnalisisMockService, keyof AnalisisMockService> {
  /**
   * Motivo del último fallo de `generarAnalisis`, `actualizarClasificacion`
   * o `validarAnalisis` (el `mensaje` del backend en 400/403/409, p. ej.
   * «quedan 3 conflicto(s) sin clasificar»). `null` si la última salió bien.
   */
  ultimoError: string | null = null;

  private readonly http = inject(HttpClient);

  /**
   * Obtiene el análisis más reciente con sus casos y planes.
   *
   * @returns El análisis; con `estado: null` y sin conflictos si nunca se
   * generó o si la consulta falla.
   */
  obtenerAnalisisActual(): Observable<AnalisisConflictos> {
    return this.listarAnalisis().pipe(
      switchMap((lista) => {
        const ultimo = lista[0];

        if (ultimo === undefined || ultimo.CODIGO === null) {
          return of(crearAnalisisVacio());
        }
        return this.casosDelAnalisis(ultimo.CODIGO)
          .pipe(map((conflictos) => mapearAnalisis(ultimo, conflictos)));
      }),
      manejarError<AnalisisConflictos>('AnalisisHttpService.obtenerAnalisisActual', crearAnalisisVacio())
    );
  }

  /**
   * Ejecuta el motor de parentesco (`POST /conflictos/analisis`) y vuelve a
   * pedir el análisis actual, porque la respuesta solo trae un resumen.
   *
   * @returns El análisis recién generado; el vacío si la generación falla.
   */
  generarAnalisis(): Observable<AnalisisConflictos> {
    return this.http.post<RespuestaApi<unknown>>(urlApi('/conflictos/analisis'), {}).pipe(
      switchMap(() => this.obtenerAnalisisActual()),
      this.fallar<AnalisisConflictos>('AnalisisHttpService.generarAnalisis', crearAnalisisVacio())
    );
  }

  /**
   * Análisis anteriores al actual, del más reciente al más antiguo.
   *
   * @returns Resumen de cada uno; vacío si no hay o si la consulta falla.
   */
  obtenerHistorialAnalisis(): Observable<ResumenAnalisis[]> {
    return this.listarAnalisis().pipe(
      map((lista) => lista.slice(1).map(mapearResumenAnalisis)),
      manejarError<ResumenAnalisis[]>('AnalisisHttpService.obtenerHistorialAnalisis', [])
    );
  }

  /**
   * Todos los análisis, del más antiguo al más reciente y sin casos (el
   * Historial solo necesita sus fechas y estados).
   *
   * @returns Análisis registrados; vacío si no hay o si falla.
   */
  obtenerAnalisisRegistrados(): Observable<AnalisisConflictos[]> {
    return this.listarAnalisis().pipe(
      map((lista) => [...lista].reverse().map((a) => mapearAnalisis(a, []))),
      manejarError<AnalisisConflictos[]>('AnalisisHttpService.obtenerAnalisisRegistrados', [])
    );
  }

  /**
   * Clasifica un caso. En el backend es una transición desde `DETECTADO`:
   * `D`/`N` pasan a `EN_PLANIFICACION` y `H` se descarta (comentario
   * obligatorio). El backend siempre exige un comentario: si no hay
   * observación en `D`/`N` se manda un texto fijo.
   *
   * @param conflictoId Id del caso.
   * @param clasificacion Nueva clasificación. `null` (volver a «sin
   * clasificar») no existe en el backend.
   * @param observacion Observación opcional (obligatoria para `H`).
   * @returns `true` si se guardó; `false` si no se pudo (incluye un caso
   * que ya no está en `DETECTADO`, que el backend rechaza con 409); el
   * motivo queda en `ultimoError`.
   */
  actualizarClasificacion(
    conflictoId: string,
    clasificacion: Clasificacion | null,
    observacion: string
  ): Observable<boolean> {
    const origen = 'AnalisisHttpService.actualizarClasificacion';
    const comentario = observacion.trim();

    if (clasificacion === null) {
      this.ultimoError = 'Elige una clasificación: un caso no puede volver a «Pendiente de revisión».';
      console.error('[' + origen + ']', this.ultimoError);
      return of(false);
    }
    if (clasificacion === 'H' && comentario === '') {
      this.ultimoError = 'Escribe una observación: es obligatoria para marcar un homónimo.';
      console.error('[' + origen + ']', this.ultimoError);
      return of(false);
    }

    const cuerpo: TransicionRequestApi = {
      estadoNuevo: clasificacion === 'H' ? 'DESCARTADO' : 'EN_PLANIFICACION',
      comentario: comentario
        || (clasificacion === 'D' ? 'Clasificado como declarado' : 'Clasificado como no declarado'),
      clasificacion
    };

    return this.http
      .post<RespuestaApi<ConflictoApi>>(urlApi('/conflictos/' + idEnRuta(conflictoId) + '/transicion'), cuerpo)
      .pipe(
        map(() => true),
        this.fallar<boolean>(origen, false)
      );
  }

  /**
   * Valida el análisis más reciente (`POST /conflictos/analisis/{id}/validar`).
   * Si quedan casos en `DETECTADO` el backend responde 409 («quedan N
   * conflicto(s) sin clasificar»); su mensaje queda en `ultimoError`.
   *
   * @returns `true` si se validó; `false` si no hay análisis o el backend
   * lo rechazó.
   */
  validarAnalisis(): Observable<boolean> {
    const origen = 'AnalisisHttpService.validarAnalisis';

    return this.listarAnalisis().pipe(
      switchMap((lista) => {
        const ultimo = lista[0];

        if (ultimo === undefined || ultimo.CODIGO === null) {
          this.ultimoError = 'No hay un análisis para validar.';
          console.error('[' + origen + ']', this.ultimoError);
          return of(false);
        }
        return this.http
          .post<RespuestaApi<AnalisisApi>>(urlApi('/conflictos/analisis/' + ultimo.CODIGO + '/validar'), {})
          .pipe(map(() => true), tap(() => this.ultimoError = null));
      }),
      catchError((err: unknown) => {
        this.ultimoError = mensajeDeError(err, ERROR_ACCION);
        console.error('[' + origen + '] No se pudo validar:', this.ultimoError, err);
        return of(false);
      })
    );
  }

  /**
   * Manejo de error de las acciones: deja el `mensaje` del backend en
   * `ultimoError` (o lo limpia si salió bien), lo registra y emite `valor`.
   *
   * @param origen `Clase.metodo`, para el log.
   * @param valor Valor que se emite si falla.
   * @returns Operador.
   */
  private fallar<T>(origen: string, valor: T): MonoTypeOperatorFunction<T> {
    return pipe(
      tap(() => this.ultimoError = null),
      catchError((err: unknown) => {
        this.ultimoError = mensajeDeError(err, ERROR_ACCION);
        console.error('[' + origen + ']', this.ultimoError, err);
        return of(valor);
      })
    );
  }

  /** @returns Análisis del backend, del más reciente al más antiguo. */
  private listarAnalisis(): Observable<AnalisisApi[]> {
    return this.http.get<RespuestaApi<AnalisisApi[]>>(urlApi('/conflictos/analisis'))
      .pipe(datosDe<AnalisisApi[]>(), map((lista) => lista ?? []));
  }

  /**
   * @param analisisId Código del análisis.
   * @returns Todos sus casos, cada uno con sus planes.
   */
  private casosDelAnalisis(analisisId: number): Observable<Conflicto[]> {
    return todasLasPaginas<ExpedienteApi>(this.http, '/conflictos/expedientes?analisisId=' + analisisId).pipe(
      map((expedientes) => expedientes.map((e) => mapearConflicto(e.CONFLICTO, e.PLANES)))
    );
  }
}
