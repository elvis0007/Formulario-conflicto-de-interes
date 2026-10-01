import {
  Component,
  ElementRef,
  EventEmitter,
  Input,
  Output,
  QueryList,
  ViewChildren
} from '@angular/core';

/**
 * Pestana de `TabsComponent`.
 */
export interface Pestana {
  /** Valor que se emite al elegirla. */
  valor: string;
  /** Texto visible. */
  etiqueta: string;
  /** Numero entre parentesis: `No han llenado formulario (4)`. */
  contador?: number;
  /** Se ve atenuada (p. ej. un plan cerrado); sigue siendo elegible. */
  atenuada?: boolean;
}

/**
 * Pestanas que controlan un panel de contenido (ARIA `tablist`).
 *
 * Separado de `PillsComponent` (Dia 3): aqui cada pestana muestra un
 * panel distinto. La pantalla pinta el panel con
 * `role="tabpanel"`, `[id]="idPanel(valor)"` y
 * `[attr.aria-labelledby]="idPestana(valor)"` (ver metodos homonimos).
 *
 * Teclado: flechas izquierda/derecha, Inicio y Fin mueven y activan;
 * solo la pestana activa entra en el orden de Tab.
 *
 * Uso:
 * `<app-tabs idBase="formularios" [pestanas]="p"
 *     [seleccionada]="actual" (cambio)="actual = $event" />`
 *
 * @author Elvis Flores
 */
@Component({
  selector: 'app-tabs',
  templateUrl: './tabs.component.html',
  styleUrl: './tabs.component.scss'
})
export class TabsComponent {
  /** Pestanas, en orden. */
  @Input({ required: true }) pestanas: readonly Pestana[] = [];

  /** Valor de la pestana activa. */
  @Input({ required: true }) seleccionada = '';

  /** Prefijo de los ids de pestanas y paneles (unico en la pagina). */
  @Input({ required: true }) idBase = '';

  /** Nombre accesible del grupo de pestanas. */
  @Input() etiqueta = '';

  /** Se emite con el valor de la pestana elegida. */
  @Output() cambio = new EventEmitter<string>();

  /** Botones de las pestanas, para mover el foco con el teclado. */
  @ViewChildren('boton') private botones?: QueryList<
    ElementRef<HTMLButtonElement>
  >;

  /**
   * @param valor Valor de una pestana.
   * @returns Id del boton de esa pestana.
   */
  idPestana(valor: string): string {
    return this.idBase + '-pestana-' + valor;
  }

  /**
   * @param valor Valor de una pestana.
   * @returns Id del panel que controla esa pestana.
   */
  idPanel(valor: string): string {
    return this.idBase + '-panel-' + valor;
  }

  /**
   * @param pestana Pestana.
   * @returns Texto visible con el contador, si lo hay.
   */
  texto(pestana: Pestana): string {
    return pestana.contador === undefined
      ? pestana.etiqueta
      : pestana.etiqueta + ' (' + pestana.contador + ')';
  }

  /**
   * Activa una pestana.
   *
   * @param valor Valor de la pestana.
   */
  elegir(valor: string): void {
    if (valor !== this.seleccionada) {
      this.cambio.emit(valor);
    }
  }

  /**
   * Navegacion con flechas, Inicio y Fin.
   *
   * @param evento Tecla pulsada sobre una pestana.
   * @param indice Posicion de esa pestana.
   */
  alPresionarTecla(evento: KeyboardEvent, indice: number): void {
    const total = this.pestanas.length;
    let destino = -1;

    if (evento.key === 'ArrowRight') {
      destino = (indice + 1) % total;
    } else if (evento.key === 'ArrowLeft') {
      destino = (indice - 1 + total) % total;
    } else if (evento.key === 'Home') {
      destino = 0;
    } else if (evento.key === 'End') {
      destino = total - 1;
    }

    if (destino < 0) {
      return;
    }

    evento.preventDefault();
    this.botones?.get(destino)?.nativeElement.focus();
    this.elegir(this.pestanas[destino].valor);
  }
}
