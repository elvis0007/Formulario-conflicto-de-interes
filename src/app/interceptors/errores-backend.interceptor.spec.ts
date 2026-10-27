import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { AvisosBackendService } from '../services/http/avisos-backend.service';
import { ERROR_SIN_CONEXION, MENSAJE_SESION_VENCIDA, MENSAJE_SIN_PERMISO, urlApi } from '../services/http/peticiones';
import { erroresBackendInterceptor } from './errores-backend.interceptor';

describe('erroresBackendInterceptor', () => {
  let http: HttpClient;
  let backend: HttpTestingController;
  let avisos: AvisosBackendService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(withInterceptors([erroresBackendInterceptor])), provideHttpClientTesting()]
    });
    http = TestBed.inject(HttpClient);
    backend = TestBed.inject(HttpTestingController);
    avisos = TestBed.inject(AvisosBackendService);
  });

  afterEach(() => backend.verify());

  /**
   * Hace una peticion y responde con error.
   *
   * @param metodo GET o POST.
   * @param ruta Ruta del backend.
   * @param status Estado HTTP (0 = sin respuesta).
   * @param blob Si la respuesta es un archivo.
   * @returns El error que le llego al que pidio.
   */
  function fallar(metodo: 'GET' | 'POST', ruta: string, status: number, blob = false): unknown {
    let recibido: unknown = null;
    const url = urlApi(ruta);
    const pedido = metodo === 'GET'
      ? (blob ? http.get(url, { responseType: 'blob' }) : http.get(url))
      : http.post(url, {});

    pedido.subscribe({ error: (e: unknown) => recibido = e });
    const peticion = backend.expectOne(url);

    if (status === 0) {
      peticion.error(new ProgressEvent('error'));
    } else {
      peticion.flush(blob ? new Blob(['{}']) : { estado: 'ERROR', mensaje: 'x' }, { status, statusText: 'Error' });
    }
    return recibido;
  }

  it('401 en cualquier petición del módulo: aviso de sesión vencida, y el error sigue', () => {
    expect(fallar('POST', '/planes/41/firmar', 401)).not.toBeNull();
    expect(avisos.aviso()).toEqual({ tipo: 'sesion', mensaje: MENSAJE_SESION_VENCIDA });
  });

  it('lista que no carga (0 o 5xx): aviso de conexión con reintento', () => {
    fallar('GET', '/conflictos/expedientes', 0);
    expect(avisos.aviso()?.mensaje).toBe(ERROR_SIN_CONEXION);

    avisos.cerrar();
    fallar('GET', '/actividades/mias', 502);
    expect(avisos.aviso()?.tipo).toBe('conexion');
  });

  it('lectura con 403: aviso de permiso; la sesión vencida tiene prioridad', () => {
    fallar('GET', '/notificaciones/mias', 403);
    expect(avisos.aviso()).toEqual({ tipo: 'permiso', mensaje: MENSAJE_SIN_PERMISO });

    fallar('GET', '/conflictos', 401);
    fallar('GET', '/conflictos', 403);
    expect(avisos.aviso()?.tipo).toBe('sesion');
  });

  it('acciones (POST) y archivos (blob) con 403 o 5xx: sin aviso general', () => {
    fallar('POST', '/evidencias/9/revisar', 403);
    fallar('POST', '/planes/41/cerrar', 500);
    fallar('GET', '/planes/41/documento', 403, true);
    expect(avisos.aviso()).toBeNull();
  });

  it('rutas del host (no son del módulo): sin aviso', () => {
    fallar('GET', '/plantilla-temporal/todas', 0);
    fallar('GET', '/sisgerh/modalidades', 401);
    expect(avisos.aviso()).toBeNull();
  });
});
