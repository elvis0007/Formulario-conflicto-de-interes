import { Conflicto, GradoParentesco, Persona } from '../../../models';
import {
  ConflictoApi,
  ConflictoDetalleApi,
  DirectorApi,
  FichaPersonaApi,
  ParentescoApi,
  PlanApi
} from '../../../models/api';
import { etiquetaSimetrica, textoDeParentesco } from './parentesco.mapeo';
import { mapearPlan } from './plan.mapeo';

/**
 * Conversión de los conflictos del backend (MAYÚSCULAS, ids numéricos) al
 * modelo `Conflicto`. Funciones puras.
 *
 * Sentido del parentesco (plan maestro §4): `PARENTESCO` es qué es B para A
 * (`PADRE` = B es el padre de A) y `PARENTESCO_INVERSO` qué es A para B.
 * Por eso `rolB` sale de `PARENTESCO` y `rolA` de `PARENTESCO_INVERSO`.
 *
 * @author Integración backend
 */

/**
 * @param parentesco Parentesco del backend.
 * @returns Su texto (`rolA`, `rolB`); vacío si no viene. Los textos están
 * en `parentesco.mapeo.ts` porque también los usa la bandeja.
 */
function textoParentesco(parentesco: ParentescoApi | null): string {
  return textoDeParentesco(parentesco);
}

/**
 * @param api Conflicto del backend.
 * @returns Grado 1 a 4; `null` entre cónyuges (el backend manda 1, pero el
 * modelo dice «No aplica»), con `OTRO` o si no viene.
 */
function gradoDe(api: ConflictoApi): GradoParentesco | null {
  const grado = api.GRADO;

  if (api.PARENTESCO === 'CONYUGE' || grado === null) {
    return null;
  }

  return grado >= 1 && grado <= 4 ? grado as GradoParentesco : null;
}

/**
 * Persona de una fila de listado. El backend no da su código de nómina:
 * el `id` es la cédula. El cargo solo llega en el detalle (`FICHA_x`).
 *
 * @param cedula Cédula.
 * @param nombres Nombre completo.
 * @param departamento Departamento.
 * @returns La persona del modelo.
 */
function persona(cedula: string | null, nombres: string | null, departamento: string | null): Persona {
  return {
    id: cedula ?? '',
    nombres: nombres ?? '',
    cedula: cedula ?? '',
    cargo: '',
    departamento: departamento ?? ''
  };
}

/**
 * Completa una persona con su ficha laboral y su jefe inmediato (detalle).
 * El director no tiene lugar en `Persona`.
 *
 * @param base Persona de la fila.
 * @param ficha Ficha (null si ya no está activa o no está en nómina).
 * @param jefe Jefe inmediato (null si no se encontró).
 * @returns La persona completa.
 */
function conFicha(base: Persona, ficha: FichaPersonaApi | null, jefe: DirectorApi | null): Persona {
  return {
    ...base,
    cargo: ficha?.CARGO ?? base.cargo,
    ...(jefe?.NOMBRE ? { jefeInmediato: jefe.NOMBRE } : {}),
    ...(ficha?.FECHA_INGRESO ? { fechaIngreso: ficha.FECHA_INGRESO } : {}),
    ...(ficha?.NOMBRE_PADRE ? { padre: ficha.NOMBRE_PADRE } : {}),
    ...(ficha?.NOMBRE_MADRE ? { madre: ficha.NOMBRE_MADRE } : {}),
    ...(ficha?.NOMBRE_CONYUGE ? { conyuge: ficha.NOMBRE_CONYUGE } : {})
  };
}

/**
 * Convierte una fila de conflicto (`ConflictoDto`: `GET /conflictos`,
 * `CONFLICTO` de un expediente o del detalle).
 *
 * - `relacion`: `TIPO_GRADO` C es consanguinidad; A y O (otro) quedan como
 *   afinidad, porque el modelo no tiene un tercer valor.
 * - `evidenciasDeteccion` lleva el `DETALLE` del cruce; `motivoRiesgo` no
 *   tiene dato en el backend (queda vacío).
 * - Sin lugar en el modelo: `ANALISIS_ID`, `ORIGEN`, `CONFIANZA`, `VENCIDO`.
 *
 * @param api Conflicto del backend.
 * @param planes Planes del conflicto (los del expediente o del detalle).
 * @returns El conflicto del modelo.
 * @author Integración backend
 */
export function mapearConflicto(api: ConflictoApi, planes: readonly PlanApi[] | null = []): Conflicto {
  const parentesco = api.PARENTESCO;
  const inverso = api.PARENTESCO_INVERSO ?? parentesco;
  const simetrica = parentesco !== null && parentesco === inverso ? etiquetaSimetrica(parentesco) : undefined;

  return {
    id: api.CODIGO === null ? '' : String(api.CODIGO),
    personaA: persona(api.CEDULA_A, api.NOMBRE_A, api.DEPARTAMENTO_A),
    rolA: textoParentesco(inverso),
    personaB: persona(api.CEDULA_B, api.NOMBRE_B, api.DEPARTAMENTO_B),
    rolB: textoParentesco(parentesco),
    ...(simetrica ? { etiquetaSimetrica: simetrica } : {}),
    relacion: api.TIPO_GRADO === 'C' ? 'Consanguinidad' : 'Afinidad',
    grado: gradoDe(api),
    riesgo: api.RIESGO ?? 'BAJO',
    clasificacion: api.CLASIFICACION,
    estado: api.ESTADO_SEGUIMIENTO ?? 'DETECTADO',
    ...(api.OBSERVACION ? { observacionClasificacion: api.OBSERVACION } : {}),
    motivoRiesgo: '',
    evidenciasDeteccion: api.DETALLE ? [api.DETALLE] : [],
    fechaDeteccion: api.FECHA_DETECCION ?? '',
    planes: [...(planes ?? [])]
      .sort((a, b) => (a.NUMERO ?? 0) - (b.NUMERO ?? 0))
      .map(mapearPlan)
  };
}

/**
 * Convierte el detalle de un conflicto (`GET /conflictos/{id}`): la fila,
 * todos sus planes (`PLANES`; si no viene, `PLAN`) con todas sus
 * evidencias, y la ficha y el jefe inmediato de A y de B.
 *
 * No se mapean aquí `LINEA_DE_TIEMPO` (la usa el historial) ni
 * `DIRECTOR_A/B` (`Persona` no tiene director).
 *
 * @param api Detalle del backend.
 * @returns El conflicto del modelo.
 * @author Integración backend
 */
export function mapearConflictoDetalle(api: ConflictoDetalleApi): Conflicto {
  const planes = api.PLANES ?? (api.PLAN ? [api.PLAN] : []);
  const conflicto = mapearConflicto(api.CONFLICTO, planes);

  return {
    ...conflicto,
    personaA: conFicha(conflicto.personaA, api.FICHA_A, api.JEFE_INMEDIATO_A),
    personaB: conFicha(conflicto.personaB, api.FICHA_B, api.JEFE_INMEDIATO_B)
  };
}
