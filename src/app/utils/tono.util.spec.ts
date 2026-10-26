import { EstadoSeguimiento } from '../models';
import {
  mapearClasificacionATono,
  mapearEstadoActividadATono,
  mapearEstadoAnalisisATono,
  mapearEstadoPlanATono,
  mapearEstadoSeguimientoATono,
  mapearRiesgoATono,
  mapearTipoNotificacionATono,
  textoEstadoSeguimiento
} from './tono.util';

describe('tono.util', () => {

  it('mapearRiesgoATono', () => {
    expect(mapearRiesgoATono('CRITICO')).toBe('rojo');
    expect(mapearRiesgoATono('ALTO')).toBe('rojo');
    expect(mapearRiesgoATono('MEDIO')).toBe('ambar');
    expect(mapearRiesgoATono('BAJO')).toBe('verde');
  });

  it('mapearClasificacionATono', () => {
    expect(mapearClasificacionATono(null)).toBe('ambar');
    expect(mapearClasificacionATono('D')).toBe('azul');
    expect(mapearClasificacionATono('N')).toBe('azul');
    expect(mapearClasificacionATono('H')).toBe('gris');
  });

  it('mapearEstadoAnalisisATono', () => {
    expect(mapearEstadoAnalisisATono('BORRADOR')).toBe('ambar');
    expect(mapearEstadoAnalisisATono('VALIDADO')).toBe('verde');
  });

  it('mapearEstadoPlanATono', () => {
    expect(mapearEstadoPlanATono('BORRADOR')).toBe('ambar');
    expect(mapearEstadoPlanATono('FIRMADO')).toBe('azul');
    expect(mapearEstadoPlanATono('FIRMADO', true)).toBe('rojo');
    expect(mapearEstadoPlanATono('CERRADO')).toBe('verde');
    expect(mapearEstadoPlanATono('CERRADO', true)).toBe('verde');
    expect(mapearEstadoPlanATono('CERRADO', false, 'CUMPLIDO')).toBe('verde');
    expect(mapearEstadoPlanATono('CERRADO', false, 'ANTICIPADO')).toBe('gris');
    expect(mapearEstadoPlanATono('FIRMADO', true, 'ANTICIPADO')).withContext('solo afecta a CERRADO').toBe('rojo');
  });

  it('textoEstadoSeguimiento y mapearEstadoSeguimientoATono', () => {
    const estados: EstadoSeguimiento[] = [
      'DETECTADO', 'EN_ANALISIS', 'EN_PLANIFICACION', 'EN_EJECUCION', 'FINALIZADO', 'DESCARTADO'
    ];

    expect(estados.map((e) => [textoEstadoSeguimiento(e), mapearEstadoSeguimientoATono(e)])).toEqual([
      ['Detectado', 'ambar'],
      ['En análisis', 'ambar'],
      ['En planificación', 'ambar'],
      ['En ejecución', 'azul'],
      ['Finalizado', 'verde'],
      ['Descartado', 'gris']
    ]);
  });

  describe('mapearEstadoActividadATono', () => {
    it('vista RRHH', () => {
      expect(mapearEstadoActividadATono('PENDIENTE', false))
        .toBe('ambar');
      expect(mapearEstadoActividadATono('EN_REVISION', false))
        .toBe('gris');
      expect(mapearEstadoActividadATono('ACEPTADA', false))
        .toBe('verde');
      expect(mapearEstadoActividadATono('RECHAZADA', false))
        .toBe('naranja');
      expect(mapearEstadoActividadATono('NO_CUMPLIDA', false))
        .toBe('gris');
      expect(mapearEstadoActividadATono('VENCIDA', false))
        .toBe('rojo');
    });

    it('vista Responsable: mismo tono salvo VENCIDA (se ve Pendiente)',
      () => {
        expect(mapearEstadoActividadATono('PENDIENTE', true))
          .toBe('ambar');
        expect(mapearEstadoActividadATono('EN_REVISION', true))
          .toBe('gris');
        expect(mapearEstadoActividadATono('ACEPTADA', true))
          .toBe('verde');
        expect(mapearEstadoActividadATono('RECHAZADA', true))
          .toBe('naranja');
        expect(mapearEstadoActividadATono('NO_CUMPLIDA', true))
          .toBe('gris');
        expect(mapearEstadoActividadATono('VENCIDA', true))
          .toBe('ambar');
      });
  });

  it('mapearTipoNotificacionATono', () => {
    expect(mapearTipoNotificacionATono('ok')).toBe('verde');
    expect(mapearTipoNotificacionATono('rechazo')).toBe('naranja');
    expect(mapearTipoNotificacionATono('vencido')).toBe('rojo');
    expect(mapearTipoNotificacionATono('alerta')).toBe('rojo');
    expect(mapearTipoNotificacionATono('info')).toBe('azul');
  });
});
