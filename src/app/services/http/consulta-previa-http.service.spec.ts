import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { ConsultaPrevia } from '../../models';
import { ConsultaPreviaApi } from '../../models/api';
import { ConsultaPreviaHttpService } from './consulta-previa-http.service';
import { ERROR_SIN_CONEXION, urlApi } from './peticiones';

describe('ConsultaPreviaHttpService', () => {
  const DATOS = { cedula: '0102030405', nombres: 'Juan Carlos', apellidos: 'Pérez López' };
  let servicio: ConsultaPreviaHttpService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    servicio = TestBed.inject(ConsultaPreviaHttpService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('consultarCandidato hace POST /consultas-previas y mapea la respuesta', () => {
    let resultado: ConsultaPrevia | null | undefined;
    const respuesta = {
      estado: 'OK',
      datos: { CEDULA: '0102030405', FECHA: '2026-10-05T10:00:00', COINCIDENCIAS: [] } as unknown as ConsultaPreviaApi
    };

    servicio.consultarCandidato(DATOS).subscribe((r) => resultado = r);
    const peticion = http.expectOne(urlApi('/consultas-previas'));

    expect(peticion.request.method).toBe('POST');
    expect(peticion.request.body).toEqual({
      tipo: 'ASPIRANTE', cedula: '0102030405', nombres: 'Pérez López Juan Carlos'
    });
    peticion.flush(respuesta);
    expect(resultado?.fecha).toBe('2026-10-05T10:00:00');
    expect(resultado?.datos).toEqual(DATOS);
  });

  it('consultarCandidato devuelve null si el backend rechaza los datos', () => {
    let resultado: ConsultaPrevia | null | undefined;

    spyOn(console, 'error');
    servicio.consultarCandidato(DATOS).subscribe((r) => resultado = r);
    http.expectOne(urlApi('/consultas-previas'))
      .flush({ estado: 'ERROR', mensaje: 'La cédula no es válida' }, { status: 400, statusText: 'Bad Request' });
    expect(resultado).toBeNull();
    expect(servicio.ultimoError).toBe('La cédula no es válida');
  });

  it('sin respuesta del servidor: null y aviso de sin conexión; una consulta buena limpia el error', () => {
    let resultado: ConsultaPrevia | null | undefined;

    spyOn(console, 'error');
    servicio.consultarCandidato(DATOS).subscribe((r) => resultado = r);
    http.expectOne(urlApi('/consultas-previas')).error(new ProgressEvent('error'));
    expect(resultado).toBeNull();
    expect(servicio.ultimoError).toBe(ERROR_SIN_CONEXION);

    servicio.consultarCandidato(DATOS).subscribe((r) => resultado = r);
    http.expectOne(urlApi('/consultas-previas')).flush({
      estado: 'OK', datos: { CEDULA: '0102030405', FECHA: '2026-10-05T10:00:00', COINCIDENCIAS: [] }
    });
    expect(resultado).not.toBeNull();
    expect(servicio.ultimoError).toBeNull();
  });
});
