import { Component, Input } from '@angular/core';

/**
 * Nombres de los iconos disponibles.
 */
export type NombreIcono =
  | 'ojo'
  | 'chevron-abajo'
  | 'descargar'
  | 'excel'
  | 'enviar'
  | 'check'
  | 'bandeja'
  | 'buscar'
  | 'analisis'
  | 'documento'
  | 'subir'
  | 'imprimir';

/**
 * Trazos SVG (viewBox 24x24, trazo de 2 px) de cada icono. Son los de la
 * coleccion Lucide/Feather (licencia ISC/MIT), el mismo estilo de iconos
 * en linea que ya usa la app host; asi no se agrega ninguna dependencia.
 */
const TRAZOS: Readonly<Record<NombreIcono, string>> = {
  ojo: 'M1 12s4-7 11-7 11 7 11 7-4 7-11 7S1 12 1 12z '
    + 'M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6z',
  'chevron-abajo': 'M6 9l6 6 6-6',
  descargar: 'M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4 M7 10l5 5 5-5 '
    + 'M12 15V3',
  excel: 'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z '
    + 'M14 2v6h6 M8 13l4 5 M12 13l-4 5',
  enviar: 'M22 2L11 13 M22 2l-7 20-4-9-9-4 20-7z',
  check: 'M20 6L9 17l-5-5',
  bandeja: 'M22 12h-6l-2 3h-4l-2-3H2 M5.45 5.11L2 12v6a2 2 0 0 0 2 2h16'
    + 'a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0'
    + '-1.79 1.11z',
  buscar: 'M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14z M21 21l-4.35-4.35',
  analisis: 'M3 3v18h18 M7 14l4-4 4 4 5-6',
  documento: 'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z '
    + 'M14 2v6h6 M9 13h6 M9 17h6',
  subir: 'M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4 M17 8l-5-5-5 5 M12 3v12',
  imprimir: 'M6 9V2h12v7 M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5'
    + 'a2 2 0 0 1-2 2h-2 M6 14h12v8H6z'
};

/**
 * Icono SVG en linea del modulo. Es decorativo (`aria-hidden`): el boton o
 * enlace que lo contiene debe llevar su propio texto o `aria-label`.
 *
 * DECISION: no se agrego una libreria de iconos. La app host ya dibuja sus
 * iconos como SVG en linea (estilo Feather) y el modulo necesita pocos; un
 * componente con los trazos evita una dependencia y mantiene el estilo.
 *
 * Uso: `<app-icono nombre="ojo" [tamano]="18" />`
 *
 * @author Elvis Flores
 */
@Component({
  selector: 'app-icono',
  template: `
    <svg [attr.width]="tamano" [attr.height]="tamano" viewBox="0 0 24 24"
      fill="none" stroke="currentColor" stroke-width="2"
      stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"
      focusable="false">
      <path [attr.d]="trazo" />
    </svg>
  `,
  styles: ':host { display: inline-flex; flex: 0 0 auto; }'
})
export class IconoComponent {
  /** Icono a dibujar. */
  @Input({ required: true }) nombre!: NombreIcono;

  /** Lado del icono en px. */
  @Input() tamano = 18;

  /**
   * @returns Trazo SVG del icono.
   */
  get trazo(): string {
    return TRAZOS[this.nombre];
  }
}
