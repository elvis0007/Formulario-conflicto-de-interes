import { AnalisisConflictos, Conflicto, EventoHistorial, PlanAccion } from '../models';
import { CONFLICTOS } from '../services/mock-data/conflictos.data';
import { PLANES } from '../services/mock-data/planes.data';
import {
  AUTOR_SISTEMA,
  armarHistorial,
  estadoDeConflicto,
  eventosRecientes,
  instanteDe,
  todosLosEventos
} from './historial.util';

describe('historial.util', () => {
  const HOY = new Date(2026, 9, 2, 10, 0);

  /**
   * @param id Conflicto.
   * @returns El conflicto de ejemplo.
   */
  function conflicto(id: string): Conflicto {
    return CONFLICTOS.find((c) => c.id === id) as Conflicto;
  }

  /**
   * @param conflictoId Conflicto.
   * @returns Sus planes de ejemplo.
   */
  function planes(conflictoId: string): PlanAccion[] {
    return structuredClone(PLANES.filter((p) => p.conflictoId === conflictoId));
  }

  /**
   * @param eventos Eventos.
   * @returns [texto, autor, tipo] de cada uno.
   */
  function resumen(eventos: EventoHistorial[]): [string, string, string][] {
    return eventos.map((e) => [e.texto, e.autor, e.tipo]);
  }

  it('nivel conflicto: detección y clasificación del dato de ejemplo', () => {
    const h = armarHistorial(conflicto('C-002'), planes('C-002'), [], HOY);

    expect(resumen(h.eventos)).toEqual([
      ['Conflicto detectado: Tío / Sobrino · Consanguinidad, 3er grado (riesgo moderado).', AUTOR_SISTEMA, 'info'],
      ['Clasificado como Declarado.', 'RRHH', 'ok']
    ]);
    expect(h.eventos.every((e) => e.nivel === 'conflicto' && e.refId === 'C-002')).toBeTrue();
  });

  it('nivel conflicto: análisis de la sesión, clasificación con autor y validación', () => {
    const caso: Conflicto = {
      ...conflicto('C-005'),
      clasificacion: 'D',
      observacionClasificacion: 'Revisado con la ficha.',
      fechaClasificacion: '2026-10-02T09:10:00',
      clasificadoPor: 'Lucía Alejandra Freire Ortiz'
    };
    const analisis: AnalisisConflictos = {
      id: 'AN-001',
      estado: 'VALIDADO',
      fechaGeneracion: '2026-10-02T09:00:00',
      fechaValidacion: '2026-10-02T09:30:00',
      validadoPor: 'Lucía Alejandra Freire Ortiz',
      conflictos: [caso]
    };
    const h = armarHistorial(conflicto('C-005'), [], [analisis], HOY);

    expect(resumen(h.eventos)).toEqual([
      ['Conflicto detectado: Cuñados · Afinidad, 2do grado (riesgo moderado).', AUTOR_SISTEMA, 'info'],
      ['Incluido en el análisis AN-001.', 'RRHH', 'info'],
      ['Clasificado como Declarado. Observación: Revisado con la ficha.', 'Lucía Alejandra Freire Ortiz', 'ok'],
      ['Análisis AN-001 validado.', 'Lucía Alejandra Freire Ortiz', 'ok']
    ]);
  });

  it('un homónimo se registra como archivado', () => {
    const h = armarHistorial(conflicto('C-006'), [], [], HOY);

    expect(h.eventos[1]).toEqual(jasmine.objectContaining({ texto: 'Clasificado como Homónimo: se archiva.', tipo: 'cierre' }));
  });

  it('nivel plan: creado, documento, enviado y cerrado', () => {
    const h = armarHistorial(conflicto('C-001'), planes('C-001'), [], HOY);

    expect(h.planes.map((p) => p.plan.id)).toEqual(['PL-001', 'PL-002']);
    expect(resumen(h.planes[0].eventos)).toEqual([
      ['Plan creado en borrador.', 'Lucía Alejandra Freire Ortiz', 'info'],
      ['Documento firmado subido: PL-001-plan-firmado.pdf.', 'Lucía Alejandra Freire Ortiz', 'info'],
      ['Plan enviado y notificado a 2 responsables.', 'Lucía Alejandra Freire Ortiz', 'info'],
      ['Plan cerrado: todas las actividades fueron aprobadas.', AUTOR_SISTEMA, 'cierre']
    ]);
  });

  it('nivel actividad: asignada, evidencia rechazada y reemplazada, aprobada', () => {
    const h = armarHistorial(conflicto('C-002'), planes('C-002'), [], HOY);
    const a007 = h.planes[0].actividades.find((a) => a.actividad.id === 'A-007');

    expect(resumen(a007?.eventos ?? [])).toEqual([
      ['Asignada a Fernando José Andrade Vela · plazo 1 mes y 15 días · vence el 02/10/2026.', 'Lucía Alejandra Freire Ortiz', 'info'],
      ['Evidencia subida: A-007-matriz-firmas.pdf.', 'Fernando José Andrade Vela', 'info'],
      ['Evidencia rechazada: La matriz no tiene la firma del jefe de área.', 'Lucía Alejandra Freire Ortiz', 'rechazo'],
      ['Evidencia subida: A-007-matriz-firmas-v2.pdf.', 'Fernando José Andrade Vela', 'info'],
      ['Evidencia aprobada.', 'Lucía Alejandra Freire Ortiz', 'ok']
    ]);
  });

  it('vencimiento: el día siguiente a la fecha límite sin aprobación a tiempo', () => {
    const h = armarHistorial(conflicto('C-001'), planes('C-001'), [], HOY);
    const a003 = h.planes[1].actividades.find((a) => a.actividad.id === 'A-003');
    const a004 = h.planes[1].actividades.find((a) => a.actividad.id === 'A-004');

    expect(a003?.eventos.at(-1)).toEqual(jasmine.objectContaining({
      fecha: '2026-08-02', texto: 'Venció sin evidencia aprobada.', tipo: 'vencido', autor: AUTOR_SISTEMA
    }));
    expect(a004?.eventos.some((e) => e.tipo === 'vencido')).withContext('aprobada antes del límite').toBeFalse();
  });

  it('un borrador solo tiene su creación; sus actividades no tienen eventos', () => {
    const h = armarHistorial(conflicto('C-003'), planes('C-003'), [], HOY);

    expect(resumen(h.planes[0].eventos)).toEqual([['Plan creado en borrador.', 'Lucía Alejandra Freire Ortiz', 'info']]);
    expect(h.planes[0].actividades.every((a) => a.eventos.length === 0)).toBeTrue();
  });

  it('todos los eventos quedan en orden cronológico', () => {
    const eventos = todosLosEventos(armarHistorial(conflicto('C-001'), planes('C-001'), [], HOY));
    const instantes = eventos.map((e) => instanteDe(e.fecha));

    expect(instantes).toEqual([...instantes].sort((a, b) => a - b));
    expect(eventos.length).toBeGreaterThan(10);
  });

  it('estado del conflicto para las tarjetas', () => {
    const estado = (id: string): string => estadoDeConflicto(conflicto(id), planes(id));

    expect(['C-001', 'C-003', 'C-004', 'C-005', 'C-006', 'C-008'].map(estado))
      .toEqual(['activo', 'borrador', 'cerrado', 'sin-plan', 'archivado', 'borrador']);
  });

  it('eventos recientes: de varios conflictos, del más nuevo al más viejo, sin fechas futuras', () => {
    const historiales = ['C-001', 'C-002'].map((id) => armarHistorial(conflicto(id), planes(id), [], HOY));
    const recientes = eventosRecientes(historiales, HOY, 5);
    const instantes = recientes.map((r) => instanteDe(r.evento.fecha));

    expect(recientes.length).toBe(5);
    expect(instantes).toEqual([...instantes].sort((a, b) => b - a));
    expect(instantes.every((i) => i <= HOY.getTime())).toBeTrue();
    expect(new Set(recientes.map((r) => r.conflictoId))).toEqual(new Set(['C-001', 'C-002']));
  });
});
