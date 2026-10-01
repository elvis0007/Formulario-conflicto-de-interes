import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import {
    ExpandArrowButtonComponent
} from '../expand-arrow-button/expand-arrow-button.component';
import { ColumnaTabla, DataTableComponent } from './data-table.component';
import { DetalleTablaDirective, FilaTablaDirective } from './plantillas-tabla';

/** Fila de prueba. */
interface Item {
    id: string;
    nombre: string;
}

/**
 * @param n Cantidad de filas.
 * @returns Filas `I-1`..`I-n`.
 */
function crearItems(n: number): Item[] {
    return Array.from({ length: n }, (_v, i) => ({
        id: 'I-' + (i + 1),
        nombre: 'Nombre ' + (i + 1)
    }));
}

/** Anfitrion que usa la tabla como lo haria una pantalla. */
@Component({
    imports: [
        DataTableComponent,
        FilaTablaDirective,
        DetalleTablaDirective,
        ExpandArrowButtonComponent
    ],
    template: `
        <app-data-table [filas]="items" [columnas]="columnas"
            [variante]="variante" [claveFila]="clave">
            <ng-template appFila [appFilaDe]="items" let-item
                let-expandida="expandida" let-alternar="alternar"
                let-idDetalle="idDetalle">
                <td class="celda-nombre">{{ item.nombre }}</td>
                <td>
                    <app-expand-arrow-button [expandido]="expandida"
                        [controla]="idDetalle" (alternar)="alternar()" />
                </td>
            </ng-template>
            <ng-template appDetalle [appDetalleDe]="items" let-item>
                <p class="detalle">Detalle de {{ item.nombre }}</p>
            </ng-template>
            <p appVacio class="sin-datos">Sin datos</p>
        </app-data-table>
    `
})
class AnfitrionComponent {
    items: Item[] = crearItems(12);
    variante: 'surface' | 'navy' = 'surface';
    readonly columnas: ColumnaTabla[] = [
        { titulo: 'Nombre' },
        { titulo: 'Acciones', ancho: '90px', alinear: 'center' }
    ];
    readonly clave = (item: Item): string => item.id;
}

describe('DataTableComponent', () => {
    let fixture: ComponentFixture<AnfitrionComponent>;

    /**
     * @param selector Selector CSS.
     * @returns Elementos encontrados.
     */
    function todos(selector: string): HTMLElement[] {
        return Array.from(fixture.nativeElement.querySelectorAll(selector));
    }

    /**
     * @returns Texto de «Página X de Y».
     */
    function pagina(): string {
        const texto: string =
            fixture.nativeElement.querySelector('.pagina').textContent;

        return texto.trim();
    }

    /**
     * @param texto Texto del boton de paginacion.
     */
    function pulsar(texto: string): void {
        todos('.boton-pagina').find((b) => b.textContent?.includes(texto))
            ?.click();
        fixture.detectChanges();
    }

    beforeEach(() => {
        fixture = TestBed.createComponent(AnfitrionComponent);
        fixture.detectChanges();
    });

    it('pinta cabeceras y celdas desde la plantilla', () => {
        expect(todos('th').map((th) => th.textContent?.trim()))
            .toEqual(['Nombre', 'Acciones']);
        expect(todos('th')[1].style.width).toBe('90px');
        expect(todos('.celda-nombre')[0].textContent).toContain('Nombre 1');
    });

    it('pagina de 10 en 10 por defecto', () => {
        expect(todos('.celda-nombre').length).toBe(10);
        expect(pagina()).toBe('Página 1 de 2');
        pulsar('Siguiente');
        expect(todos('.celda-nombre').length).toBe(2);
        expect(pagina()).toBe('Página 2 de 2');
        pulsar('Anterior');
        expect(pagina()).toBe('Página 1 de 2');
    });

    it('deshabilita Anterior en la primera y Siguiente en la última', () => {
        const [anterior, siguiente] = todos('.boton-pagina') as
            HTMLButtonElement[];

        expect(anterior.disabled).toBeTrue();
        pulsar('Siguiente');
        expect(siguiente.disabled).toBeTrue();
    });

    it('cambia los registros por página', () => {
        const select = fixture.nativeElement.querySelector('select');

        select.value = '5';
        select.dispatchEvent(new Event('change'));
        fixture.detectChanges();
        expect(todos('.celda-nombre').length).toBe(5);
        expect(pagina()).toBe('Página 1 de 3');
    });

    it('vuelve a la página 1 cuando cambian las filas (filtros)', () => {
        pulsar('Siguiente');
        fixture.componentInstance.items = crearItems(11);
        fixture.detectChanges();
        expect(pagina()).toBe('Página 1 de 2');
    });

    it('despliega y recoge el detalle de una fila', () => {
        const flecha = (): HTMLButtonElement =>
            fixture.nativeElement.querySelector('app-expand-arrow-button '
                + 'button');

        expect(todos('.detalle').length).toBe(0);
        flecha().click();
        fixture.detectChanges();
        expect(todos('.detalle').map((d) => d.textContent?.trim()))
            .toEqual(['Detalle de Nombre 1']);
        expect(todos('.fila-detalle td')[0].getAttribute('colspan')).toBe('2');
        expect(flecha().getAttribute('aria-controls'))
            .toBe(todos('.fila-detalle')[0].id);
        flecha().click();
        fixture.detectChanges();
        expect(todos('.detalle').length).toBe(0);
    });

    it('alterna el fondo de las filas pares', () => {
        const filas = todos('tr.fila');

        expect(filas[0].classList).not.toContain('fila--par');
        expect(filas[1].classList).toContain('fila--par');
    });

    it('variante navy', () => {
        expect(todos('.tabla--navy').length).toBe(0);
        fixture.componentInstance.variante = 'navy';
        fixture.detectChanges();
        expect(todos('.tabla--navy').length).toBe(1);
    });

    it('sin filas muestra el contenido appVacio y «Página 1 de 1»', () => {
        expect(todos('.sin-datos').length).toBe(0);
        fixture.componentInstance.items = [];
        fixture.detectChanges();
        expect(todos('.sin-datos').length).toBe(1);
        expect(pagina()).toBe('Página 1 de 1');
    });
});
