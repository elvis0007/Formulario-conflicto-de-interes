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
      totalActividades: actividades.length + 1
    };
  }

  it('esFiltroEstado acepta solo los filtros conocidos', () => {
    expect(esFiltroEstado('rechazada')).toBeTrue();
    expect(esFiltroEstado('todas')).toBeTrue();
    expect(esFiltroEstado('borrador')).toBeFalse();
    expect(esFiltroEstado(null)).toBeFalse();
  });

  it('contarEstados y contarPorHacer', () => {
    const actividades = [act('1', 'pendiente'), act('2', 'rechazada'), act('3', 'aprobada'), act('4', 'vencida')];

    expect(contarEstados(actividades)).toEqual({ pendiente: 1, en_revision: 0, aprobada: 1, rechazada: 1, vencida: 1 });
    expect(contarPorHacer(actividades)).toBe(3);
  });

  it('planCoincideConFiltro: al menos una actividad en ese estado', () => {
    const p = plan('P1', 'activo', [act('1', 'pendiente'), act('2', 'aprobada')]);

    expect(planCoincideConFiltro(p, 'todas')).toBeTrue();
    expect(planCoincideConFiltro(p, 'aprobada')).toBeTrue();
    expect(planCoincideConFiltro(p, 'rechazada')).toBeFalse();
  });

  it('ordenarPorUrgencia: rechazadas, vencidas, pendientes, otros activos y cerrados al final', () => {
    const orden = ordenarPorUrgencia([
      plan('CERRADO', 'cerrado', [act('1', 'aprobada')], 'C-001'),
      plan('REVISION', 'activo', [act('2', 'en_revision')], 'C-001'),
      plan('PENDIENTE', 'activo', [act('3', 'pendiente')], 'C-001'),
      plan('VENCIDA', 'activo_vencidas', [act('4', 'vencida'), act('5', 'pendiente')], 'C-001'),
      plan('RECHAZADA', 'activo', [act('6', 'rechazada')], 'C-002')
    ]).map((p) => p.plan.id);

    expect(orden).toEqual(['RECHAZADA', 'VENCIDA', 'PENDIENTE', 'REVISION', 'CERRADO']);
  });

  it('proximasAVencer: solo pendientes y rechazadas con fecha, de la más urgente a la más lejana', () => {
    const proximas = proximasAVencer([
      plan('P1', 'activo', [
        act('lejana', 'pendiente', '2026-10-26'),
        act('hoy', 'pendiente', '2026-10-02'),
        act('revision', 'en_revision', '2026-10-01'),
        act('vencida', 'vencida', '2026-09-01'),
        act('sin-fecha', 'pendiente')
      ]),
      plan('P2', 'activo', [act('rechazada', 'rechazada', '2026-08-16')])
    ], HOY);

    expect(proximas.map((p) => [p.actividad.id, p.fechaLimite, p.dias.texto, p.plan.id])).toEqual([
      ['rechazada', '16/08/2026', 'Vencida hace 47 días', 'P2'],
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
