import { Conflicto } from '../models';
import { CONFLICTOS } from '../services/mock-data/conflictos.data';
import {
  contarPendientes,
  contarPorRiesgo,
  filtrarPorRiesgo,
  rolesInvolucrados,
  textoClasificacion,
  textoEstadoAnalisis,
  textoGrado,
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

  it('textos de riesgo, clasificación y estado', () => {
    expect(textoRiesgo('medio')).toBe('Moderado');
    expect(textoRiesgo('ninguno')).toBe('Ninguno');
    expect(textoClasificacion('pendiente')).toBe('Pendiente de revisión');
    expect(textoClasificacion('homonimo')).toBe('Homónimo');
    expect(textoEstadoAnalisis('borrador')).toBe('Borrador');
    expect(textoEstadoAnalisis('validado')).toBe('Validado');
  });

  describe('contarPorRiesgo', () => {
    it('cuenta cada nivel y el total', () => {
      expect(contarPorRiesgo(CONFLICTOS))
        .toEqual({ alto: 2, medio: 3, bajo: 3, ninguno: 1, total: 9 });
    });

    it('sin casos, todo en cero', () => {
      expect(contarPorRiesgo([]))
        .toEqual({ alto: 0, medio: 0, bajo: 0, ninguno: 0, total: 0 });
    });

    it('los conteos son de todos los casos, no de los filtrados', () => {
      const conteoTodos = contarPorRiesgo(CONFLICTOS);

      filtrarPorRiesgo(CONFLICTOS, 'alto');
      expect(contarPorRiesgo(CONFLICTOS)).toEqual(conteoTodos);
      expect(filtrarPorRiesgo(CONFLICTOS, 'alto').length).toBe(conteoTodos.alto);
    });
  });

  describe('filtrarPorRiesgo', () => {
    it('Todos devuelve todos', () => {
      expect(filtrarPorRiesgo(CONFLICTOS, TODOS).length).toBe(CONFLICTOS.length);
    });

    it('un nivel devuelve solo los de ese nivel', () => {
      const bajos = filtrarPorRiesgo(CONFLICTOS, 'bajo');

      expect(bajos.length).toBe(3);
      expect(bajos.every((c) => c.riesgo === 'bajo')).toBeTrue();
    });
  });

  it('contarPendientes', () => {
    expect(contarPendientes(CONFLICTOS)).toBe(3);
    expect(contarPendientes([])).toBe(0);
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
