import { RUTAS } from '../app.paths';
import {
  MENU_RESPONSABLE,
  MENU_RRHH,
  MENU_RRHH_Y_RESPONSABLE,
  obtenerMenu
} from './menu-items';
import { buscarGrupo, buscarItemActivo } from './item-menu';

describe('item-menu', () => {
  /**
   * @param url URL activa.
   * @returns Etiqueta del item activo en el menu de RRHH.
   */
  function activoRrhh(url: string): string | undefined {
    return buscarItemActivo(MENU_RRHH, url)?.etiqueta;
  }

  it('coincidencia exacta', () => {
    expect(activoRrhh(RUTAS.rrhh.dashboard)).toBe('Dashboard');
    expect(activoRrhh(RUTAS.rrhh.historial)).toBe('Historial');
  });

  it('Plan de Acción resalta Análisis de Conflictos', () => {
    expect(activoRrhh(RUTAS.rrhh.conflictos + 'C-001/planes/PL-002'))
      .toBe('Análisis de Conflictos');
  });

  it('Consulta Previa no se confunde con el prefijo de Análisis', () => {
    expect(activoRrhh(RUTAS.rrhh.consultaPrevia))
      .toBe('Consulta Previa');
    expect(activoRrhh(RUTAS.rrhh.analisisConflictos))
      .toBe('Análisis de Conflictos');
  });

  it('ignora query y fragmento y no confunde segmentos parecidos', () => {
    expect(activoRrhh(RUTAS.rrhh.historial + '?pagina=2#fila'))
      .toBe('Historial');
    expect(activoRrhh(RUTAS.rrhh.historial + '-viejo')).toBeUndefined();
  });

  it('las rutas del host (/admin) no resaltan ningún ítem del módulo', () => {
    expect(activoRrhh('/admin')).toBeUndefined();
    expect(activoRrhh('/admin?vista=formulario')).toBeUndefined();
  });

  it('detalle de plan del responsable resalta Bandeja de Tareas', () => {
    expect(buscarItemActivo(MENU_RESPONSABLE,
      RUTAS.responsable.planes + '/PL-003')?.etiqueta)
      .toBe('Bandeja de Tareas');
  });

  it('buscarGrupo devuelve el grupo del ítem activo', () => {
    const activo = buscarItemActivo(MENU_RRHH,
      RUTAS.rrhh.conflictos + 'C-001/planes/PL-002');

    expect(buscarGrupo(MENU_RRHH, activo)?.etiqueta).toBe('Conflicto');
    expect(buscarGrupo(MENU_RRHH, null)).toBeNull();
  });

  it('obtenerMenu elige el menú según los roles', () => {
    expect(obtenerMenu(true, false)).toBe(MENU_RRHH);
    expect(obtenerMenu(true, true)).toBe(MENU_RRHH_Y_RESPONSABLE);
    expect(obtenerMenu(false, true)).toBe(MENU_RESPONSABLE);
    expect(obtenerMenu(false, false)).toEqual([]);
  });

  it('con R y P, un plan del responsable resalta «Mis actividades»', () => {
    expect(buscarItemActivo(MENU_RRHH_Y_RESPONSABLE,
      RUTAS.responsable.planes + '/PL-003')?.etiqueta)
      .toBe('Mis actividades');
    expect(buscarItemActivo(MENU_RRHH_Y_RESPONSABLE,
      RUTAS.rrhh.historial)?.etiqueta)
      .toBe('Historial');
  });
});
