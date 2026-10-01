import { Component, OnInit, OnDestroy, inject } from '@angular/core';
import { Router, NavigationEnd, RouterOutlet } from '@angular/router';
import { CommonModule, Location } from '@angular/common';
import { Subscription } from 'rxjs';
import { filter } from 'rxjs/operators';
import { FooterComponent } from './footer/footer.component';
import { HeaderComponent } from './header/header.component';
import { AuthService } from './services/auth.service';
// [PNIP-CI] Elvis Flores - 01/10/2026
// Qué hace: imports para reconocer las rutas de gestión de conflictos
// (reemplaza el import de RUTAS_PERMITIDAS) y pintar el menú lateral en ellas.
import { esRutaPermitida } from './app.routes';
import { esRutaDeGestion } from './app.paths';
import { SidebarMenuComponent } from './sidebar-menu/sidebar-menu.component';
// [FIN PNIP-CI]

@Component({
  selector: 'app-root',
  // [PNIP-CI] Elvis Flores - 30/09/2026
  // Qué hace: agrega SidebarMenuComponent a los imports.
  imports: [CommonModule, RouterOutlet, HeaderComponent, FooterComponent, SidebarMenuComponent],
  // [FIN PNIP-CI]
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss'
})
export class AppComponent implements OnInit, OnDestroy {
  title = 'Formulario-Conflicto-Interes';
  private router = inject(Router);
  private location = inject(Location);
  private authService = inject(AuthService);
  private navigationSubscription?: Subscription;
  private popStateHandler?: (event: PopStateEvent) => void;
  private currentUrl: string = '';
  esLoginRoute: boolean = false;
  // [PNIP-CI] Elvis Flores - 30/09/2026
  // Qué hace: en /rrhh/** y /responsable/** el layout pinta el menú lateral
  // real junto al contenido (en /admin lo sigue pintando AdminComponent).
  esRutaGestion: boolean = false;
  puedeVerListaFormularios: boolean = false;
  // [FIN PNIP-CI]

  ngOnInit(): void {
    // Intentar obtener token automáticamente al iniciar
    this.intentarAutenticacionAutomatica();
    
    this.currentUrl = this.location.path();
    this.esLoginRoute = this.currentUrl.startsWith('/login');
    // [PNIP-CI] Elvis Flores - 30/09/2026
    // Qué hace: decide si se pinta el menú lateral en la URL inicial.
    this.actualizarMenuGestion(this.currentUrl);
    // [FIN PNIP-CI]

    this.navigationSubscription = this.router.events
      .pipe(filter(event => event instanceof NavigationEnd))
      .subscribe((event: any) => {
        const url = (event.urlAfterRedirects || event.url).split('?')[0];
        this.currentUrl = url;
        this.esLoginRoute = url.startsWith('/login');
        // [PNIP-CI] Elvis Flores - 30/09/2026
        // Qué hace: decide si se pinta el menú lateral en cada navegación.
        this.actualizarMenuGestion(url);
        // [FIN PNIP-CI]
        this.validarYRederigirRuta(url);
      });

    this.validarYRederigirRuta(this.currentUrl);

    this.popStateHandler = (event: PopStateEvent) => {
      const url = this.location.path().split('?')[0];

      if (!this.authService.isAuthenticated()) {
        if (url !== '/login') {
          event.preventDefault();
          this.location.replaceState('/login');
          setTimeout(() => {
            this.router.navigateByUrl('/login', { replaceUrl: true });
          }, 0);
        }
        return;
      }

      const tieneRolAdmin = this.authService.hasRole('A');
      const tieneRolJefeRRHH = this.authService.hasRole('R');
      const esAdminOJefeRRHH = tieneRolAdmin || tieneRolJefeRRHH;

      let rutaPermitida: string | null = null;

      if (url.startsWith('/login')) {
        rutaPermitida = esAdminOJefeRRHH ? '/admin' : '/';
      } else if (url === '/' || url === '') {
        if (esAdminOJefeRRHH) {
          rutaPermitida = '/admin';
        } else {
          rutaPermitida = '/';
        }
      } else if (url.startsWith('/admin')) {
        if (!esAdminOJefeRRHH) {
          rutaPermitida = '/';
        } else {
          rutaPermitida = '/admin';
        }
      // [PNIP-CI] Elvis Flores - 01/10/2026
      // Qué hace: esRutaPermitida() acepta RUTAS_PERMITIDAS (igual que el
      // rutasPermitidas.includes() al que reemplaza) y además /rrhh/** y
      // /responsable/**, cuyo acceso controla rolGuard.
      } else if (!esRutaPermitida(url) && !url.startsWith('/admin')) {
        rutaPermitida = esAdminOJefeRRHH ? '/admin' : '/';
      }
      // [FIN PNIP-CI]

      if (rutaPermitida && rutaPermitida !== url) {
        event.preventDefault();
        this.location.replaceState(rutaPermitida);
        setTimeout(() => {
          this.router.navigateByUrl(rutaPermitida!, { replaceUrl: true });
        }, 0);
      // [PNIP-CI] Elvis Flores - 01/10/2026
      // Qué hace: la misma comprobación con esRutaPermitida() (ver arriba).
      } else if (rutaPermitida === null && url !== this.currentUrl && !esRutaPermitida(url)) {
      // [FIN PNIP-CI]
        event.preventDefault();
        const rutaCorrecta = esAdminOJefeRRHH ? '/admin' : '/';
        this.location.replaceState(rutaCorrecta);
        setTimeout(() => {
          this.router.navigateByUrl(rutaCorrecta, { replaceUrl: true });
        }, 0);
      }
    };

    window.addEventListener('popstate', this.popStateHandler);
  }

