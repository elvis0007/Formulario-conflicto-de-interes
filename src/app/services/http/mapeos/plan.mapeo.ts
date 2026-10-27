import {
  Actividad,
  ActividadSugerida,
  Archivo,
  Evidencia,
  PlanAccion,
  PlanDeResponsable
} from '../../../models';
import {
  ActividadApi,
  ActividadBandejaApi,
  ActividadSugeridaApi,
  ArchivoInfoApi,
  CrearPlanRequestApi,
  EvidenciaApi,
  InvolucradoRequestApi,
  PlanApi
} from '../../../models/api';
import { textoParentescoBandeja } from './parentesco.mapeo';

/**
 * Conversión de los planes de acción del backend (MAYÚSCULAS, ids
 * numéricos) a los modelos del front, y del modelo al cuerpo que se envía al
 * guardar un borrador. Funciones puras.
 *
 * Los estados no se traducen: el modelo usa los mismos valores que la API.
 *
 * @author Sebas Constante
 */

/**
 * Ruta (relativa a la API) del documento firmado de un plan. Para bajarlo
 * hace falta el token: se usa `obtenerDocumentoPlan`, no un enlace directo.
 *
 * @param planId Id del plan.
 * @returns `/planes/{id}/documento`.
 * @author Sebas Constante
 */
export function rutaDocumentoPlan(planId: string): string {
  return '/planes/' + planId + '/documento';
}

/**
 * Ruta (relativa a la API) del archivo de una evidencia. Se descarga con
 * `obtenerArchivoEvidencia` (necesita el token).
 *
 * @param evidenciaId Id de la evidencia.
 * @returns `/evidencias/{id}/archivo`.
 * @author Sebas Constante
 */
export function rutaArchivoEvidencia(evidenciaId: string): string {
  return '/evidencias/' + evidenciaId + '/archivo';
}

/**
 * @param id Id numérico del backend.
 * @returns El id como texto; vacío si es `null`.
 */
function texto(id: number | null | undefined): string {
  return id === null || id === undefined ? '' : String(id);
}

/**
 * @param info Metadatos del archivo.
 * @returns `pdf`, `png` o `jpg` según el tipo MIME (o la extensión si no lo
 * trae); `pdf` si no se puede saber.
 */
function tipoDeArchivo(info: ArchivoInfoApi | null): Archivo['tipo'] {
  const mime = (info?.TIPO_MIME ?? '').toLowerCase();
  const extension = (info?.NOMBRE ?? '').toLowerCase().split('.').pop() ?? '';

  if (mime === 'image/png' || (mime === '' && extension === 'png')) {
    return 'png';
  }
  if (mime === 'image/jpeg' || (mime === '' && (extension === 'jpg' || extension === 'jpeg'))) {
    return 'jpg';
  }

  return 'pdf';
}

/**
 * Convierte los metadatos de un archivo guardado (`ArchivoInfoDto`).
 * El backend no da una URL pública: se guarda la ruta de descarga de la API.
 *
 * @param info Metadatos (puede ser `null` si el archivo no se encontró).
 * @param url Ruta de descarga (`rutaDocumentoPlan` o `rutaArchivoEvidencia`).
 * @param fechaSubida Fecha de subida, si se conoce.
 * @returns El archivo del modelo; nombre `archivo` si no lo trae.
 * @author Sebas Constante
 */
export function mapearArchivo(
  info: ArchivoInfoApi | null,
  url: string,
  fechaSubida?: string | null
): Archivo {
  return {
    nombre: info?.NOMBRE ?? 'archivo',
    url,
    tipo: tipoDeArchivo(info),
    ...(fechaSubida ? { fechaSubida } : {})
  };
}

/**
 * Convierte una evidencia (`EvidenciaDto`). `SUBIDO_POR`, `OBSERVACION` y
 * `ACTIVIDAD_ID` no tienen lugar en el modelo.
 *
 * @param api Evidencia del backend.
 * @returns La evidencia del modelo (`PENDIENTE` si no trae estado).
 * @author Sebas Constante
 */
export function mapearEvidencia(api: EvidenciaApi): Evidencia {
  const id = texto(api.CODIGO);

  return {
    id,
    archivo: mapearArchivo(api.ARCHIVO, rutaArchivoEvidencia(id), api.FECHA_SUBIDA),
    fechaSubida: api.FECHA_SUBIDA ?? '',
    estado: api.ESTADO_REVISION ?? 'PENDIENTE',
    ...(api.MOTIVO_RECHAZO ? { motivoRechazo: api.MOTIVO_RECHAZO } : {}),
    ...(api.REVISADO_POR ? { revisadoPor: api.REVISADO_POR } : {}),
    ...(api.FECHA_REVISION ? { fechaRevision: api.FECHA_REVISION } : {})
  };
}

