import { ComponentFixture, TestBed } from '@angular/core/testing';
import { EmptyStatePnipComponent } from './empty-state-pnip.component';

describe('EmptyStatePnipComponent', () => {
    let fixture: ComponentFixture<EmptyStatePnipComponent>;

    beforeEach(() => {
        fixture = TestBed.createComponent(EmptyStatePnipComponent);
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
