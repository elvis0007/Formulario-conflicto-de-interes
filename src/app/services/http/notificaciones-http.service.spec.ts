import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Notificacion } from '../../models';
import { NotificacionApi } from '../../models/api';
import { NotificacionesHttpService } from './notificaciones-http.service';
import { urlApi } from './peticiones';

describe('NotificacionesHttpService', () => {
  const FILA: NotificacionApi = {
    CODIGO: 3,
    TIPO: 'ACTIVIDAD_VENCIDA',
    MENSAJE: 'Venció una actividad.',
    CONFLICTO_ID: 1,
    ACTIVIDAD_ID: 2,
    LEIDA: false,
    FECHA: '2026-10-05T11:30:00'
  };
  let servicio: NotificacionesHttpService;
  let http: HttpTestingController;

  /**
   * @param total Total de elementos de la página.
   * @returns Respuesta de una página con la fila de prueba.
   */
  function pagina(total: number): object {
    return {
      estado: 'OK',
      datos: {
        DATOS: [FILA], PAGINA_ACTUAL: 0, 'TAMAÑO_PAGINA': 50, TOTAL_ELEMENTOS: total,
        TOTAL_PAGINAS: 1, ES_PRIMERA: true, ES_ULTIMA: true
      }
    };
  }

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    servicio = TestBed.inject(NotificacionesHttpService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('obtenerNotificaciones hace GET /notificaciones/mias y mapea', () => {
    let resultado: Notificacion[] | undefined;

    servicio.obtenerNotificaciones().subscribe((r) => resultado = r);
    const peticion = http.expectOne((p) => p.url === urlApi('/notificaciones/mias'));

    expect(peticion.request.method).toBe('GET');
    expect(peticion.request.params.get('soloNoLeidas')).toBe('false');
    expect(peticion.request.params.get('tamanoPagina')).toBe('50');
    peticion.flush(pagina(1));
    expect(resultado).toEqual([{
      id: '3', titulo: 'Actividad vencida', texto: 'Venció una actividad.',
      fecha: '2026-10-05T11:30:00', leida: false, tipo: 'vencido'
    }]);
  });

  it('obtenerNotificaciones devuelve lista vacía si falla', () => {
    let resultado: Notificacion[] | undefined;

    spyOn(console, 'error');
    servicio.obtenerNotificaciones().subscribe((r) => resultado = r);
    http.expectOne((p) => p.url === urlApi('/notificaciones/mias'))
      .flush({ estado: 'ERROR' }, { status: 500, statusText: 'Error' });
    expect(resultado).toEqual([]);
  });

  it('contarNoLeidas usa el total de las no leídas', () => {
    let resultado: number | undefined;

    servicio.contarNoLeidas().subscribe((r) => resultado = r);
    const peticion = http.expectOne((p) => p.url === urlApi('/notificaciones/mias'));

    expect(peticion.request.params.get('soloNoLeidas')).toBe('true');
    expect(peticion.request.params.get('tamanoPagina')).toBe('1');
    peticion.flush(pagina(7));
    expect(resultado).toBe(7);
  });

  it('contarNoLeidas devuelve 0 si falla', () => {
    let resultado: number | undefined;

    spyOn(console, 'error');
    servicio.contarNoLeidas().subscribe((r) => resultado = r);
    http.expectOne((p) => p.url === urlApi('/notificaciones/mias'))
      .flush({ estado: 'ERROR' }, { status: 500, statusText: 'Error' });
    expect(resultado).toBe(0);
  });

  it('marcarTodasComoLeidas hace PATCH /notificaciones/leidas y avisa del cambio', () => {
    let avisos = 0;
    let completo = false;

    servicio.cambios.subscribe(() => avisos++);
    servicio.marcarTodasComoLeidas().subscribe({ complete: () => completo = true });
    const peticion = http.expectOne(urlApi('/notificaciones/leidas'));

    expect(peticion.request.method).toBe('PATCH');
    peticion.flush({ estado: 'OK', datos: { MARCADAS: 4 } });
    expect(avisos).toBe(1);
    expect(completo).toBeTrue();
  });

  it('marcarTodasComoLeidas no avisa si el backend falla', () => {
    let avisos = 0;

    spyOn(console, 'error');
    servicio.cambios.subscribe(() => avisos++);
    servicio.marcarTodasComoLeidas().subscribe();
    http.expectOne(urlApi('/notificaciones/leidas'))
      .flush({ estado: 'ERROR' }, { status: 500, statusText: 'Error' });
    expect(avisos).toBe(0);
  });

  it('agregarNotificaciones no llama al backend: avisa y devuelve vacío', () => {
    let resultado: Notificacion[] | undefined;
    const aviso = spyOn(console, 'warn');

    servicio.agregarNotificaciones([{ titulo: 'a', texto: 'b', tipo: 'info' }]).subscribe((r) => resultado = r);
    expect(resultado).toEqual([]);
    expect(aviso).toHaveBeenCalled();
  });
});
