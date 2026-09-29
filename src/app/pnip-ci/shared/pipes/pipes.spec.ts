import { FechaLargaPipe } from './fecha-larga.pipe';
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

    it('omite la unidad en cero por defecto', () => {
        expect(pipe.transform({ plazoMeses: 0, plazoDias: 15 }))
            .toBe('15 días');
        expect(pipe.transform({ plazoMeses: 1, plazoDias: 0 }))
            .toBe('1 mes');
        expect(pipe.transform({ plazoMeses: 2, plazoDias: 1 }))
            .toBe('2 meses 1 día');
        expect(pipe.transform({ plazoMeses: 0, plazoDias: 0 }))
            .toBe('0 días');
    });

    it('formato etiqueta', () => {
        expect(pipe.transform({ plazoMeses: 0, plazoDias: 15 }, 'etiqueta'))
            .toBe('Plazo: 15 días');
    });

    it('formato completo muestra ambas unidades', () => {
        expect(pipe.transform({ plazoMeses: 0, plazoDias: 15 }, 'completo'))
            .toBe('0 meses 15 días');
    });

    it('devuelve vacío sin plazo', () => {
        expect(pipe.transform(undefined)).toBe('');
    });
});
