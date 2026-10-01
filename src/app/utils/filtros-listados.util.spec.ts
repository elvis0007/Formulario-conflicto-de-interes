import { fakeAsync, tick } from '@angular/core/testing';
import { EXCUSAS } from '../services/mock-data/excusas.data';
import { FORMULARIOS } from '../services/mock-data/formularios.data';
import { ConfirmacionTemporal } from './confirmacion-temporal';
import { estaEnRangoFechas } from './fechas.util';
import {
  filtrarExcusas,
  filtrarFormularios,
  filtrosExcusasVacios,
  filtrosFormulariosVacios
} from './filtros-listados.util';
import { contieneTexto, normalizarTexto } from './texto.util';

describe('texto.util', () => {
  it('normaliza mayúsculas, tildes y espacios', () => {
    expect(normalizarTexto('  ÁLVAREZ Núñez ')).toBe('alvarez nunez');
  });

  it('contieneTexto ignora tildes; vacío coincide con todo', () => {
    expect(contieneTexto(['Pérez', null], 'perez')).toBeTrue();
    expect(contieneTexto(['Pérez'], 'lopez')).toBeFalse();
    expect(contieneTexto([], '   ')).toBeTrue();
  });
});

describe('estaEnRangoFechas', () => {
  it('incluye ambos extremos y acepta límites vacíos', () => {
    expect(estaEnRangoFechas('2026-09-08', '2026-09-08', '2026-09-08'))
      .toBeTrue();
    expect(estaEnRangoFechas('2026-09-08T23:59:00', '', '2026-09-08'))
      .toBeTrue();
    expect(estaEnRangoFechas('2026-09-07', '2026-09-08', '')).toBeFalse();
    expect(estaEnRangoFechas('2026-09-09', '', '2026-09-08')).toBeFalse();
    expect(estaEnRangoFechas('2026-09-09', '', '')).toBeTrue();
  });
});

describe('filtrarFormularios', () => {
  it('sin filtros devuelve todo', () => {
    expect(filtrarFormularios(FORMULARIOS, filtrosFormulariosVacios())
      .length).toBe(FORMULARIOS.length);
  });

  it('filtra por origen', () => {
    const externos = filtrarFormularios(FORMULARIOS,
      { ...filtrosFormulariosVacios(), origen: 'Externo' });

    expect(externos.map((f) => f.id)).toEqual(['F-006']);
  });

  it('combina todos los filtros a la vez', () => {
    const filtros = {
      origen: 'Interno',
      tipoContrato: 'Permanente',
      desde: '2025-12-01',
      hasta: '2025-12-31',
      busqueda: 'freire'
    };

    expect(filtrarFormularios(FORMULARIOS, filtros).map((f) => f.id))
      .toEqual(['F-003']);
    expect(filtrarFormularios(FORMULARIOS,
      { ...filtros, origen: 'Externo' })).toEqual([]);
    expect(filtrarFormularios(FORMULARIOS,
      { ...filtros, hasta: '2025-12-01' })).toEqual([]);
  });

  it('busca también en los familiares declarados, sin tildes', () => {
    const res = filtrarFormularios(FORMULARIOS,
      { ...filtrosFormulariosVacios(), busqueda: 'NUNEZ' });

    expect(res.map((f) => f.id)).toEqual(['F-004']);
  });
});

describe('filtrarExcusas', () => {
  it('combina origen, proceso, fechas y texto', () => {
    const base = filtrosExcusasVacios();

    expect(filtrarExcusas(EXCUSAS, base).length).toBe(EXCUSAS.length);
    expect(filtrarExcusas(EXCUSAS,
      { ...base, proceso: 'Proceso de compra' }).map((e) => e.id))
      .toEqual(['E-001', 'E-004']);
    expect(filtrarExcusas(EXCUSAS, {
      ...base, proceso: 'Proceso de compra', origen: 'Externo',
      desde: '2026-08-01', busqueda: 'telefónica'
    }).map((e) => e.id)).toEqual(['E-004']);
  });
});

describe('ConfirmacionTemporal', () => {
  it('se activa y se apaga sola', fakeAsync(() => {
    const confirmacion = new ConfirmacionTemporal(2000);

    confirmacion.disparar();
    expect(confirmacion.activa).toBeTrue();
    tick(1999);
    expect(confirmacion.activa).toBeTrue();
    tick(1);
    expect(confirmacion.activa).toBeFalse();
  }));

  it('volver a dispararla reinicia el tiempo; cancelar la apaga',
    fakeAsync(() => {
      const confirmacion = new ConfirmacionTemporal(2000);

      confirmacion.disparar();
      tick(1500);
      confirmacion.disparar();
      tick(1500);
      expect(confirmacion.activa).toBeTrue();
      confirmacion.cancelar();
      expect(confirmacion.activa).toBeFalse();
      tick(2000);
    }));
});
