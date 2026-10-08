import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { ActivatedRoute, ParamMap, convertToParamMap } from '@angular/router';
import { BehaviorSubject } from 'rxjs';
import { LATENCIA_SIMULADA_MS } from '../services/mock-data/simular-respuesta';
import { PlanesMockService } from '../services/planes-mock.service';
import { PerfilUsuarioFalso, proveerPerfilFalso } from '../testing/perfil-usuario-falso';
import { RELOJ } from '../utils/reloj';
import { HistorialComponent } from './historial.component';

describe('HistorialComponent', () => {
  const HOY = new Date(2026, 9, 2, 10, 0);
  let fixture: ComponentFixture<HistorialComponent>;
  let raiz: HTMLElement;
  let consulta: BehaviorSubject<ParamMap>;

  /**
   * @param texto Texto.
   * @returns Sin espacios repetidos.
   */
  function limpio(texto: string | null | undefined): string {
    return (texto ?? '').replace(/\s+/g, ' ').trim();
  }

  /** Espera las respuestas simuladas y refresca. */
  function esperar(): void {
    tick(LATENCIA_SIMULADA_MS * 3);
    fixture.detectChanges();
  }

  /** Crea la pantalla. */
  function crear(): void {
    fixture = TestBed.createComponent(HistorialComponent);
    raiz = fixture.nativeElement;
    document.body.appendChild(raiz);
    fixture.detectChanges();
    esperar();
  }

  /** @returns Ids de las tarjetas visibles. */
  function tarjetas(): string[] {
    return Array.from(raiz.querySelectorAll('.tarjeta')).map((t) => t.getAttribute('data-conflicto') ?? '');
  }

  /**
   * @param id Conflicto cuya tarjeta se pulsa.
   */
  function abrir(id: string): void {
    raiz.querySelector<HTMLButtonElement>('.tarjeta[data-conflicto="' + id + '"]')?.click();
    fixture.detectChanges();
    esperar();
  }

  /**
   * @param selector Nodo.
   * @returns Textos de sus eventos visibles (propios, no de sus hijos).
   */
  function eventos(selector: string): string[] {
    const nodo = raiz.querySelector(selector) as HTMLElement;
    const lista = Array.from(nodo.children).flatMap((hijo) =>
      hijo.classList.contains('nodo-cuerpo') ? Array.from(hijo.children) : [hijo])
      .find((hijo) => hijo.classList.contains('eventos'));

    return lista ? Array.from(lista.querySelectorAll('.evento-texto')).map((e) => limpio(e.textContent)) : [];
  }

  /**
   * @param texto Comienzo del texto del boton.
   */
  function pulsar(texto: string): void {
    Array.from(raiz.querySelectorAll('button')).find((b) => limpio(b.textContent).startsWith(texto))?.click();
    fixture.detectChanges();
  }

  beforeEach(() => {
    consulta = new BehaviorSubject(convertToParamMap({}));
    TestBed.configureTestingModule({
      imports: [HistorialComponent],
      providers: [
        { provide: ActivatedRoute, useValue: { snapshot: { get queryParamMap() { return consulta.value; } } } },
        { provide: RELOJ, useValue: () => new Date(HOY) },
        proveerPerfilFalso(new PerfilUsuarioFalso(['rrhh'], 'EMP-008', 'Lucía Alejandra Freire Ortiz'))
      ]
    });
  });

  afterEach(() => raiz?.remove());

  it('una tarjeta por conflicto con número, estado, personas, parentesco, riesgo, planes y detección', fakeAsync(() => {
    crear();

    expect(tarjetas().length).toBe(9);
    const t = raiz.querySelector('.tarjeta[data-conflicto="C-001"]') as HTMLElement;
    expect([
      limpio(t.querySelector('.tarjeta-id')?.textContent),
      limpio(t.querySelector('.tarjeta-estado')?.textContent),
      limpio(t.querySelector('.tarjeta-personas')?.textContent),
      limpio(t.querySelector('.tarjeta-parentesco')?.textContent),
      limpio(t.querySelector('.tarjeta-riesgo')?.textContent),
      limpio(t.querySelector('.tarjeta-planes')?.textContent),
      limpio(t.querySelector('.tarjeta-deteccion')?.textContent)
    ]).toEqual([
      'Conflicto #C-001', 'Activo', 'Carlos Andrés Mayorga Sánchez · Jorge Luis Mayorga Sánchez',
      'Hermanos · Consanguinidad, 2do grado', 'Riesgo alto', '2 planes', 'Detectado el 14/10/2025'
    ]);
    expect(limpio(raiz.querySelector('.tarjeta[data-conflicto="C-006"] .tarjeta-estado')?.textContent)).toBe('Archivado');
    expect(limpio(raiz.querySelector('.tarjeta[data-conflicto="C-003"] .tarjeta-estado')?.textContent)).toBe('Plan en borrador');
  }));

  it('filtros Todos / Activos / Cerrados y buscador', fakeAsync(() => {
    crear();

    expect(Array.from(raiz.querySelectorAll('.barra-filtros app-pills button')).map((b) => limpio(b.textContent)))
      .toEqual(['Todos (9)', 'Activos (2)', 'Cerrados (1)']);
    pulsar('Activos');
    expect(tarjetas()).toEqual(['C-001', 'C-002']);
    pulsar('Cerrados');
    expect(tarjetas()).toEqual(['C-004']);
    pulsar('Todos');
    const buscador = raiz.querySelector('.buscador') as HTMLInputElement;
    buscador.value = 'tamayo';
    buscador.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    expect(tarjetas()).toEqual(['C-002', 'C-008']);
  }));

  it('el modal muestra el árbol de un conflicto con varios planes: el actual abierto', fakeAsync(() => {
    crear();
    abrir('C-001');

    expect(limpio(raiz.querySelector('.dialogo .titulo')?.textContent)).toBe('Historial · Conflicto #C-001');
    expect(eventos('.nodo--conflicto')[0]).toContain('Conflicto detectado: Hermanos');
    expect(raiz.querySelectorAll('.nodo--plan').length).toBe(2);
    expect(eventos('[data-plan="PL-001"]')).toEqual([]);
    expect(eventos('[data-plan="PL-002"]')).toContain('Plan enviado y notificado a 3 responsables.');
    expect(raiz.querySelectorAll('[data-plan="PL-002"] .nodo--actividad').length).toBe(7);
  }));

  it('expandir y contraer todo, y desplegar un nivel', fakeAsync(() => {
    crear();
    abrir('C-001');

    raiz.querySelector<HTMLButtonElement>('[data-actividad="A-003"] app-expand-arrow-button button')?.click();
    fixture.detectChanges();
    expect(eventos('[data-actividad="A-003"]')).toContain('Venció sin evidencia aprobada.');
    pulsar('Expandir todo');
    expect(eventos('[data-plan="PL-001"]')).toContain('Plan cerrado: todas las actividades fueron aprobadas.');
    pulsar('Contraer todo');
    expect(raiz.querySelectorAll('.eventos').length).toBe(0);
  }));

  it('filtro por tipo dentro del modal y punto de color', fakeAsync(() => {
    crear();
    abrir('C-001');
    pulsar('Expandir todo');

    expect(raiz.querySelector('.nodo--conflicto .evento .punto')?.classList).toContain('punto--azul');
    pulsar('Rechazos');
    const tipos = Array.from(raiz.querySelectorAll('.evento')).map((e) => e.getAttribute('data-tipo'));
    expect(tipos.length).toBeGreaterThan(0);
    expect(tipos.every((t) => t === 'rechazo')).toBeTrue();
  }));

  it('«Descargar PDF» confirma y el modal se cierra', fakeAsync(() => {
    crear();
    abrir('C-002');

    pulsar('Descargar PDF');
    expect(raiz.textContent).toContain('Descargado ✓');
    raiz.querySelector<HTMLButtonElement>('.boton-cerrar')?.click();
    fixture.detectChanges();
    expect(raiz.querySelector('.dialogo')).toBeNull();
    tick(3000);
  }));

  it('lo hecho en otra pantalla aparece al volver a abrir el conflicto', fakeAsync(() => {
    crear();
    abrir('C-002');
    expect(eventos('[data-plan="PL-003"]')).not.toContain('Plan cerrado: todas las actividades fueron aprobadas.');
    raiz.querySelector<HTMLButtonElement>('.boton-cerrar')?.click();
    fixture.detectChanges();

    TestBed.inject(PlanesMockService).aprobarEvidencia('PL-003', 'A-008').subscribe();
    tick(LATENCIA_SIMULADA_MS * 2);
    abrir('C-002');
    expect(eventos('[data-plan="PL-003"]')).toContain('Plan cerrado: todas las actividades fueron aprobadas.');
  }));

  it('?conflicto= abre directamente su árbol (enlaces del dashboard)', fakeAsync(() => {
    consulta.next(convertToParamMap({ conflicto: 'C-004' }));
    crear();

    expect(limpio(raiz.querySelector('.dialogo .titulo')?.textContent)).toBe('Historial · Conflicto #C-004');
  }));
});
