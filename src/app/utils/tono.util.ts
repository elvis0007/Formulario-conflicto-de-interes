import {
    EstadoActividad,
    EstadoPlan,
    Notificacion,
    Riesgo
} from '../models';

/**
 * Tonos visuales del sistema de diseno. Cada uno tiene tres variables CSS
 * en `styles/_tokens.scss`: `--{tono}` (solido), `--{tono}-fill` (fondo
 * suave) y `--{tono}-text` (texto sobre el fondo suave).
 *
 * | Tono      | Significado                                  |
 * |-----------|----------------------------------------------|
 * | `rojo`    | Riesgo alto, vencido, «con vencidas»         |
 * | `ambar`   | Riesgo moderado, pendiente, borrador         |
 * | `verde`   | Riesgo bajo, aprobado, cumplido, cerrado     |
 * | `azul`    | Activo, en ejecucion, informacion            |
 * | `naranja` | Rechazado                                    |
 * | `gris`    | En revision, homonimo, ninguno               |
 *
 * La tabla es fija del sistema de diseno, por eso vive en codigo.
 *
 * @author Elvis Flores
 */
export type Tono = 'rojo' | 'ambar' | 'verde' | 'azul' | 'naranja' | 'gris';

/** Tono de cada nivel de riesgo. */
const TONO_RIESGO: Readonly<Record<Riesgo, Tono>> = {
    alto: 'rojo',
    medio: 'ambar',
    bajo: 'verde',
    ninguno: 'gris'
};

/** Tono de cada estado de plan. */
const TONO_ESTADO_PLAN: Readonly<Record<EstadoPlan, Tono>> = {
    borrador: 'ambar',
    activo: 'azul',
    activo_vencidas: 'rojo',
    cerrado: 'verde'
};

/** Tono de cada estado de actividad (igual en ambas vistas, salvo `vencida`). */
const TONO_ESTADO_ACTIVIDAD: Readonly<Record<EstadoActividad, Tono>> = {
    pendiente: 'ambar',
    en_revision: 'gris',
    aprobada: 'verde',
    rechazada: 'naranja',
    vencida: 'rojo'
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
 * @returns `alto` → rojo, `medio` → ambar, `bajo` → verde,
 * `ninguno` → gris.
 */
export function mapearRiesgoATono(riesgo: Riesgo): Tono {
    return TONO_RIESGO[riesgo];
}

/**
 * @param estado Estado de un plan de accion.
 * @returns `borrador` → ambar, `activo` → azul, `activo_vencidas` → rojo,
 * `cerrado` → verde.
 */
export function mapearEstadoPlanATono(estado: EstadoPlan): Tono {
    return TONO_ESTADO_PLAN[estado];
}

/**
 * Tono de un estado de actividad. Solo decide el color; el texto de cada
 * vista lo resuelven las pantallas.
 *
 * | Estado        | Vista RRHH (texto)       | Vista Responsable (texto) | Tono |
 * |---------------|--------------------------|---------------------------|------|
 * | `pendiente`   | Pendiente de evidencia   | Pendiente                 | ambar |
 * | `en_revision` | En revision              | En revision de RRHH       | gris |
 * | `aprobada`    | Aprobada · Cumplida      | Aprobada                  | verde |
 * | `rechazada`   | Rechazada                | Rechazada                 | naranja |
 * | `vencida`     | Vencida                  | (Pendiente)               | rojo / ambar |
 *
 * DECISION: la vista del Responsable no tiene el estado «Vencida»; una
 * actividad vencida se le muestra como «Pendiente» (sigue teniendo que
 * subir evidencia), asi que su insignia usa el tono de pendiente (ambar).
 * El vencimiento se le comunica con el texto de plazo en rojo
 * (`calcularDiasRestantes`), no con la insignia de estado. PENDIENTE de
 * confirmar con la especificacion.
 *
 * @param estado Estado interno de la actividad.
 * @param vistaResponsable `true` en las pantallas del Responsable.
 * @returns Tono de la insignia de estado.
 */
export function mapearEstadoActividadATono(
    estado: EstadoActividad,
    vistaResponsable: boolean
): Tono {
    if (vistaResponsable && estado === 'vencida') {
        return TONO_ESTADO_ACTIVIDAD.pendiente;
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
