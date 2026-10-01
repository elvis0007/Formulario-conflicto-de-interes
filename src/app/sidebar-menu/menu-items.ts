import { RUTAS } from '../app.paths';
import { ItemMenu } from './item-menu';

/** Trazos de los iconos del menu (viewBox 24x24, estilo Feather). */
const ICONO = {
  dashboard: 'M3 3h7v9H3z M14 3h7v5h-7z M14 12h7v9h-7z M3 16h7v5H3z',
  formularios: 'M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5'
    + 'l2 3h9a2 2 0 0 1 2 2z',
  conflicto: 'M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3'
    + 'L13.71 3.86a2 2 0 0 0-3.42 0z M12 9v4 M12 17h.01',
  analisis: 'M22 12h-4l-3 9L9 3l-3 9H2',
  consulta: 'M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14z M21 21l-4.35-4.35',
  informe: 'M18 20V10 M12 20V4 M6 20v-6',
  revision: 'M9 11l3 3L22 4 M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5'
    + 'a2 2 0 0 1 2-2h11',
  historial: 'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z M12 6v6l4 2',
  bandeja: 'M22 12h-6l-2 3h-4l-2-3H2 M5.45 5.11L2 12v6a2 2 0 0 0 2 2h16'
    + 'a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0'
    + '-1.79 1.11z',
  actividades: 'M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6'
    + 'a2 2 0 0 1 2-2h2 M9 2h6v4H9z M9 14l2 2 4-4'
} as const;

/**
 * Menu lateral de la app para RRHH (roles `R` y `A`). Lo pinta el menu
 * real del host (`src/app/sidebar-menu`), en `/admin`, `/rrhh/**` y
 * `/responsable/**`.
 *
 * - «Formularios» agrupa los 3 botones que ya tenia el menu del host (no se
 *   modifican; ver `formulariosHost`).
 * - «Plan de Acción» no aparece: se entra desde Análisis de Conflictos, y
 *   mientras se esta en un plan se resalta «Análisis de Conflictos» gracias a
 *   `prefijosAdicionales` (ver `buscarItemActivo`).
 *
 * @author Elvis Flores
 */
export const MENU_RRHH: readonly ItemMenu[] = [
  {
    etiqueta: 'Dashboard',
    icono: ICONO.dashboard,
    ruta: RUTAS.rrhh.dashboard
  },
  {
    etiqueta: 'Formularios',
    icono: ICONO.formularios,
    formulariosHost: true
  },
  {
    etiqueta: 'Conflicto',
    icono: ICONO.conflicto,
    hijos: [
      {
        etiqueta: 'Análisis de Conflictos',
        icono: ICONO.analisis,
        ruta: RUTAS.rrhh.analisisConflictos,
        prefijosAdicionales: [RUTAS.rrhh.conflictos]
      },
      {
        etiqueta: 'Consulta Previa',
        icono: ICONO.consulta,
        ruta: RUTAS.rrhh.consultaPrevia
      }
    ]
  },
  {
    etiqueta: 'Informe General',
    icono: ICONO.informe,
    ruta: RUTAS.rrhh.informeGeneral
  },
  {
    etiqueta: 'Revisión de Evidencias',
    icono: ICONO.revision,
    ruta: RUTAS.rrhh.revisionEvidencias
  },
  {
    etiqueta: 'Historial',
    icono: ICONO.historial,
    ruta: RUTAS.rrhh.historial
  }
];

/**
 * Menu lateral del Responsable (solo rol `P`). El detalle de
 * un plan (`/responsable/planes/:planId`) resalta «Bandeja de Tareas»
 * por prefijo de su propia ruta.
 *
 * @author Elvis Flores
 */
export const MENU_RESPONSABLE: readonly ItemMenu[] = [
  {
    etiqueta: 'Dashboard',
    icono: ICONO.dashboard,
    ruta: RUTAS.responsable.dashboard
  },
  {
    etiqueta: 'Bandeja de Tareas',
    icono: ICONO.bandeja,
    ruta: RUTAS.responsable.planes
  }
];

/**
 * Item que se agrega al menu de RRHH cuando el usuario tambien es
 * Responsable (`R`/`A` y `P`): lleva a su bandeja de actividades.
 *
 * @author Elvis Flores
 */
export const ITEM_MIS_ACTIVIDADES: ItemMenu = {
  etiqueta: 'Mis actividades',
  icono: ICONO.actividades,
  ruta: RUTAS.responsable.planes
};

/**
 * Menu de RRHH mas «Mis actividades», para quien tiene `R`/`A` y `P`.
 *
 * @author Elvis Flores
 */
export const MENU_RRHH_Y_RESPONSABLE: readonly ItemMenu[] = [
  ...MENU_RRHH,
  ITEM_MIS_ACTIVIDADES
];

/**
 * Elige el menu lateral segun los roles de gestion del usuario.
 *
 * - RRHH (`R`/`A`): `MENU_RRHH`; si ademas es Responsable (`P`),
 *   `MENU_RRHH_Y_RESPONSABLE`.
 * - Solo Responsable: `MENU_RESPONSABLE`.
 * - Ninguno: vacio (el menu solo se pinta en /admin, /rrhh/** y
 *   /responsable/**, a los que ese usuario no entra).
 *
 * @param esRrhh Si tiene el rol de gestion `rrhh`.
 * @param esResponsable Si tiene el rol de gestion `responsable`.
 * @returns Items del menu.
 * @author Elvis Flores
 */
export function obtenerMenu(
  esRrhh: boolean,
  esResponsable: boolean
): readonly ItemMenu[] {
  if (esRrhh) {
    return esResponsable ? MENU_RRHH_Y_RESPONSABLE : MENU_RRHH;
  }

  return esResponsable ? MENU_RESPONSABLE : [];
}
