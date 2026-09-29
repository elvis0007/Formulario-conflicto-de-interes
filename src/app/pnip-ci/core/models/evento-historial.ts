/**
 * Entrada del historial de cambios de un conflicto, plan o actividad.
 *
 * @author Elvis Flores
 */
export interface EventoHistorial {
    /** Fecha y hora del evento (ISO 8601). */
    fecha: string;
    /** Nombre de quien provoco el evento, o `Sistema`. */
    autor: string;
    /** Descripcion legible del evento. */
    texto: string;
    /** Categoria visual del evento (define color e icono). */
    tipo: 'info' | 'ok' | 'rechazo' | 'vencido' | 'cierre';
    /** Tipo de entidad a la que se refiere el evento. */
    nivel: 'conflicto' | 'plan' | 'actividad';
    /** Id de la entidad indicada por `nivel`. */
    refId: string;
}
