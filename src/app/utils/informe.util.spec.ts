import { CONFLICTOS } from '../services/mock-data/conflictos.data';
import { PLANES } from '../services/mock-data/planes.data';
import {
  FiltrosInforme,
  armarGruposInforme,
  filtrarInforme,
  filtrosInformeVacios,
  responsablesDelInforme
} from './informe.util';

describe('informe.util', () => {
  const GRUPOS = armarGruposInforme(CONFLICTOS, PLANES);

  /**
   * @param cambios Filtros a aplicar.
   * @returns Ids de los conflictos que pasan.
   */
  function filtrar(cambios: Partial<FiltrosInforme>): string[] {
    return filtrarInforme(GRUPOS, { ...filtrosInformeVacios(), ...cambios }).map((g) => g.conflicto.id);
  }

  it('un grupo por conflicto con plan enviado; el plan del grupo es el actual (sin borradores)', () => {
    expect(GRUPOS.map((g) => [g.conflicto.id, g.plan.id, g.plan.estado])).toEqual([
      ['C-001', 'PL-002', 'activo_vencidas'],
      ['C-002', 'PL-003', 'activo'],
      ['C-004', 'PL-005', 'cerrado'],
      ['C-008', 'PL-006', 'cerrado']
    ]);
    // C-003 solo tiene un borrador; C-008 tiene un borrador que no cuenta.
    expect(GRUPOS.some((g) => g.conflicto.id === 'C-003')).toBeFalse();
  });

  it('cada filtro por separado', () => {
    expect(filtrar({})).toEqual(['C-001', 'C-002', 'C-004', 'C-008']);
    expect(filtrar({ estado: 'cerrado' })).toEqual(['C-004', 'C-008']);
    expect(filtrar({ estado: 'activo_vencidas' })).toEqual(['C-001']);
    expect(filtrar({ riesgo: 'medio' })).toEqual(['C-002', 'C-008']);
    expect(filtrar({ texto: 'tamayo' })).toEqual(['C-002', 'C-008']);
    expect(filtrar({ texto: 'C-004' })).toEqual(['C-004']);
    expect(filtrar({ texto: '002' })).toEqual(['C-002']);
    expect(filtrar({ texto: 'LUCÍA' })).toEqual(['C-004', 'C-008']);
  });

  it('los filtros se combinan', () => {
    expect(filtrar({ estado: 'cerrado', riesgo: 'medio' })).toEqual(['C-008']);
    expect(filtrar({ riesgo: 'medio', texto: 'Andrade' })).toEqual(['C-002', 'C-008']);
    expect(filtrar({ estado: 'activo', riesgo: 'alto' })).toEqual([]);
  });

  it('el responsable deja los grupos con actividades suyas y solo esas actividades', () => {
    const grupos = filtrarInforme(GRUPOS, { ...filtrosInformeVacios(), responsableId: 'EMP-010' });

    expect(grupos.map((g) => [g.conflicto.id, g.actividades.map((a) => a.id)])).toEqual([
      ['C-001', ['A-004', 'A-015', 'A-017', 'A-018']],
      ['C-002', ['A-007', 'A-008']],
      ['C-008', ['A-013']]
    ]);
    expect(grupos[0].plan.actividades.length).withContext('el plan no se recorta').toBe(7);
  });

  it('responsables sin repetir, por nombre', () => {
    const responsables = responsablesDelInforme(GRUPOS);

    expect(new Set(responsables.map((r) => r.id)).size).toBe(responsables.length);
    expect(responsables.map((r) => r.nombre)).toEqual([...responsables.map((r) => r.nombre)].sort((a, b) => a.localeCompare(b)));
    expect(responsables.some((r) => r.id === 'EMP-010')).toBeTrue();
  });
});
