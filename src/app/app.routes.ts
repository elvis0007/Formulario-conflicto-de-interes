import { Routes } from '@angular/router';
import { AdminComponent } from './admin/admin.component';
import { ConflictFormComponent } from './conflict-form/conflict-form.component';
import { LoginComponent } from './login/login.component';
import { MisFormulariosComponent } from './mis-formularios/mis-formularios.component';
import { authGuard } from './guards/auth.guard';
import { PNIP_CI_RUTA_BASE } from './pnip-ci/pnip-ci.constants';

/**
 * Rutas que la aplicacion acepta. El guard y AppComponent la usan para
 * rechazar cualquier otra; estaba copiada en tres sitios y agregar una ruta
 * exigia acordarse de las tres.
 */
export const RUTAS_PERMITIDAS = ['/', '/login', '/admin', '/mis-formularios'];

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
  // Modulo PNIP-CI (carga diferida). No usa authGuard: su control de sesion
  // y de rol lo hace rolGuard dentro del modulo.
  {
    path: PNIP_CI_RUTA_BASE,
    loadChildren: () => import('./pnip-ci/pnip-ci.routes')
      .then((m) => m.PNIP_CI_ROUTES)
  },
  { 
    path: '**', 
    redirectTo: '',
    pathMatch: 'full'
  }
];
