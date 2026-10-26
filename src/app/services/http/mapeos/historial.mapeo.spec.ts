import { ActividadRecienteApi, ProcesoApi } from '../../../models/api';
import { mapearActividadReciente, mapearProceso } from './historial.mapeo';

describe('historial.mapeo', () => {
  const PROCESO: ProcesoApi = {
    CODIGO: 1,
    ESTADO_ANTERIOR: 'DETECTADO',
    ESTADO_NUEVO: 'EN_PLANIFICACION',
    COMENTARIO: ' Confirmado ',
    USUARIO: 'Ana Pérez',
    FECHA: '2026-10-02T10:00:00'
  };

  it('mapea la detección (sin estado anterior) como información', () => {
    const evento = mapearProceso(
      { ...PROCESO, ESTADO_ANTERIOR: null, ESTADO_NUEVO: 'DETECTADO', COMENTARIO: null, USUARIO: null }, '5');

    expect(evento).toEqual({
      fecha: '2026-10-02T10:00:00',
      autor: 'Sistema',
      texto: 'Detectado.',
      tipo: 'info',
      nivel: 'conflicto',
      refId: '5'
    });
  });

  it('mapea un cambio de estado con su comentario', () => {
    const evento = mapearProceso(PROCESO, '5');

    expect(evento.texto).toBe('Detectado → En planificación. Confirmado');
    expect(evento.autor).toBe('Ana Pérez');
    expect(evento.tipo).toBe('ok');
  });

  it('marca como cierre los estados finales', () => {
    expect(mapearProceso({ ...PROCESO, ESTADO_NUEVO: 'DESCARTADO' }, '5').tipo).toBe('cierre');
    expect(mapearProceso({ ...PROCESO, ESTADO_NUEVO: 'FINALIZADO' }, '5').tipo).toBe('cierre');
  });

  it('mapea la actividad reciente con los nombres y el conflicto', () => {
    const api: ActividadRecienteApi = {
      CODIGO: 9,
      CONFLICTO_ID: 12,
      NOMBRE_A: 'Ana',
      NOMBRE_B: 'Luis',
      ESTADO_ANTERIOR: 'EN_EJECUCION',
      ESTADO_NUEVO: 'FINALIZADO',
      COMENTARIO: null,
      USUARIO: null,
      FECHA: '2026-10-03T08:00:00'
    };

    expect(mapearActividadReciente(api)).toEqual({
      evento: {
        fecha: '2026-10-03T08:00:00',
        autor: 'Sistema',
        texto: 'Ana y Luis: En ejecución → Finalizado.',
        tipo: 'cierre',
        nivel: 'conflicto',
        refId: '12'
      },
      conflictoId: '12'
    });
  });
});
