import { Injectable, inject } from '@angular/core';
import { environment } from '../../../../environments/environment';
import { AuthService } from '../../../services/auth.service';
import { RolPnipCi } from '../models';
import { EMPLEADO_SIMULADO_POR_DEFECTO } from './mock-data/personas.data';

/** Abreviaturas de rol del backend que dan acceso a la parte de RRHH. */
const ROLES_BACKEND_RRHH: readonly string[] = ['R', 'A'];

/**
 * Rol que se simula en desarrollo. Poner `null` para usar solo los roles
 * reales del backend.
 */
const ROL_SIMULADO_POR_DEFECTO: RolPnipCi | null = 'rrhh';

/**
 * Clave de `localStorage` para cambiar el rol simulado sin recompilar.
 * Valores: `rrhh` o `ninguno` (desactiva la simulacion).
 */
const CLAVE_ROL_SIMULADO = 'PNIP-CI-ROL-SIMULADO';

/**
 * Clave de `localStorage` para elegir que empleado de los datos de ejemplo
 * esta usando la app (p. ej. `EMP-004`).
 */
const CLAVE_EMPLEADO_SIMULADO = 'PNIP-CI-EMPLEADO-SIMULADO';

/** Pantalla de inicio de RRHH. */
const RUTA_INICIO_RRHH = '/pnip/rrhh/dashboard';

/** Pantalla de inicio de cualquier empleado (vista de responsable). */
const RUTA_INICIO_RESPONSABLE = '/pnip/responsable/dashboard';

/**
 * Traduce la sesion del usuario al modulo PNIP-CI: su rol (solo `rrhh`) y
 * su identificador de empleado.
 *
 * - Rol: `R` (Jefe de RRHH) y `A` (Administrador) se tratan como `rrhh`,
 *   igual que en el resto de la app.
 * - Empleado: se usa para saber de que actividades es responsable.
 *
 * Fuera de produccion se pueden simular ambos valores desde
 * `localStorage` (`PNIP-CI-ROL-SIMULADO`, `PNIP-CI-EMPLEADO-SIMULADO`). En
 * produccion la simulacion no se aplica nunca.
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
     * @returns Lista de roles; vacia si el usuario no es de RRHH.
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
     * Pantalla a la que debe ir el usuario al entrar al modulo: el dashboard
     * de RRHH si tiene ese rol y, si no, el de responsable, al que puede
     * entrar cualquier empleado autenticado.
     *
     * @returns Ruta absoluta de la pantalla de inicio.
     */
    obtenerRutaInicio(): string {
        return this.tieneRol('rrhh')
            ? RUTA_INICIO_RRHH
            : RUTA_INICIO_RESPONSABLE;
    }

    /**
     * Identificador del empleado que esta usando la app; es el valor que se
     * compara con `Actividad.responsableId`.
     *
     * - Fuera de produccion: el de `PNIP-CI-EMPLEADO-SIMULADO` o, si no hay,
     *   `EMPLEADO_SIMULADO_POR_DEFECTO`.
     * - En produccion: `DMPER_CODIGO` (o `CODIGO`) del usuario de
     *   `AuthService`, igual que hace `BackendService` al guardar el
     *   formulario. PENDIENTE confirmar con backend que `responsableId` usa
     *   ese mismo codigo.
     *
     * @returns Id del empleado, o `null` si la sesion no trae uno (p. ej.
     * usuarios externos, que solo tienen cedula).
     */
    obtenerEmpleadoActualId(): string | null {
        let valorGuardado: string | null = null;
        const usuario = this.authService.getCurrentUser();

        if (!environment.production) {
            valorGuardado = this.leerLocalStorage(CLAVE_EMPLEADO_SIMULADO);
            return valorGuardado || EMPLEADO_SIMULADO_POR_DEFECTO;
        }

        return usuario?.DMPER_CODIGO || usuario?.CODIGO || null;
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

        valorGuardado = this.leerLocalStorage(CLAVE_ROL_SIMULADO);

        if (valorGuardado === 'rrhh') {
            return valorGuardado;
        }
        if (valorGuardado === 'ninguno') {
            return null;
        }

        return ROL_SIMULADO_POR_DEFECTO;
    }

    /**
     * Lee una clave de `localStorage` sin propagar errores (modo privado,
     * almacenamiento bloqueado...).
     *
     * @param clave Clave a leer.
     * @returns El valor guardado, o `null` si no existe o no se pudo leer.
     */
    private leerLocalStorage(clave: string): string | null {
        try {
            return localStorage.getItem(clave);
        } catch (err) {
            console.error(
                '[RolPnipCiService.leerLocalStorage] No se pudo leer '
                + clave + ':',
                err
            );
            return null;
        }
    }
}
