import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, TestRequest, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Observable, firstValueFrom } from 'rxjs';
import { PlanAccion } from '../../models';
import {
  ActividadBandejaApi,
  ConflictoDetalleApi,
  ExpedienteApi,
  PaginaApi,
  PlanApi,
  RespuestaApi
} from '../../models/api';
import { actividadApi, conflictoApi, evidenciaApi, planApi } from '../../testing/api-ejemplos';
import { PerfilUsuarioFalso, proveerPerfilFalso } from '../../testing/perfil-usuario-falso';
import { RELOJ } from '../../utils/reloj';
import { ERROR_MOTIVO_CIERRE } from '../planes-mock.service';
import {
  ERROR_ARCHIVO_GRANDE,
  ERROR_ARCHIVO_TIPO,
  ERROR_PLAN_DESCONOCIDO,
  PlanesHttpService,
  TAMANO_MAXIMO_BACKEND_BYTES
} from './planes-http.service';
import { urlApi } from './peticiones';

describe('PlanesHttpService', () => {
  /** «Hoy» fijo: 23 de octubre de 2026. */
  const HOY = new Date(2026, 9, 23, 10, 0);
  const EXPEDIENTES = urlApi('/conflictos/expedientes') + '?pagina=0&tamanoPagina=200';
  const DETALLE = urlApi('/conflictos/1420');
  const BANDEJA = urlApi('/actividades/mias') + '?incluirCerrados=true';
  const MENSAJE_409 = 'El conflicto ya tiene un plan abierto (41, FIRMADO); no se crea otro hasta que se cierre';

  let servicio: PlanesHttpService;
  let http: HttpTestingController;

  /**
   * @param datos Datos de la respuesta.
   * @returns Sobre `OK` del backend.
   */
  function ok<T>(datos: T): RespuestaApi<T> {
    return { estado: 'OK', mensaje: 'ok', datos };
  }

  /**
   * Responde una petición con el error del backend.
   *
   * @param peticion Petición pendiente.
   * @param mensaje Mensaje del backend.
   * @param status Código HTTP.
   */
  function fallar(peticion: TestRequest, mensaje: string, status = 409): void {
    peticion.flush({ estado: 'ERROR', mensaje }, { status, statusText: 'Error' });
  }

  /**
   * @param planes Planes del conflicto 1420.
   * @returns Detalle del conflicto.
   */
  function detalle(planes: PlanApi[]): ConflictoDetalleApi {
    return {
      CONFLICTO: conflictoApi(),
      LINEA_DE_TIEMPO: [],
      PLAN: planes[planes.length - 1] ?? null,
      PLANES: planes,
      DIRECTOR_A: null,
      DIRECTOR_B: null,
      FICHA_A: null,
      FICHA_B: null,
      JEFE_INMEDIATO_A: null,
      JEFE_INMEDIATO_B: null
    };
  }

  /**
   * @param planes Planes del único expediente.
   * @returns Página única de expedientes.
   */
  function expedientes(planes: PlanApi[]): RespuestaApi<PaginaApi<ExpedienteApi>> {
    return ok({
      DATOS: [{ CONFLICTO: conflictoApi(), PLANES: planes }],
      PAGINA_ACTUAL: 0,
      'TAMAÑO_PAGINA': 200,
      TOTAL_ELEMENTOS: 1,
      TOTAL_PAGINAS: 1,
      ES_PRIMERA: true,
      ES_ULTIMA: true
    });
  }

  /** @returns Plan en borrador de ejemplo (id 50), sin documento ni fechas. */
  function borrador(): PlanApi {
    return planApi({
      CODIGO: 50,
      NUMERO: 2,
      ESTADO_PLAN: 'BORRADOR',
      FECHA_FIRMA: null,
      METODO_FIRMA: null,
      DOCUMENTO_FIRMADO: null,
      ACTIVIDADES: [actividadApi({
        CODIGO: 60, ESTADO: 'PENDIENTE', FECHA_ASIGNACION: null, FECHA_LIMITE: null, EVIDENCIAS: []
      })]
    });
  }

  /**
   * @param cambios Campos a cambiar.
   * @returns Fila de la bandeja (actividad 3 del plan 41).
   */
  function fila(cambios: Partial<ActividadBandejaApi> = {}): ActividadBandejaApi {
    return {
      CODIGO: 3,
      CONFLICTO_ID: 1420,
      NOMBRE_A: 'Ana',
      NOMBRE_B: 'Juan',
      PARENTESCO: 'PADRE',
      RIESGO: 'ALTO',
      PLAN_ID: 41,
      PLAN_NUMERO: 1,
      PLAN_ESTADO: 'FIRMADO',
      PLAN_OBJETIVO: 'Mitigar',
      PLAN_TOTAL_ACTIVIDADES: 3,
      DESCRIPCION: 'Separar funciones',
      FECHA_ASIGNACION: '2026-10-01',
      PLAZO_MESES: 1,
      PLAZO_DIAS: 0,
      FECHA_LIMITE: '2026-11-01',
      ESTADO: 'PENDIENTE',
      VENCIDA: false,
      ULTIMA_EVIDENCIA: null,
      ...cambios
    };
  }

  /**
   * @param nombre Nombre del archivo.
   * @param bytes Contenido (por defecto, la firma de un PDF).
   * @param tipo Tipo MIME.
   * @returns Archivo de prueba.
   */
  function archivo(nombre = 'plan.pdf', bytes: number[] = [0x25, 0x50, 0x44, 0x46, 0x2d, 0x31], tipo = 'application/pdf'): File {
    return new File([new Uint8Array(bytes)], nombre, { type: tipo });
  }

  /**
   * Espera a que el servicio haga una petición (la validación de archivos
   * lee los primeros bytes de forma asíncrona).
   *
   * @param url URL completa esperada.
   * @returns La petición.
   */
  async function esperarPeticion(url: string): Promise<TestRequest> {
    for (let intento = 0; intento < 100; intento++) {
      const encontradas = http.match(url);

      if (encontradas.length > 0) {
        return encontradas[0];
      }
      await new Promise((resolver) => setTimeout(resolver, 5));
    }
    throw new Error('No llegó la petición ' + url);
  }

  /**
   * Suscribe y devuelve el primer valor emitido de forma síncrona.
   *
   * @param fuente Observable del servicio.
   * @returns Función que da el último valor recibido.
   */
  function escuchar<T>(fuente: Observable<T>): () => T | undefined {
    let valor: T | undefined;

    fuente.subscribe((v) => valor = v);
    return () => valor;
  }

  /** Deja el conflicto 1420 en memoria con los planes dados. */
  function cargarConflicto(planes: PlanApi[]): void {
    servicio.obtenerPlanesDeConflicto('1420').subscribe();
    http.expectOne(DETALLE).flush(ok(detalle(planes)));
  }

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: RELOJ, useValue: () => new Date(HOY) },
        proveerPerfilFalso(new PerfilUsuarioFalso(['responsable'], 'DMPER10'))
      ]
    });
    servicio = TestBed.inject(PlanesHttpService);
    http = TestBed.inject(HttpTestingController);
    spyOn(console, 'error');
    spyOn(URL, 'createObjectURL').and.returnValue('blob:prueba');
    spyOn(URL, 'revokeObjectURL');
  });

  afterEach(() => http.verify());

  describe('consultas', () => {
    it('obtenerPlanes: todos los planes de los expedientes', () => {
      const resultado = escuchar(servicio.obtenerPlanes());
      const peticion = http.expectOne(EXPEDIENTES);

      expect(peticion.request.method).toBe('GET');
      peticion.flush(expedientes([planApi(), borrador()]));

      expect(resultado()?.map((p) => [p.id, p.estado])).toEqual([['41', 'FIRMADO'], ['50', 'BORRADOR']]);
    });

    it('obtenerPlanes: [] si falla', () => {
      const resultado = escuchar(servicio.obtenerPlanes());

      fallar(http.expectOne(EXPEDIENTES), 'Error interno', 500);
      expect(resultado()).toEqual([]);
    });

    it('obtenerPlanPorId: busca en los expedientes si no lo conoce; después, de memoria', () => {
      const primero = escuchar(servicio.obtenerPlanPorId('41'));

      http.expectOne(EXPEDIENTES).flush(expedientes([planApi()]));
      expect(primero()?.nombre).toBe('Mitigar el conflicto');
      expect(escuchar(servicio.obtenerPlanPorId('41'))()?.id).toBe('41');

      const inexistente = escuchar(servicio.obtenerPlanPorId('99'));

      http.expectOne(EXPEDIENTES).flush(expedientes([]));
      expect(inexistente()).toBeUndefined();
    });

    it('obtenerPlanesDeConflicto: GET /conflictos/{id}, PLANES por número', () => {
      const resultado = escuchar(servicio.obtenerPlanesDeConflicto('1420'));
      const peticion = http.expectOne(DETALLE);

      expect(peticion.request.method).toBe('GET');
      peticion.flush(ok(detalle([borrador(), planApi()])));

      expect(resultado()?.map((p) => p.numero)).toEqual([1, 2]);
      expect(resultado()?.[0].actividades[0].evidencia?.id).toBe('7');
    });

    it('obtenerPlanesDeResponsable: bandeja con cerrados, agrupada por plan', () => {
      const resultado = escuchar(servicio.obtenerPlanesDeResponsable('DMPER10'));
      const peticion = http.expectOne(BANDEJA);

      expect(peticion.request.method).toBe('GET');
      peticion.flush(ok([fila(), fila({ CODIGO: 4 }), fila({ CODIGO: 8, PLAN_ID: 42, PLAN_NUMERO: 2 })]));

      expect(resultado()?.map((v) => [v.plan.id, v.plan.actividades.length, v.totalActividades]))
        .toEqual([['41', 2, 3], ['42', 1, 3]]);
    });

    it('obtenerPlanDeResponsable: el plan pedido, o null si no tiene actividades suyas', () => {
      const encontrado = escuchar(servicio.obtenerPlanDeResponsable('41', 'DMPER10'));

      http.expectOne(BANDEJA).flush(ok([fila()]));
      expect(encontrado()?.plan.id).toBe('41');

      const ajeno = escuchar(servicio.obtenerPlanDeResponsable('77', 'DMPER10'));

      http.expectOne(BANDEJA).flush(ok([fila()]));
      expect(ajeno()).toBeNull();
    });
  });

  describe('guardarBorrador', () => {
    /** @returns Plan nuevo del formulario (id vacío). */
    function nuevo(): PlanAccion {
      return {
        id: '',
        numero: 2,
        nombre: 'Plan 2',
        conflictoId: '1420',
        estado: 'BORRADOR',
        actividades: [{
          id: '', descripcion: 'Tarea', responsableId: 'DMPER10', responsableNombre: 'Ana', plazoMeses: 0,
          plazoDias: 10, estado: 'PENDIENTE'
        }]
      };
    }

    it('plan nuevo: POST /conflictos/{id}/plan y devuelve el plan creado', () => {
      const resultado = escuchar(servicio.guardarBorrador(nuevo()));
      const peticion = http.expectOne(urlApi('/conflictos/1420/plan'));

      expect(peticion.request.method).toBe('POST');
      expect(peticion.request.body).toEqual({
        objetivo: 'Plan 2',
        fechaReunion: null,
        actividades: [{ descripcion: 'Tarea', responsable: 'DMPER10', plazoMeses: 0, plazoDias: 10, orden: 1 }],
        involucrados: []
      });
      peticion.flush(ok(borrador()));

      expect(resultado()?.id).toBe('50');
      expect(servicio.ultimoError).toBeNull();
    });

    it('plan existente: PUT /planes/{id}, reenvía involucrados y fecha de reunión', () => {
      cargarConflicto([borrador()]);
      const resultado = escuchar(servicio.guardarBorrador({ ...nuevo(), id: '50', nombre: 'Otro nombre' }));
      const peticion = http.expectOne(urlApi('/planes/50'));

      expect(peticion.request.method).toBe('PUT');
      expect(peticion.request.body.objetivo).toBe('Otro nombre');
      expect(peticion.request.body.fechaReunion).toBe('2026-09-28');
      expect(peticion.request.body.involucrados).toEqual([{ dmper: 'DMPER20', tipo: 'F' }]);
      peticion.flush(ok(planApi({ ...borrador(), OBJETIVO: 'Otro nombre' })));

      expect(resultado()?.nombre).toBe('Otro nombre');
    });

    it('409: devuelve null y deja el mensaje del backend en ultimoError', () => {
      const resultado = escuchar(servicio.guardarBorrador(nuevo()));

      fallar(http.expectOne(urlApi('/conflictos/1420/plan')), MENSAJE_409);

      expect(resultado()).toBeNull();
      expect(servicio.ultimoError).toBe(MENSAJE_409);
    });
  });

  describe('documento firmado y envío', () => {
    it('subirDocumentoFirmado no llama al backend: guarda el archivo y lo muestra en el plan', async () => {
      cargarConflicto([borrador()]);

      const resultado = await firstValueFrom(servicio.subirDocumentoFirmado('50', archivo()));

      expect(resultado.error).toBeNull();
      expect(resultado.plan?.documentoFirmado).toEqual({
        nombre: 'plan.pdf', url: 'blob:prueba', tipo: 'pdf', fechaSubida: HOY.toISOString()
      });
    });

    it('subirDocumentoFirmado valida como el backend: 5 MB y contenido PDF/PNG/JPG', async () => {
      cargarConflicto([borrador()]);
      const grande = new File([new Uint8Array(TAMANO_MAXIMO_BACKEND_BYTES + 1)], 'plan.pdf', { type: 'application/pdf' });

      expect((await firstValueFrom(servicio.subirDocumentoFirmado('50', grande))).error).toBe(ERROR_ARCHIVO_GRANDE);
      expect((await firstValueFrom(servicio.subirDocumentoFirmado('50', archivo('plan.pdf', [0x68, 0x6f, 0x6c, 0x61]))))
        .error).toBe(ERROR_ARCHIVO_TIPO);
      expect((await firstValueFrom(servicio.subirDocumentoFirmado('99', archivo()))).error).toBe(ERROR_PLAN_DESCONOCIDO);
    });

    it('quitarDocumentoFirmado olvida el archivo y libera su URL', async () => {
      cargarConflicto([borrador()]);
      await firstValueFrom(servicio.subirDocumentoFirmado('50', archivo()));

      const plan = await firstValueFrom(servicio.quitarDocumentoFirmado('50'));

      expect(plan?.documentoFirmado).toBeUndefined();
      expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:prueba');
    });

    it('enviarYNotificar firma en un paso: multipart con archivo, FISICA y la fecha de hoy', async () => {
      const documento = archivo();

      cargarConflicto([borrador()]);
      await firstValueFrom(servicio.subirDocumentoFirmado('50', documento));
      const resultado = escuchar(servicio.enviarYNotificar('50'));
      const peticion = http.expectOne(urlApi('/planes/50/firmar'));
      const cuerpo = peticion.request.body as FormData;

      expect(peticion.request.method).toBe('POST');
      expect((cuerpo.get('archivo') as File).name).toBe('plan.pdf');
      expect(cuerpo.get('metodoFirma')).toBe('FISICA');
      expect(cuerpo.get('fechaFirma')).toBe('2026-10-23');
      peticion.flush(ok(planApi({ CODIGO: 50, NUMERO: 2 })));

      expect(resultado()?.estado).toBe('FIRMADO');
      expect(resultado()?.documentoFirmado?.url).toBe('/planes/50/documento');
    });

    it('enviarYNotificar sin documento: null sin llamar al backend', () => {
      expect(escuchar(servicio.enviarYNotificar('50'))()).toBeNull();
      expect(servicio.ultimoError).toBe('Falta el documento firmado.');
    });

    it('enviarYNotificar con 409: null y el mensaje del backend', async () => {
      cargarConflicto([borrador()]);
      await firstValueFrom(servicio.subirDocumentoFirmado('50', archivo()));
      const resultado = escuchar(servicio.enviarYNotificar('50'));

      fallar(http.expectOne(urlApi('/planes/50/firmar')), 'El plan necesita al menos una actividad antes de firmarse');

      expect(resultado()).toBeNull();
      expect(servicio.ultimoError).toBe('El plan necesita al menos una actividad antes de firmarse');
    });
  });

  describe('revisión de evidencias', () => {
    it('aprobar: PUT /evidencias/{id}/revisar con la pendiente y vuelve a pedir el conflicto', () => {
      cargarConflicto([planApi()]);
      const resultado = escuchar(servicio.aprobarEvidencia('41', '3'));
      const revision = http.expectOne(urlApi('/evidencias/7/revisar'));

      expect(revision.request.method).toBe('PUT');
      expect(revision.request.body).toEqual({ aprobada: true, motivo: null });
      revision.flush(ok({ EVIDENCIA: evidenciaApi({ ESTADO_REVISION: 'APROBADA' }), ESTADO_ACTIVIDAD: 'ACEPTADA', TODAS_ACEPTADAS: true }));
      http.expectOne(DETALLE).flush(ok(detalle([planApi({
        ESTADO_PLAN: 'CERRADO',
        TIPO_CIERRE: 'CUMPLIDO',
        FECHA_CIERRE: '2026-10-23',
        ACTIVIDADES: [actividadApi({ ESTADO: 'ACEPTADA', EVIDENCIAS: [evidenciaApi({ ESTADO_REVISION: 'APROBADA' })] })]
      })])));

      expect(resultado()?.estado).toBe('CERRADO');
      expect(resultado()?.tipoCierre).toBe('CUMPLIDO');
      expect(resultado()?.actividades[0].estado).toBe('ACEPTADA');
    });

    it('si el plan en memoria no tiene la evidencia pendiente, vuelve a pedir el conflicto antes', () => {
      cargarConflicto([planApi({ ACTIVIDADES: [actividadApi({ ESTADO: 'PENDIENTE', EVIDENCIAS: [] })] })]);
      const resultado = escuchar(servicio.rechazarEvidencia('41', '3', ' Ilegible '));

      http.expectOne(DETALLE).flush(ok(detalle([planApi()])));
      const revision = http.expectOne(urlApi('/evidencias/7/revisar'));

      expect(revision.request.body).toEqual({ aprobada: false, motivo: 'Ilegible' });
      revision.flush(ok({ EVIDENCIA: null, ESTADO_ACTIVIDAD: 'RECHAZADA', TODAS_ACEPTADAS: false }));
      http.expectOne(DETALLE).flush(ok(detalle([planApi({
        ACTIVIDADES: [actividadApi({ ESTADO: 'RECHAZADA', EVIDENCIAS: [evidenciaApi({ ESTADO_REVISION: 'RECHAZADA', MOTIVO_RECHAZO: 'Ilegible' })] })]
      })])));

      expect(resultado()?.actividades[0].evidencia?.motivoRechazo).toBe('Ilegible');
    });

    it('plan desconocido: lo busca en los expedientes', () => {
      const resultado = escuchar(servicio.aprobarEvidencia('41', '3'));

      http.expectOne(EXPEDIENTES).flush(expedientes([planApi()]));
      http.expectOne(urlApi('/evidencias/7/revisar')).flush(ok({}));
      http.expectOne(DETALLE).flush(ok(detalle([planApi()])));

      expect(resultado()?.id).toBe('41');
    });

    it('403/409: null y el mensaje del backend en ultimoError', () => {
      cargarConflicto([planApi()]);
      const resultado = escuchar(servicio.aprobarEvidencia('41', '3'));

      fallar(http.expectOne(urlApi('/evidencias/7/revisar')), 'La evidencia ya fue revisada (APROBADA) y no se puede revisar de nuevo');

      expect(resultado()).toBeNull();
      expect(servicio.ultimoError).toBe('La evidencia ya fue revisada (APROBADA) y no se puede revisar de nuevo');
    });

    it('rechazar sin motivo: null sin llamar al backend', () => {
      expect(escuchar(servicio.rechazarEvidencia('41', '3', '  '))()).toBeNull();
      expect(servicio.ultimoError).toBe('El motivo del rechazo es obligatorio.');
    });
  });

  describe('subirEvidencia', () => {
    it('POST multipart (archivo y observación vacía) y devuelve el plan de la bandeja', async () => {
      const resultado = firstValueFrom(servicio.subirEvidencia('41', '3', archivo('foto.png', [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], 'image/png')));
      const peticion = await esperarPeticion(urlApi('/actividades/3/evidencias'));
      const cuerpo = peticion.request.body as FormData;

      expect(peticion.request.method).toBe('POST');
      expect((cuerpo.get('archivo') as File).name).toBe('foto.png');
      expect(cuerpo.get('observacion')).toBe('');
      peticion.flush(ok(evidenciaApi()));
      http.expectOne(BANDEJA).flush(ok([fila({ ESTADO: 'EN_REVISION', ULTIMA_EVIDENCIA: evidenciaApi() })]));

      const final = await resultado;

      expect(final.error).toBeNull();
      expect(final.plan?.plan.actividades[0]).toEqual(jasmine.objectContaining({
        id: '3', estado: 'EN_REVISION', responsableId: 'DMPER10'
      }));
    });

    it('409: el mensaje del backend', async () => {
      const resultado = firstValueFrom(servicio.subirEvidencia('41', '3', archivo()));

      fallar(await esperarPeticion(urlApi('/actividades/3/evidencias')),
        'La actividad está EN_REVISION: solo se sube evidencia cuando está PENDIENTE o RECHAZADA');

      expect(await resultado).toEqual({
        plan: null,
        error: 'La actividad está EN_REVISION: solo se sube evidencia cuando está PENDIENTE o RECHAZADA'
      });
    });

    it('archivo no permitido: error sin llamar al backend', async () => {
      const resultado = await firstValueFrom(servicio.subirEvidencia('41', '3', archivo('virus.pdf', [0x4d, 0x5a])));

      expect(resultado).toEqual({ plan: null, error: ERROR_ARCHIVO_TIPO });
    });
  });

  describe('cerrarPlan', () => {
    it('POST /planes/{id}/cerrar con el motivo y devuelve el plan cerrado', () => {
      const resultado = escuchar(servicio.cerrarPlan('41', '  Plazo vencido sin avances. '));
      const peticion = http.expectOne(urlApi('/planes/41/cerrar'));

      expect(peticion.request.method).toBe('POST');
      expect(peticion.request.body).toEqual({ motivo: 'Plazo vencido sin avances.' });
      peticion.flush(ok(planApi({
        ESTADO_PLAN: 'CERRADO', TIPO_CIERRE: 'ANTICIPADO', MOTIVO_CIERRE: 'Plazo vencido sin avances.',
        FECHA_CIERRE: '2026-10-23', ACTIVIDADES: [actividadApi({ ESTADO: 'NO_CUMPLIDA', EVIDENCIAS: [] })]
      })));

      expect(resultado()?.error).toBeNull();
      expect(resultado()?.plan).toEqual(jasmine.objectContaining({
        estado: 'CERRADO', tipoCierre: 'ANTICIPADO', motivoCierre: 'Plazo vencido sin avances.'
      }));
      expect(resultado()?.plan?.actividades[0].estado).toBe('NO_CUMPLIDA');
    });

    it('409: el mensaje del backend', () => {
      const mensaje = 'El plan solo se cierra anticipadamente cuando al menos una actividad tiene el plazo vencido';
      const resultado = escuchar(servicio.cerrarPlan('41', 'Motivo'));

      fallar(http.expectOne(urlApi('/planes/41/cerrar')), mensaje);

      expect(resultado()).toEqual({ plan: null, error: mensaje });
    });

    it('sin motivo: error sin llamar al backend', () => {
      expect(escuchar(servicio.cerrarPlan('41', ' '))()).toEqual({ plan: null, error: ERROR_MOTIVO_CIERRE });
    });
  });

  describe('descargas', () => {
    it('obtenerDocumentoPlan: GET /planes/{id}/documento como Blob', () => {
      const contenido = new Blob(['%PDF'], { type: 'application/pdf' });
      const resultado = escuchar(servicio.obtenerDocumentoPlan('41'));
      const peticion = http.expectOne(urlApi('/planes/41/documento'));

      expect(peticion.request.method).toBe('GET');
      expect(peticion.request.responseType).toBe('blob');
      peticion.flush(contenido);

      expect(resultado()).toBe(contenido);
    });

    it('obtenerArchivoEvidencia: GET /evidencias/{id}/archivo; null si falla', () => {
      const resultado = escuchar(servicio.obtenerArchivoEvidencia('7'));
      const peticion = http.expectOne(urlApi('/evidencias/7/archivo'));

      expect(peticion.request.responseType).toBe('blob');
      peticion.flush(null, { status: 404, statusText: 'Not Found' });

      expect(resultado()).toBeNull();
    });
  });
});
