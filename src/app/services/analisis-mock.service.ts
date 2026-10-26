import { Injectable, Injector, inject } from '@angular/core';
import { MonoTypeOperatorFunction, Observable, catchError, defer, forkJoin, map, of, pipe, tap, throwError } from 'rxjs';
import {
  AnalisisConflictos,
  Clasificacion,
  ResumenAnalisis
} from '../models';
import { contarPendientes } from '../utils/analisis.util';
import { manejarError } from '../utils/manejar-error';
import { RELOJ } from '../utils/reloj';
import { CONFLICTOS } from './mock-data/conflictos.data';
import { simularRespuesta } from './mock-data/simular-respuesta';
import { PerfilUsuarioService } from './perfil-usuario.service';
import { PlanesMockService } from './planes-mock.service';

/**
 * Latencia de «Generar análisis», en ms. Es mayor que la de una consulta
 * normal porque simula volver a correr el algoritmo de cruce; asi se ve el
 * estado de carga del boton.
 */
export const LATENCIA_GENERACION_MS = 1200;

/** Mensaje si una accion falla sin un motivo concreto. */
const ERROR_ACCION = 'No se pudo completar la acción. Inténtalo de nuevo.';

/**
 * Analisis vacio: el que hay antes de generar el primero, y el valor que
 * se devuelve si una consulta falla.
 */
const ANALISIS_VACIO: AnalisisConflictos = {
  id: null,
  estado: null,
  fechaGeneracion: null,
  conflictos: []
};

/**
 * Analisis de conflictos (PNIP.CI.RG.02) con datos simulados.
 *
 * DECISION: es un servicio aparte de `ConflictosMockService` porque el
 * analisis es otro recurso con estado propio (Borrador / Validado, fecha
 * de generacion, historial) y otros endpoints (`GET /analisis/actual`,
 * `POST /analisis/generar`, `PATCH /analisis/casos/:id/clasificacion`,
 * `POST /analisis/:id/validar`). `ConflictosMockService` sigue sirviendo
 * el detalle de un conflicto (`GET /conflictos/:id`).
 *
 * Reglas:
 * - Generar crea un analisis nuevo en Borrador. El actual (Borrador o
 *   Validado) pasa al historial sin modificarse.
 * - Solo se clasifica un caso mientras el analisis esta en Borrador, y solo
 *   si el caso sigue en `DETECTADO`: como en el backend, clasificar es
 *   definitivo (no hay vuelta a «sin clasificar» ni cambio de D a N...).
 * - Homonimo (H) exige observacion.
 * - Solo se valida si no quedan casos pendientes de clasificar.
 * - Cuando una accion falla deja el motivo en `ultimoError`, con los mismos
 *   textos que el backend.
 *
 * Guarda todo en memoria durante la sesion: si se sale de la pantalla y
 * se vuelve, los cambios siguen ahi. Al iniciar la app no hay ningun
 * analisis generado.
 *
 * Los planes de cada caso NO son parte del analisis: se piden a
 * `PlanesMockService` al devolverlo, asi siempre son los vigentes (un plan
 * creado o guardado en Plan de Acción aparece aqui).
 *
 * @author Elvis Flores
 */
@Injectable({
  providedIn: 'root'
})
export class AnalisisMockService {
  /**
   * Motivo del ultimo fallo de `generarAnalisis`, `actualizarClasificacion`
   * o `validarAnalisis`. `null` si la ultima salio bien.
   */
  ultimoError: string | null = null;

  /** Analisis vigente en memoria. */
  private analisis: AnalisisConflictos = structuredClone(ANALISIS_VACIO);

  /** Analisis anteriores, del mas antiguo al mas reciente. */
  private readonly historial: AnalisisConflictos[] = [];

  /** Correlativo para los ids de los analisis (AN-001, AN-002...). */
  private correlativo = 0;

  private readonly planesServicio = inject(PlanesMockService);
  private readonly reloj = inject(RELOJ);

  /**
   * Para resolver `PerfilUsuarioService` (quien clasifica o valida) solo al
   * hacerlo: asi crear este servicio no exige la sesion.
   */
  private readonly injector = inject(Injector);

