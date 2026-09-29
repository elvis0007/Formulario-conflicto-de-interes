import { Routes } from '@angular/router';
import { AdminComponent } from './admin/admin.component';
import { ConflictFormComponent } from './conflict-form/conflict-form.component';
import { LoginComponent } from './login/login.component';
import { MisFormulariosComponent } from './mis-formularios/mis-formularios.component';
import { authGuard } from './guards/auth.guard';

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
  { 
    path: '**', 
    redirectTo: '',
    pathMatch: 'full'
  }
];
