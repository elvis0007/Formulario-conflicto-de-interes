import {
  calcularDiasRestantes,
  calcularFechaLimite,
  formatearFecha,
  parsearFecha
} from './fechas.util';

describe('fechas.util', () => {

  describe('calcularFechaLimite', () => {
    it('suma meses y días dentro del mismo año', () => {
      expect(calcularFechaLimite('2026-08-17', 1, 15))
        .toBe('02/10/2026');
    });

    it('cruza de año al sumar meses (20/12 + 2 meses)', () => {
      expect(calcularFechaLimite('2025-12-20', 2, 0))
        .toBe('20/02/2026');
    });

    it('cruza de mes y de año al sumar días', () => {
      expect(calcularFechaLimite('2026-12-20', 0, 15))
        .toBe('04/01/2027');
    });

    it('cruza de mes al sumar días', () => {
      expect(calcularFechaLimite('2026-01-25', 0, 10))
        .toBe('04/02/2026');
    });

    it('usa el último día del mes si el día no existe en el destino',
      () => {
        expect(calcularFechaLimite('2026-01-31', 1, 0))
          .toBe('28/02/2026');
        expect(calcularFechaLimite('2028-01-31', 1, 0))
          .toBe('29/02/2028');
      });

    it('acepta la fecha de inicio en formato dd/mm/aaaa', () => {
      expect(calcularFechaLimite('20/12/2025', 2, 0))
        .toBe('20/02/2026');
    });

    it('con plazo 0 devuelve la misma fecha', () => {
      expect(calcularFechaLimite('2026-09-29', 0, 0))
        .toBe('29/09/2026');
    });

    it('rechaza fechas y plazos no válidos', () => {
      expect(() => calcularFechaLimite('2026-02-30', 1, 0))
        .toThrowError(RangeError);
      expect(() => calcularFechaLimite('ayer', 1, 0))
        .toThrowError(RangeError);
      expect(() => calcularFechaLimite('2026-01-01', -1, 0))
        .toThrowError(RangeError);
      expect(() => calcularFechaLimite('2026-01-01', 0, 1.5))
        .toThrowError(RangeError);
    });
  });

  describe('calcularDiasRestantes', () => {
    const HOY = new Date(2026, 8, 29, 15, 30);

    it('fecha futura: vence en n días', () => {
      expect(calcularDiasRestantes('2026-10-02', HOY)).toEqual({
        texto: 'Vence en 3 días',
        vencida: false,
        dias: 3
      });
    });

    it('usa singular con un día', () => {
      expect(calcularDiasRestantes('30/09/2026', HOY).texto)
        .toBe('Vence en 1 día');
    });

    it('fecha pasada: vencida hace n días', () => {
      expect(calcularDiasRestantes('2026-08-01', HOY)).toEqual({
        texto: 'Vencida hace 59 días',
        vencida: true,
        dias: -59
      });
    });

    it('fecha de hoy: vence hoy, todavía no vencida', () => {
      expect(calcularDiasRestantes('2026-09-29', HOY)).toEqual({
        texto: 'Vence hoy',
        vencida: false,
        dias: 0
      });
    });

    it('sin fecha de referencia usa el día actual', () => {
      const hoyTexto = formatearFecha(new Date());

      expect(calcularDiasRestantes(hoyTexto).dias).toBe(0);
    });

    it('cuenta días de calendario al cruzar de año', () => {
      expect(calcularDiasRestantes('2027-01-01',
        new Date(2026, 11, 31, 23, 59)).dias).toBe(1);
    });
  });

  describe('parsearFecha', () => {
    it('ignora la hora de una fecha ISO', () => {
      expect(parsearFecha('2026-09-25T09:14:00'))
        .toEqual(new Date(2026, 8, 25));
    });
  });
});