  /**
   * Obtiene el analisis vigente.
   *
   * @returns El analisis; con `estado: null` y sin conflictos si nunca se
   * genero o si la consulta falla.
   */
  obtenerAnalisisActual(): Observable<AnalisisConflictos> {
    return this.conPlanesVigentes(simularRespuesta(this.analisis)).pipe(
      manejarError<AnalisisConflictos>(
        'AnalisisMockService.obtenerAnalisisActual',
        structuredClone(ANALISIS_VACIO)
      )
    );
  }

  /**
   * Vuelve a correr el algoritmo de deteccion: crea un analisis nuevo en
   * Borrador, con la fecha de ahora y los casos detectados. El analisis
   * vigente, si lo hay, pasa al historial tal como esta.
   *
   * @returns El analisis recien generado; el vacio si la generacion falla.
   */
  generarAnalisis(): Observable<AnalisisConflictos> {
    if (this.analisis.estado !== null) {
      this.historial.push(structuredClone(this.analisis));
    }

    this.correlativo++;
    this.analisis = {
      id: 'AN-' + String(this.correlativo).padStart(3, '0'),
      estado: 'BORRADOR',
      fechaGeneracion: this.reloj().toISOString(),
      conflictos: structuredClone([...CONFLICTOS])
    };

    return this.conPlanesVigentes(simularRespuesta(this.analisis, LATENCIA_GENERACION_MS)).pipe(
      this.fallar<AnalisisConflictos>('AnalisisMockService.generarAnalisis', structuredClone(ANALISIS_VACIO))
    );
  }

  /**
   * Analisis anteriores, del mas reciente al mas antiguo (solo lectura).
   *
   * @returns Resumen de cada analisis anterior; vacio si no hay o si la
   * consulta falla.
   */
  obtenerHistorialAnalisis(): Observable<ResumenAnalisis[]> {
    const resumenes = [...this.historial].reverse().map((a): ResumenAnalisis => ({
      id: a.id ?? '',
      fechaGeneracion: a.fechaGeneracion ?? '',
      estado: a.estado ?? 'BORRADOR',
      totalCasos: a.conflictos.length,
      confirmados: a.conflictos.filter((c) => (c.clasificacion === 'D' || c.clasificacion === 'N')).length
    }));

    return simularRespuesta(resumenes).pipe(
      manejarError<ResumenAnalisis[]>('AnalisisMockService.obtenerHistorialAnalisis', [])
    );
  }

  /**
   * Clasifica un caso del analisis vigente.
   *
   * @param conflictoId Id del caso.
   * @param clasificacion Nueva clasificacion. `null` (volver a «sin
   * clasificar») se rechaza: el backend no lo permite.
   * @param observacion Observacion (se guarda recortada); obligatoria para H.
   * @returns `true` si se guardo; `false` si el caso no existe, ya no esta
   * en `DETECTADO`, el analisis no esta en Borrador, falta la observacion de
   * un homonimo o la operacion falla (el motivo queda en `ultimoError`).
   */
  actualizarClasificacion(
    conflictoId: string,
    clasificacion: Clasificacion | null,
    observacion: string
  ): Observable<boolean> {
    return defer(() => {
      const caso = this.analisis.conflictos.find((c) => c.id === conflictoId);

      if (this.analisis.estado !== 'BORRADOR') {
        return throwError(() => new Error(this.analisis.estado === null
          ? 'El análisis no existe'
          : 'El análisis ya está validado: la clasificación no se puede cambiar.'));
      }
      if (caso === undefined) {
        return throwError(() => new Error('El conflicto no existe'));
      }
      if (caso.estado !== 'DETECTADO') {
        return throwError(() => new Error(
          'El conflicto ya no está en DETECTADO (' + caso.estado + '): su clasificación es definitiva.'));
      }
      if (clasificacion === null) {
        return throwError(() => new Error('Elige una clasificación: un caso no puede volver a «Pendiente de revisión».'));
      }
      if (clasificacion === 'H' && observacion.trim() === '') {
        return throwError(() => new Error('El comentario es obligatorio para descartar un homónimo.'));
      }

      // Lo que el backend hace en cascada desde DETECTADO: D/N pasan a
      // planificacion y H se descarta.
      caso.clasificacion = clasificacion;
      caso.estado = clasificacion === 'H' ? 'DESCARTADO' : 'EN_PLANIFICACION';
      caso.observacionClasificacion = observacion.trim() || undefined;
      caso.fechaClasificacion = this.reloj().toISOString();
      caso.clasificadoPor = this.nombreUsuario();
      return simularRespuesta(true);
    }).pipe(
      this.fallar<boolean>('AnalisisMockService.actualizarClasificacion', false)
    );
  }

