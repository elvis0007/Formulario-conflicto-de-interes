import { TestBed, fakeAsync, tick } from '@angular/core/testing';
import { PerfilUsuarioFalso, proveerPerfilFalso } from '../testing/perfil-usuario-falso';
import { Observable } from 'rxjs';
import { AnalisisConflictos } from '../models';
import { AnalisisMockService, LATENCIA_GENERACION_MS } from './analisis-mock.service';
import { CONFLICTOS } from './mock-data/conflictos.data';
import { LATENCIA_SIMULADA_MS } from './mock-data/simular-respuesta';
import { PlanesMockService } from './planes-mock.service';

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
    TestBed.configureTestingModule({ providers: [proveerPerfilFalso(new PerfilUsuarioFalso(['rrhh'], 'EMP-008', 'Lucía Alejandra Freire Ortiz'))] });
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

    expect(generado?.estado).toBe('BORRADOR');
    expect(new Date(generado?.fechaGeneracion ?? '').getTime())
      .toBeGreaterThanOrEqual(antes - 1000);
    expect(generado?.conflictos.map((c) => c.id)).toEqual(CONFLICTOS.map((c) => c.id));
  }));

  it('después de generar, el análisis actual es el nuevo Borrador', fakeAsync(() => {
    servicio.generarAnalisis().subscribe();
    tick(LATENCIA_GENERACION_MS);

    const actual = obtenerActual();

    expect(actual?.estado).toBe('BORRADOR');
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

describe('AnalisisMockService: clasificación, validación e historial', () => {
  let servicio: AnalisisMockService;

  /**
   * Suscribe a un observable del servicio y espera su latencia.
   *
   * @param fuente Observable a esperar.
   * @param ms Tiempo a esperar.
   * @returns El valor emitido.
   */
  function esperar<T>(fuente: Observable<T>, ms = LATENCIA_SIMULADA_MS): T | undefined {
    let valor: T | undefined;

    fuente.subscribe((v) => valor = v);
    tick(ms);
    return valor;
  }

  /** Genera un análisis y espera. */
  function generar(): AnalisisConflictos | undefined {
    return esperar(servicio.generarAnalisis(), LATENCIA_GENERACION_MS);
  }

  /** Clasifica como declarados (D) todos los pendientes del análisis actual. */
  function clasificarPendientes(): void {
    const actual = esperar(servicio.obtenerAnalisisActual());

    for (const caso of actual?.conflictos.filter((c) => c.clasificacion === null) ?? []) {
      esperar(servicio.actualizarClasificacion(caso.id, 'D', ''));
    }
  }

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [proveerPerfilFalso(new PerfilUsuarioFalso(['rrhh'], 'EMP-008', 'Lucía Alejandra Freire Ortiz'))] });
    servicio = TestBed.inject(AnalisisMockService);
    spyOn(console, 'error');
  });

  it('cada análisis generado tiene su propio id', fakeAsync(() => {
    expect(generar()?.id).toBe('AN-001');
    expect(generar()?.id).toBe('AN-002');
  }));

  it('clasificar guarda la clasificación y la observación en memoria', fakeAsync(() => {
    generar();

    expect(esperar(servicio.actualizarClasificacion('C-005', 'D', '  Revisado.  ')))
      .toBeTrue();

    const caso = esperar(servicio.obtenerAnalisisActual())?.conflictos.find((c) => c.id === 'C-005');
    expect(caso?.clasificacion).toBe('D');
    expect(caso?.observacionClasificacion).toBe('Revisado.');
  }));

  it('clasificar un caso que no existe devuelve false', fakeAsync(() => {
    generar();
    expect(esperar(servicio.actualizarClasificacion('NO-EXISTE', 'D', ''))).toBeFalse();
  }));

  it('no se puede validar con casos pendientes', fakeAsync(() => {
    generar();

    expect(esperar(servicio.validarAnalisis())).toBeFalse();
    expect(esperar(servicio.obtenerAnalisisActual())?.estado).toBe('BORRADOR');
  }));

  it('sin pendientes se valida y ya no se puede reclasificar', fakeAsync(() => {
    generar();
    clasificarPendientes();

    expect(esperar(servicio.validarAnalisis())).toBeTrue();
    expect(esperar(servicio.obtenerAnalisisActual())?.estado).toBe('VALIDADO');
    expect(esperar(servicio.actualizarClasificacion('C-001', 'H', ''))).toBeFalse();
    expect(esperar(servicio.obtenerAnalisisActual())?.conflictos.find((c) => c.id === 'C-001')
      ?.clasificacion).toBe('D');
  }));

  it('clasificar es definitivo: fuera de DETECTADO se rechaza y deja el motivo en ultimoError', fakeAsync(() => {
    generar();
    expect(esperar(servicio.actualizarClasificacion('C-005', 'D', ''))).toBeTrue();
    expect(servicio.ultimoError).toBeNull();

    expect(esperar(servicio.actualizarClasificacion('C-005', 'N', ''))).toBeFalse();
    expect(servicio.ultimoError).toContain('ya no está en DETECTADO');
    expect(esperar(servicio.actualizarClasificacion('C-001', 'H', 'Prueba.'))).toBeFalse();
    expect(esperar(servicio.obtenerAnalisisActual())?.conflictos.find((c) => c.id === 'C-005')?.clasificacion)
      .toBe('D');
  }));

  it('no se puede volver a «sin clasificar» y homónimo exige observación', fakeAsync(() => {
    generar();

    expect(esperar(servicio.actualizarClasificacion('C-005', null, ''))).toBeFalse();
    expect(servicio.ultimoError).toContain('Pendiente de revisión');
    expect(esperar(servicio.actualizarClasificacion('C-005', 'H', '  '))).toBeFalse();
    expect(servicio.ultimoError).toContain('obligatorio');
    expect(esperar(servicio.actualizarClasificacion('C-005', 'H', 'Homónimo.'))).toBeTrue();
    expect(esperar(servicio.obtenerAnalisisActual())?.conflictos.find((c) => c.id === 'C-005')?.estado)
      .toBe('DESCARTADO');
  }));

  it('validar con pendientes deja el mensaje del backend; ya validado, también', fakeAsync(() => {
    generar();

    expect(esperar(servicio.validarAnalisis())).toBeFalse();
    expect(servicio.ultimoError).toBe('No se puede validar el análisis: quedan 3 conflicto(s) sin clasificar');

    clasificarPendientes();
    expect(esperar(servicio.validarAnalisis())).toBeTrue();
    expect(servicio.ultimoError).toBeNull();
    expect(esperar(servicio.validarAnalisis())).toBeFalse();
    expect(servicio.ultimoError).toContain('ya está validado');
    expect(esperar(servicio.actualizarClasificacion('C-001', 'D', ''))).toBeFalse();
    expect(servicio.ultimoError).toContain('ya está validado');
  }));

  it('sin análisis anteriores, el historial está vacío', fakeAsync(() => {
    generar();
    expect(esperar(servicio.obtenerHistorialAnalisis())).toEqual([]);
  }));

  it('generar sobre un Validado crea uno nuevo en Borrador y guarda el anterior intacto', fakeAsync(() => {
    const primero = generar();
    clasificarPendientes();
    esperar(servicio.validarAnalisis());

    const segundo = generar();
    const historial = esperar(servicio.obtenerHistorialAnalisis());

    expect(segundo?.estado).toBe('BORRADOR');
    expect(segundo?.id).not.toBe(primero?.id);
    expect(historial).toEqual([{
      id: primero?.id ?? '',
      fechaGeneracion: primero?.fechaGeneracion ?? '',
      estado: 'VALIDADO',
      totalCasos: CONFLICTOS.length,
      confirmados: CONFLICTOS.filter((c) => c.clasificacion !== 'H').length
    }]);
  }));

  it('generar sobre un Borrador también lo guarda en el historial', fakeAsync(() => {
    generar();
    generar();
    generar();

    const historial = esperar(servicio.obtenerHistorialAnalisis());
    expect(historial?.map((h) => h.id)).withContext('del más reciente al más antiguo')
      .toEqual(['AN-002', 'AN-001']);
    expect(historial?.every((h) => h.estado === 'BORRADOR')).toBeTrue();
  }));
});

describe('AnalisisMockService: planes vigentes', () => {
  it('cada caso trae los planes actuales de PlanesMockService', fakeAsync(() => {
    TestBed.configureTestingModule({ providers: [proveerPerfilFalso(new PerfilUsuarioFalso(['rrhh'], 'EMP-008', 'Lucía Alejandra Freire Ortiz'))] });
    const servicio = TestBed.inject(AnalisisMockService);
    const planes = TestBed.inject(PlanesMockService);
    let analisis: AnalisisConflictos | undefined;

    servicio.generarAnalisis().subscribe();
    tick(LATENCIA_GENERACION_MS);
    planes.guardarBorrador({
      id: '',
      numero: 0,
      nombre: 'Plan nuevo',
      conflictoId: 'C-005',
      estado: 'BORRADOR',
      actividades: []
    }).subscribe();
    tick(LATENCIA_SIMULADA_MS);

    servicio.obtenerAnalisisActual().subscribe((a) => analisis = a);
    tick(LATENCIA_SIMULADA_MS);

    expect(analisis?.conflictos.find((c) => c.id === 'C-005')?.planes.map((p) => p.nombre))
      .toEqual(['Plan nuevo']);
  }));
});
