import * as XLSX from 'xlsx';
import { conflictoApi } from '../../../testing/api-ejemplos';
import { crearLibroReporte, filasReporte, nombreArchivoReporte } from './reporte.mapeo';

describe('reporte.mapeo', () => {
  it('RG.02: una fila por conflicto con los textos de la pantalla', () => {
    const [fila] = filasReporte('RG.02', [conflictoApi()]);

    expect(fila).toEqual({
      'N.º de caso': '1420',
      'Cédula A': '1800000001',
      'Persona A': 'Ana Pérez',
      'Departamento A': 'Compras',
      'Cédula B': '1800000002',
      'Persona B': 'Juan Pérez',
      'Departamento B': 'Finanzas',
      'Parentesco': jasmine.stringContaining('Consanguinidad, 1er grado') as unknown as string,
      'Grado': '1er grado',
      'Riesgo': 'Alto',
      'Origen': 'Detectado por el sistema',
      'Clasificación': 'No declarado (omisión)',
      'Observación': 'Confirmado por RRHH',
      'Estado': 'En ejecución',
      'Fecha de detección': '01/10/2026'
    });
  });

  it('RG.03: estado y actividades vencidas, sin cédulas ni clasificación', () => {
    const [fila] = filasReporte('RG.03', [conflictoApi({ VENCIDO: true, RIESGO: 'MEDIO', ESTADO_SEGUIMIENTO: 'FINALIZADO' })]);

    expect(Object.keys(fila)).toEqual([
      'N.º de caso', 'Persona A', 'Departamento A', 'Persona B', 'Departamento B',
      'Parentesco', 'Riesgo', 'Estado', 'Actividades vencidas', 'Fecha de detección'
    ]);
    expect(fila['Riesgo']).toBe('Moderado');
    expect(fila['Estado']).toBe('Finalizado');
    expect(fila['Actividades vencidas']).toBe('Sí');
  });

  it('sin clasificar, sin origen y sin fecha: textos vacíos o «Pendiente de revisión»', () => {
    const [fila] = filasReporte('RG.02', [conflictoApi({ CLASIFICACION: null, ORIGEN: null, FECHA_DETECCION: null, OBSERVACION: null })]);

    expect(fila['Clasificación']).toBe('Pendiente de revisión');
    expect(fila['Origen']).toBe('');
    expect(fila['Fecha de detección']).toBe('');
    expect(fila['Observación']).toBe('');
  });

  it('nombre del archivo con el código y la fecha', () => {
    expect(nombreArchivoReporte('RG.02', new Date(2026, 9, 27, 15, 30))).toBe('PNIP.CI.RG.02_2026-10-27.xlsx');
    expect(nombreArchivoReporte('RG.03', new Date(2026, 0, 5))).toBe('PNIP.CI.RG.03_2026-01-05.xlsx');
  });

  it('libro con una hoja por reporte y columnas a lo ancho del texto', () => {
    const libro = crearLibroReporte('RG.03', filasReporte('RG.03', [conflictoApi()]));
    const hoja = libro.Sheets['Informe General'];

    expect(libro.SheetNames).toEqual(['Informe General']);
    expect(XLSX.utils.sheet_to_json(hoja)[0]['Persona A']).toBe('Ana Pérez');
    expect((hoja['!cols'] as unknown[]).length).toBe(10);
  });

  it('sin filas, la hoja lleva un aviso en lugar de quedar en blanco', () => {
    const libro = crearLibroReporte('RG.02', []);

    expect(XLSX.utils.sheet_to_json(libro.Sheets['Análisis de Conflictos']))
      .toEqual([{ 'Sin datos': 'No hay conflictos con esos filtros.' }]);
  });
});
