import { TestBed } from '@angular/core/testing';
import { ResultadoReporte } from '../models';
import { ReportesMockService } from './reportes-mock.service';

describe('ReportesMockService', () => {
  it('sin backend: siempre «sin-backend», para cualquier reporte y filtro', () => {
    const servicio = TestBed.inject(ReportesMockService);
    const resultados: ResultadoReporte[] = [];

    servicio.descargarReporte('RG.02', { riesgo: 'ALTO' }).subscribe((r) => resultados.push(r));
    servicio.descargarReporte('RG.03', {}).subscribe((r) => resultados.push(r));

    expect(resultados).toEqual([{ estado: 'sin-backend' }, { estado: 'sin-backend' }]);
  });
});
