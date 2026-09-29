import { Component, EventEmitter, Input, Output } from '@angular/core';
import { IconoPnipComponent } from '../icono-pnip/icono-pnip.component';

/**
 * Boton cuadrado con flecha para expandir o contraer una fila o seccion.
 * La flecha rota 180° al expandir.
 *
 * Uso:
 * `<app-pnip-expand-arrow-button [expandido]="abierta"
 *     etiqueta="familiares de Carlos" (alternar)="abierta = !abierta" />`
 *
 * @author Elvis Flores
 */
@Component({
    selector: 'app-pnip-expand-arrow-button',
    imports: [IconoPnipComponent],
    templateUrl: './expand-arrow-button-pnip.component.html',
    styleUrl: './expand-arrow-button-pnip.component.scss'
})
export class ExpandArrowButtonPnipComponent {
    /** Si el contenido asociado esta desplegado. */
    @Input() expandido = false;

    /**
     * Que se muestra u oculta, para el `aria-label`
     * (`Mostrar {etiqueta}` / `Ocultar {etiqueta}`).
     */
    @Input() etiqueta = 'detalle';

    /** Id del elemento que controla, para `aria-controls` (opcional). */
    @Input() controla: string | null = null;

    /** Se emite al pulsar el boton. */
    @Output() alternar = new EventEmitter<void>();

    /**
     * @returns Texto accesible segun el estado.
     */
    get etiquetaAccesible(): string {
        return (this.expandido ? 'Ocultar ' : 'Mostrar ') + this.etiqueta;
    }
}
