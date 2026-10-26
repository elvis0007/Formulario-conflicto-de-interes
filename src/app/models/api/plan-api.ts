import {
  EstadoActividadApi,
  EstadoPlanApi,
  EstadoRevisionApi,
  MetodoFirmaApi,
  RiesgoApi,
  TipoCierreApi,
  TipoPersonaPlanApi,
} from './enums-api';

/**
 * Interfaces del módulo de planes de acción, tal cual llegan del backend.
 * Fechas: `LocalDate` = `"yyyy-MM-dd"`, `LocalDateTime` = ISO-8601 sin zona.
 *
 * @author Integración backend
 */

/**
 * Metadatos de un archivo guardado (`ArchivoInfoDto`). Va dentro de evidencias y del documento firmado.
 * El contenido se descarga por `GET /evidencias/{id}/archivo` o `GET /planes/{id}/documento` (binario).
 */
export interface ArchivoInfoApi {
  CODIGO: number | null;
  NOMBRE: string | null;
  TIPO_MIME: string | null;
  /** Tamaño en bytes. */
  TAMANIO: number | null;
}

/**
 * Evidencia de una actividad (`EvidenciaDto`).
 * Devuelta por `POST /actividades/{id}/evidencias`, y anidada en `ActividadApi.EVIDENCIAS`,
 * `ActividadBandejaApi.ULTIMA_EVIDENCIA` y `ResultadoRevisionApi.EVIDENCIA`.
 */
export interface EvidenciaApi {
  CODIGO: number | null;
  ACTIVIDAD_ID: number | null;
  ARCHIVO: ArchivoInfoApi | null;
  OBSERVACION: string | null;
  ESTADO_REVISION: EstadoRevisionApi | null;
  MOTIVO_RECHAZO: string | null;
  /** Código de nómina de quien subió. */
  SUBIDO_POR: string | null;
  /** ISO-8601 sin zona. */
  FECHA_SUBIDA: string | null;
  REVISADO_POR: string | null;
  /** ISO-8601 sin zona. */
  FECHA_REVISION: string | null;
}

/**
 * Actividad de un plan (`ActividadDto`).
 * Anidada en `PlanApi.ACTIVIDADES`. En `GET /conflictos/expedientes`, `EVIDENCIAS` trae solo la última (0 o 1).
 */
export interface ActividadApi {
  CODIGO: number | null;
  ORDEN: number | null;
  DESCRIPCION: string | null;
  /** Código de nómina (DMPER) del responsable. */
  RESPONSABLE: string | null;
  NOMBRE_RESPONSABLE: string | null;
  /** `yyyy-MM-dd`. */
  FECHA_ASIGNACION: string | null;
  PLAZO_MESES: number | null;
  PLAZO_DIAS: number | null;
  /** `yyyy-MM-dd`. */
  FECHA_LIMITE: string | null;
  /** `yyyy-MM-dd`. Fecha en que se aceptó/ejecutó. */
  FECHA_EJECUCION: string | null;
  ESTADO: EstadoActividadApi | null;
  VENCIDA: boolean;
  EVIDENCIAS: EvidenciaApi[] | null;
}

/** Persona involucrada en un plan (`InvolucradoDto`). Anidada en `PlanApi.INVOLUCRADOS`. */
export interface InvolucradoApi {
  DMPER_CODIGO: string | null;
  NOMBRE: string | null;
  /** D, F, J o I (`TipoPersonaPlan`). */
  TIPO: TipoPersonaPlanApi | null;
}

/**
 * Plan de acción (`PlanDto`).
 * Devuelto por `POST /conflictos/{id}/plan`, `PUT /planes/{id}`, `POST /planes/{id}/firmar`,
 * `POST /planes/{id}/cerrar`; anidado en `ConflictoDetalleApi.PLAN/PLANES` y `ExpedienteApi.PLANES`.
 */
export interface PlanApi {
  CODIGO: number | null;
  CONFLICTO_ID: number | null;
  /** Número secuencial del plan dentro del conflicto (1, 2, ...). */
  NUMERO: number | null;
  ESTADO_PLAN: EstadoPlanApi | null;
  OBJETIVO: string | null;
  /** `yyyy-MM-dd`. */
  FECHA_REUNION: string | null;
  METODO_FIRMA: MetodoFirmaApi | null;
  /** `yyyy-MM-dd`. */
  FECHA_FIRMA: string | null;
  DOCUMENTO_FIRMADO: ArchivoInfoApi | null;
  /** `yyyy-MM-dd`. */
  FECHA_CIERRE: string | null;
  TIPO_CIERRE: TipoCierreApi | null;
  MOTIVO_CIERRE: string | null;
  TODAS_ACEPTADAS: boolean;
  ACTIVIDADES: ActividadApi[] | null;
  INVOLUCRADOS: InvolucradoApi[] | null;
}

/**
 * Actividad sugerida para armar un plan (`ActividadSugeridaDto`).
 * Devuelta (lista) por `GET /conflictos/{id}/plan/sugerencia`.
 */
