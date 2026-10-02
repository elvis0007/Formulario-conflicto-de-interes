import { Conflicto } from '../../models';
import { buscarPersona } from './personas.data';
import { PLANES } from './planes.data';

/** Conflicto de ejemplo antes de enlazarle sus planes. */
type ConflictoSinPlanes = Omit<Conflicto, 'planes'>;

/**
 * Conflictos de ejemplo, sin planes. Cubren:
 *
 * | Id    | Vinculo        | Relacion       | Grado | Riesgo  | Clasif.    | Planes |
 * |-------|----------------|----------------|-------|---------|------------|--------|
 * | C-001 | Hermanos       | Consanguinidad | 2     | alto    | confirmado | 2      |
 * | C-002 | Tío/Sobrino    | Consanguinidad | 3     | medio   | confirmado | 1      |
 * | C-003 | Suegro/Yerno   | Afinidad       | 1     | alto    | confirmado | 1      |
 * | C-004 | Primas         | Consanguinidad | 4     | bajo    | confirmado | 1      |
 * | C-005 | Cuñados        | Afinidad       | 2     | medio   | pendiente  | 0      |
 * | C-006 | Hermanos       | Consanguinidad | 2     | ninguno | homonimo   | 0      |
 * | C-007 | Padre/Hija     | Consanguinidad | 1     | bajo    | pendiente  | 0      |
 * | C-008 | Suegro/Nuera   | Afinidad       | 1     | medio   | confirmado | 2      |
 * | C-009 | Cónyuges       | Afinidad       | —     | bajo    | pendiente  | 0      |
 *
 * Vinculos simetricos (una sola etiqueta): Hermanos, Primas, Cuñados y
 * Cónyuges. Con roles distintos: Tío/Sobrino, Suegro/Yerno, Padre/Hija y
 * Suegro/Nuera.
 *
 * Entre conyuges no hay grado de parentesco: C-009 lleva `grado: null`
 * («No aplica»). PENDIENTE confirmar con backend como lo devuelve el
 * algoritmo.
 */
