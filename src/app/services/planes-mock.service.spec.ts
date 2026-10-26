import { TestBed, fakeAsync, tick } from '@angular/core/testing';
import { Observable } from 'rxjs';
import { PlanAccion } from '../models';
import { LATENCIA_SIMULADA_MS } from './mock-data/simular-respuesta';
import { NotificacionesMockService } from './notificaciones-mock.service';
import {
  ERROR_CIERRE_EN_REVISION,
  ERROR_CIERRE_NO_FIRMADO,
  ERROR_CIERRE_SIN_VENCIDAS,
  ERROR_MOTIVO_CIERRE,
  PlanesMockService,
  ResultadoDocumento
} from './planes-mock.service';
import { ERROR_DOCUMENTO_GRANDE, ERROR_DOCUMENTO_NO_PDF } from '../utils/documento.util';
import { RELOJ } from '../utils/reloj';
import { PerfilUsuarioFalso, proveerPerfilFalso } from '../testing/perfil-usuario-falso';

describe('PlanesMockService', () => {
  let servicio: PlanesMockService;

  /**
   * @param fuente Observable del servicio.
   * @returns Lo que emitio tras la latencia simulada.
   */
  function esperar<T>(fuente: Observable<T>): T | undefined {
    let valor: T | undefined;

    fuente.subscribe((v) => valor = v);
    tick(LATENCIA_SIMULADA_MS);
    return valor;
  }

  /**
   * @param conflictoId Conflicto del plan.
   * @returns Un plan nuevo en borrador, sin guardar.
   */
  function planNuevo(conflictoId: string): PlanAccion {
    return {
      id: '',
      numero: 0,
      nombre: 'Plan de prueba',
      conflictoId,
      estado: 'BORRADOR',
      actividades: [{
        id: '',
        descripcion: 'Actividad de prueba',
        responsableId: 'EMP-001',
        responsableNombre: 'Carlos Andrés Mayorga Sánchez',
        plazoMeses: 0,
        plazoDias: 15,
        estado: 'PENDIENTE'
      }]
    };
  }

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [proveerPerfilFalso(new PerfilUsuarioFalso(['rrhh'], 'EMP-008', 'Lucía Alejandra Freire Ortiz'))] });
    servicio = TestBed.inject(PlanesMockService);
    spyOn(console, 'error');
  });

  it('obtenerPlanesDeConflicto devuelve los planes del conflicto por número', fakeAsync(() => {
    expect(esperar(servicio.obtenerPlanesDeConflicto('C-001'))?.map((p) => p.id))
      .toEqual(['PL-001', 'PL-002']);
    expect(esperar(servicio.obtenerPlanesDeConflicto('C-005'))).toEqual([]);
  }));

  it('guardar un plan nuevo le asigna id y el siguiente número del conflicto', fakeAsync(() => {
    const guardado = esperar(servicio.guardarBorrador(planNuevo('C-005')));

    expect(guardado?.id).toBe('PL-008');
    expect(guardado?.numero).toBe(1);
    expect(guardado?.actividades[0].id).toMatch(/^A-\d{3}$/);
    expect(esperar(servicio.obtenerPlanesDeConflicto('C-005'))?.map((p) => p.id)).toEqual(['PL-008']);
  }));

  it('el número es correlativo dentro del conflicto', fakeAsync(() => {
    const primero = esperar(servicio.guardarBorrador(planNuevo('C-004')));

    expect(primero?.numero).withContext('C-004 ya tiene el Plan 01 cerrado').toBe(2);
  }));

  it('no crea un plan nuevo si el conflicto tiene uno vigente', fakeAsync(() => {
    expect(esperar(servicio.guardarBorrador(planNuevo('C-001')))).toBeNull();
    expect(esperar(servicio.obtenerPlanesDeConflicto('C-001'))?.length).toBe(2);
  }));

  it('actualiza un borrador existente y conserva su número', fakeAsync(() => {
    const original = esperar(servicio.obtenerPlanPorId('PL-004')) as PlanAccion;
    const guardado = esperar(servicio.guardarBorrador({ ...original, nombre: 'Nombre nuevo', numero: 99 }));

    expect(guardado?.nombre).toBe('Nombre nuevo');
    expect(guardado?.numero).toBe(original.numero);
    expect(esperar(servicio.obtenerPlanPorId('PL-004'))?.nombre).toBe('Nombre nuevo');
  }));

  it('no guarda planes que no están en borrador', fakeAsync(() => {
    const activo = esperar(servicio.obtenerPlanPorId('PL-003')) as PlanAccion;

    expect(esperar(servicio.guardarBorrador({ ...activo, nombre: 'Cambio' }))).toBeNull();
    expect(esperar(servicio.guardarBorrador({ ...activo, estado: 'BORRADOR', nombre: 'Cambio' })))
      .withContext('el guardado no puede convertir un activo en borrador').toBeNull();
    expect(esperar(servicio.obtenerPlanPorId('PL-003'))?.nombre).toBe(activo.nombre);
  }));

  it('no actualiza un plan que no existe', fakeAsync(() => {
    expect(esperar(servicio.guardarBorrador({ ...planNuevo('C-005'), id: 'PL-999' }))).toBeNull();
  }));
});

