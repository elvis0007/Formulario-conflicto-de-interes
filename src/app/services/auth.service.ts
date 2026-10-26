import { HttpClient } from '@angular/common/http';
import { inject, Injectable, signal } from '@angular/core';
import FingerprintJS from '@fingerprintjs/fingerprintjs';
// [PNIP-CI] Elvis Flores - 30/09/2026
// Qué hace: agrega tap al import de rxjs (lo usa obtenerValidacionUsuario).
import { catchError, map, Observable, of, tap } from 'rxjs';
// [FIN PNIP-CI]
import { IRespuestaLogin } from '../models/respuesta-login';
import { IUsuario } from '../models/usuario';
import { environment } from '../../environments/environment';

interface ApiResponse<T> {
  estado: string;
  mensaje?: string;
  datos: T | null;
}

export interface ClaveTemporalResponse {
  cedula: string;
  claveTemporal: string;
}

export interface VerificacionResponse {
  cedula: string;
  token: string;
}

@Injectable({
  providedIn: 'root',
})
export class AuthService {
  private readonly urlBase: string = environment.urlSeguridad;
  private readonly http: HttpClient = inject(HttpClient);

  // [PNIP-CI] Sebas Constante - 26/10/2026
  // Qué hace: el token propio de SISCI se guarda como TOKEN-SISCI y el
  //   usuario como USUARIO-SISCI (antes TOKEN-SISTEC / USUARIO-SISTEC;
  //   alineado con el backend, svn r4079). Incluye un comentario de Sebas
  //   del 08/10 en el token de intranet.
  private _tokenIntranet = signal<string | null>(
    localStorage.getItem('TOKEN-INTRANET')
    //traer el token del localStorage
  );
  private _tokenSisci = signal<string | null>(
    localStorage.getItem('TOKEN-SISCI')
  );
  // [FIN PNIP-CI]

  private _huella = signal<String | null>(null);
  private _usuario = signal<null | IUsuario>(this.cargarUsuarioDesdeStorage());
  private _roles = signal<string[]>([]);

  usuario = this._usuario.asReadonly();
  tokenIntranet = this._tokenIntranet.asReadonly();
  // [PNIP-CI] Sebas Constante - 26/10/2026
  // Qué hace: el token propio de SISCI se guarda como TOKEN-SISCI y el
  //   usuario como USUARIO-SISCI (antes TOKEN-SISTEC / USUARIO-SISTEC;
  //   alineado con el backend, svn r4079).
  tokenSisci = this._tokenSisci.asReadonly();
  // [FIN PNIP-CI]
  roles = this._roles.asReadonly();

  constructor() {
    this.actualizarRolesDesdeUsuario(this._usuario());
  }

  private cargarUsuarioDesdeStorage(): IUsuario | null {
    try {
      // [PNIP-CI] Sebas Constante - 26/10/2026
      // Qué hace: el token propio de SISCI se guarda como TOKEN-SISCI y el
      //   usuario como USUARIO-SISCI (antes TOKEN-SISTEC / USUARIO-SISTEC;
      //   alineado con el backend, svn r4079). Incluye una línea comentada de
      //   Sebas del 08/10.
      //const usuarioStr = localStorage.getItem('USUARIO-SISCI');
      const usuarioStr = localStorage.getItem('USUARIO-SISCI');
      // [FIN PNIP-CI]
      if (usuarioStr) {
        return JSON.parse(usuarioStr);
      }
    } catch (err) {
      console.error('Error al cargar usuario desde localStorage:', err);
    }
    return null;
  }

