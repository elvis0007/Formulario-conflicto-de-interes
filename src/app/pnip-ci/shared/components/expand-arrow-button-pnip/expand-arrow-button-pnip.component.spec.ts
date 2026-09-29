import { ComponentFixture, TestBed } from '@angular/core/testing';
import {
    ExpandArrowButtonPnipComponent
} from './expand-arrow-button-pnip.component';

describe('ExpandArrowButtonPnipComponent', () => {
    let fixture: ComponentFixture<ExpandArrowButtonPnipComponent>;
    let pulsaciones = 0;

    /**
     * @returns Boton del componente.
     */
    function boton(): HTMLButtonElement {
        return fixture.nativeElement.querySelector('button');
    }

    beforeEach(() => {
        pulsaciones = 0;
        fixture = TestBed.createComponent(ExpandArrowButtonPnipComponent);
        fixture.componentRef.setInput('etiqueta', 'familiares');
        fixture.componentInstance.alternar.subscribe(() => pulsaciones++);
        fixture.detectChanges();
    });

    it('contraído: aria-expanded false y etiqueta «Mostrar»', () => {
        expect(boton().getAttribute('aria-expanded')).toBe('false');
        expect(boton().getAttribute('aria-label')).toBe('Mostrar familiares');
        expect(boton().classList).not.toContain('boton--expandido');
    });

    it('expandido: aria-expanded true, etiqueta «Ocultar» y flecha rotada',
        () => {
            fixture.componentRef.setInput('expandido', true);
            fixture.detectChanges();
            expect(boton().getAttribute('aria-expanded')).toBe('true');
            expect(boton().getAttribute('aria-label'))
                .toBe('Ocultar familiares');
            expect(boton().classList).toContain('boton--expandido');
        });

    it('emite alternar al pulsar', () => {
        boton().click();
        expect(pulsaciones).toBe(1);
    });

    it('aria-controls solo si se indica', () => {
        expect(boton().hasAttribute('aria-controls')).toBeFalse();
        fixture.componentRef.setInput('controla', 'detalle-1');
        fixture.detectChanges();
        expect(boton().getAttribute('aria-controls')).toBe('detalle-1');
    });
});
