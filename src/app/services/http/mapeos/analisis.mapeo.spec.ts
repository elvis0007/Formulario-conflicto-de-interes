import { AnalisisApi } from '../../../models/api';
import { crearAnalisisVacio, mapearAnalisis, mapearResumenAnalisis } from './analisis.mapeo';

describe('analisis.mapeo', () => {
  const API: AnalisisApi = {
    CODIGO: 7,
    ESTADO_ANALISIS: 'VALIDADO',
    FECHA_EJECUCION: '2026-10-01T09:00:00',
    FECHA_VALIDACION: '2026-10-02T10:00:00',
    VALIDADO_POR: 'rrhh',
    TOTAL_NUEVOS: 5,
    TOTAL_EXISTENTES: 0,
    TOTAL_OMITIDOS: 0,
    TOTAL_CONFLICTOS: 5,
    SIN_CLASIFICAR: 2
  };

  it('crea un análisis vacío sin estado', () => {
    expect(crearAnalisisVacio()).toEqual({ id: null, estado: null, fechaGeneracion: null, conflictos: [] });
  });

  it('mapea un análisis validado', () => {
    expect(mapearAnalisis(API, [])).toEqual({
      id: '7',
      estado: 'VALIDADO',
      fechaGeneracion: '2026-10-01T09:00:00',
      fechaValidacion: '2026-10-02T10:00:00',
      validadoPor: 'rrhh',
      conflictos: []
    });
  });

  it('no pone fecha ni autor de validación en un borrador', () => {
    const borrador = mapearAnalisis(
      { ...API, ESTADO_ANALISIS: 'BORRADOR', FECHA_VALIDACION: null, VALIDADO_POR: null }, []);

    expect('fechaValidacion' in borrador).toBeFalse();
    expect('validadoPor' in borrador).toBeFalse();
  });

  it('mapea el resumen del historial', () => {
    expect(mapearResumenAnalisis(API)).toEqual({
      id: '7',
      fechaGeneracion: '2026-10-01T09:00:00',
      estado: 'VALIDADO',
      totalCasos: 5,
      confirmados: 3
    });
  });
});