/**
 * Convierte una actividad (`ActividadDto`). El backend manda las
 * evidencias de la más antigua a la más reciente: la última es la vigente
 * (`evidencia`) y las demás van a `evidenciasAnteriores` (en
 * `GET /conflictos/expedientes` solo llega la última).
 *
 * `ORDEN`, `FECHA_ASIGNACION`, `FECHA_EJECUCION` y `VENCIDA` no se guardan:
 * el orden es el del arreglo y «vencida» se calcula en el front.
 *
 * @param api Actividad del backend.
 * @returns La actividad del modelo.
 * @author Sebas Constante
 */
export function mapearActividad(api: ActividadApi): Actividad {
  const evidencias = (api.EVIDENCIAS ?? []).map(mapearEvidencia);
  const vigente = evidencias.length > 0 ? evidencias[evidencias.length - 1] : undefined;
  const anteriores = evidencias.slice(0, -1);

  return {
    id: texto(api.CODIGO),
    descripcion: api.DESCRIPCION ?? '',
    responsableId: api.RESPONSABLE ?? '',
    responsableNombre: api.NOMBRE_RESPONSABLE ?? '',
    plazoMeses: api.PLAZO_MESES ?? 0,
    plazoDias: api.PLAZO_DIAS ?? 0,
    estado: api.ESTADO ?? 'PENDIENTE',
    ...(api.FECHA_LIMITE ? { fechaLimite: api.FECHA_LIMITE } : {}),
    ...(vigente ? { evidencia: vigente } : {}),
    ...(anteriores.length > 0 ? { evidenciasAnteriores: anteriores } : {})
  };
}

/**
 * Convierte un plan (`PlanDto`).
 *
 * - `nombre` es el `OBJETIVO` del backend (no hay otro título).
 * - `fechaInicio` es la fecha de asignación de las actividades: el backend
 *   cuenta el plazo desde el día en que se registró la firma, no desde
 *   `FECHA_FIRMA` (que puede ser anterior). Si no la trae, `FECHA_FIRMA`.
 * - Sin dato en el backend: `fechaCreacion` y `creadoPor`. Sin lugar en el
 *   modelo: `METODO_FIRMA`, `FECHA_REUNION`, `INVOLUCRADOS` y
 *   `TODAS_ACEPTADAS`.
 *
 * @param api Plan del backend.
 * @returns El plan del modelo.
 * @author Sebas Constante
 */
export function mapearPlan(api: PlanApi): PlanAccion {
  const id = texto(api.CODIGO);
  const actividades = api.ACTIVIDADES ?? [];
  const fechaInicio = actividades.find((a) => a.FECHA_ASIGNACION)?.FECHA_ASIGNACION ?? api.FECHA_FIRMA;

  return {
    id,
    numero: api.NUMERO ?? 0,
    nombre: api.OBJETIVO ?? '',
    conflictoId: texto(api.CONFLICTO_ID),
    estado: api.ESTADO_PLAN ?? 'BORRADOR',
    ...(fechaInicio ? { fechaInicio } : {}),
    ...(api.FECHA_CIERRE ? { fechaCierre: api.FECHA_CIERRE } : {}),
    ...(api.TIPO_CIERRE ? { tipoCierre: api.TIPO_CIERRE } : {}),
    ...(api.MOTIVO_CIERRE ? { motivoCierre: api.MOTIVO_CIERRE } : {}),
    ...(api.DOCUMENTO_FIRMADO
      ? { documentoFirmado: mapearArchivo(api.DOCUMENTO_FIRMADO, rutaDocumentoPlan(id), api.FECHA_FIRMA) }
      : {}),
    actividades: actividades.map(mapearActividad)
  };
}

/**
 * Agrupa la bandeja del responsable (`GET /actividades/mias`) por plan,
 * para formar la vista `PlanDeResponsable` (solo sus actividades).
 *
 * La bandeja no trae el responsable de cada fila (es quien pidió) ni su
 * nombre: `responsableId` es `empleadoId` y `responsableNombre` queda vacío.
 * Tampoco trae la fecha, el tipo ni el motivo de cierre de un plan
 * `CERRADO`, ni el documento firmado. Del caso trae `NOMBRE_A`, `NOMBRE_B`,
 * `PARENTESCO` y `RIESGO` (el rol P no puede pedir `/conflictos`); no trae
 * cargos, departamentos ni el estado de seguimiento.
 *
 * @param filas Actividades de la bandeja.
 * @param empleadoId Id del empleado que pidió la bandeja.
 * @returns Un elemento por plan, ordenados por conflicto y número.
 * @author Sebas Constante
 */
