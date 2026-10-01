import {
  ComponentFixture,
  TestBed,
  fakeAsync,
  tick
} from '@angular/core/testing';
import { LATENCIA_SIMULADA_MS } from '../../services/mock-data/simular-respuesta';
import { NOTIFICACIONES } from '../../services/mock-data/notificaciones.data';
import { esDeUltimosDias } from '../../utils/fechas.util';
import { NotificationBellComponent } from './notification-bell.component';

describe('NotificationBellComponent', () => {
  const RECIENTES = NOTIFICACIONES.filter((n) => esDeUltimosDias(n.fecha, 7));
  const NO_LEIDAS = RECIENTES.filter((n) => !n.leida).length;
  let fixture: ComponentFixture<NotificationBellComponent> | undefined;

  /**
   * @param selector Selector CSS.
   * @returns Elemento o `null`.
   */
  function buscar(selector: string): HTMLElement | null {
    return f().nativeElement.querySelector(selector);
  }

  /**
   * @returns El fixture del test actual (falla si no se creo).
   */
  function f(): ComponentFixture<NotificationBellComponent> {
    if (fixture === undefined) {
      throw new Error('Llamar a crear() antes');
    }
    return fixture;
  }

  /**
   * Crea el componente y espera la respuesta simulada.
   */
  function crear(): void {
    fixture = TestBed.createComponent(NotificationBellComponent);
    document.body.appendChild(fixture.nativeElement);
    fixture.detectChanges();
    tick(LATENCIA_SIMULADA_MS);
    fixture.detectChanges();
  }

  /**
   * Abre el panel.
   */
  function abrir(): void {
    buscar('.campana')?.click();
    f().detectChanges();
  }

  afterEach(() => {
    fixture?.nativeElement.remove();
    fixture = undefined;
  });

  it('los datos de ejemplo tienen no leídas recientes y antiguas', () => {
    expect(NO_LEIDAS).toBeGreaterThan(0);
    expect(RECIENTES.length).toBeLessThan(NOTIFICACIONES.length);
  });

  it('muestra el contador de no leídas', fakeAsync(() => {
    crear();
    expect(buscar('.contador')?.textContent?.trim()).toBe(String(NO_LEIDAS));
    expect(buscar('.campana')?.getAttribute('aria-label'))
      .toBe('Notificaciones, ' + NO_LEIDAS + ' sin leer');
  }));

  it('abre el panel con las notificaciones de los últimos 7 días', fakeAsync(() => {
    crear();
    abrir();
    expect(f().nativeElement.querySelectorAll('.notificacion').length)
      .toBe(RECIENTES.length);
    expect(f().nativeElement.querySelectorAll('.no-leida').length).toBe(NO_LEIDAS);
    expect(f().nativeElement.querySelectorAll('.punto[class*="punto--"]').length)
      .toBe(RECIENTES.length);
    expect(buscar('.panel-pie')?.textContent)
      .toContain('Se muestran las notificaciones de los últimos 7 días');
  }));

  it('«Marcar todas como leídas» deja el contador en cero', fakeAsync(() => {
    crear();
    abrir();
    buscar('.marcar')?.click();
    tick(LATENCIA_SIMULADA_MS * 2);
    f().detectChanges();
    expect(buscar('.contador')).toBeNull();
    expect(f().nativeElement.querySelectorAll('.no-leida').length).toBe(0);
    expect((buscar('.marcar') as HTMLButtonElement).disabled).toBeTrue();
  }));

  it('se cierra con clic fuera, no con clic dentro', fakeAsync(() => {
    crear();
    abrir();
    buscar('.panel')?.click();
    f().detectChanges();
    expect(buscar('.panel')).not.toBeNull();
    document.body.click();
    f().detectChanges();
    expect(buscar('.panel')).toBeNull();
  }));

  it('se cierra con Esc y devuelve el foco a la campana', fakeAsync(() => {
    crear();
    abrir();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    f().detectChanges();
    expect(buscar('.panel')).toBeNull();
    expect(document.activeElement).toBe(buscar('.campana'));
  }));
});
