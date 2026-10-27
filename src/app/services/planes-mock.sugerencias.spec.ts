import { TestBed, fakeAsync, tick } from '@angular/core/testing';
import { ActividadSugerida } from '../models';
import { PerfilUsuarioFalso, proveerPerfilFalso } from '../testing/perfil-usuario-falso';
import { LATENCIA_SIMULADA_MS } from './mock-data/simular-respuesta';
import { ERROR_SUGERENCIA, PlanesMockService } from './planes-mock.service';

describe('PlanesMockService · actividades sugeridas', () => {
  let servicio: PlanesMockService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [proveerPerfilFalso(new PerfilUsuarioFalso(['rrhh'], 'EMP-008', 'Lucía Alejandra Freire Ortiz'))]
    });
    servicio = TestBed.inject(PlanesMockService);
  });

  /**
   * @param conflictoId Conflicto.
   * @returns Lo que emite el servicio, tras la latencia simulada.
   */
  function pedir(conflictoId: string): ActividadSugerida[] | null | undefined {
    let resultado: ActividadSugerida[] | null | undefined;

    servicio.obtenerActividadesSugeridas(conflictoId).subscribe((r) => resultado = r);
    tick(LATENCIA_SIMULADA_MS);
    return resultado;
  }

  it('devuelve 2, 3 o 4 actividades según el riesgo del caso', fakeAsync(() => {
    expect(pedir('C-004')?.length).withContext('C-004 Bajo').toBe(2);
    expect(pedir('C-005')?.length).withContext('C-005 Moderado').toBe(2);
    expect(pedir('C-001')?.length).withContext('C-001 Alto').toBe(3);
    expect(pedir('C-003')?.length).withContext('C-003 Crítico').toBe(4);
    expect(servicio.ultimoError).toBeNull();
  }));

  it('un conflicto que no existe: null y el motivo en ultimoError', fakeAsync(() => {
    expect(pedir('C-999')).toBeNull();
    expect(servicio.ultimoError).toBe(ERROR_SUGERENCIA);
  }));
});
