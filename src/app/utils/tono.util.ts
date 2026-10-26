import {
  Clasificacion,
  EstadoAnalisis,
  EstadoPlan,
  EstadoSeguimiento,
  Notificacion,
  Riesgo,
  TipoCierre
} from '../models';
import { EstadoActividadVista } from './planes.util';

/**
 * Tonos visuales del sistema de diseno. Cada uno tiene tres variables CSS
 * en `styles/_tokens.scss`: `--{tono}` (solido), `--{tono}-fill` (fondo
 * suave) y `--{tono}-text` (texto sobre el fondo suave).
 *
 * | Tono      | Significado                                  |
 * |-----------|----------------------------------------------|
 * | `rojo`    | Riesgo alto o critico, vencido, «con vencidas» |
 * | `ambar`   | Riesgo moderado, pendiente, borrador         |
 * | `verde`   | Riesgo bajo, aprobado, cumplido, cerrado     |
 * | `azul`    | Activo, en ejecucion, informacion            |
 * | `naranja` | Rechazado                                    |
 * | `gris`    | En revision, homonimo, no cumplida           |
 *
 * La tabla es fija del sistema de diseno, por eso vive en codigo.
 *
 * @author Elvis Flores
 */
export type Tono = 'rojo' | 'ambar' | 'verde' | 'azul' | 'naranja' | 'gris';

/** Tono de cada nivel de riesgo. */
const TONO_RIESGO: Readonly<Record<Riesgo, Tono>> = {
  CRITICO: 'rojo',
  ALTO: 'rojo',
  MEDIO: 'ambar',
  BAJO: 'verde'
};

/** Tono de cada estado de plan. */
const TONO_ESTADO_PLAN: Readonly<Record<EstadoPlan, Tono>> = {
  BORRADOR: 'ambar',
  FIRMADO: 'azul',
  CERRADO: 'verde'
};

/** Tono de cada estado de actividad (igual en ambas vistas, salvo `VENCIDA`). */
const TONO_ESTADO_ACTIVIDAD: Readonly<Record<EstadoActividadVista, Tono>> = {
  PENDIENTE: 'ambar',
  EN_REVISION: 'gris',
  ACEPTADA: 'verde',
  RECHAZADA: 'naranja',
  NO_CUMPLIDA: 'gris',
  VENCIDA: 'rojo'
};

/** Tono del punto de color de cada tipo de notificacion. */
const TONO_NOTIFICACION: Readonly<Record<Notificacion['tipo'], Tono>> = {
  ok: 'verde',
  rechazo: 'naranja',
  vencido: 'rojo',
  alerta: 'rojo',
  info: 'azul'
};

/**
 * @param riesgo Nivel de riesgo de un conflicto.
 * @returns `CRITICO` y `ALTO` → rojo, `MEDIO` → ambar, `BAJO` → verde.
 */
export function mapearRiesgoATono(riesgo: Riesgo): Tono {
  return TONO_RIESGO[riesgo];
}

/**
 * @param estado Estado de un plan de accion.
 * @param conVencidas `true` si el plan tiene actividades vencidas (ver
 * `tieneActividadesVencidas`); solo afecta a `FIRMADO`.
 * @param tipoCierre Como se cerro (`PlanAccion.tipoCierre`); solo afecta a
 * `CERRADO`.
 * @returns `BORRADOR` → ambar, `FIRMADO` → azul (rojo con vencidas),
 * `CERRADO` → verde (gris si fue un cierre `ANTICIPADO`: no se cumplio).
 */
export function mapearEstadoPlanATono(
  estado: EstadoPlan,
  conVencidas = false,
  tipoCierre?: TipoCierre
): Tono {
  if (estado === 'CERRADO' && tipoCierre === 'ANTICIPADO') {
    return 'gris';
  }

  return estado === 'FIRMADO' && conVencidas ? 'rojo' : TONO_ESTADO_PLAN[estado];
}

/** Texto de cada estado de seguimiento de un conflicto. */
const TEXTO_ESTADO_SEGUIMIENTO: Readonly<Record<EstadoSeguimiento, string>> = {
  DETECTADO: 'Detectado',
  EN_ANALISIS: 'En análisis',
  EN_PLANIFICACION: 'En planificación',
  EN_EJECUCION: 'En ejecución',
  FINALIZADO: 'Finalizado',
  DESCARTADO: 'Descartado'
};

/** Tono de cada estado de seguimiento de un conflicto. */
const TONO_ESTADO_SEGUIMIENTO: Readonly<Record<EstadoSeguimiento, Tono>> = {
  DETECTADO: 'ambar',
  EN_ANALISIS: 'ambar',
  EN_PLANIFICACION: 'ambar',
  EN_EJECUCION: 'azul',
  FINALIZADO: 'verde',
  DESCARTADO: 'gris'
};

