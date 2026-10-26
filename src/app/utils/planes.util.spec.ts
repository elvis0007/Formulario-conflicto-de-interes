import { Actividad, EstadoActividad, EstadoPlan, PlanAccion } from '../models';
import {
  actividadCompleta,
  calcularAvance,
  derivarEstadoPlan,
  estaVencida,
  estadoVistaActividad,
  hayPlanActivo,
  obtenerPlanActual,
  responsablesDelPlan,
  textoEstadoPlan,
  textoTipoCierre,
  tieneActividadesVencidas
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
    it('BORRADOR si el plan no se ha enviado', () => {
      expect(derivarEstadoPlan(actividades('PENDIENTE'), undefined))
        .toBe('BORRADOR');
      expect(derivarEstadoPlan(actividades('ACEPTADA'), undefined))
        .toBe('BORRADOR');
    });

    it('CERRADO si todas las actividades están aceptadas', () => {
      expect(derivarEstadoPlan(
        actividades('ACEPTADA', 'ACEPTADA', 'ACEPTADA'), INICIO
      )).toBe('CERRADO');
    });

    it('FIRMADO aunque haya vencidas: el vencimiento se calcula aparte', () => {
      expect(derivarEstadoPlan(
        actividades('ACEPTADA', 'PENDIENTE', 'ACEPTADA'), INICIO
      )).toBe('FIRMADO');
    });

    it('FIRMADO si hay pendientes, en revisión o rechazadas', () => {
      expect(derivarEstadoPlan(
        actividades('ACEPTADA', 'PENDIENTE', 'EN_REVISION',
          'RECHAZADA'),
        INICIO
      )).toBe('FIRMADO');
    });

    it('un plan enviado sin actividades queda FIRMADO, no CERRADO', () => {
      expect(derivarEstadoPlan([], INICIO)).toBe('FIRMADO');
    });
  });

  describe('calcularAvance', () => {
    it('plan sin actividades: 0 % sin dividir por cero', () => {
      expect(calcularAvance([]))
        .toEqual({ cumplidas: 0, total: 0, porcentaje: 0 });
    });

    it('plan con todas cumplidas: 100 %', () => {
      expect(calcularAvance(actividades('ACEPTADA', 'ACEPTADA')))
        .toEqual({ cumplidas: 2, total: 2, porcentaje: 100 });
    });

    it('solo cuenta como cumplidas las aceptadas y redondea', () => {
      expect(calcularAvance(
        actividades('ACEPTADA', 'EN_REVISION', 'RECHAZADA')
      )).toEqual({ cumplidas: 1, total: 3, porcentaje: 33 });
    });
  });

  describe('hayPlanActivo', () => {
    it('false sin planes', () => {
      expect(hayPlanActivo([])).toBeFalse();
    });

    it('true con un plan firmado', () => {
      expect(hayPlanActivo(planes('CERRADO', 'FIRMADO'))).toBeTrue();
    });

    it('false si todos los planes están cerrados', () => {
      expect(hayPlanActivo(planes('CERRADO', 'CERRADO', 'CERRADO')))
        .toBeFalse();
    });

    it('true con un plan en borrador (decisión documentada)', () => {
      expect(hayPlanActivo(planes('CERRADO', 'BORRADOR'))).toBeTrue();
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
    expect(textoEstadoPlan('BORRADOR')).toBe('Borrador');
    expect(textoEstadoPlan('FIRMADO')).toBe('Activo');
    expect(textoEstadoPlan('FIRMADO', true)).toBe('Activo · con vencidas');
    expect(textoEstadoPlan('CERRADO')).toBe('Cerrado');
    expect(textoEstadoPlan('CERRADO', true)).toBe('Cerrado');
    expect(textoEstadoPlan('CERRADO', false, 'CUMPLIDO')).toBe('Cerrado · Cumplido');
    expect(textoEstadoPlan('CERRADO', false, 'ANTICIPADO')).toBe('Cerrado · Cierre anticipado');
    expect(textoEstadoPlan('FIRMADO', false, 'ANTICIPADO')).toBe('Activo');
  });

  it('textoTipoCierre', () => {
    expect(textoTipoCierre('CUMPLIDO')).toBe('Cumplido');
    expect(textoTipoCierre('ANTICIPADO')).toBe('Cierre anticipado');
    expect(textoTipoCierre(undefined)).toBe('');
  });

  it('obtenerPlanActual: sin planes, null', () => {
    expect(obtenerPlanActual([])).toBeNull();
  });

  it('obtenerPlanActual: el que no está cerrado', () => {
    expect(obtenerPlanActual(planesDe('CERRADO', 'FIRMADO'))?.id).toBe('PL-2');
    expect(obtenerPlanActual(planesDe('CERRADO', 'BORRADOR'))?.id).toBe('PL-2');
  });

  it('obtenerPlanActual: si todos están cerrados, el más reciente', () => {
    const todosCerrados = planesDe('CERRADO', 'CERRADO', 'CERRADO').reverse();

    expect(obtenerPlanActual(todosCerrados)?.id).toBe('PL-3');
  });
});

