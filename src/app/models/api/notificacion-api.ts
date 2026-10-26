import { TipoNotificacionApi } from './enums-api';
import { PaginaApi } from './respuesta-api';

/**
 * Interfaces de notificaciones, tal cual llegan del backend.
 *
 * @author Sebas Constante
 */

/**
 * Notificación del usuario (`NotificacionDto`).
 * Devuelta (dentro de `PaginaApi`) por `GET /notificaciones/mias?soloNoLeidas=false&pagina=0&tamanoPagina=20`.
 */
export interface NotificacionApi {
  CODIGO: number | null;
  TIPO: TipoNotificacionApi | null;
  MENSAJE: string | null;
  CONFLICTO_ID: number | null;
  ACTIVIDAD_ID: number | null;
  LEIDA: boolean;
  /** ISO-8601 sin zona. */
  FECHA: string | null;
}

/** Página de notificaciones: `datos` de `GET /notificaciones/mias`. */
export type PaginaNotificacionesApi = PaginaApi<NotificacionApi>;

/**
 * Resultado de `PATCH /notificaciones/leidas` (`datos`): cuántas no leídas había.
 * `PATCH /notificaciones/{id}/leida` responde solo el sobre, sin `datos`.
 */
export interface MarcadasApi {
  MARCADAS: number;
}
