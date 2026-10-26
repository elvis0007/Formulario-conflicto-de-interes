import { NotificacionApi } from '../../../models/api';
import { mapearNotificacion } from './notificacion.mapeo';

describe('notificacion.mapeo', () => {
  const API: NotificacionApi = {
    CODIGO: 31,
    TIPO: 'EVIDENCIA_RECHAZADA',
    MENSAJE: 'Se rechazó tu evidencia.',
    CONFLICTO_ID: 4,
    ACTIVIDAD_ID: 8,
    LEIDA: false,
    FECHA: '2026-10-05T11:30:00'
  };

  it('mapea título, texto, fecha y tipo visual', () => {
    expect(mapearNotificacion(API)).toEqual({
      id: '31',
      titulo: 'Evidencia rechazada',
      texto: 'Se rechazó tu evidencia.',
      fecha: '2026-10-05T11:30:00',
      leida: false,
      tipo: 'rechazo'
    });
  });

  it('asigna un tipo visual a cada tipo del backend', () => {
    const tipos = {
      ACTIVIDAD_ASIGNADA: 'info',
      EVIDENCIA_POR_REVISAR: 'info',
      EVIDENCIA_APROBADA: 'ok',
      EVIDENCIA_RECHAZADA: 'rechazo',
      ACTIVIDAD_VENCIDA: 'vencido',
      CONFLICTO_FINALIZADO: 'ok'
    } as const;

    for (const [tipoApi, visual] of Object.entries(tipos)) {
      expect(mapearNotificacion({ ...API, TIPO: tipoApi as NotificacionApi['TIPO'] }).tipo).toBe(visual);
    }
  });

  it('tolera un tipo desconocido o ausente', () => {
    expect(mapearNotificacion({ ...API, TIPO: null }).titulo).toBe('Aviso');
    expect(mapearNotificacion({ ...API, TIPO: 'NUEVO' as NotificacionApi['TIPO'] }).tipo).toBe('info');
  });
});
