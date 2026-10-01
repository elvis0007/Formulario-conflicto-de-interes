import { ComponentFixture, TestBed } from '@angular/core/testing';
import { EmptyStateComponent } from './empty-state.component';

describe('EmptyStateComponent', () => {
    let fixture: ComponentFixture<EmptyStateComponent>;

    beforeEach(() => {
        fixture = TestBed.createComponent(EmptyStateComponent);
        fixture.componentRef.setInput('texto', 'No hay registros.');
        fixture.detectChanges();
    });

    it('muestra texto e icono, sin botón por defecto', () => {
        expect(fixture.nativeElement.textContent).toContain('No hay registros.');
        expect(fixture.nativeElement.querySelector('svg')).not.toBeNull();
        expect(fixture.nativeElement.querySelector('button')).toBeNull();
    });

    it('con textoAccion muestra el botón y emite accion', () => {
        let acciones = 0;

        fixture.componentInstance.accion.subscribe(() => acciones++);
        fixture.componentRef.setInput('textoAccion', 'Limpiar filtros');
        fixture.detectChanges();
        const boton: HTMLButtonElement =
            fixture.nativeElement.querySelector('button');

        expect(boton.textContent?.trim()).toBe('Limpiar filtros');
        boton.click();
        expect(acciones).toBe(1);
    });
});
