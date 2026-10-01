import {
  mapearEstadoActividadATono,
  mapearEstadoPlanATono,
  mapearRiesgoATono,
  mapearTipoNotificacionATono
} from './tono.util';

describe('tono.util', () => {

  it('mapearRiesgoATono', () => {
    expect(mapearRiesgoATono('alto')).toBe('rojo');
    expect(mapearRiesgoATono('medio')).toBe('ambar');
    expect(mapearRiesgoATono('bajo')).toBe('verde');
    expect(mapearRiesgoATono('ninguno')).toBe('gris');
  });

  it('mapearEstadoPlanATono', () => {
    expect(mapearEstadoPlanATono('borrador')).toBe('ambar');
    expect(mapearEstadoPlanATono('activo')).toBe('azul');
    expect(mapearEstadoPlanATono('activo_vencidas')).toBe('rojo');
    expect(mapearEstadoPlanATono('cerrado')).toBe('verde');
  });

  describe('mapearEstadoActividadATono', () => {
    it('vista RRHH', () => {
      expect(mapearEstadoActividadATono('pendiente', false))
        .toBe('ambar');
      expect(mapearEstadoActividadATono('en_revision', false))
        .toBe('gris');
      expect(mapearEstadoActividadATono('aprobada', false))
        .toBe('verde');
      expect(mapearEstadoActividadATono('rechazada', false))
        .toBe('naranja');
      expect(mapearEstadoActividadATono('vencida', false))
        .toBe('rojo');
    });

    it('vista Responsable: mismo tono salvo vencida (se ve Pendiente)',
      () => {
        expect(mapearEstadoActividadATono('pendiente', true))
          .toBe('ambar');
        expect(mapearEstadoActividadATono('en_revision', true))
          .toBe('gris');
        expect(mapearEstadoActividadATono('aprobada', true))
          .toBe('verde');
        expect(mapearEstadoActividadATono('rechazada', true))
          .toBe('naranja');
        expect(mapearEstadoActividadATono('vencida', true))
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
