import {
    ComponentFixture,
    TestBed,
    fakeAsync,
    tick
} from '@angular/core/testing';
import { EXCUSAS } from '../../core/services/mock-data/excusas.data';
import {
    LATENCIA_SIMULADA_MS
} from '../../core/services/mock-data/simular-respuesta';
import { FormulariosExcusasComponent } from './formularios-excusas.component';

describe('FormulariosExcusasComponent', () => {
    let fixture: ComponentFixture<FormulariosExcusasComponent>;

    /**
     * @param selector Selector CSS.
     * @returns Elementos encontrados.
     */
    function todos(selector: string): HTMLElement[] {
        return Array.from(fixture.nativeElement.querySelectorAll(selector));
    }

    /**
     * Refresca la vista y deja pasar las respuestas simuladas.
     *
     * @param ms Tiempo a avanzar.
     */
    function avanzar(ms = LATENCIA_SIMULADA_MS): void {
        fixture.detectChanges();
        tick(ms);
        fixture.detectChanges();
    }

    beforeEach(fakeAsync(() => {
        fixture = TestBed.createComponent(FormulariosExcusasComponent);
        avanzar();
    }));

    afterEach(() => {
        fixture.destroy();
    });

    it('muestra la banda con el total y todas las excusas', () => {
        expect(fixture.nativeElement.querySelector('.banda').textContent)
            .toContain('Excusas recibidas (' + EXCUSAS.length + ')');
        expect(todos('tr.fila').length).toBe(EXCUSAS.length);
    });

    it('filtra por tipo de proceso del catálogo provisional',
        fakeAsync(() => {
            const select = todos('.filtros select')[1] as HTMLSelectElement;

            select.value = 'Proceso de compra';
            select.dispatchEvent(new Event('change'));
            avanzar(0);
            expect(todos('tr.fila').length).toBe(2);
        }));

    it('la flecha muestra motivo y reemplazo', fakeAsync(() => {
        todos('app-pnip-expand-arrow-button button')[0].click();
        avanzar(0);
        const detalle = todos('.fila-detalle')[0].textContent ?? '';

        expect(detalle).toContain(EXCUSAS[0].motivo);
        expect(detalle).toContain(EXCUSAS[0].reemplazo);
    }));

    it('el ojo abre el modal con la excusa completa', fakeAsync(() => {
        todos('.boton-icono')[0].click();
        avanzar(0);
        expect(fixture.nativeElement.querySelector('app-pnip-detalle-excusa')
            .textContent).toContain(EXCUSAS[0].detalleProceso);
    }));
});
