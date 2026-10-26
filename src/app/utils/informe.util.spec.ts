import { CONFLICTOS } from '../services/mock-data/conflictos.data';
import { PLANES } from '../services/mock-data/planes.data';
import {
  FiltrosInforme,
  armarGruposInforme,
  esEstadoInforme,
  filtrarInforme,
  filtrosInformeVacios,
  responsablesDelInforme
} from './informe.util';

describe('informe.util', () => {
  const GRUPOS = armarGruposInforme(CONFLICTOS, PLANES);
  const HOY = new Date(2026, 9, 2, 10, 0);

  /**
   * @param cambios Filtros a aplicar.
   * @returns Ids de los conflictos que pasan.
   */
  function filtrar(cambios: Partial<FiltrosInforme>): string[] {
    return filtrarInforme(GRUPOS, { ...filtrosInformeVacios(), ...cambios }, HOY).map((g) => g.conflicto.id);
  }

  it('un grupo por conflicto con plan enviado; todos sus planes enviados y el actual', () => {
    expect(GRUPOS.map((g) => [g.conflicto.id, g.plan.id, g.bloques.map((b) => b.plan.id)])).toEqual([
      ['C-001', 'PL-002', ['PL-001', 'PL-002']],
      ['C-002', 'PL-003', ['PL-003']],
      ['C-004', 'PL-005', ['PL-005']],
      ['C-008', 'PL-006', ['PL-006']]
    ]);
    // C-003 solo tiene un borrador; el borrador PL-007 de C-008 no cuenta.
    expect(GRUPOS.some((g) => g.conflicto.id === 'C-003')).toBeFalse();
  });

  it('filtros de estado de la §6.7 sobre el plan actual', () => {
    expect(filtrar({})).toEqual(['C-001', 'C-002', 'C-004', 'C-008']);
    expect(filtrar({ estado: 'en-ejecucion' })).toEqual(['C-001', 'C-002']);
    expect(filtrar({ estado: 'con-vencidas' })).toEqual(['C-001']);
    expect(filtrar({ estado: 'cerrados' })).toEqual(['C-004', 'C-008']);
    expect(esEstadoInforme('cerrados')).toBeTrue();
    expect(esEstadoInforme('cerrado')).toBeFalse();
  });

  it('riesgo y buscador, combinados con el estado', () => {
    expect(filtrar({ riesgo: 'MEDIO' })).toEqual(['C-002', 'C-008']);
    expect(filtrar({ texto: 'tamayo' })).toEqual(['C-002', 'C-008']);
    expect(filtrar({ texto: '002' })).toEqual(['C-002']);
    expect(filtrar({ estado: 'cerrados', riesgo: 'MEDIO' })).toEqual(['C-008']);
    expect(filtrar({ estado: 'en-ejecucion', riesgo: 'ALTO' })).toEqual(['C-001']);
    expect(filtrar({ estado: 'con-vencidas', riesgo: 'MEDIO' })).toEqual([]);
  });

  it('el buscador encuentra responsables de planes anteriores', () => {
    // EMP-006 solo es responsable en PL-001 (cerrado) de C-001.
    expect(filtrar({ texto: 'Barona' })).toContain('C-001');
  });

  it('el responsable deja en cada plan solo sus actividades y oculta los planes sin ninguna', () => {
    const grupos = filtrarInforme(GRUPOS, { ...filtrosInformeVacios(), responsableId: 'EMP-001' });
    const c001 = grupos.find((g) => g.conflicto.id === 'C-001');

    expect(grupos.map((g) => g.conflicto.id)).toEqual(['C-001']);
    expect(c001?.bloques.map((b) => [b.plan.id, b.actividades.map((a) => a.id)])).toEqual([
      ['PL-001', ['A-002']],
      ['PL-002', ['A-003', 'A-005']]
    ]);
  });

  it('responsables de todos los planes, sin repetir, por nombre', () => {
    const responsables = responsablesDelInforme(GRUPOS);

    expect(new Set(responsables.map((r) => r.id)).size).toBe(responsables.length);
    expect(responsables.map((r) => r.nombre)).toEqual([...responsables.map((r) => r.nombre)].sort((a, b) => a.localeCompare(b)));
    expect(responsables.some((r) => r.id === 'EMP-006')).withContext('de un plan cerrado').toBeTrue();
  });
});
