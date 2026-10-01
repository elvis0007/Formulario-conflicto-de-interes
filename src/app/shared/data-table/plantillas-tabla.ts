import { Directive, Input, TemplateRef, inject } from '@angular/core';

/**
 * Contexto que reciben las plantillas de fila y de detalle de
 * `DataTableComponent`.
 *
 * @author Elvis Flores
 */
export interface ContextoFilaTabla<T> {
  /** La fila (`let-fila`). */
  $implicit: T;
  /** Posicion de la fila en la lista completa (0 = primera). */
  indice: number;
  /** Si el detalle de la fila esta desplegado. */
  expandida: boolean;
  /** Despliega o recoge el detalle de la fila. */
  alternar: () => void;
  /** Id del `<tr>` de detalle, para `aria-controls`. */
  idDetalle: string;
}

/**
 * Marca la plantilla con las CELDAS (`<td>`) de cada fila.
 *
 * `appFilaDe` recibe la misma lista que la tabla y solo sirve para que el
 * compilador conozca el tipo de `let-fila`.
 *
 * Uso:
 * ```html
 * <ng-template appFila [appFilaDe]="lista" let-f let-alternar="alternar">
 *     <td>{{ f.nombre }}</td> ...
 * </ng-template>
 * ```
 *
 * @author Elvis Flores
 */
@Directive({
  selector: 'ng-template[appFila]'
})
export class FilaTablaDirective<T> {
  /** Lista de filas; solo para inferir el tipo. */
  @Input() appFilaDe: readonly T[] | null = null;

  /** Plantilla marcada. */
  readonly plantilla = inject<TemplateRef<ContextoFilaTabla<T>>>(TemplateRef);

  /**
   * Da tipo al contexto de la plantilla en `strictTemplates`.
   *
   * @param dir Directiva.
   * @param ctx Contexto.
   * @returns Siempre `true`.
   */
  static ngTemplateContextGuard<T>(
    dir: FilaTablaDirective<T>,
    ctx: unknown
  ): ctx is ContextoFilaTabla<T> {
    return true;
  }
}

/**
 * Marca la plantilla con el CONTENIDO del detalle desplegable de cada fila
 * (se pinta en un `<td colspan>` que ocupa toda la tabla).
 *
 * Uso:
 * ```html
 * <ng-template appDetalle [appDetalleDe]="lista" let-f>...</ng-template>
 * ```
 *
 * @author Elvis Flores
 */
@Directive({
  selector: 'ng-template[appDetalle]'
})
export class DetalleTablaDirective<T> {
  /** Lista de filas; solo para inferir el tipo. */
  @Input() appDetalleDe: readonly T[] | null = null;

  /** Plantilla marcada. */
  readonly plantilla = inject<TemplateRef<ContextoFilaTabla<T>>>(TemplateRef);

  /**
   * Da tipo al contexto de la plantilla en `strictTemplates`.
   *
   * @param dir Directiva.
   * @param ctx Contexto.
   * @returns Siempre `true`.
   */
  static ngTemplateContextGuard<T>(
    dir: DetalleTablaDirective<T>,
    ctx: unknown
  ): ctx is ContextoFilaTabla<T> {
    return true;
  }
}