  // [PNIP-CI] Elvis Flores - 30/09/2026
  // Qué hace: corrige obtenerValidacionUsuario para que compile contra las
  // clases reales del proyecto: codifica en Base64 con btoa + TextEncoder
  // (js-base64 no está instalado), usa _tokenIntranet y tipa el Observable
  // como arreglo de {respuesta, token}.
  obtenerValidacionUsuario(
    username: any,
    password: any
  ): Observable<{respuesta: string; token: string}[]> {
    // Base64 de un texto en UTF-8 (igual que Base64.encode de js-base64,
    // que este proyecto no tiene instalado): así las tildes y la ñ se
    // codifican bien.
    const codificarBase64 = (texto: string): string =>
      btoa(String.fromCharCode(...new TextEncoder().encode(texto)));

    return this.http
      .get<{respuesta: string; token: string}[]>(`http://172.20.35.209:7001/WSIntranet/rest/intranet/ingresarUsuario`, {
        params: {
          inDsgus_cuenta: codificarBase64(String(username)),
          inDsgus_clave: codificarBase64(String(password)),
          inAgent: String(this._huella() ?? ''),
        },
      })
      .pipe(
        tap((res) => {
          if (res[0]?.respuesta === 'm1') {
            localStorage.setItem('usuario', username);
            localStorage.setItem('TOKEN-INTRANET', res[0].token);
            this._tokenIntranet.set(res[0].token);
          }
        })
      );
  }
  // [FIN PNIP-CI]
  private actualizarRolesDesdeUsuario(usuario: IUsuario | null): void {
    if (!usuario) {
      this._roles.set([]);
      return;
    }
    const roles = (usuario.roles as string[] | undefined) || (usuario.ROLES as string[] | undefined);
    this._roles.set(Array.isArray(roles) ? roles : []);
  }

  async obtenerHuella(): Promise<void> {
    const fp = await FingerprintJS.load();
    const res = await fp.get();
    this._huella.set(res.visitorId);
  }

