import { Notificacion } from '../../models';

/** Milisegundos de un minuto. */
const MS_POR_MINUTO = 60 * 1000;

/**
 * Fecha ISO de hace `minutos` minutos, calculada al cargar la app. Las
 * notificaciones usan fechas relativas para que el filtro de «ultimos 7
 * dias» y el tiempo relativo («hace 3 h») se vean igual cualquier dia que
 * se pruebe.
 *
 * @param minutos Minutos hacia atras.
 * @returns Fecha ISO 8601 (UTC).
 */
function haceMinutos(minutos: number): string {
  return new Date(Date.now() - minutos * MS_POR_MINUTO).toISOString();
}

/** Minutos de una hora y de un dia, para leer mejor los datos. */
const HORA = 60;
const DIA = 24 * HORA;

/**
 * Notificaciones de ejemplo, leidas y no leidas, de todos los `tipo`. Dos
 * (N-006 y N-010) tienen mas de 7 dias, para ver el filtro de la campana.
 *
 * @author Elvis Flores
 */
export const NOTIFICACIONES: readonly Notificacion[] = [
  {
    id: 'N-001',
    titulo: 'Nueva evidencia para revisar',
    texto: 'Carlos Andrés Mayorga Sánchez subió evidencia de la '
      + 'actividad A-005 del plan PL-002.',
    fecha: haceMinutos(25),
    leida: false,
    tipo: 'info'
  },
  {
    id: 'N-002',
    titulo: 'Evidencia rechazada',
    texto: 'La evidencia de la actividad A-007 fue rechazada: la matriz '
      + 'no tiene la firma del jefe de área.',
    fecha: haceMinutos(3 * HORA),
    leida: false,
    tipo: 'rechazo'
  },
  {
    id: 'N-003',
    titulo: 'Actividad vencida',
    texto: 'La actividad A-003 del plan PL-002 venció sin evidencia.',
    fecha: haceMinutos(DIA + 2 * HORA),
    leida: false,
    tipo: 'vencido'
  },
  {
    id: 'N-004',
    titulo: 'Nuevo conflicto detectado',
    texto: 'Se detectó un posible conflicto (C-007) entre Patricio '
      + 'Eduardo Barona Silva y Gabriela Alejandra Barona Núñez.',
    fecha: haceMinutos(3 * DIA),
    leida: false,
    tipo: 'alerta'
  },
  {
    id: 'N-005',
    titulo: 'Evidencia aprobada',
    texto: 'La evidencia de la actividad A-006 del plan PL-003 fue '
      + 'aprobada.',
    fecha: haceMinutos(2 * DIA),
    leida: true,
    tipo: 'ok'
  },
  {
    id: 'N-006',
    titulo: 'Plan de acción cerrado',
    texto: 'El plan PL-006 se cerró: todas sus actividades están '
      + 'aprobadas.',
    fecha: haceMinutos(12 * DIA),
    leida: true,
    tipo: 'ok'
  },
  {
    id: 'N-007',
    titulo: 'Actividad próxima a vencer',
    texto: 'La actividad A-007 vence en pocos días.',
    fecha: haceMinutos(5 * HORA),
    leida: false,
    tipo: 'alerta'
  },
  {
    id: 'N-008',
    titulo: 'Nuevo formulario recibido',
    texto: 'Fernando José Andrade Vela envió una actualización de su '
      + 'formulario de conflicto de interés.',
    fecha: haceMinutos(4 * DIA),
    leida: true,
    tipo: 'info'
  },
  {
    id: 'N-009',
    titulo: 'Nueva excusa registrada',
    texto: 'Marco Vinicio Tamayo Guevara se excusó de la evaluación '
      + 'anual 2026 de la cuadrilla 7.',
    fecha: haceMinutos(6 * DIA),
    leida: true,
    tipo: 'info'
  },
  {
    id: 'N-010',
    titulo: 'Actividad asignada',
    texto: 'Se le asignó la actividad A-008 del plan PL-003.',
    fecha: haceMinutos(10 * DIA),
    leida: true,
    tipo: 'info'
  }
];
