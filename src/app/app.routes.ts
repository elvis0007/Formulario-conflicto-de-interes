import { Routes } from '@angular/router';
import { AdminComponent } from './admin/admin.component';
import { ConflictFormComponent } from './conflict-form/conflict-form.component';
import { LoginComponent } from './login/login.component';
import { MisFormulariosComponent } from './mis-formularios/mis-formularios.component';
import { authGuard } from './guards/auth.guard';
import { DATO_ROL_REQUERIDO, rolGuard } from './guards/rol.guard';
import { SEGMENTO_RESPONSABLE, SEGMENTO_RRHH, SEGMENTOS, esRutaDeGestion } from './app.paths';

/**
 * Rutas que la aplicacion acepta. El guard y AppComponent la usan para
 * rechazar cualquier otra; estaba copiada en tres sitios y agregar una ruta
 * exigia acordarse de las tres.
 */
export const RUTAS_PERMITIDAS = ['/', '/login', '/admin', '/mis-formularios'];

/**
 * PNIP-CI: indica si AppComponent debe aceptar una URL. Son las de
 * RUTAS_PERMITIDAS (comparacion exacta, igual que antes) mas las de gestion
 * de conflictos (/rrhh/** y /responsable/**), que controla rolGuard.
 *
 * @param url URL sin query string.
 * @returns `true` si la URL esta permitida.
 */
export function esRutaPermitida(url: string): boolean {
  return RUTAS_PERMITIDAS.includes(url) || esRutaDeGestion(url);
}

export const routes: Routes = [
  { 
    path: 'login', 
    component: LoginComponent,
    canActivate: [authGuard]
  },
  { 
    path: '', 
    component: ConflictFormComponent, 
    canActivate: [authGuard] 
  },
  { 
    path: 'admin', 
    component: AdminComponent, 
    canActivate: [authGuard] 
  },
  {
    path: 'mis-formularios',
    component: MisFormulariosComponent,
    canActivate: [authGuard]
  },
  // PNIP-CI: pantallas de RRHH. No usan authGuard: sesion y rol los
  // controla rolGuard, una vez para todo el grupo. Cada pantalla se carga de
  // forma diferida.
  {
    path: SEGMENTO_RRHH,
    canActivate: [rolGuard],
    data: { [DATO_ROL_REQUERIDO]: 'rrhh' },
    children: [
      { path: '', pathMatch: 'full', redirectTo: SEGMENTOS.rrhh.dashboard },
      {
        path: SEGMENTOS.rrhh.dashboard,
        loadComponent: () => import('./rrhh-dashboard/rrhh-dashboard.component')
          .then((m) => m.RrhhDashboardComponent)
      },
      {
        path: SEGMENTOS.rrhh.analisisConflictos,
        loadComponent: () => import('./analisis-conflicto/analisis-conflicto.component')
          .then((m) => m.AnalisisConflictoComponent)
      },
      {
        path: SEGMENTOS.rrhh.consultaPrevia,
        loadComponent: () => import('./consulta-previa/consulta-previa.component')
          .then((m) => m.ConsultaPreviaComponent)
      },
      {
        path: SEGMENTOS.rrhh.planAccion,
        loadComponent: () => import('./plan-accion-detalle/plan-accion-detalle.component')
          .then((m) => m.PlanAccionDetalleComponent)
      },
      {
        path: SEGMENTOS.rrhh.informeGeneral,
        loadComponent: () => import('./informe-general/informe-general.component')
          .then((m) => m.InformeGeneralComponent)
      },
      {
        path: SEGMENTOS.rrhh.revisionEvidencias,
        loadComponent: () => import('./revision-evidencias/revision-evidencias.component')
          .then((m) => m.RevisionEvidenciasComponent)
      },
      {
        path: SEGMENTOS.rrhh.historial,
        loadComponent: () => import('./historial/historial.component')
          .then((m) => m.HistorialComponent)
      }
    ]
  },
  // PNIP-CI: pantallas del Responsable. Sin rol: cualquier empleado (no
  // externo) puede ser responsable de una actividad.
  {
    path: SEGMENTO_RESPONSABLE,
    canActivate: [rolGuard],
    data: { [DATO_ROL_REQUERIDO]: null },
    children: [
      { path: '', pathMatch: 'full', redirectTo: SEGMENTOS.responsable.dashboard },
      {
        path: SEGMENTOS.responsable.dashboard,
        loadComponent: () => import('./responsable-dashboard/responsable-dashboard.component')
          .then((m) => m.ResponsableDashboardComponent)
      },
      {
        path: SEGMENTOS.responsable.planes,
        loadComponent: () => import('./mis-planes/mis-planes.component')
          .then((m) => m.MisPlanesComponent)
      },
      {
        path: SEGMENTOS.responsable.planDetalle,
        loadComponent: () => import('./plan-responsable-detalle/plan-responsable-detalle.component')
          .then((m) => m.PlanResponsableDetalleComponent)
      }
    ]
  },
  { 
    path: '**', 
    redirectTo: '',
    pathMatch: 'full'
  }
];
