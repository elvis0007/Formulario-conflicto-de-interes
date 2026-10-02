import {
  ERROR_DOCUMENTO_GRANDE,
  ERROR_DOCUMENTO_NO_PDF,
  ERROR_DOCUMENTO_VACIO,
  TAMANO_MAXIMO_DOCUMENTO_BYTES,
  validarDocumentoFirmado
} from './documento.util';

describe('documento.util', () => {
  /**
   * @param nombre Nombre del archivo.
   * @param tipo Tipo MIME.
   * @param bytes Tamano.
   * @returns Un File de prueba.
   */
  function archivo(nombre: string, tipo: string, bytes = 10): File {
    return new File([new Uint8Array(bytes)], nombre, { type: tipo });
  }

  it('acepta un PDF', () => {
    expect(validarDocumentoFirmado(archivo('plan.pdf', 'application/pdf'))).toBeNull();
    expect(validarDocumentoFirmado(archivo('PLAN.PDF', 'application/pdf'))).toBeNull();
    expect(validarDocumentoFirmado(archivo('plan.pdf', '')))
      .withContext('algunos sistemas no informan el tipo').toBeNull();
  });

  it('rechaza lo que no es PDF', () => {
    expect(validarDocumentoFirmado(archivo('foto.png', 'image/png'))).toBe(ERROR_DOCUMENTO_NO_PDF);
    expect(validarDocumentoFirmado(archivo('notas.txt', 'text/plain'))).toBe(ERROR_DOCUMENTO_NO_PDF);
    expect(validarDocumentoFirmado(archivo('disfrazado.pdf', 'image/png')))
      .withContext('nombre .pdf pero no es PDF').toBe(ERROR_DOCUMENTO_NO_PDF);
  });

  it('rechaza un PDF de más de 10 MB y acepta uno de 10 MB justos', () => {
    expect(validarDocumentoFirmado(archivo('grande.pdf', 'application/pdf', TAMANO_MAXIMO_DOCUMENTO_BYTES + 1)))
      .toBe(ERROR_DOCUMENTO_GRANDE);
    expect(validarDocumentoFirmado(archivo('justo.pdf', 'application/pdf', TAMANO_MAXIMO_DOCUMENTO_BYTES)))
      .toBeNull();
  });

  it('rechaza un archivo vacío', () => {
    expect(validarDocumentoFirmado(archivo('vacio.pdf', 'application/pdf', 0))).toBe(ERROR_DOCUMENTO_VACIO);
  });
});
