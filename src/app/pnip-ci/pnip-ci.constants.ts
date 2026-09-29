/**
 * Constantes de ruteo del modulo PNIP-CI que necesita conocer la aplicacion
 * principal.
 *
 * Viven en un archivo aparte (y no en `pnip-ci.routes.ts`) para que
 * `app.routes.ts` y `AppComponent` puedan importarlas sin arrastrar las rutas
 * del modulo al bundle inicial: estas se cargan de forma diferida.
 *
 * @author EEASA
 */

/** Segmento base bajo el que cuelgan todas las rutas del modulo. */
export const PNIP_CI_RUTA_BASE = 'pnip';

/**
 * Indica si una URL pertenece al modulo PNIP-CI.
 *
 * `AppComponent` redirige cualquier URL que no este en `RUTAS_PERMITIDAS`;
 * esta funcion le permite dejar pasar las del modulo, cuyo control de acceso
 * lo hace `rolGuard`.
 *
 * @param url URL sin query string, con `/` inicial (p. ej. `/pnip/rrhh`).
 * @returns `true` si la URL es `/pnip` o cuelga de `/pnip/`.
 * @author EEASA
 */
export function esRutaPnipCi(url: string): boolean {
    const prefijo = '/' + PNIP_CI_RUTA_BASE;

    return url === prefijo || url.startsWith(prefijo + '/');
}
