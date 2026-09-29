import { HttpInterceptorFn } from '@angular/common/http';
import { finalize } from 'rxjs';

let solicitudesTotales: number = 0;

export const solicitudInterceptor: HttpInterceptorFn = (req, next) => {
  const url = req.url;
  let token: string | null;

  if (url.includes('WSSisgerhServices'))
    token = localStorage.getItem('TOKEN-SISGERH');
  else if (req.url.includes('getUsuarioIntranet')) token = localStorage.getItem('TOKEN-INTRANET');
  else if (req.url.includes('generarTokenSistec')) token = null;
  else if (req.url.includes('getUsuarioInformacionSisgerh')) token = localStorage.getItem('TOKEN-INTRANET');
  else if (url.includes('/sisgerh/')) token = localStorage.getItem('TOKEN-SISTEC');
  else token = localStorage.getItem('TOKEN-SISTEC');

  solicitudesTotales++;

  // Para la mayoría de endpoints el backend espera "Authorization: Bearer <token>"
  // pero para getUsuarioIntranet / getUsuarioInformacionSisgerh el backend
  // recibe el token "crudo" y él mismo le agrega el Bearer al llamar a WSIntranet.
  const requiereTokenCrudo =
    req.url.includes('getUsuarioIntranet') ||
    req.url.includes('getUsuarioInformacionSisgerh');

  let authHeader = '';
  if (token !== null) {
    const tokenLimpio = token.replace(/^"|"$/g, '').trim();
    authHeader = requiereTokenCrudo ? tokenLimpio : `Bearer ${tokenLimpio}`;
  }


  let headers = req.headers.set('Accept', 'application/json');
  if (authHeader) {
    headers = headers.set('Authorization', authHeader);
  }

  const solicitudModificada = req.clone({
    headers,
  });

  return next(solicitudModificada).pipe(
    finalize(() => {
      solicitudesTotales--;
    })
  );
};
