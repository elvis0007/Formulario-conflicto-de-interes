import { Excusa } from '../../models';

/**
 * Formularios de excusa de ejemplo. `proceso` usa el catalogo provisional
 * `TIPOS_PROCESO_EXCUSA`.
 *
 * @author Elvis Flores
 */
export const EXCUSAS: readonly Excusa[] = [
  {
    id: 'E-001',
    nombre: 'Carlos Andrés Mayorga Sánchez',
    cedula: '1800000011',
    origen: 'Interno',
    proceso: 'Proceso de compra',
    detalleProceso: 'Adquisición de medidores monofásicos '
      + '(proceso SIE-EEASA-2026-014)',
    familiar: 'Jorge Luis Mayorga Sánchez',
    parentesco: 'Hermano',
    motivo: 'El técnico de compras integra la comisión técnica del '
      + 'proceso.',
    reemplazo: 'Patricio Eduardo Barona Silva',
    fecha: '2026-03-11'
  },
  {
    id: 'E-002',
    nombre: 'Lucía Alejandra Freire Ortiz',
    cedula: '1800000086',
    origen: 'Interno',
    proceso: 'Proceso de selección',
    detalleProceso: 'Concurso para Asistente de Comercialización',
    familiar: 'Paola Cristina Freire Naranjo',
    parentesco: 'Prima',
    motivo: 'La prima es postulante del concurso.',
    reemplazo: 'Diana Carolina Pérez López',
    fecha: '2025-05-06'
  },
  {
    id: 'E-003',
    nombre: 'Marco Vinicio Tamayo Guevara',
    cedula: '1800000045',
    origen: 'Interno',
    proceso: 'Evaluación de desempeño',
    detalleProceso: 'Evaluación anual 2026 de la cuadrilla 7',
    familiar: 'Andrés Sebastián Tamayo Ruiz',
    parentesco: 'Sobrino',
    motivo: 'El sobrino forma parte de la cuadrilla evaluada.',
    reemplazo: 'Fernando José Andrade Vela',
    fecha: '2026-09-15'
  },
  {
    id: 'E-004',
    nombre: 'Verónica Alexandra Salazar Pinto',
    cedula: '1800000342',
    origen: 'Externo',
    proceso: 'Proceso de compra',
    detalleProceso: 'Servicio de atención telefónica '
      + '(proceso CDC-EEASA-2026-003)',
    familiar: 'Paola Cristina Freire Naranjo',
    parentesco: 'Prima',
    motivo: 'La prima trabaja en el área que administra el contrato.',
    reemplazo: 'Cristian Salazar Pinto',
    fecha: '2026-08-12'
  }
];
