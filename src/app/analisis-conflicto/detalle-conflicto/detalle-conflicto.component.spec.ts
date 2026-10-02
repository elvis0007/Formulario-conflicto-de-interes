import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { Conflicto } from '../../models';
import { CONFLICTOS } from '../../services/mock-data/conflictos.data';
import { ClasificacionElegida, DetalleConflictoComponent } from './detalle-conflicto.component';

describe('DetalleConflictoComponent', () => {
  let fixture: ComponentFixture<DetalleConflictoComponent>;
  let raiz: HTMLElement;

  /**
   * @param texto Texto con espacios.
   * @returns El texto normalizado.
   */
  function limpio(texto: string | null | undefined): string {
    return (texto ?? '').replace(/\s+/g, ' ').trim();
  }

  /**
   * Crea el componente para un caso de ejemplo.
   *
   * @param id Id del conflicto.
   * @param editable Si se puede clasificar.
   */
  function crear(id: string, editable = true): void {
    const conflicto = structuredClone(CONFLICTOS.find((c) => c.id === id) as Conflicto);

    fixture = TestBed.createComponent(DetalleConflictoComponent);
    raiz = fixture.nativeElement;
    fixture.componentRef.setInput('conflicto', conflicto);
    fixture.componentRef.setInput('editable', editable);
    fixture.detectChanges();
    tick();
    fixture.detectChanges();
  }

  /**
   * @param indice 0 (persona A) o 1 (persona B).
   * @returns Los datos de su tarjeta como «Etiqueta: valor».
   */
  function datosPersona(indice: number): string[] {
    return Array.from(raiz.querySelectorAll('.persona')[indice].querySelectorAll('.persona-dato'))
      .map((d) => limpio(d.querySelector('dt')?.textContent) + ': ' + limpio(d.querySelector('dd')?.textContent));
  }

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [DetalleConflictoComponent] });
  });

  it('muestra la franja de parentesco, relación y grado', fakeAsync(() => {
    crear('C-002');

    expect(Array.from(raiz.querySelectorAll('.franja dd')).map((d) => limpio(d.textContent)))
      .toEqual(['Tío – Sobrino', 'Consanguinidad', '3er grado']);
  }));

  it('cónyuges: parentesco simétrico y grado «No aplica»', fakeAsync(() => {
    crear('C-009');

    expect(Array.from(raiz.querySelectorAll('.franja dd')).map((d) => limpio(d.textContent)))
      .toEqual(['Cónyuges', 'Afinidad', 'No aplica']);
  }));

  it('una tarjeta por persona, con «—» en los datos que faltan', fakeAsync(() => {
    crear('C-005');

    expect(datosPersona(1)).toEqual([
      'Cédula: 1800000102',
      'Cargo: Ingeniero de Sistemas',
      'Departamento: Tecnologías de la Información',
      'Jefe inmediato: —',
      'Fecha de ingreso: 23/11/2015',
      'Padre: —',
      'Madre: —',
      'Cónyuge: María José Pérez López'
    ]);
  }));

  it('muestra el riesgo identificado y cómo se detectó', fakeAsync(() => {
    crear('C-001');

    expect(limpio(raiz.querySelector('.motivo')?.textContent)).toContain('Relación jerárquica directa');
    expect(raiz.querySelectorAll('.evidencias li').length).toBe(2);
  }));

  it('editable: tres tarjetas, la actual elegida, y guarda lo elegido', fakeAsync(() => {
    crear('C-005');
    const emitidos: ClasificacionElegida[] = [];
    fixture.componentInstance.guardar.subscribe((e) => emitidos.push(e));

    const opciones = Array.from(raiz.querySelectorAll<HTMLInputElement>('.opcion input[type=radio]'));
    expect(opciones.length).toBe(3);
    expect(opciones[0].checked).withContext('el caso está pendiente').toBeTrue();

    opciones[1].click();
    const textarea = raiz.querySelector('textarea') as HTMLTextAreaElement;
    textarea.value = '  Confirmado.  ';
    textarea.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    (Array.from(raiz.querySelectorAll('button')).find((b) => limpio(b.textContent) === 'Guardar clasificación') as HTMLButtonElement)
      .click();

    expect(emitidos).toEqual([{ clasificacion: 'confirmado', observacion: 'Confirmado.' }]);
  }));

  it('«Cancelar» emite cancelar', fakeAsync(() => {
    crear('C-005');
    let cancelado = false;
    fixture.componentInstance.cancelar.subscribe(() => cancelado = true);

    (Array.from(raiz.querySelectorAll('button')).find((b) => limpio(b.textContent) === 'Cancelar') as HTMLButtonElement)
      .click();
    expect(cancelado).toBeTrue();
  }));

  it('solo lectura: la opción elegida y la observación, sin radios ni guardar', fakeAsync(() => {
    crear('C-001', false);

    expect(raiz.querySelectorAll('input[type=radio]').length).toBe(0);
    expect(raiz.querySelector('.botones')).toBeNull();
    expect(limpio(raiz.querySelector('.opcion--lectura .opcion-titulo')?.textContent))
      .toBe('Conflicto confirmado');
    expect(limpio(raiz.querySelector('.observacion-lectura')?.textContent))
      .toBe('Observación: Sin observación.');
  }));
});
