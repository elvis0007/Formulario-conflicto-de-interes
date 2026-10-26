import { CoincidenciaApi, ConsultaPreviaApi } from '../../../models/api';
import { crearPedidoConsulta, mapearCoincidencia, mapearConsulta } from './consulta-previa.mapeo';

describe('consulta-previa.mapeo', () => {
  const COINCIDENCIA: CoincidenciaApi = {
    DMPER_CODIGO: 'E100',
    CEDULA: '0102030405',
    NOMBRE: 'PEREZ LOPEZ ANA',
    CARGO: 'Analista',
    DEPARTAMENTO: 'Finanzas',
    PARENTESCO: 'PADRE',
    TIPO_GRADO: 'C',
    GRADO: 1,
    RIESGO: 'ALTO',
    CONFIANZA: 0.95,
    FUENTE: 'NOMINA',
    DETALLE: 'Mismos apellidos.'
  };

  it('arma el pedido con los apellidos primero y como aspirante', () => {
    expect(crearPedidoConsulta({ cedula: ' 0102030405 ', nombres: 'Juan  Carlos', apellidos: ' Pérez López ' }))
      .toEqual({ tipo: 'ASPIRANTE', cedula: '0102030405', nombres: 'Pérez López Juan Carlos' });
  });

  it('mapea una coincidencia invirtiendo el parentesco', () => {
    expect(mapearCoincidencia(COINCIDENCIA)).toEqual({
      empleado: { id: 'E100', nombres: 'PEREZ LOPEZ ANA', cedula: '0102030405', cargo: 'Analista', departamento: 'Finanzas' },
      parentesco: 'Hijo/a',
      relacion: 'Consanguinidad',
      grado: 1,
      riesgo: 'ALTO',
      motivo: 'Mismos apellidos. Consta en la nómina.'
    });
  });

  it('deja los cónyuges sin grado y los afines como afinidad', () => {
    const conyuge = mapearCoincidencia({ ...COINCIDENCIA, PARENTESCO: 'CONYUGE', TIPO_GRADO: 'A', GRADO: 1 });

    expect(conyuge.grado).toBeNull();
    expect(conyuge.relacion).toBe('Afinidad');
    expect(conyuge.parentesco).toBe('Cónyuge');
  });

  it('mapea la consulta con sus coincidencias y un id propio', () => {
    const api = {
      CEDULA: '0102030405',
      FECHA: '2026-10-05T10:00:00',
      COINCIDENCIAS: [COINCIDENCIA]
    } as ConsultaPreviaApi;
    const datos = { cedula: '0102030405', nombres: 'Juan', apellidos: 'Pérez' };
    const consulta = mapearConsulta(api, datos, new Date(2026, 9, 6));

    expect(consulta.id).toBe('CP-0102030405-2026-10-05T10:00:00');
    expect(consulta.fecha).toBe('2026-10-05T10:00:00');
    expect(consulta.datos).toBe(datos);
    expect(consulta.coincidencias.length).toBe(1);
  });

  it('tolera una consulta sin coincidencias ni fecha', () => {
    const api = { CEDULA: null, FECHA: null, COINCIDENCIAS: null } as unknown as ConsultaPreviaApi;
    const consulta = mapearConsulta(api, { cedula: '1', nombres: 'A', apellidos: 'B' }, new Date(2026, 9, 6));

    expect(consulta.coincidencias).toEqual([]);
    expect(consulta.fecha).toBe(new Date(2026, 9, 6).toISOString());
  });
});
