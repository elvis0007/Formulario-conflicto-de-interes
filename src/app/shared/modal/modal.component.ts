import {
  Component,
  ElementRef,
  EventEmitter,
  HostListener,
  Input,
  OnChanges,
  OnDestroy,
  Output,
  SimpleChanges,
  ViewChild
} from '@angular/core';

/** Elementos que pueden recibir foco con Tab. */
const SELECTOR_ENFOCABLES = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])'
].join(',');

/** Contador para generar ids unicos de titulo (aria-labelledby). */
let contadorModales = 0;

/**
 * Ventana modal del modulo.
 *
 * - Se cierra (emite `cerrar`) con la X, con clic en el fondo oscuro (no en
 *   el contenido) y con Esc. El componente padre decide si realmente la
 *   cierra poniendo `abierto` en `false`.
 * - Al abrir, mueve el foco al dialogo; Tab y Shift+Tab quedan atrapados
 *   dentro; al cerrar, devuelve el foco al elemento que lo tenia antes.
 * - El cuerpo se proyecta con `<ng-content>`.
 *
 * Uso:
 * `<app-modal titulo="Rechazar evidencia" [abierto]="abierto"
 *     (cerrar)="abierto = false"> ... </app-modal>`
 *
 * @author Elvis Flores
 */
@Component({
  selector: 'app-modal',
  templateUrl: './modal.component.html',
  styleUrl: './modal.component.scss'
})
export class ModalComponent implements OnChanges, OnDestroy {
  /** Titulo de la cabecera; tambien nombra el dialogo para lectores. */
  @Input({ required: true }) titulo!: string;

  /** Si el modal esta visible. */
  @Input() abierto = false;

  /** `ancho` ensancha el modal (visor de documentos). */
  @Input() ancho: 'normal' | 'ancho' = 'normal';

  /** Se emite cuando el usuario pide cerrar el modal. */
  @Output() cerrar = new EventEmitter<void>();

  /** Id del titulo, para `aria-labelledby`. */
  readonly idTitulo = 'app-modal-titulo-' + (++contadorModales);

  /** Elemento con foco antes de abrir, para devolvérselo al cerrar. */
  private focoPrevio: HTMLElement | null = null;

  /** Si el ultimo `mousedown` fue sobre el fondo (ver `alClicFondo`). */
  private presionadoEnFondo = false;

  /** Contenedor del dialogo; existe solo mientras esta abierto. */
  private dialogo: HTMLElement | null = null;

  /**
   * Recibe el contenedor del dialogo cuando se crea y le da el foco.
   *
   * @param ref Referencia al contenedor, o `undefined` al cerrarse.
   */
  @ViewChild('dialogo')
  set refDialogo(ref: ElementRef<HTMLElement> | undefined) {
    this.dialogo = ref ? ref.nativeElement : null;
    this.dialogo?.focus();
  }

  /**
   * Guarda o restaura el foco al cambiar `abierto`.
   *
   * @param cambios Cambios de inputs.
   */
  ngOnChanges(cambios: SimpleChanges): void {
    if (!cambios['abierto']) {
      return;
    }
    if (this.abierto) {
      this.focoPrevio = document.activeElement as HTMLElement | null;
    } else {
      this.restaurarFoco();
    }
  }

  /**
   * Devuelve el foco si el modal se destruye estando abierto.
   */
  ngOnDestroy(): void {
    if (this.abierto) {
      this.restaurarFoco();
    }
  }

  /**
   * Cierra con Esc. `HostListener` se elimina solo al destruir el
   * componente.
   */
  @HostListener('document:keydown.escape')
  alPresionarEsc(): void {
    if (this.abierto) {
      this.cerrar.emit();
    }
  }

  /**
   * Registra si el clic empezo en el fondo. Sin esto, seleccionar texto
   * dentro del dialogo y soltar el raton fuera cerraria el modal.
   *
   * @param evento Evento `mousedown` del fondo.
   */
  alPresionarFondo(evento: MouseEvent): void {
    this.presionadoEnFondo = evento.target === evento.currentTarget;
  }

  /**
   * Emite `cerrar` si el clic empezo y termino en el fondo.
   *
   * @param evento Evento `click` del fondo.
   */
  alClicFondo(evento: MouseEvent): void {
    const enFondo = evento.target === evento.currentTarget;

    if (enFondo && this.presionadoEnFondo) {
      this.cerrar.emit();
    }
    this.presionadoEnFondo = false;
  }

  /**
   * Atrapa el foco: Tab en el ultimo elemento vuelve al primero y
   * Shift+Tab en el primero va al ultimo.
   *
   * @param evento Evento `keydown` del dialogo.
   */
  alPresionarTecla(evento: KeyboardEvent): void {
    let enfocables: HTMLElement[] = [];
    let primero: HTMLElement | undefined;
    let ultimo: HTMLElement | undefined;
    const activo = document.activeElement;

    if (evento.key !== 'Tab' || this.dialogo === null) {
      return;
    }

    enfocables = Array.from(
      this.dialogo.querySelectorAll<HTMLElement>(SELECTOR_ENFOCABLES)
    );
    primero = enfocables[0];
    ultimo = enfocables[enfocables.length - 1];

    if (primero === undefined || ultimo === undefined) {
      evento.preventDefault();
      this.dialogo.focus();
      return;
    }

    if (evento.shiftKey && (activo === primero
      || activo === this.dialogo)) {
      evento.preventDefault();
      ultimo.focus();
    } else if (!evento.shiftKey && activo === ultimo) {
      evento.preventDefault();
      primero.focus();
    }
  }

  /**
   * Devuelve el foco al elemento que lo tenia antes de abrir.
   */
  private restaurarFoco(): void {
    if (this.focoPrevio && document.contains(this.focoPrevio)) {
      this.focoPrevio.focus();
    }
    this.focoPrevio = null;
  }
}