  // [PNIP-CI] Elvis Flores - 30/09/2026
  // Qué hace: decide si se pinta el menú lateral real en esta ruta y si
  // muestra «Ver Formularios» (mismo criterio que AdminComponent: A o R).
  /**
   * Actualiza `esRutaGestion` y `puedeVerListaFormularios` para una URL.
   *
   * @param url URL actual (puede traer query string).
   * @author Elvis Flores
   */
  private actualizarMenuGestion(url: string): void {
    this.esRutaGestion = esRutaDeGestion(url.split('?')[0]);
    this.puedeVerListaFormularios = this.authService.hasRole('A') || this.authService.hasRole('R');
  }
  // [FIN PNIP-CI]

  private validarYRederigirRuta(url: string): void {
    const urlSinQuery = url.split('?')[0];

    if (!this.authService.isAuthenticated()) {
      if (urlSinQuery !== '/login') {
        this.router.navigate(['/login'], { replaceUrl: true });
      }
      return;
    }

    const tieneRolAdmin = this.authService.hasRole('A');
    const tieneRolJefeRRHH = this.authService.hasRole('R');
    const esAdminOJefeRRHH = tieneRolAdmin || tieneRolJefeRRHH;

    if (urlSinQuery.startsWith('/login')) {
      const rutaCorrecta = esAdminOJefeRRHH ? '/admin' : '/';
      if (urlSinQuery !== rutaCorrecta) {
        this.router.navigate([rutaCorrecta], { replaceUrl: true });
      }
      return;
    }

    if (urlSinQuery === '/' || urlSinQuery === '') {
      if (esAdminOJefeRRHH) {
        this.router.navigate(['/admin'], { replaceUrl: true });
      }
      return;
    }

    if (urlSinQuery.startsWith('/admin')) {
      if (!esAdminOJefeRRHH) {
        this.router.navigate(['/'], { replaceUrl: true });
      }
      return;
    }

    // [PNIP-CI] Elvis Flores - 01/10/2026
    // Qué hace: esRutaPermitida() acepta RUTAS_PERMITIDAS (igual que el
    // rutasPermitidas.includes() al que reemplaza) y además /rrhh/** y
    // /responsable/**, cuyo acceso controla rolGuard.
    if (!esRutaPermitida(urlSinQuery) && !urlSinQuery.startsWith('/admin')) {
      const rutaCorrecta = esAdminOJefeRRHH ? '/admin' : '/';
      this.router.navigate([rutaCorrecta], { replaceUrl: true });
    }
    // [FIN PNIP-CI]
  }

  private intentarAutenticacionAutomatica(): void {
    // Si ya está autenticado, no hacer nada
    if (this.authService.isAuthenticated()) {
      return;
    }

    // Intentar obtener token desde URL o cookies
    const tokenFromUrl = this.authService.obtenerTokenDesdeUrl();
    const tokenFromCookie = this.authService.obtenerTokenDesdeCookie();
    
    if (tokenFromUrl || tokenFromCookie) {
      const token = tokenFromUrl || tokenFromCookie;
      if (token) {
        this.authService.guardarTokenIntranet(token);
        
        // Validar el token automáticamente
        this.authService.obtenerHuella().then(() => {
          this.authService.validarTokenIntranet().subscribe({
            next: (success: boolean) => {
              if (success) {
                // Redirigir según el rol del usuario
                const tieneRolAdmin = this.authService.hasRole('A');
                const tieneRolJefeRRHH = this.authService.hasRole('R');
                const ruta = (tieneRolAdmin || tieneRolJefeRRHH) ? '/admin' : '/';
                this.router.navigate([ruta], { replaceUrl: true });
              }
            },
            error: () => {
              // Si falla la validación, ir al login
              this.router.navigate(['/login'], { replaceUrl: true });
            }
          });
        });
      }
    }
  }

  ngOnDestroy(): void {
    if (this.navigationSubscription) {
      this.navigationSubscription.unsubscribe();
    }
    if (this.popStateHandler) {
      window.removeEventListener('popstate', this.popStateHandler);
    }
  }
}
