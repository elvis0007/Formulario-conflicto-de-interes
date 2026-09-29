import {
    ComponentFixture,
    TestBed,
    fakeAsync,
    tick
} from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import {
    EMPLEADOS_SIN_FORMULARIO,
    FORMULARIOS
} from '../../core/services/mock-data/formularios.data';
import {
    LATENCIA_SIMULADA_MS
} from '../../core/services/mock-data/simular-respuesta';
import {
    FormulariosConflictoInteresComponent
} from './formularios-conflicto-interes.component';

describe('FormulariosConflictoInteresComponent', () => {
    let fixture: ComponentFixture<FormulariosConflictoInteresComponent>;

    /**
     * @param selector Selector CSS.
     * @returns Elementos encontrados.
     */
    function todos(selector: string): HTMLElement[] {
        return Array.from(fixture.nativeElement.querySelectorAll(selector));
    }

    /**
     * @param selector Selector CSS.
     * @returns Primer elemento encontrado.
     */
    function uno(selector: string): HTMLElement {
        return fixture.nativeElement.querySelector(selector);
    }

    /**
     * @param texto Texto que contiene el boton.
     * @returns El boton.
     */
    function boton(texto: string): HTMLButtonElement {
        return todos('button').find((b) => b.textContent?.includes(texto)) as
            HTMLButtonElement;
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

    /**
     * @returns Filas de datos del panel de recibidos.
     */
    function filasRecibidos(): HTMLElement[] {
        return todos('#formularios-ci-panel-recibidos tr.fila');
    }

    /**
     * Cambia un select de filtro.
     *
     * @param indice Posicion del select en el panel de filtros.
     * @param valor Valor a elegir.
     */
    function elegir(indice: number, valor: string): void {
        const select = todos('.filtros select')[indice] as HTMLSelectElement;

        select.value = valor;
        select.dispatchEvent(new Event('change'));
        avanzar(0);
    }

    beforeEach(fakeAsync(() => {
        TestBed.configureTestingModule({ providers: [provideRouter([])] });
        fixture = TestBed.createComponent(FormulariosConflictoInteresComponent);
        avanzar();
    }));

    afterEach(() => {
        fixture.destroy();
    });

    it('muestra encabezado, código y el enlace para generar el análisis',
        () => {
            expect(uno('.titulo').textContent)
                .toContain('Formulario de Conflicto de Interés');
            expect(uno('.codigo').textContent).toContain('PNIP.CI.RG.01');
            expect(uno('a.boton').getAttribute('href'))
                .toBe('/pnip/rrhh/conflictos/analisis');
        });

    it('lista los formularios con nombre formal y cabecera navy', () => {
        expect(filasRecibidos().length).toBe(FORMULARIOS.length);
        expect(uno('.banda').textContent)
            .toContain('(' + FORMULARIOS.length + ')');
        expect(filasRecibidos()[0].textContent)
            .toContain('MAYORGA SÁNCHEZ CARLOS ANDRÉS');
        expect(todos('.tabla--navy').length).toBeGreaterThan(0);
    });

    it('combina filtros y permite limpiarlos', fakeAsync(() => {
        elegir(0, 'Externo');
        expect(filasRecibidos().length).toBe(1);
        elegir(1, 'Permanente');
        expect(filasRecibidos().length).toBe(0);
        boton('Limpiar filtros').click();
        avanzar(0);
        expect(filasRecibidos().length).toBe(FORMULARIOS.length);
    }));

    it('Exportar muestra «Exportado ✓» dos segundos', fakeAsync(() => {
        boton('Exportar').click();
        fixture.detectChanges();
        expect(boton('Exportado ✓')).toBeDefined();
        tick(2000);
        fixture.detectChanges();
        expect(boton('Exportado ✓')).toBeUndefined();
    }));

    it('la flecha despliega los familiares en la fila', fakeAsync(() => {
        const flecha = uno('app-pnip-expand-arrow-button button');

        flecha.click();
        avanzar(0);
        expect(todos('.fila-detalle app-pnip-tabla-familiares').length)
            .toBe(1);
        expect(uno('.fila-detalle').textContent)
            .toContain('Jorge Luis Mayorga Sánchez');
    }));

    it('el ojo abre el modal con el formulario completo', fakeAsync(() => {
        (todos('.boton-icono')[0]).click();
        avanzar(0);
        expect(uno('[role=dialog]')).not.toBeNull();
        expect(uno('app-pnip-detalle-formulario').textContent)
            .toContain(FORMULARIOS[0].correo);
        boton('Descargar PDF').click();
        fixture.detectChanges();
        expect(boton('PDF descargado ✓')).toBeDefined();
        tick(2000);
    }));

    it('la pestaña de pendientes muestra el contador y envía recordatorios',
        fakeAsync(() => {
            const total = EMPLEADOS_SIN_FORMULARIO.length;

            expect(todos('[role=tab]')[1].textContent)
                .toContain('(' + total + ')');
            (todos('[role=tab]')[1]).click();
            avanzar(0);
            expect(todos('#formularios-ci-panel-pendientes tr.fila').length)
                .toBe(total);
            expect(uno('#formularios-ci-panel-pendientes').textContent)
                .toContain('Nunca');

            todos('#formularios-ci-panel-pendientes .boton--fila')[0].click();
            avanzar();
            expect(todos('#formularios-ci-panel-pendientes .boton--hecho')
                .length).toBe(1);

            boton('Enviar recordatorio a todos').click();
            avanzar();
            expect(boton('Enviado a todos ✓')).toBeDefined();
            expect(uno('#formularios-ci-panel-pendientes').textContent)
                .not.toContain('Nunca');
        }));
});
