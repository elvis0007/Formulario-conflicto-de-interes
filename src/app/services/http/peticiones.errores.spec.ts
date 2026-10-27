import { HttpErrorResponse } from '@angular/common/http';
import {
  ERROR_SIN_CONEXION,
  MENSAJE_ARCHIVO_RECHAZADO,
  MENSAJE_SESION_VENCIDA,
  MENSAJE_SIN_PERMISO,
  esMensajeEntendible,
  mensajeDeError,
  tipoDeError
} from './peticiones';

describe('peticiones · errores del backend', () => {
  const POR_DEFECTO = 'No se pudo completar la acción.';

  /**
   * @param status Estado HTTP.
   * @param mensaje `mensaje` del cuerpo `{ estado, mensaje }`; sin cuerpo si falta.
   * @returns El error como lo entrega HttpClient.
   */
  function error(status: number, mensaje?: string): HttpErrorResponse {
    return new HttpErrorResponse({
      status,
      error: mensaje === undefined ? null : { estado: 'ERROR', mensaje, datos: null }
    });
  }

  it('tipoDeError clasifica por estado HTTP', () => {
    expect(tipoDeError(error(401))).toBe('sesion');
    expect(tipoDeError(error(403))).toBe('permiso');
    expect(tipoDeError(error(413))).toBe('archivo');
    expect(tipoDeError(error(0))).toBe('conexion');
    expect(tipoDeError(error(500))).toBe('conexion');
    expect(tipoDeError(error(503))).toBe('conexion');
    expect(tipoDeError(error(409))).toBe('otro');
    expect(tipoDeError(new Error('propio'))).toBeNull();
  });

  it('401: sesión vencida, aunque el backend diga otra cosa', () => {
    expect(mensajeDeError(error(401, 'Token inválido o expirado'), POR_DEFECTO)).toBe(MENSAJE_SESION_VENCIDA);
  });

  it('0 y 5xx: sin conexión (el 500 del backend no ayuda al usuario)', () => {
    expect(mensajeDeError(error(0), POR_DEFECTO)).toBe(ERROR_SIN_CONEXION);
    expect(mensajeDeError(
      error(500, 'Ocurrió un error inesperado al procesar la solicitud. Contacte al administrador.'), POR_DEFECTO
    )).toBe(ERROR_SIN_CONEXION);
  });

  it('413: el límite de 5 MB y los tipos permitidos', () => {
    expect(mensajeDeError(error(413), POR_DEFECTO)).toBe(MENSAJE_ARCHIVO_RECHAZADO);
  });

  it('403: el motivo del backend si lo explica; el genérico de falta de rol se cambia', () => {
    expect(mensajeDeError(error(403, 'No tiene permisos para realizar esta accion'), POR_DEFECTO)).toBe(MENSAJE_SIN_PERMISO);
    expect(mensajeDeError(error(403), POR_DEFECTO)).toBe(MENSAJE_SIN_PERMISO);
    expect(mensajeDeError(error(403, 'Quien subió la evidencia no puede revisarla'), POR_DEFECTO))
      .toBe('Quien subió la evidencia no puede revisarla');
  });

  it('400/404/409: el mensaje del backend si es entendible; si es técnico o falta, el por defecto', () => {
    expect(mensajeDeError(error(400, 'El archivo supera el tamaño máximo permitido (5 MB)'), POR_DEFECTO))
      .toBe('El archivo supera el tamaño máximo permitido (5 MB)');
    expect(mensajeDeError(error(409, '  Recargue e intente de nuevo.  '), POR_DEFECTO)).toBe('Recargue e intente de nuevo.');
    expect(mensajeDeError(error(400, 'java.lang.NullPointerException at ConflictoService'), POR_DEFECTO)).toBe(POR_DEFECTO);
    expect(mensajeDeError(error(404), POR_DEFECTO)).toBe(POR_DEFECTO);
  });

  it('un Error propio del servicio conserva su texto', () => {
    expect(mensajeDeError(new Error('El motivo es obligatorio.'), POR_DEFECTO)).toBe('El motivo es obligatorio.');
    expect(mensajeDeError('raro', POR_DEFECTO)).toBe(POR_DEFECTO);
  });

  it('esMensajeEntendible descarta vacíos, muy largos y técnicos', () => {
    expect(esMensajeEntendible('El plan ya está firmado')).toBeTrue();
    expect(esMensajeEntendible('   ')).toBeFalse();
    expect(esMensajeEntendible('x'.repeat(301))).toBeFalse();
    expect(esMensajeEntendible('ORA-00001: unique constraint violated')).toBeFalse();
    expect(esMensajeEntendible('could not execute SQL statement')).toBeFalse();
    expect(esMensajeEntendible(42)).toBeFalse();
  });
});
