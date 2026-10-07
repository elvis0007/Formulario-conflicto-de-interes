import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { Conflicto, PlanAccion } from '../models';
import { ConflictosMockService } from '../services/conflictos-mock.service';
import { CONFLICTOS } from '../services/mock-data/conflictos.data';
import { PLANES } from '../services/mock-data/planes.data';
import { LATENCIA_SIMULADA_MS } from '../services/mock-data/simular-respuesta';
import { PlanesMockService } from '../services/planes-mock.service';
import { RELOJ } from '../utils/reloj';
import { GRUPOS_POR_PAGINA, InformeGeneralComponent } from './informe-general.component';

describe('InformeGeneralComponent', () => {
  const HOY = new Date(2026, 9, 2, 10, 0);
  let fixture: ComponentFixture<InformeGeneralComponent>;
  let raiz: HTMLElement;

  /**
   * @param texto Texto.
   * @returns Sin espacios repetidos.
   */
  function limpio(texto: string | null | undefined): string {
    return (texto ?? '').replace(/\s+/g, ' ').trim();
  }

  /** Crea la pantalla y espera la carga. */
  function crear(): void {
    fixture = TestBed.createComponent(InformeGeneralComponent);
    raiz = fixture.nativeElement;
    fixture.detectChanges();
    tick(LATENCIA_SIMULADA_MS);
    fixture.detectChanges();
  }

  /** @returns Conflictos visibles (filas de grupo). */
  function grupos(): string[] {
    return Array.from(raiz.querySelectorAll('tbody.grupo')).map((g) => g.getAttribute('data-conflicto') ?? '');
  }

  /**
   * @param conflictoId Conflicto.
   * @returns Filas de actividad visibles de su grupo.
   */
  function actividades(conflictoId: string): HTMLTableRowElement[] {
    return Array.from(raiz.querySelectorAll<HTMLTableRowElement>('tbody[data-conflicto="' + conflictoId + '"] tr.fila-actividad'));
  }

  /**
   * @param selector Selector del control.
   * @param valor Valor a poner.
   */
  function filtrar(selector: string, valor: string): void {
    const control = raiz.querySelector(selector) as HTMLInputElement | HTMLSelectElement;

    control.value = valor;
    control.dispatchEvent(new Event(control.tagName === 'SELECT' ? 'change' : 'input'));
    fixture.detectChanges();
  }

  /**
   * @param texto Texto del boton.
   */
  function pulsar(texto: string): void {
    Array.from(raiz.querySelectorAll('button')).find((b) => limpio(b.textContent).startsWith(texto))?.click();
    fixture.detectChanges();
  }

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [InformeGeneralComponent],
      providers: [provideRouter([]), { provide: RELOJ, useValue: () => new Date(HOY) }]
    });
  });

  it('encabezado con el código y «Descargar Excel» con confirmación', fakeAsync(() => {
    crear();

    expect(limpio(raiz.querySelector('.codigo')?.textContent)).toBe('PNIP.CI.RG.03');
    pulsar('Descargar Excel');
    expect(raiz.textContent).toContain('Descargado ✓');
    tick(3000);
    fixture.detectChanges();
    expect(raiz.textContent).toContain('Descargar Excel');
  }));

  it('agrupa por conflicto: fila de grupo y una fila por actividad del plan actual', fakeAsync(() => {
    crear();

    expect(grupos()).toEqual(['C-001', 'C-002', 'C-004', 'C-008']);
    const grupo = raiz.querySelector('tbody[data-conflicto="C-001"] .fila-grupo') as HTMLElement;
    expect(limpio(grupo.querySelector('.grupo-conflicto')?.textContent)).toBe('Conflicto #C-001');
    expect(grupo.querySelector('.grupo-conflicto')?.getAttribute('href')).toBe('/rrhh/conflictos/C-001/planes/PL-002');
    expect(limpio(grupo.querySelector('.grupo-personas')?.textContent))
      .toBe('Carlos Andrés Mayorga Sánchez · Jorge Luis Mayorga Sánchez');
    expect(limpio(grupo.querySelector('.grupo-riesgo')?.textContent)).toBe('Riesgo alto');
    expect(limpio(grupo.querySelector('.grupo-plan')?.textContent)).toBe('Plan 02 · Rotación del técnico de compras');
    expect(limpio(grupo.querySelector('.grupo-estado')?.textContent)).toBe('Activo · con vencidas');

    expect(actividades('C-001').length).toBe(7);
    const fila = Array.from(actividades('C-001')[0].children).map((td) => limpio(td.textContent));
    expect(fila).toEqual(['', 'Rotar al técnico a la unidad de bodega.', 'Carlos Andrés Mayorga Sánchez', '2 meses',
      '01/08/2026', 'Vencida', '—']);
    expect(actividades('C-001')[0].querySelector('.vencida')).not.toBeNull();
    const conEvidencia = actividades('C-001').find((tr) => tr.textContent?.includes('Presentar el informe')) as HTMLElement;
    expect(limpio(conEvidencia.lastElementChild?.textContent)).toBe('25/09/2026');
    expect(limpio(conEvidencia.querySelector('app-badge')?.textContent)).toBe('En revisión');
  }));

  it('filtros combinados y estado vacío', fakeAsync(() => {
    crear();

    filtrar('.filtro-estado', 'cerrado');
    expect(grupos()).toEqual(['C-004', 'C-008']);
    filtrar('.filtro-riesgo', 'medio');
    expect(grupos()).toEqual(['C-008']);
    filtrar('.filtro-texto', 'nadie se llama así');
    expect(grupos()).toEqual([]);
    expect(limpio(raiz.querySelector('app-empty-state')?.textContent)).toContain('Ningún plan de acción coincide');

    pulsar('Limpiar filtros');
    expect(grupos().length).toBe(4);
  }));

  it('el filtro de responsable muestra solo sus actividades', fakeAsync(() => {
    crear();

    filtrar('.filtro-responsable', 'EMP-010');
    expect(grupos()).toEqual(['C-001', 'C-002', 'C-008']);
    expect(actividades('C-001').map((tr) => limpio(tr.children[2].textContent)))
      .toEqual(Array(4).fill('Fernando José Andrade Vela'));
  }));

  it('contraer y expandir un grupo, y todos', fakeAsync(() => {
    crear();

    raiz.querySelector<HTMLButtonElement>('tbody[data-conflicto="C-002"] app-expand-arrow-button button')?.click();
    fixture.detectChanges();
    expect(actividades('C-002').length).toBe(0);
    expect(actividades('C-001').length).toBe(7);

    pulsar('Contraer todo');
    expect(grupos().every((id) => actividades(id).length === 0)).toBeTrue();
    pulsar('Expandir todo');
    expect(actividades('C-002').length).toBe(3);
  }));

  it('pagina por grupos, no por filas', fakeAsync(() => {
    const total = GRUPOS_POR_PAGINA + 2;
    const base = CONFLICTOS[0];
    const plan = PLANES.find((p) => p.id === 'PL-002') as PlanAccion;
    const conflictos: Conflicto[] = Array.from({ length: total }, (_, i) => ({ ...base, id: 'C-1' + String(i).padStart(2, '0') }));
    const planes: PlanAccion[] = conflictos.map((c, i) => ({ ...plan, id: 'PL-1' + i, conflictoId: c.id }));

    spyOn(TestBed.inject(ConflictosMockService), 'obtenerConflictos').and.returnValue(of(conflictos));
    spyOn(TestBed.inject(PlanesMockService), 'obtenerPlanes').and.returnValue(of(planes));
    crear();

    expect(grupos().length).toBe(GRUPOS_POR_PAGINA);
    expect(raiz.querySelectorAll('tr.fila-actividad').length).toBe(GRUPOS_POR_PAGINA * 7);
    expect(limpio(raiz.querySelector('.pagina')?.textContent)).toBe('Página 1 de 2');
    pulsar('Siguiente');
    expect(grupos()).toEqual(['C-105', 'C-106']);
  }));
});
