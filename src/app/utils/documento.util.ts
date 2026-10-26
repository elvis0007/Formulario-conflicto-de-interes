import { Archivo } from '../models';

/**
 * Reglas de los archivos que se suben: el documento firmado de un plan
 * de accion y las evidencias de las actividades.
 *
 * @author Elvis Flores
 */

/** Tamano maximo del documento firmado: 5 MB. */
export const TAMANO_MAXIMO_DOCUMENTO_BYTES = 5 * 1024 * 1024;

/** Error: el archivo no es PDF. */
export const ERROR_DOCUMENTO_NO_PDF = 'El documento firmado debe ser un archivo PDF.';

/** Error: el archivo supera el tamano maximo. */
export const ERROR_DOCUMENTO_GRANDE = 'El documento firmado no puede superar los 5 MB.';

/** Error: el archivo esta vacio. */
export const ERROR_DOCUMENTO_VACIO = 'El archivo está vacío.';

/**
 * Valida el documento firmado antes de subirlo. Se usa en la pantalla y
 * tambien en el servicio, para que la regla no dependa solo de la vista.
 *
 * Se considera PDF si el nombre termina en `.pdf` y el navegador lo
 * reconoce como `application/pdf` (o no informa el tipo, como pasa en
 * algunos sistemas).
 *
 * @param archivo Archivo elegido.
 * @returns El mensaje de error, o `null` si es valido.
 * @author Elvis Flores
 */
export function validarDocumentoFirmado(archivo: File): string | null {
  const esPdf = archivo.name.toLowerCase().endsWith('.pdf')
    && (archivo.type === 'application/pdf' || archivo.type === '');

  if (!esPdf) {
    return ERROR_DOCUMENTO_NO_PDF;
  }
  if (archivo.size > TAMANO_MAXIMO_DOCUMENTO_BYTES) {
    return ERROR_DOCUMENTO_GRANDE;
  }
  if (archivo.size === 0) {
    return ERROR_DOCUMENTO_VACIO;
  }

  return null;
}

/** Error: la evidencia no es PDF, PNG ni JPG. */
export const ERROR_EVIDENCIA_TIPO = 'La evidencia debe ser un archivo PDF, PNG o JPG.';

/** Error: la evidencia supera el tamano maximo. */
export const ERROR_EVIDENCIA_GRANDE = 'La evidencia no puede superar los 5 MB.';

/** Tipos MIME aceptados para cada tipo de evidencia. */
const MIME_POR_TIPO: Readonly<Record<Archivo['tipo'], readonly string[]>> = {
  pdf: ['application/pdf'],
  png: ['image/png'],
  jpg: ['image/jpeg']
};

/** Extensiones aceptadas y su tipo. */
const TIPO_POR_EXTENSION: Readonly<Record<string, Archivo['tipo']>> = {
  pdf: 'pdf',
  png: 'png',
  jpg: 'jpg',
  jpeg: 'jpg'
};

/** Valor del `accept` del input de evidencias. */
export const ACCEPT_EVIDENCIA = '.pdf,.png,.jpg,.jpeg,application/pdf,image/png,image/jpeg';

/**
 * Tipo de evidencia de un archivo, por su extension y su tipo MIME (que
 * debe coincidir, o venir vacio como en algunos sistemas).
 *
 * @param archivo Archivo elegido.
 * @returns `pdf`, `png` o `jpg`; `null` si no es un tipo permitido.
 * @author Elvis Flores
 */
export function tipoDeEvidencia(archivo: File): Archivo['tipo'] | null {
  const extension = archivo.name.toLowerCase().split('.').pop() ?? '';
  const tipo = archivo.name.includes('.') ? TIPO_POR_EXTENSION[extension] : undefined;

  if (tipo === undefined) {
    return null;
  }

  return archivo.type === '' || MIME_POR_TIPO[tipo].includes(archivo.type) ? tipo : null;
}

/**
 * Valida la evidencia de una actividad antes de subirla: PDF, PNG o JPG
 * de hasta 5 MB. Se usa en la pantalla y en el servicio.
 *
 * @param archivo Archivo elegido.
 * @returns El mensaje de error, o `null` si es valida.
 * @author Elvis Flores
 */
export function validarEvidencia(archivo: File): string | null {
  if (tipoDeEvidencia(archivo) === null) {
    return ERROR_EVIDENCIA_TIPO;
  }
  if (archivo.size > TAMANO_MAXIMO_DOCUMENTO_BYTES) {
    return ERROR_EVIDENCIA_GRANDE;
  }
  if (archivo.size === 0) {
    return ERROR_DOCUMENTO_VACIO;
  }

  return null;
}
