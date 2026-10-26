import { calcularFechaLimite, parsearFecha } from '../../utils/fechas.util';
import { derivarEstadoPlan, hayPlanActivo } from '../../utils/planes.util';
import { TIPOS_CONTRATO, TIPOS_PROCESO_EXCUSA } from './catalogos.data';
import { CONFLICTOS } from './conflictos.data';
import { EXCUSAS } from './excusas.data';
import { FORMULARIOS } from './formularios.data';
import { PERSONAS } from './personas.data';
import { PLANES } from './planes.data';

/**
 * Comprueba que los datos de ejemplo cumplen las mismas reglas que se
 * aplicaran en las pantallas, para que no enganen al probarlas.
 */
describe('datos de ejemplo de gestión de conflictos', () => {

  it('el estado de cada plan coincide con derivarEstadoPlan', () => {
    for (const plan of PLANES) {
      expect(derivarEstadoPlan(plan.actividades, plan.fechaInicio))
        .withContext(plan.id)
        .toBe(plan.estado);
    }
  });

  it('las fechas límite coinciden con calcularFechaLimite', () => {
    for (const plan of PLANES) {
      for (const actividad of plan.actividades) {
        if (plan.fechaInicio === undefined) {
          expect(actividad.fechaLimite).withContext(actividad.id)
            .toBeUndefined();
          continue;
        }
        expect(calcularFechaLimite(
          plan.fechaInicio,
          actividad.plazoMeses,
          actividad.plazoDias
        )).withContext(actividad.id).toBe(
          calcularFechaLimite(actividad.fechaLimite ?? '', 0, 0)
        );
      }
    }
  });

  it('ningún conflicto tiene más de un plan vigente', () => {
    for (const conflicto of CONFLICTOS) {
      const vigentes = conflicto.planes
        .filter((p) => hayPlanActivo([p])).length;

      expect(vigentes).withContext(conflicto.id).toBeLessThanOrEqual(1);
    }
  });

  it('los responsables de las actividades existen', () => {
    const ids = PERSONAS.map((p) => p.id);

    for (const plan of PLANES) {
      for (const actividad of plan.actividades) {
        expect(ids).withContext(actividad.id)
          .toContain(actividad.responsableId);
      }
    }
  });

  it('formularios y excusas usan los catálogos provisionales', () => {
    for (const formulario of FORMULARIOS) {
      expect(TIPOS_CONTRATO).withContext(formulario.id)
        .toContain(formulario.tipoContrato);
    }
    for (const excusa of EXCUSAS) {
      expect(TIPOS_PROCESO_EXCUSA).withContext(excusa.id)
        .toContain(excusa.proceso);
    }
  });

  it('las fechas de ejemplo son válidas', () => {
    for (const conflicto of CONFLICTOS) {
      expect(() => parsearFecha(conflicto.fechaDeteccion)).not.toThrow();
    }
  });
});

describe('cobertura de los conflictos de ejemplo (Análisis de Conflictos)', () => {
  /**
   * @param valores Valores encontrados.
   * @returns Los valores distintos, ordenados.
   */
  function distintos<T>(valores: T[]): T[] {
    return [...new Set(valores)].sort();
  }

  it('cubren los 4 riesgos, las 2 relaciones, los grados 1 a 4 y «sin grado»', () => {
    expect(distintos(CONFLICTOS.map((c) => c.riesgo)))
      .toEqual(['ALTO', 'BAJO', 'CRITICO', 'MEDIO']);
    expect(distintos(CONFLICTOS.map((c) => c.relacion)))
      .toEqual(['Afinidad', 'Consanguinidad']);
    expect(distintos(CONFLICTOS.map((c) => c.grado))).toEqual([1, 2, 3, 4, null]);
    expect(CONFLICTOS.filter((c) => c.grado === null).map((c) => c.etiquetaSimetrica))
      .withContext('solo los cónyuges no tienen grado').toEqual(['Cónyuges']);
  });

  it('cubren las clasificaciones D, N, H y sin clasificar', () => {
    expect(distintos(CONFLICTOS.map((c) => c.clasificacion)))
      .toEqual(['D', 'H', 'N', null]);
  });

  it('cubren todos los estados de seguimiento salvo EN_ANALISIS', () => {
    expect(distintos(CONFLICTOS.map((c) => c.estado)))
      .toEqual(['DESCARTADO', 'DETECTADO', 'EN_EJECUCION', 'EN_PLANIFICACION', 'FINALIZADO']);
  });

  it('los casos sin clasificar están DETECTADO y los homónimos DESCARTADO', () => {
    for (const c of CONFLICTOS) {
      if (c.clasificacion === null) {
        expect(c.estado).withContext(c.id).toBe('DETECTADO');
      }
      if (c.clasificacion === 'H') {
        expect(c.estado).withContext(c.id).toBe('DESCARTADO');
      }
    }
  });

  it('los planes cerrados traen su tipo de cierre y las evidencias un id único', () => {
    const ids = PLANES.flatMap((p) => p.actividades.flatMap((a) => [
      ...(a.evidenciasAnteriores ?? []),
      ...(a.evidencia ? [a.evidencia] : [])
    ])).map((e) => e.id);

    for (const plan of PLANES.filter((p) => p.estado === 'CERRADO')) {
      expect(plan.tipoCierre).withContext(plan.id).toBeDefined();
    }
    expect(ids.every((id) => id !== '')).toBeTrue();
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('tienen vínculos simétricos y con roles distintos', () => {
    const simetricas = CONFLICTOS.map((c) => c.etiquetaSimetrica).filter((e) => e);

    expect(simetricas).toContain('Hermanos');
    expect(simetricas).toContain('Cónyuges');
    expect(simetricas.some((e) => e?.startsWith('Prim'))).toBeTrue();
    expect(CONFLICTOS.some((c) => !c.etiquetaSimetrica && c.rolA === 'Tío' && c.rolB === 'Sobrino'))
      .toBeTrue();
    expect(CONFLICTOS.some((c) => !c.etiquetaSimetrica
      && [c.rolA, c.rolB].includes('Hija') && [c.rolA, c.rolB].includes('Padre'))).toBeTrue();
  });

  it('hay conflictos con 0, 1 y varios planes', () => {
    const cantidades = CONFLICTOS.map((c) => c.planes.length);

    expect(cantidades).toContain(0);
    expect(cantidades).toContain(1);
    expect(cantidades.some((n) => n > 1)).toBeTrue();
  });

  it('los homónimos no tienen planes', () => {
    for (const c of CONFLICTOS.filter((x) => x.clasificacion === 'H')) {
      expect(c.planes.length).withContext(c.id).toBe(0);
    }
  });
});
