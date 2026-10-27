import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { ActivatedRoute, ParamMap, Router, convertToParamMap, provideRouter } from '@angular/router';
import { BehaviorSubject, of } from 'rxjs';
import { Conflicto, PlanAccion } from '../models';
import { ConflictosMockService } from '../services/conflictos-mock.service';
import { CONFLICTOS } from '../services/mock-data/conflictos.data';
import { PLANES } from '../services/mock-data/planes.data';
import { LATENCIA_SIMULADA_MS } from '../services/mock-data/simular-respuesta';
import { PlanesMockService } from '../services/planes-mock.service';
import { ReportesMockService } from '../services/reportes-mock.service';
import { RELOJ } from '../utils/reloj';
import { GRUPOS_POR_PAGINA, InformeGeneralComponent } from './informe-general.component';

describe('InformeGeneralComponent', () => {
  const HOY = new Date(2026, 9, 2, 10, 0);
  let fixture: ComponentFixture<InformeGeneralComponent>;
  let raiz: HTMLElement;
  let consulta: BehaviorSubject<ParamMap>;

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

  /** @returns Conflictos visibles. */
  function grupos(): string[] {
    return Array.from(raiz.querySelectorAll('tbody.grupo')).map((g) => g.getAttribute('data-conflicto') ?? '');
  }

  /**
   * @param conflictoId Conflicto.
   * @returns Su fila de grupo.
   */
  function fila(conflictoId: string): HTMLElement {
    return raiz.querySelector('tbody[data-conflicto="' + conflictoId + '"] .fila-grupo') as HTMLElement;
  }

  /** @param conflictoId Conflicto a desplegar o plegar. */
  function alternar(conflictoId: string): void {
    fila(conflictoId).querySelector<HTMLButtonElement>('app-expand-arrow-button button')?.click();
    fixture.detectChanges();
  }

  /**
   * @param conflictoId Conflicto.
   * @returns Sus bloques de plan visibles.
   */
  function bloques(conflictoId: string): HTMLElement[] {
    return Array.from(raiz.querySelectorAll<HTMLElement>('tbody[data-conflicto="' + conflictoId + '"] .bloque-plan'));
  }

  /**
   * @param texto Comienzo del texto del boton.
   */
  function pulsar(texto: string): void {
    Array.from(raiz.querySelectorAll('button')).find((b) => limpio(b.textContent).startsWith(texto))?.click();
    fixture.detectChanges();
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

  beforeEach(() => {
    consulta = new BehaviorSubject(convertToParamMap({}));
    TestBed.configureTestingModule({
      imports: [InformeGeneralComponent],
      providers: [
        provideRouter([]),
        { provide: ActivatedRoute, useValue: { snapshot: { get queryParamMap() { return consulta.value; } } } },
        { provide: RELOJ, useValue: () => new Date(HOY) }
      ]
    });
  });

  it('encabezado con el código y «Descargar Excel» (RG.03): sin backend avisa', fakeAsync(() => {
    crear();
    const reportes = TestBed.inject(ReportesMockService);

    spyOn(reportes, 'descargarReporte').and.callThrough();
    expect(limpio(raiz.querySelector('.codigo')?.textContent)).toBe('PNIP.CI.RG.03');
    pulsar('Descargar Excel');
    expect(reportes.descargarReporte).toHaveBeenCalledOnceWith('RG.03', {});
    expect(raiz.textContent).toContain('Disponible con sesión real');
    tick(4000);
  }));

  it('el Excel lleva la píldora de estado y el riesgo como filtros del backend', fakeAsync(() => {
    crear();
    const componente = fixture.componentInstance;

    componente.filtros = { ...componente.filtros, estado: 'en-ejecucion', riesgo: 'ALTO' };
    expect(componente.filtroExcel).toEqual({ riesgo: 'ALTO', estado: 'EN_EJECUCION' });
    componente.filtros = { ...componente.filtros, estado: 'con-vencidas', riesgo: '' };
    expect(componente.filtroExcel).toEqual({ vencido: true });
    componente.filtros = { ...componente.filtros, estado: 'cerrados' };
    expect(componente.filtroExcel).toEqual({ estado: 'FINALIZADO' });
  }));

  it('columnas de la §6.7 y fila de grupo de un conflicto con dos planes', fakeAsync(() => {
    crear();

    expect(Array.from(raiz.querySelectorAll('.tabla > thead th')).slice(1).map((th) => limpio(th.textContent)))
      .toEqual(['Conflicto', 'Empleado / Familiar', 'Parentesco', 'Riesgo', 'Planes', 'Avance', 'Estado']);
    const f = fila('C-001');
    expect(limpio(f.querySelector('.grupo-conflicto')?.textContent)).toBe('#C-001');
    expect(f.querySelector('.grupo-conflicto')?.getAttribute('href')).toBe('/rrhh/conflictos/C-001/planes/PL-002');
    expect(Array.from(f.querySelectorAll('.persona')).map((p) => limpio(p.textContent)))
      .toEqual(['Carlos Andrés Mayorga Sánchez', 'Jorge Luis Mayorga Sánchez']);
    expect(limpio(f.querySelector('.grupo-parentesco')?.textContent)).toBe('Hermanos · Consanguinidad, 2do grado');
    expect(limpio(f.querySelector('.grupo-riesgo')?.textContent)).toBe('Alto');
    expect(limpio(f.querySelector('.grupo-planes')?.textContent)).toBe('2 planes');
    expect(limpio(f.querySelector('.grupo-estado')?.textContent)).toBe('Activo · con vencidas');
    expect(limpio(f.querySelector('.grupo-seguimiento')?.textContent))
      .withContext('estado de seguimiento del conflicto').toBe('En ejecución');
  }));

  it('barra de avance: un segmento por actividad del plan actual, con tooltip y texto accesible', fakeAsync(() => {
    crear();

    const barra = fila('C-001').querySelector('app-barra-avance') as HTMLElement;
    const segmentos = Array.from(barra.querySelectorAll<HTMLElement>('.segmento'));
    expect(segmentos.length).toBe(7);
    expect(barra.querySelector('.barra')?.getAttribute('aria-label')).toBe('1 de 7 cumplidas');
    expect(segmentos[0].getAttribute('title')).toBe('Rotar al técnico a la unidad de bodega. · Vencida');
    expect(segmentos[0].classList).toContain('segmento--rojo');
    expect(segmentos[1].classList).toContain('segmento--verde');
  }));

  it('al desplegar: un bloque por CADA plan con su cabecera y su tabla', fakeAsync(() => {
    crear();
    expect(bloques('C-001').length).withContext('plegado por defecto').toBe(0);

    alternar('C-001');
    const [pl1, pl2] = bloques('C-001');
    expect(bloques('C-001').length).toBe(2);
    expect(Array.from(pl1.querySelector('.bloque-cabecera')?.children ?? []).map((c) => limpio(c.textContent)))
      .toEqual(['Plan 01 · Separación de funciones en compras', 'Cerrado · Cumplido', 'Inicio: 03/11/2025', '2 de 2 cumplidas']);
    expect(limpio(pl2.querySelector('.bloque-titulo')?.textContent)).toBe('Plan 02 · Rotación del técnico de compras');
    expect(Array.from(pl2.querySelectorAll('.tabla-actividades th')).map((th) => limpio(th.textContent)))
      .toEqual(['Actividad', 'Responsable', 'Plazo', 'Fecha límite', 'Estado']);
    expect(pl2.querySelectorAll('.fila-actividad').length).toBe(7);
    const vencida = pl2.querySelector('.fila-actividad') as HTMLElement;
    expect(Array.from(vencida.children).map((td) => limpio(td.textContent)))
      .toEqual(['Rotar al técnico a la unidad de bodega.', 'Carlos Andrés Mayorga Sánchez', '2 meses', '01/08/2026', 'Vencida']);
    expect(vencida.querySelector('.vencida')).not.toBeNull();

    alternar('C-001');
    expect(bloques('C-001').length).toBe(0);
  }));

  it('filtros: píldoras de estado con conteos, riesgo, responsable y buscador combinados', fakeAsync(() => {
    crear();
    const navegar = spyOn(TestBed.inject(Router), 'navigate').and.resolveTo(true);

    expect(Array.from(raiz.querySelectorAll('app-pills button')).map((b) => limpio(b.textContent)))
      .toEqual(['Todos (4)', 'En ejecución (2)', 'Con vencidas (1)', 'Cerrados (2)']);
    pulsar('Cerrados');
    expect(grupos()).toEqual(['C-004', 'C-008']);
    expect(navegar).toHaveBeenCalledWith([], jasmine.objectContaining({ queryParams: { estado: 'cerrados' } }));
    filtrar('.filtro-riesgo', 'MEDIO');
    expect(grupos()).toEqual(['C-008']);
    filtrar('.filtro-texto', 'nadie se llama así');
    expect(limpio(raiz.querySelector('app-empty-state')?.textContent)).toContain('Ningún plan de acción coincide');
    pulsar('Limpiar filtros');
    expect(grupos().length).toBe(4);

    filtrar('.filtro-responsable', 'EMP-001');
    expect(grupos()).toEqual(['C-001']);
    alternar('C-001');
    expect(bloques('C-001').map((b) => b.querySelectorAll('.fila-actividad').length)).toEqual([1, 2]);
  }));

  it('abre con el estado de la URL (clic del dashboard)', fakeAsync(() => {
    consulta.next(convertToParamMap({ estado: 'con-vencidas' }));
    crear();

    expect(grupos()).toEqual(['C-001']);
    expect(raiz.querySelector('app-pills button[aria-pressed="true"]')?.textContent).toContain('Con vencidas');
  }));

  it('expandir y contraer todo', fakeAsync(() => {
    crear();

    pulsar('Expandir todo');
    expect(grupos().every((id) => bloques(id).length > 0)).toBeTrue();
    pulsar('Contraer todo');
    expect(raiz.querySelectorAll('.bloque-plan').length).toBe(0);
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
    expect(limpio(raiz.querySelector('.pagina')?.textContent)).toBe('Página 1 de 2');
    pulsar('Siguiente');
    expect(grupos()).toEqual(['C-105', 'C-106']);
  }));
});
