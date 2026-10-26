import { inject } from '@angular/core';
import { Router, CanActivateFn } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { RUTAS_PERMITIDAS } from '../app.routes';

export const authGuard: CanActivateFn = (route, state) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  const url = state.url.split('?')[0];
  const rutasPermitidas = RUTAS_PERMITIDAS;

  // Regla especial: si el usuario navega explícitamente al login de SISCI,
  // [PNIP-CI] Sebas Constante - 26/10/2026
  // Qué hace: comentario actualizado: el token propio ahora es
  //   TOKEN-SISCI.
  // siempre limpiamos cualquier token previo (Intranet / Sisci) y
  // [FIN PNIP-CI]
  // permitimos permanecer en la pantalla de login, aunque estuviera autenticado.
    if (url === '/login') {
    authService.logout();
      return true;
    }

  if (!authService.isAuthenticated()) {
    router.navigate(['/login'], { replaceUrl: true });
    return false;
  }

  const tieneRolAdmin = authService.hasRole('A');
  const tieneRolJefeRRHH = authService.hasRole('R');
  const esAdminOJefeRRHH = tieneRolAdmin || tieneRolJefeRRHH;

  if (url.startsWith('/admin')) {
    // Solo Admin (A) y Jefes de RRHH (R) pueden acceder al módulo admin
    if (!esAdminOJefeRRHH) {
      router.navigate(['/'], { replaceUrl: true });
      return false;
    }
    return true;
  }

  if (url === '/' || url === '') {
    // Solo Admin / Jefe RRHH se redirigen automáticamente al admin
    if (esAdminOJefeRRHH) {
      router.navigate(['/admin'], { replaceUrl: true });
      return false;
    }
    return true;
  }

  if (!rutasPermitidas.includes(url)) {
    if (esAdminOJefeRRHH) {
      router.navigate(['/admin'], { replaceUrl: true });
    } else {
      router.navigate(['/'], { replaceUrl: true });
    }
    return false;
  }

  return true;
};
