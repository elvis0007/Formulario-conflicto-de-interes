import { Actividad, Conflicto, PlanAccion, Riesgo } from '../models';
import { RIESGOS, contarPendientes, textoRiesgo } from './analisis.util';
import { DiasRestantes, calcularDiasRestantes } from './fechas.util';
import { instanteDe } from './historial.util';
import { EstadoActividadVista, estaVencida, estadoVistaActividad, textoEstadoPlan, tieneActividadesVencidas } from './planes.util';
import { esPlanActivo, textoEstadoActividad } from './revision.util';
import { Tono, mapearEstadoActividadATono } from './tono.util';

/**
 * Utilidades puras del Dashboard de RRHH (especificacion §6.2). Todo se
 * calcula con el analisis vigente y los planes de `PlanesMockService`.
 *
 * @author Elvis Flores
 */

/** Indicadores del dashboard. */
export interface IndicadoresRrhh {
  /** Casos del analisis vigente. */
  detectados: number;
  /** Casos pendientes de clasificar. */
  pendientes: number;
  /** Conflictos declarados o no declarados (D/N) que aun no tienen ningun plan. */
  confirmadosSinPlan: number;
  /** Planes firmados, en ejecucion (con o sin vencidas). */
  planesActivos: number;
  /** Actividades vencidas (calculadas por fecha) de planes enviados. */
  actividadesVencidas: number;
  /** Evidencias en revision de planes activos. */
  evidenciasPorRevisar: number;
  /** Planes cerrados. */
  planesCerrados: number;
}

/** Una barra de una distribucion. */
export interface BarraDistribucion {
  clave: string;
  etiqueta: string;
  valor: number;
  /** Ancho relativo al mayor (0–100). */
  porcentaje: number;
}

/** Un segmento de la barra apilada de estados de actividades. */
export interface SegmentoEstado {
  estado: EstadoActividadVista;
  etiqueta: string;
  valor: number;
  tono: Tono;
  /** Ancho relativo al total (0–100). */
  porcentaje: number;
}

/** Una actividad que requiere atencion. */
export interface ItemAtencion {
  actividad: Actividad;
  plan: PlanAccion;
  /** Fecha limite (vencidas) o de subida (evidencias). */
  fecha: string;
  /** Dias desde el vencimiento; solo en las vencidas. */
  dias: DiasRestantes | null;
}

/**
 * Orden de los segmentos de la barra apilada. No se ponen juntos el ambar
 * (pendiente) y el naranja (rechazada), que se confunden: validado con el
 * script de la guia de visualizacion (CVD ΔE 8,6). Cada segmento lleva
 * leyenda con texto y conteo, asi el color nunca va solo.
 */
export const ORDEN_ESTADOS_ACTIVIDAD: readonly EstadoActividadVista[] = [
  'ACEPTADA', 'EN_REVISION', 'PENDIENTE', 'VENCIDA', 'RECHAZADA', 'NO_CUMPLIDA'
];

/**
 * Barras del grafico de planes, en orden. «Activo · con vencidas» no es un
 * estado del backend: sale de `tieneActividadesVencidas`.
 */
const BARRAS_ESTADO_PLAN: readonly {
  clave: string;
  pertenece: (plan: PlanAccion, hoy: Date) => boolean;
  etiqueta: string;
}[] = [
  { clave: 'BORRADOR', etiqueta: textoEstadoPlan('BORRADOR'), pertenece: (p) => p.estado === 'BORRADOR' },
  {
    clave: 'FIRMADO',
    etiqueta: textoEstadoPlan('FIRMADO'),
    pertenece: (p, hoy) => p.estado === 'FIRMADO' && !tieneActividadesVencidas(p, hoy)
  },
  {
    clave: 'FIRMADO_VENCIDAS',
    etiqueta: textoEstadoPlan('FIRMADO', true),
    pertenece: (p, hoy) => tieneActividadesVencidas(p, hoy)
  },
  { clave: 'CERRADO', etiqueta: textoEstadoPlan('CERRADO'), pertenece: (p) => p.estado === 'CERRADO' }
];

/**
 * @param conflictos Casos del analisis vigente (con sus planes).
 * @param planes Todos los planes.
 * @param hoy Fecha de hoy (`RELOJ`), para calcular las vencidas.
 * @returns Los indicadores.
 * @author Elvis Flores
 */
export function calcularIndicadores(
  conflictos: readonly Conflicto[],
  planes: readonly PlanAccion[],
  hoy: Date = new Date()
): IndicadoresRrhh {
  const enviados = planes.filter((p) => p.estado !== 'BORRADOR');

  return {
    detectados: conflictos.length,
    pendientes: contarPendientes(conflictos),
    confirmadosSinPlan: conflictos.filter((c) => (c.clasificacion === 'D' || c.clasificacion === 'N') && c.planes.length === 0).length,
    planesActivos: planes.filter(esPlanActivo).length,
    actividadesVencidas: enviados.flatMap((p) => p.actividades).filter((a) => estaVencida(a, hoy)).length,
    evidenciasPorRevisar: planes.filter(esPlanActivo).flatMap((p) => p.actividades)
      .filter((a) => a.estado === 'EN_REVISION').length,
    planesCerrados: planes.filter((p) => p.estado === 'CERRADO').length
  };
}

