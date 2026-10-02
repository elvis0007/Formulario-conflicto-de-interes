import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { LATENCIA_GENERACION_MS } from '../services/analisis-mock.service';
import { LATENCIA_SIMULADA_MS } from '../services/mock-data/simular-respuesta';
import { AnalisisConflictoComponent } from './analisis-conflicto.component';

describe('AnalisisConflictoComponent', () => {
  let fixture: ComponentFixture<AnalisisConflictoComponent>;
  let raiz: HTMLElement;

  /**
   * @param texto Texto con espacios de la plantilla.
   * @returns El texto con los espacios normalizados.
   */
  function limpio(texto: string | null | undefined): string {
    return (texto ?? '').replace(/\s+/g, ' ').trim();
  }

  /**
   * @param selector Selector CSS de los botones.
   * @param texto Comienzo del texto del boton.
   * @returns El boton.
   */
  function boton(selector: string, texto: string): HTMLButtonElement {
    return Array.from(raiz.querySelectorAll<HTMLButtonElement>(selector))
      .find((b) => limpio(b.textContent).startsWith(texto)) as HTMLButtonElement;
  }

  /** @returns Textos de las pildoras de riesgo. */
  function pildoras(): string[] {
    return Array.from(raiz.querySelectorAll('app-pills button')).map((b) => limpio(b.textContent));
  }

  /** @returns Filas visibles de la tabla. */
  function filas(): HTMLTableRowElement[] {
    return Array.from(raiz.querySelectorAll<HTMLTableRowElement>('app-data-table tbody tr.fila'));
  }

  /** Crea la pantalla y espera la carga del analisis. */
  function crear(): void {
    fixture = TestBed.createComponent(AnalisisConflictoComponent);
    raiz = fixture.nativeElement;
    fixture.detectChanges();
    tick(LATENCIA_SIMULADA_MS);
    fixture.detectChanges();
  }

  /** Pulsa «Generar análisis» en el estado vacio y espera el resultado. */
  function generarDesdeVacio(): void {
    boton('app-empty-state button', 'Generar análisis').click();
    fixture.detectChanges();
    tick(LATENCIA_GENERACION_MS + LATENCIA_SIMULADA_MS);
    fixture.detectChanges();
  }

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [AnalisisConflictoComponent],
      providers: [provideRouter([])]
    });
  });

  it('sin análisis generado muestra el estado vacío con «Generar análisis»', fakeAsync(() => {
    crear();

    expect(limpio(raiz.querySelector('app-empty-state')?.textContent))
      .toBe('Aún no se ha generado un análisis Generar análisis');
    expect(raiz.querySelector('app-data-table')).toBeNull();
    expect(raiz.querySelector('.estado-analisis')).toBeNull();
    expect(boton('.acciones-encabezado button', 'Ver formularios')).toBeDefined();
  }));

  it('generar deja el análisis en Borrador y muestra la tabla', fakeAsync(() => {
    crear();
    boton('app-empty-state button', 'Generar análisis').click();
    fixture.detectChanges();
    expect(limpio(raiz.querySelector('app-empty-state button')?.textContent)).toBe('Generando…');

    tick(LATENCIA_GENERACION_MS + LATENCIA_SIMULADA_MS);
    fixture.detectChanges();

    expect(limpio(raiz.querySelector('.estado-analisis')?.textContent)).toBe('Borrador');
    expect(limpio(raiz.querySelector('.resumen')?.textContent))
      .toContain('3 casos pendientes de clasificar');
    expect(filas().length).withContext('5 por página').toBe(5);
    expect(limpio(raiz.querySelector('.pagina')?.textContent)).toBe('Página 1 de 2');
  }));

  it('mientras genera, el botón del encabezado queda deshabilitado', fakeAsync(() => {
    crear();
    generarDesdeVacio();

    const generar = boton('.acciones-encabezado button', 'Generar análisis');
    generar.click();
    fixture.detectChanges();

    const enCurso = boton('.acciones-encabezado button', 'Generando');
    expect(enCurso.disabled).toBeTrue();
    expect(enCurso.getAttribute('aria-busy')).toBe('true');

    tick(LATENCIA_GENERACION_MS + LATENCIA_SIMULADA_MS);
    fixture.detectChanges();
    expect(boton('.acciones-encabezado button', 'Generar análisis').disabled).toBeFalse();
  }));

  it('las píldoras cuentan sobre todos los casos y filtran la tabla', fakeAsync(() => {
    crear();
    generarDesdeVacio();
    const conteos = ['Todos (9)', 'Alto (2)', 'Moderado (3)', 'Bajo (3)', 'Ninguno (1)'];

    expect(pildoras()).toEqual(conteos);

    boton('app-pills button', 'Alto').click();
    fixture.detectChanges();

    expect(filas().length).toBe(2);
    expect(pildoras()).withContext('los conteos no cambian al filtrar').toEqual(conteos);
  }));

  it('vínculo simétrico: una etiqueta; roles distintos: uno bajo cada nombre', fakeAsync(() => {
    crear();
    generarDesdeVacio();
    const [hermanos, tioSobrino] = filas();

    expect(limpio(hermanos.querySelector('.rol--simetrico')?.textContent)).toBe('Hermanos');
    expect(hermanos.querySelector('.rol--a')).toBeNull();
    expect(tioSobrino.querySelector('.rol--simetrico')).toBeNull();
    expect(limpio(tioSobrino.querySelector('.rol--a')?.textContent)).toBe('Tío');
    expect(limpio(tioSobrino.querySelector('.rol--b')?.textContent)).toBe('Sobrino');
  }));

  it('muestra relación, grado, departamentos, riesgo, estado y planes', fakeAsync(() => {
    crear();
    generarDesdeVacio();
    const fila = filas()[1];
    const celdas = Array.from(fila.querySelectorAll('td')).map((td) => limpio(td.textContent));
    const departamentos = Array.from(fila.querySelectorAll('.departamento')).map((d) => limpio(d.textContent));

    expect(departamentos).toEqual(['Distribución', 'Distribución']);

    expect(celdas.slice(1)).toEqual([
      'Consanguinidad',
      '3er grado',
      'DistribuciónDistribución',
      'Moderado',
      'Conflicto confirmado',
      'Ver detalles',
      '1 plan'
    ]);
  }));

  it('las filas de homónimos se ven atenuadas', fakeAsync(() => {
    crear();
    generarDesdeVacio();
    boton('app-pills button', 'Ninguno').click();
    fixture.detectChanges();

    const [homonimo] = filas();
    expect(limpio(homonimo.textContent)).toContain('Homónimo');
    expect(Array.from(homonimo.querySelectorAll('td')).every((td) => td.classList.contains('archivada')))
      .toBeTrue();
  }));

  it('«Ver formularios» navega a /admin', fakeAsync(() => {
    crear();
    const navegar = spyOn(TestBed.inject(Router), 'navigate').and.resolveTo(true);

    boton('.acciones-encabezado button', 'Ver formularios').click();
    expect(navegar).toHaveBeenCalledWith(['/admin']);
  }));

  it('«Descargar Excel» solo confirma visualmente', fakeAsync(() => {
    crear();
    generarDesdeVacio();

    boton('.acciones-encabezado button', 'Descargar Excel').click();
    fixture.detectChanges();
    expect(boton('.acciones-encabezado button', 'Descargado ✓')).toBeDefined();

    tick(2000);
    fixture.detectChanges();
    expect(boton('.acciones-encabezado button', 'Descargar Excel')).toBeDefined();
  }));
});
