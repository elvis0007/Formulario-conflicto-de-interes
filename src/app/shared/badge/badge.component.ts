import { Component, Input } from '@angular/core';
import { Tono } from '../../utils/tono.util';

/**
 * Insignia (pildora) de estado o riesgo.
 *
 * Toma los colores de `--{tono}-fill` (fondo) y `--{tono}-text` (texto).
 * El texto es obligatorio y siempre visible: el significado nunca se
 * transmite solo con color.
 *
 * Uso: `<app-badge tono="rojo" texto="Alto" />`
 *
 * @author Elvis Flores
 */
@Component({
  selector: 'app-badge',
  templateUrl: './badge.component.html',
  styleUrl: './badge.component.scss'
})
export class BadgeComponent {
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
