import { Actividad, PlanAccion, PlanDeResponsable } from '../models';
import {
  contarEstados,
  contarPorHacer,
  esFiltroEstado,
  ordenarPorUrgencia,
  planCoincideConFiltro,
  proximasAVencer,
  textoPlazo
} from './responsable.util';

describe('responsable.util', () => {
  const HOY = new Date(2026, 9, 2, 10, 0);

  /**
   * @param id Id.
   * @param estado Estado.
   * @param fechaLimite Fecha limite ISO.
   * @returns Actividad de prueba.
   */
  function act(id: string, estado: Actividad['estado'], fechaLimite?: string): Actividad {
    return {
      id,
      descripcion: 'Actividad ' + id,
      responsableId: 'EMP-010',
      responsableNombre: 'Fernando',
      plazoMeses: 1,
      plazoDias: 0,
      fechaLimite,
      estado
    };
  }

  /**
   * @param id Id del plan.
   * @param estado Estado del plan.
   * @param actividades Actividades del responsable.
   * @param conflictoId Conflicto.
   * @returns Plan del responsable.
   */
  function plan(
    id: string,
    estado: PlanAccion['estado'],
    actividades: Actividad[],
    conflictoId = 'C-001'
  ): PlanDeResponsable {
    return {
      plan: { id, numero: 1, nombre: 'Plan ' + id, conflictoId, estado, fechaInicio: '2026-06-01', actividades },
      totalActividades: actividades.length + 1,
      nombreA: 'Persona A',
      nombreB: 'Persona B',
      parentesco: 'Hermanos',
      riesgo: 'ALTO'
    };
  }

  it('esFiltroEstado acepta solo los filtros conocidos', () => {
    expect(esFiltroEstado('RECHAZADA')).toBeTrue();
    expect(esFiltroEstado('VENCIDA')).toBeTrue();
    expect(esFiltroEstado('todas')).toBeTrue();
    expect(esFiltroEstado('BORRADOR')).toBeFalse();
    expect(esFiltroEstado('rechazada')).toBeFalse();
    expect(esFiltroEstado(null)).toBeFalse();
  });

  it('contarEstados y contarPorHacer', () => {
    const actividades = [
      act('1', 'PENDIENTE', '2026-12-01'),
      act('2', 'RECHAZADA', '2026-12-01'),
      act('3', 'ACEPTADA', '2026-09-01'),
      act('4', 'PENDIENTE', '2026-09-01')
    ];

    expect(contarEstados(actividades, HOY)).toEqual({
      PENDIENTE: 1, EN_REVISION: 0, ACEPTADA: 1, RECHAZADA: 1, NO_CUMPLIDA: 0, VENCIDA: 1
    });
    expect(contarPorHacer(actividades, HOY)).toBe(3);
  });

  it('planCoincideConFiltro: al menos una actividad en ese estado', () => {
    const p = plan('P1', 'FIRMADO', [act('1', 'PENDIENTE', '2026-09-01'), act('2', 'ACEPTADA')]);

    expect(planCoincideConFiltro(p, 'todas', HOY)).toBeTrue();
    expect(planCoincideConFiltro(p, 'ACEPTADA', HOY)).toBeTrue();
    expect(planCoincideConFiltro(p, 'VENCIDA', HOY)).toBeTrue();
    expect(planCoincideConFiltro(p, 'PENDIENTE', HOY)).toBeFalse();
    expect(planCoincideConFiltro(p, 'RECHAZADA', HOY)).toBeFalse();
  });

  it('ordenarPorUrgencia: rechazadas, vencidas, pendientes, otros activos y cerrados al final', () => {
    const orden = ordenarPorUrgencia([
      plan('CERRADO', 'CERRADO', [act('1', 'ACEPTADA')], 'C-001'),
      plan('REVISION', 'FIRMADO', [act('2', 'EN_REVISION')], 'C-001'),
      plan('PENDIENTE', 'FIRMADO', [act('3', 'PENDIENTE', '2026-12-01')], 'C-001'),
      plan('VENCIDA', 'FIRMADO', [act('4', 'PENDIENTE', '2026-09-01'), act('5', 'PENDIENTE', '2026-12-01')], 'C-001'),
      plan('RECHAZADA', 'FIRMADO', [act('6', 'RECHAZADA', '2026-12-01')], 'C-002')
    ], HOY).map((p) => p.plan.id);

    expect(orden).toEqual(['RECHAZADA', 'VENCIDA', 'PENDIENTE', 'REVISION', 'CERRADO']);
  });

  it('proximasAVencer: solo pendientes y rechazadas con fecha, de la más vencida a la más lejana', () => {
    const proximas = proximasAVencer([
      plan('P1', 'FIRMADO', [
        act('lejana', 'PENDIENTE', '2026-10-26'),
        act('hoy', 'PENDIENTE', '2026-10-02'),
        act('revision', 'EN_REVISION', '2026-10-01'),
        act('vencida', 'PENDIENTE', '2026-09-01'),
        act('aceptada', 'ACEPTADA', '2026-09-01'),
        act('sin-fecha', 'PENDIENTE')
      ]),
      plan('P2', 'FIRMADO', [act('rechazada', 'RECHAZADA', '2026-08-16')])
    ], HOY);

    expect(proximas.map((p) => [p.actividad.id, p.fechaLimite, p.dias.texto, p.plan.id])).toEqual([
      ['rechazada', '16/08/2026', 'Vencida hace 47 días', 'P2'],
      ['vencida', '01/09/2026', 'Vencida hace 31 días', 'P1'],
      ['hoy', '02/10/2026', 'Vence hoy', 'P1'],
      ['lejana', '26/10/2026', 'Vence en 24 días', 'P1']
    ]);
  });

  it('textoPlazo', () => {
    expect(textoPlazo({ plazoMeses: 4, plazoDias: 25 })).toBe('4 meses y 25 días');
    expect(textoPlazo({ plazoMeses: 1, plazoDias: 0 })).toBe('1 mes');
    expect(textoPlazo({ plazoMeses: 0, plazoDias: 1 })).toBe('1 día');
    expect(textoPlazo({ plazoMeses: 0, plazoDias: 0 })).toBe('Sin plazo');
  });
});
