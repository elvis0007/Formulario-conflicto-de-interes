// [PNIP-CI DEV] Elvis Flores - 02/10/2026 - ELIMINAR ANTES DE PRODUCCIÓN
// Qué hace: pruebas del selector de rol de desarrollo. Se elimina con él.
import { TestBed } from '@angular/core/testing';
import { SelectorRolDevComponent } from './selector-rol-dev.component';

describe('SelectorRolDevComponent', () => {
  const CLAVES = ['SISCI-DEV-SESION-SIMULADA', 'SISCI-DEV-ROL', 'SISCI-DEV-EMPLEADO'];
  let guardadas: Record<string, string | null> = {};

  /**
   * Crea el selector (lee localStorage al crearse) sin recargar la página.
   *
   * @returns Elemento raíz y el espía de la recarga.
   */
  function crear(): { raiz: HTMLElement; recargar: jasmine.Spy } {
    const fixture = TestBed.createComponent(SelectorRolDevComponent);
    const recargar = spyOn(fixture.componentInstance, 'recargar');
    fixture.detectChanges();
    return { raiz: fixture.nativeElement, recargar };
  }

  /**
   * @param raiz Elemento raíz.
   * @param texto Texto del botón.
   * @returns El botón con ese texto.
   */
  function boton(raiz: HTMLElement, texto: string): HTMLButtonElement {
    return Array.from(raiz.querySelectorAll('button'))
      .find((b) => b.textContent?.trim() === texto) as HTMLButtonElement;
  }

  beforeEach(() => {
    guardadas = {};
    for (const c of CLAVES) {
      guardadas[c] = localStorage.getItem(c);
      localStorage.removeItem(c);
    }
  });

  afterEach(() => {
    for (const c of CLAVES) {
      const valor = guardadas[c];
      if (valor === null) {
        localStorage.removeItem(c);
      } else {
        localStorage.setItem(c, valor);
      }
    }
  });

  it('sin la sesión simulada no se pinta', () => {
    expect(crear().raiz.querySelector('.selector')).toBeNull();
  });

  it('con la sesión simulada muestra A, R, P, R+P y Salir, y marca el actual', () => {
    localStorage.setItem('SISCI-DEV-SESION-SIMULADA', 'true');
    localStorage.setItem('SISCI-DEV-ROL', 'P, R');
    const { raiz } = crear();

    expect(Array.from(raiz.querySelectorAll('.selector-rol')).map((b) => b.textContent?.trim()))
      .toEqual(['A', 'R', 'P', 'R+P']);
    expect(boton(raiz, 'R+P').getAttribute('aria-pressed')).toBe('true');
    expect(boton(raiz, 'R').getAttribute('aria-pressed')).toBe('false');
    expect(boton(raiz, 'Salir de la simulación')).toBeDefined();
  });

  it('sin SISCI-DEV-ROL marca R, el rol por defecto', () => {
    localStorage.setItem('SISCI-DEV-SESION-SIMULADA', 'true');
    expect(boton(crear().raiz, 'R').getAttribute('aria-pressed')).toBe('true');
  });

  it('elegir R+P guarda «R,P» y recarga', () => {
    localStorage.setItem('SISCI-DEV-SESION-SIMULADA', 'true');
    const { raiz, recargar } = crear();

    boton(raiz, 'R+P').click();
    expect(localStorage.getItem('SISCI-DEV-ROL')).toBe('R,P');
    expect(recargar).toHaveBeenCalled();
  });

  it('«Salir de la simulación» borra las claves SISCI-DEV-* y recarga', () => {
    localStorage.setItem('SISCI-DEV-SESION-SIMULADA', 'true');
    localStorage.setItem('SISCI-DEV-ROL', 'A');
    localStorage.setItem('SISCI-DEV-EMPLEADO', 'EMP-001');
    const { raiz, recargar } = crear();

    boton(raiz, 'Salir de la simulación').click();
    for (const c of CLAVES) {
      expect(localStorage.getItem(c)).toBeNull();
    }
    expect(recargar).toHaveBeenCalled();
  });
});
// [FIN PNIP-CI DEV]
