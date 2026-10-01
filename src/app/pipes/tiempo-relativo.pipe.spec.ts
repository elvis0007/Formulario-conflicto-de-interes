import { TiempoRelativoPipe } from './tiempo-relativo.pipe';

describe('TiempoRelativoPipe', () => {
  const pipe = new TiempoRelativoPipe();
  const AHORA = new Date(2026, 8, 29, 12, 0, 0);

  /**
   * @param minutos Minutos antes de `AHORA`.
   * @returns Fecha ISO correspondiente.
   */
  function hace(minutos: number): string {
    return new Date(AHORA.getTime() - minutos * 60000).toISOString();
  }

  it('menos de un minuto o futuro', () => {
    expect(pipe.transform(hace(0), AHORA)).toBe('hace un momento');
    expect(pipe.transform(hace(-30), AHORA)).toBe('hace un momento');
  });

  it('minutos, horas, ayer y días', () => {
    expect(pipe.transform(hace(25), AHORA)).toBe('hace 25 min');
    expect(pipe.transform(hace(3 * 60), AHORA)).toBe('hace 3 h');
    expect(pipe.transform(hace(26 * 60), AHORA)).toBe('ayer');
    expect(pipe.transform(hace(4 * 24 * 60), AHORA)).toBe('hace 4 días');
  });

  it('7 días o más muestra la fecha', () => {
    expect(pipe.transform(hace(10 * 24 * 60), AHORA)).toBe('19/09/2026');
  });

  it('vacío y valores no válidos', () => {
    expect(pipe.transform(null, AHORA)).toBe('');
    expect(pipe.transform('xyz', AHORA)).toBe('xyz');
  });
});
