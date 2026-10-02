// [PNIP-CI DEV] Elvis Flores - 02/10/2026 - ELIMINAR ANTES DE PRODUCCIÓN
// Qué hace: panel flotante para cambiar el rol de la sesión simulada de
// desarrollo (A, R, P, R+P) o salir de ella. Este archivo completo se
// elimina junto con la sesión simulada (ver docs/DESARROLLO_LOCAL.md).
import { Component } from '@angular/core';
import { environment } from '../../../environments/environment';

/** Clave que activa la sesión simulada. */
const CLAVE_SESION = 'SISCI-DEV-SESION-SIMULADA';

/** Clave con el rol o roles simulados ('R', 'R,P'...). */
const CLAVE_ROL = 'SISCI-DEV-ROL';

/** Clave con el empleado simulado (qué actividades ve el Responsable). */
const CLAVE_EMPLEADO = 'SISCI-DEV-EMPLEADO';

/** Rol que usa la sesión simulada cuando no hay SISCI-DEV-ROL. */
const ROL_POR_DEFECTO = 'R';

/** Opción del selector. */
interface OpcionRol {
  /** Texto del botón. */
  etiqueta: string;
  /** Valor que se guarda en SISCI-DEV-ROL. */
  valor: string;
  /** Descripción para el title y el lector de pantalla. */
  descripcion: string;
}

/** Roles que se pueden elegir. */
const OPCIONES: readonly OpcionRol[] = [
  { etiqueta: 'A', valor: 'A', descripcion: 'Administrador' },
  { etiqueta: 'R', valor: 'R', descripcion: 'Jefe de RRHH' },
  { etiqueta: 'P', valor: 'P', descripcion: 'Responsable' },
  { etiqueta: 'R+P', valor: 'R,P', descripcion: 'Jefe de RRHH y Responsable' }
];

/**
 * Selector de rol para desarrollo local.
 *
 * Solo se pinta si `environment.production` es `false` **y**
 * `SISCI-DEV-SESION-SIMULADA` vale `'true'`. Al elegir un rol guarda
 * `SISCI-DEV-ROL` y recarga la página (la sesión simulada lee el rol al
 * cargar). «Salir de la simulación» borra las claves `SISCI-DEV-*` y
 * recarga, así que la app vuelve a su comportamiento real.
 *
 * @author Elvis Flores
 */
@Component({
  selector: 'app-selector-rol-dev',
  templateUrl: './selector-rol-dev.component.html',
  styleUrl: './selector-rol-dev.component.scss'
})
export class SelectorRolDevComponent {
  /** Opciones de rol. */
  readonly opciones = OPCIONES;

  /** Si el panel se muestra (solo desarrollo con la sesión simulada). */
  readonly activo: boolean = !environment.production
    && this.leer(CLAVE_SESION) === 'true';

  /** Rol simulado actual, normalizado ('R,P'). */
  readonly rolActual: string = this.normalizar(this.leer(CLAVE_ROL) ?? ROL_POR_DEFECTO);

  /**
   * @param opcion Opción del selector.
   * @returns `true` si es el rol simulado actual.
   */
  esActual(opcion: OpcionRol): boolean {
    return this.normalizar(opcion.valor) === this.rolActual;
  }

  /**
   * Guarda el rol elegido y recarga la página.
   *
   * @param opcion Opción elegida.
   */
  elegir(opcion: OpcionRol): void {
    try {
      localStorage.setItem(CLAVE_ROL, opcion.valor);
    } catch (err) {
      console.error('[SelectorRolDevComponent.elegir] No se pudo guardar el rol:', err);
      return;
    }
    this.recargar();
  }

  /**
   * Borra las claves SISCI-DEV-* y recarga la página.
   */
  salir(): void {
    try {
      localStorage.removeItem(CLAVE_SESION);
      localStorage.removeItem(CLAVE_ROL);
      localStorage.removeItem(CLAVE_EMPLEADO);
    } catch (err) {
      console.error('[SelectorRolDevComponent.salir] No se pudieron borrar las claves:', err);
      return;
    }
    this.recargar();
  }

  /**
   * Recarga la página. Separado para poder probarlo sin recargar.
   */
  recargar(): void {
    window.location.reload();
  }

  /**
   * Lee una clave de localStorage sin propagar errores.
   *
   * @param clave Clave a leer.
   * @returns Valor guardado, o `null` si no existe o no se pudo leer.
   */
  private leer(clave: string): string | null {
    try {
      return localStorage.getItem(clave);
    } catch (err) {
      console.error('[SelectorRolDevComponent.leer] No se pudo leer ' + clave + ':', err);
      return null;
    }
  }

  /**
   * Normaliza una lista de roles para compararla ('P, R' → 'P,R').
   *
   * @param roles Roles separados por coma.
   * @returns Roles sin espacios, en mayúscula y ordenados.
   */
  private normalizar(roles: string): string {
    return roles.split(',')
      .map((r) => r.trim().toUpperCase())
      .filter((r) => r !== '')
      .sort()
      .join(',');
  }
}
// [FIN PNIP-CI DEV]
