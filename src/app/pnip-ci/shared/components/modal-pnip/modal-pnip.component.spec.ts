import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ModalPnipComponent } from './modal-pnip.component';

/** Anfitrion de prueba con contenido proyectado y un boton que lo abre. */
@Component({
    imports: [ModalPnipComponent],
    template: `
        <button id="abrir" (click)="abierto = true">Abrir</button>
        <app-pnip-modal titulo="Prueba" [abierto]="abierto"
            (cerrar)="cierres = cierres + 1; abierto = false">
            <p id="contenido">Cuerpo</p>
            <button id="primero">Uno</button>
            <button id="ultimo">Dos</button>
        </app-pnip-modal>
    `
})
class AnfitrionComponent {
    abierto = false;
    cierres = 0;
}

describe('ModalPnipComponent', () => {
    let fixture: ComponentFixture<AnfitrionComponent>;
    let anfitrion: AnfitrionComponent;

    /**
     * @param selector Selector CSS.
     * @returns Elemento encontrado o `null`.
     */
    function buscar(selector: string): HTMLElement | null {
        return fixture.nativeElement.querySelector(selector);
    }

    /**
     * Abre el modal pulsando el boton del anfitrion.
     */
    function abrir(): void {
        const boton = buscar('#abrir') as HTMLElement;

        boton.focus();
        boton.click();
        fixture.detectChanges();
    }

    /**
     * @param destino Elemento sobre el que se hace el clic.
     */
    function clicCompleto(destino: HTMLElement): void {
        destino.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
        destino.dispatchEvent(new MouseEvent('click', { bubbles: true }));
        fixture.detectChanges();
    }

    /**
     * @param shiftKey Si se simula Shift+Tab.
     */
    function tab(shiftKey = false): void {
        buscar('.dialogo')?.dispatchEvent(new KeyboardEvent('keydown', {
            key: 'Tab', shiftKey, bubbles: true, cancelable: true
        }));
    }

    beforeEach(() => {
        fixture = TestBed.createComponent(AnfitrionComponent);
        anfitrion = fixture.componentInstance;
        document.body.appendChild(fixture.nativeElement);
        fixture.detectChanges();
    });

    afterEach(() => {
        fixture.nativeElement.remove();
    });

    it('cerrado no pinta nada', () => {
        expect(buscar('.fondo')).toBeNull();
    });

    it('abierto muestra título, contenido proyectado y rol dialog', () => {
        abrir();
        expect(buscar('.titulo')?.textContent).toContain('Prueba');
        expect(buscar('#contenido')).not.toBeNull();
        expect(buscar('.dialogo')?.getAttribute('role')).toBe('dialog');
        expect(buscar('.dialogo')?.getAttribute('aria-modal')).toBe('true');
    });

    it('al abrir mueve el foco al diálogo', () => {
        abrir();
        expect(document.activeElement).toBe(buscar('.dialogo'));
    });

    it('se cierra con la X', () => {
        abrir();
        buscar('.boton-cerrar')?.click();
        fixture.detectChanges();
        expect(anfitrion.cierres).toBe(1);
        expect(buscar('.fondo')).toBeNull();
    });

    it('se cierra con clic en el fondo, no en el contenido', () => {
        abrir();
        clicCompleto(buscar('#contenido') as HTMLElement);
        expect(anfitrion.cierres).toBe(0);
        clicCompleto(buscar('.fondo') as HTMLElement);
        expect(anfitrion.cierres).toBe(1);
    });

    it('se cierra con Esc solo si está abierto', () => {
        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
        expect(anfitrion.cierres).toBe(0);
        abrir();
        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
        fixture.detectChanges();
        expect(anfitrion.cierres).toBe(1);
    });

    it('al cerrar devuelve el foco al botón que lo abrió', () => {
        abrir();
        buscar('.boton-cerrar')?.click();
        fixture.detectChanges();
        expect(document.activeElement).toBe(buscar('#abrir'));
    });

    it('atrapa el foco con Tab y Shift+Tab', () => {
        abrir();
        (buscar('#ultimo') as HTMLElement).focus();
        tab();
        expect(document.activeElement).toBe(buscar('.boton-cerrar'));
        tab(true);
        expect(document.activeElement).toBe(buscar('#ultimo'));
    });
});
