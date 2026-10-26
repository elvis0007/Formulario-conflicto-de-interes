import { AnalisisApi } from '../../../models/api';
import { AnalisisConflictos, Conflicto, ResumenAnalisis } from '../../../models';

/**
 * Funciones puras que convierten los análisis del backend a los modelos de
 * la pantalla.
 *
 * @author Sebas Constante
 */

/**
 * Análisis vacío: el que hay antes de generar el primero.
 *
 * @returns Un análisis nuevo, sin estado ni casos.
 * @author Sebas Constante
 */
export function crearAnalisisVacio(): AnalisisConflictos {
  return { id: null, estado: null, fechaGeneracion: null, conflictos: [] };
}

/**
 * @param api Fila del historial de análisis.
 * @param conflictos Casos del análisis (vacío si no se necesitan).
 * @returns El análisis con sus casos.
 * @author Sebas Constante
 */
export function mapearAnalisis(api: AnalisisApi, conflictos: Conflicto[]): AnalisisConflictos {
  const analisis: AnalisisConflictos = {
    id: api.CODIGO === null ? null : String(api.CODIGO),
    estado: api.ESTADO_ANALISIS,
    fechaGeneracion: api.FECHA_EJECUCION,
    conflictos
  };

  if (api.FECHA_VALIDACION !== null) {
    analisis.fechaValidacion = api.FECHA_VALIDACION;
  }
  if (api.VALIDADO_POR !== null) {
    analisis.validadoPor = api.VALIDADO_POR;
  }
  return analisis;
}

/**
 * `confirmados` es `TOTAL_CONFLICTOS - SIN_CLASIFICAR`: el backend no separa
 * los homónimos (H) de los confirmados (D y N), así que los incluye.
 *
 * @param api Fila del historial de análisis.
 * @returns Fila del historial de la pantalla.
 * @author Sebas Constante
 */
export function mapearResumenAnalisis(api: AnalisisApi): ResumenAnalisis {
  return {
    id: String(api.CODIGO ?? ''),
    fechaGeneracion: api.FECHA_EJECUCION ?? '',
    estado: api.ESTADO_ANALISIS ?? 'BORRADOR',
    totalCasos: api.TOTAL_CONFLICTOS,
    confirmados: api.TOTAL_CONFLICTOS - api.SIN_CLASIFICAR
  };
}
