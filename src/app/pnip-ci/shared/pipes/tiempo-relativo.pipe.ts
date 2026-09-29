import { Pipe, PipeTransform } from '@angular/core';
import { formatearFecha } from '../../core/utils/fechas.util';

/** Milisegundos de un minuto, una hora y un dia. */
const MS_MINUTO = 60 * 1000;
const MS_HORA = 60 * MS_MINUTO;
const MS_DIA = 24 * MS_HORA;

/**
 * Muestra cuanto tiempo paso desde una fecha:
 *
 * | Antiguedad     | Texto               |
 * |----------------|---------------------|
 * | < 1 min (o futura) | `hace un momento` |
 * | < 1 h          | `hace 25 min`       |
 * | < 24 h         | `hace 3 h`          |
 * | < 48 h         | `ayer`              |
 * | < 7 dias       | `hace 4 días`       |
 * | 7 dias o mas   | `dd/mm/aaaa`        |
 *
 * Es un pipe puro: el texto se recalcula cuando cambia el valor o la vista
 * se vuelve a pintar, no cada minuto. Suficiente para un panel que se abre
 * y se cierra.
 *
 * No existia un pipe equivalente en el proyecto.
 *
 * Uso: `{{ notificacion.fecha | tiempoRelativo }}`
 *
 * @author Elvis Flores
 */
@Pipe({
    name: 'tiempoRelativo'
})
export class TiempoRelativoPipe implements PipeTransform {

    /**
     * @param valor Fecha ISO 8601.
     * @param ahora Momento de referencia; por defecto, el actual (se pasa
     * en las pruebas).
     * @returns Texto relativo; `''` sin valor; el mismo texto si no es una
     * fecha valida.
     */
    transform(
        valor: string | null | undefined,
        ahora: Date = new Date()
    ): string {
        const fecha = valor ? new Date(valor) : null;
        let transcurrido = 0;

        if (!valor || fecha === null) {
            return '';
        }
        if (Number.isNaN(fecha.getTime())) {
            return valor;
        }

        transcurrido = ahora.getTime() - fecha.getTime();

        if (transcurrido < MS_MINUTO) {
            return 'hace un momento';
        }
        if (transcurrido < MS_HORA) {
            return 'hace ' + Math.floor(transcurrido / MS_MINUTO) + ' min';
        }
        if (transcurrido < MS_DIA) {
            return 'hace ' + Math.floor(transcurrido / MS_HORA) + ' h';
        }
        if (transcurrido < 2 * MS_DIA) {
            return 'ayer';
        }
        if (transcurrido < 7 * MS_DIA) {
            return 'hace ' + Math.floor(transcurrido / MS_DIA) + ' días';
        }

        return formatearFecha(fecha);
    }
}
