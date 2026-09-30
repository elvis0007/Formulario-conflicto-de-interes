import { inject } from '@angular/core';
import { Routes } from '@angular/router';
import { DATO_ROL_REQUERIDO, rolGuard } from './core/guards/rol.guard';
import { RolPnipCiService } from './core/services/rol-pnip-ci.service';

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
 * No hay shell propio: cada pantalla se monta directamente en el
 * `<router-outlet>` de `AppComponent`, entre la cabecera y el pie reales, y
 * `AppComponent` pinta a su lado el menu lateral real de la app
 * (`SidebarMenuComponent`) mientras la ruta empiece con `/pnip`.
 *
 * Los grupos `rrhh` y `responsable` no tienen componente: solo aplican
 * `rolGuard` a sus hijas. Las URLs finales no cambian respecto al Dia 1.
 *
 * `/pnip` a secas lleva a la pantalla de inicio del usuario
 * (`RolPnipCiService.obtenerRutaInicio`).
 *
 * @author Elvis Flores
 */
export const PNIP_CI_ROUTES: Routes = [
    {
        path: '',
        pathMatch: 'full',
        redirectTo: () => inject(RolPnipCiService).obtenerRutaInicio()
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
        // Sin rol: cualquier empleado (no externo) puede ser responsable de
        // una actividad.
        data: { [DATO_ROL_REQUERIDO]: null },
        children: RUTAS_RESPONSABLE
    }
];
