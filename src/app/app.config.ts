import { ApplicationConfig, inject, provideAppInitializer, provideZoneChangeDetection } from '@angular/core';
import { provideRouter, Router, withHashLocation } from '@angular/router';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { AuthService } from './services/auth.service';
import { solicitudInterceptor } from './interceptors/solicitudes.interceptor';
import { routes } from './app.routes';
// [PNIP-CI] Sebas Constante - 26/10/2026
// Qué hace: servicios simulados y su versión contra el backend.
import { AnalisisMockService } from './services/analisis-mock.service';
import { ConflictosMockService } from './services/conflictos-mock.service';
import { PlanesMockService } from './services/planes-mock.service';
import { HistorialMockService } from './services/historial-mock.service';
import { NotificacionesMockService } from './services/notificaciones-mock.service';
import { ConsultaPreviaMockService } from './services/consulta-previa-mock.service';
import { AnalisisHttpService } from './services/http/analisis-http.service';
import { ConflictosHttpService } from './services/http/conflictos-http.service';
import { PlanesHttpService } from './services/http/planes-http.service';
import { HistorialHttpService } from './services/http/historial-http.service';
import { NotificacionesHttpService } from './services/http/notificaciones-http.service';
import { ConsultaPreviaHttpService } from './services/http/consulta-previa-http.service';
import { PersonasMockService } from './services/personas-mock.service';
import { PersonasHttpService } from './services/http/personas-http.service';
import { proveerFuente } from './services/http/fuente-datos';
// [FIN PNIP-CI]
// [PNIP-CI] Elvis Flores - 27/10/2026
// Qué hace: servicio de los reportes en Excel y su versión contra el backend.
import { ReportesMockService } from './services/reportes-mock.service';
import { ReportesHttpService } from './services/http/reportes-http.service';
// [FIN PNIP-CI]
// [PNIP-CI DEV] Elvis Flores - 30/09/2026 - ELIMINAR ANTES DE PRODUCCIÓN
// Qué hace: import que solo usa la sesión simulada de desarrollo (ver el
// bloque [PNIP-CI DEV] más abajo). Se elimina junto con ese bloque.
import { environment } from '../environments/environment';
// [FIN PNIP-CI DEV]