export function mapearPlanesDeResponsable(
  filas: readonly ActividadBandejaApi[],
  empleadoId: string
): PlanDeResponsable[] {
  const porPlan = new Map<string, PlanDeResponsable>();

  for (const fila of filas) {
    const planId = texto(fila.PLAN_ID);
    let vista = porPlan.get(planId);

    if (planId === '') {
      continue;
    }
    if (vista === undefined) {
      vista = {
        plan: {
          id: planId,
          numero: fila.PLAN_NUMERO ?? 0,
          nombre: fila.PLAN_OBJETIVO ?? '',
          conflictoId: texto(fila.CONFLICTO_ID),
          estado: fila.PLAN_ESTADO ?? 'FIRMADO',
          ...(fila.FECHA_ASIGNACION ? { fechaInicio: fila.FECHA_ASIGNACION } : {}),
          actividades: []
        },
        totalActividades: fila.PLAN_TOTAL_ACTIVIDADES,
        nombreA: fila.NOMBRE_A ?? '',
        nombreB: fila.NOMBRE_B ?? '',
        parentesco: textoParentescoBandeja(fila.PARENTESCO, fila.NOMBRE_A ?? ''),
        riesgo: fila.RIESGO ?? null
      };
      porPlan.set(planId, vista);
    }
    vista.plan.actividades.push({
      id: texto(fila.CODIGO),
      descripcion: fila.DESCRIPCION ?? '',
      responsableId: empleadoId,
      responsableNombre: '',
      plazoMeses: fila.PLAZO_MESES ?? 0,
      plazoDias: fila.PLAZO_DIAS ?? 0,
      estado: fila.ESTADO ?? 'PENDIENTE',
      ...(fila.FECHA_LIMITE ? { fechaLimite: fila.FECHA_LIMITE } : {}),
      ...(fila.ULTIMA_EVIDENCIA ? { evidencia: mapearEvidencia(fila.ULTIMA_EVIDENCIA) } : {})
    });
  }

  return [...porPlan.values()].sort((a, b) =>
    a.plan.conflictoId.localeCompare(b.plan.conflictoId, undefined, { numeric: true })
    || a.plan.numero - b.plan.numero);
}

/**
 * Cuerpo de `POST /conflictos/{id}/plan` y `PUT /planes/{id}` a partir del
 * plan del formulario. `PUT` reemplaza actividades e involucrados, así que
 * los involucrados y la fecha de reunión (que el modelo no tiene) se toman
 * del plan tal como llegó del backend, para no borrarlos.
 *
 * @param plan Plan a guardar.
 * @param anterior El mismo plan como llegó del backend; `undefined` si es
 * nuevo.
 * @returns Cuerpo JSON (camelCase).
 * @author Sebas Constante
 */
export function crearPedidoPlan(plan: PlanAccion, anterior?: PlanApi): CrearPlanRequestApi {
  const involucrados: InvolucradoRequestApi[] = (anterior?.INVOLUCRADOS ?? [])
    .flatMap((i) => i.DMPER_CODIGO && i.TIPO ? [{ dmper: i.DMPER_CODIGO, tipo: i.TIPO }] : []);
  const objetivo = plan.nombre.trim();

  return {
    objetivo: objetivo === '' ? null : objetivo,
    fechaReunion: anterior?.FECHA_REUNION ?? null,
    actividades: plan.actividades.map((a, indice) => ({
      descripcion: a.descripcion.trim(),
      responsable: a.responsableId.trim(),
      plazoMeses: a.plazoMeses,
      plazoDias: a.plazoDias,
      orden: indice + 1
    })),
    involucrados
  };
}

/**
 * Convierte una actividad sugerida (`GET /conflictos/{id}/plan/sugerencia`).
 *
 * @param api Sugerencia del backend.
 * @returns La actividad sugerida del modelo; `RESPONSABLE` es un código de
 * nómina (sin nombre), o `null` si RRHH debe elegirlo.
 * @author Elvis Flores
 */
export function mapearActividadSugerida(api: ActividadSugeridaApi): ActividadSugerida {
  return {
    descripcion: api.DESCRIPCION ?? '',
    responsableSugeridoId: api.RESPONSABLE,
    plazoMeses: api.PLAZO_MESES,
    plazoDias: api.PLAZO_DIAS
  };
}
