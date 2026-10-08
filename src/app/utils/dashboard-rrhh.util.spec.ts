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
    expect(calcularIndicadores(CONFLICTOS, PLANES)).toEqual({
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

    expect(calcularIndicadores(conflictos, PLANES).confirmadosSinPlan).toBe(1);
  });

  it('distribución por riesgo con anchos relativos al mayor', () => {
    expect(distribucionPorRiesgo(CONFLICTOS).map((b) => [b.etiqueta, b.valor, Math.round(b.porcentaje)])).toEqual([
      ['Alto', 2, 67], ['Moderado', 3, 100], ['Bajo', 3, 100], ['Ninguno', 1, 33]
    ]);
  });

  it('distribución de planes por estado', () => {
    expect(distribucionEstadoPlanes(PLANES).map((b) => [b.clave, b.valor])).toEqual([
      ['borrador', 2], ['activo', 1], ['activo_vencidas', 1], ['cerrado', 3]
    ]);
  });

  it('barra apilada de actividades de planes enviados, en el orden validado y sin ceros', () => {
    const segmentos = estadoDeActividades(PLANES);

    expect(segmentos.map((s) => [s.estado, s.valor])).toEqual([
      ['aprobada', 8], ['en_revision', 3], ['pendiente', 1], ['vencida', 2], ['rechazada', 1]
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
