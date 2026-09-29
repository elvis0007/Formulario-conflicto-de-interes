import { NgTemplateOutlet } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';
import { Tono } from '../../../core/utils/tono.util';

/**
 * Tarjeta de indicador (KPI): titulo y un numero grande.
 *
 * Si es `clicable` se pinta como `<button>` (accesible con teclado y
 * `aria-pressed` segun `activo`) y emite `seleccionado`; los indicadores del
 * dashboard la usaran como filtro.
 *
 * Uso:
 * `<app-pnip-kpi-card titulo="Riesgo alto" [valor]="3" tono="rojo"
 *     [clicable]="true" [activo]="filtro === 'alto'"
 *     (seleccionado)="filtrar('alto')" />`
 *
 * @author Elvis Flores
 */
@Component({
    selector: 'app-pnip-kpi-card',
    imports: [NgTemplateOutlet],
    templateUrl: './kpi-card.component.html',
    styleUrl: './kpi-card.component.scss'
})
export class KpiCardComponent {
    /** Texto descriptivo del indicador. */
    @Input({ required: true }) titulo!: string;

    /** Valor del indicador. */
    @Input({ required: true }) valor!: string | number;

    /** Color del numero; si no se indica, usa `--ink`. */
    @Input() tono?: Tono;

    /** Si la tarjeta esta seleccionada como filtro. */
    @Input() activo = false;

    /** Si la tarjeta responde al clic. */
    @Input() clicable = false;

    /** Se emite al hacer clic, solo si la tarjeta es `clicable`. */
    @Output() seleccionado = new EventEmitter<void>();

    /**
     * @returns Variable CSS del color del numero.
     */
    get colorValor(): string {
        return this.tono ? 'var(--' + this.tono + ')' : 'var(--ink)';
    }

    /**
     * Emite `seleccionado` si la tarjeta es clicable.
     */
    alSeleccionar(): void {
        if (this.clicable) {
            this.seleccionado.emit();
        }
    }
}
