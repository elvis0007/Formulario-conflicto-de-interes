import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { RolGestion } from '../models';
import { PerfilUsuarioService } from '../services/perfil-usuario.service';

/**
 * Clave de `Route.data` donde cada ruta indica el rol que exige.
 *
 * - Un `RolGestion` (`'rrhh'`): exige sesion y ese rol.
 * - `null`: exige sesion y ser EMPLEADO (pantallas de responsable: cualquier
 *   empleado puede ser responsable de una actividad; un usuario externo no).
 *
 * Es obligatorio declararla: si falta, el guard niega el paso, para que
 * olvidarla nunca abra una pantalla de RRHH.
 */
export const DATO_ROL_REQUERIDO = 'rolRequerido';

/**
 * Guard de acceso del modulo PNIP-CI.
 *
 * - Sin sesion (`AuthService.isAuthenticated()`, lo mismo que usa
 *   `authGuard`): envia a `/login`.
 * - `data.rolRequerido === null`: deja pasar a cualquier empleado
 *   autenticado; los externos (`E`) no pasan.
 * - Con el rol exigido: deja pasar.
 * - Si no cumple: envia a su pantalla de inicio
 *   (`PerfilUsuarioService.obtenerRutaInicio`).
 *
 * @param route Ruta que se intenta activar.
 * @returns `true` o el `UrlTree` al que redirigir.
 * @author Elvis Flores
 */
export const rolGuard: CanActivateFn = (route) => {
    const authService = inject(AuthService);
    const rolService = inject(PerfilUsuarioService);
    const router = inject(Router);
    let rolRequerido: RolGestion | null = null;

    if (!authService.isAuthenticated()) {
        return router.createUrlTree(['/login']);
    }

    if (!(DATO_ROL_REQUERIDO in route.data)) {
        console.error(
            '[rolGuard] La ruta no define data.' + DATO_ROL_REQUERIDO,
            route
        );
        return router.createUrlTree(['/']);
    }

    rolRequerido = route.data[DATO_ROL_REQUERIDO] as RolGestion | null;

    if (rolRequerido === null && rolService.esEmpleado()) {
        return true;
    }
    if (rolRequerido !== null && rolService.tieneRol(rolRequerido)) {
        return true;
    }

    return router.parseUrl(rolService.obtenerRutaInicio());
};
