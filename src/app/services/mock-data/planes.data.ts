import { Archivo, PlanAccion } from '../../models';

/**
 * Crea la referencia a un PDF de ejemplo (la URL no existe todavia).
 *
 * @param nombre Nombre del archivo.
 * @returns Archivo PDF simulado.
 */
function pdfSimulado(nombre: string): Archivo {
    return { nombre, url: '/mock/archivos/' + nombre, tipo: 'pdf' };
}

/**
 * Planes de accion de ejemplo. Cubren los cuatro `EstadoPlan`, actividades
 * en todos los `EstadoActividad`, evidencias aprobadas, rechazadas, en
 * revision y ausentes, y planes con y sin documento firmado.
 *
 * | Plan   | Conflicto | Estado          | Documento firmado |
 * |--------|-----------|-----------------|-------------------|
 * | PL-001 | C-001     | cerrado         | si                |
 * | PL-002 | C-001     | activo_vencidas | si                |
 * | PL-003 | C-002     | activo          | si                |
 * | PL-004 | C-003     | borrador        | no                |
 * | PL-005 | C-004     | cerrado         | si                |
 * | PL-006 | C-008     | cerrado         | si                |
 * | PL-007 | C-008     | borrador        | si                |
 *
 * Las fechas limite estan calculadas con `calcularFechaLimite` sobre
 * `fechaInicio`; los planes en borrador no tienen ni una ni otra.
 *
 * @author Elvis Flores
 */
