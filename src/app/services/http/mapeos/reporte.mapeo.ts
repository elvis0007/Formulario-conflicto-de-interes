import * as XLSX from 'xlsx';
import { TipoReporte } from '../../../models';
import { ConflictoApi, OrigenApi } from '../../../models/api';
import { textoClasificacion, textoGrado, textoParentesco, textoRiesgo } from '../../../utils/analisis.util';
import { formatearFecha, formatearFechaIso, parsearFecha } from '../../../utils/fechas.util';
import { textoEstadoSeguimiento } from '../../../utils/tono.util';
import { mapearConflicto } from './conflicto.mapeo';

/**
 * De `GET /conflictos/reporte` (lista de `ConflictoDto`, sin paginar) al
 * Excel de cada reporte. El backend manda los datos, no el archivo: el
 * libro se arma aqui con `xlsx` (la misma libreria del «Exportar» de
 * `/admin`). Funciones puras.
 *
 * @author Elvis Flores
 */

/** Una fila del Excel: encabezado de columna → valor. */
export type FilaReporte = Record<string, string | number>;

/**
 * Lo que se usa de un libro de `xlsx`. El host declara el modulo sin tipos
 * (`src/typings.d.ts`), asi que el tipo se define aqui.
 */
export interface LibroExcel {
  SheetNames: string[];
  Sheets: Record<string, Record<string, unknown>>;
}

/** Nombre de la hoja de cada reporte. */
const HOJA: Readonly<Record<TipoReporte, string>> = {
  'RG.02': 'Análisis de Conflictos',
  'RG.03': 'Informe General'
};

/** Texto del origen de un caso. */
const TEXTO_ORIGEN: Readonly<Record<OrigenApi, string>> = {
  DECLARADO: 'Declarado en el formulario',
  DETECTADO_AUTO: 'Detectado por el sistema'
};

/**
 * @param texto Fecha del backend (ISO, con o sin hora).
 * @returns `dd/mm/aaaa`; vacío si no viene o no es válida.
 */
function fecha(texto: string | null): string {
  if (!texto) {
    return '';
  }
  try {
    return formatearFecha(parsearFecha(texto));
  } catch {
    return '';
  }
}

/**
 * Filas de un reporte, una por conflicto, con los textos de las pantallas
 * («Moderado», «No declarado (omisión)», «En ejecución»...).
 *
 * - RG.02 (Análisis): las dos personas con cédula y departamento,
 *   parentesco, riesgo, origen, clasificación, observación, estado y fecha.
 * - RG.03 (Informe General): personas, parentesco, riesgo, estado y si
 *   tiene actividades vencidas. El reporte del backend no trae los planes
 *   ni sus actividades: el detalle por plan se ve en la pantalla.
 *
 * @param tipo Reporte.
 * @param conflictos Filas de `GET /conflictos/reporte`.
 * @returns Filas del Excel, en el orden del backend.
 * @author Elvis Flores
 */
export function filasReporte(tipo: TipoReporte, conflictos: readonly ConflictoApi[]): FilaReporte[] {
  return conflictos.map((api): FilaReporte => {
    const c = mapearConflicto(api);

    if (tipo === 'RG.03') {
      return {
        'N.º de caso': c.id,
        'Persona A': c.personaA.nombres,
        'Departamento A': c.personaA.departamento,
        'Persona B': c.personaB.nombres,
        'Departamento B': c.personaB.departamento,
        'Parentesco': textoParentesco(c),
        'Riesgo': textoRiesgo(c.riesgo),
        'Estado': textoEstadoSeguimiento(c.estado),
        'Actividades vencidas': api.VENCIDO ? 'Sí' : 'No',
        'Fecha de detección': fecha(api.FECHA_DETECCION)
      };
    }

    return {
      'N.º de caso': c.id,
      'Cédula A': c.personaA.cedula,
      'Persona A': c.personaA.nombres,
      'Departamento A': c.personaA.departamento,
      'Cédula B': c.personaB.cedula,
      'Persona B': c.personaB.nombres,
      'Departamento B': c.personaB.departamento,
      'Parentesco': textoParentesco(c),
      'Grado': textoGrado(c.grado),
      'Riesgo': textoRiesgo(c.riesgo),
      'Origen': api.ORIGEN ? TEXTO_ORIGEN[api.ORIGEN] : '',
      'Clasificación': textoClasificacion(c.clasificacion),
      'Observación': c.observacionClasificacion ?? '',
      'Estado': textoEstadoSeguimiento(c.estado),
      'Fecha de detección': fecha(api.FECHA_DETECCION)
    };
  });
}

/**
 * @param tipo Reporte.
 * @param hoy Fecha de la descarga.
 * @returns Nombre del archivo, p. ej. `PNIP.CI.RG.02_2026-10-27.xlsx`.
 * @author Elvis Flores
 */
export function nombreArchivoReporte(tipo: TipoReporte, hoy: Date): string {
  return 'PNIP.CI.' + tipo + '_' + formatearFechaIso(hoy) + '.xlsx';
}

/**
 * Libro de Excel con una hoja. Sin filas, la hoja lleva solo un aviso.
 * El ancho de cada columna se ajusta a su texto más largo (máximo 60).
 *
 * @param tipo Reporte (da el nombre de la hoja).
 * @param filas Filas de `filasReporte`.
 * @returns El libro.
 * @author Elvis Flores
 */
export function crearLibroReporte(tipo: TipoReporte, filas: readonly FilaReporte[]): LibroExcel {
  const libro: LibroExcel = XLSX.utils.book_new();
  const datos: FilaReporte[] = filas.length > 0 ? [...filas] : [{ 'Sin datos': 'No hay conflictos con esos filtros.' }];
  const hoja = XLSX.utils.json_to_sheet(datos);
  const columnas = Object.keys(datos[0]);

  hoja['!cols'] = columnas.map((columna) => ({
    wch: Math.min(60, Math.max(columna.length, ...datos.map((f) => String(f[columna] ?? '').length)) + 2)
  }));
  XLSX.utils.book_append_sheet(libro, hoja, HOJA[tipo]);

  return libro;
}