/**
 * @param estado Estado de seguimiento de un conflicto (`Conflicto.estado`).
 * @returns Texto de la insignia («En ejecución», «Finalizado»...).
 * @author Integración backend
 */
export function textoEstadoSeguimiento(estado: EstadoSeguimiento): string {
  return TEXTO_ESTADO_SEGUIMIENTO[estado] ?? estado;
}

/**
 * @param estado Estado de seguimiento de un conflicto.
 * @returns `DETECTADO`, `EN_ANALISIS` y `EN_PLANIFICACION` → ambar (falta
 * algo de RRHH), `EN_EJECUCION` → azul, `FINALIZADO` → verde,
 * `DESCARTADO` → gris.
 * @author Integración backend
 */
export function mapearEstadoSeguimientoATono(estado: EstadoSeguimiento): Tono {
  return TONO_ESTADO_SEGUIMIENTO[estado] ?? 'gris';
}

/**
 * Tono de un estado de actividad. Solo decide el color; el texto de cada
 * vista lo resuelven las pantallas.
 *
 * | Estado        | Vista RRHH (texto)       | Vista Responsable (texto) | Tono |
 * |---------------|--------------------------|---------------------------|------|
 * | `PENDIENTE`   | Pendiente de evidencia   | Pendiente                 | ambar |
 * | `EN_REVISION` | En revision              | En revision de RRHH       | gris |
 * | `ACEPTADA`    | Aprobada · Cumplida      | Aprobada                  | verde |
 * | `RECHAZADA`   | Rechazada                | Rechazada                 | naranja |
 * | `NO_CUMPLIDA` | No cumplida              | No cumplida               | gris |
 * | `VENCIDA`     | Vencida                  | (Pendiente)               | rojo / ambar |
 *
 * `VENCIDA` no es un estado del backend: es el estado de presentacion que
 * da `estadoVistaActividad`.
 *
 * DECISION: la vista del Responsable no tiene el estado «Vencida»; una
 * actividad vencida se le muestra como «Pendiente» (sigue teniendo que
 * subir evidencia), asi que su insignia usa el tono de pendiente (ambar).
 * El vencimiento se le comunica con el texto de plazo en rojo
 * (`calcularDiasRestantes`), no con la insignia de estado. PENDIENTE de
 * confirmar con la especificacion.
 *
 * @param estado Estado de la actividad (o `VENCIDA`, calculado).
 * @param vistaResponsable `true` en las pantallas del Responsable.
 * @returns Tono de la insignia de estado.
 */
export function mapearEstadoActividadATono(
  estado: EstadoActividadVista,
  vistaResponsable: boolean
): Tono {
  if (vistaResponsable && estado === 'VENCIDA') {
    return TONO_ESTADO_ACTIVIDAD.PENDIENTE;
  }

  return TONO_ESTADO_ACTIVIDAD[estado];
}

/**
 * @param tipo Tipo de notificacion.
 * @returns `ok` → verde, `rechazo` → naranja, `vencido`/`alerta` → rojo,
 * `info` → azul.
 */
export function mapearTipoNotificacionATono(tipo: Notificacion['tipo']): Tono {
  return TONO_NOTIFICACION[tipo];
}

/** Tono de cada clasificacion de un caso del analisis. */
const TONO_CLASIFICACION: Readonly<Record<Clasificacion, Tono>> = {
  D: 'azul',
  N: 'azul',
  H: 'gris'
};

/** Tono de un caso sin clasificar. */
const TONO_SIN_CLASIFICAR: Tono = 'ambar';

/** Tono de cada estado del analisis. */
const TONO_ESTADO_ANALISIS: Readonly<Record<EstadoAnalisis, Tono>> = {
  BORRADOR: 'ambar',
  VALIDADO: 'verde'
};

/**
 * @param clasificacion Clasificacion de un caso, o `null` si esta sin
 * clasificar.
 * @returns `null` → ambar, `D` y `N` → azul, `H` → gris.
 * @author Elvis Flores
 */
export function mapearClasificacionATono(clasificacion: Clasificacion | null): Tono {
  return clasificacion === null ? TONO_SIN_CLASIFICAR : TONO_CLASIFICACION[clasificacion];
}

/**
 * @param estado Estado del analisis de conflictos.
 * @returns `BORRADOR` → ambar, `VALIDADO` → verde.
 * @author Elvis Flores
 */
export function mapearEstadoAnalisisATono(estado: EstadoAnalisis): Tono {
  return TONO_ESTADO_ANALISIS[estado];
}
