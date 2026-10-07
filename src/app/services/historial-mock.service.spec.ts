import { TestBed, fakeAsync, tick } from '@angular/core/testing';
import { Observable } from 'rxjs';
import { PerfilUsuarioFalso, proveerPerfilFalso } from '../testing/perfil-usuario-falso';
import { HistorialConflicto, todosLosEventos } from '../utils/historial.util';
import { RELOJ } from '../utils/reloj';
import { AnalisisMockService, LATENCIA_GENERACION_MS } from './analisis-mock.service';
import { HistorialMockService } from './historial-mock.service';
import { LATENCIA_SIMULADA_MS } from './mock-data/simular-respuesta';
import { PlanesMockService } from './planes-mock.service';

describe('HistorialMockService', () => {
  // Despues de la ultima subida de los datos de ejemplo (A-008, 05/10).
  const HOY = new Date(2026, 9, 7, 10, 0);
  const REVISORA = 'Lucía Alejandra Freire Ortiz';
  let servicio: HistorialMockService;
  let perfil: PerfilUsuarioFalso;

  /**
   * @param fuente Observable.
   * @returns Lo emitido tras las latencias.
   */
  function esperar<T>(fuente: Observable<T>): T | undefined {
    let valor: T | undefined;

    fuente.subscribe((v) => valor = v);
    tick(LATENCIA_GENERACION_MS + LATENCIA_SIMULADA_MS * 3);
    return valor;
  }

  /**
   * @param conflictoId Conflicto.
   * @returns Textos de todos sus eventos.
   */
  function textos(conflictoId: string): string[] {
    const h = esperar(servicio.obtenerHistorial(conflictoId)) as HistorialConflicto;

    return todosLosEventos(h).map((e) => e.texto);
  }

  beforeEach(() => {
    perfil = new PerfilUsuarioFalso(['rrhh'], 'EMP-008', REVISORA);
    TestBed.configureTestingModule({
      providers: [
        { provide: RELOJ, useValue: () => new Date(HOY) },
        proveerPerfilFalso(perfil)
      ]
    });
    servicio = TestBed.inject(HistorialMockService);
    spyOn(console, 'error');
  });

  it('lista los conflictos por número y devuelve null si no existe', fakeAsync(() => {
    expect(esperar(servicio.obtenerConflictos())?.[0].id).toBe('C-001');
    expect(esperar(servicio.obtenerHistorial('C-999'))).toBeNull();
  }));

  it('arma los tres niveles con los planes del conflicto', fakeAsync(() => {
    const h = esperar(servicio.obtenerHistorial('C-002')) as HistorialConflicto;

    expect(h.conflicto.id).toBe('C-002');
    expect(h.planes.map((p) => p.plan.id)).toEqual(['PL-003']);
    expect(h.planes[0].actividades.map((a) => a.actividad.id)).toEqual(['A-006', 'A-007', 'A-008']);
  }));

  it('una evidencia aprobada en Revisión aparece sin recargar, con el cierre del plan', fakeAsync(() => {
    expect(textos('C-002')).not.toContain('Plan cerrado: todas las actividades fueron aprobadas.');

    esperar(TestBed.inject(PlanesMockService).aprobarEvidencia('PL-003', 'A-008'));
    const h = esperar(servicio.obtenerHistorial('C-002')) as HistorialConflicto;
    const a008 = h.planes[0].actividades.find((a) => a.actividad.id === 'A-008');

    expect(a008?.eventos.at(-1)).toEqual(jasmine.objectContaining({
      texto: 'Evidencia aprobada.', autor: REVISORA, fecha: HOY.toISOString(), tipo: 'ok'
    }));
    expect(h.planes[0].eventos.at(-1)).toEqual(jasmine.objectContaining({
      texto: 'Plan cerrado: todas las actividades fueron aprobadas.', tipo: 'cierre'
    }));
  }));

  it('generar, clasificar y validar el análisis también aparecen', fakeAsync(() => {
    const analisis = TestBed.inject(AnalisisMockService);

    esperar(analisis.generarAnalisis());
    for (const id of ['C-005', 'C-007', 'C-009']) {
      esperar(analisis.actualizarClasificacion(id, 'confirmado', id === 'C-005' ? 'Confirmado en entrevista.' : ''));
    }
    esperar(analisis.validarAnalisis());

    expect(textos('C-005')).toEqual([
      'Conflicto detectado: Cuñados · Afinidad, 2do grado (riesgo moderado).',
      'Incluido en el análisis AN-001.',
      'Clasificado como Conflicto confirmado. Observación: Confirmado en entrevista.',
      'Análisis AN-001 validado.'
    ]);
  }));

  it('al volver a subir una rechazada, la anterior sigue en el historial', fakeAsync(() => {
    spyOn(URL, 'createObjectURL').and.returnValue('blob:prueba');
    perfil.empleadoId = 'EMP-010';
    esperar(TestBed.inject(PlanesMockService).subirEvidencia('PL-002', 'A-015',
      new File(['x'], 'auditoria-v2.png', { type: 'image/png' })));

    const h = esperar(servicio.obtenerHistorial('C-001')) as HistorialConflicto;
    const a015 = h.planes[1].actividades.find((a) => a.actividad.id === 'A-015');

    expect(a015?.eventos.map((e) => e.texto)).toEqual([
      'Asignada a Fernando José Andrade Vela · plazo 2 meses y 15 días · vence el 16/08/2026.',
      'Evidencia subida: A-015-registro-auditoria.png.',
      'Evidencia rechazada: La captura no muestra la fecha en que se activó el registro.',
      'Venció sin evidencia aprobada.',
      'Evidencia subida: auditoria-v2.png.'
    ]);
  }));
});
