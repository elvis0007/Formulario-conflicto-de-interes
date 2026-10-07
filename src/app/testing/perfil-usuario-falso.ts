import { Provider } from '@angular/core';
import { RolGestion } from '../models/rol-gestion';
import { PerfilUsuarioService } from '../services/perfil-usuario.service';

/**
 * Doble de prueba de `PerfilUsuarioService`: roles, empleado y nombre fijos,
 * sin `AuthService` ni `HttpClient`. Solo para specs.
 *
 * @author Elvis Flores
 */
export class PerfilUsuarioFalso {
  constructor(
    public roles: RolGestion[] = ['rrhh'],
    public empleadoId: string | null = 'EMP-008',
    public nombre = 'Lucía Fernanda Paredes Cando'
  ) {}

  /** @returns Roles fijados. */
  obtenerRoles(): RolGestion[] {
    return [...this.roles];
  }

  /**
   * @param rol Rol a consultar.
   * @returns `true` si lo tiene.
   */
  tieneRol(rol: RolGestion): boolean {
    return this.roles.includes(rol);
  }

  /** @returns Empleado fijado. */
  obtenerEmpleadoActualId(): string | null {
    return this.empleadoId;
  }

  /** @returns Nombre fijado. */
  obtenerNombreUsuario(): string {
    return this.nombre;
  }
}

/**
 * @param perfil Doble a usar.
 * @returns Proveedor que reemplaza a `PerfilUsuarioService`.
 * @author Elvis Flores
 */
export function proveerPerfilFalso(perfil: PerfilUsuarioFalso): Provider {
  return { provide: PerfilUsuarioService, useValue: perfil };
}
