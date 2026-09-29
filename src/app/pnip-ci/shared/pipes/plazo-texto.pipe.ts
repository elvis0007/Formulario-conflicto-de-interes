import { Pipe, PipeTransform } from '@angular/core';
import { Actividad } from '../../core/models';

/**
 * Formato de salida de `PlazoTextoPipe`.
 *
 * - `compacto` (defecto): omite la unidad en cero → `15 días`.
 * - `etiqueta`: igual, con prefijo → `Plazo: 15 días`.
 * - `completo`: siempre ambas unidades → `0 meses 15 días`.
 */
export type FormatoPlazo = 'compacto' | 'etiqueta' | 'completo';

/**
 * Convierte el plazo de una actividad (`plazoMeses` + `plazoDias`) en
 * texto, con singular y plural correctos.
 *
 * | Entrada | compacto | etiqueta | completo |
 * |---|---|---|---|
 * | 0 m, 15 d | `15 días` | `Plazo: 15 días` | `0 meses 15 días` |
 * | 1 m, 0 d | `1 mes` | `Plazo: 1 mes` | `1 mes 0 días` |
 * | 2 m, 1 d | `2 meses 1 día` | `Plazo: 2 meses 1 día` | `2 meses 1 día` |
 * | 0 m, 0 d | `0 días` | `Plazo: 0 días` | `0 meses 0 días` |
 *
 * Uso: `{{ actividad | plazoTexto }}`, `{{ actividad | plazoTexto:'etiqueta' }}`
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
     * @param formato Formato de salida; `compacto` por defecto.
     * @returns Texto del plazo; `''` si no hay plazo.
     */
    transform(
        plazo: Pick<Actividad, 'plazoMeses' | 'plazoDias'> | null | undefined,
        formato: FormatoPlazo = 'compacto'
    ): string {
        const partes: string[] = [];
        let texto = '';

        if (!plazo) {
            return '';
        }

        if (formato === 'completo' || plazo.plazoMeses !== 0) {
            partes.push(this.unidad(plazo.plazoMeses, 'mes', 'meses'));
        }
        if (formato === 'completo' || plazo.plazoDias !== 0
            || partes.length === 0) {
            partes.push(this.unidad(plazo.plazoDias, 'día', 'días'));
        }

        texto = partes.join(' ');

        return formato === 'etiqueta' ? 'Plazo: ' + texto : texto;
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
