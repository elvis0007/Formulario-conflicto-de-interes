import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { LATENCIA_SIMULADA_MS } from '../services/mock-data/simular-respuesta';
import { PlanesMockService } from '../services/planes-mock.service';
import { PerfilUsuarioFalso, proveerPerfilFalso } from '../testing/perfil-usuario-falso';
import { RELOJ } from '../utils/reloj';
import { HistorialComponent } from './historial.component';

describe('HistorialComponent', () => {
  const HOY = new Date(2026, 9, 2, 10, 0);
  let fixture: ComponentFixture<HistorialComponent>;
  let raiz: HTMLElement;

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

  /** Crea la pantalla (elige el primer conflicto). */
  function crear(): void {
    fixture = TestBed.createComponent(HistorialComponent);
    raiz = fixture.nativeElement;
    fixture.detectChanges();
    esperar();
  }

  /**
   * @param id Conflicto a elegir en el selector.
   */
  function elegir(id: string): void {
    Array.from(raiz.querySelectorAll<HTMLButtonElement>('.opcion-conflicto'))
      .find((b) => b.textContent?.includes('Conflicto #' + id))?.click();
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
   * @param texto Texto del boton.
   */
  function pulsar(texto: string): void {
    Array.from(raiz.querySelectorAll('button')).find((b) => limpio(b.textContent).startsWith(texto))?.click();
    fixture.detectChanges();
  }

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HistorialComponent],
      providers: [
        { provide: RELOJ, useValue: () => new Date(HOY) },
        proveerPerfilFalso(new PerfilUsuarioFalso(['rrhh'], 'EMP-008', 'Lucía Alejandra Freire Ortiz'))
      ]
    });
  });

  it('selector buscable: filtra por número o nombre', fakeAsync(() => {
    crear();
    const buscador = raiz.querySelector('.buscador') as HTMLInputElement;

    expect(raiz.querySelectorAll('.opcion-conflicto').length).toBe(9);
    buscador.value = 'tamayo';
    buscador.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    expect(Array.from(raiz.querySelectorAll('.opcion-id')).map((o) => limpio(o.textContent)))
      .toEqual(['Conflicto #C-002', 'Conflicto #C-008']);
  }));

  it('por defecto: eventos del conflicto y su plan actual abiertos; el plan anterior y las actividades, cerrados', fakeAsync(() => {
    crear();

    expect(limpio(raiz.querySelector('.caso-id')?.textContent)).toBe('Conflicto #C-001');
    expect(eventos('.nodo--conflicto')[0]).toContain('Conflicto detectado: Hermanos');
    expect(eventos('[data-plan="PL-002"]')).toContain('Plan enviado y notificado a 3 responsables.');
    expect(eventos('[data-plan="PL-001"]')).toEqual([]);
    expect(raiz.querySelector('[data-plan="PL-001"] .actividades')).toBeNull();
    expect(raiz.querySelectorAll('[data-plan="PL-002"] .nodo--actividad').length).toBe(7);
    expect(eventos('[data-actividad="A-003"]')).toEqual([]);
  }));

  it('cada nivel se despliega y pliega; expandir y contraer todo', fakeAsync(() => {
    crear();

    raiz.querySelector<HTMLButtonElement>('[data-actividad="A-003"] app-expand-arrow-button button')?.click();
    fixture.detectChanges();
    expect(eventos('[data-actividad="A-003"]')).toContain('Venció sin evidencia aprobada.');

    raiz.querySelector<HTMLButtonElement>('[data-plan="PL-002"] > .nodo-cabecera app-expand-arrow-button button')?.click();
    fixture.detectChanges();
    expect(raiz.querySelector('[data-plan="PL-002"] .nodo-cuerpo')).toBeNull();

    pulsar('Expandir todo');
    expect(eventos('[data-plan="PL-001"]')).toContain('Plan cerrado: todas las actividades fueron aprobadas.');
    expect(eventos('[data-actividad="A-001"]').length).toBeGreaterThan(0);
    pulsar('Contraer todo');
    expect(raiz.querySelectorAll('.eventos').length).toBe(0);
  }));

  it('cada evento: punto de color por tipo, texto y «fecha · autor»', fakeAsync(() => {
    crear();

    const evento = raiz.querySelector('.nodo--conflicto .evento') as HTMLElement;
    expect(evento.querySelector('.punto')?.classList).toContain('punto--azul');
    expect(limpio(evento.querySelector('.evento-meta')?.textContent)).toBe('14 de octubre de 2025 · Sistema');
  }));

  it('filtro por tipo, con conteos', fakeAsync(() => {
    crear();
    pulsar('Expandir todo');

    pulsar('Rechazos');
    const visibles = Array.from(raiz.querySelectorAll('.evento')).map((e) => e.getAttribute('data-tipo'));
    expect(visibles.length).toBeGreaterThan(0);
    expect(visibles.every((t) => t === 'rechazo')).toBeTrue();
    expect(limpio(Array.from(raiz.querySelectorAll('app-pills button')).map((b) => b.textContent).join('|')))
      .toContain('Rechazos (' + visibles.length + ')');
  }));

  it('lo hecho en otra pantalla aparece al volver a elegir el conflicto', fakeAsync(() => {
    crear();
    elegir('C-002');
    expect(eventos('[data-plan="PL-003"]')).not.toContain('Plan cerrado: todas las actividades fueron aprobadas.');

    TestBed.inject(PlanesMockService).aprobarEvidencia('PL-003', 'A-008').subscribe();
    tick(LATENCIA_SIMULADA_MS * 2);
    elegir('C-001');
    elegir('C-002');
    expect(eventos('[data-plan="PL-003"]')).toContain('Plan cerrado: todas las actividades fueron aprobadas.');
  }));

  it('«Descargar PDF» confirma sin archivo', fakeAsync(() => {
    crear();

    pulsar('Descargar PDF');
    expect(raiz.textContent).toContain('Descargado ✓');
    tick(3000);
  }));
});
