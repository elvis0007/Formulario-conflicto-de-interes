import { Pipe, PipeTransform } from '@angular/core';
import { Actividad } from '../../core/models';

/**
 * Convierte el plazo de una actividad (`plazoMeses` + `plazoDias`) en
 * texto, omitiendo la unidad que valga cero y con singular/plural.
 *
 * | Entrada   | `plazoTexto`    | `plazoTexto:true`       |
 * |-----------|-----------------|-------------------------|
 * | 0 m, 15 d | `15 días`       | `Plazo: 15 días`        |
 * | 2 m, 0 d  | `2 meses`       | `Plazo: 2 meses`        |
 * | 2 m, 15 d | `2 meses 15 días` | `Plazo: 2 meses 15 días` |
 * | 1 m, 1 d  | `1 mes 1 día`   | `Plazo: 1 mes 1 día`    |
 * | 0 m, 0 d  | `0 días`        | `Plazo: 0 días`         |
 *
 * - Sin prefijo: columna «Plazo» de las tablas de actividades.
 * - Con prefijo: leyenda bajo «Fecha límite» mientras el plan no se envio.
 *
 * Uso: `{{ actividad | plazoTexto }}`, `{{ actividad | plazoTexto:true }}`
 *
 * @author EEASA
 */
@Pipe({
    name: 'plazoTexto'
})
export class PlazoTextoPipe implements PipeTransform {

    /**
     * @param plazo Objeto con `plazoMeses` y `plazoDias` (p. ej. una
     * `Actividad`).
     * @param conPrefijo `true` para anteponer `Plazo: `.
     * @returns Texto del plazo; `''` si no hay plazo.
     */
    transform(
        plazo: Pick<Actividad, 'plazoMeses' | 'plazoDias'> | null | undefined,
        conPrefijo: boolean = false
    ): string {
        const partes: string[] = [];
        let texto = '';

        if (!plazo) {
            return '';
        }

        if (plazo.plazoMeses !== 0) {
            partes.push(this.unidad(plazo.plazoMeses, 'mes', 'meses'));
        }
        if (plazo.plazoDias !== 0 || partes.length === 0) {
            partes.push(this.unidad(plazo.plazoDias, 'día', 'días'));
        }

        texto = partes.join(' ');

        return conPrefijo ? 'Plazo: ' + texto : texto;
    }

    /**
     * @param cantidad Numero de unidades.
     * @param singular Unidad en singular.
     * @param plural Unidad en plural.
     * @returns `1 mes`, `3 meses`...
     */
    private unidad(cantidad: number, singular: string, plural: string): string {
        return cantidad + ' ' + (cantidad === 1 ? singular : plural);
    }
}
