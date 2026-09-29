import { inject } from '@angular/core';
import { Routes } from '@angular/router';
import { DATO_ROL_REQUERIDO, rolGuard } from './core/guards/rol.guard';
import { RolPnipCiService } from './core/services/rol-pnip-ci.service';
import { MENU_RESPONSABLE, MENU_RRHH } from './pnip-ci.menus';
import {
    DATO_MENU,
    LayoutPnipComponent
} from './shared/components/layout-pnip/layout-pnip.component';
import {
    PnipCiShellComponent
} from './shared/components/pnip-ci-shell/pnip-ci-shell.component';
import { DATO_BREADCRUMB } from './shared/components/topbar-pnip/breadcrumb';

/**
 * Pantallas del rol RRHH (`/pnip/rrhh/...`). Cada una se carga de forma
 * diferida con `loadComponent` y declara sus migas de pan.
 */
const RUTAS_RRHH: Routes = [
    {
        path: '',
        pathMatch: 'full',
        redirectTo: 'dashboard'
    },
    {
        path: 'dashboard',
        data: { [DATO_BREADCRUMB]: ['Dashboard'] },
        loadComponent: () => import('./rrhh/dashboard/dashboard.component')
            .then((m) => m.RrhhDashboardComponent)
    },
    {
        path: 'formularios/conflicto-interes',
        data: { [DATO_BREADCRUMB]: ['Formularios', 'Conflicto de Interés'] },
        // Literal unico (sin concatenar): import() debe ser analizable.
        loadComponent: () => import(
            './rrhh/formularios-conflicto-interes/formularios-conflicto-interes.component'
        ).then((m) => m.FormulariosConflictoInteresComponent)
    },
    {
        path: 'formularios/excusas',
        data: { [DATO_BREADCRUMB]: ['Formularios', 'Excusas'] },
        loadComponent: () => import(
            './rrhh/formularios-excusas/formularios-excusas.component'
        ).then((m) => m.FormulariosExcusasComponent)
    },
    {
        path: 'conflictos/analisis',
        data: { [DATO_BREADCRUMB]: ['Conflicto', 'Análisis de Conflictos'] },
        loadComponent: () => import(
            './rrhh/analisis-conflicto/analisis-conflicto.component'
        ).then((m) => m.AnalisisConflictoComponent)
    },
    {
        path: 'conflictos/consulta-previa',
        data: { [DATO_BREADCRUMB]: ['Conflicto', 'Consulta Previa'] },
        loadComponent: () => import(
            './rrhh/consulta-previa/consulta-previa.component'
        ).then((m) => m.ConsultaPreviaComponent)
    },
    {
        path: 'conflictos/:conflictoId/planes/:planId',
        data: {
            [DATO_BREADCRUMB]: [
                'Conflicto',
                'Análisis de Conflictos',
                'Plan de Acción'
            ]
        },
        loadComponent: () => import(
            './rrhh/plan-accion-detalle/plan-accion-detalle.component'
        ).then((m) => m.PlanAccionDetalleComponent)
    },
    {
        path: 'informe-general',
        data: { [DATO_BREADCRUMB]: ['Informe General'] },
        loadComponent: () => import(
            './rrhh/informe-general/informe-general.component'
        ).then((m) => m.InformeGeneralComponent)
    },
    {
        path: 'revision-evidencias',
        data: { [DATO_BREADCRUMB]: ['Revisión de Evidencias'] },
        loadComponent: () => import(
            './rrhh/revision-evidencias/revision-evidencias.component'
        ).then((m) => m.RevisionEvidenciasComponent)
    },
    {
        path: 'historial',
        data: { [DATO_BREADCRUMB]: ['Historial'] },
        loadComponent: () => import('./rrhh/historial/historial.component')
            .then((m) => m.HistorialComponent)
    }
];

/**
 * Pantallas del Responsable (`/pnip/responsable/...`).
 */
const RUTAS_RESPONSABLE: Routes = [
    {
        path: '',
        pathMatch: 'full',
        redirectTo: 'dashboard'
    },
    {
        path: 'dashboard',
        data: { [DATO_BREADCRUMB]: ['Dashboard'] },
        loadComponent: () => import(
            './responsable/dashboard/dashboard.component'
        ).then((m) => m.ResponsableDashboardComponent)
    },
    {
        path: 'planes',
        data: { [DATO_BREADCRUMB]: ['Bandeja de Tareas'] },
        loadComponent: () => import(
            './responsable/mis-planes/mis-planes.component'
        ).then((m) => m.MisPlanesComponent)
    },
    {
        path: 'planes/:planId',
        data: { [DATO_BREADCRUMB]: ['Bandeja de Tareas', 'Detalle del plan'] },
        // Literal unico (sin concatenar): import() debe ser analizable.
        loadComponent: () => import(
            './responsable/plan-responsable-detalle/plan-responsable-detalle.component'
        ).then((m) => m.PlanResponsableDetalleComponent)
    }
];

/**
 * Rutas del modulo PNIP-CI. Se registran en `app.routes.ts` bajo `/pnip`
 * con `loadChildren`, asi que este archivo y todo lo que importa se cargan
 * solo cuando el usuario entra al modulo.
 *
 * Estructura:
 * - `PnipCiShellComponent`: tokens de diseno, fuentes, pantalla completa.
 *   - `rrhh` → `LayoutPnipComponent` con `MENU_RRHH` → pantallas RRHH.
 *   - `responsable` → `LayoutPnipComponent` con `MENU_RESPONSABLE` →
 *     pantallas del Responsable.
 *
 * Las URLs finales no cambian respecto al Dia 1.
 *
 * `/pnip` a secas lleva a la pantalla de inicio del usuario
 * (`RolPnipCiService.obtenerRutaInicio`).
 *
 * @author Elvis Flores
 */
export const PNIP_CI_ROUTES: Routes = [
    {
        path: '',
        component: PnipCiShellComponent,
        children: [
            {
                path: '',
                pathMatch: 'full',
                redirectTo: () => inject(RolPnipCiService)
                    .obtenerRutaInicio()
            },
            {
                path: 'rrhh',
                component: LayoutPnipComponent,
                canActivate: [rolGuard],
                data: {
                    [DATO_ROL_REQUERIDO]: 'rrhh',
                    [DATO_MENU]: MENU_RRHH
                },
                children: RUTAS_RRHH
            },
            {
                path: 'responsable',
                component: LayoutPnipComponent,
                canActivate: [rolGuard],
                // Sin rol: cualquier empleado (no externo) puede ser
                // responsable de una actividad.
                data: {
                    [DATO_ROL_REQUERIDO]: null,
                    [DATO_MENU]: MENU_RESPONSABLE
                },
                children: RUTAS_RESPONSABLE
            }
        ]
    }
];
