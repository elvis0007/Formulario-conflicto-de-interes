import { inject } from '@angular/core';
import { Routes } from '@angular/router';
import { DATO_ROL_REQUERIDO, rolGuard } from './core/guards/rol.guard';
import { RolPnipCiService } from './core/services/rol-pnip-ci.service';
import {
    PnipCiShellComponent
} from './shared/components/pnip-ci-shell/pnip-ci-shell.component';

/**
 * Pantallas del rol RRHH (`/pnip/rrhh/...`). Cada una se carga de forma
 * diferida con `loadComponent`.
 */
const RUTAS_RRHH: Routes = [
    {
        path: '',
        pathMatch: 'full',
        redirectTo: 'dashboard'
    },
    {
        path: 'dashboard',
        loadComponent: () => import('./rrhh/dashboard/dashboard.component')
            .then((m) => m.RrhhDashboardComponent)
    },
    {
        path: 'formularios/conflicto-interes',
        // Literal unico (sin concatenar): import() debe ser analizable.
        loadComponent: () => import(
            './rrhh/formularios-conflicto-interes/formularios-conflicto-interes.component'
        ).then((m) => m.FormulariosConflictoInteresComponent)
    },
    {
        path: 'formularios/excusas',
        loadComponent: () => import(
            './rrhh/formularios-excusas/formularios-excusas.component'
        ).then((m) => m.FormulariosExcusasComponent)
    },
    {
        path: 'conflictos/analisis',
        loadComponent: () => import(
            './rrhh/analisis-conflicto/analisis-conflicto.component'
        ).then((m) => m.AnalisisConflictoComponent)
    },
    {
        path: 'conflictos/consulta-previa',
        loadComponent: () => import(
            './rrhh/consulta-previa/consulta-previa.component'
        ).then((m) => m.ConsultaPreviaComponent)
    },
    {
        path: 'conflictos/:conflictoId/planes/:planId',
        loadComponent: () => import(
            './rrhh/plan-accion-detalle/plan-accion-detalle.component'
        ).then((m) => m.PlanAccionDetalleComponent)
    },
    {
        path: 'informe-general',
        loadComponent: () => import(
            './rrhh/informe-general/informe-general.component'
        ).then((m) => m.InformeGeneralComponent)
    },
    {
        path: 'revision-evidencias',
        loadComponent: () => import(
            './rrhh/revision-evidencias/revision-evidencias.component'
        ).then((m) => m.RevisionEvidenciasComponent)
    },
    {
        path: 'historial',
        loadComponent: () => import('./rrhh/historial/historial.component')
            .then((m) => m.HistorialComponent)
    }
];

/**
 * Pantallas del rol Responsable (`/pnip/responsable/...`).
 */
const RUTAS_RESPONSABLE: Routes = [
    {
        path: '',
        pathMatch: 'full',
        redirectTo: 'dashboard'
    },
    {
        path: 'dashboard',
        loadComponent: () => import(
            './responsable/dashboard/dashboard.component'
        ).then((m) => m.ResponsableDashboardComponent)
    },
    {
        path: 'planes',
        loadComponent: () => import(
            './responsable/mis-planes/mis-planes.component'
        ).then((m) => m.MisPlanesComponent)
    },
    {
        path: 'planes/:planId',
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
 * `/pnip` a secas lleva al inicio del rol del usuario.
 *
 * @author EEASA
 */
export const PNIP_CI_ROUTES: Routes = [
    {
        path: '',
        component: PnipCiShellComponent,
        children: [
            {
                path: '',
                pathMatch: 'full',
                redirectTo: () => {
                    const rutaInicio = inject(RolPnipCiService)
                        .obtenerRutaInicio();

                    return rutaInicio ?? '/';
                }
            },
            {
                path: 'rrhh',
                canActivate: [rolGuard],
                data: { [DATO_ROL_REQUERIDO]: 'rrhh' },
                children: RUTAS_RRHH
            },
            {
                path: 'responsable',
                canActivate: [rolGuard],
                data: { [DATO_ROL_REQUERIDO]: 'responsable' },
                children: RUTAS_RESPONSABLE
            }
        ]
    }
];
