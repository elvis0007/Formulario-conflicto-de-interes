/**
 * Aviso dirigido al usuario (nueva evidencia, rechazo, vencimiento...).
 *
 * @author Elvis Flores
 */
export interface Notificacion {
    id: string;
    titulo: string;
    texto: string;
    /** Fecha y hora de la notificacion (ISO 8601). */
    fecha: string;
    /** Si el usuario ya la abrio. */
    leida: boolean;
    /** Categoria visual de la notificacion (define color e icono). */
    tipo: 'info' | 'ok' | 'rechazo' | 'vencido' | 'alerta';
}
