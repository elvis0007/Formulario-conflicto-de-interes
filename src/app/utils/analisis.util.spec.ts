import { Conflicto } from '../models';
import { CONFLICTOS } from '../services/mock-data/conflictos.data';
import {
  contarPendientes,
  cumpleFiltroClasificacion,
  esFiltroClasificacion,
  contarPorRiesgo,
  filtrarPorRiesgo,
  rolesInvolucrados,
  textoClasificacion,
  textoEstadoAnalisis,
  textoFiltroClasificacion,
  textoGrado,
  textoParentesco,
  textoRiesgo
} from './analisis.util';
import { TODOS } from './filtros-listados.util';

describe('analisis.util', () => {
  /**
   * @param id Id de un conflicto de ejemplo.
   * @returns Ese conflicto.
   */
  function conflicto(id: string): Conflicto {
    return CONFLICTOS.find((c) => c.id === id) as Conflicto;
  }

  it('textoGrado: 1er a 4to grado', () => {
    expect(textoGrado(1)).toBe('1er grado');
    expect(textoGrado(2)).toBe('2do grado');
    expect(textoGrado(3)).toBe('3er grado');
    expect(textoGrado(4)).toBe('4to grado');
  });

  it('textoGrado: sin grado (cónyuges) es «No aplica»', () => {
    expect(textoGrado(null)).toBe('No aplica');
    expect(conflicto('C-009').grado).toBeNull();
  });

  it('textos de riesgo, clasificación y estado', () => {
    expect(textoRiesgo('MEDIO')).toBe('Moderado');
    expect(textoRiesgo('CRITICO')).toBe('Crítico');
    expect(textoClasificacion(null)).toBe('Pendiente de revisión');
    expect(textoClasificacion('D')).toBe('Declarado');
    expect(textoClasificacion('N')).toBe('No declarado (omisión)');
    expect(textoClasificacion('H')).toBe('Homónimo');
    expect(textoEstadoAnalisis('BORRADOR')).toBe('Borrador');
    expect(textoEstadoAnalisis('VALIDADO')).toBe('Validado');
  });

  describe('contarPorRiesgo', () => {
    it('cuenta cada nivel y el total', () => {
      expect(contarPorRiesgo(CONFLICTOS))
        .toEqual({ CRITICO: 1, ALTO: 1, MEDIO: 3, BAJO: 4, total: 9 });
    });

    it('sin casos, todo en cero', () => {
      expect(contarPorRiesgo([]))
        .toEqual({ CRITICO: 0, ALTO: 0, MEDIO: 0, BAJO: 0, total: 0 });
    });

    it('los conteos son de todos los casos, no de los filtrados', () => {
      const conteoTodos = contarPorRiesgo(CONFLICTOS);

      filtrarPorRiesgo(CONFLICTOS, 'ALTO');
      expect(contarPorRiesgo(CONFLICTOS)).toEqual(conteoTodos);
      expect(filtrarPorRiesgo(CONFLICTOS, 'ALTO').length).toBe(conteoTodos.ALTO);
    });
  });

  describe('filtrarPorRiesgo', () => {
    it('Todos devuelve todos', () => {
      expect(filtrarPorRiesgo(CONFLICTOS, TODOS).length).toBe(CONFLICTOS.length);
    });

    it('un nivel devuelve solo los de ese nivel', () => {
      const bajos = filtrarPorRiesgo(CONFLICTOS, 'BAJO');

      expect(bajos.length).toBe(4);
      expect(bajos.every((c) => c.riesgo === 'BAJO')).toBeTrue();
    });
  });

  it('contarPendientes', () => {
    expect(contarPendientes(CONFLICTOS)).toBe(3);
    expect(contarPendientes([])).toBe(0);
  });

  describe('filtro por clasificación', () => {
    it('esFiltroClasificacion acepta solo los valores conocidos', () => {
      expect(['SIN_CLASIFICAR', 'D_O_N', 'D', 'N', 'H'].every(esFiltroClasificacion)).toBeTrue();
      expect(esFiltroClasificacion('pendiente')).toBeFalse();
      expect(esFiltroClasificacion(null)).toBeFalse();
    });

    it('cumpleFiltroClasificacion', () => {
      const d = conflicto('C-001');
      const n = conflicto('C-003');
      const h = conflicto('C-006');
      const sin = conflicto('C-005');

      expect(cumpleFiltroClasificacion(sin, 'SIN_CLASIFICAR')).toBeTrue();
      expect(cumpleFiltroClasificacion(d, 'SIN_CLASIFICAR')).toBeFalse();
      expect(cumpleFiltroClasificacion(d, 'D_O_N')).toBeTrue();
      expect(cumpleFiltroClasificacion(n, 'D_O_N')).toBeTrue();
      expect(cumpleFiltroClasificacion(h, 'D_O_N')).toBeFalse();
      expect(cumpleFiltroClasificacion(n, 'D')).toBeFalse();
      expect(cumpleFiltroClasificacion(n, 'N')).toBeTrue();
      expect(cumpleFiltroClasificacion(h, 'H')).toBeTrue();
    });

    it('textoFiltroClasificacion', () => {
      expect(textoFiltroClasificacion('SIN_CLASIFICAR')).toBe('Pendiente de revisión');
      expect(textoFiltroClasificacion('D_O_N')).toBe('Declarado o no declarado');
      expect(textoFiltroClasificacion('H')).toBe('Homónimo');
    });
  });

  describe('rolesInvolucrados', () => {
    it('simétrico: una sola etiqueta', () => {
      expect(rolesInvolucrados(conflicto('C-001')))
        .toEqual({ tipo: 'simetrica', etiqueta: 'Hermanos' });
      expect(rolesInvolucrados(conflicto('C-009')))
        .toEqual({ tipo: 'simetrica', etiqueta: 'Cónyuges' });
    });

    it('roles distintos: uno bajo cada nombre', () => {
      expect(rolesInvolucrados(conflicto('C-002')))
        .toEqual({ tipo: 'roles', rolA: 'Tío', rolB: 'Sobrino' });
      expect(rolesInvolucrados(conflicto('C-007')))
        .toEqual({ tipo: 'roles', rolA: 'Padre', rolB: 'Hija' });
    });

    it('una etiqueta simétrica vacía cuenta como roles distintos', () => {
      const sinEtiqueta = { ...conflicto('C-002'), etiquetaSimetrica: '  ' };

      expect(rolesInvolucrados(sinEtiqueta).tipo).toBe('roles');
    });
  });
});

describe('textoParentesco', () => {
  /**
   * @param id Id del caso.
   * @returns El caso de ejemplo.
   */
  function caso(id: string): Conflicto {
    const encontrado = CONFLICTOS.find((c) => c.id === id);

    if (encontrado === undefined) {
      throw new Error('No existe ' + id);
    }
    return encontrado;
  }

  it('etiqueta simétrica o roles, relación y grado; los cónyuges sin grado', () => {
    expect(textoParentesco(caso('C-001'))).toBe('Hermanos · Consanguinidad, 2do grado');
    expect(textoParentesco(caso('C-002'))).toBe('Tío / Sobrino · Consanguinidad, 3er grado');
    expect(textoParentesco(caso('C-009'))).toBe('Cónyuges · Afinidad');
  });
});