describe('planes.util: actividades completas y responsables', () => {
  const COMPLETA = {
    descripcion: 'Firmar la declaración',
    responsableId: 'EMP-001',
    plazoMeses: 0,
    plazoDias: 15
  };

  it('actividadCompleta exige descripción, responsable y plazo válido', () => {
    expect(actividadCompleta(COMPLETA)).toBeTrue();
    expect(actividadCompleta({ ...COMPLETA, descripcion: '   ' })).toBeFalse();
    expect(actividadCompleta({ ...COMPLETA, responsableId: '' })).toBeFalse();
    expect(actividadCompleta({ ...COMPLETA, plazoDias: 0 })).withContext('plazo 0').toBeFalse();
    expect(actividadCompleta({ ...COMPLETA, plazoMeses: -1 })).toBeFalse();
    expect(actividadCompleta({ ...COMPLETA, plazoDias: 1.5 })).toBeFalse();
  });

  it('responsablesDelPlan: distintos, en orden, con su número de actividades', () => {
    const actividades: Actividad[] = [
      { id: 'A-1', descripcion: 'a', responsableId: 'EMP-001', responsableNombre: 'Carlos', plazoMeses: 1, plazoDias: 0, estado: 'PENDIENTE' },
      { id: 'A-2', descripcion: 'b', responsableId: 'EMP-003', responsableNombre: 'Diana', plazoMeses: 1, plazoDias: 0, estado: 'PENDIENTE' },
      { id: 'A-3', descripcion: 'c', responsableId: 'EMP-001', responsableNombre: 'Carlos', plazoMeses: 1, plazoDias: 0, estado: 'PENDIENTE' },
      { id: 'A-4', descripcion: 'd', responsableId: '', responsableNombre: '', plazoMeses: 1, plazoDias: 0, estado: 'PENDIENTE' }
    ];

    expect(responsablesDelPlan(actividades)).toEqual([
      { id: 'EMP-001', nombre: 'Carlos', actividades: 2 },
      { id: 'EMP-003', nombre: 'Diana', actividades: 1 }
    ]);
  });
});

describe('planes.util: vencimiento calculado', () => {
  const HOY = new Date(2026, 9, 2, 10, 0);

  /**
   * @param estado Estado de la actividad.
   * @param fechaLimite Fecha limite (`aaaa-mm-dd`), si la tiene.
   * @returns Actividad minima valida.
   */
  function actividad(estado: EstadoActividad, fechaLimite?: string): Actividad {
    return {
      id: 'A-1',
      descripcion: 'Actividad',
      responsableId: 'EMP-001',
      responsableNombre: 'Responsable',
      plazoMeses: 1,
      plazoDias: 0,
      estado,
      fechaLimite
    };
  }

  describe('estaVencida', () => {
    it('PENDIENTE o RECHAZADA con la fecha limite pasada', () => {
      expect(estaVencida(actividad('PENDIENTE', '2026-10-01'), HOY)).toBeTrue();
      expect(estaVencida(actividad('RECHAZADA', '2026-09-01'), HOY)).toBeTrue();
    });

    it('la fecha limite de hoy todavía no está vencida', () => {
      expect(estaVencida(actividad('PENDIENTE', '2026-10-02'), HOY)).toBeFalse();
    });

    it('EN_REVISION, ACEPTADA y NO_CUMPLIDA nunca vencen', () => {
      expect(estaVencida(actividad('EN_REVISION', '2026-01-01'), HOY)).toBeFalse();
      expect(estaVencida(actividad('ACEPTADA', '2026-01-01'), HOY)).toBeFalse();
      expect(estaVencida(actividad('NO_CUMPLIDA', '2026-01-01'), HOY)).toBeFalse();
    });

    it('sin fecha límite (borrador) o con fecha inválida, no', () => {
      expect(estaVencida(actividad('PENDIENTE'), HOY)).toBeFalse();
      expect(estaVencida(actividad('PENDIENTE', 'no-es-fecha'), HOY)).toBeFalse();
    });
  });

  describe('tieneActividadesVencidas', () => {
    const vencida = actividad('PENDIENTE', '2026-09-01');
    const aTiempo = actividad('PENDIENTE', '2026-12-01');

    it('un plan FIRMADO con una vencida', () => {
      expect(tieneActividadesVencidas({ estado: 'FIRMADO', actividades: [aTiempo, vencida] }, HOY))
        .toBeTrue();
    });

    it('un plan FIRMADO sin vencidas', () => {
      expect(tieneActividadesVencidas({ estado: 'FIRMADO', actividades: [aTiempo] }, HOY))
        .toBeFalse();
    });

    it('un plan cerrado o en borrador nunca la tiene', () => {
      expect(tieneActividadesVencidas({ estado: 'CERRADO', actividades: [vencida] }, HOY)).toBeFalse();
      expect(tieneActividadesVencidas({ estado: 'BORRADOR', actividades: [vencida] }, HOY)).toBeFalse();
    });
  });

  it('estadoVistaActividad: VENCIDA si venció; si no, su estado', () => {
    expect(estadoVistaActividad(actividad('PENDIENTE', '2026-09-01'), HOY)).toBe('VENCIDA');
    expect(estadoVistaActividad(actividad('PENDIENTE', '2026-12-01'), HOY)).toBe('PENDIENTE');
    expect(estadoVistaActividad(actividad('NO_CUMPLIDA', '2026-09-01'), HOY)).toBe('NO_CUMPLIDA');
  });
});
