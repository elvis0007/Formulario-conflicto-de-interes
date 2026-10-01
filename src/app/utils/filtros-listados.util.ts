import { Excusa, FormularioCI } from '../models';
import { estaEnRangoFechas } from './fechas.util';
import { contieneTexto } from './texto.util';

/**
 * Filtros de listados de formularios. Todos se combinan (Y logico); un
 * valor vacio (`''`) desactiva ese filtro.
 *
 * @author Elvis Flores
 */

/** Valor de «Todos» en los selectores de filtro. */
export const TODOS = '';

/**
 * Filtros de «Formularios recibidos».
 */
export interface FiltrosFormularios {
  /** `Interno`, `Externo` o `''` (todos). */
  origen: string;
  /** Valor del catalogo de tipos de contrato o `''` (todos). */
  tipoContrato: string;
  /** Fecha minima `aaaa-mm-dd` o `''`. */
  desde: string;
  /** Fecha maxima `aaaa-mm-dd` o `''`. */
  hasta: string;
  /** Texto libre. */
  busqueda: string;
}

/**
 * Filtros de «Excusas recibidas».
 */
export interface FiltrosExcusas {
  /** `Interno`, `Externo` o `''` (todos). */
  origen: string;
  /** Valor del catalogo de tipos de proceso o `''` (todos). */
  proceso: string;
  /** Fecha minima `aaaa-mm-dd` o `''`. */
  desde: string;
  /** Fecha maxima `aaaa-mm-dd` o `''`. */
  hasta: string;
  /** Texto libre. */
  busqueda: string;
}

/**
 * @returns Filtros de formularios sin ningun criterio.
 */
export function filtrosFormulariosVacios(): FiltrosFormularios {
  return { origen: TODOS, tipoContrato: TODOS, desde: '', hasta: '',
    busqueda: '' };
}

/**
 * @returns Filtros de excusas sin ningun criterio.
 */
export function filtrosExcusasVacios(): FiltrosExcusas {
  return { origen: TODOS, proceso: TODOS, desde: '', hasta: '',
    busqueda: '' };
}

/**
 * Aplica todos los filtros a la vez. La busqueda de texto mira nombre,
 * cedula, tipo, tipo de contrato, cargo, departamento y nombres de los
 * familiares declarados, sin distinguir mayusculas ni tildes.
 *
 * @param lista Formularios.
 * @param filtros Criterios.
 * @returns Formularios que cumplen todos los criterios, en el mismo orden.
 */
export function filtrarFormularios(
  lista: readonly FormularioCI[],
  filtros: FiltrosFormularios
): FormularioCI[] {
  return lista.filter((f) =>
    (filtros.origen === TODOS || f.origen === filtros.origen)
    && (filtros.tipoContrato === TODOS
      || f.tipoContrato === filtros.tipoContrato)
    && estaEnRangoFechas(f.fecha, filtros.desde, filtros.hasta)
    && contieneTexto([
      f.nombre, f.cedula, f.tipo, f.tipoContrato, f.cargo,
      f.departamento, ...f.familiares.map((fam) => fam.nombre)
    ], filtros.busqueda)
  );
}

/**
 * Aplica todos los filtros a la vez. La busqueda de texto mira nombre,
 * cedula, proceso y su detalle, familiar, parentesco, motivo y reemplazo.
 *
 * @param lista Excusas.
 * @param filtros Criterios.
 * @returns Excusas que cumplen todos los criterios, en el mismo orden.
 */
export function filtrarExcusas(
  lista: readonly Excusa[],
  filtros: FiltrosExcusas
): Excusa[] {
  return lista.filter((e) =>
    (filtros.origen === TODOS || e.origen === filtros.origen)
    && (filtros.proceso === TODOS || e.proceso === filtros.proceso)
    && estaEnRangoFechas(e.fecha, filtros.desde, filtros.hasta)
    && contieneTexto([
      e.nombre, e.cedula, e.proceso, e.detalleProceso, e.familiar,
      e.parentesco, e.motivo, e.reemplazo
    ], filtros.busqueda)
  );
}