export interface ActividadSugeridaApi {
  ORDEN: number;
  DESCRIPCION: string | null;
  RESPONSABLE: string | null;
  PLAZO_MESES: number;
  PLAZO_DIAS: number;
}

/**
 * Fila de la bandeja "mis actividades" (`ActividadBandejaDto`).
 * Devuelta (lista) por `GET /actividades/mias?incluirCerrados=false`.
 */
export interface ActividadBandejaApi {
  CODIGO: number | null;
  CONFLICTO_ID: number | null;
  NOMBRE_A: string | null;
  NOMBRE_B: string | null;
  PARENTESCO: string | null;
  RIESGO: RiesgoApi | null;
  PLAN_ID: number | null;
  PLAN_NUMERO: number | null;
  /** `FIRMADO` o `CERRADO` (nunca BORRADOR en la bandeja). */
  PLAN_ESTADO: EstadoPlanApi | null;
  PLAN_OBJETIVO: string | null;
  /** Total de actividades del plan, de todos los responsables. */
  PLAN_TOTAL_ACTIVIDADES: number;
  DESCRIPCION: string | null;
  /** `yyyy-MM-dd`. */
  FECHA_ASIGNACION: string | null;
  PLAZO_MESES: number | null;
  PLAZO_DIAS: number | null;
  /** `yyyy-MM-dd`. */
  FECHA_LIMITE: string | null;
  ESTADO: EstadoActividadApi | null;
  VENCIDA: boolean;
  ULTIMA_EVIDENCIA: EvidenciaApi | null;
}

/**
 * Resultado de revisar una evidencia (`ResultadoRevisionDto`).
 * Devuelto por `PUT /evidencias/{id}/revisar`.
 */
export interface ResultadoRevisionApi {
  EVIDENCIA: EvidenciaApi | null;
  ESTADO_ACTIVIDAD: EstadoActividadApi | null;
  TODAS_ACEPTADAS: boolean;
}

// ---------------------------------------------------------------------------
// Requests (cuerpos que envía el front). NO llevan @JsonProperty: van en camelCase.
// ---------------------------------------------------------------------------

/** Actividad dentro de `CrearPlanRequestApi` (`CrearPlanRequestDto.ActividadRequest`). */
export interface ActividadRequestApi {
  /** Obligatoria, máx. 2000 caracteres. */
  descripcion: string;
  /** Obligatorio: código de nómina (DMPER), máx. 20 caracteres. */
  responsable: string;
  /** 0 a 120. */
  plazoMeses?: number | null;
  /** 0 a 999. */
  plazoDias?: number | null;
  orden?: number | null;
}

/** Involucrado dentro de `CrearPlanRequestApi` (`CrearPlanRequestDto.InvolucradoRequest`). */
export interface InvolucradoRequestApi {
  /** Código de nómina (DMPER), máx. 20 caracteres. */
  dmper: string;
  /** D, F, J o I. */
  tipo: TipoPersonaPlanApi;
}

/**
 * Cuerpo JSON (camelCase) de `POST /conflictos/{id}/plan` (crear) y `PUT /planes/{id}` (actualizar borrador).
 * Ambos responden `PlanApi`.
 */
export interface CrearPlanRequestApi {
  /** Máx. 2000 caracteres. */
  objetivo?: string | null;
  /** `yyyy-MM-dd`. */
  fechaReunion?: string | null;
  actividades: ActividadRequestApi[];
  involucrados: InvolucradoRequestApi[];
}

/** Alias semántico: `PUT /planes/{id}` usa el mismo cuerpo que crear. */
export type ActualizarPlanRequestApi = CrearPlanRequestApi;

/**
 * Cuerpo JSON de `PUT /evidencias/{id}/revisar`. Responde `ResultadoRevisionApi`.
 */
export interface RevisarEvidenciaRequestApi {
  /** true = aprobar, false = rechazar. Obligatorio. */
  aprobada: boolean;
  /** Máx. 2000 caracteres (motivo del rechazo). */
  motivo?: string | null;
}

/**
 * Cuerpo JSON de `POST /planes/{id}/cerrar`. Responde `PlanApi`.
 */
export interface CerrarPlanRequestApi {
  /** Obligatorio, máx. 2000 caracteres. */
  motivo: string;
}

/**
 * Campos del multipart de `POST /planes/{id}/firmar` (responde `PlanApi`).
 * No es JSON: se envía como `multipart/form-data` con las partes:
 * - `archivo`: archivo (obligatorio, `@RequestPart`).
 * - `metodoFirma`: `FISICA` o `ELECTRONICA` (obligatorio).
 * - `fechaFirma`: `yyyy-MM-dd` (opcional).
 */
export interface FirmarPlanFormApi {
  archivo: File;
  metodoFirma: MetodoFirmaApi;
  fechaFirma?: string;
}

/**
 * Campos del multipart de `POST /actividades/{id}/evidencias` (responde `EvidenciaApi`).
 * No es JSON: se envía como `multipart/form-data` con las partes:
 * - `archivo`: archivo (obligatorio, `@RequestPart`).
 * - `observacion`: texto (opcional).
 */
export interface SubirEvidenciaFormApi {
  archivo: File;
  observacion?: string;
}