export const PLANES: readonly PlanAccion[] = [
    {
        id: 'PL-001',
        numero: 1,
        nombre: 'Separación de funciones en compras',
        conflictoId: 'C-001',
        estado: 'cerrado',
        fechaInicio: '2025-11-03',
        fechaCierre: '2026-03-20',
        documentoFirmado: pdfSimulado('PL-001-plan-firmado.pdf'),
        actividades: [
            {
                id: 'A-001',
                descripcion: 'Reasignar la aprobación de órdenes de compra '
                    + 'del técnico a otro jefe de área.',
                responsableId: 'EMP-006',
                responsableNombre: 'Patricio Eduardo Barona Silva',
                plazoMeses: 1,
                plazoDias: 0,
                fechaLimite: '2025-12-03',
                estado: 'aprobada',
                evidencia: {
                    archivo: pdfSimulado('A-001-memorando.pdf'),
                    fechaSubida: '2025-11-28T10:42:00',
                    estado: 'aprobada',
                    revisadoPor: 'Lucía Alejandra Freire Ortiz'
                }
            },
            {
                id: 'A-002',
                descripcion: 'Firmar la declaración de abstención en los '
                    + 'procesos de contratación del técnico.',
                responsableId: 'EMP-001',
                responsableNombre: 'Carlos Andrés Mayorga Sánchez',
                plazoMeses: 0,
                plazoDias: 15,
                fechaLimite: '2025-11-18',
                estado: 'aprobada',
                evidencia: {
                    archivo: {
                        nombre: 'A-002-declaracion.jpg',
                        url: '/mock/archivos/A-002-declaracion.jpg',
                        tipo: 'jpg'
                    },
                    fechaSubida: '2025-11-14T16:05:00',
                    estado: 'aprobada',
                    revisadoPor: 'Lucía Alejandra Freire Ortiz'
                }
            }
        ]
    },
    {
        id: 'PL-002',
        numero: 2,
        nombre: 'Rotación del técnico de compras',
        conflictoId: 'C-001',
        estado: 'activo_vencidas',
        fechaInicio: '2026-06-01',
        documentoFirmado: pdfSimulado('PL-002-plan-firmado.pdf'),
        actividades: [
            {
                id: 'A-003',
                descripcion: 'Rotar al técnico a la unidad de bodega.',
                responsableId: 'EMP-001',
                responsableNombre: 'Carlos Andrés Mayorga Sánchez',
                plazoMeses: 2,
                plazoDias: 0,
                fechaLimite: '2026-08-01',
                estado: 'vencida'
            },
            {
                id: 'A-004',
                descripcion: 'Restringir los permisos del técnico en el '
                    + 'sistema de compras públicas.',
                responsableId: 'EMP-010',
                responsableNombre: 'Fernando José Andrade Vela',
                plazoMeses: 1,
                plazoDias: 0,
                fechaLimite: '2026-07-01',
                estado: 'aprobada',
                evidencia: {
                    archivo: {
                        nombre: 'A-004-captura-permisos.png',
                        url: '/mock/archivos/A-004-captura-permisos.png',
                        tipo: 'png'
                    },
                    fechaSubida: '2026-06-24T11:30:00',
                    estado: 'aprobada',
                    revisadoPor: 'Lucía Alejandra Freire Ortiz'
                }
            },
            {
                id: 'A-005',
                descripcion: 'Presentar el informe trimestral de procesos '
                    + 'adjudicados en el área.',
                responsableId: 'EMP-001',
                responsableNombre: 'Carlos Andrés Mayorga Sánchez',
                plazoMeses: 4,
                plazoDias: 0,
                fechaLimite: '2026-10-01',
                estado: 'en_revision',
                evidencia: {
                    archivo: pdfSimulado('A-005-informe-trimestral.pdf'),
                    fechaSubida: '2026-09-25T09:14:00',
                    estado: 'pendiente'
                }
            }
        ]
    },
    {
        id: 'PL-003',
        numero: 1,
        nombre: 'Independencia de la cuadrilla',
        conflictoId: 'C-002',
        estado: 'activo',
        fechaInicio: '2026-08-17',
        documentoFirmado: pdfSimulado('PL-003-plan-firmado.pdf'),
        actividades: [
            {
                id: 'A-006',
                descripcion: 'Cambiar al liniero a una cuadrilla que no '
                    + 'dependa del superintendente.',
                responsableId: 'EMP-004',
                responsableNombre: 'Marco Vinicio Tamayo Guevara',
                plazoMeses: 0,
                plazoDias: 20,
                fechaLimite: '2026-09-06',
                estado: 'aprobada',
                evidencia: {
                    archivo: pdfSimulado('A-006-orden-de-cambio.pdf'),
                    fechaSubida: '2026-09-02T09:14:00',
                    estado: 'aprobada',
                    revisadoPor: 'Lucía Alejandra Freire Ortiz'
                }
            },
            {
                id: 'A-007',
                descripcion: 'Actualizar la matriz de firmas de órdenes de '
                    + 'trabajo.',
                responsableId: 'EMP-010',
                responsableNombre: 'Fernando José Andrade Vela',
                plazoMeses: 1,
                plazoDias: 15,
                fechaLimite: '2026-10-02',
                estado: 'rechazada',
                evidencia: {
                    archivo: pdfSimulado('A-007-matriz-firmas.pdf'),
                    fechaSubida: '2026-09-18T15:48:00',
                    estado: 'rechazada',
                    motivoRechazo: 'La matriz adjunta no tiene la firma del '
                        + 'jefe de área.',
                    revisadoPor: 'Lucía Alejandra Freire Ortiz'
                }
            },
            {
                id: 'A-008',
                descripcion: 'Retirar al superintendente de la aprobación de '
                    + 'horas extra del liniero en el sistema.',
                responsableId: 'EMP-010',
                responsableNombre: 'Fernando José Andrade Vela',
                plazoMeses: 2,
                plazoDias: 0,
                fechaLimite: '2026-10-17',
                estado: 'pendiente'
            }
        ]
    },
    {
        id: 'PL-004',
        numero: 1,
        nombre: 'Control cruzado de pagos',
        conflictoId: 'C-003',
        estado: 'borrador',
        actividades: [
            {
                id: 'A-009',
                descripcion: 'Trasladar la aprobación de pagos del contador '
                    + 'a la subdirección financiera.',
                responsableId: 'EMP-006',
                responsableNombre: 'Patricio Eduardo Barona Silva',
                plazoMeses: 1,
                plazoDias: 0,
                estado: 'pendiente'
            },
            {
                id: 'A-010',
                descripcion: 'Auditar los pagos aprobados en el último '
                    + 'semestre.',
                responsableId: 'EMP-003',
                responsableNombre: 'Diana Carolina Pérez López',
                plazoMeses: 3,
                plazoDias: 0,
                estado: 'pendiente'
            }
        ]
    },
    {
        id: 'PL-005',
        numero: 1,
        nombre: 'Exclusión de procesos de selección',
        conflictoId: 'C-004',
        estado: 'cerrado',
        fechaInicio: '2025-05-12',
        fechaCierre: '2025-07-30',
        documentoFirmado: pdfSimulado('PL-005-plan-firmado.pdf'),
        actividades: [
            {
                id: 'A-011',
                descripcion: 'Firmar la declaración de no intervención en '
                    + 'procesos de selección de Comercialización.',
                responsableId: 'EMP-008',
                responsableNombre: 'Lucía Alejandra Freire Ortiz',
                plazoMeses: 0,
                plazoDias: 10,
                fechaLimite: '2025-05-22',
                estado: 'aprobada',
                evidencia: {
                    archivo: pdfSimulado('A-011-declaracion.pdf'),
                    fechaSubida: '2025-05-20T08:55:00',
                    estado: 'aprobada',
                    revisadoPor: 'Diana Carolina Pérez López'
                }
            }
        ]
    },
    {
        id: 'PL-006',
        numero: 1,
        nombre: 'Restricción de expedientes de Distribución',
        conflictoId: 'C-008',
        estado: 'cerrado',
        fechaInicio: '2026-01-12',
        fechaCierre: '2026-04-15',
        documentoFirmado: pdfSimulado('PL-006-plan-firmado.pdf'),
        actividades: [
            {
                id: 'A-012',
                descripcion: 'Firmar el compromiso de excusa en trámites de '
                    + 'personal de Distribución.',
                responsableId: 'EMP-008',
                responsableNombre: 'Lucía Alejandra Freire Ortiz',
                plazoMeses: 0,
                plazoDias: 15,
                fechaLimite: '2026-01-27',
                estado: 'aprobada',
                evidencia: {
                    archivo: pdfSimulado('A-012-compromiso.pdf'),
                    fechaSubida: '2026-01-22T14:20:00',
                    estado: 'aprobada',
                    revisadoPor: 'Diana Carolina Pérez López'
                }
            },
            {
                id: 'A-013',
                descripcion: 'Bloquear el acceso de la analista a los '
                    + 'expedientes de Distribución en el sistema.',
                responsableId: 'EMP-010',
                responsableNombre: 'Fernando José Andrade Vela',
                plazoMeses: 1,
                plazoDias: 0,
                fechaLimite: '2026-02-12',
                estado: 'aprobada',
                evidencia: {
                    archivo: {
                        nombre: 'A-013-captura-accesos.png',
                        url: '/mock/archivos/A-013-captura-accesos.png',
                        tipo: 'png'
                    },
                    fechaSubida: '2026-02-09T10:03:00',
                    estado: 'aprobada',
                    revisadoPor: 'Diana Carolina Pérez López'
                }
            }
        ]
    },
    {
        id: 'PL-007',
        numero: 2,
        nombre: 'Seguimiento anual',
        conflictoId: 'C-008',
        estado: 'borrador',
        documentoFirmado: pdfSimulado('PL-007-plan-firmado.pdf'),
        actividades: [
            {
                id: 'A-014',
                descripcion: 'Revisar anualmente que la restricción de '
                    + 'accesos siga vigente.',
                responsableId: 'EMP-010',
                responsableNombre: 'Fernando José Andrade Vela',
                plazoMeses: 12,
                plazoDias: 0,
                estado: 'pendiente'
            }
        ]
    }
];
