import { ActivatedRouteSnapshot } from '@angular/router';
import { obtenerBreadcrumb } from './breadcrumb';

/**
 * Construye una cadena de snapshots (solo `data` y `firstChild`).
 *
 * @param datos `data` de cada nivel, de la raiz a la hoja.
 * @returns Snapshot raiz.
 */
function cadena(...datos: Record<string, unknown>[]): ActivatedRouteSnapshot {
    let hijo: ActivatedRouteSnapshot | null = null;

    for (const data of [...datos].reverse()) {
        hijo = { data, firstChild: hijo } as unknown as ActivatedRouteSnapshot;
    }

    return hijo as ActivatedRouteSnapshot;
}

describe('obtenerBreadcrumb', () => {
    it('toma las migas de la ruta más profunda que las declare', () => {
        expect(obtenerBreadcrumb(cadena(
            {},
            { breadcrumb: ['Conflicto'] },
            { breadcrumb: ['Conflicto', 'Análisis de Conflictos',
                'Plan de Acción'] }
        ))).toEqual(['Conflicto', 'Análisis de Conflictos', 'Plan de Acción']);
    });

    it('si la hoja no declara, usa la del ancestro', () => {
        expect(obtenerBreadcrumb(cadena(
            { breadcrumb: ['Historial'] },
            {}
        ))).toEqual(['Historial']);
    });

    it('vacío si nadie declara', () => {
        expect(obtenerBreadcrumb(cadena({}, {}))).toEqual([]);
    });
});
