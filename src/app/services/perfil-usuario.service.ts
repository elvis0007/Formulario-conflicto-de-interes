import { Injectable, inject } from '@angular/core';
import { environment } from '../../environments/environment';
import { AuthService } from './auth.service';
import { RolGestion } from '../models';
import { RUTAS } from '../app.paths';
import { EMPLEADO_SIMULADO_POR_DEFECTO } from './mock-data/personas.data';

/** Abreviaturas de rol del backend que dan acceso a la parte de RRHH. */
const ROLES_BACKEND_RRHH: readonly string[] = ['R', 'A'];

/**
 * Abreviatura del rol del backend que da acceso a la parte de Responsable
 * (se asigna a quien recibe actividades en un plan de accion).
 */
const ROL_BACKEND_RESPONSABLE = 'P';

/**
 * Abreviatura del rol de usuario externo (entra con cedula y clave
 * temporal). Solo se usa para la etiqueta del rol.
 */
const ROL_BACKEND_EXTERNO = 'E';

/** Ruta de inicio del resto de la app, para quien no tiene acceso. */
const RUTA_FUERA_DEL_MODULO = '/';

/**
 * Clave de `localStorage` para elegir que empleado de los datos de ejemplo
 * esta usando la app (p. ej. `EMP-004`).
 */
const CLAVE_EMPLEADO_SIMULADO = 'SISCI-DEV-EMPLEADO';

/** Clave de `localStorage` que activa la sesion simulada de desarrollo. */
const CLAVE_SESION_SIMULADA = 'SISCI-DEV-SESION-SIMULADA';

/** Pantalla de inicio de RRHH. */
const RUTA_INICIO_RRHH = RUTAS.rrhh.dashboard;

/** Pantalla de inicio del Responsable (rol `P`). */
const RUTA_INICIO_RESPONSABLE = RUTAS.responsable.dashboard;

/**
 * Traduce la sesion del usuario a la gestión de conflictos: sus roles
 * (`rrhh` y/o `responsable`) y su identificador de empleado.
 *
 * - Rol: `R` (Jefe de RRHH) y `A` (Administrador) se tratan como `rrhh`,
 *   igual que en el resto de la app; `P` es `responsable`. Siempre se consulta
 *   `AuthService.hasRole()`, en desarrollo y en produccion: para probar
 *   otro rol en local se usa la sesion simulada de `AuthService`
 *   (`SISCI-DEV-SESION-SIMULADA` + `SISCI-DEV-ROL`, ver
 *   docs/DESARROLLO_LOCAL.md), no un atajo propio del modulo.
 * - Empleado: se usa para saber de que actividades es responsable. Fuera
 *   de produccion se puede elegir desde `localStorage`
 *   (`SISCI-DEV-EMPLEADO`); en produccion no se aplica nunca.
 *
 * @author Elvis Flores
 */
@Injectable({
  providedIn: 'root'
})
export class PerfilUsuarioService {
  private readonly authService = inject(AuthService);

  /**
   * Devuelve los roles de gestión de conflictos del usuario actual.
   *
   * - `rrhh` con `R` o `A`.
   * - `responsable` con `P`.
   *
   * @returns Lista de roles (los dos si tiene ambos); vacia si no tiene
   * ninguno.
   */
  obtenerRoles(): RolGestion[] {
    const roles: RolGestion[] = [];

    if (ROLES_BACKEND_RRHH.some((rol) => this.authService.hasRole(rol))) {
      roles.push('rrhh');
    }
    if (this.authService.hasRole(ROL_BACKEND_RESPONSABLE)) {
      roles.push('responsable');
    }

    return roles;
  }

  /**
   * Indica si el usuario actual tiene un rol del modulo.
   *
   * @param rol Rol a comprobar.
   * @returns `true` si el usuario tiene ese rol.
   */
  tieneRol(rol: RolGestion): boolean {
    return this.obtenerRoles().includes(rol);
  }

  /**
   * Pantalla a la que debe ir el usuario al entrar a la gestión de
   * conflictos, o al ser rechazado por `rolGuard`:
   * - Con `R` o `A` (aunque tambien tenga `P`) → dashboard de RRHH.
   * - Solo con `P` → dashboard de responsable.
   * - Sin ninguno → `/` (fuera de la gestión de conflictos).
   *
   * Nunca apunta a una ruta que el guard vaya a rechazar, para no crear un
   * bucle de redirecciones.
   *
   * @returns Ruta absoluta de la pantalla de inicio.
   */
  obtenerRutaInicio(): string {
    if (this.tieneRol('rrhh')) {
      return RUTA_INICIO_RRHH;
    }
    if (this.tieneRol('responsable')) {
      return RUTA_INICIO_RESPONSABLE;
    }

    return RUTA_FUERA_DEL_MODULO;
  }

  /**
   * Texto del rol del usuario, para la cabecera. Si tiene varios, el de
   * mayor nivel: `A` > `R` > `P`.
   *
   * @returns `Administrador`, `Jefe de RRHH`, `Responsable`,
   * `Usuario externo` o `Empleado`.
   */
  obtenerEtiquetaRol(): string {
    if (this.authService.hasRole('A')) {
      return 'Administrador';
    }
    if (this.authService.hasRole('R')) {
      return 'Jefe de RRHH';
    }
    if (this.authService.hasRole(ROL_BACKEND_RESPONSABLE)) {
      return 'Responsable';
    }

    return this.authService.hasRole(ROL_BACKEND_EXTERNO)
      ? 'Usuario externo'
      : 'Empleado';
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
   * - Fuera de produccion: el de `SISCI-DEV-EMPLEADO` o, si no hay,
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
   * Indica si la app usa la sesion simulada de desarrollo
   * (`SISCI-DEV-SESION-SIMULADA`, ver docs/DESARROLLO_LOCAL.md). En
   * produccion siempre es `false`.
   *
   * @returns `true` con la sesion simulada activa.
   * @author Elvis Flores
   */
  esSesionSimulada(): boolean {
    return !environment.production && this.leerLocalStorage(CLAVE_SESION_SIMULADA) === 'true';
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
        '[PerfilUsuarioService.leerLocalStorage] No se pudo leer '
        + clave + ':',
        err
      );
      return null;
    }
  }
}
