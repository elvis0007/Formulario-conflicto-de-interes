import { TestBed, fakeAsync, tick } from '@angular/core/testing';
import { Observable } from 'rxjs';
import { PlanAccion } from '../models';
import { LATENCIA_SIMULADA_MS } from './mock-data/simular-respuesta';
import { NotificacionesMockService } from './notificaciones-mock.service';
import { PlanesMockService, ResultadoDocumento } from './planes-mock.service';
import { ERROR_DOCUMENTO_GRANDE, ERROR_DOCUMENTO_NO_PDF } from '../utils/documento.util';
import { RELOJ } from '../utils/reloj';

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
      estado: 'borrador',
      actividades: [{
        id: '',
        descripcion: 'Actividad de prueba',
        responsableId: 'EMP-001',
        responsableNombre: 'Carlos Andrés Mayorga Sánchez',
        plazoMeses: 0,
        plazoDias: 15,
        estado: 'pendiente'
      }]
    };
  }

  beforeEach(() => {
    TestBed.configureTestingModule({});
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
    expect(esperar(servicio.guardarBorrador({ ...activo, estado: 'borrador', nombre: 'Cambio' })))
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
    TestBed.configureTestingModule({
      providers: [{ provide: RELOJ, useValue: () => new Date(HOY) }]
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

  it('rechaza lo que no es PDF y lo que supera 10 MB', fakeAsync(() => {
    const noPdf = esperar(servicio.subirDocumentoFirmado('PL-004', archivo('foto.png', 'image/png')));
    const grande = esperar(servicio.subirDocumentoFirmado(
      'PL-004', archivo('grande.pdf', 'application/pdf', 10 * 1024 * 1024 + 1)));

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
      expect(esperar(servicio.obtenerPlanPorId('PL-004'))?.estado).toBe('borrador');
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

      expect(activo?.estado).toBe('activo');
      expect(activo?.fechaInicio).toBe('2026-10-02');
      expect(activo?.actividades.map((a) => [a.plazoMeses, a.plazoDias, a.fechaLimite, a.estado])).toEqual([
        [1, 0, '2026-11-02', 'pendiente'],
        [3, 0, '2027-01-02', 'pendiente']
      ]);
      expect(esperar(servicio.obtenerPlanPorId('PL-004'))?.estado).toBe('activo');
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

      const nuevas = (esperar(notificaciones.obtenerNotificaciones()) ?? [])
        .filter((n) => n.titulo === 'Nuevo plan de acción asignado');
      expect(nuevas.map((n) => [n.destinatarioId, n.texto, n.leida])).toEqual(jasmine.arrayWithExactContents([
        ['EMP-006', 'Conflicto #C-003 · Plan 01 · Control cruzado de pagos. 2 actividades a tu cargo.', false],
        ['EMP-003', 'Conflicto #C-003 · Plan 01 · Control cruzado de pagos. 1 actividad a tu cargo.', false]
      ]));
      expect(cambios).toBe(1);
    }));
  });
});
