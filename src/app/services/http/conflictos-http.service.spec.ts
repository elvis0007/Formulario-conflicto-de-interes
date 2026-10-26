import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Conflicto } from '../../models';
import { ConflictoDetalleApi, ExpedienteApi, PaginaApi, RespuestaApi } from '../../models/api';
import { conflictoApi, planApi } from '../../testing/api-ejemplos';
import { ConflictosHttpService } from './conflictos-http.service';
import { urlApi } from './peticiones';

describe('ConflictosHttpService', () => {
  const EXPEDIENTES = urlApi('/conflictos/expedientes');
  let servicio: ConflictosHttpService;
  let http: HttpTestingController;

  /**
   * @param datos Filas de la página.
   * @param actual Número de página (desde 0).
   * @param total Total de páginas.
   * @returns Respuesta paginada del backend.
   */
  function pagina<T>(datos: T[], actual: number, total: number): RespuestaApi<PaginaApi<T>> {
    return {
      estado: 'OK',
      datos: {
        DATOS: datos,
        PAGINA_ACTUAL: actual,
        'TAMAÑO_PAGINA': 200,
        TOTAL_ELEMENTOS: datos.length,
        TOTAL_PAGINAS: total,
        ES_PRIMERA: actual === 0,
        ES_ULTIMA: actual === total - 1
      }
    };
  }

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    servicio = TestBed.inject(ConflictosHttpService);
    http = TestBed.inject(HttpTestingController);
    spyOn(console, 'error');
  });

  afterEach(() => http.verify());

  it('obtenerConflictos pide todas las páginas de expedientes y mapea cada conflicto con sus planes', () => {
    let resultado: Conflicto[] | undefined;

    servicio.obtenerConflictos().subscribe((r) => resultado = r);
    const primera = http.expectOne(EXPEDIENTES + '?pagina=0&tamanoPagina=200');

    expect(primera.request.method).toBe('GET');
    primera.flush(pagina<ExpedienteApi>([{ CONFLICTO: conflictoApi(), PLANES: [planApi()] }], 0, 2));
    http.expectOne(EXPEDIENTES + '?pagina=1&tamanoPagina=200')
      .flush(pagina<ExpedienteApi>([{ CONFLICTO: conflictoApi({ CODIGO: 1408 }), PLANES: [] }], 1, 2));

    expect(resultado?.map((c) => c.id)).toEqual(['1420', '1408']);
    expect(resultado?.[0].planes.map((p) => p.id)).toEqual(['41']);
    expect(resultado?.[0].rolB).toBe('Padre');
  });

  it('obtenerConflictos devuelve [] si el backend lo rechaza (403 con rol P)', () => {
    let resultado: Conflicto[] | undefined;

    servicio.obtenerConflictos().subscribe((r) => resultado = r);
    http.expectOne(EXPEDIENTES + '?pagina=0&tamanoPagina=200')
      .flush({ estado: 'ERROR', mensaje: 'Sin permiso' }, { status: 403, statusText: 'Forbidden' });

    expect(resultado).toEqual([]);
    expect(console.error).toHaveBeenCalled();
  });

  it('obtenerConflictoPorId pide el detalle y mapea ficha, jefe y planes', () => {
    const detalle: ConflictoDetalleApi = {
      CONFLICTO: conflictoApi(),
      LINEA_DE_TIEMPO: [],
      PLAN: planApi(),
      PLANES: [planApi()],
      DIRECTOR_A: null,
      DIRECTOR_B: null,
      FICHA_A: { CARGO: 'Analista', FECHA_INGRESO: null, NOMBRE_PADRE: null, NOMBRE_MADRE: null, NOMBRE_CONYUGE: null },
      FICHA_B: null,
      JEFE_INMEDIATO_A: { DMPER_CODIGO: 'J1', NOMBRE: 'Jefe A', CARGO: null, DEPARTAMENTO: null },
      JEFE_INMEDIATO_B: null
    };
    let resultado: Conflicto | undefined;

    servicio.obtenerConflictoPorId('1420').subscribe((r) => resultado = r);
    const peticion = http.expectOne(urlApi('/conflictos/1420'));

    expect(peticion.request.method).toBe('GET');
    peticion.flush({ estado: 'OK', datos: detalle });

    expect(resultado?.id).toBe('1420');
    expect(resultado?.personaA.cargo).toBe('Analista');
    expect(resultado?.personaA.jefeInmediato).toBe('Jefe A');
    expect(resultado?.planes.map((p) => p.id)).toEqual(['41']);
  });

  it('obtenerConflictoPorId devuelve undefined si no existe (404) o si es un 409', () => {
    const resultados: (Conflicto | undefined | 'sin emitir')[] = ['sin emitir', 'sin emitir'];

    servicio.obtenerConflictoPorId('9').subscribe((r) => resultados[0] = r);
    http.expectOne(urlApi('/conflictos/9'))
      .flush({ estado: 'ERROR', mensaje: 'El conflicto no existe' }, { status: 404, statusText: 'Not Found' });
    servicio.obtenerConflictoPorId('10').subscribe((r) => resultados[1] = r);
    http.expectOne(urlApi('/conflictos/10'))
      .flush({ estado: 'ERROR', mensaje: 'Conflicto' }, { status: 409, statusText: 'Conflict' });

    expect(resultados).toEqual([undefined, undefined]);
  });
});
