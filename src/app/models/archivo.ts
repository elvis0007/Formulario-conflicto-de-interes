/**
 * Referencia a un archivo almacenado (documento firmado, evidencia...).
 *
 * @author Elvis Flores
 */
export interface Archivo {
  /** Nombre original del archivo, con extension. */
  nombre: string;
  /** URL desde la que se puede descargar o visualizar el archivo. */
  url: string;
  /** Formato del archivo; solo se admiten PDF e imagenes. */
  tipo: 'pdf' | 'png' | 'jpg';
}
