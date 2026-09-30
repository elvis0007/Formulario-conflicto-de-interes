import { MENU_RESPONSABLE, MENU_RRHH } from '../../pnip-ci.menus';
import { buscarGrupo, buscarItemActivo } from './menu.util';

describe('menu.util', () => {
    /**
     * @param url URL activa.
     * @returns Etiqueta del item activo en el menu de RRHH.
     */
    function activoRrhh(url: string): string | undefined {
        return buscarItemActivo(MENU_RRHH, url)?.etiqueta;
    }

    it('coincidencia exacta', () => {
        expect(activoRrhh('/pnip/rrhh/dashboard')).toBe('Dashboard');
        expect(activoRrhh('/pnip/rrhh/historial')).toBe('Historial');
    });

    it('Plan de Acción resalta Análisis de Conflictos', () => {
        expect(activoRrhh('/pnip/rrhh/conflictos/C-001/planes/PL-002'))
            .toBe('Análisis de Conflictos');
    });

    it('Consulta Previa no se confunde con el prefijo de Análisis', () => {
        expect(activoRrhh('/pnip/rrhh/conflictos/consulta-previa'))
            .toBe('Consulta Previa');
        expect(activoRrhh('/pnip/rrhh/conflictos/analisis'))
            .toBe('Análisis de Conflictos');
    });

    it('ignora query y fragmento y no confunde segmentos parecidos', () => {
        expect(activoRrhh('/pnip/rrhh/historial?pagina=2#fila'))
            .toBe('Historial');
        expect(activoRrhh('/pnip/rrhh/historial-viejo')).toBeUndefined();
    });

    it('las rutas del host (/admin) no resaltan ningún ítem del módulo', () => {
        expect(activoRrhh('/admin')).toBeUndefined();
        expect(activoRrhh('/admin?vista=formulario')).toBeUndefined();
    });

    it('detalle de plan del responsable resalta Bandeja de Tareas', () => {
        expect(buscarItemActivo(MENU_RESPONSABLE,
            '/pnip/responsable/planes/PL-003')?.etiqueta)
            .toBe('Bandeja de Tareas');
    });

    it('buscarGrupo devuelve el grupo del ítem activo', () => {
        const activo = buscarItemActivo(MENU_RRHH,
            '/pnip/rrhh/conflictos/C-001/planes/PL-002');

        expect(buscarGrupo(MENU_RRHH, activo)?.etiqueta).toBe('Conflicto');
        expect(buscarGrupo(MENU_RRHH, null)).toBeNull();
    });
});
