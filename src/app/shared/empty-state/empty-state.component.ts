import { Component, EventEmitter, Input, Output } from '@angular/core';
import {
  IconoComponent,
  NombreIcono
} from '../icono/icono.component';

/**
 * Estado vacio de una lista: icono, texto y, si se indica `textoAccion`,
 * un boton.
 *
 * Uso:
 * `<app-empty-state texto="No hay formularios con esos filtros."
 *     textoAccion="Limpiar filtros" (accion)="limpiar()" />`
 *
 * @author Elvis Flores
 */
@Component({
  selector: 'app-empty-state',
  imports: [IconoComponent],
  templateUrl: './empty-state.component.html',
  styleUrl: './empty-state.component.scss'
})
export class EmptyStateComponent {
  /** Mensaje a mostrar. */
  @Input({ required: true }) texto!: string;

  /** Icono superior. */
  @Input() icono: NombreIcono = 'bandeja';

  /** Texto del boton; si falta, no hay boton. */
  @Input() textoAccion: string | null = null;

  /** Se emite al pulsar el boton. */
  @Output() accion = new EventEmitter<void>();
}
