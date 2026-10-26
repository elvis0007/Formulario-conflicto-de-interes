import { TestBed, fakeAsync, tick } from '@angular/core/testing';
import { ConsultaPrevia } from '../models';
import { RELOJ } from '../utils/reloj';
import { ERROR_APELLIDOS_OBLIGATORIOS, ERROR_CEDULA_OBLIGATORIA } from '../utils/consulta-previa.util';
import { ConsultaPreviaMockService } from './consulta-previa-mock.service';
import { LATENCIA_SIMULADA_MS } from './mock-data/simular-respuesta';

describe('ConsultaPreviaMockService', () => {
  let servicio: ConsultaPreviaMockService;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [{ provide: RELOJ, useValue: () => new Date(2026, 9, 2) }] });
    servicio = TestBed.inject(ConsultaPreviaMockService);
    spyOn(console, 'error');
  });

  it('rechaza lo que el backend rechazaría y deja el motivo en ultimoError', fakeAsync(() => {
    let resultado: ConsultaPrevia | null | undefined;

    servicio.consultarCandidato({ cedula: '', nombres: 'Ana', apellidos: 'Mora' }).subscribe((r) => resultado = r);
    tick(LATENCIA_SIMULADA_MS);
    expect(resultado).toBeNull();
    expect(servicio.ultimoError).toBe(ERROR_CEDULA_OBLIGATORIA);

    servicio.consultarCandidato({ cedula: '1712345678', nombres: 'Ana', apellidos: '' }).subscribe((r) => resultado = r);
    tick(LATENCIA_SIMULADA_MS);
    expect(resultado).toBeNull();
    expect(servicio.ultimoError).toBe(ERROR_APELLIDOS_OBLIGATORIOS);
  }));

  it('una consulta válida limpia el error y no guarda nada', fakeAsync(() => {
    let resultado: ConsultaPrevia | null | undefined;

    servicio.ultimoError = 'viejo';
    servicio.consultarCandidato({ cedula: '1712345678', nombres: 'Juan', apellidos: 'Vásconez' }).subscribe((r) => resultado = r);
    tick(LATENCIA_SIMULADA_MS);
    expect(resultado?.id).toBe('CP-001');
    expect(servicio.ultimoError).toBeNull();
    expect('obtenerConsultasRecientes' in servicio).toBeFalse();
  }));
});
