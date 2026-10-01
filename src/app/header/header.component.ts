// [PNIP-CI] Elvis Flores - 01/10/2026
// Qué hace: al import de @angular/core se agregan computed e inject.
import { Component, OnInit, computed, effect, inject } from '@angular/core';
// [FIN PNIP-CI]
import { CommonModule } from '@angular/common';
import { NavigationEnd, Router } from '@angular/router';
import { filter } from 'rxjs/operators';
import { AuthService } from '../services/auth.service';
// [PNIP-CI] Elvis Flores - 01/10/2026
// Qué hace: perfil del usuario (nombre y rol en texto), rutas de gestión
// de conflictos y campana de notificaciones.
import { PerfilUsuarioService } from '../services/perfil-usuario.service';
import { RUTAS, esRutaDeGestion } from '../app.paths';
import { NotificationBellComponent } from '../shared/notification-bell/notification-bell.component';
// [FIN PNIP-CI]

@Component({
  selector: 'app-header',
  standalone: true,
  // [PNIP-CI] Elvis Flores - 01/10/2026
  // Qué hace: agrega NotificationBellComponent a los imports.
  imports: [CommonModule, NotificationBellComponent],
  // [FIN PNIP-CI]
  templateUrl: './header.component.html',
  styleUrl: './header.component.scss'
})
export class HeaderComponent implements OnInit {
  darkMode = false;
  isAdminRoute = false;
  canManageRRHH = false;
  isAdminOrRrhh = false;
  isRegularUser = false;
  loggedUserFullName = '';
  loggedUserShortName = '';

  // [PNIP-CI] Elvis Flores - 01/10/2026
  // Qué hace: datos de la cabecera para la gestión de conflictos: quién
  // está logueado y con qué rol, si la ruta es de gestión (/rrhh/** o
  // /responsable/**) y si el usuario es Responsable (rol P).
  private readonly perfilUsuario = inject(PerfilUsuarioService);

  /** Hay un usuario en sesión (si no, no se muestra el bloque de usuario). */
  readonly haySesion = computed(() => this.authService.usuario() !== null);

  /** Nombre del usuario logueado (`PerfilUsuarioService`). */
  readonly nombreUsuarioSesion = computed(() => this.perfilUsuario.obtenerNombreUsuario());

  /** Rol en texto; con varios roles, el de mayor nivel (A > R > P). */
  readonly etiquetaRolSesion = computed(() => this.perfilUsuario.obtenerEtiquetaRol());

  /** La URL actual es /rrhh/** o /responsable/**. */
  esRutaGestion = false;

  /** El usuario tiene el rol P (Responsable). */
  esResponsable = false;

  /** Campana de notificaciones: solo para A, R o P. */
  muestraCampana = false;
  // [FIN PNIP-CI]

  constructor(
    private authService: AuthService,
    private router: Router
  ) {
    effect(() => {
      const usuario = this.authService.usuario();
      if (!usuario) {
        this.loggedUserFullName = '';
        this.loggedUserShortName = '';
        return;
      }
      const cuenta = (usuario.CUENTA || usuario.DSGUS_CUENTA || '').trim();
      const nombres = (usuario.NOMBRES || '').trim();
      const apellidos = (usuario.APELLIDOS || '').trim();
      const cedula = (usuario.CEDULA || '').trim();
      const nombreCompleto = `${apellidos} ${nombres}`.trim() || nombres;

      // Nombre completo para pantallas grandes; usuario corto para móviles
      this.loggedUserFullName = nombreCompleto || cuenta || cedula || '';
      this.loggedUserShortName = cuenta || this.loggedUserFullName;
    });
  }

  ngOnInit(): void {
    const savedMode = localStorage.getItem('darkMode');
    if (savedMode) {
      this.darkMode = savedMode === 'true';
    }
    this.applyDarkMode();

    // Inicializar inmediatamente (en recargas directas a /admin no hay NavigationEnd previo)
    this.isAdminRoute = this.router.url.startsWith('/admin');
    this.canManageRRHH = this.authService.isAdminRole();
    this.isAdminOrRrhh = this.authService.hasRole('A') || this.authService.hasRole('R');
    this.isRegularUser = !this.isAdminOrRrhh;
    // [PNIP-CI] Elvis Flores - 01/10/2026
    // Qué hace: estado de la cabecera para la gestión de conflictos en la
    // URL inicial.
    this.actualizarCabeceraGestion(this.router.url);
    // [FIN PNIP-CI]

    this.router.events
      .pipe(filter((event): event is NavigationEnd => event instanceof NavigationEnd))
      .subscribe((event: NavigationEnd) => {
        this.isAdminRoute = event.urlAfterRedirects.startsWith('/admin');
        this.canManageRRHH = this.authService.isAdminRole();
        this.isAdminOrRrhh = this.authService.hasRole('A') || this.authService.hasRole('R');
        this.isRegularUser = !this.isAdminOrRrhh;
        // [PNIP-CI] Elvis Flores - 01/10/2026
        // Qué hace: estado de la cabecera para la gestión de conflictos en
        // cada navegación.
        this.actualizarCabeceraGestion(event.urlAfterRedirects);
        // [FIN PNIP-CI]
      });
  }

  // [PNIP-CI] Elvis Flores - 01/10/2026
  // Qué hace: estado de la cabecera para la gestión de conflictos (ruta,
  // rol P y campana) y acceso del Responsable a su dashboard.
  /**
   * Actualiza `esRutaGestion`, `esResponsable` y `muestraCampana` para
   * una URL.
   *
   * @param url URL actual (puede traer query string).
   * @author Elvis Flores
   */
  private actualizarCabeceraGestion(url: string): void {
    this.esRutaGestion = esRutaDeGestion(url.split('?')[0]);
    this.esResponsable = this.authService.hasRole('P');
    this.muestraCampana = this.esResponsable
      || this.authService.hasRole('A')
      || this.authService.hasRole('R');
  }

  /**
   * Lleva al Responsable a su dashboard de actividades de conflicto de
   * interés.
   *
   * @author Elvis Flores
   */
  irAMisActividades(): void {
    this.router.navigate([RUTAS.responsable.dashboard]);
  }
  // [FIN PNIP-CI]

  toggleDarkMode(): void {
    this.darkMode = !this.darkMode;
    localStorage.setItem('darkMode', this.darkMode.toString());
    this.applyDarkMode();
  }

  goToConflictForm(): void {
    this.router.navigate(['/']);
  }

  goToAdmin(): void {
    this.router.navigate(['/admin']);
  }

  private applyDarkMode(): void {
    if (this.darkMode) {
      document.body.classList.add('dark-mode');
    } else {
      document.body.classList.remove('dark-mode');
    }
  }

  /** Abre el historial de declaraciones del propio usuario. */
  verMisFormularios(): void {
    this.router.navigate(['/mis-formularios']);
  }

  logout(): void {
    this.authService.logout();
    window.location.href = 'https://app.eeasa.com.ec/intranet#/inicio';
  }

  openGenerateCodeModal(): void {
    this.router.navigate(['/admin'], {
      queryParams: { abrirCodigo: '1' },
      queryParamsHandling: 'merge'
    });
  }

  openManageRrhhModal(): void {
    this.router.navigate(['/admin'], {
      queryParams: { abrirRoles: '1' },
      queryParamsHandling: 'merge'
    });
  }
}

