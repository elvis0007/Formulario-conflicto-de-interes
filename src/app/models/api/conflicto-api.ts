import {
  ClasificacionApi,
  EstadoAnalisisApi,
  EstadoSeguimientoApi,
  OrigenApi,
  ParentescoApi,
  RiesgoApi,
  TipoGradoApi,
  TipoRelacionApi,
} from './enums-api';
import { PlanApi } from './plan-api';

/**
 * Interfaces del módulo de conflictos, tal cual llegan del backend.
 * Fechas: `LocalDate` = `"yyyy-MM-dd"`, `LocalDateTime` = ISO-8601 sin zona.
 *
 * @author Sebas Constante
 */

/**
 * Resultado de ejecutar el análisis (`ResumenAnalisisDto`).
 * Devuelto por `POST /conflictos/analisis`.
 */
export interface ResumenAnalisisApi {
  ANALISIS_ID: number | null;
  NUEVOS: number;
  EXISTENTES: number;
  OMITIDOS: number;
  DECLARADOS_SIN_NOMINA: number;
  /** Clave = nombre de `ParentescoApi`, valor = cantidad. */
  NUEVOS_POR_PARENTESCO: Record<string, number> | null;
  PERSONAS: number;
  COMPARACIONES: number;
  MILISEGUNDOS: number;
}

/**
 * Fila del historial de análisis (`AnalisisDto`).
 * Devuelta (lista) por `GET /conflictos/analisis`; un elemento por `POST /conflictos/analisis/{id}/validar`.
 */
export interface AnalisisApi {
  CODIGO: number | null;
  ESTADO_ANALISIS: EstadoAnalisisApi | null;
  /** ISO-8601 sin zona. */
  FECHA_EJECUCION: string | null;
  /** ISO-8601 sin zona. */
  FECHA_VALIDACION: string | null;
  VALIDADO_POR: string | null;
  TOTAL_NUEVOS: number | null;
  TOTAL_EXISTENTES: number | null;
  TOTAL_OMITIDOS: number | null;
  TOTAL_CONFLICTOS: number;
  SIN_CLASIFICAR: number;
}

/**
 * Conflicto (`ConflictoDto`).
 * Devuelto por `GET /conflictos` (página), `GET /conflictos/reporte` (lista),
 * `GET /conflictos/persona/{cedula}` (lista), `POST /conflictos/{id}/transicion`;
 * anidado en `ConflictoDetalleApi.CONFLICTO` y `ExpedienteApi.CONFLICTO`.
 */
export interface ConflictoApi {
  CODIGO: number | null;
  ANALISIS_ID: number | null;
  CEDULA_A: string | null;
  NOMBRE_A: string | null;
  DEPARTAMENTO_A: string | null;
  CEDULA_B: string | null;
  NOMBRE_B: string | null;
  DEPARTAMENTO_B: string | null;
  TIPO_RELACION: TipoRelacionApi | null;
  /** Parentesco de A hacia B. */
  PARENTESCO: ParentescoApi | null;
  /** Parentesco de B hacia A. */
  PARENTESCO_INVERSO: ParentescoApi | null;
  TIPO_GRADO: TipoGradoApi | null;
  /** Null cuando el parentesco es `OTRO`. */
  GRADO: number | null;
  RIESGO: RiesgoApi | null;
  ORIGEN: OrigenApi | null;
  /** Null mientras no se clasifique (ver `AnalisisApi.SIN_CLASIFICAR`). */
  CLASIFICACION: ClasificacionApi | null;
  /** Decimal (BigDecimal), p. ej. 0.95. */
  CONFIANZA: number | null;
  DETALLE: string | null;
  OBSERVACION: string | null;
  ESTADO_SEGUIMIENTO: EstadoSeguimientoApi | null;
  VENCIDO: boolean;
  /** ISO-8601 sin zona. */
  FECHA_DETECCION: string | null;
}

/**
 * Evento de la línea de tiempo (`ProcesoDto`).
 * Anidado en `ConflictoDetalleApi.LINEA_DE_TIEMPO`.
 */
export interface ProcesoApi {
  CODIGO: number | null;
  ESTADO_ANTERIOR: EstadoSeguimientoApi | null;
  ESTADO_NUEVO: EstadoSeguimientoApi | null;
  COMENTARIO: string | null;
  USUARIO: string | null;
  /** ISO-8601 sin zona. */
  FECHA: string | null;
}

