import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Conflicto } from '../../models';
import { ConflictoApi } from '../../models/api';
import { EventoReciente, HistorialConflicto, ResumenHistorial } from '../../utils/historial.util';
import { RELOJ } from '../../utils/reloj';
import { HistorialHttpService } from './historial-http.service';
import { urlApi } from './peticiones';

describe('HistorialHttpService', () => {
  const CONFLICTO: ConflictoApi = {
    CODIGO: 12, ANALISIS_ID: 8, CEDULA_A: '1', NOMBRE_A: 'Ana', DEPARTAMENTO_A: 'Finanzas',
    CEDULA_B: '2', NOMBRE_B: 'Luis', DEPARTAMENTO_B: 'Compras', TIPO_RELACION: 'F', PARENTESCO: 'HERMANO',
    PARENTESCO_INVERSO: 'HERMANO', TIPO_GRADO: 'C', GRADO: 2, RIESGO: 'ALTO', ORIGEN: 'DETECTADO_AUTO',
    CLASIFICACION: 'D', CONFIANZA: 0.9, DETALLE: null, OBSERVACION: null, ESTADO_SEGUIMIENTO: 'EN_PLANIFICACION',
    VENCIDO: false, FECHA_DETECCION: '2026-10-01T09:00:00'
  };
  let servicio: HistorialHttpService;
  let http: HttpTestingController;

  /**
   * @param filas Filas de la página.
   * @returns Respuesta de una sola página.
   */
  function pagina(filas: unknown[]): object {
    return {
      estado: 'OK',
      datos: {
        DATOS: filas, PAGINA_ACTUAL: 0, 'TAMAÑO_PAGINA': 200, TOTAL_ELEMENTOS: filas.length,
        TOTAL_PAGINAS: 1, ES_PRIMERA: true, ES_ULTIMA: true
      }
    };
  }

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: RELOJ, useValue: () => new Date(2026, 9, 10, 10, 0) }
      ]
    });
    servicio = TestBed.inject(HistorialHttpService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('obtenerConflictos hace GET /conflictos y ordena por número', () => {
    let resultado: Conflicto[] | undefined;

    servicio.obtenerConflictos().subscribe((r) => resultado = r);
    const peticion = http.expectOne((p) => p.url === urlApi('/conflictos'));

    expect(peticion.request.method).toBe('GET');
    expect(peticion.request.params.get('tamanoPagina')).toBe('200');
    peticion.flush(pagina([{ ...CONFLICTO, CODIGO: 12 }, { ...CONFLICTO, CODIGO: 3 }]));
    expect(resultado?.map((c) => c.id)).toEqual(['3', '12']);
  });

  it('obtenerConflictos devuelve vacío si falla', () => {
    let resultado: Conflicto[] | undefined;

    spyOn(console, 'error');
    servicio.obtenerConflictos().subscribe((r) => resultado = r);
    http.expectOne((p) => p.url === urlApi('/conflictos')).flush({ estado: 'ERROR' }, { status: 500, statusText: 'Error' });
    expect(resultado).toEqual([]);
  });

  it('obtenerResumenes usa los expedientes y calcula el estado', () => {
    let resultado: ResumenHistorial[] | undefined;

    servicio.obtenerResumenes().subscribe((r) => resultado = r);
    const peticion = http.expectOne((p) => p.url === urlApi('/conflictos/expedientes'));

    expect(peticion.request.method).toBe('GET');
    peticion.flush(pagina([{ CONFLICTO, PLANES: [] }]));
    expect(resultado?.length).toBe(1);
    expect(resultado?.[0].conflicto.id).toBe('12');
    expect(resultado?.[0].estado).toBe('sin-plan');
  });

  it('obtenerResumenes devuelve vacío si falla', () => {
    let resultado: ResumenHistorial[] | undefined;

    spyOn(console, 'error');
    servicio.obtenerResumenes().subscribe((r) => resultado = r);
    http.expectOne((p) => p.url === urlApi('/conflictos/expedientes'))
      .flush({ estado: 'ERROR' }, { status: 500, statusText: 'Error' });
    expect(resultado).toEqual([]);
  });

  it('obtenerEventosRecientes pide el límite (acotado a 50) y mapea', () => {
    let resultado: EventoReciente[] | undefined;

    servicio.obtenerEventosRecientes(80).subscribe((r) => resultado = r);
    const peticion = http.expectOne((p) => p.url === urlApi('/conflictos/actividad-reciente'));

    expect(peticion.request.method).toBe('GET');
    expect(peticion.request.params.get('limite')).toBe('50');
    peticion.flush({
      estado: 'OK',
      datos: [{
        CODIGO: 1, CONFLICTO_ID: 12, NOMBRE_A: 'Ana', NOMBRE_B: 'Luis', ESTADO_ANTERIOR: 'DETECTADO',
        ESTADO_NUEVO: 'EN_PLANIFICACION', COMENTARIO: null, USUARIO: 'rrhh', FECHA: '2026-10-02T10:00:00'
      }]
    });
    expect(resultado?.[0].conflictoId).toBe('12');
    expect(resultado?.[0].evento.texto).toBe('Ana y Luis: Detectado → En planificación.');
  });

  it('obtenerEventosRecientes devuelve vacío si falla', () => {
    let resultado: EventoReciente[] | undefined;

    spyOn(console, 'error');
    servicio.obtenerEventosRecientes(10).subscribe((r) => resultado = r);
    http.expectOne((p) => p.url === urlApi('/conflictos/actividad-reciente'))
      .flush({ estado: 'ERROR' }, { status: 500, statusText: 'Error' });
    expect(resultado).toEqual([]);
  });

  it('obtenerHistorial usa GET /conflictos/{id} y su línea de tiempo en orden', () => {
    let resultado: HistorialConflicto | null | undefined;

    servicio.obtenerHistorial('12').subscribe((r) => resultado = r);
    const peticion = http.expectOne(urlApi('/conflictos/12'));

    expect(peticion.request.method).toBe('GET');
    peticion.flush({
      estado: 'OK',
      datos: {
        CONFLICTO,
        LINEA_DE_TIEMPO: [
          { CODIGO: 2, ESTADO_ANTERIOR: 'DETECTADO', ESTADO_NUEVO: 'EN_PLANIFICACION', COMENTARIO: 'ok',
            USUARIO: 'rrhh', FECHA: '2026-10-02T10:00:00' },
          { CODIGO: 1, ESTADO_ANTERIOR: null, ESTADO_NUEVO: 'DETECTADO', COMENTARIO: null,
            USUARIO: null, FECHA: '2026-10-01T09:00:00' }
        ],
        PLAN: null,
        PLANES: [],
        DIRECTOR_A: null, DIRECTOR_B: null, FICHA_A: null, FICHA_B: null,
        JEFE_INMEDIATO_A: null, JEFE_INMEDIATO_B: null
      }
    });
    expect(resultado?.conflicto.id).toBe('12');
    expect(resultado?.eventos.map((e) => e.texto)).toEqual(['Detectado.', 'Detectado → En planificación. ok']);
    expect(resultado?.planes).toEqual([]);
  });

  it('obtenerHistorial devuelve null si el conflicto no existe (404)', () => {
    let resultado: HistorialConflicto | null | undefined;

    spyOn(console, 'error');
    servicio.obtenerHistorial('99').subscribe((r) => resultado = r);
    http.expectOne(urlApi('/conflictos/99'))
      .flush({ estado: 'ERROR', mensaje: 'No existe' }, { status: 404, statusText: 'Not Found' });
    expect(resultado).toBeNull();
  });
});
