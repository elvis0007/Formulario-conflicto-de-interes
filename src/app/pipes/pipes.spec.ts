import { FechaLargaPipe } from './fecha-larga.pipe';
import { GradoParentescoPipe } from './grado-parentesco.pipe';
import { PlazoTextoPipe } from './plazo-texto.pipe';

describe('FechaLargaPipe', () => {
  const pipe = new FechaLargaPipe();

  it('formatea fecha y hora de la mañana', () => {
    expect(pipe.transform('2026-09-02T09:14:00'))
      .toBe('2 de septiembre de 2026 a las 09:14 a. m.');
  });

  it('formatea mediodía y medianoche en 12 h', () => {
    expect(pipe.transform('2026-01-15T12:05:00'))
      .toBe('15 de enero de 2026 a las 12:05 p. m.');
    expect(pipe.transform('2026-01-15T00:30:00'))
      .toBe('15 de enero de 2026 a las 12:30 a. m.');
  });

  it('sin hora solo muestra la fecha', () => {
    expect(pipe.transform('2026-12-31')).toBe('31 de diciembre de 2026');
  });

  it('devuelve vacío sin valor y el texto original si no es fecha', () => {
    expect(pipe.transform(null)).toBe('');
    expect(pipe.transform('no es fecha')).toBe('no es fecha');
  });
});

describe('PlazoTextoPipe', () => {
  const pipe = new PlazoTextoPipe();

  it('sin prefijo omite la unidad en cero', () => {
    expect(pipe.transform({ plazoMeses: 0, plazoDias: 15 }))
      .toBe('15 días');
    expect(pipe.transform({ plazoMeses: 2, plazoDias: 0 }))
      .toBe('2 meses');
    expect(pipe.transform({ plazoMeses: 2, plazoDias: 15 }))
      .toBe('2 meses 15 días');
    expect(pipe.transform({ plazoMeses: 1, plazoDias: 1 }))
      .toBe('1 mes 1 día');
    expect(pipe.transform({ plazoMeses: 0, plazoDias: 0 }))
      .toBe('0 días');
  });

  it('con false es igual que sin parámetro', () => {
    expect(pipe.transform({ plazoMeses: 0, plazoDias: 15 }, false))
      .toBe('15 días');
  });

  it('con true antepone «Plazo: »', () => {
    expect(pipe.transform({ plazoMeses: 0, plazoDias: 15 }, true))
      .toBe('Plazo: 15 días');
    expect(pipe.transform({ plazoMeses: 2, plazoDias: 15 }, true))
      .toBe('Plazo: 2 meses 15 días');
  });

  it('devuelve vacío sin plazo', () => {
    expect(pipe.transform(undefined)).toBe('');
  });
});

describe('GradoParentescoPipe', () => {
  const pipe = new GradoParentescoPipe();

  it('muestra 1er a 4to grado', () => {
    expect(pipe.transform(1)).toBe('1er grado');
    expect(pipe.transform(2)).toBe('2do grado');
    expect(pipe.transform(3)).toBe('3er grado');
    expect(pipe.transform(4)).toBe('4to grado');
  });
});
