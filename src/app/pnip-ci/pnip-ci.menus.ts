import { ItemMenu } from './shared/components/sidebar-pnip/item-menu';

/**
 * Menu lateral de RRHH.
 *
 * «Plan de Acción» no aparece: se entra desde Análisis de Conflictos, y
 * mientras se esta en un plan se resalta «Análisis de Conflictos» gracias a
 * `prefijosAdicionales` (ver `buscarItemActivo`).
 *
 * @author Elvis Flores
 */
export const MENU_RRHH: readonly ItemMenu[] = [
    { etiqueta: 'Dashboard', ruta: '/pnip/rrhh/dashboard' },
    {
        etiqueta: 'Formularios',
        hijos: [
            {
                etiqueta: 'Conflicto de Interés',
                ruta: '/pnip/rrhh/formularios/conflicto-interes'
            },
            { etiqueta: 'Excusas', ruta: '/pnip/rrhh/formularios/excusas' }
        ]
    },
    {
        etiqueta: 'Conflicto',
        hijos: [
            {
                etiqueta: 'Análisis de Conflictos',
                ruta: '/pnip/rrhh/conflictos/analisis',
                prefijosAdicionales: ['/pnip/rrhh/conflictos/']
            },
            {
                etiqueta: 'Consulta Previa',
                ruta: '/pnip/rrhh/conflictos/consulta-previa'
            }
        ]
    },
    { etiqueta: 'Informe General', ruta: '/pnip/rrhh/informe-general' },
    {
        etiqueta: 'Revisión de Evidencias',
        ruta: '/pnip/rrhh/revision-evidencias'
    },
    { etiqueta: 'Historial', ruta: '/pnip/rrhh/historial' }
];

/**
 * Menu lateral del Responsable. El detalle de un plan
 * (`/pnip/responsable/planes/:planId`) resalta «Bandeja de Tareas» por
 * prefijo de su propia ruta.
 *
 * @author Elvis Flores
 */
export const MENU_RESPONSABLE: readonly ItemMenu[] = [
    { etiqueta: 'Dashboard', ruta: '/pnip/responsable/dashboard' },
    { etiqueta: 'Bandeja de Tareas', ruta: '/pnip/responsable/planes' }
];
