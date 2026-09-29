import { ComponentFixture, TestBed } from '@angular/core/testing';
import { BadgePnipComponent } from './badge-pnip.component';

describe('BadgePnipComponent', () => {
    let fixture: ComponentFixture<BadgePnipComponent>;

    /**
     * @returns Elemento de la pildora.
     */
    function pildora(): HTMLElement {
        return fixture.nativeElement.querySelector('.badge');
    }

    beforeEach(() => {
        fixture = TestBed.createComponent(BadgePnipComponent);
        fixture.componentRef.setInput('tono', 'rojo');
        fixture.componentRef.setInput('texto', 'Alto');
        fixture.detectChanges();
    });

    it('muestra siempre el texto', () => {
        expect(pildora().textContent?.trim()).toBe('Alto');
    });

    it('arma las variables de color con el tono', () => {
        expect(pildora().style.backgroundColor).toBe('var(--rojo-fill)');
        expect(pildora().style.color).toBe('var(--rojo-text)');
    });

    it('cambia de color al cambiar el tono', () => {
        fixture.componentRef.setInput('tono', 'verde');
        fixture.detectChanges();
        expect(pildora().style.backgroundColor).toBe('var(--verde-fill)');
    });
});