/** Persona con cargo (`DirectorDto`, shared). Director o jefe inmediato en `ConflictoDetalleApi`. */
export interface DirectorApi {
  DMPER_CODIGO: string | null;
  NOMBRE: string | null;
  CARGO: string | null;
  DEPARTAMENTO: string | null;
}

/** Ficha laboral de una persona (`FichaPersonaDto`, shared). Anidada en `ConflictoDetalleApi.FICHA_A/B`. */
export interface FichaPersonaApi {
  CARGO: string | null;
  /** `yyyy-MM-dd`. */
  FECHA_INGRESO: string | null;
  NOMBRE_PADRE: string | null;
  NOMBRE_MADRE: string | null;
  NOMBRE_CONYUGE: string | null;
}

/**
 * Detalle completo de un conflicto (`ConflictoDetalleDto`).
 * Devuelto por `GET /conflictos/{id}`. Los datos de ficha/director/jefe pueden ser null si no se encuentran.
 * `PLAN` es el plan vigente (o null); `PLANES` es el historial completo (puede ser `[]`).
 */
export interface ConflictoDetalleApi {
  CONFLICTO: ConflictoApi;
  LINEA_DE_TIEMPO: ProcesoApi[] | null;
  PLAN: PlanApi | null;
  PLANES: PlanApi[] | null;
  DIRECTOR_A: DirectorApi | null;
  DIRECTOR_B: DirectorApi | null;
  FICHA_A: FichaPersonaApi | null;
  FICHA_B: FichaPersonaApi | null;
  JEFE_INMEDIATO_A: DirectorApi | null;
  JEFE_INMEDIATO_B: DirectorApi | null;
}

/**
 * Conflicto con todos sus planes (`ExpedienteDto`).
 * Devuelto (dentro de `PaginaApi`) por `GET /conflictos/expedientes`.
 * En cada actividad de `PLANES`, `EVIDENCIAS` trae solo la última evidencia (0 o 1).
 */
export interface ExpedienteApi {
  CONFLICTO: ConflictoApi;
  /** Del primero al último; `[]` si no hay. */
  PLANES: PlanApi[];
}

/**
 * Totales del tablero (`ResumenConflictosDto`).
 * Devuelto por `GET /conflictos/resumen`. Los mapas pueden omitir claves con cero.
 */
export interface ResumenConflictosApi {
  TOTAL_CONFLICTOS: number;
  /** Clave = `RiesgoApi`. */
  POR_RIESGO: Record<string, number> | null;
  /** Clave = `EstadoSeguimientoApi`. */
  POR_ESTADO_SEGUIMIENTO: Record<string, number> | null;
  /** Clave = `EstadoActividadApi`. */
  ACTIVIDADES_POR_ESTADO: Record<string, number> | null;
  ACTIVIDADES_VENCIDAS: number;
  CONFLICTOS_VENCIDOS: number;
}

/**
 * Transición reciente de cualquier conflicto (`ActividadRecienteDto`).
 * Devuelta (lista) por `GET /conflictos/actividad-reciente?limite=10`.
 */
export interface ActividadRecienteApi {
  CODIGO: number | null;
  CONFLICTO_ID: number | null;
  NOMBRE_A: string | null;
  NOMBRE_B: string | null;
  ESTADO_ANTERIOR: EstadoSeguimientoApi | null;
  ESTADO_NUEVO: EstadoSeguimientoApi | null;
  COMENTARIO: string | null;
  USUARIO: string | null;
  /** ISO-8601 sin zona. */
  FECHA: string | null;
}

/**
 * Filtros (query string, camelCase) de `GET /conflictos`, `/conflictos/reporte` y `/conflictos/expedientes`.
 * Los dos listados paginados aceptan además `pagina` (0 por defecto) y `tamanoPagina` (20 por defecto, máx. 200).
 */
export interface FiltroConflictosApi {
  riesgo?: string;
  estado?: string;
  clasificacion?: string;
  departamento?: string;
  analisisId?: number;
  cedula?: string;
  vencido?: boolean;
  pagina?: number;
  tamanoPagina?: number;
}

/**
 * Cuerpo JSON (camelCase) de `POST /conflictos/{id}/transicion`. Responde `ConflictoApi`.
 */
export interface TransicionRequestApi {
  /** Obligatorio: estado al que pasa el conflicto. */
  estadoNuevo: EstadoSeguimientoApi;
  /** Justificación obligatoria, máx. 2000 caracteres. */
  comentario: string;
  /** Opcional: clasificación (D, N, H) que se fija en la transición. */
  clasificacion?: ClasificacionApi | null;
}
