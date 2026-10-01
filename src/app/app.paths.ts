/**
 * Paths de las pantallas de gestion de conflictos de interes (RRHH y
 * Responsable), en un solo lugar.
 *
 * `app.routes.ts` arma sus rutas con los segmentos; el menu lateral, el
 * guard de rol, `PerfilUsuarioService` y `AppComponent` usan las URLs
 * absolutas. Nadie escribe estas URLs a mano.
 *
 * Archivo aparte de `app.routes.ts` para que el menu y los servicios puedan
 * importarlo sin importar los componentes del host que referencian las
 * rutas.
 *
 * @author Elvis Flores
 */

/** Segmento del grupo de pantallas de RRHH. */
export const SEGMENTO_RRHH = 'rrhh';

/** Segmento del grupo de pantallas del Responsable. */
export const SEGMENTO_RESPONSABLE = 'responsable';

/** Segmentos (relativos a su grupo) de cada pantalla, para `app.routes.ts`. */
export const SEGMENTOS = {
  rrhh: {
    dashboard: 'dashboard',
    analisisConflictos: 'analisis-conflictos',
    consultaPrevia: 'consulta-previa',
    planAccion: 'conflictos/:conflictoId/planes/:planId',
    informeGeneral: 'informe-general',
    revisionEvidencias: 'revision-evidencias',
    historial: 'historial'
  },
  responsable: {
    dashboard: 'dashboard',
    planes: 'planes',
    planDetalle: 'planes/:planId'
  }
} as const;

const BASE_RRHH = '/' + SEGMENTO_RRHH;
const BASE_RESPONSABLE = '/' + SEGMENTO_RESPONSABLE;

/** URLs absolutas de las pantallas. */
export const RUTAS = {
  rrhh: {
    dashboard: `${BASE_RRHH}/${SEGMENTOS.rrhh.dashboard}`,
    analisisConflictos: `${BASE_RRHH}/${SEGMENTOS.rrhh.analisisConflictos}`,
    consultaPrevia: `${BASE_RRHH}/${SEGMENTOS.rrhh.consultaPrevia}`,
    /** Prefijo comun de los planes de accion (`/rrhh/conflictos/...`). */
    conflictos: `${BASE_RRHH}/conflictos/`,
    informeGeneral: `${BASE_RRHH}/${SEGMENTOS.rrhh.informeGeneral}`,
    revisionEvidencias: `${BASE_RRHH}/${SEGMENTOS.rrhh.revisionEvidencias}`,
    historial: `${BASE_RRHH}/${SEGMENTOS.rrhh.historial}`
  },
  responsable: {
    dashboard: `${BASE_RESPONSABLE}/${SEGMENTOS.responsable.dashboard}`,
    planes: `${BASE_RESPONSABLE}/${SEGMENTOS.responsable.planes}`
  }
} as const;

/**
 * Prefijos de las rutas de gestion de conflictos. Su acceso lo controla
 * `rolGuard`, no `authGuard`.
 */
export const PREFIJOS_GESTION: readonly string[] = [BASE_RRHH, BASE_RESPONSABLE];

/**
 * Indica si una URL es de gestion de conflictos (`/rrhh/**` o
 * `/responsable/**`). Compara por segmento: `/rrhhx` no cuenta.
 *
 * @param url URL sin query string, con `/` inicial.
 * @returns `true` si la URL es uno de los prefijos o cuelga de el.
 * @author Elvis Flores
 */
export function esRutaDeGestion(url: string): boolean {
  return PREFIJOS_GESTION.some((p) => url === p || url.startsWith(p + '/'));
}
