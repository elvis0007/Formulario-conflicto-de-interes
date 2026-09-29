import { ActivatedRouteSnapshot } from '@angular/router';

/**
 * Clave de `Route.data` con las migas de pan de una pantalla, p. ej.
 * `data: { breadcrumb: ['Conflicto', 'Análisis de Conflictos'] }`.
 */
export const DATO_BREADCRUMB = 'breadcrumb';

/**
 * Obtiene las migas de pan de la ruta activa: recorre el arbol desde la raiz
 * por `firstChild` y se queda con el `breadcrumb` de la ruta mas profunda
 * que lo declare.
 *
 * @param raiz Snapshot raiz (`router.routerState.snapshot.root`).
 * @returns Textos de las migas; vacio si ninguna ruta las declara.
 * @author EEASA
 */
export function obtenerBreadcrumb(raiz: ActivatedRouteSnapshot): string[] {
    let ruta: ActivatedRouteSnapshot | null = raiz;
    let migas: string[] = [];

    while (ruta !== null) {
        const dato: unknown = ruta.data[DATO_BREADCRUMB];

        if (Array.isArray(dato)) {
            migas = dato.map((m) => String(m));
        }
        ruta = ruta.firstChild;
    }

    return migas;
}
