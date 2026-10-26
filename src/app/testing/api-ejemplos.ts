import { ActividadApi, ConflictoApi, EvidenciaApi, PlanApi } from '../models/api';

/**
 * Respuestas de ejemplo del backend (forma de `models/api`) para las
 * pruebas de los mapeos y de los servicios HTTP. Cada función acepta los
 * campos a cambiar.
 *
 * @author Integración backend
 */

/**
 * @param cambios Campos a cambiar.
 * @returns Evidencia pendiente de ejemplo (id 7, actividad 3).
 * @author Integración backend
 */
export function evidenciaApi(cambios: Partial<EvidenciaApi> = {}): EvidenciaApi {
  return {
    CODIGO: 7,
    ACTIVIDAD_ID: 3,
    ARCHIVO: { CODIGO: 70, NOMBRE: 'acta.pdf', TIPO_MIME: 'application/pdf', TAMANIO: 1000 },
    OBSERVACION: null,
    ESTADO_REVISION: 'PENDIENTE',
    MOTIVO_RECHAZO: null,
    SUBIDO_POR: 'jperez',
    FECHA_SUBIDA: '2026-10-10T09:30:00.123456',
    REVISADO_POR: null,
    FECHA_REVISION: null,
    ...cambios
  };
}

/**
 * @param cambios Campos a cambiar.
 * @returns Actividad en revisión de ejemplo (id 3) con la evidencia 7.
 * @author Integración backend
 */
export function actividadApi(cambios: Partial<ActividadApi> = {}): ActividadApi {
  return {
    CODIGO: 3,
    ORDEN: 1,
    DESCRIPCION: 'Separar funciones',
    RESPONSABLE: 'DMPER10',
    NOMBRE_RESPONSABLE: 'Ana Pérez',
    FECHA_ASIGNACION: '2026-10-01',
    PLAZO_MESES: 1,
    PLAZO_DIAS: 5,
    FECHA_LIMITE: '2026-11-06',
    FECHA_EJECUCION: null,
    ESTADO: 'EN_REVISION',
    VENCIDA: false,
    EVIDENCIAS: [evidenciaApi()],
    ...cambios
  };
}

/**
 * @param cambios Campos a cambiar.
 * @returns Plan firmado de ejemplo (id 41, conflicto 1420).
 * @author Integración backend
 */
export function planApi(cambios: Partial<PlanApi> = {}): PlanApi {
  return {
    CODIGO: 41,
    CONFLICTO_ID: 1420,
    NUMERO: 1,
    ESTADO_PLAN: 'FIRMADO',
    OBJETIVO: 'Mitigar el conflicto',
    FECHA_REUNION: '2026-09-28',
    METODO_FIRMA: 'FISICA',
    FECHA_FIRMA: '2026-09-29',
    DOCUMENTO_FIRMADO: { CODIGO: 90, NOMBRE: 'FR02.pdf', TIPO_MIME: 'application/pdf', TAMANIO: 2000 },
    FECHA_CIERRE: null,
    TIPO_CIERRE: null,
    MOTIVO_CIERRE: null,
    TODAS_ACEPTADAS: false,
    ACTIVIDADES: [actividadApi()],
    INVOLUCRADOS: [{ DMPER_CODIGO: 'DMPER20', NOMBRE: 'Luis', TIPO: 'F' }],
    ...cambios
  };
}

/**
 * @param cambios Campos a cambiar.
 * @returns Conflicto de ejemplo (id 1420; B es el padre de A).
 * @author Integración backend
 */
export function conflictoApi(cambios: Partial<ConflictoApi> = {}): ConflictoApi {
  return {
    CODIGO: 1420,
    ANALISIS_ID: 3,
    CEDULA_A: '1800000001',
    NOMBRE_A: 'Ana Pérez',
    DEPARTAMENTO_A: 'Compras',
    CEDULA_B: '1800000002',
    NOMBRE_B: 'Juan Pérez',
    DEPARTAMENTO_B: 'Finanzas',
    TIPO_RELACION: 'F',
    PARENTESCO: 'PADRE',
    PARENTESCO_INVERSO: 'HIJO',
    TIPO_GRADO: 'C',
    GRADO: 1,
    RIESGO: 'ALTO',
    ORIGEN: 'DETECTADO_AUTO',
    CLASIFICACION: 'N',
    CONFIANZA: 0.95,
    DETALLE: 'Mismo nombre de padre en la ficha.',
    OBSERVACION: 'Confirmado por RRHH',
    ESTADO_SEGUIMIENTO: 'EN_EJECUCION',
    VENCIDO: false,
    FECHA_DETECCION: '2026-10-01T08:00:00',
    ...cambios
  };
}
