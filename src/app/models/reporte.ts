import { EstadoSeguimiento, Riesgo } from './tipos-conflicto';

/**
 * Reportes en Excel de la gestion de conflictos:
 * - `RG.02`: Análisis de Conflictos;
 * - `RG.03`: Informe General.
 *
 * El RG.01 (formularios recibidos) es el «Exportar» de `/admin`, del host.
 *
 * @author Elvis Flores
 */
export type TipoReporte = 'RG.02' | 'RG.03';

/**
 * Filtros que se mandan a `GET /conflictos/reporte`. Solo los que el
 * backend sabe aplicar; los que faltan no filtran.
 *
 * @author Elvis Flores
 */
export interface FiltroReporte {
  /** Analisis del que salen los casos (RG.02). */
  analisisId?: string;
  riesgo?: Riesgo;
  /** Estado de seguimiento del conflicto. */
  estado?: EstadoSeguimiento;
  /** Solo conflictos con actividades vencidas. */
  vencido?: boolean;
}

/**
 * Resultado de pedir un reporte:
 * - `descargado`: el archivo se descargo con ese nombre;
 * - `sin-backend`: sesion simulada, no hay de donde sacarlo;
 * - `error`: no se pudo (motivo para el usuario).
 *
 * @author Elvis Flores
 */
export type ResultadoReporte =
  | { estado: 'descargado'; nombreArchivo: string }
  | { estado: 'sin-backend' }
  | { estado: 'error'; mensaje: string };
