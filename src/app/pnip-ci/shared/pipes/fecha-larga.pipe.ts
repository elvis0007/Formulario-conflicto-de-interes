import { Pipe, PipeTransform } from '@angular/core';

/** Nombres de los meses en espanol, en minuscula. */
const MESES: readonly string[] = [
    'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio',
    'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'
];

/** Fecha ISO sin hora (`aaaa-mm-dd`). */
const PATRON_SOLO_FECHA = /^(\d{4})-(\d{2})-(\d{2})$/;

/**
 * Muestra una fecha ISO en formato largo en espanol.
 *
 * - `2026-09-02T09:14:00` → `2 de septiembre de 2026 a las 09:14 a. m.`
 * - `2026-09-02` (sin hora) → `2 de septiembre de 2026`
 *
 * Se implementa a mano, sin `DatePipe`, porque la app no registra el locale
 * `es` y hacerlo afectaria a toda la aplicacion.
 *
 * Uso: `{{ evidencia.fechaSubida | fechaLarga }}`
 *
 * @author EEASA
 */
@Pipe({
    name: 'fechaLarga'
})
export class FechaLargaPipe implements PipeTransform {

    /**
     * @param valor Fecha ISO 8601 (con o sin hora).
     * @returns Texto largo; `''` si no hay valor, o el mismo texto si no es
     * una fecha valida (para que el error sea visible y no se oculte).
     */
    transform(valor: string | null | undefined): string {
        const soloFecha = valor ? PATRON_SOLO_FECHA.exec(valor) : null;
        let fecha: Date;

        if (!valor) {
            return '';
        }

        if (soloFecha !== null) {
            fecha = new Date(
                Number(soloFecha[1]),
                Number(soloFecha[2]) - 1,
                Number(soloFecha[3])
            );
            return this.formatearDia(fecha);
        }

        fecha = new Date(valor);

        if (Number.isNaN(fecha.getTime())) {
            return valor;
        }

        return this.formatearDia(fecha) + ' a las ' + this.formatearHora(fecha);
    }

    /**
     * @param fecha Fecha a formatear.
     * @returns `2 de septiembre de 2026`.
     */
    private formatearDia(fecha: Date): string {
        return fecha.getDate() + ' de ' + MESES[fecha.getMonth()]
            + ' de ' + fecha.getFullYear();
    }

    /**
     * @param fecha Fecha a formatear.
     * @returns Hora en 12 h con dos digitos: `09:14 a. m.`, `12:30 p. m.`.
     */
    private formatearHora(fecha: Date): string {
        const horas = fecha.getHours();
        const hora12 = horas % 12 === 0 ? 12 : horas % 12;
        const minutos = String(fecha.getMinutes()).padStart(2, '0');
        const periodo = horas < 12 ? 'a. m.' : 'p. m.';

        return String(hora12).padStart(2, '0') + ':' + minutos + ' '
            + periodo;
    }
}
