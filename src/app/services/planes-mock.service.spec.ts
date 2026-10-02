import { TestBed, fakeAsync, tick } from '@angular/core/testing';
import { Observable } from 'rxjs';
import { PlanAccion } from '../models';
import { LATENCIA_SIMULADA_MS } from './mock-data/simular-respuesta';
import { PlanesMockService } from './planes-mock.service';

describe('PlanesMockService', () => {
  let servicio: PlanesMockService;

  /**
   * @param fuente Observable del servicio.
   * @returns Lo que emitio tras la latencia simulada.
   */
  function esperar<T>(fuente: Observable<T>): T | undefined {
    let valor: T | undefined;

    fuente.subscribe((v) => valor = v);
    tick(LATENCIA_SIMULADA_MS);
    return valor;
  }

  /**
   * @param conflictoId Conflicto del plan.
   * @returns Un plan nuevo en borrador, sin guardar.
   */
  function planNuevo(conflictoId: string): PlanAccion {
    return {
      id: '',
      numero: 0,
      nombre: 'Plan de prueba',
      conflictoId,
      estado: 'borrador',
      actividades: [{
        id: '',
        descripcion: 'Actividad de prueba',
        responsableId: 'EMP-001',
        responsableNombre: 'Carlos Andrés Mayorga Sánchez',
        plazoMeses: 0,
        plazoDias: 15,
        estado: 'pendiente'
      }]
    };
  }

  beforeEach(() => {
    TestBed.configureTestingModule({});
    servicio = TestBed.inject(PlanesMockService);
    spyOn(console, 'error');
  });

  it('obtenerPlanesDeConflicto devuelve los planes del conflicto por número', fakeAsync(() => {
    expect(esperar(servicio.obtenerPlanesDeConflicto('C-001'))?.map((p) => p.id))
      .toEqual(['PL-001', 'PL-002']);
    expect(esperar(servicio.obtenerPlanesDeConflicto('C-005'))).toEqual([]);
  }));

  it('guardar un plan nuevo le asigna id y el siguiente número del conflicto', fakeAsync(() => {
    const guardado = esperar(servicio.guardarBorrador(planNuevo('C-005')));

    expect(guardado?.id).toBe('PL-008');
    expect(guardado?.numero).toBe(1);
    expect(guardado?.actividades[0].id).toMatch(/^A-\d{3}$/);
    expect(esperar(servicio.obtenerPlanesDeConflicto('C-005'))?.map((p) => p.id)).toEqual(['PL-008']);
  }));

  it('el número es correlativo dentro del conflicto', fakeAsync(() => {
    const primero = esperar(servicio.guardarBorrador(planNuevo('C-004')));

    expect(primero?.numero).withContext('C-004 ya tiene el Plan 01 cerrado').toBe(2);
  }));

  it('no crea un plan nuevo si el conflicto tiene uno vigente', fakeAsync(() => {
    expect(esperar(servicio.guardarBorrador(planNuevo('C-001')))).toBeNull();
    expect(esperar(servicio.obtenerPlanesDeConflicto('C-001'))?.length).toBe(2);
  }));

  it('actualiza un borrador existente y conserva su número', fakeAsync(() => {
    const original = esperar(servicio.obtenerPlanPorId('PL-004')) as PlanAccion;
    const guardado = esperar(servicio.guardarBorrador({ ...original, nombre: 'Nombre nuevo', numero: 99 }));

    expect(guardado?.nombre).toBe('Nombre nuevo');
    expect(guardado?.numero).toBe(original.numero);
    expect(esperar(servicio.obtenerPlanPorId('PL-004'))?.nombre).toBe('Nombre nuevo');
  }));

  it('no guarda planes que no están en borrador', fakeAsync(() => {
    const activo = esperar(servicio.obtenerPlanPorId('PL-003')) as PlanAccion;

    expect(esperar(servicio.guardarBorrador({ ...activo, nombre: 'Cambio' }))).toBeNull();
    expect(esperar(servicio.guardarBorrador({ ...activo, estado: 'borrador', nombre: 'Cambio' })))
      .withContext('el guardado no puede convertir un activo en borrador').toBeNull();
    expect(esperar(servicio.obtenerPlanPorId('PL-003'))?.nombre).toBe(activo.nombre);
  }));

  it('no actualiza un plan que no existe', fakeAsync(() => {
    expect(esperar(servicio.guardarBorrador({ ...planNuevo('C-005'), id: 'PL-999' }))).toBeNull();
  }));
});
