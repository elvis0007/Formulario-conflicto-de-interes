import { PlanAccion } from '../../../models';
import { ActividadBandejaApi } from '../../../models/api';
import { actividadApi, evidenciaApi, planApi } from '../../../testing/api-ejemplos';
import {
  crearPedidoPlan,
  mapearActividad,
  mapearArchivo,
  mapearEvidencia,
  mapearPlan,
  mapearPlanesDeResponsable
} from './plan.mapeo';

describe('plan.mapeo', () => {
  describe('mapearArchivo', () => {
    it('toma nombre y tipo del MIME; la URL es la ruta de descarga', () => {
      expect(mapearArchivo({ CODIGO: 1, NOMBRE: 'foto.png', TIPO_MIME: 'image/png', TAMANIO: 5 }, '/x', '2026-10-01'))
        .toEqual({ nombre: 'foto.png', url: '/x', tipo: 'png', fechaSubida: '2026-10-01' });
      expect(mapearArchivo({ CODIGO: 1, NOMBRE: 'f.jpg', TIPO_MIME: 'image/jpeg', TAMANIO: 5 }, '/x').tipo).toBe('jpg');
    });

    it('con nulls: nombre «archivo», tipo por extensión o pdf, sin fecha', () => {
      expect(mapearArchivo(null, '/x')).toEqual({ nombre: 'archivo', url: '/x', tipo: 'pdf' });
      expect(mapearArchivo({ CODIGO: null, NOMBRE: 'a.JPEG', TIPO_MIME: null, TAMANIO: null }, '/x', null).tipo)
        .toBe('jpg');
    });
  });

  describe('mapearEvidencia', () => {
    it('pendiente: id a string, archivo con su ruta y sin datos de revisión', () => {
      expect(mapearEvidencia(evidenciaApi())).toEqual({
        id: '7',
        archivo: {
          nombre: 'acta.pdf',
          url: '/evidencias/7/archivo',
          tipo: 'pdf',
          fechaSubida: '2026-10-10T09:30:00.123456'
        },
        fechaSubida: '2026-10-10T09:30:00.123456',
        estado: 'PENDIENTE'
      });
    });

    it('rechazada: motivo, revisor y fecha de revisión', () => {
      const evidencia = mapearEvidencia(evidenciaApi({
        ESTADO_REVISION: 'RECHAZADA',
        MOTIVO_RECHAZO: 'Ilegible',
        REVISADO_POR: 'rrhh1',
        FECHA_REVISION: '2026-10-11T10:00:00'
      }));

      expect(evidencia.motivoRechazo).toBe('Ilegible');
      expect(evidencia.revisadoPor).toBe('rrhh1');
      expect(evidencia.fechaRevision).toBe('2026-10-11T10:00:00');
    });

    it('con nulls: id y fecha vacíos, estado PENDIENTE', () => {
      const evidencia = mapearEvidencia(evidenciaApi({ CODIGO: null, ESTADO_REVISION: null, FECHA_SUBIDA: null, ARCHIVO: null }));

      expect(evidencia.id).toBe('');
      expect(evidencia.fechaSubida).toBe('');
      expect(evidencia.estado).toBe('PENDIENTE');
      expect(evidencia.archivo.nombre).toBe('archivo');
    });
  });

  describe('mapearActividad', () => {
    it('la última evidencia es la vigente; las anteriores van aparte', () => {
      const actividad = mapearActividad(actividadApi({
        EVIDENCIAS: [
          evidenciaApi({ CODIGO: 5, ESTADO_REVISION: 'RECHAZADA' }),
          evidenciaApi({ CODIGO: 7 })
        ]
      }));

      expect(actividad).toEqual(jasmine.objectContaining({
        id: '3',
        descripcion: 'Separar funciones',
        responsableId: 'DMPER10',
        responsableNombre: 'Ana Pérez',
        plazoMeses: 1,
        plazoDias: 5,
        fechaLimite: '2026-11-06',
        estado: 'EN_REVISION'
      }));
      expect(actividad.evidencia?.id).toBe('7');
      expect(actividad.evidenciasAnteriores?.map((e) => e.id)).toEqual(['5']);
    });

    it('con nulls (borrador): sin fecha límite ni evidencias, valores por defecto', () => {
      const actividad = mapearActividad(actividadApi({
        CODIGO: null,
        DESCRIPCION: null,
        RESPONSABLE: null,
        NOMBRE_RESPONSABLE: null,
        PLAZO_MESES: null,
        PLAZO_DIAS: null,
        FECHA_LIMITE: null,
        ESTADO: null,
        EVIDENCIAS: null
      }));

      expect(actividad).toEqual({
        id: '',
        descripcion: '',
        responsableId: '',
        responsableNombre: '',
        plazoMeses: 0,
        plazoDias: 0,
        estado: 'PENDIENTE'
      });
    });
  });

  describe('mapearPlan', () => {
    it('firmado: objetivo como nombre, inicio = asignación, documento con su ruta', () => {
      const plan = mapearPlan(planApi());

      expect(plan).toEqual(jasmine.objectContaining({
        id: '41',
        numero: 1,
        nombre: 'Mitigar el conflicto',
        conflictoId: '1420',
        estado: 'FIRMADO',
        fechaInicio: '2026-10-01',
        documentoFirmado: { nombre: 'FR02.pdf', url: '/planes/41/documento', tipo: 'pdf', fechaSubida: '2026-09-29' }
      }));
      expect(plan.actividades.length).toBe(1);
      expect('fechaCierre' in plan).toBeFalse();
    });

    it('cerrado anticipado: fecha, tipo y motivo de cierre', () => {
      const plan = mapearPlan(planApi({
        ESTADO_PLAN: 'CERRADO',
        FECHA_CIERRE: '2026-10-20',
        TIPO_CIERRE: 'ANTICIPADO',
        MOTIVO_CIERRE: 'Vencido'
      }));

      expect(plan.fechaCierre).toBe('2026-10-20');
      expect(plan.tipoCierre).toBe('ANTICIPADO');
      expect(plan.motivoCierre).toBe('Vencido');
    });

    it('borrador con nulls: sin inicio, sin documento, sin actividades', () => {
      const plan = mapearPlan(planApi({
        CODIGO: null,
        CONFLICTO_ID: null,
        NUMERO: null,
        ESTADO_PLAN: null,
        OBJETIVO: null,
        FECHA_FIRMA: null,
        DOCUMENTO_FIRMADO: null,
        ACTIVIDADES: null
      }));

      expect(plan).toEqual({ id: '', numero: 0, nombre: '', conflictoId: '', estado: 'BORRADOR', actividades: [] });
    });

    it('sin fecha de asignación usa la fecha de firma como inicio', () => {
      expect(mapearPlan(planApi({ ACTIVIDADES: [actividadApi({ FECHA_ASIGNACION: null })] })).fechaInicio)
        .toBe('2026-09-29');
    });
  });

  describe('mapearPlanesDeResponsable', () => {
    /**
     * @param cambios Campos a cambiar.
     * @returns Fila de bandeja de ejemplo.
     */
    function fila(cambios: Partial<ActividadBandejaApi> = {}): ActividadBandejaApi {
      return {
        CODIGO: 3,
        CONFLICTO_ID: 1420,
        NOMBRE_A: 'A',
        NOMBRE_B: 'B',
        PARENTESCO: 'PADRE',
        RIESGO: 'ALTO',
        PLAN_ID: 41,
        PLAN_NUMERO: 1,
        PLAN_ESTADO: 'FIRMADO',
        PLAN_OBJETIVO: 'Mitigar',
        PLAN_TOTAL_ACTIVIDADES: 4,
        DESCRIPCION: 'Hacer algo',
        FECHA_ASIGNACION: '2026-10-01',
        PLAZO_MESES: 0,
        PLAZO_DIAS: 10,
        FECHA_LIMITE: '2026-10-11',
        ESTADO: 'PENDIENTE',
        VENCIDA: false,
        ULTIMA_EVIDENCIA: null,
        ...cambios
      };
    }

    it('agrupa por plan, con el total del plan y el empleado como responsable', () => {
      const vistas = mapearPlanesDeResponsable([
        fila(),
        fila({ CODIGO: 4, ULTIMA_EVIDENCIA: evidenciaApi({ CODIGO: 9 }) }),
        fila({ CODIGO: 8, CONFLICTO_ID: 1408, PLAN_ID: 42, PLAN_NUMERO: 2, PLAN_ESTADO: 'CERRADO', ESTADO: 'ACEPTADA' })
      ], 'DMPER10');

      expect(vistas.map((v) => v.plan.id)).withContext('ordenados por conflicto').toEqual(['42', '41']);
      expect(vistas[1].totalActividades).toBe(4);
      expect(vistas[1].plan).toEqual(jasmine.objectContaining({
        numero: 1,
        nombre: 'Mitigar',
        conflictoId: '1420',
        estado: 'FIRMADO',
        fechaInicio: '2026-10-01'
      }));
      expect(vistas[1].plan.actividades.map((a) => [a.id, a.responsableId])).toEqual([['3', 'DMPER10'], ['4', 'DMPER10']]);
      expect(vistas[1].plan.actividades[1].evidencia?.id).toBe('9');
      expect(vistas[0].plan.estado).toBe('CERRADO');
    });

    it('con nulls: descarta filas sin plan y usa valores por defecto', () => {
      const vistas = mapearPlanesDeResponsable([
        fila({ PLAN_ID: null }),
        fila({ PLAN_NUMERO: null, PLAN_ESTADO: null, PLAN_OBJETIVO: null, FECHA_ASIGNACION: null, ESTADO: null })
      ], '');

      expect(vistas.length).toBe(1);
      expect(vistas[0].plan).toEqual(jasmine.objectContaining({ numero: 0, nombre: '', estado: 'FIRMADO' }));
      expect('fechaInicio' in vistas[0].plan).toBeFalse();
      expect(vistas[0].plan.actividades[0].estado).toBe('PENDIENTE');
    });

    it('lleva los datos del caso que trae la bandeja (nombres, parentesco, riesgo)', () => {
      const [vista] = mapearPlanesDeResponsable([fila({ NOMBRE_A: 'Ana Pérez', NOMBRE_B: 'Luis Pérez' })], 'X');
      const [hermanos] = mapearPlanesDeResponsable([fila({ PARENTESCO: 'HERMANO' })], 'X');
      const [sinCaso] = mapearPlanesDeResponsable(
        [fila({ NOMBRE_A: null, NOMBRE_B: null, PARENTESCO: null, RIESGO: null })], 'X');

      expect(vista).toEqual(jasmine.objectContaining({
        nombreA: 'Ana Pérez',
        nombreB: 'Luis Pérez',
        parentesco: 'Padre de Ana Pérez',
        riesgo: 'ALTO'
      }));
      expect(hermanos.parentesco).toBe('Hermanos');
      expect(sinCaso).toEqual(jasmine.objectContaining({ nombreA: '', nombreB: '', parentesco: '', riesgo: null }));
    });

    it('bandeja vacía: lista vacía', () => {
      expect(mapearPlanesDeResponsable([], 'X')).toEqual([]);
    });
  });

  describe('crearPedidoPlan', () => {
    const plan: PlanAccion = {
      id: '41',
      numero: 1,
      nombre: '  Nuevo objetivo ',
      conflictoId: '1420',
      estado: 'BORRADOR',
      actividades: [
        { id: 'x', descripcion: ' Tarea ', responsableId: ' DMPER10 ', responsableNombre: '', plazoMeses: 0,
          plazoDias: 15, estado: 'PENDIENTE' }
      ]
    };

    it('actividades con orden y plazo; conserva involucrados y fecha de reunión del backend', () => {
      expect(crearPedidoPlan(plan, planApi({ ESTADO_PLAN: 'BORRADOR' }))).toEqual({
        objetivo: 'Nuevo objetivo',
        fechaReunion: '2026-09-28',
        actividades: [{ descripcion: 'Tarea', responsable: 'DMPER10', plazoMeses: 0, plazoDias: 15, orden: 1 }],
        involucrados: [{ dmper: 'DMPER20', tipo: 'F' }]
      });
    });

    it('plan nuevo (sin anterior) y nombre vacío: objetivo null, sin involucrados', () => {
      expect(crearPedidoPlan({ ...plan, nombre: ' ', actividades: [] })).toEqual({
        objetivo: null,
        fechaReunion: null,
        actividades: [],
        involucrados: []
      });
    });

    it('omite involucrados incompletos', () => {
      const anterior = planApi({ INVOLUCRADOS: [{ DMPER_CODIGO: null, NOMBRE: null, TIPO: 'D' }], FECHA_REUNION: null });

      expect(crearPedidoPlan(plan, anterior).involucrados).toEqual([]);
    });
  });
});