describe('PlanesMockService: documento firmado y envío', () => {
  /** «Hoy» fijo de estas pruebas: 2 de octubre de 2026, 10:00. */
  const HOY = new Date(2026, 9, 2, 10, 0);
  let servicio: PlanesMockService;
  let notificaciones: NotificacionesMockService;
  let perfil: PerfilUsuarioFalso;
  let urls = 0;

  /**
   * @param fuente Observable del servicio.
   * @returns Lo que emitio tras las latencias simuladas.
   */
  function esperar<T>(fuente: Observable<T>): T | undefined {
    let valor: T | undefined;

    fuente.subscribe((v) => valor = v);
    tick(LATENCIA_SIMULADA_MS * 2);
    return valor;
  }

  /**
   * @param nombre Nombre del archivo.
   * @param tipo Tipo MIME.
   * @param bytes Tamano.
   * @returns Un File de prueba.
   */
  function archivo(nombre: string, tipo = 'application/pdf', bytes = 100): File {
    return new File([new Uint8Array(bytes)], nombre, { type: tipo });
  }

  beforeEach(() => {
    urls = 0;
    perfil = new PerfilUsuarioFalso(['responsable'], null);
    TestBed.configureTestingModule({
      providers: [{ provide: RELOJ, useValue: () => new Date(HOY) }, proveerPerfilFalso(perfil)]
    });
    servicio = TestBed.inject(PlanesMockService);
    notificaciones = TestBed.inject(NotificacionesMockService);
    spyOn(URL, 'createObjectURL').and.callFake(() => 'blob:prueba-' + (++urls));
    spyOn(URL, 'revokeObjectURL');
    spyOn(console, 'error');
  });

  it('sube un PDF: nombre, tipo, fecha de subida y URL local', fakeAsync(() => {
    const resultado = esperar(servicio.subirDocumentoFirmado('PL-004', archivo('plan.pdf')));

    expect(resultado?.error).toBeNull();
    expect(resultado?.plan?.documentoFirmado).toEqual({
      nombre: 'plan.pdf',
      url: 'blob:prueba-1',
      tipo: 'pdf',
      fechaSubida: HOY.toISOString()
    });
  }));

  it('rechaza lo que no es PDF y lo que supera 5 MB', fakeAsync(() => {
    const noPdf = esperar(servicio.subirDocumentoFirmado('PL-004', archivo('foto.png', 'image/png')));
    const grande = esperar(servicio.subirDocumentoFirmado(
      'PL-004', archivo('grande.pdf', 'application/pdf', 5 * 1024 * 1024 + 1)));

    expect(noPdf).toEqual({ plan: null, error: ERROR_DOCUMENTO_NO_PDF } as ResultadoDocumento);
    expect(grande).toEqual({ plan: null, error: ERROR_DOCUMENTO_GRANDE } as ResultadoDocumento);
    expect(esperar(servicio.obtenerPlanPorId('PL-004'))?.documentoFirmado).toBeUndefined();
  }));

  it('reemplazar libera la URL anterior; quitar también', fakeAsync(() => {
    esperar(servicio.subirDocumentoFirmado('PL-004', archivo('v1.pdf')));
    const v2 = esperar(servicio.subirDocumentoFirmado('PL-004', archivo('v2.pdf')));

    expect(v2?.plan?.documentoFirmado?.nombre).toBe('v2.pdf');
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:prueba-1');

    const sinDocumento = esperar(servicio.quitarDocumentoFirmado('PL-004'));
    expect(sinDocumento?.documentoFirmado).toBeUndefined();
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:prueba-2');
  }));

  it('solo en borrador: no sube ni quita en un plan activo', fakeAsync(() => {
    expect(esperar(servicio.subirDocumentoFirmado('PL-003', archivo('plan.pdf')))?.plan).toBeNull();
    expect(esperar(servicio.quitarDocumentoFirmado('PL-003'))).toBeNull();
    expect(esperar(servicio.obtenerPlanPorId('PL-003'))?.documentoFirmado?.nombre)
      .toBe('PL-003-plan-firmado.pdf');
  }));

  it('guardar el borrador no pisa el documento', fakeAsync(() => {
    esperar(servicio.subirDocumentoFirmado('PL-004', archivo('plan.pdf')));
    const viejo = esperar(servicio.obtenerPlanPorId('PL-004')) as PlanAccion;

    esperar(servicio.guardarBorrador({ ...viejo, documentoFirmado: undefined, nombre: 'Otro' }));
    expect(esperar(servicio.obtenerPlanPorId('PL-004'))?.documentoFirmado?.nombre).toBe('plan.pdf');
  }));

  describe('enviarYNotificar', () => {
    it('no envía sin documento firmado', fakeAsync(() => {
      expect(esperar(servicio.enviarYNotificar('PL-004'))).toBeNull();
      expect(esperar(servicio.obtenerPlanPorId('PL-004'))?.estado).toBe('BORRADOR');
    }));

    it('no envía con actividades incompletas o sin actividades', fakeAsync(() => {
      const plan = esperar(servicio.obtenerPlanPorId('PL-004')) as PlanAccion;

      esperar(servicio.subirDocumentoFirmado('PL-004', archivo('plan.pdf')));
      esperar(servicio.guardarBorrador({
        ...plan,
        actividades: [...plan.actividades, { ...plan.actividades[0], id: '', descripcion: '' }]
      }));
      expect(esperar(servicio.enviarYNotificar('PL-004'))).withContext('incompleta').toBeNull();

      esperar(servicio.guardarBorrador({ ...plan, actividades: [] }));
      expect(esperar(servicio.enviarYNotificar('PL-004'))).withContext('sin actividades').toBeNull();
    }));

    it('no envía un plan que no está en borrador', fakeAsync(() => {
      expect(esperar(servicio.enviarYNotificar('PL-003'))).toBeNull();
    }));

    it('activa el plan: inicio hoy, fechas límite calculadas, actividades pendientes', fakeAsync(() => {
      esperar(servicio.subirDocumentoFirmado('PL-004', archivo('plan.pdf')));
      const activo = esperar(servicio.enviarYNotificar('PL-004'));

      expect(activo?.estado).toBe('FIRMADO');
      expect(activo?.fechaInicio).toBe('2026-10-02');
      expect(activo?.actividades.map((a) => [a.plazoMeses, a.plazoDias, a.fechaLimite, a.estado])).toEqual([
        [1, 0, '2026-11-02', 'PENDIENTE'],
        [3, 0, '2027-01-02', 'PENDIENTE']
      ]);
      expect(esperar(servicio.obtenerPlanPorId('PL-004'))?.estado).toBe('FIRMADO');
    }));

    it('agrega una notificación por responsable distinto, con su id', fakeAsync(() => {
      const plan = esperar(servicio.obtenerPlanPorId('PL-004')) as PlanAccion;
      let cambios = 0;

      notificaciones.cambios.subscribe(() => cambios++);
      esperar(servicio.guardarBorrador({
        ...plan,
        actividades: [...plan.actividades, { ...plan.actividades[0], id: '', descripcion: 'Otra del mismo' }]
      }));
      esperar(servicio.subirDocumentoFirmado('PL-004', archivo('plan.pdf')));
      esperar(servicio.enviarYNotificar('PL-004'));

      // Cada responsable ve solo la suya.
      const nuevas = ['EMP-006', 'EMP-003'].flatMap((empleadoId) => {
        perfil.empleadoId = empleadoId;
        return (esperar(notificaciones.obtenerNotificaciones()) ?? [])
          .filter((n) => n.titulo === 'Nuevo plan de acción asignado');
      });
      expect(nuevas.map((n) => [n.destinatarioId, n.texto, n.leida])).toEqual(jasmine.arrayWithExactContents([
        ['EMP-006', 'Conflicto #C-003 · Plan 01 · Control cruzado de pagos. 2 actividades a tu cargo.', false],
        ['EMP-003', 'Conflicto #C-003 · Plan 01 · Control cruzado de pagos. 1 actividad a tu cargo.', false]
      ]));
      expect(cambios).toBe(1);
    }));
  });
});