  /**
   * Valida el analisis vigente: desde ahi ya no se puede reclasificar.
   *
   * @returns `true` si se valido; `false` si no esta en Borrador, quedan
   * casos pendientes o la operacion falla (el motivo queda en `ultimoError`).
   */
  validarAnalisis(): Observable<boolean> {
    return defer(() => {
      if (this.analisis.estado !== 'BORRADOR') {
        return throwError(() => new Error(this.analisis.estado === null
          ? 'El análisis no existe'
          : 'El análisis ' + this.analisis.id + ' ya está validado'));
      }

      const pendientes = contarPendientes(this.analisis.conflictos);

      if (pendientes > 0) {
        return throwError(() => new Error(
          'No se puede validar el análisis: quedan ' + pendientes + ' conflicto(s) sin clasificar'));
      }

      this.analisis.estado = 'VALIDADO';
      this.analisis.fechaValidacion = this.reloj().toISOString();
      this.analisis.validadoPor = this.nombreUsuario();
      return simularRespuesta(true);
    }).pipe(
      this.fallar<boolean>('AnalisisMockService.validarAnalisis', false)
    );
  }

  /**
   * Reemplaza los planes de cada caso por los vigentes de
   * `PlanesMockService`. Ambas consultas corren en paralelo.
   *
   * @param analisis$ Respuesta del analisis.
   * @returns El analisis con los planes vigentes de cada caso.
   */
  /**
   * Todos los analisis generados en la sesion (los anteriores y el
   * vigente), del mas antiguo al mas reciente, sin planes. Lo usa el
   * Historial para los eventos de deteccion, clasificacion y validacion.
   *
   * @returns Analisis registrados; vacia si no se genero ninguno o si falla.
   * @author Elvis Flores
   */
  obtenerAnalisisRegistrados(): Observable<AnalisisConflictos[]> {
    const registrados = this.analisis.estado === null ? [...this.historial] : [...this.historial, this.analisis];

    return simularRespuesta(registrados).pipe(
      manejarError<AnalisisConflictos[]>('AnalisisMockService.obtenerAnalisisRegistrados', [])
    );
  }

  /** @returns Nombre del usuario actual (quien clasifica o valida). */
  private nombreUsuario(): string {
    return this.injector.get(PerfilUsuarioService).obtenerNombreUsuario();
  }

  /**
   * Manejo de error de las acciones: guarda el motivo en `ultimoError` (o lo
   * limpia si salio bien), lo registra y emite `valor`.
   *
   * @param origen `Clase.metodo`, para el log.
   * @param valor Valor que se emite si falla.
   * @returns Operador.
   */
  private fallar<T>(origen: string, valor: T): MonoTypeOperatorFunction<T> {
    return pipe(
      tap(() => this.ultimoError = null),
      catchError((err: unknown) => {
        this.ultimoError = err instanceof Error && err.message !== '' ? err.message : ERROR_ACCION;
        console.error('[' + origen + ']', this.ultimoError, err);
        return of(valor);
      })
    );
  }

  private conPlanesVigentes(analisis$: Observable<AnalisisConflictos>): Observable<AnalisisConflictos> {
    return forkJoin([analisis$, this.planesServicio.obtenerPlanes()]).pipe(
      map(([analisis, planes]) => ({
        ...analisis,
        conflictos: analisis.conflictos.map((c) => ({
          ...c,
          planes: planes
            .filter((p) => p.conflictoId === c.id)
            .sort((a, b) => a.numero - b.numero)
        }))
      }))
    );
  }
}
