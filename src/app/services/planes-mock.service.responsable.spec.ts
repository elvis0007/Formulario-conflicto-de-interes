import { TestBed, fakeAsync, tick } from '@angular/core/testing';
import { Observable } from 'rxjs';
import { PlanDeResponsable } from '../models';
import { PerfilUsuarioFalso, proveerPerfilFalso } from '../testing/perfil-usuario-falso';
import {
  ERROR_DOCUMENTO_VACIO,
  ERROR_EVIDENCIA_GRANDE,
  ERROR_EVIDENCIA_TIPO
} from '../utils/documento.util';
import { RELOJ } from '../utils/reloj';
import { LATENCIA_SIMULADA_MS } from './mock-data/simular-respuesta';
import { NotificacionesMockService } from './notificaciones-mock.service';
import {
  ERROR_ACTIVIDAD_AJENA,
  ERROR_ACTIVIDAD_SIN_SUBIDA,
  ERROR_PLAN_NO_ACTIVO,
  PlanesMockService,
  ResultadoEvidencia
} from './planes-mock.service';

describe('PlanesMockService: Responsable', () => {
  /** «Hoy» fijo: 2 de octubre de 2026, 10:00. */
  const HOY = new Date(2026, 9, 2, 10, 0);
  let servicio: PlanesMockService;
  let perfil: PerfilUsuarioFalso;
  let avisos: jasmine.Spy;
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
  function archivo(nombre: string, tipo = 'image/png', bytes = 100): File {
    return new File([new Uint8Array(bytes)], nombre, { type: tipo });
  }

  /**
   * @param planId Plan.
   * @param actividadId Actividad.
   * @param elegido Archivo.
   * @returns Resultado de la subida.
   */
  function subir(planId: string, actividadId: string, elegido = archivo('evidencia.png')): ResultadoEvidencia {
    return esperar(servicio.subirEvidencia(planId, actividadId, elegido)) as ResultadoEvidencia;
  }

  /**
   * @param datos Plan del responsable.
   * @param id Actividad.
   * @returns La actividad (falla si no esta).
   */
  function actividad(datos: PlanDeResponsable | null | undefined, id: string) {
    const encontrada = datos?.plan.actividades.find((a) => a.id === id);

    if (encontrada === undefined) {
      throw new Error('No existe ' + id);
    }
    return encontrada;
  }

  beforeEach(() => {
    urls = 0;
    perfil = new PerfilUsuarioFalso(['responsable'], 'EMP-010', 'Fernando José Andrade Vela');
    TestBed.configureTestingModule({
      providers: [{ provide: RELOJ, useValue: () => new Date(HOY) }, proveerPerfilFalso(perfil)]
    });
    servicio = TestBed.inject(PlanesMockService);
    avisos = spyOn(TestBed.inject(NotificacionesMockService), 'agregarNotificaciones').and.callThrough();
    spyOn(URL, 'createObjectURL').and.callFake(() => 'blob:evidencia-' + (++urls));
    spyOn(URL, 'revokeObjectURL');
    spyOn(console, 'error');
  });

  describe('consultas', () => {
    it('planes del responsable: con alguna actividad suya, sin borradores, solo sus actividades', fakeAsync(() => {
      const planes = esperar(servicio.obtenerPlanesDeResponsable('EMP-010')) ?? [];

      expect(planes.map((p) => p.plan.id)).toEqual(['PL-002', 'PL-003', 'PL-006']);
      expect(planes.every((p) => p.plan.actividades.every((a) => a.responsableId === 'EMP-010'))).toBeTrue();
      expect(planes.map((p) => [p.plan.actividades.length, p.totalActividades])).toEqual([[4, 7], [2, 3], [1, 2]]);
      expect(esperar(servicio.obtenerPlanesDeResponsable('EMP-999'))).toEqual([]);
    }));

    it('el estado del plan sigue calculado con todas sus actividades', fakeAsync(() => {
      const planes = esperar(servicio.obtenerPlanesDeResponsable('EMP-002')) ?? [];

      expect(planes.map((p) => [p.plan.id, p.plan.estado, p.plan.actividades.length])).toEqual([
        ['PL-002', 'activo_vencidas', 1]
      ]);
    }));

    it('un plan ajeno, en borrador o inexistente no se puede abrir', fakeAsync(() => {
      expect(esperar(servicio.obtenerPlanDeResponsable('PL-002', 'EMP-010'))?.plan.actividades.length).toBe(4);
      expect(esperar(servicio.obtenerPlanDeResponsable('PL-001', 'EMP-010'))).toBeNull();
      expect(esperar(servicio.obtenerPlanDeResponsable('PL-007', 'EMP-010'))).toBeNull();
      expect(esperar(servicio.obtenerPlanDeResponsable('PL-999', 'EMP-010'))).toBeNull();
    }));
  });

  describe('subirEvidencia', () => {
    it('pendiente → en revisión, con fecha de subida y URL local; avisa a RRHH', fakeAsync(() => {
      const resultado = subir('PL-002', 'A-017', archivo('capacitacion.pdf', 'application/pdf'));
      const a = actividad(resultado.plan, 'A-017');

      expect(resultado.error).toBeNull();
      expect(a.estado).toBe('en_revision');
      expect(a.evidencia).toEqual({
        archivo: { nombre: 'capacitacion.pdf', url: 'blob:evidencia-1', tipo: 'pdf', fechaSubida: HOY.toISOString() },
        fechaSubida: HOY.toISOString(),
        estado: 'pendiente'
      });
      expect(resultado.plan?.plan.actividades.every((x) => x.responsableId === 'EMP-010')).toBeTrue();
      const enviados = avisos.calls.allArgs().flatMap(([lista]) => lista);
      expect(enviados).toEqual([jasmine.objectContaining({
        titulo: 'Nueva evidencia por revisar',
        tipo: 'info',
        texto: jasmine.stringContaining('Conflicto #C-001 · Plan 02 · «Capacitar al personal')
      })]);
      expect(enviados[0].destinatarioId).withContext('para RRHH: sin destinatario').toBeUndefined();
    }));

    it('vencida → en revisión (JPG)', fakeAsync(() => {
      const a = actividad(subir('PL-002', 'A-018', archivo('inventario.jpg', 'image/jpeg')).plan, 'A-018');

      expect(a.estado).toBe('en_revision');
      expect(a.evidencia?.archivo.tipo).toBe('jpg');
    }));

    it('si el plan ya no tiene vencidas, deja de estar «con vencidas»', fakeAsync(() => {
      perfil.empleadoId = 'EMP-001';
      // A-003 es la unica vencida de PL-002 (de EMP-001); A-018 es de EMP-010.
      subir('PL-002', 'A-003');
      perfil.empleadoId = 'EMP-010';
      expect(subir('PL-002', 'A-018').plan?.plan.estado).toBe('activo');
    }));

    it('rechazada: reemplaza la evidencia (una sola por actividad) y borra el motivo', fakeAsync(() => {
      const antes = actividad(esperar(servicio.obtenerPlanDeResponsable('PL-002', 'EMP-010')), 'A-015');
      expect(antes.evidencia?.motivoRechazo).toBeDefined();

      const primera = actividad(subir('PL-002', 'A-015', archivo('auditoria-v2.png')).plan, 'A-015');
      expect(primera.estado).toBe('en_revision');
      expect(primera.evidencia?.archivo.nombre).toBe('auditoria-v2.png');
      expect(primera.evidencia?.motivoRechazo).toBeUndefined();
      expect(primera.evidencia?.revisadoPor).toBeUndefined();
    }));

    it('al reemplazar una evidencia local libera su URL', fakeAsync(() => {
      subir('PL-002', 'A-015', archivo('v1.png'));
      perfil.roles = ['rrhh'];
      esperar(servicio.rechazarEvidencia('PL-002', 'A-015', 'Sigue sin fecha.'));
      perfil.roles = ['responsable'];

      const otra = actividad(subir('PL-002', 'A-015', archivo('v2.png')).plan, 'A-015');
      expect(otra.evidencia?.archivo.url).toBe('blob:evidencia-2');
      expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:evidencia-1');
    }));

    it('en revisión o aprobada no admite otra evidencia', fakeAsync(() => {
      expect(subir('PL-003', 'A-008')).toEqual({ plan: null, error: ERROR_ACTIVIDAD_SIN_SUBIDA });
      expect(subir('PL-002', 'A-004')).toEqual({ plan: null, error: ERROR_ACTIVIDAD_SIN_SUBIDA });
      expect(avisos).not.toHaveBeenCalled();
    }));

    it('solo el responsable de la actividad puede subir', fakeAsync(() => {
      expect(subir('PL-002', 'A-005')).toEqual({ plan: null, error: ERROR_ACTIVIDAD_AJENA });
      expect(subir('PL-999', 'A-017')).toEqual({ plan: null, error: ERROR_ACTIVIDAD_AJENA });
      perfil.empleadoId = null;
      expect(subir('PL-002', 'A-017')).toEqual({ plan: null, error: ERROR_ACTIVIDAD_AJENA });
    }));

    it('solo con el plan activo (no en borrador ni cerrado)', fakeAsync(() => {
      expect(subir('PL-007', 'A-014')).toEqual({ plan: null, error: ERROR_PLAN_NO_ACTIVO });
      expect(subir('PL-006', 'A-013')).toEqual({ plan: null, error: ERROR_PLAN_NO_ACTIVO });
    }));

    it('valida el archivo: tipo, tamaño y vacío', fakeAsync(() => {
      expect(subir('PL-002', 'A-017', archivo('notas.txt', 'text/plain')).error).toBe(ERROR_EVIDENCIA_TIPO);
      expect(subir('PL-002', 'A-017', archivo('grande.png', 'image/png', 10 * 1024 * 1024 + 1)).error)
        .toBe(ERROR_EVIDENCIA_GRANDE);
      expect(subir('PL-002', 'A-017', archivo('vacio.png', 'image/png', 0)).error).toBe(ERROR_DOCUMENTO_VACIO);
      expect(actividad(esperar(servicio.obtenerPlanDeResponsable('PL-002', 'EMP-010')), 'A-017').estado)
        .toBe('pendiente');
      expect(URL.createObjectURL).not.toHaveBeenCalled();
    }));
  });
});
