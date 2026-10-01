import { NombreFormalPipe } from './nombre-formal.pipe';

describe('NombreFormalPipe', () => {
    const pipe = new NombreFormalPipe();

    it('apellidos primero y en mayúsculas (con tildes)', () => {
        expect(pipe.transform('Carlos Andrés Mayorga Sánchez'))
            .toBe('MAYORGA SÁNCHEZ CARLOS ANDRÉS');
    });

    it('tres palabras: un nombre y dos apellidos', () => {
        expect(pipe.transform('Ana Mayorga Sánchez'))
            .toBe('MAYORGA SÁNCHEZ ANA');
    });

    it('dos palabras: la segunda es el apellido', () => {
        expect(pipe.transform('Ana Mayorga')).toBe('MAYORGA ANA');
    });

    it('no parte apellidos ni nombres con partículas', () => {
        expect(pipe.transform('Juan Carlos de la Torre Vela'))
            .toBe('DE LA TORRE VELA JUAN CARLOS');
        expect(pipe.transform('María de los Ángeles Pérez López'))
            .toBe('PÉREZ LÓPEZ MARÍA DE LOS ÁNGELES');
    });

    it('una palabra, espacios extra y vacíos', () => {
        expect(pipe.transform('  Ana  ')).toBe('ANA');
        expect(pipe.transform('  Ana   Mayorga ')).toBe('MAYORGA ANA');
        expect(pipe.transform(null)).toBe('');
        expect(pipe.transform('')).toBe('');
    });
});
