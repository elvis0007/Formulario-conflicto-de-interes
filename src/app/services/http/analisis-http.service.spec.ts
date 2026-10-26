import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, TestRequest, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { AnalisisConflictos, ResumenAnalisis } from '../../models';
import { AnalisisApi, ConflictoApi } from '../../models/api';
import { AnalisisHttpService } from './analisis-http.service';
import { urlApi } from './peticiones';

describe('AnalisisHttpService', () => {
  const ANALISIS_8: AnalisisApi = {
    CODIGO: 8, ESTADO_ANALISIS: 'BORRADOR', FECHA_EJECUCION: '2026-10-05T09:00:00', FECHA_VALIDACION: null,
    VALIDADO_POR: null, TOTAL_NUEVOS: 2, TOTAL_EXISTENTES: 0, TOTAL_OMITIDOS: 0, TOTAL_CONFLICTOS: 2, SIN_CLASIFICAR: 1
  };
  const ANALISIS_7: AnalisisApi = {
    ...ANALISIS_8, CODIGO: 7, ESTADO_ANALISIS: 'VALIDADO', FECHA_EJECUCION: '2026-09-01T09:00:00',
    FECHA_VALIDACION: '2026-09-02T09:00:00', VALIDADO_POR: 'rrhh', SIN_CLASIFICAR: 0
  };
  const CONFLICTO: ConflictoApi = {
    CODIGO: 21, ANALISIS_ID: 8, CEDULA_A: '1', NOMBRE_A: 'Ana', DEPARTAMENTO_A: 'Finanzas',
    CEDULA_B: '2', NOMBRE_B: 'Luis', DEPARTAMENTO_B: 'Compras', TIPO_RELACION: 'F', PARENTESCO: 'HERMANO',
    PARENTESCO_INVERSO: 'HERMANO', TIPO_GRADO: 'C', GRADO: 2, RIESGO: 'ALTO', ORIGEN: 'DETECTADO_AUTO',
    CLASIFICACION: null, CONFIANZA: 0.9, DETALLE: null, OBSERVACION: null, ESTADO_SEGUIMIENTO: 'DETECTADO',
    VENCIDO: false, FECHA_DETECCION: '2026-10-05T09:00:00'
  };
  let servicio: AnalisisHttpService;
  let http: HttpTestingController;

  /** @returns Petición de la lista de análisis. */
  function pedidoLista(): TestRequest {
    return http.expectOne(urlApi('/conflictos/analisis'));
  }

  /** Responde la página de expedientes del análisis 8. */
  function responderExpedientes(): void {
    const peticion = http.expectOne((p) => p.url === urlApi('/conflictos/expedientes?analisisId=8'));

    expect(peticion.request.method).toBe('GET');
    expect(peticion.request.params.get('tamanoPagina')).toBe('200');
    peticion.flush({
      estado: 'OK',
      datos: {
        DATOS: [{ CONFLICTO, PLANES: [] }], PAGINA_ACTUAL: 0, 'TAMAÑO_PAGINA': 200, TOTAL_ELEMENTOS: 1,
        TOTAL_PAGINAS: 1, ES_PRIMERA: true, ES_ULTIMA: true
      }
    });
  }

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    servicio = TestBed.inject(AnalisisHttpService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('obtenerAnalisisActual toma el más reciente y trae sus casos', () => {
    let resultado: AnalisisConflictos | undefined;

    servicio.obtenerAnalisisActual().subscribe((r) => resultado = r);
    const lista = pedidoLista();

    expect(lista.request.method).toBe('GET');
    lista.flush({ estado: 'OK', datos: [ANALISIS_8, ANALISIS_7] });
    responderExpedientes();
    expect(resultado?.id).toBe('8');
    expect(resultado?.estado).toBe('BORRADOR');
    expect(resultado?.conflictos.map((c) => c.id)).toEqual(['21']);
  });

  it('obtenerAnalisisActual devuelve el vacío si nunca se generó uno', () => {
    let resultado: AnalisisConflictos | undefined;

    servicio.obtenerAnalisisActual().subscribe((r) => resultado = r);
    pedidoLista().flush({ estado: 'OK', datos: [] });
    expect(resultado).toEqual({ id: null, estado: null, fechaGeneracion: null, conflictos: [] });
  });

  it('obtenerAnalisisActual devuelve el vacío si falla', () => {
    let resultado: AnalisisConflictos | undefined;

    spyOn(console, 'error');
    servicio.obtenerAnalisisActual().subscribe((r) => resultado = r);
    pedidoLista().flush({ estado: 'ERROR' }, { status: 500, statusText: 'Error' });
    expect(resultado?.estado).toBeNull();
    expect(resultado?.conflictos).toEqual([]);
  });

  it('generarAnalisis hace POST /conflictos/analisis y vuelve a pedir el actual', () => {
    let resultado: AnalisisConflictos | undefined;

    servicio.generarAnalisis().subscribe((r) => resultado = r);
    const generar = http.expectOne(urlApi('/conflictos/analisis'));

    expect(generar.request.method).toBe('POST');
    generar.flush({ estado: 'OK', datos: { ANALISIS_ID: 8 } });
    pedidoLista().flush({ estado: 'OK', datos: [ANALISIS_8] });
    responderExpedientes();
    expect(resultado?.id).toBe('8');
  });

  it('generarAnalisis devuelve el vacío si el backend falla (409)', () => {
    let resultado: AnalisisConflictos | undefined;

    spyOn(console, 'error');
    servicio.generarAnalisis().subscribe((r) => resultado = r);
    http.expectOne(urlApi('/conflictos/analisis'))
      .flush({ estado: 'ERROR', mensaje: 'Ya hay una ejecución' }, { status: 409, statusText: 'Conflict' });
    expect(resultado?.estado).toBeNull();
  });

  it('obtenerHistorialAnalisis salta el actual y mapea el resto', () => {
    let resultado: ResumenAnalisis[] | undefined;

    servicio.obtenerHistorialAnalisis().subscribe((r) => resultado = r);
    pedidoLista().flush({ estado: 'OK', datos: [ANALISIS_8, ANALISIS_7] });
    expect(resultado).toEqual([{
      id: '7', fechaGeneracion: '2026-09-01T09:00:00', estado: 'VALIDADO', totalCasos: 2, confirmados: 2
    }]);
  });

  it('obtenerHistorialAnalisis devuelve vacío si falla', () => {
    let resultado: ResumenAnalisis[] | undefined;

    spyOn(console, 'error');
    servicio.obtenerHistorialAnalisis().subscribe((r) => resultado = r);
    pedidoLista().flush({ estado: 'ERROR' }, { status: 500, statusText: 'Error' });
    expect(resultado).toEqual([]);
  });

  it('obtenerAnalisisRegistrados devuelve todos del más antiguo al más reciente, sin casos', () => {
    let resultado: AnalisisConflictos[] | undefined;

    servicio.obtenerAnalisisRegistrados().subscribe((r) => resultado = r);
    pedidoLista().flush({ estado: 'OK', datos: [ANALISIS_8, ANALISIS_7] });
    expect(resultado?.map((a) => a.id)).toEqual(['7', '8']);
    expect(resultado?.every((a) => a.conflictos.length === 0)).toBeTrue();
  });

  it('actualizarClasificacion D envía EN_PLANIFICACION con la clasificación', () => {
    let resultado: boolean | undefined;

    servicio.actualizarClasificacion('21', 'D', ' lo declaró ').subscribe((r) => resultado = r);
    const peticion = http.expectOne(urlApi('/conflictos/21/transicion'));

    expect(peticion.request.method).toBe('POST');
    expect(peticion.request.body).toEqual({
      estadoNuevo: 'EN_PLANIFICACION', comentario: 'lo declaró', clasificacion: 'D'
    });
    peticion.flush({ estado: 'OK', datos: CONFLICTO });
    expect(resultado).toBeTrue();
  });

  it('actualizarClasificacion N sin observación manda un comentario por defecto', () => {
    servicio.actualizarClasificacion('21', 'N', '').subscribe();
    const peticion = http.expectOne(urlApi('/conflictos/21/transicion'));

    expect(peticion.request.body.comentario).toBe('Clasificado como no declarado');
    expect(peticion.request.body.clasificacion).toBe('N');
    peticion.flush({ estado: 'OK', datos: CONFLICTO });
  });

  it('actualizarClasificacion H envía DESCARTADO con el comentario', () => {
    servicio.actualizarClasificacion('21', 'H', 'Es un homónimo').subscribe();
    const peticion = http.expectOne(urlApi('/conflictos/21/transicion'));

    expect(peticion.request.body).toEqual({
      estadoNuevo: 'DESCARTADO', comentario: 'Es un homónimo', clasificacion: 'H'
    });
    peticion.flush({ estado: 'OK', datos: CONFLICTO });
  });

  it('actualizarClasificacion H sin comentario no llama al backend', () => {
    let resultado: boolean | undefined;
    const error = spyOn(console, 'error');

    servicio.actualizarClasificacion('21', 'H', '  ').subscribe((r) => resultado = r);
    expect(resultado).toBeFalse();
    expect(error).toHaveBeenCalled();
    expect(servicio.ultimoError).toContain('observación');
  });

  it('actualizarClasificacion a null no existe en el backend: error y false', () => {
    let resultado: boolean | undefined;
    const error = spyOn(console, 'error');

    servicio.actualizarClasificacion('21', null, '').subscribe((r) => resultado = r);
    expect(resultado).toBeFalse();
    expect(error).toHaveBeenCalled();
    expect(servicio.ultimoError).toContain('Pendiente de revisión');
  });

  it('actualizarClasificacion devuelve false si el backend responde 409', () => {
    let resultado: boolean | undefined;

    spyOn(console, 'error');
    servicio.actualizarClasificacion('21', 'D', '').subscribe((r) => resultado = r);
    http.expectOne(urlApi('/conflictos/21/transicion'))
      .flush({ estado: 'ERROR', mensaje: 'No permitida' }, { status: 409, statusText: 'Conflict' });
    expect(resultado).toBeFalse();
    expect(servicio.ultimoError).toBe('No permitida');
  });

  it('actualizarClasificacion: una clasificación buena limpia el ultimoError', () => {
    spyOn(console, 'error');
    servicio.actualizarClasificacion('21', 'D', '').subscribe();
    http.expectOne(urlApi('/conflictos/21/transicion'))
      .flush({ estado: 'ERROR', mensaje: 'El conflicto ya no está en DETECTADO' }, { status: 409, statusText: 'Conflict' });
    expect(servicio.ultimoError).toBe('El conflicto ya no está en DETECTADO');

    servicio.actualizarClasificacion('22', 'D', '').subscribe();
    http.expectOne(urlApi('/conflictos/22/transicion')).flush({ estado: 'OK', datos: CONFLICTO });
    expect(servicio.ultimoError).toBeNull();
  });

  it('validarAnalisis valida el análisis más reciente', () => {
    let resultado: boolean | undefined;

    servicio.validarAnalisis().subscribe((r) => resultado = r);
    pedidoLista().flush({ estado: 'OK', datos: [ANALISIS_8, ANALISIS_7] });
    const peticion = http.expectOne(urlApi('/conflictos/analisis/8/validar'));

    expect(peticion.request.method).toBe('POST');
    peticion.flush({ estado: 'OK', datos: ANALISIS_8 });
    expect(resultado).toBeTrue();
  });

  it('validarAnalisis registra el mensaje del 409 y devuelve false', () => {
    let resultado: boolean | undefined;
    const error = spyOn(console, 'error');

    servicio.validarAnalisis().subscribe((r) => resultado = r);
    pedidoLista().flush({ estado: 'OK', datos: [ANALISIS_8] });
    http.expectOne(urlApi('/conflictos/analisis/8/validar')).flush(
      { estado: 'ERROR', mensaje: 'quedan 1 conflicto(s) sin clasificar' },
      { status: 409, statusText: 'Conflict' }
    );
    expect(resultado).toBeFalse();
    expect(error).toHaveBeenCalled();
    expect(servicio.ultimoError).toBe('quedan 1 conflicto(s) sin clasificar');
  });

  it('validarAnalisis devuelve false si no hay análisis', () => {
    let resultado: boolean | undefined;

    spyOn(console, 'error');
    servicio.validarAnalisis().subscribe((r) => resultado = r);
    pedidoLista().flush({ estado: 'OK', datos: [] });
    expect(resultado).toBeFalse();
    expect(servicio.ultimoError).toBe('No hay un análisis para validar.');
  });

  it('generarAnalisis devuelve el análisis vacío y deja el mensaje del backend si falla', () => {
    let resultado: AnalisisConflictos | undefined;

    spyOn(console, 'error');
    servicio.generarAnalisis().subscribe((r) => resultado = r);
    http.expectOne(urlApi('/conflictos/analisis'))
      .flush({ estado: 'ERROR', mensaje: 'Ya hay un análisis en curso' }, { status: 409, statusText: 'Conflict' });
    expect(resultado?.estado).toBeNull();
    expect(servicio.ultimoError).toBe('Ya hay un análisis en curso');
  });
});
