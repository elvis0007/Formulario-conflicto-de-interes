import { Injectable } from '@angular/core';
import { Observable, defer, throwError } from 'rxjs';
import {
  AnalisisConflictos,
  Clasificacion,
  ResumenAnalisis
} from '../models';
import { contarPendientes } from '../utils/analisis.util';
import { manejarError } from '../utils/manejar-error';
import { CONFLICTOS } from './mock-data/conflictos.data';
import { simularRespuesta } from './mock-data/simular-respuesta';

/**
 * Latencia de «Generar análisis», en ms. Es mayor que la de una consulta
 * normal porque simula volver a correr el algoritmo de cruce; asi se ve el
 * estado de carga del boton.
 */
export const LATENCIA_GENERACION_MS = 1200;

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
 * - Solo se clasifica un caso mientras el analisis esta en Borrador.
 * - Solo se valida si no quedan casos pendientes de clasificar.
 *
 * Guarda todo en memoria durante la sesion: si se sale de la pantalla y
 * se vuelve, los cambios siguen ahi. Al iniciar la app no hay ningun
 * analisis generado.
 *
 * @author Elvis Flores
 */
@Injectable({
  providedIn: 'root'
})
export class AnalisisMockService {
  /** Analisis vigente en memoria. */
  private analisis: AnalisisConflictos = structuredClone(ANALISIS_VACIO);

  /** Analisis anteriores, del mas antiguo al mas reciente. */
  private readonly historial: AnalisisConflictos[] = [];

  /** Correlativo para los ids de los analisis (AN-001, AN-002...). */
  private correlativo = 0;

  /**
   * Obtiene el analisis vigente.
   *
   * @returns El analisis; con `estado: null` y sin conflictos si nunca se
   * genero o si la consulta falla.
   */
  obtenerAnalisisActual(): Observable<AnalisisConflictos> {
    return simularRespuesta(this.analisis).pipe(
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
      estado: 'borrador',
      fechaGeneracion: new Date().toISOString(),
      conflictos: structuredClone([...CONFLICTOS])
    };

    return simularRespuesta(this.analisis, LATENCIA_GENERACION_MS).pipe(
      manejarError<AnalisisConflictos>(
        'AnalisisMockService.generarAnalisis',
        structuredClone(ANALISIS_VACIO)
      )
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
      estado: a.estado ?? 'borrador',
      totalCasos: a.conflictos.length,
      confirmados: a.conflictos.filter((c) => c.clasificacion === 'confirmado').length
    }));

    return simularRespuesta(resumenes).pipe(
      manejarError<ResumenAnalisis[]>('AnalisisMockService.obtenerHistorialAnalisis', [])
    );
  }

  /**
   * Clasifica un caso del analisis vigente.
   *
   * @param conflictoId Id del caso.
   * @param clasificacion Nueva clasificacion.
   * @param observacion Observacion opcional (se guarda recortada).
   * @returns `true` si se guardo; `false` si el caso no existe, el
   * analisis no esta en Borrador o la operacion falla.
   */
  actualizarClasificacion(
    conflictoId: string,
    clasificacion: Clasificacion,
    observacion: string
  ): Observable<boolean> {
    return defer(() => {
      const caso = this.analisis.conflictos.find((c) => c.id === conflictoId);

      if (this.analisis.estado !== 'borrador') {
        return throwError(() => new Error('El análisis no está en borrador.'));
      }
      if (caso === undefined) {
        return throwError(() => new Error('No existe el caso ' + conflictoId + '.'));
      }

      caso.clasificacion = clasificacion;
      caso.observacionClasificacion = observacion.trim() || undefined;
      return simularRespuesta(true);
    }).pipe(
      manejarError<boolean>('AnalisisMockService.actualizarClasificacion', false)
    );
  }

  /**
   * Valida el analisis vigente: desde ahi ya no se puede reclasificar.
   *
   * @returns `true` si se valido; `false` si no esta en Borrador, quedan
   * casos pendientes o la operacion falla.
   */
  validarAnalisis(): Observable<boolean> {
    return defer(() => {
      if (this.analisis.estado !== 'borrador') {
        return throwError(() => new Error('El análisis no está en borrador.'));
      }
      if (contarPendientes(this.analisis.conflictos) > 0) {
        return throwError(() => new Error('Quedan casos pendientes de clasificar.'));
      }

      this.analisis.estado = 'validado';
      return simularRespuesta(true);
    }).pipe(
      manejarError<boolean>('AnalisisMockService.validarAnalisis', false)
    );
  }
}
