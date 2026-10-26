import { DatosCandidato } from '../models';
import { FORMULARIOS } from '../services/mock-data/formularios.data';
import { PERSONAS } from '../services/mock-data/personas.data';
import {
  ERROR_APELLIDOS_OBLIGATORIOS,
  ERROR_CEDULA,
  ERROR_CEDULA_OBLIGATORIA,
  ERROR_NOMBRES_OBLIGATORIOS,
  buscarCoincidencias,
  riesgoEstimado,
  validarDatosCandidato
} from './consulta-previa.util';

describe('consulta-previa.util', () => {
  /**
   * @param datos Datos del candidato.
   * @returns [empleado, parentesco, grado, riesgo] de cada coincidencia.
   */
  function buscar(datos: Partial<DatosCandidato>): [string, string, number | null, string][] {
    return buscarCoincidencias({ cedula: '', nombres: '', apellidos: '', ...datos }, PERSONAS, FORMULARIOS)
      .map((c) => [c.empleado.id, c.parentesco, c.grado, c.riesgo]);
  }

  it('exige cédula de 10 dígitos, un nombre y un apellido', () => {
    expect(validarDatosCandidato({ cedula: '1800000318', nombres: 'Ana', apellidos: 'Mora' })).toBeNull();
    expect(validarDatosCandidato({ cedula: ' 1800000318 ', nombres: ' Ana ', apellidos: ' Mora ' })).toBeNull();
    expect(validarDatosCandidato({ cedula: '', nombres: 'Ana', apellidos: 'Mora' })).toBe(ERROR_CEDULA_OBLIGATORIA);
    expect(validarDatosCandidato({ cedula: ' ', nombres: '', apellidos: '' })).toBe(ERROR_CEDULA_OBLIGATORIA);
    expect(validarDatosCandidato({ cedula: '12345', nombres: 'Ana', apellidos: 'Mora' })).toBe(ERROR_CEDULA);
    expect(validarDatosCandidato({ cedula: '18000003AB', nombres: 'Ana', apellidos: 'Mora' })).toBe(ERROR_CEDULA);
    expect(validarDatosCandidato({ cedula: '1800000318', nombres: '', apellidos: 'Mora' }))
      .toBe(ERROR_NOMBRES_OBLIGATORIOS);
    expect(validarDatosCandidato({ cedula: '1800000318', nombres: 'Ana', apellidos: '  ' }))
      .toBe(ERROR_APELLIDOS_OBLIGATORIOS);
  });

  it('riesgo estimado por grado', () => {
    expect([null, 1, 2, 3, 4].map((g) => riesgoEstimado(g as never))).toEqual(['ALTO', 'ALTO', 'MEDIO', 'BAJO', 'BAJO']);
  });

  it('por cédula declarada en un formulario (padre declarado) y por apellidos (hermano del tío)', () => {
    expect(buscar({ cedula: '1800000318', nombres: 'Fausto', apellidos: 'Tamayo Guevara' })).toEqual([
      ['EMP-005', 'Padre', 1, 'ALTO'],
      ['EMP-004', 'Hermano/a (estimado)', 2, 'MEDIO']
    ]);
  });

  it('solo con la cédula: la declaración basta', () => {
    expect(buscar({ cedula: '1800000300' })).toEqual([['EMP-001', 'Cónyuge', null, 'ALTO']]);
  });

  it('por nombre del padre, madre o cónyuge en la ficha', () => {
    expect(buscar({ nombres: 'Inés', apellidos: 'Castillo Moya' })).toEqual([['EMP-004', 'Cónyuge', null, 'ALTO']]);
    expect(buscar({ nombres: 'rosa elena', apellidos: 'SANCHEZ VACA' }).slice(0, 2)).toEqual([
      ['EMP-001', 'Madre', 1, 'ALTO'],
      ['EMP-002', 'Madre', 1, 'ALTO']
    ]);
  });

  it('por el primer apellido: pariente paterno estimado', () => {
    expect(buscar({ nombres: 'Pedro', apellidos: 'Andrade Mora' })).toEqual([
      ['EMP-010', 'Pariente por línea paterna (estimado)', 3, 'BAJO']
    ]);
  });

  it('sin coincidencias', () => {
    expect(buscar({ cedula: '1712345678', nombres: 'Juan Carlos', apellidos: 'Vásconez Mora' })).toEqual([]);
  });

  it('el propio empleado no coincide consigo mismo', () => {
    expect(buscar({ cedula: '1800000011', nombres: 'Carlos Andrés', apellidos: 'Mayorga Sánchez' })
      .map(([id]) => id)).not.toContain('EMP-001');
  });
});
