import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Pestana, TabsComponent } from './tabs.component';

describe('TabsComponent', () => {
  const PESTANAS: Pestana[] = [
    { valor: 'a', etiqueta: 'Recibidos' },
    { valor: 'b', etiqueta: 'Pendientes', contador: 4 },
    { valor: 'c', etiqueta: 'Cerrado', atenuada: true, insignia: { texto: 'Cerrado', tono: 'verde' } }
  ];
  let fixture: ComponentFixture<TabsComponent>;
  let emitidos: string[] = [];

  /**
   * @returns Botones de las pestanas.
   */
  function pestanas(): HTMLButtonElement[] {
    return Array.from(fixture.nativeElement.querySelectorAll('[role=tab]'));
  }

  /**
   * @param indice Pestana sobre la que se pulsa.
   * @param key Tecla.
   */
  function tecla(indice: number, key: string): void {
    pestanas()[indice].dispatchEvent(
      new KeyboardEvent('keydown', { key, bubbles: true })
    );
  }

  beforeEach(() => {
    emitidos = [];
    fixture = TestBed.createComponent(TabsComponent);
    fixture.componentRef.setInput('pestanas', PESTANAS);
    fixture.componentRef.setInput('seleccionada', 'a');
    fixture.componentRef.setInput('idBase', 'prueba');
    fixture.componentInstance.cambio.subscribe((v) => emitidos.push(v));
    document.body.appendChild(fixture.nativeElement);
    fixture.detectChanges();
  });

  afterEach(() => {
    fixture.nativeElement.remove();
  });

  it('marca la activa con aria-selected y tabindex 0', () => {
    const [a, b] = pestanas();

    expect(a.getAttribute('aria-selected')).toBe('true');
    expect(a.getAttribute('tabindex')).toBe('0');
    expect(b.getAttribute('aria-selected')).toBe('false');
    expect(b.getAttribute('tabindex')).toBe('-1');
    expect(a.getAttribute('aria-controls')).toBe('prueba-panel-a');
    expect(a.id).toBe('prueba-pestana-a');
  });

  it('muestra el contador y atenúa la marcada', () => {
    expect(pestanas()[1].textContent?.trim()).toBe('Pendientes (4)');
    expect(pestanas()[2].classList).toContain('pestana--atenuada');
  });

  it('muestra la insignia de la pestaña que la tiene', () => {
    expect(pestanas()[2].querySelector('app-badge')?.textContent?.trim()).toBe('Cerrado');
    expect(pestanas()[0].querySelector('app-badge')).toBeNull();
  });

  it('emite al hacer clic en otra pestaña', () => {
    pestanas()[1].click();
    pestanas()[0].click();
    expect(emitidos).toEqual(['b']);
  });

  it('flechas, Inicio y Fin mueven el foco y emiten', () => {
    tecla(0, 'ArrowRight');
    expect(document.activeElement).toBe(pestanas()[1]);
    tecla(0, 'ArrowLeft');
    tecla(0, 'End');
    tecla(2, 'Home');
    expect(emitidos).toEqual(['b', 'c', 'c']);
  });
});