const CONFLICTOS_SIN_PLANES: readonly ConflictoSinPlanes[] = [
  {
    id: 'C-001',
    personaA: buscarPersona('EMP-001'),
    rolA: 'Hermano',
    personaB: buscarPersona('EMP-002'),
    rolB: 'Hermano',
    etiquetaSimetrica: 'Hermanos',
    relacion: 'Consanguinidad',
    grado: 2,
    riesgo: 'alto',
    clasificacion: 'confirmado',
    motivoRiesgo: 'Relación jerárquica directa: el técnico depende del '
      + 'jefe de Adquisiciones y participa en procesos que él aprueba.',
    evidenciasDeteccion: [
      'Mismos nombres de padre y madre en la ficha de personal.',
      'Declarado en el formulario de conflicto de interés de EMP-001.'
    ],
    fechaDeteccion: '2025-10-14'
  },
  {
    id: 'C-002',
    personaA: buscarPersona('EMP-004'),
    rolA: 'Tío',
    personaB: buscarPersona('EMP-005'),
    rolB: 'Sobrino',
    relacion: 'Consanguinidad',
    grado: 3,
    riesgo: 'medio',
    clasificacion: 'confirmado',
    motivoRiesgo: 'Mismo departamento; el superintendente aprueba las '
      + 'horas extra de la cuadrilla del liniero.',
    evidenciasDeteccion: [
      'El padre de EMP-005 es hermano de EMP-004.',
      'Declarado en el formulario de EMP-005.'
    ],
    fechaDeteccion: '2026-07-30'
  },
  {
    id: 'C-003',
    personaA: buscarPersona('EMP-006'),
    rolA: 'Suegro',
    personaB: buscarPersona('EMP-007'),
    rolB: 'Yerno',
    relacion: 'Afinidad',
    grado: 1,
    riesgo: 'alto',
    clasificacion: 'confirmado',
    motivoRiesgo: 'El director financiero es jefe inmediato del contador '
      + 'general, que registra los pagos que él aprueba.',
    evidenciasDeteccion: [
      'El cónyuge de EMP-007 es hija de EMP-006.'
    ],
    fechaDeteccion: '2026-09-10'
  },
  {
    id: 'C-004',
    personaA: buscarPersona('EMP-008'),
    rolA: 'Prima',
    personaB: buscarPersona('EMP-009'),
    rolB: 'Prima',
    etiquetaSimetrica: 'Primas',
    relacion: 'Consanguinidad',
    grado: 4,
    riesgo: 'bajo',
    clasificacion: 'confirmado',
    motivoRiesgo: 'Departamentos distintos, pero la analista de Talento '
      + 'Humano participa en la selección de personal de '
      + 'Comercialización.',
    evidenciasDeteccion: [
      'Los padres de ambas son hermanos (Freire Acosta).'
    ],
    fechaDeteccion: '2025-04-28'
  },
  {
    id: 'C-005',
    personaA: buscarPersona('EMP-003'),
    rolA: 'Cuñada',
    personaB: buscarPersona('EMP-010'),
    rolB: 'Cuñado',
    etiquetaSimetrica: 'Cuñados',
    relacion: 'Afinidad',
    grado: 2,
    riesgo: 'medio',
    clasificacion: 'pendiente',
    motivoRiesgo: 'La analista de presupuesto valida los contratos de '
      + 'tecnología que solicita el ingeniero de sistemas.',
    evidenciasDeteccion: [
      'El cónyuge de EMP-010 tiene los mismos padres que EMP-003.'
    ],
    fechaDeteccion: '2026-09-22'
  },
  {
    id: 'C-006',
    personaA: buscarPersona('EMP-002'),
    rolA: 'Hermano',
    personaB: buscarPersona('EMP-012'),
    rolB: 'Hermana',
    etiquetaSimetrica: 'Hermanos',
    relacion: 'Consanguinidad',
    grado: 2,
    riesgo: 'ninguno',
    clasificacion: 'homonimo',
    motivoRiesgo: 'Coincidencia de apellidos; los padres son distintos, '
      + 'no hay parentesco.',
    evidenciasDeteccion: [
      'Ambos se apellidan Mayorga Sánchez.'
    ],
    fechaDeteccion: '2026-03-03'
  },
  {
    id: 'C-007',
    personaA: buscarPersona('EMP-006'),
    rolA: 'Padre',
    personaB: buscarPersona('EMP-011'),
    rolB: 'Hija',
    relacion: 'Consanguinidad',
    grado: 1,
    riesgo: 'bajo',
    clasificacion: 'pendiente',
    motivoRiesgo: 'Departamentos distintos y sin relación jerárquica.',
    evidenciasDeteccion: [
      'El padre registrado de EMP-011 coincide con EMP-006.'
    ],
    fechaDeteccion: '2026-09-26'
  },
  {
    id: 'C-008',
    personaA: buscarPersona('EMP-004'),
    rolA: 'Suegro',
    personaB: buscarPersona('EMP-008'),
    rolB: 'Nuera',
    relacion: 'Afinidad',
    grado: 1,
    riesgo: 'medio',
    clasificacion: 'confirmado',
    motivoRiesgo: 'La analista de Talento Humano tramita expedientes del '
      + 'personal de Distribución, que dirige su suegro.',
    evidenciasDeteccion: [
      'El cónyuge de EMP-008 es hijo de EMP-004.',
      'Declarado en el formulario de EMP-008.'
    ],
    fechaDeteccion: '2025-12-15'
  },
  {
    id: 'C-009',
    personaA: buscarPersona('EMP-007'),
    rolA: 'Esposo',
    personaB: buscarPersona('EMP-011'),
    rolB: 'Esposa',
    etiquetaSimetrica: 'Cónyuges',
    relacion: 'Afinidad',
    grado: null,
    riesgo: 'bajo',
    clasificacion: 'pendiente',
    motivoRiesgo: 'Departamentos distintos (Financiero y Comercialización) '
      + 'y sin relación jerárquica entre ellos.',
    evidenciasDeteccion: [
      'El cónyuge registrado de EMP-007 es EMP-011, y viceversa.'
    ],
    fechaDeteccion: '2026-09-29'
  }
];

/**
 * Conflictos de ejemplo con sus planes enlazados desde `PLANES` (por
 * `conflictoId`), para que ambos servicios devuelvan los mismos datos.
 *
 * @author Elvis Flores
 */
export const CONFLICTOS: readonly Conflicto[] = CONFLICTOS_SIN_PLANES.map(
  (conflicto) => ({
    ...conflicto,
    planes: PLANES.filter((plan) => plan.conflictoId === conflicto.id)
  })
);
