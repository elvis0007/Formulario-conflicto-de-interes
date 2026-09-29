import { Component, Input } from '@angular/core';
import { Tono } from '../../../core/utils/tono.util';

/**
 * Insignia (pildora) de estado o riesgo.
 *
 * Toma los colores de `--{tono}-fill` (fondo) y `--{tono}-text` (texto).
 * El texto es obligatorio y siempre visible: el significado nunca se
 * transmite solo con color.
 *
 * Uso: `<app-pnip-badge tono="rojo" texto="Alto" />`
 *
 * @author EEASA
 */
@Component({
    selector: 'app-pnip-badge',
    templateUrl: './badge-pnip.component.html',
    styleUrl: './badge-pnip.component.scss'
})
export class BadgePnipComponent {
    /** Tono de la insignia. */
    @Input({ required: true }) tono!: Tono;

    /** Texto visible de la insignia. */
    @Input({ required: true }) texto!: string;

    /**
     * @returns Variable CSS de fondo del tono actual.
     */
    get fondo(): string {
        return 'var(--' + this.tono + '-fill)';
    }

    /**
     * @returns Variable CSS de texto del tono actual.
     */
    get color(): string {
        return 'var(--' + this.tono + '-text)';
    }
}
