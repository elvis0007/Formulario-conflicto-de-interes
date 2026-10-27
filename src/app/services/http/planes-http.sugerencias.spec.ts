import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { ActividadSugerida } from '../../models';
import { PerfilUsuarioFalso, proveerPerfilFalso } from '../../testing/perfil-usuario-falso';
import { mapearActividadSugerida } from './mapeos/plan.mapeo';
import { PlanesHttpService } from './planes-http.service';
import { ERROR_SIN_CONEXION, urlApi } from './peticiones';

describe('PlanesHttpService · actividades sugeridas', () => {
  const URL_SUGERENCIA = urlApi('/conflictos/1420/plan/sugerencia');
  let servicio: PlanesHttpService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        proveerPerfilFalso(new PerfilUsuarioFalso(['rrhh'], 'EMP-008', 'Lucía Alejandra Freire Ortiz'))
      ]
    });
    servicio = TestBed.inject(PlanesHttpService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('mapearActividadSugerida: descripción, responsable sugerido (código) y plazos', () => {
    expect(mapearActividadSugerida({ ORDEN: 1, DESCRIPCION: 'Excusa', RESPONSABLE: 'D001', PLAZO_MESES: 1, PLAZO_DIAS: 0 }))
      .toEqual({ descripcion: 'Excusa', responsableSugeridoId: 'D001', plazoMeses: 1, plazoDias: 0 });
    expect(mapearActividadSugerida({ ORDEN: 2, DESCRIPCION: null, RESPONSABLE: null, PLAZO_MESES: 6, PLAZO_DIAS: 0 }).descripcion)
      .toBe('');
  });

  it('GET /conflictos/{id}/plan/sugerencia, en el orden del backend', () => {
    let resultado: ActividadSugerida[] | null | undefined;

    servicio.obtenerActividadesSugeridas('1420').subscribe((r) => resultado = r);
    const peticion = http.expectOne(URL_SUGERENCIA);

    expect(peticion.request.method).toBe('GET');
    peticion.flush({
      estado: 'OK',
      datos: [
        { ORDEN: 2, DESCRIPCION: 'Seguimiento', RESPONSABLE: null, PLAZO_MESES: 6, PLAZO_DIAS: 0 },
        { ORDEN: 1, DESCRIPCION: 'Excusa', RESPONSABLE: 'D001', PLAZO_MESES: 1, PLAZO_DIAS: 0 }
      ]
    });
    expect(resultado?.map((a) => a.descripcion)).toEqual(['Excusa', 'Seguimiento']);
    expect(servicio.ultimoError).toBeNull();
  });

  it('si falla: null y el mensaje del backend o el de sin conexión en ultimoError', () => {
    let resultado: ActividadSugerida[] | null | undefined;

    spyOn(console, 'error');
    servicio.obtenerActividadesSugeridas('1420').subscribe((r) => resultado = r);
    http.expectOne(URL_SUGERENCIA)
      .flush({ estado: 'ERROR', mensaje: 'El recurso solicitado no existe o no está disponible' }, { status: 404, statusText: 'Not Found' });
    expect(resultado).toBeNull();
    expect(servicio.ultimoError).toBe('El recurso solicitado no existe o no está disponible');

    servicio.obtenerActividadesSugeridas('1420').subscribe((r) => resultado = r);
    http.expectOne(URL_SUGERENCIA).error(new ProgressEvent('error'));
    expect(resultado).toBeNull();
    expect(servicio.ultimoError).toBe(ERROR_SIN_CONEXION);
  });
});
