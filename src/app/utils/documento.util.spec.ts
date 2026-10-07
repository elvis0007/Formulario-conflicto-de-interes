import {
  ERROR_DOCUMENTO_GRANDE,
  ERROR_DOCUMENTO_NO_PDF,
  ERROR_DOCUMENTO_VACIO,
  ERROR_EVIDENCIA_GRANDE,
  ERROR_EVIDENCIA_TIPO,
  TAMANO_MAXIMO_DOCUMENTO_BYTES,
  tipoDeEvidencia,
  validarDocumentoFirmado,
  validarEvidencia
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

  describe('evidencias', () => {
    it('acepta PDF, PNG y JPG (también .jpeg y sin tipo MIME)', () => {
      expect(validarEvidencia(archivo('informe.pdf', 'application/pdf'))).toBeNull();
      expect(validarEvidencia(archivo('captura.PNG', 'image/png'))).toBeNull();
      expect(validarEvidencia(archivo('foto.jpg', 'image/jpeg'))).toBeNull();
      expect(validarEvidencia(archivo('foto.jpeg', ''))).toBeNull();
      expect(tipoDeEvidencia(archivo('foto.jpeg', 'image/jpeg'))).toBe('jpg');
      expect(tipoDeEvidencia(archivo('acta.pdf', ''))).toBe('pdf');
    });

    it('rechaza otros tipos y extensiones que no coinciden con el contenido', () => {
      expect(validarEvidencia(archivo('notas.txt', 'text/plain'))).toBe(ERROR_EVIDENCIA_TIPO);
      expect(validarEvidencia(archivo('hoja.xlsx', ''))).toBe(ERROR_EVIDENCIA_TIPO);
      expect(validarEvidencia(archivo('sin-extension', 'image/png'))).toBe(ERROR_EVIDENCIA_TIPO);
      expect(validarEvidencia(archivo('falso.png', 'application/pdf'))).toBe(ERROR_EVIDENCIA_TIPO);
    });

    it('rechaza más de 10 MB y archivos vacíos', () => {
      expect(validarEvidencia(archivo('grande.png', 'image/png', TAMANO_MAXIMO_DOCUMENTO_BYTES + 1)))
        .toBe(ERROR_EVIDENCIA_GRANDE);
      expect(validarEvidencia(archivo('justo.png', 'image/png', TAMANO_MAXIMO_DOCUMENTO_BYTES))).toBeNull();
      expect(validarEvidencia(archivo('vacio.jpg', 'image/jpeg', 0))).toBe(ERROR_DOCUMENTO_VACIO);
    });
  });
});