export const appConfig: ApplicationConfig = {
  providers: [
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideRouter(routes, withHashLocation()),
    provideHttpClient(
      withInterceptors([solicitudInterceptor])
    ),
    // [PNIP-CI] Sebas Constante - 26/10/2026
    // Qué hace: con sesión real, las pantallas de gestión de conflictos leen
    // del backend; con la sesión simulada siguen con los datos simulados
    // (ver docs/INTEGRACION_BACKEND.md).
    proveerFuente(AnalisisMockService, AnalisisHttpService),
    proveerFuente(ConflictosMockService, ConflictosHttpService),
    proveerFuente(PlanesMockService, PlanesHttpService),
    proveerFuente(HistorialMockService, HistorialHttpService),
    proveerFuente(NotificacionesMockService, NotificacionesHttpService),
    proveerFuente(ConsultaPreviaMockService, ConsultaPreviaHttpService),
    proveerFuente(PersonasMockService, PersonasHttpService),
    // [FIN PNIP-CI]
    // [PNIP-CI] Elvis Flores - 27/10/2026
    // Qué hace: «Descargar Excel» de Análisis (RG.02) e Informe General
    // (RG.03): con sesión real, GET /conflictos/reporte; con la sesión
    // simulada avisa que solo está disponible con sesión real.
    proveerFuente(ReportesMockService, ReportesHttpService),
    // [FIN PNIP-CI]
    provideAppInitializer(() => {
      const authSrv = inject(AuthService);
      const router = inject(Router);

      // [PNIP-CI DEV] Elvis Flores - 30/09/2026 - ELIMINAR ANTES DE PRODUCCIÓN
      // Qué hace: sesión simulada de desarrollo local. Si está activa, se
      // salta toda la validación real de intranet de abajo. Apagada por
      // defecto y nunca activa en producción (ver docs/DESARROLLO_LOCAL.md).
      // Este initializer solo corre al CARGAR la página. Hay dos casos en
      // que la sesión simulada falta sin que la página se recargue:
      //   1. Se puso la bandera con la app ya abierta y se escribió una URL
      //      que solo cambia lo que va tras el '#' (el navegador no recarga).
      //   2. Se pasó por /login: su authGuard llama a logout() (lógica real,
      //      intencional) y eso borra los signals de la sesión simulada.
      // En ambos casos rolGuard/AppComponent ven isAuthenticated() = false y
      // mandan a /login. Este listener la reactiva en cada cambio de URL,
      // SOLO si la bandera está en 'true' Y no hay ninguna sesión (si hay
      // una sesión real, no la toca). Se registra antes que los listeners
      // del Router y de AppComponent, así que corre antes que los guards.
      if (!environment.production) {
        const reactivarSesionSimuladaDev = (): void => {
          if (localStorage.getItem('SISCI-DEV-SESION-SIMULADA') === 'true'
            && !authSrv.isAuthenticated()) {
            authSrv.activarSesionSimuladaDev(localStorage.getItem('SISCI-DEV-ROL') ?? 'R');
          }
        };
        window.addEventListener('popstate', reactivarSesionSimuladaDev);
        window.addEventListener('hashchange', reactivarSesionSimuladaDev);
      }
      if (!environment.production && localStorage.getItem('SISCI-DEV-SESION-SIMULADA') === 'true') {
        const rolDev = localStorage.getItem('SISCI-DEV-ROL') ?? 'R';
        authSrv.activarSesionSimuladaDev(rolDev);
        return Promise.resolve(true);
      }
      // [FIN PNIP-CI DEV]

      // Verificar directamente el localStorage para debugging
      const tokenDirectoLocalStorage = localStorage.getItem('TOKEN-INTRANET');
     
      
      // Intentar obtener token automáticamente desde URL, cookies o localStorage
      const tokenFromUrl = authSrv.obtenerTokenDesdeUrl();
      const tokenFromCookie = authSrv.obtenerTokenDesdeCookie();
      const tokenFromLocalStorage = authSrv.tokenIntranet();
      
     
      
      // Si el token está en localStorage pero no en el signal, actualizarlo
      if (tokenDirectoLocalStorage && !tokenFromLocalStorage) {
        authSrv.guardarTokenIntranet(tokenDirectoLocalStorage);
      }
      
      // Prioridad: URL > Cookie > localStorage directo > localStorage del signal
      let tokenParaValidar: string | null = null;
      let fuenteToken = '';
      
      if (tokenFromUrl) {
        tokenParaValidar = tokenFromUrl;
        fuenteToken = 'URL';
        authSrv.guardarTokenIntranet(tokenFromUrl);
      } else if (tokenFromCookie) {
        tokenParaValidar = tokenFromCookie;
        fuenteToken = 'Cookie';
        authSrv.guardarTokenIntranet(tokenFromCookie);
      } else if (tokenDirectoLocalStorage) {
        // Usar el token directamente del localStorage si está disponible
        tokenParaValidar = tokenDirectoLocalStorage;
        fuenteToken = 'localStorage (directo)';
        // Asegurarse de que el signal también tenga el token
        if (!tokenFromLocalStorage) {
          authSrv.guardarTokenIntranet(tokenDirectoLocalStorage);
        }
      } else if (tokenFromLocalStorage) {
        tokenParaValidar = tokenFromLocalStorage;
        fuenteToken = 'localStorage (signal)';
        // El token ya está guardado, no necesitamos guardarlo de nuevo
      }
      
      if (tokenParaValidar) {
        return authSrv
          .obtenerHuella()
          .then(() => {
            return firstValueFrom(authSrv.validarTokenIntranet());
          })
          .then((isValid) => {
            if (!isValid) {
              authSrv.logout();
            } else {
              console.log(`Token válido. Usuario autenticado.`);
            }
            return isValid;
          })
          .catch((err) => {
            console.error(`Error al validar token :`, err);
            return false;
          });
      }

      // Sin token de Intranet puede haber igualmente una sesion valida de
      // SISCI: es el caso de los usuarios externos, que entran con cedula y
      // clave temporal y solo tienen TOKEN-SISCI. Antes se los mandaba a
      // /login, y como el guard de esa ruta hace logout(), cualquier recarga
      // de pagina les borraba la sesion.
      if (authSrv.isAuthenticated()) {
        return Promise.resolve(true);
      }

      // Ahora si: no hay sesion de ningun tipo.
      router.navigate(['/login'], { replaceUrl: true });
      return Promise.resolve(false);
    })
  ]
};
