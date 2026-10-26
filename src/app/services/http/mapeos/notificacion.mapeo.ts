import { Notificacion } from '../../../models';
import { NotificacionApi, TipoNotificacionApi } from '../../../models/api';

/**
 * Función pura que convierte una notificación del backend al modelo de la
 * campana.
 *
 * @author Sebas Constante
 */

/** Título y categoría visual de cada tipo de notificación del backend. */
const PRESENTACION: Readonly<Record<TipoNotificacionApi, Pick<Notificacion, 'titulo' | 'tipo'>>> = {
  ACTIVIDAD_ASIGNADA: { titulo: 'Actividad asignada', tipo: 'info' },
  EVIDENCIA_POR_REVISAR: { titulo: 'Nueva evidencia por revisar', tipo: 'info' },
  EVIDENCIA_APROBADA: { titulo: 'Evidencia aprobada', tipo: 'ok' },
  EVIDENCIA_RECHAZADA: { titulo: 'Evidencia rechazada', tipo: 'rechazo' },
  ACTIVIDAD_VENCIDA: { titulo: 'Actividad vencida', tipo: 'vencido' },
  CONFLICTO_FINALIZADO: { titulo: 'Conflicto finalizado', tipo: 'ok' }
};

/** Presentación de una notificación sin tipo conocido. */
const PRESENTACION_GENERICA: Pick<Notificacion, 'titulo' | 'tipo'> = { titulo: 'Aviso', tipo: 'info' };

/**
 * El título y el tipo visual salen del `TIPO`; el texto es el `MENSAJE`.
 * El backend no manda destinatario (ya filtra por el usuario del token).
 *
 * @param api Notificación del backend.
 * @returns Notificación del modelo.
 * @author Sebas Constante
 */
export function mapearNotificacion(api: NotificacionApi): Notificacion {
  const presentacion = api.TIPO === null ? PRESENTACION_GENERICA : PRESENTACION[api.TIPO] ?? PRESENTACION_GENERICA;

  return {
    id: String(api.CODIGO ?? ''),
    titulo: presentacion.titulo,
    texto: api.MENSAJE ?? '',
    fecha: api.FECHA ?? '',
    leida: api.LEIDA,
    tipo: presentacion.tipo
  };
}
