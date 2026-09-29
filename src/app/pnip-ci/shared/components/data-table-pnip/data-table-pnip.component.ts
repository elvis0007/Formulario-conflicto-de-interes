import { NgTemplateOutlet } from '@angular/common';
import {
    Component,
    ContentChild,
    Input,
    OnChanges,
    SimpleChanges
} from '@angular/core';
import { DetallePnipDirective, FilaPnipDirective } from './plantillas-tabla';

/**
 * Cabecera de una columna de `DataTablePnipComponent`.
 */
export interface ColumnaTabla {
    /** Texto de la cabecera. */
    titulo: string;
    /** Ancho CSS opcional (p. ej. `110px`). */
    ancho?: string;
    /** Alineacion del titulo; izquierda por defecto. */
    alinear?: 'left' | 'center' | 'right';
}

/** Fila de la pagina actual, con lo que necesita la plantilla. */
interface FilaVista<T> {
    fila: T;
    clave: string;
    indice: number;
    alternar: () => void;
}

/** Contador para ids unicos de detalle entre varias tablas. */
let contadorTablas = 0;

/**
 * Tabla del modulo con paginacion simple y filas desplegables.
 *
 * No es una tabla configurable por datos: cada pantalla escribe sus celdas
 * en una plantilla, porque las columnas cambian mucho entre pantallas.
 *
 * - Cabeceras: `columnas` (`ColumnaTabla[]`).
 * - Celdas: `<ng-template pnipFila let-fila>` con los `<td>`.
 * - Detalle: `<ng-template pnipDetalle let-fila>` (opcional). La plantilla
 *   de fila recibe `expandida`, `alternar` e `idDetalle` para ponerle un
 *   `app-pnip-expand-arrow-button`.
 * - Lista vacia: se proyecta el contenido marcado con `pnipVacio`.
 * - Paginacion: «Mostrar [n] registros», «Página X de Y», Anterior y
 *   Siguiente, como en «Formularios recibidos» de la app host. Vuelve a la
 *   pagina 1 cada vez que cambian las filas (p. ej. al filtrar).
 * - `variante`: `surface` (cabecera gris, por defecto) o `navy` (azul
 *   marino `--navy-form`, pantallas de Formularios).
 *
 * @author Elvis Flores
 */
@Component({
    selector: 'app-pnip-data-table',
    imports: [NgTemplateOutlet],
    templateUrl: './data-table-pnip.component.html',
    styleUrl: './data-table-pnip.component.scss'
})
export class DataTablePnipComponent<T> implements OnChanges {
    /** Filas (ya filtradas) a mostrar. */
    @Input({ required: true }) filas: readonly T[] = [];

    /** Cabeceras de columna. */
    @Input({ required: true }) columnas: readonly ColumnaTabla[] = [];

    /** Color de la cabecera. */
    @Input() variante: 'surface' | 'navy' = 'surface';

    /**
     * Clave unica de cada fila, para recordar cuales estan desplegadas al
     * paginar o filtrar. Por defecto, su posicion en la lista.
     */
    @Input() claveFila: (fila: T, indice: number) => string =
        (_fila, indice) => String(indice);

    /** Nombre accesible de la tabla. */
    @Input() etiqueta = '';

    /** Opciones de «Mostrar n registros». */
    @Input() tamanosPagina: readonly number[] = [5, 10, 15];

    /** Registros por pagina. */
    @Input() tamanoPagina = 10;

    /** Plantilla de celdas. */
    @ContentChild(FilaPnipDirective) plantillaFila?: FilaPnipDirective<T>;

    /** Plantilla del detalle desplegable. */
    @ContentChild(DetallePnipDirective)
    plantillaDetalle?: DetallePnipDirective<T>;

    /** Pagina visible (desde 1). */
    paginaActual = 1;

    /** Filas de la pagina visible. */
    vista: FilaVista<T>[] = [];

    /** Claves de las filas desplegadas. */
    readonly expandidas = new Set<string>();

    /** Prefijo de ids de esta tabla. */
    private readonly prefijoId = 'pnip-tabla-' + (++contadorTablas);

    /**
     * @returns Numero de paginas (minimo 1).
     */
    get totalPaginas(): number {
        return Math.max(1, Math.ceil(this.filas.length / this.tamanoPagina));
    }

    /**
     * Vuelve a la primera pagina si cambian las filas o el tamano.
     *
     * @param cambios Cambios de inputs.
     */
    ngOnChanges(cambios: SimpleChanges): void {
        if (cambios['filas'] || cambios['tamanoPagina']) {
            this.paginaActual = 1;
        }
        this.actualizarVista();
    }

    /**
     * @param clave Clave de la fila.
     * @returns Id del `<tr>` de detalle de esa fila.
     */
    idDetalle(clave: string): string {
        return this.prefijoId + '-detalle-' + clave;
    }

    /**
     * Cambia los registros por pagina y vuelve a la primera.
     *
     * @param valor Valor elegido en el selector.
     */
    cambiarTamano(valor: string): void {
        const tamano = Number(valor);

        if (Number.isInteger(tamano) && tamano > 0) {
            this.tamanoPagina = tamano;
            this.paginaActual = 1;
            this.actualizarVista();
        }
    }

    /**
     * Va a la pagina anterior, si existe.
     */
    anterior(): void {
        if (this.paginaActual > 1) {
            this.paginaActual--;
            this.actualizarVista();
        }
    }

    /**
     * Va a la pagina siguiente, si existe.
     */
    siguiente(): void {
        if (this.paginaActual < this.totalPaginas) {
            this.paginaActual++;
            this.actualizarVista();
        }
    }

    /**
     * Despliega o recoge el detalle de una fila.
     *
     * @param clave Clave de la fila.
     */
    alternar(clave: string): void {
        if (this.expandidas.has(clave)) {
            this.expandidas.delete(clave);
        } else {
            this.expandidas.add(clave);
        }
    }

    /**
     * Calcula las filas de la pagina actual.
     */
    private actualizarVista(): void {
        const inicio = (this.paginaActual - 1) * this.tamanoPagina;

        this.vista = this.filas
            .slice(inicio, inicio + this.tamanoPagina)
            .map((fila, i) => {
                const indice = inicio + i;
                const clave = this.claveFila(fila, indice);

                return {
                    fila,
                    clave,
                    indice,
                    alternar: () => this.alternar(clave)
                };
            });
    }
}
