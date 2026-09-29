import { Injectable, inject } from '@angular/core';
import { environment } from '../../../../environments/environment';
import { AuthService } from '../../../services/auth.service';
import { RolPnipCi } from '../models';

/** Abreviaturas de rol del backend que dan acceso a la parte de RRHH. */
const ROLES_BACKEND_RRHH: readonly string[] = ['R', 'A'];

/**
 * Rol que se simula en desarrollo mientras el backend no exponga el rol
 * `responsable`. Poner `null` para usar solo los roles reales.
 */
const ROL_SIMULADO_POR_DEFECTO: RolPnipCi | null = 'rrhh';

/**
 * Clave de `localStorage` para cambiar el rol simulado sin recompilar.
 * Valores: `rrhh`, `responsable` o `ninguno` (desactiva la simulacion).
 */
const CLAVE_ROL_SIMULADO = 'PNIP-CI-ROL-SIMULADO';

/** Pantalla de inicio de cada rol del modulo. */
const RUTA_INICIO: Readonly<Record<RolPnipCi, string>> = {
    rrhh: '/pnip/rrhh/dashboard',
    responsable: '/pnip/responsable/dashboard'
};

/**
 * Traduce la sesion del usuario a los roles del modulo PNIP-CI.
 *
 * Fuente real: `AuthService.hasRole()`. Los roles `R` (Jefe de RRHH) y `A`
 * (Administrador) se tratan como `rrhh`, igual que en el resto de la app.
 *
 * TEMPORAL: el backend aun no tiene un rol de Responsable. Mientras tanto,
 * **solo fuera de produccion**, se simula un rol configurable
 * (`ROL_SIMULADO_POR_DEFECTO`, o el valor de `localStorage` en
 * `PNIP-CI-ROL-SIMULADO`). En produccion la simulacion no se aplica y nadie
 * obtiene el rol `responsable` hasta conectar el backend real.
 *
 * @author EEASA
 */
@Injectable({
    providedIn: 'root'
})
export class RolPnipCiService {
    private readonly authService = inject(AuthService);

    /**
     * Devuelve los roles PNIP-CI del usuario actual.
     *
     * @returns Lista de roles; vacia si el usuario no tiene acceso al modulo.
     */
    obtenerRoles(): RolPnipCi[] {
        const rolSimulado = this.obtenerRolSimulado();
        const roles: RolPnipCi[] = [];

        if (rolSimulado !== null) {
            return [rolSimulado];
        }

        if (ROLES_BACKEND_RRHH.some((rol) => this.authService.hasRole(rol))) {
            roles.push('rrhh');
        }

        return roles;
    }

    /**
     * Indica si el usuario actual tiene un rol del modulo.
     *
     * @param rol Rol a comprobar.
     * @returns `true` si el usuario tiene ese rol.
     */
    tieneRol(rol: RolPnipCi): boolean {
        return this.obtenerRoles().includes(rol);
    }

    /**
     * Pantalla a la que debe ir el usuario al entrar al modulo.
     *
     * @returns Ruta absoluta del inicio de su primer rol, o `null` si no
     * tiene ningun rol PNIP-CI.
     */
    obtenerRutaInicio(): string | null {
        const roles = this.obtenerRoles();

        return roles.length > 0 ? RUTA_INICIO[roles[0]] : null;
    }

    /**
     * Rol simulado vigente. Siempre `null` en produccion.
     *
     * @returns Rol simulado, o `null` si no hay simulacion activa.
     */
    private obtenerRolSimulado(): RolPnipCi | null {
        let valorGuardado: string | null = null;

        if (environment.production) {
            return null;
        }

        try {
            valorGuardado = localStorage.getItem(CLAVE_ROL_SIMULADO);
        } catch (err) {
            console.error(
                '[RolPnipCiService.obtenerRolSimulado] '
                + 'No se pudo leer localStorage:',
                err
            );
        }

        if (valorGuardado === 'rrhh' || valorGuardado === 'responsable') {
            return valorGuardado;
        }
        if (valorGuardado === 'ninguno') {
            return null;
        }

        return ROL_SIMULADO_POR_DEFECTO;
    }
}
