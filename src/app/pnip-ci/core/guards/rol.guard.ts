import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../../../services/auth.service';
import { RolPnipCi } from '../models';
import { RolPnipCiService } from '../services/rol-pnip-ci.service';

/** Clave de `Route.data` donde cada ruta indica el rol que exige. */
export const DATO_ROL_REQUERIDO = 'rolRequerido';

/**
 * Guard de rol del modulo PNIP-CI.
 *
 * Lee el rol exigido en `data.rolRequerido` de la ruta y:
 * - sin sesion, envia a `/login` (igual que `authGuard`);
 * - con el rol, deja pasar;
 * - sin el rol, envia al inicio del rol que si tenga, o a `/` si no tiene
 *   ninguno (y `authGuard` decide desde ahi).
 *
 * @param route Ruta que se intenta activar.
 * @returns `true` o el `UrlTree` al que redirigir.
 * @author EEASA
 */
export const rolGuard: CanActivateFn = (route) => {
    const authService = inject(AuthService);
    const rolService = inject(RolPnipCiService);
    const router = inject(Router);
    const rolRequerido = route.data[DATO_ROL_REQUERIDO] as
        RolPnipCi | undefined;
    let rutaInicio: string | null = null;

    if (!authService.isAuthenticated()) {
        return router.createUrlTree(['/login']);
    }

    if (rolRequerido === undefined) {
        console.error(
            '[rolGuard] La ruta no define data.' + DATO_ROL_REQUERIDO,
            route
        );
        return router.createUrlTree(['/']);
    }

    if (rolService.tieneRol(rolRequerido)) {
        return true;
    }

    rutaInicio = rolService.obtenerRutaInicio();

    return router.parseUrl(rutaInicio ?? '/');
};
