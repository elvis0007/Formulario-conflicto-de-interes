import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import * as XLSX from 'xlsx';
import { ResultadoReporte } from '../../models';
import { conflictoApi } from '../../testing/api-ejemplos';
import { RELOJ } from '../../utils/reloj';
import { ERROR_SIN_CONEXION, urlApi } from './peticiones';
import { ReportesHttpService } from './reportes-http.service';

describe('ReportesHttpService', () => {
  const URL_REPORTE = urlApi('/conflictos/reporte');
  let servicio: ReportesHttpService;
  let http: HttpTestingController;
  let guardados: { archivo: Blob; nombre: string }[];

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: RELOJ, useValue: () => new Date(2026, 9, 27, 10, 0) }
      ]
    });
    servicio = TestBed.inject(ReportesHttpService);
    http = TestBed.inject(HttpTestingController);
    guardados = [];
    // Sin descargar nada de verdad en el navegador de pruebas.
    spyOn(servicio as unknown as { guardarArchivo: (a: Blob, n: string) => void }, 'guardarArchivo')
      .and.callFake((archivo: Blob, nombre: string) => guardados.push({ archivo, nombre }));
  });

  afterEach(() => http.verify());

  /** @returns Filas de la primera hoja del archivo descargado. */
  async function filasDescargadas(): Promise<Record<string, string>[]> {
    const libro = XLSX.read(await guardados[0].archivo.arrayBuffer(), { type: 'array' });

    return XLSX.utils.sheet_to_json(libro.Sheets[libro.SheetNames[0]]);
  }

  it('RG.02: GET /conflictos/reporte con el análisis y el riesgo, y descarga el .xlsx', async () => {
    let resultado: ResultadoReporte | undefined;

    servicio.descargarReporte('RG.02', { analisisId: '3', riesgo: 'ALTO' }).subscribe((r) => resultado = r);
    const peticion = http.expectOne((r) => r.url === URL_REPORTE);

    expect(peticion.request.method).toBe('GET');
    expect(peticion.request.params.get('analisisId')).toBe('3');
    expect(peticion.request.params.get('riesgo')).toBe('ALTO');
    expect(peticion.request.params.has('estado')).toBeFalse();
    expect(peticion.request.params.has('vencido')).toBeFalse();
    peticion.flush({ estado: 'OK', datos: [conflictoApi(), conflictoApi({ CODIGO: 1421 })] });

    expect(resultado).toEqual({ estado: 'descargado', nombreArchivo: 'PNIP.CI.RG.02_2026-10-27.xlsx' });
    expect(guardados.length).toBe(1);
    expect(guardados[0].nombre).toBe('PNIP.CI.RG.02_2026-10-27.xlsx');
    expect(guardados[0].archivo.type).toContain('spreadsheetml');
    expect((await filasDescargadas()).map((f) => f['N.º de caso'])).toEqual(['1420', '1421']);
  });

  it('RG.03: manda estado y vencido, y deja fuera los conflictos que nunca tuvieron plan', async () => {
    servicio.descargarReporte('RG.03', { estado: 'EN_EJECUCION', vencido: true }).subscribe();
    const peticion = http.expectOne((r) => r.url === URL_REPORTE);

    expect(peticion.request.params.get('estado')).toBe('EN_EJECUCION');
    expect(peticion.request.params.get('vencido')).toBe('true');
    peticion.flush({
      estado: 'OK',
      datos: [
        conflictoApi({ CODIGO: 1, ESTADO_SEGUIMIENTO: 'EN_EJECUCION' }),
        conflictoApi({ CODIGO: 2, ESTADO_SEGUIMIENTO: 'DETECTADO' }),
        conflictoApi({ CODIGO: 3, ESTADO_SEGUIMIENTO: 'DESCARTADO' }),
        conflictoApi({ CODIGO: 4, ESTADO_SEGUIMIENTO: 'FINALIZADO' })
      ]
    });

    expect((await filasDescargadas()).map((f) => f['N.º de caso'])).toEqual(['1', '4']);
  });

  it('sin filtros no manda parámetros y una lista vacía igual descarga el archivo', async () => {
    let resultado: ResultadoReporte | undefined;

    servicio.descargarReporte('RG.02', {}).subscribe((r) => resultado = r);
    const peticion = http.expectOne((r) => r.url === URL_REPORTE);

    expect(peticion.request.params.keys()).toEqual([]);
    peticion.flush({ estado: 'OK', datos: [] });
    expect(resultado?.estado).toBe('descargado');
    expect(await filasDescargadas()).toEqual([{ 'Sin datos': 'No hay conflictos con esos filtros.' }]);
  });

  it('si el backend rechaza: error con su mensaje y sin archivo', () => {
    let resultado: ResultadoReporte | undefined;

    spyOn(console, 'error');
    servicio.descargarReporte('RG.02', { riesgo: 'ALTO' }).subscribe((r) => resultado = r);
    http.expectOne((r) => r.url === URL_REPORTE)
      .flush({ estado: 'ERROR', mensaje: "El valor del parámetro 'riesgo' no es válido" }, { status: 400, statusText: 'Bad Request' });

    expect(resultado).toEqual({ estado: 'error', mensaje: "El valor del parámetro 'riesgo' no es válido" });
    expect(guardados).toEqual([]);
  });

  it('sin conexión: error con el aviso de sin conexión', () => {
    let resultado: ResultadoReporte | undefined;

    spyOn(console, 'error');
    servicio.descargarReporte('RG.03', {}).subscribe((r) => resultado = r);
    http.expectOne((r) => r.url === URL_REPORTE).error(new ProgressEvent('error'));

    expect(resultado).toEqual({ estado: 'error', mensaje: ERROR_SIN_CONEXION });
  });
});
