import { Actividad, EstadoActividad, EstadoPlan, PlanAccion } from '../models';
import {
  calcularAvance,
  derivarEstadoPlan,
  hayPlanActivo,
  obtenerPlanActual,
  textoEstadoPlan
} from './planes.util';

/**
 * Crea actividades de prueba con los estados indicados.
 *
 * @param estados Estado de cada actividad.
 * @returns Actividades minimas validas.
 */
function actividades(...estados: EstadoActividad[]): Actividad[] {
  return estados.map((estado, i) => ({
    id: 'A-' + i,
    descripcion: 'Actividad ' + i,
    responsableId: 'EMP-001',
    responsableNombre: 'Responsable',
    plazoMeses: 1,
    plazoDias: 0,
    estado
  }));
}

/**
 * Crea planes de prueba con los estados indicados.
 *
 * @param estados Estado de cada plan.
 * @returns Planes minimos validos.
 */
function planes(...estados: EstadoPlan[]): PlanAccion[] {
  return estados.map((estado, i) => ({
    id: 'PL-' + i,
    numero: i + 1,
    nombre: 'Plan ' + i,
    conflictoId: 'C-001',
    estado,
    actividades: []
  }));
}

describe('planes.util', () => {
  const INICIO = '2026-06-01';

  describe('derivarEstadoPlan', () => {
    it('borrador si el plan no se ha enviado', () => {
      expect(derivarEstadoPlan(actividades('pendiente'), undefined))
        .toBe('borrador');
      expect(derivarEstadoPlan(actividades('aprobada'), undefined))
        .toBe('borrador');
    });

    it('cerrado si todas las actividades están aprobadas', () => {
      expect(derivarEstadoPlan(
        actividades('aprobada', 'aprobada', 'aprobada'), INICIO
      )).toBe('cerrado');
    });

    it('activo_vencidas con una vencida entre varias cumplidas', () => {
      expect(derivarEstadoPlan(
        actividades('aprobada', 'vencida', 'aprobada'), INICIO
      )).toBe('activo_vencidas');
    });

    it('activo si hay pendientes, en revisión o rechazadas', () => {
      expect(derivarEstadoPlan(
        actividades('aprobada', 'pendiente', 'en_revision',
          'rechazada'),
        INICIO
      )).toBe('activo');
    });

    it('un plan enviado sin actividades queda activo, no cerrado', () => {
      expect(derivarEstadoPlan([], INICIO)).toBe('activo');
    });
  });

  describe('calcularAvance', () => {
    it('plan sin actividades: 0 % sin dividir por cero', () => {
      expect(calcularAvance([]))
        .toEqual({ cumplidas: 0, total: 0, porcentaje: 0 });
    });

    it('plan con todas cumplidas: 100 %', () => {
      expect(calcularAvance(actividades('aprobada', 'aprobada')))
        .toEqual({ cumplidas: 2, total: 2, porcentaje: 100 });
    });

    it('solo cuenta como cumplidas las aprobadas y redondea', () => {
      expect(calcularAvance(
        actividades('aprobada', 'en_revision', 'rechazada')
      )).toEqual({ cumplidas: 1, total: 3, porcentaje: 33 });
    });
  });

  describe('hayPlanActivo', () => {
    it('false sin planes', () => {
      expect(hayPlanActivo([])).toBeFalse();
    });

    it('true con un plan activo', () => {
      expect(hayPlanActivo(planes('cerrado', 'activo'))).toBeTrue();
    });

    it('true con un plan activo con actividades vencidas', () => {
      expect(hayPlanActivo(planes('activo_vencidas'))).toBeTrue();
    });

    it('false si todos los planes están cerrados', () => {
      expect(hayPlanActivo(planes('cerrado', 'cerrado', 'cerrado')))
        .toBeFalse();
    });

    it('true con un plan en borrador (decisión documentada)', () => {
      expect(hayPlanActivo(planes('cerrado', 'borrador'))).toBeTrue();
    });
  });
});

describe('planes.util: textos y plan actual', () => {
  /**
   * @param estados Estado de cada plan, en orden de numero.
   * @returns Planes minimos con numero 1, 2, 3...
   */
  function planesDe(...estados: EstadoPlan[]): PlanAccion[] {
    return estados.map((estado, i) => ({
      id: 'PL-' + (i + 1),
      numero: i + 1,
      nombre: 'Plan ' + (i + 1),
      conflictoId: 'C-001',
      estado,
      actividades: []
    }));
  }

  it('textoEstadoPlan', () => {
    expect(textoEstadoPlan('borrador')).toBe('Borrador');
    expect(textoEstadoPlan('activo')).toBe('Activo');
    expect(textoEstadoPlan('activo_vencidas')).toBe('Activo · con vencidas');
    expect(textoEstadoPlan('cerrado')).toBe('Cerrado');
  });

  it('obtenerPlanActual: sin planes, null', () => {
    expect(obtenerPlanActual([])).toBeNull();
  });

  it('obtenerPlanActual: el que no está cerrado', () => {
    expect(obtenerPlanActual(planesDe('cerrado', 'activo_vencidas'))?.id).toBe('PL-2');
    expect(obtenerPlanActual(planesDe('cerrado', 'borrador'))?.id).toBe('PL-2');
  });

  it('obtenerPlanActual: si todos están cerrados, el más reciente', () => {
    const todosCerrados = planesDe('cerrado', 'cerrado', 'cerrado').reverse();

    expect(obtenerPlanActual(todosCerrados)?.id).toBe('PL-3');
  });
});
