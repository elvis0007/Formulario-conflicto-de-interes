import { Actividad, PlanAccion } from '../models';
import {
  agruparPorResponsable,
  contarResumen,
  esPlanActivo,
  iniciales,
  textoEstadoActividad
} from './revision.util';

describe('revision.util', () => {
  const HOY = new Date(2026, 9, 2, 10, 0);

  /**
   * @param id Id.
   * @param responsableId Responsable.
   * @param cambios Campos a cambiar.
   * @returns Una actividad de prueba.
   */
  function act(id: string, responsableId: string, cambios: Partial<Actividad> = {}): Actividad {
    return {
      id,
      descripcion: 'Actividad ' + id,
      responsableId,
      responsableNombre: 'Nombre ' + responsableId,
      plazoMeses: 0,
      plazoDias: 15,
      estado: 'pendiente',
      ...cambios
    };
  }

  /**
   * @param estado Estado de la evidencia.
   * @param fechaRevision Fecha de revision.
   * @returns Campos de una actividad revisada.
   */
  function revisada(estado: 'aprobada' | 'rechazada', fechaRevision: string): Partial<Actividad> {
    return {
      estado,
      evidencia: {
        archivo: { nombre: 'x.pdf', url: '/mock/archivos/x.pdf', tipo: 'pdf' },
        fechaSubida: '2026-09-30T10:00:00',
        estado,
        fechaRevision
      }
    };
  }

  /**
   * @param estado Estado del plan.
   * @param actividades Actividades.
   * @returns Un plan de prueba.
   */
  function plan(estado: PlanAccion['estado'], actividades: Actividad[]): PlanAccion {
    return { id: 'PL', numero: 1, nombre: 'Plan', conflictoId: 'C-001', estado, actividades };
  }

  it('textos de estado para RRHH y para el Responsable', () => {
    expect(textoEstadoActividad('pendiente', false)).toBe('Pendiente de evidencia');
    expect(textoEstadoActividad('aprobada', false)).toBe('Aprobada · Cumplida');
    expect(textoEstadoActividad('en_revision', true)).toBe('En revisión de RRHH');
    expect(textoEstadoActividad('vencida', true)).toBe('Pendiente');
  });

  it('esPlanActivo: activo y activo con vencidas', () => {
    expect(esPlanActivo(plan('activo', []))).toBeTrue();
    expect(esPlanActivo(plan('activo_vencidas', []))).toBeTrue();
    expect(esPlanActivo(plan('cerrado', []))).toBeFalse();
    expect(esPlanActivo(plan('borrador', []))).toBeFalse();
  });

  it('iniciales: primer nombre y primer apellido', () => {
    expect(iniciales('Carlos Andrés Mayorga Sánchez')).toBe('CM');
    expect(iniciales('Jorge Mayorga')).toBe('JM');
    expect(iniciales('  ana  ')).toBe('A');
    expect(iniciales('')).toBe('?');
  });

  it('contarResumen: por revisar solo en planes activos; revisadas hoy en cualquier plan', () => {
    const resumen = contarResumen([
      plan('activo', [
        act('1', 'E1', { estado: 'en_revision' }),
        act('2', 'E1', revisada('aprobada', '2026-10-02T09:00:00')),
        act('3', 'E2', revisada('rechazada', '2026-10-02T08:00:00')),
        act('4', 'E2', revisada('aprobada', '2026-10-01T18:00:00'))
      ]),
      plan('cerrado', [act('5', 'E3', revisada('aprobada', '2026-10-02T09:30:00'))]),
      plan('borrador', [act('6', 'E3', { estado: 'en_revision' })])
    ], HOY);

    expect(resumen).toEqual({ porRevisar: 1, aprobadasHoy: 2, rechazadasHoy: 1 });
  });

  it('agruparPorResponsable: un grupo por responsable, en orden de aparición', () => {
    const grupos = agruparPorResponsable([act('1', 'E2'), act('2', 'E1'), act('3', 'E2')]);

    expect(grupos.map((g) => [g.responsableId, g.nombre, g.iniciales, g.actividades.map((a) => a.id)]))
      .toEqual([
        ['E2', 'Nombre E2', 'NE', ['1', '3']],
        ['E1', 'Nombre E1', 'NE', ['2']]
      ]);
  });
});
