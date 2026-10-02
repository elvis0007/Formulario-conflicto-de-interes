import { TestBed, fakeAsync, tick } from '@angular/core/testing';
import { AnalisisConflictos } from '../models';
import { AnalisisMockService, LATENCIA_GENERACION_MS } from './analisis-mock.service';
import { CONFLICTOS } from './mock-data/conflictos.data';
import { LATENCIA_SIMULADA_MS } from './mock-data/simular-respuesta';

describe('AnalisisMockService', () => {
  let servicio: AnalisisMockService;

  /**
   * Pide el analisis actual y espera la respuesta simulada.
   *
   * @returns El analisis recibido.
   */
  function obtenerActual(): AnalisisConflictos | undefined {
    let recibido: AnalisisConflictos | undefined;

    servicio.obtenerAnalisisActual().subscribe((a) => recibido = a);
    tick(LATENCIA_SIMULADA_MS);
    return recibido;
  }

  beforeEach(() => {
    TestBed.configureTestingModule({});
    servicio = TestBed.inject(AnalisisMockService);
  });

  it('al inicio no hay ningún análisis generado', fakeAsync(() => {
    const actual = obtenerActual();

    expect(actual?.estado).toBeNull();
    expect(actual?.fechaGeneracion).toBeNull();
    expect(actual?.conflictos).toEqual([]);
  }));

  it('generar deja el análisis en Borrador, con fecha y todos los casos', fakeAsync(() => {
    let generado: AnalisisConflictos | undefined;
    const antes = Date.now();

    servicio.generarAnalisis().subscribe((a) => generado = a);
    tick(LATENCIA_SIMULADA_MS);
    expect(generado).withContext('simula la latencia del algoritmo').toBeUndefined();
    tick(LATENCIA_GENERACION_MS - LATENCIA_SIMULADA_MS);

    expect(generado?.estado).toBe('borrador');
    expect(new Date(generado?.fechaGeneracion ?? '').getTime())
      .toBeGreaterThanOrEqual(antes - 1000);
    expect(generado?.conflictos.map((c) => c.id)).toEqual(CONFLICTOS.map((c) => c.id));
  }));

  it('después de generar, el análisis actual es el nuevo Borrador', fakeAsync(() => {
    servicio.generarAnalisis().subscribe();
    tick(LATENCIA_GENERACION_MS);

    const actual = obtenerActual();

    expect(actual?.estado).toBe('borrador');
    expect(actual?.conflictos.length).toBe(CONFLICTOS.length);
  }));

  it('devuelve copias: modificar lo recibido no altera el análisis', fakeAsync(() => {
    servicio.generarAnalisis().subscribe();
    tick(LATENCIA_GENERACION_MS);

    const primero = obtenerActual();
    primero?.conflictos.splice(0);

    expect(obtenerActual()?.conflictos.length).toBe(CONFLICTOS.length);
  }));
});
