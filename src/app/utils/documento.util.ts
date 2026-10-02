/**
 * Reglas del documento firmado de un plan de accion.
 *
 * @author Elvis Flores
 */

/** Tamano maximo del documento firmado: 10 MB. */
export const TAMANO_MAXIMO_DOCUMENTO_BYTES = 10 * 1024 * 1024;

/** Error: el archivo no es PDF. */
export const ERROR_DOCUMENTO_NO_PDF = 'El documento firmado debe ser un archivo PDF.';

/** Error: el archivo supera el tamano maximo. */
export const ERROR_DOCUMENTO_GRANDE = 'El documento firmado no puede superar los 10 MB.';

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