  /**
   * Obtiene el token desde los parámetros de la URL
   * Busca en: ?token=..., ?tokenIntranet=..., ?authToken=...
   */
  obtenerTokenDesdeUrl(): string | null {
    if (typeof window === 'undefined') {
      return null;
    }

    const urlCompleta = window.location.href;
    console.log('[AuthService.obtenerTokenDesdeUrl] URL completa:', urlCompleta);
    console.log('[AuthService.obtenerTokenDesdeUrl] Search:', window.location.search);
    console.log('[AuthService.obtenerTokenDesdeUrl] Hash:', window.location.hash);

    // Buscar en query params (después de ?)
    const urlParams = new URLSearchParams(window.location.search);
    let token = urlParams.get('token') || 
                urlParams.get('tokenIntranet') || 
                urlParams.get('authToken') ||
                urlParams.get('TOKEN-INTRANET') ||
                urlParams.get('t') ||
                urlParams.get('auth');
    
    // Si no se encuentra en query params, buscar en el hash (después de #)
    if (!token && window.location.hash) {
      const hash = window.location.hash.substring(1); // Remover el #
      // Intentar parsear como URLSearchParams
      try {
        const hashParams = new URLSearchParams(hash);
        token = hashParams.get('token') || 
                hashParams.get('tokenIntranet') || 
                hashParams.get('authToken') ||
                hashParams.get('TOKEN-INTRANET') ||
                hashParams.get('t') ||
                hashParams.get('auth');
      } catch (e) {
        // Si no se puede parsear, buscar directamente en el hash
        const hashMatch = hash.match(/(?:token|tokenIntranet|authToken|TOKEN-INTRANET)[=:]([^&]+)/i);
        if (hashMatch && hashMatch[1]) {
          token = decodeURIComponent(hashMatch[1]);
        }
      }
    }
    
    // Si aún no se encuentra, buscar directamente en la URL completa
    if (!token) {
      const urlMatch = urlCompleta.match(/(?:token|tokenIntranet|authToken|TOKEN-INTRANET)[=:]([^&#\s]+)/i);
      if (urlMatch && urlMatch[1]) {
        token = decodeURIComponent(urlMatch[1]);
      }
    }
    
    if (token) {
      // Limpiar el token (remover "Bearer " si está presente)
      let tokenLimpio = token.trim();
      if (tokenLimpio.startsWith('Bearer ')) {
        tokenLimpio = tokenLimpio.substring(7);
      }
      
      // Limpiar la URL removiendo el parámetro del token
      const newUrl = new URL(window.location.href);
      newUrl.searchParams.delete('token');
      newUrl.searchParams.delete('tokenIntranet');
      newUrl.searchParams.delete('authToken');
      newUrl.searchParams.delete('TOKEN-INTRANET');
      newUrl.searchParams.delete('t');
      newUrl.searchParams.delete('auth');
      
      // Limpiar también del hash si está ahí
      if (newUrl.hash) {
        const hashParams = new URLSearchParams(newUrl.hash.substring(1));
        hashParams.delete('token');
        hashParams.delete('tokenIntranet');
        hashParams.delete('authToken');
        hashParams.delete('TOKEN-INTRANET');
        hashParams.delete('t');
        hashParams.delete('auth');
        const newHash = hashParams.toString();
        newUrl.hash = newHash ? '#' + newHash : '';
      }
      
      window.history.replaceState({}, '', newUrl.toString());
      
      console.log('[AuthService.obtenerTokenDesdeUrl] Token encontrado en URL');
      return tokenLimpio;
    }
    
    console.log('[AuthService.obtenerTokenDesdeUrl] No se encontró token en la URL');
    return null;
  }

  /**
   * Obtiene el token desde las cookies del navegador
   * Busca cookies comunes de autenticación
   */
  obtenerTokenDesdeCookie(): string | null {
    if (typeof document === 'undefined') {
      return null;
    }

    // Nombres de cookies comunes donde puede estar el token
    const cookieNames = [
      'TOKEN-INTRANET',
      'tokenIntranet',
      'authToken',
      'token',
      'intranetToken',
      'TOKEN',
      'AUTH_TOKEN',
      'intranet_token',
      'access_token',
      'accessToken'
    ];

    console.log('[AuthService.obtenerTokenDesdeCookie] Todas las cookies:', document.cookie);

    for (const cookieName of cookieNames) {
      const cookies = document.cookie.split(';');
      for (let cookie of cookies) {
        cookie = cookie.trim();
        if (cookie.startsWith(cookieName + '=')) {
          const token = cookie.substring(cookieName.length + 1);
          if (token) {
            // Limpiar el token (remover "Bearer " si está presente)
            let tokenLimpio = token.trim();
            if (tokenLimpio.startsWith('Bearer ')) {
              tokenLimpio = tokenLimpio.substring(7);
            }
            console.log('[AuthService.obtenerTokenDesdeCookie] Token encontrado en cookie:', cookieName);
            return tokenLimpio;
          }
        }
      }
    }

    console.log('[AuthService.obtenerTokenDesdeCookie] No se encontró token en cookies');
    return null;
  }

  /**
   * @Campo TOKEN-INTRANET
   */
  validarTokenIntranet(): Observable<boolean> {
    return this.http
      .post<ApiResponse<IRespuestaLogin>>(`${this.urlBase}getUsuarioIntranet`, {
        agent: this._huella()
      })
      .pipe(
        map((resp) => {
          if (!resp || resp.estado !== 'OK' || !resp.datos) {
            console.warn('[AuthService.validarTokenIntranet] Respuesta inválida o sin datos:', resp);
            return false;
          }
          return this.procesarRespuestaLogin(resp.datos);
        }),
        catchError((err) => {
          console.error('Error al validar token de Intranet:', err);
          return of(false);
        })
      );
  }

  // [PNIP-CI] Sebas Constante - 26/10/2026
  // Qué hace: validarTokenSistec pasa a validarTokenSisci. el token propio
  //   de SISCI se guarda como TOKEN-SISCI y el usuario como USUARIO-SISCI
  //   (antes TOKEN-SISTEC / USUARIO-SISTEC; alineado con el backend, svn
  //   r4079).
  /**
   * @Campo TOKEN-SISCI
   */
  validarTokenSisci(): Observable<boolean> {
    return this.http
      .post<ApiResponse<IRespuestaLogin>>(`${this.urlBase}getUsuarioSisci`, {
        agent: this._huella(),
      })
      .pipe(
        map((resp) => {
          if (!resp || resp.estado !== 'OK' || !resp.datos) {
            console.warn('[AuthService.validarTokenSisci] Respuesta inválida o sin datos, probando Intranet:', resp);
            return false;
          }
          return this.procesarRespuestaLogin(resp.datos);
        }),
        catchError((err) => this.validarTokenIntranet())
      );
  }
  // [FIN PNIP-CI]

  /**
   * Genera una clave temporal en el backend para la cédula indicada.
   * Se usa para permitir que un usuario externo se autentique con cédula + código.
   */
  generarClaveTemporal(cedula: string): Observable<ClaveTemporalResponse> {
    return this.http
      .post<ApiResponse<ClaveTemporalResponse>>(`${this.urlBase}ingresarNuevoUsuario`, {
        cedula
      })
      .pipe(
        map((resp) => {
          if (!resp || resp.estado !== 'OK' || !resp.datos) {
            throw new Error(resp?.mensaje || 'No se pudo generar la clave temporal');
          }
          return resp.datos;
        }),
        catchError((err) => {
          console.error('[AuthService.generarClaveTemporal] Error al generar clave temporal:', err);
          throw err;
        })
      );
  }

  // [PNIP-CI] Sebas Constante - 26/10/2026
  // Qué hace: el token propio de SISCI se guarda como TOKEN-SISCI y el
  //   usuario como USUARIO-SISCI (antes TOKEN-SISTEC / USUARIO-SISTEC;
  //   alineado con el backend, svn r4079).
  /**
   * Inicia sesión usando cédula y clave temporal generada por el backend.
   * Guarda el TOKEN-SISCI y un usuario mínimo con la cédula para llenar el formulario.
   */
  loginConCedulaYCodigo(cedula: string, claveTemporal: string): Observable<boolean> {
    return this.http
      .post<ApiResponse<VerificacionResponse>>(`${this.urlBase}verificarClave`, {
        cedula,
        claveTemporal
      })
      .pipe(
        map((resp) => {
          if (!resp || resp.estado !== 'OK' || !resp.datos) {
            console.warn('[AuthService.loginConCedulaYCodigo] Respuesta inválida o sin datos:', resp);
            return false;
          }
          const datos = resp.datos;
          if (!datos.token || !datos.cedula) {
            console.warn('[AuthService.loginConCedulaYCodigo] Datos incompletos en la respuesta:', datos);
            return false;
          }

          // Guardar TOKEN-SISCI
          this.guardarTokens(datos.token);

          // Crear un usuario mínimo con la cédula para que el formulario pueda autollenar ese campo
          const usuarioMinimo: IUsuario = {
            CEDULA: datos.cedula,
            roles: ['E'],
            ROLES: ['E']
          };
          this._usuario.set(usuarioMinimo);
          this.actualizarRolesDesdeUsuario(usuarioMinimo);
          localStorage.setItem('USUARIO-SISCI', JSON.stringify(usuarioMinimo));

          return true;
        }),
        catchError((err) => {
          console.error('[AuthService.loginConCedulaYCodigo] Error al verificar clave temporal:', err);
          return of(false);
        })
      );
  }
  // [FIN PNIP-CI]

  private procesarRespuestaLogin(res: IRespuestaLogin): boolean {
    console.log('[AuthService.procesarRespuestaLogin] Procesando respuesta:', {
      tieneUsuario: res.usuario !== null,
      tieneToken: !!res.token
    });
    
    if (res.usuario === null) {
      console.warn('[AuthService.procesarRespuestaLogin] La respuesta no incluye usuario');
      return false;
    }

    if (!!res.token) {
      this.guardarTokens(res.token);
    }

    console.log('[AuthService.procesarRespuestaLogin] Estableciendo usuario:', res.usuario);
    this._usuario.set(res.usuario);
    this.actualizarRolesDesdeUsuario(res.usuario);
    // [PNIP-CI] Sebas Constante - 26/10/2026
    // Qué hace: el token propio de SISCI se guarda como TOKEN-SISCI y el
    //   usuario como USUARIO-SISCI (antes TOKEN-SISTEC / USUARIO-SISTEC;
    //   alineado con el backend, svn r4079).
    localStorage.setItem('USUARIO-SISCI', JSON.stringify(res.usuario));
    // [FIN PNIP-CI]

    return true;
  }

  // [PNIP-CI] Sebas Constante - 26/10/2026
  // Qué hace: el token propio de SISCI se guarda como TOKEN-SISCI y el
  //   usuario como USUARIO-SISCI (antes TOKEN-SISTEC / USUARIO-SISTEC;
  //   alineado con el backend, svn r4079).
  guardarTokens(tokenSisci: string) {
    this._tokenSisci.set(tokenSisci);
    localStorage.setItem('TOKEN-SISCI', tokenSisci);
  }
  // [FIN PNIP-CI]

  guardarTokenIntranet(tokenIntranet: string) {
    this._tokenIntranet.set(tokenIntranet);
    localStorage.setItem('TOKEN-INTRANET', tokenIntranet);
  }

  // [PNIP-CI] Sebas Constante - 26/10/2026
  // Qué hace: el token propio de SISCI se guarda como TOKEN-SISCI y el
  //   usuario como USUARIO-SISCI (antes TOKEN-SISTEC / USUARIO-SISTEC;
  //   alineado con el backend, svn r4079).
  isAuthenticated(): boolean {
    const tieneTokenSisci = this._tokenSisci() !== null;
    const tieneTokenIntranet = this._tokenIntranet() !== null;

    let usuario = this._usuario();
    if (!usuario) {
      const usuarioGuardado = this.cargarUsuarioDesdeStorage();
      if (usuarioGuardado) {
        this._usuario.set(usuarioGuardado);
        this.actualizarRolesDesdeUsuario(usuarioGuardado);
        usuario = usuarioGuardado;
      }
    }

    const tieneToken = tieneTokenSisci || tieneTokenIntranet;
    const tieneUsuario = usuario !== null;

    return tieneToken && tieneUsuario;
  }
  // [FIN PNIP-CI]

  getCurrentUser(): IUsuario | null {
    return this._usuario();
  }

  hasRole(role: string): boolean {
    return this._roles().includes(role);
  }

  isAdminRole(): boolean {
    return this.hasRole('A');
  }

  // [PNIP-CI] Sebas Constante - 26/10/2026
  // Qué hace: el token propio de SISCI se guarda como TOKEN-SISCI y el
  //   usuario como USUARIO-SISCI (antes TOKEN-SISTEC / USUARIO-SISTEC;
  //   alineado con el backend, svn r4079).
  logout() {
    this._tokenSisci.set(null);
    this._tokenIntranet.set(null);
    this._usuario.set(null);
    localStorage.removeItem('TOKEN-SISCI');
    localStorage.removeItem('TOKEN-INTRANET');
    localStorage.removeItem('USUARIO-SISCI');
    // window.location.href = environment.urlIntranet;
  }
  // [FIN PNIP-CI]

  // [PNIP-CI DEV] Elvis Flores - 01/10/2026 - ELIMINAR ANTES DE PRODUCCIÓN
  // Qué hace: sesión simulada de desarrollo local (NO es parte del backend
  // real), para trabajar sin token de intranet ni acceso a la red de la
  // empresa. Nunca se activa si no se prende a mano desde localStorage, y
  // nunca en el build de producción.

  /**
   * Activa una sesión simulada solo para desarrollo local, sin llamar al
   * backend real de intranet. No tiene ningún efecto si `environment.production`
   * es `true`.
   * @author Elvis Flores
   * @param rol Rol o roles simulados, separados por coma: 'A' (Admin),
   * 'R' (Jefe de RRHH), 'P' (Responsable), 'E' (externo)... p. ej. 'R,P'.
   */
  activarSesionSimuladaDev(rol: string): void {
    if (environment.production) {
      return;
    }

    // Uno o varios roles, separados por coma ('R,P').
    const rolesDev = rol.split(',').map((r) => r.trim()).filter((r) => r !== '');

    // Usuario ficticio. Tiene la misma forma (IUsuario) que el que devuelve
    // el backend real en procesarRespuestaLogin(); lleva los roles pedidos
    // en `roles` y `ROLES`, que son los dos campos que lee
    // actualizarRolesDesdeUsuario().
    const usuarioDev: IUsuario = {
      CEDULA: '0000000000',
      NOMBRES: 'Usuario',
      APELLIDOS: 'Desarrollo',
      roles: rolesDev,
      ROLES: rolesDev
    };

    // isAuthenticated() exige DOS cosas: que haya algún token en los signals
    // (_tokenSisci o _tokenIntranet distinto de null) Y que haya un usuario
    // en _usuario. Aquí se cumple la primera con un token falso en
    // _tokenSisci. Solo en memoria: NO se escribe en localStorage, para que
    // al apagar la bandera no quede un token falso guardado.
    this._tokenSisci.set('TOKEN-DEV-SIMULADO');

    // Segunda condición de isAuthenticated(): el usuario. También es lo que
    // devuelven usuario() y getCurrentUser() (cabecera, formulario, gestión
    // de conflictos).
    // Tampoco se guarda en localStorage ('USUARIO-SISCI').
    this._usuario.set(usuarioDev);

    // hasRole() lee el signal _roles. Se llena con el mismo método privado
    // que usa el login real, así no hay una segunda forma de calcular roles.
    this.actualizarRolesDesdeUsuario(usuarioDev);

    console.warn('[AuthService] SESIÓN SIMULADA DE DESARROLLO activa, rol:',
      rol, '(SISCI-DEV-SESION-SIMULADA). No se validó contra intranet.');
  }

  // [FIN PNIP-CI DEV]
}
