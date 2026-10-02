import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { AnalisisConflictos } from '../models';
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
  estado: null,
  fechaGeneracion: null,
  conflictos: []
};

/**
 * Analisis de conflictos (PNIP.CI.RG.02) con datos simulados.
 *
 * DECISION: es un servicio aparte de `ConflictosMockService` porque el
 * analisis es otro recurso con estado propio (Borrador / Validado, fecha
 * de generacion) y otros endpoints (`GET /analisis/actual`,
 * `POST /analisis/generar`). `ConflictosMockService` sigue sirviendo el
 * detalle de un conflicto (`GET /conflictos/:id`), que usaran el modal y
 * el plan de accion.
 *
 * Guarda el analisis en memoria durante la sesion. Al iniciar la app no
 * hay ninguno generado, como en un sistema recien instalado.
 *
 * @author Elvis Flores
 */
@Injectable({
  providedIn: 'root'
})
export class AnalisisMockService {
  /** Analisis vigente en memoria. */
  private analisis: AnalisisConflictos = structuredClone(ANALISIS_VACIO);

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
   * Vuelve a correr el algoritmo de deteccion: reemplaza el analisis
   * vigente por uno nuevo en Borrador, con la fecha de ahora y los casos
   * detectados.
   *
   * @returns El analisis recien generado; el vacio si la generacion falla.
   */
  generarAnalisis(): Observable<AnalisisConflictos> {
    this.analisis = {
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
}
