import { ComponentFixture, TestBed } from '@angular/core/testing';
import { OpcionPill, PillsComponent } from './pills.component';

describe('PillsComponent', () => {
    const OPCIONES: OpcionPill[] = [
        { valor: 'todos', etiqueta: 'Todos', contador: 12 },
        { valor: 'alto', etiqueta: 'Alto', contador: 3, tono: 'rojo' },
        { valor: 'sin', etiqueta: 'Sin contador' }
    ];
    let fixture: ComponentFixture<PillsComponent>;
    let emitidos: string[] = [];

    /**
     * @returns Botones de las pildoras.
     */
    function pildoras(): HTMLButtonElement[] {
        return Array.from(fixture.nativeElement.querySelectorAll('.pill'));
    }

    beforeEach(() => {
        emitidos = [];
        fixture = TestBed.createComponent(PillsComponent);
        fixture.componentRef.setInput('opciones', OPCIONES);
        fixture.componentRef.setInput('seleccionado', 'alto');
        fixture.componentInstance.cambio.subscribe((v) => emitidos.push(v));
        fixture.detectChanges();
    });

    it('muestra etiqueta y contador', () => {
        expect(pildoras().map((p) => p.textContent?.trim()))
            .toEqual(['Todos (12)', 'Alto (3)', 'Sin contador']);
    });

    it('resalta la seleccionada con el fondo sólido de su tono', () => {
        const [todos, alto] = pildoras();

        expect(alto.getAttribute('aria-pressed')).toBe('true');
        expect(alto.style.backgroundColor).toBe('var(--rojo)');
        expect(todos.getAttribute('aria-pressed')).toBe('false');
        expect(todos.style.backgroundColor).toBe('');
    });

    it('sin tono, la seleccionada usa azul', () => {
        fixture.componentRef.setInput('seleccionado', 'todos');
        fixture.detectChanges();
        expect(pildoras()[0].style.backgroundColor).toBe('var(--azul)');
    });

    it('emite el valor al elegir otra opción, no al repetir', () => {
        pildoras()[0].click();
        pildoras()[1].click();
        expect(emitidos).toEqual(['todos']);
    });
});
