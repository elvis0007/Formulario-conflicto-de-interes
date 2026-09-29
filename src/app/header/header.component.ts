import { Component, OnInit, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NavigationEnd, Router } from '@angular/router';
import { filter } from 'rxjs/operators';
import { AuthService } from '../services/auth.service';

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [CommonModule],
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

    this.router.events
      .pipe(filter((event): event is NavigationEnd => event instanceof NavigationEnd))
      .subscribe((event: NavigationEnd) => {
        this.isAdminRoute = event.urlAfterRedirects.startsWith('/admin');
        this.canManageRRHH = this.authService.isAdminRole();
        this.isAdminOrRrhh = this.authService.hasRole('A') || this.authService.hasRole('R');
        this.isRegularUser = !this.isAdminOrRrhh;
      });
  }

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

