import { Component, EventEmitter, Input, Output } from '@angular/core';
import {
    IconoPnipComponent,
    NombreIcono
} from '../icono-pnip/icono-pnip.component';

/**
 * Estado vacio de una lista: icono, texto y, si se indica `textoAccion`,
 * un boton.
 *
 * Uso:
 * `<app-pnip-empty-state texto="No hay formularios con esos filtros."
 *     textoAccion="Limpiar filtros" (accion)="limpiar()" />`
 *
 * @author Elvis Flores
 */
@Component({
    selector: 'app-pnip-empty-state',
    imports: [IconoPnipComponent],
    templateUrl: './empty-state-pnip.component.html',
    styleUrl: './empty-state-pnip.component.scss'
})
export class EmptyStatePnipComponent {
    /** Mensaje a mostrar. */
    @Input({ required: true }) texto!: string;

    /** Icono superior. */
    @Input() icono: NombreIcono = 'bandeja';

    /** Texto del boton; si falta, no hay boton. */
    @Input() textoAccion: string | null = null;

    /** Se emite al pulsar el boton. */
    @Output() accion = new EventEmitter<void>();
}
