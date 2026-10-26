import { ConflictoDetalleApi } from '../../../models/api';
import { mapearConflicto, mapearConflictoDetalle } from './conflicto.mapeo';
import { conflictoApi, planApi } from '../../../testing/api-ejemplos';

describe('conflicto.mapeo', () => {
  describe('mapearConflicto', () => {
    it('fila de listado: ids a string, roles según el sentido del parentesco', () => {
      expect(mapearConflicto(conflictoApi())).toEqual({
        id: '1420',
        personaA: { id: '1800000001', nombres: 'Ana Pérez', cedula: '1800000001', cargo: '', departamento: 'Compras' },
        rolA: 'Hijo',
        personaB: { id: '1800000002', nombres: 'Juan Pérez', cedula: '1800000002', cargo: '', departamento: 'Finanzas' },
        rolB: 'Padre',
        relacion: 'Consanguinidad',
        grado: 1,
        riesgo: 'ALTO',
        clasificacion: 'N',
        estado: 'EN_EJECUCION',
        observacionClasificacion: 'Confirmado por RRHH',
        motivoRiesgo: '',
        evidenciasDeteccion: ['Mismo nombre de padre en la ficha.'],
        fechaDeteccion: '2026-10-01T08:00:00',
        planes: []
      });
    });

    it('vínculo simétrico: etiqueta en plural', () => {
      const conflicto = mapearConflicto(conflictoApi({ PARENTESCO: 'HERMANO', PARENTESCO_INVERSO: 'HERMANO', GRADO: 2 }));

      expect(conflicto.etiquetaSimetrica).toBe('Hermanos');
      expect(conflicto.grado).toBe(2);
    });

    it('cónyuges: afinidad y sin grado aunque el backend mande 1', () => {
      const conflicto = mapearConflicto(conflictoApi({
        PARENTESCO: 'CONYUGE', PARENTESCO_INVERSO: 'CONYUGE', TIPO_GRADO: 'A', GRADO: 1
      }));

      expect(conflicto.relacion).toBe('Afinidad');
      expect(conflicto.grado).toBeNull();
      expect(conflicto.etiquetaSimetrica).toBe('Cónyuges');
    });

    it('con nulls: valores por defecto y sin opcionales', () => {
      const conflicto = mapearConflicto(conflictoApi({
        CODIGO: null,
        CEDULA_A: null,
        NOMBRE_A: null,
        DEPARTAMENTO_A: null,
        PARENTESCO: null,
        PARENTESCO_INVERSO: null,
        TIPO_GRADO: null,
        GRADO: null,
        RIESGO: null,
        CLASIFICACION: null,
        DETALLE: null,
        OBSERVACION: null,
        ESTADO_SEGUIMIENTO: null,
        FECHA_DETECCION: null
      }), null);

      expect(conflicto).toEqual(jasmine.objectContaining({
        id: '',
        rolA: '',
        rolB: '',
        relacion: 'Afinidad',
        grado: null,
        riesgo: 'BAJO',
        clasificacion: null,
        estado: 'DETECTADO',
        evidenciasDeteccion: [],
        fechaDeteccion: '',
        planes: []
      }));
      expect(conflicto.personaA).toEqual({ id: '', nombres: '', cedula: '', cargo: '', departamento: '' });
      expect('etiquetaSimetrica' in conflicto).toBeFalse();
      expect('observacionClasificacion' in conflicto).toBeFalse();
    });

    it('ordena y convierte los planes del expediente', () => {
      const conflicto = mapearConflicto(conflictoApi(), [planApi({ CODIGO: 42, NUMERO: 2 }), planApi({ NUMERO: 1 })]);

      expect(conflicto.planes.map((p) => [p.id, p.numero])).toEqual([['41', 1], ['42', 2]]);
    });
  });

  describe('mapearConflictoDetalle', () => {
    /**
     * @param cambios Campos a cambiar.
     * @returns Detalle del backend de ejemplo.
     */
    function detalle(cambios: Partial<ConflictoDetalleApi> = {}): ConflictoDetalleApi {
      return {
        CONFLICTO: conflictoApi(),
        LINEA_DE_TIEMPO: [],
        PLAN: planApi({ CODIGO: 42, NUMERO: 2 }),
        PLANES: [planApi(), planApi({ CODIGO: 42, NUMERO: 2 })],
        DIRECTOR_A: { DMPER_CODIGO: 'D1', NOMBRE: 'Director A', CARGO: 'Director', DEPARTAMENTO: 'Compras' },
        DIRECTOR_B: null,
        FICHA_A: {
          CARGO: 'Analista',
          FECHA_INGRESO: '2015-03-01',
          NOMBRE_PADRE: 'Juan Pérez',
          NOMBRE_MADRE: 'Rosa López',
          NOMBRE_CONYUGE: null
        },
        FICHA_B: null,
        JEFE_INMEDIATO_A: { DMPER_CODIGO: 'J1', NOMBRE: 'Jefe A', CARGO: 'Jefe', DEPARTAMENTO: 'Sección' },
        JEFE_INMEDIATO_B: null,
        ...cambios
      };
    }

    it('personas con ficha y jefe inmediato; todos los planes', () => {
      const conflicto = mapearConflictoDetalle(detalle());

      expect(conflicto.personaA).toEqual({
        id: '1800000001',
        nombres: 'Ana Pérez',
        cedula: '1800000001',
        cargo: 'Analista',
        departamento: 'Compras',
        jefeInmediato: 'Jefe A',
        fechaIngreso: '2015-03-01',
        padre: 'Juan Pérez',
        madre: 'Rosa López'
      });
      expect(conflicto.personaB)
        .withContext('B fuera de nómina: sin ficha ni jefe')
        .toEqual({ id: '1800000002', nombres: 'Juan Pérez', cedula: '1800000002', cargo: '', departamento: 'Finanzas' });
      expect(conflicto.planes.map((p) => p.id)).toEqual(['41', '42']);
    });

    it('sin PLANES usa PLAN; sin ninguno, ningún plan', () => {
      expect(mapearConflictoDetalle(detalle({ PLANES: null })).planes.map((p) => p.id)).toEqual(['42']);
      expect(mapearConflictoDetalle(detalle({ PLANES: null, PLAN: null })).planes).toEqual([]);
    });
  });
});
