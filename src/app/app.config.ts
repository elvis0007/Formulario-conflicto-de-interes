import { ApplicationConfig, inject, provideAppInitializer, provideZoneChangeDetection } from '@angular/core';
import { provideRouter, Router, withHashLocation } from '@angular/router';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { AuthService } from './services/auth.service';
import { solicitudInterceptor } from './interceptors/solicitudes.interceptor';
import { routes } from './app.routes';

export const appConfig: ApplicationConfig = {
  providers: [
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideRouter(routes, withHashLocation()),
    provideHttpClient(
      withInterceptors([solicitudInterceptor])
    ),
    provideAppInitializer(() => {
      const authSrv = inject(AuthService);
      const router = inject(Router);


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
      // clave temporal y solo tienen TOKEN-SISTEC. Antes se los mandaba a
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
