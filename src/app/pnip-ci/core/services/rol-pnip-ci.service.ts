import { Injectable, inject } from '@angular/core';
import { environment } from '../../../../environments/environment';
import { AuthService } from '../../../services/auth.service';
import { RolPnipCi } from '../models';
import { EMPLEADO_SIMULADO_POR_DEFECTO } from './mock-data/personas.data';

/** Abreviaturas de rol del backend que dan acceso a la parte de RRHH. */
const ROLES_BACKEND_RRHH: readonly string[] = ['R', 'A'];

/**
 * Abreviatura del rol de usuario externo (entra con cedula y clave
 * temporal). No es empleado, asi que no puede ser responsable.
 */
const ROL_BACKEND_EXTERNO = 'E';

/** Ruta de inicio del resto de la app, para quien no tiene acceso. */
const RUTA_FUERA_DEL_MODULO = '/';
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
 * @author Elvis Flores
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
     * Indica si el usuario es empleado de la empresa, es decir, si puede
     * ser responsable de actividades. Todo autenticado lo es, salvo los
     * usuarios externos (rol `E`).
     *
     * Usa siempre el rol real: la simulacion de rol no aplica aqui.
     *
     * @returns `true` si no tiene el rol externo.
     */
    esEmpleado(): boolean {
        return !this.authService.hasRole(ROL_BACKEND_EXTERNO);
    }

    /**
     * Pantalla a la que debe ir el usuario al entrar al modulo, o al ser
     * rechazado por `rolGuard`:
     * - RRHH → dashboard de RRHH.
     * - Otro empleado → dashboard de responsable.
     * - Externo → `/` (fuera del modulo). Nunca apunta a una ruta que el
     *   guard vaya a rechazar, para no crear un bucle de redirecciones.
     *
     * @returns Ruta absoluta de la pantalla de inicio.
     */
    obtenerRutaInicio(): string {
        if (this.tieneRol('rrhh')) {
            return RUTA_INICIO_RRHH;
        }

        return this.esEmpleado()
            ? RUTA_INICIO_RESPONSABLE
            : RUTA_FUERA_DEL_MODULO;
    }

    /**
     * Texto del rol para el pie del sidebar.
     *
     * @returns `Administrador`, `Jefe de RRHH`, `RRHH (simulado)`,
     * `Usuario externo` o `Empleado`.
     */
    obtenerEtiquetaRol(): string {
        if (this.authService.hasRole('A')) {
            return 'Administrador';
        }
        if (this.authService.hasRole('R')) {
            return 'Jefe de RRHH';
        }
        if (this.tieneRol('rrhh')) {
            return 'RRHH (simulado)';
        }

        return this.esEmpleado() ? 'Empleado' : 'Usuario externo';
    }

    /**
     * Nombre del usuario para mostrar, con el mismo criterio que la cabecera
     * del resto de la app: nombres + apellidos, y si faltan, la cuenta o la
     * cedula.
     *
     * @returns Nombre visible; `Usuario` si la sesion no trae ninguno.
     */
    obtenerNombreUsuario(): string {
        const usuario = this.authService.getCurrentUser();
        const nombres = (usuario?.NOMBRES ?? '').trim();
        const apellidos = (usuario?.APELLIDOS ?? '').trim();
        const completo = (nombres + ' ' + apellidos).trim();

        return completo
            || (usuario?.CUENTA ?? '').trim()
            || (usuario?.CEDULA ?? '').trim()
            || 'Usuario';
    }

    /**
     * Iniciales para el avatar: primera letra del primer nombre y del
     * primer apellido (`Lucía Alejandra` + `Freire Ortiz` → `LF`). Si faltan
     * los apellidos, las dos primeras palabras del nombre visible.
     *
     * @returns Una o dos letras en mayuscula.
     */
    obtenerIniciales(): string {
        const usuario = this.authService.getCurrentUser();
        const nombre = (usuario?.NOMBRES ?? '').trim().split(/\s+/)[0] ?? '';
        const apellido = (usuario?.APELLIDOS ?? '').trim()
            .split(/\s+/)[0] ?? '';

        if (nombre !== '' && apellido !== '') {
            return (nombre[0] + apellido[0]).toUpperCase();
        }

        return this.obtenerNombreUsuario()
            .split(/\s+/)
            .filter((parte) => parte.length > 0)
            .slice(0, 2)
            .map((parte) => parte[0].toUpperCase())
            .join('');
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
