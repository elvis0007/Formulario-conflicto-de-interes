import { Notificacion } from '../../models';

/**
 * Notificaciones de ejemplo, leidas y no leidas, de todos los `tipo`.
 *
 * @author EEASA
 */
export const NOTIFICACIONES: readonly Notificacion[] = [
    {
        id: 'N-001',
        titulo: 'Nueva evidencia para revisar',
        texto: 'Carlos Andrés Mayorga Sánchez subió evidencia de la '
            + 'actividad A-005 del plan PL-002.',
        fecha: '2026-09-25T09:14:00',
        leida: false,
        tipo: 'info'
    },
    {
        id: 'N-002',
        titulo: 'Evidencia rechazada',
        texto: 'La evidencia de la actividad A-007 fue rechazada: la matriz '
            + 'no tiene la firma del jefe de área.',
        fecha: '2026-09-20T11:02:00',
        leida: false,
        tipo: 'rechazo'
    },
    {
        id: 'N-003',
        titulo: 'Actividad vencida',
        texto: 'La actividad A-003 del plan PL-002 venció el 1 de agosto de '
            + '2026 sin evidencia.',
        fecha: '2026-08-02T00:05:00',
        leida: false,
        tipo: 'vencido'
    },
    {
        id: 'N-004',
        titulo: 'Nuevo conflicto detectado',
        texto: 'Se detectó un posible conflicto (C-007) entre Patricio '
            + 'Eduardo Barona Silva y Gabriela Alejandra Barona Núñez.',
        fecha: '2026-09-26T08:30:00',
        leida: false,
        tipo: 'alerta'
    },
    {
        id: 'N-005',
        titulo: 'Evidencia aprobada',
        texto: 'La evidencia de la actividad A-006 del plan PL-003 fue '
            + 'aprobada.',
        fecha: '2026-09-04T16:40:00',
        leida: true,
        tipo: 'ok'
    },
    {
        id: 'N-006',
        titulo: 'Plan de acción cerrado',
        texto: 'El plan PL-006 se cerró: todas sus actividades están '
            + 'aprobadas.',
        fecha: '2026-04-15T10:00:00',
        leida: true,
        tipo: 'ok'
    },
    {
        id: 'N-007',
        titulo: 'Actividad próxima a vencer',
        texto: 'La actividad A-007 vence el 2 de octubre de 2026.',
        fecha: '2026-09-27T07:00:00',
        leida: false,
        tipo: 'alerta'
    },
    {
        id: 'N-008',
        titulo: 'Nuevo formulario recibido',
        texto: 'Fernando José Andrade Vela envió una actualización de su '
            + 'formulario de conflicto de interés.',
        fecha: '2026-09-19T15:22:00',
        leida: true,
        tipo: 'info'
    },
    {
        id: 'N-009',
        titulo: 'Nueva excusa registrada',
        texto: 'Marco Vinicio Tamayo Guevara se excusó de la evaluación '
            + 'anual 2026 de la cuadrilla 7.',
        fecha: '2026-09-15T12:10:00',
        leida: true,
        tipo: 'info'
    },
    {
        id: 'N-010',
        titulo: 'Actividad asignada',
        texto: 'Se le asignó la actividad A-008 del plan PL-003 con plazo '
            + 'hasta el 17 de octubre de 2026.',
        fecha: '2026-08-17T09:00:00',
        leida: true,
        tipo: 'info'
    }
];
