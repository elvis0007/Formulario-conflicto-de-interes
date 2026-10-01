import { Component, OnInit, OnDestroy, inject } from '@angular/core';
import { Router, NavigationEnd, RouterOutlet } from '@angular/router';
import { CommonModule, Location } from '@angular/common';
import { Subscription } from 'rxjs';
import { filter } from 'rxjs/operators';
import { FooterComponent } from './footer/footer.component';
import { HeaderComponent } from './header/header.component';
import { AuthService } from './services/auth.service';
import { esRutaPermitida } from './app.routes';
import { esRutaDeGestion } from './app.paths';
import { SidebarMenuComponent } from './sidebar-menu/sidebar-menu.component';

@Component({
  selector: 'app-root',
  imports: [CommonModule, RouterOutlet, HeaderComponent, FooterComponent, SidebarMenuComponent],
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
  // PNIP-CI: en /rrhh/** y /responsable/** el layout pinta el menú lateral
  // real junto al contenido (en /admin lo sigue pintando AdminComponent).
  esRutaGestion: boolean = false;
  puedeVerListaFormularios: boolean = false;

  ngOnInit(): void {
    // Intentar obtener token automáticamente al iniciar
    this.intentarAutenticacionAutomatica();
    
    this.currentUrl = this.location.path();
    this.esLoginRoute = this.currentUrl.startsWith('/login');
    this.actualizarMenuGestion(this.currentUrl);

    this.navigationSubscription = this.router.events
      .pipe(filter(event => event instanceof NavigationEnd))
      .subscribe((event: any) => {
        const url = (event.urlAfterRedirects || event.url).split('?')[0];
        this.currentUrl = url;
        this.esLoginRoute = url.startsWith('/login');
        this.actualizarMenuGestion(url);
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
      } else if (!esRutaPermitida(url) && !url.startsWith('/admin')) {
        rutaPermitida = esAdminOJefeRRHH ? '/admin' : '/';
      }

      if (rutaPermitida && rutaPermitida !== url) {
        event.preventDefault();
        this.location.replaceState(rutaPermitida);
        setTimeout(() => {
          this.router.navigateByUrl(rutaPermitida!, { replaceUrl: true });
        }, 0);
      } else if (rutaPermitida === null && url !== this.currentUrl && !esRutaPermitida(url)) {
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

  // PNIP-CI: decide si se pinta el menú lateral real en esta ruta y si
  // muestra «Ver Formularios» (mismo criterio que AdminComponent: A o R).
  private actualizarMenuGestion(url: string): void {
    this.esRutaGestion = esRutaDeGestion(url.split('?')[0]);
    this.puedeVerListaFormularios = this.authService.hasRole('A') || this.authService.hasRole('R');
  }

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

    if (!esRutaPermitida(urlSinQuery) && !urlSinQuery.startsWith('/admin')) {
      const rutaCorrecta = esAdminOJefeRRHH ? '/admin' : '/';
      this.router.navigate([rutaCorrecta], { replaceUrl: true });
    }
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
