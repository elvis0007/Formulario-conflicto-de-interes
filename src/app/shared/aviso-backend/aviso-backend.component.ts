import { DOCUMENT } from '@angular/common';
import { Component, InjectionToken, inject } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { AvisosBackendService } from '../../services/http/avisos-backend.service';

/**
 * Recarga la pagina actual. Es un token para poder reemplazarlo en las
 * pruebas (`location.reload` no se puede espiar).
 *
 * @author Elvis Flores
 */
export const RECARGAR_PAGINA = new InjectionToken<() => void>('RECARGAR_PAGINA', {
  providedIn: 'root',
  factory: () => {
    const ventana = inject(DOCUMENT).defaultView;

    return () => ventana?.location.reload();
  }
});

/**
 * Aviso flotante de un error general del backend (`AvisosBackendService`):
 *
 * - sesion vencida: «Iniciar sesión» cierra la sesion y va a `/login`;
 * - sin conexion: «Reintentar» recarga la pantalla actual;
 * - sin permiso: solo se cierra.
 *
 * Va una sola vez en `app.component.html`.
 *
 * @author Elvis Flores
 */
@Component({
  selector: 'app-aviso-backend',
  templateUrl: './aviso-backend.component.html',
  styleUrl: './aviso-backend.component.scss'
})
export class AvisoBackendComponent {
  private readonly avisos = inject(AvisosBackendService);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly recargarPagina = inject(RECARGAR_PAGINA);

  /** Aviso vigente. */
  readonly aviso = this.avisos.aviso;

  /**
   * «Iniciar sesión»: cierra la sesion vencida y va al login.
   *
   * @author Elvis Flores
   */
  iniciarSesion(): void {
    this.avisos.cerrar();
    this.auth.logout();
    this.router.navigate(['/login']);
  }

  /**
   * «Reintentar»: recarga la pantalla, que vuelve a pedir sus listas.
   *
   * @author Elvis Flores
   */
  reintentar(): void {
    this.avisos.cerrar();
    this.recargarPagina();
  }

  /**
   * Cierra el aviso.
   *
   * @author Elvis Flores
   */
  cerrar(): void {
    this.avisos.cerrar();
  }
}
