import { CONFLICTOS } from '../services/mock-data/conflictos.data';
import { Conflicto, Riesgo } from '../models';
import { PLAZO_SEGUIMIENTO_MESES, PLAZO_SUGERIDO_MESES, sugerirActividades } from './sugerencia-plan.util';

describe('sugerirActividades', () => {
  /**
   * @param riesgo Riesgo del caso.
   * @returns C-001 con ese riesgo.
   */
  function conRiesgo(riesgo: Riesgo): Conflicto {
    return { ...CONFLICTOS.find((c) => c.id === 'C-001') as Conflicto, riesgo };
  }

  it('Bajo y Moderado: excusa y seguimiento', () => {
    for (const riesgo of ['BAJO', 'MEDIO'] as const) {
      const lista = sugerirActividades(conRiesgo(riesgo));

      expect(lista.length).withContext(riesgo).toBe(2);
      expect(lista[0].descripcion).toMatch(/^Firmar una declaración de excusa/);
      expect(lista[1].descripcion).toMatch(/^Seguimiento/);
    }
  });

  it('Alto agrega reasignar la supervisión; Crítico además la reubicación', () => {
    expect(sugerirActividades(conRiesgo('ALTO')).map((a) => a.descripcion.split(' ')[0]))
      .toEqual(['Firmar', 'Reasignar', 'Seguimiento:']);
    expect(sugerirActividades(conRiesgo('CRITICO')).map((a) => a.descripcion.split(' ')[0]))
      .toEqual(['Firmar', 'Reasignar', 'Evaluar', 'Seguimiento:']);
  });

  it('nombra a las dos personas, sin responsable y con los plazos del backend', () => {
    const caso = conRiesgo('ALTO');
    const [excusa, supervision, seguimiento] = sugerirActividades(caso);

    expect(excusa.descripcion).toContain(caso.personaA.nombres);
    expect(excusa.descripcion).toContain(caso.personaB.nombres);
    expect(supervision.descripcion).toContain(caso.personaB.nombres);
    expect([excusa, supervision, seguimiento].map((a) => a.responsableSugeridoId)).toEqual([null, null, null]);
    expect(excusa.plazoMeses).toBe(PLAZO_SUGERIDO_MESES);
    expect(seguimiento.plazoMeses).toBe(PLAZO_SEGUIMIENTO_MESES);
    expect(seguimiento.plazoDias).toBe(0);
  });
});