describe('PlanesMockService: revisión de evidencias', () => {
  /** «Hoy» fijo de estas pruebas: 2 de octubre de 2026, 10:00. */
  const HOY = new Date(2026, 9, 2, 10, 0);
  const REVISOR = 'Lucía Fernanda Paredes Cando';
  let servicio: PlanesMockService;
  let avisos: jasmine.Spy;

  /**
   * @param fuente Observable del servicio.
   * @returns Lo que emitio tras las latencias simuladas.
   */
  function esperar<T>(fuente: Observable<T>): T | undefined {
    let valor: T | undefined;

    fuente.subscribe((v) => valor = v);
    tick(LATENCIA_SIMULADA_MS * 2);
    return valor;
  }

  /**
   * @param plan Plan.
   * @param id Id de la actividad.
   * @returns La actividad (falla si no existe).
   */
  function actividad(plan: PlanAccion | null | undefined, id: string) {
    const encontrada = plan?.actividades.find((a) => a.id === id);

    if (encontrada === undefined) {
      throw new Error('No existe ' + id);
    }
    return encontrada;
  }

  /** @returns Todos los avisos enviados, en orden. */
  function avisosEnviados() {
    return avisos.calls.allArgs().flatMap(([lista]) => lista);
  }

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        { provide: RELOJ, useValue: () => new Date(HOY) },
        proveerPerfilFalso(new PerfilUsuarioFalso(['rrhh'], 'EMP-008', REVISOR))
      ]
    });
    servicio = TestBed.inject(PlanesMockService);
    avisos = spyOn(TestBed.inject(NotificacionesMockService), 'agregarNotificaciones').and.callThrough();
    spyOn(console, 'error');
  });

  it('aprobar: actividad y evidencia aprobadas, con revisor y fecha, y avisa al responsable', fakeAsync(() => {
    const plan = esperar(servicio.aprobarEvidencia('PL-002', 'A-005'));
    const a = actividad(plan, 'A-005');

    expect(a.estado).toBe('ACEPTADA');
    expect(a.evidencia).toEqual(jasmine.objectContaining({
      estado: 'APROBADA',
      revisadoPor: REVISOR,
      fechaRevision: HOY.toISOString()
    }));
    expect(plan?.estado).toBe('FIRMADO');
    expect(avisosEnviados()).toEqual([jasmine.objectContaining({
      titulo: 'Evidencia aprobada',
      tipo: 'ok',
      destinatarioId: 'EMP-001',
      texto: jasmine.stringContaining('(Conflicto #C-001 · Plan 02) fue aprobada.')
    })]);
  }));

  it('solo se aprueba o rechaza lo que está en revisión', fakeAsync(() => {
    expect(esperar(servicio.aprobarEvidencia('PL-002', 'A-004'))).toBeNull();
    expect(esperar(servicio.rechazarEvidencia('PL-002', 'A-003', 'Motivo'))).toBeNull();
    expect(esperar(servicio.aprobarEvidencia('PL-002', 'A-999'))).toBeNull();
    expect(avisos).not.toHaveBeenCalled();
  }));

  it('rechazar exige motivo; con motivo guarda el rechazo y avisa con el motivo', fakeAsync(() => {
    expect(esperar(servicio.rechazarEvidencia('PL-002', 'A-016', '   '))).toBeNull();
    expect(actividad(esperar(servicio.obtenerPlanPorId('PL-002')), 'A-016').estado).toBe('EN_REVISION');

    const plan = esperar(servicio.rechazarEvidencia('PL-002', 'A-016', '  El acta no está firmada.  '));
    const a = actividad(plan, 'A-016');

    expect(a.estado).toBe('RECHAZADA');
    expect(a.evidencia).toEqual(jasmine.objectContaining({
      estado: 'RECHAZADA',
      motivoRechazo: 'El acta no está firmada.',
      revisadoPor: REVISOR,
      fechaRevision: HOY.toISOString()
    }));
    expect(avisosEnviados()).toEqual([jasmine.objectContaining({
      titulo: 'Evidencia rechazada',
      destinatarioId: 'EMP-002',
      texto: jasmine.stringContaining('fue rechazada: El acta no está firmada.')
    })]);
  }));

  it('la revisión es definitiva: una evidencia ya revisada no se vuelve a revisar', fakeAsync(() => {
    esperar(servicio.rechazarEvidencia('PL-002', 'A-016', 'Falta firma.'));

    expect(esperar(servicio.aprobarEvidencia('PL-002', 'A-016'))).toBeNull();
    expect(servicio.ultimoError).toContain('no está en revisión');
    expect(actividad(esperar(servicio.obtenerPlanPorId('PL-002')), 'A-016').estado).toBe('RECHAZADA');
  }));

  it('aprobar la última cierra el plan (cumplido) con fecha de hoy y avisa a RRHH', fakeAsync(() => {
    const cerrado = esperar(servicio.aprobarEvidencia('PL-003', 'A-008'));

    expect(cerrado?.estado).toBe('CERRADO');
    expect(cerrado?.fechaCierre).toBe('2026-10-02');
    expect(avisosEnviados().map((n) => [n.titulo, n.destinatarioId])).toEqual([
      ['Evidencia aprobada', 'EMP-010'],
      ['Plan cerrado', undefined]
    ]);
    expect(esperar(servicio.obtenerPlanPorId('PL-003'))?.estado).toBe('CERRADO');
    expect(cerrado?.tipoCierre).toBe('CUMPLIDO');
  }));

  it('rechazar no cierra el plan aunque sea la última pendiente', fakeAsync(() => {
    const plan = esperar(servicio.rechazarEvidencia('PL-003', 'A-008', 'No se ve el usuario.'));

    expect(plan?.estado).toBe('FIRMADO');
    expect(plan?.fechaCierre).toBeUndefined();
  }));

  it('una acción que falla deja su motivo en ultimoError; la siguiente que sale bien lo limpia', fakeAsync(() => {
    expect(esperar(servicio.rechazarEvidencia('PL-002', 'A-005', '  '))).toBeNull();
    expect(servicio.ultimoError).toBe('El motivo del rechazo es obligatorio.');

    esperar(servicio.aprobarEvidencia('PL-002', 'A-005'));
    expect(servicio.ultimoError).toBeNull();
  }));

  describe('cerrarPlan (cierre anticipado)', () => {
    it('valida motivo, plan firmado y evidencias por revisar, como el backend', fakeAsync(() => {
      expect(esperar(servicio.cerrarPlan('PL-002', ' '))?.error).toBe(ERROR_MOTIVO_CIERRE);
      expect(esperar(servicio.cerrarPlan('PL-004', 'Motivo'))?.error).toBe(ERROR_CIERRE_NO_FIRMADO);
      expect(esperar(servicio.cerrarPlan('PL-002', 'Motivo'))?.error)
        .withContext('A-005 y A-016 están en revisión').toBe(ERROR_CIERRE_EN_REVISION);
    }));

    it('exige al menos una actividad vencida', fakeAsync(() => {
      esperar(servicio.rechazarEvidencia('PL-003', 'A-008', 'Ilegible.'));

      expect(esperar(servicio.cerrarPlan('PL-003', 'Motivo'))?.error).toBe(ERROR_CIERRE_SIN_VENCIDAS);
    }));

    it('cierra: no aceptadas a NO_CUMPLIDA, plan CERRADO ANTICIPADO con motivo y fecha de hoy', fakeAsync(() => {
      esperar(servicio.aprobarEvidencia('PL-002', 'A-005'));
      esperar(servicio.rechazarEvidencia('PL-002', 'A-016', 'Incompleta.'));

      const resultado = esperar(servicio.cerrarPlan('PL-002', '  No se cumplió a tiempo. '));
      const plan = resultado?.plan ?? null;

      expect(resultado?.error).toBeNull();
      expect(plan?.estado).toBe('CERRADO');
      expect(plan?.tipoCierre).toBe('ANTICIPADO');
      expect(plan?.motivoCierre).toBe('No se cumplió a tiempo.');
      expect(plan?.fechaCierre).toBe('2026-10-02');
      expect(actividad(plan, 'A-004').estado).toBe('ACEPTADA');
      expect(actividad(plan, 'A-005').estado).toBe('ACEPTADA');
      expect(['A-003', 'A-015', 'A-016', 'A-017', 'A-018'].map((id) => actividad(plan, id).estado))
        .toEqual(['NO_CUMPLIDA', 'NO_CUMPLIDA', 'NO_CUMPLIDA', 'NO_CUMPLIDA', 'NO_CUMPLIDA']);
      expect(esperar(servicio.obtenerPlanPorId('PL-002'))?.estado).toBe('CERRADO');
      expect(esperar(servicio.cerrarPlan('PL-002', 'Otra vez'))?.error).toBe(ERROR_CIERRE_NO_FIRMADO);
    }));
  });

  it('descargas: texto de relleno para los archivos de ejemplo y null si no hay archivo', fakeAsync(() => {
    const documento = esperar(servicio.obtenerDocumentoPlan('PL-001'));

    expect(documento).toEqual(jasmine.any(Blob));
    expect(esperar(servicio.obtenerDocumentoPlan('PL-004'))).toBeNull();
    expect(esperar(servicio.obtenerArchivoEvidencia('NO-EXISTE'))).toBeNull();
  }));
});