/**
 * @param conflictos Casos del analisis vigente.
 * @returns Una barra por nivel de riesgo (de mayor a menor), con su conteo.
 * @author Elvis Flores
 */
export function distribucionPorRiesgo(conflictos: readonly Conflicto[]): BarraDistribucion[] {
  return escalar(RIESGOS.map((r: Riesgo) => ({
    clave: r,
    etiqueta: textoRiesgo(r),
    valor: conflictos.filter((c) => c.riesgo === r).length
  })));
}

/**
 * @param planes Todos los planes.
 * @param hoy Fecha de hoy (`RELOJ`), para separar los activos con vencidas.
 * @returns Una barra por estado de plan, con su conteo.
 * @author Elvis Flores
 */
export function distribucionEstadoPlanes(
  planes: readonly PlanAccion[],
  hoy: Date = new Date()
): BarraDistribucion[] {
  return escalar(BARRAS_ESTADO_PLAN.map((b) => ({
    clave: b.clave,
    etiqueta: b.etiqueta,
    valor: planes.filter((p) => b.pertenece(p, hoy)).length
  })));
}

/**
 * @param planes Todos los planes (los borradores no cuentan).
 * @param hoy Fecha de hoy (`RELOJ`), para calcular las vencidas.
 * @returns Segmentos de la barra apilada; los de valor 0 se omiten.
 * @author Elvis Flores
 */
export function estadoDeActividades(
  planes: readonly PlanAccion[],
  hoy: Date = new Date()
): SegmentoEstado[] {
  const actividades = planes.filter((p) => p.estado !== 'BORRADOR').flatMap((p) => p.actividades);
  const total = actividades.length;

  return ORDEN_ESTADOS_ACTIVIDAD
    .map((estado) => {
      const valor = actividades.filter((a) => estadoVistaActividad(a, hoy) === estado).length;

      return {
        estado,
        etiqueta: textoEstadoActividad(estado, false),
        valor,
        tono: mapearEstadoActividadATono(estado, false),
        porcentaje: total === 0 ? 0 : (valor / total) * 100
      };
    })
    .filter((s) => s.valor > 0);
}

/**
 * «Requiere atención»: las actividades vencidas mas antiguas (por fecha
 * limite) y las evidencias por revisar que mas esperan (por fecha de
 * subida).
 *
 * @param planes Todos los planes.
 * @param hoy Fecha de hoy (`RELOJ`).
 * @param limite Cuantas de cada una.
 * @returns Vencidas y evidencias, de la mas antigua a la mas reciente.
 * @author Elvis Flores
 */
export function requiereAtencion(
  planes: readonly PlanAccion[],
  hoy: Date,
  limite: number
): { vencidas: ItemAtencion[]; evidencias: ItemAtencion[] } {
  const enviados = planes.filter((p) => p.estado !== 'BORRADOR');
  const vencidas: ItemAtencion[] = [];
  const evidencias: ItemAtencion[] = [];

  for (const plan of enviados) {
    for (const actividad of plan.actividades) {
      if (estaVencida(actividad, hoy) && actividad.fechaLimite) {
        vencidas.push({ actividad, plan, fecha: actividad.fechaLimite, dias: diasDesde(actividad.fechaLimite, hoy) });
      }
      if (actividad.estado === 'EN_REVISION' && esPlanActivo(plan) && actividad.evidencia) {
        evidencias.push({ actividad, plan, fecha: actividad.evidencia.fechaSubida, dias: null });
      }
    }
  }

  const porFecha = (a: ItemAtencion, b: ItemAtencion): number => instanteDe(a.fecha) - instanteDe(b.fecha);

  return {
    vencidas: vencidas.sort(porFecha).slice(0, limite),
    evidencias: evidencias.sort(porFecha).slice(0, limite)
  };
}

/**
 * @param barras Barras con su valor.
 * @returns Las mismas con el ancho relativo al mayor.
 */
function escalar(barras: Omit<BarraDistribucion, 'porcentaje'>[]): BarraDistribucion[] {
  const mayor = Math.max(0, ...barras.map((b) => b.valor));

  return barras.map((b) => ({ ...b, porcentaje: mayor === 0 ? 0 : (b.valor / mayor) * 100 }));
}

/**
 * @param fecha Fecha limite.
 * @param hoy Hoy.
 * @returns Dias restantes, o `null` si la fecha no es valida.
 */
function diasDesde(fecha: string, hoy: Date): DiasRestantes | null {
  try {
    return calcularDiasRestantes(fecha, hoy);
  } catch (err) {
    console.error('[dashboard-rrhh.util.diasDesde] Fecha inválida:', fecha, err);
    return null;
  }
}
