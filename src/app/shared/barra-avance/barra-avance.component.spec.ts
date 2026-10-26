import { TestBed } from '@angular/core/testing';
import { Actividad } from '../../models';
import { RELOJ } from '../../utils/reloj';
import { BarraAvanceComponent } from './barra-avance.component';

describe('BarraAvanceComponent', () => {
  const HOY = new Date(2026, 9, 2, 10, 0);

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [{ provide: RELOJ, useValue: () => new Date(HOY) }] });
  });

  /**
   * @param id Id.
   * @param estado Estado.
   * @returns Actividad de prueba.
   */
  function act(id: string, estado: Actividad['estado'], fechaLimite?: string): Actividad {
    return {
      id, descripcion: 'Actividad ' + id, responsableId: 'E', responsableNombre: 'E',
      plazoMeses: 1, plazoDias: 0, estado, fechaLimite
    };
  }

  /**
   * @param actividades Actividades.
   * @param vistaResponsable Vista del Responsable.
   * @returns El elemento renderizado.
   */
  function crear(actividades: Actividad[], vistaResponsable = false): HTMLElement {
    const fixture = TestBed.createComponent(BarraAvanceComponent);

    fixture.componentRef.setInput('actividades', actividades);
    fixture.componentRef.setInput('vistaResponsable', vistaResponsable);
    fixture.detectChanges();
    return fixture.nativeElement;
  }

  it('un segmento por actividad, coloreado por estado, con tooltip y texto accesible', () => {
    const raiz = crear([act('1', 'ACEPTADA'), act('2', 'PENDIENTE', '2026-09-01'), act('3', 'EN_REVISION')]);
    const segmentos = Array.from(raiz.querySelectorAll('.segmento'));

    expect(segmentos.map((s) => s.className.replace('segmento ', ''))).toEqual(['segmento--verde', 'segmento--rojo', 'segmento--gris']);
    expect(segmentos[1].getAttribute('title')).toBe('Actividad 2 · Vencida');
    expect(raiz.querySelector('.barra')?.getAttribute('role')).toBe('img');
    expect(raiz.querySelector('.barra')?.getAttribute('aria-label')).toBe('1 de 3 cumplidas');
    expect(raiz.querySelector('.texto')?.textContent?.trim()).toBe('1 de 3 cumplidas');
  });

  it('en la vista del Responsable una vencida se muestra como Pendiente', () => {
    const raiz = crear([act('1', 'PENDIENTE', '2026-09-01')], true);

    expect(raiz.querySelector('.segmento')?.getAttribute('title')).toBe('Actividad 1 · Pendiente');
    expect(raiz.querySelector('.segmento')?.classList).toContain('segmento--ambar');
  });

  it('sin actividades', () => {
    const raiz = crear([]);

    expect(raiz.querySelector('.barra')?.getAttribute('aria-label')).toBe('Sin actividades');
    expect(raiz.querySelector('.segmento--vacio')).not.toBeNull();
  });
});
