import { CONFLICTOS } from '../services/mock-data/conflictos.data';
import { PLANES } from '../services/mock-data/planes.data';
import {
  calcularIndicadores,
  distribucionEstadoPlanes,
  distribucionPorRiesgo,
  estadoDeActividades,
  requiereAtencion
} from './dashboard-rrhh.util';

describe('dashboard-rrhh.util', () => {
  const HOY = new Date(2026, 9, 2, 10, 0);

  it('indicadores calculados con los datos de ejemplo', () => {
    expect(calcularIndicadores(CONFLICTOS, PLANES, HOY)).toEqual({
      detectados: 9,
      pendientes: 3,
      confirmadosSinPlan: 0,
      planesActivos: 2,
      actividadesVencidas: 2,
      evidenciasPorRevisar: 3,
      planesCerrados: 3
    });
  });

  it('confirmados sin plan: los que no tienen ningún plan', () => {
    const conflictos = CONFLICTOS.map((c) => c.id === 'C-004' ? { ...c, planes: [] } : c);

    expect(calcularIndicadores(conflictos, PLANES, HOY).confirmadosSinPlan).toBe(1);
  });

  it('distribución por riesgo con anchos relativos al mayor', () => {
    expect(distribucionPorRiesgo(CONFLICTOS).map((b) => [b.etiqueta, b.valor, Math.round(b.porcentaje)])).toEqual([
      ['Crítico', 1, 25], ['Alto', 1, 25], ['Moderado', 3, 75], ['Bajo', 4, 100]
    ]);
  });

  it('distribución de planes por estado', () => {
    expect(distribucionEstadoPlanes(PLANES, HOY).map((b) => [b.clave, b.valor])).toEqual([
      ['BORRADOR', 2], ['FIRMADO', 1], ['FIRMADO_VENCIDAS', 1], ['CERRADO', 3]
    ]);
  });

  it('barra apilada de actividades de planes enviados, en el orden validado y sin ceros', () => {
    const segmentos = estadoDeActividades(PLANES, HOY);

    expect(segmentos.map((s) => [s.estado, s.valor])).toEqual([
      ['ACEPTADA', 8], ['EN_REVISION', 3], ['PENDIENTE', 1], ['VENCIDA', 2], ['RECHAZADA', 1]
    ]);
    expect(Math.round(segmentos.reduce((suma, s) => suma + s.porcentaje, 0))).toBe(100);
  });

  it('«Requiere atención»: vencidas por fecha límite y evidencias por fecha de subida', () => {
    const atencion = requiereAtencion(PLANES, HOY, 2);

    expect(atencion.vencidas.map((v) => [v.actividad.id, v.dias?.texto])).toEqual([
      ['A-003', 'Vencida hace 62 días'],
      ['A-018', 'Vencida hace 31 días']
    ]);
    expect(atencion.evidencias.map((e) => e.actividad.id)).toEqual(['A-016', 'A-005']);
  });
});
