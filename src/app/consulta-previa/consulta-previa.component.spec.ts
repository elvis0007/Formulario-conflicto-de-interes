import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { LATENCIA_SIMULADA_MS } from '../services/mock-data/simular-respuesta';
import { ERROR_CEDULA, ERROR_DATOS_MINIMOS } from '../utils/consulta-previa.util';
import { RELOJ } from '../utils/reloj';
import { AVISO_INFORMATIVO, ConsultaPreviaComponent } from './consulta-previa.component';

describe('ConsultaPreviaComponent', () => {
  const HOY = new Date(2026, 9, 2, 10, 0);
  let fixture: ComponentFixture<ConsultaPreviaComponent>;
  let raiz: HTMLElement;

  /**
   * @param texto Texto.
   * @returns Sin espacios repetidos.
   */
  function limpio(texto: string | null | undefined): string {
    return (texto ?? '').replace(/\s+/g, ' ').trim();
  }

  /** Crea la pantalla. */
  function crear(): void {
    fixture = TestBed.createComponent(ConsultaPreviaComponent);
    raiz = fixture.nativeElement;
    fixture.detectChanges();
    tick(LATENCIA_SIMULADA_MS);
    fixture.detectChanges();
  }

  /**
   * Escribe y pulsa «Consultar».
   *
   * @param cedula Cedula.
   * @param nombres Nombres.
   * @param apellidos Apellidos.
   */
  function consultar(cedula: string, nombres: string, apellidos: string): void {
    const valores: Record<string, string> = { cedula, nombres, apellidos };

    for (const [campo, valor] of Object.entries(valores)) {
      const input = raiz.querySelector('[formcontrolname="' + campo + '"]') as HTMLInputElement;
      input.value = valor;
      input.dispatchEvent(new Event('input'));
    }
    (raiz.querySelector('form') as HTMLFormElement).dispatchEvent(new Event('submit'));
    fixture.detectChanges();
    tick(LATENCIA_SIMULADA_MS * 2);
    fixture.detectChanges();
  }

  /** @returns Errores visibles. */
  function errores(): string[] {
    return Array.from(raiz.querySelectorAll('.error')).map((e) => limpio(e.textContent));
  }

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [ConsultaPreviaComponent],
      providers: [{ provide: RELOJ, useValue: () => new Date(HOY) }]
    });
  });

  it('muestra el aviso informativo y el estado inicial', fakeAsync(() => {
    crear();

    expect(limpio(raiz.querySelector('.aviso')?.textContent)).toBe(AVISO_INFORMATIVO);
    expect(limpio(raiz.querySelector('app-empty-state')?.textContent)).toContain('Aún no se ha consultado');
    expect(raiz.querySelector('.recientes')).toBeNull();
  }));

  it('exige la cédula o nombres y apellidos, y valida los 10 dígitos', fakeAsync(() => {
    crear();

    consultar('', 'Ana', '');
    expect(errores()).toEqual([ERROR_DATOS_MINIMOS]);
    consultar('12345', '', '');
    expect(errores()).toEqual([ERROR_CEDULA]);
    expect(raiz.querySelector('.coincidencia')).toBeNull();
  }));

  it('con coincidencias: una tarjeta por empleado con su riesgo', fakeAsync(() => {
    crear();

    consultar('1800000318', 'Fausto', 'Tamayo Guevara');
    const tarjetas = Array.from(raiz.querySelectorAll('.coincidencia')).map((c) => [
      limpio(c.querySelector('.coincidencia-nombre')?.textContent),
      limpio(c.querySelector('.coincidencia-cargo')?.textContent),
      limpio(c.querySelector('.coincidencia-parentesco')?.textContent),
      limpio(c.querySelector('.coincidencia-grado')?.textContent),
      limpio(c.querySelector('app-badge')?.textContent)
    ]);

    expect(limpio(raiz.querySelector('.resultado .seccion-titulo')?.textContent))
      .toBe('Resultado para Fausto Tamayo Guevara · C.I. 1800000318');
    expect(tarjetas).toEqual([
      ['Andrés Sebastián Tamayo Ruiz', 'Liniero · Distribución', 'Padre', 'Consanguinidad, 1er grado', 'Riesgo alto'],
      ['Marco Vinicio Tamayo Guevara', 'Superintendente de Distribución · Distribución', 'Hermano/a (estimado)',
        'Consanguinidad, 2do grado', 'Riesgo moderado']
    ]);
  }));

  it('sin coincidencias: el mensaje', fakeAsync(() => {
    crear();

    consultar('1712345678', 'Juan Carlos', 'Vásconez Mora');
    expect(limpio(raiz.querySelector('.sin-coincidencias')?.textContent)).toBe('Sin coincidencias con empleados actuales');
  }));

  it('«Nueva consulta» limpia el formulario y el resultado; las recientes quedan', fakeAsync(() => {
    crear();

    consultar('1800000318', 'Fausto', 'Tamayo Guevara');
    consultar('1712345678', 'Juan Carlos', 'Vásconez Mora');
    Array.from(raiz.querySelectorAll('button')).find((b) => limpio(b.textContent) === 'Nueva consulta')?.click();
    fixture.detectChanges();

    expect((raiz.querySelector('[formcontrolname="cedula"]') as HTMLInputElement).value).toBe('');
    expect(raiz.querySelector('.coincidencia, .sin-coincidencias')).toBeNull();
    expect(errores()).toEqual([]);
    expect(Array.from(raiz.querySelectorAll('.reciente')).map((r) => [
      limpio(r.querySelector('.reciente-datos')?.textContent),
      limpio(r.querySelector('.reciente-conteo')?.textContent)
    ])).toEqual([
      ['Juan Carlos Vásconez Mora · C.I. 1712345678', '0 coincidencias'],
      ['Fausto Tamayo Guevara · C.I. 1800000318', '2 coincidencias']
    ]);
    expect(limpio(raiz.querySelector('.reciente-fecha')?.textContent)).toBe('2 de octubre de 2026 a las 10:00 a. m.');
  }));
});
