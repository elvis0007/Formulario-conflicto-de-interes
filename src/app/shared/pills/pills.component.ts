import { Component, EventEmitter, Input, Output } from '@angular/core';
import { Tono } from '../../utils/tono.util';

/**
 * Opcion de `PillsComponent`.
 */
export interface OpcionPill {
    /** Valor que se emite al elegir la opcion. */
    valor: string;
    /** Texto visible (sin el contador). */
    etiqueta: string;
    /** Numero que se muestra entre parentesis: `Alto (3)`. */
    contador?: number;
    /** Color de la pildora cuando esta seleccionada; `azul` por defecto. */
    tono?: Tono;
}

/** Tono de la pildora seleccionada si la opcion no indica uno. */
const TONO_POR_DEFECTO: Tono = 'azul';

/**
 * Pildoras de filtro: un grupo de botones donde se elige UN valor a la vez
 * (p. ej. `Todos (12)`, `Alto (3)`...). La seleccionada se pinta con el
 * fondo solido de su tono; las demas, blancas con borde `--hairline`.
 *
 * DECISION: solo sirve para FILTROS. Las pestanas de «Planes de este
 * conflicto» tendran su propio `TabsComponent` (Dia 7-8), porque son
 * otra cosa: controlan un panel de contenido (`role="tablist"`/`tab` con
 * `aria-controls`, navegacion con flechas), cada pestana lleva su estado de
 * plan con su propia insignia y la de un plan cerrado se ve atenuada.
 * Meter todo eso aqui complicaria un componente que hoy es simple.
 *
 * Accesibilidad: cada pildora es un `<button>` con `aria-pressed`, dentro de
 * un `role="group"`.
 *
 * Uso:
 * `<app-pills [opciones]="filtros" [seleccionado]="filtro"
 *     (cambio)="filtro = $event" />`
 *
 * @author Elvis Flores
 */
@Component({
    selector: 'app-pills',
    templateUrl: './pills.component.html',
    styleUrl: './pills.component.scss'
})
export class PillsComponent {
    /** Opciones a mostrar, en orden. */
    @Input({ required: true }) opciones: OpcionPill[] = [];

    /** Valor de la opcion seleccionada. */
    @Input({ required: true }) seleccionado = '';

    /** Nombre del grupo para lectores de pantalla. */
    @Input() etiquetaGrupo = 'Filtros';

    /** Se emite con el `valor` de la opcion elegida. */
    @Output() cambio = new EventEmitter<string>();

    /**
     * @param opcion Opcion a pintar.
     * @returns Texto visible: etiqueta y, si hay, contador.
     */
    texto(opcion: OpcionPill): string {
        return opcion.contador === undefined
            ? opcion.etiqueta
            : opcion.etiqueta + ' (' + opcion.contador + ')';
    }

    /**
     * @param opcion Opcion a pintar.
     * @returns Variable CSS de fondo si esta seleccionada; `null` si no.
     */
    fondo(opcion: OpcionPill): string | null {
        return opcion.valor === this.seleccionado
            ? 'var(--' + (opcion.tono ?? TONO_POR_DEFECTO) + ')'
            : null;
    }

    /**
     * Emite el cambio si se elige una opcion distinta a la actual.
     *
     * @param opcion Opcion pulsada.
     */
    elegir(opcion: OpcionPill): void {
        if (opcion.valor !== this.seleccionado) {
            this.cambio.emit(opcion.valor);
        }
    }
}
