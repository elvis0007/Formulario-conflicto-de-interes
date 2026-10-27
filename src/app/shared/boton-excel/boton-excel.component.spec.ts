import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { Subject, of } from 'rxjs';
import { ResultadoReporte } from '../../models';
import { ReportesMockService } from '../../services/reportes-mock.service';
import { BotonExcelComponent } from './boton-excel.component';

describe('BotonExcelComponent', () => {
  let fixture: ComponentFixture<BotonExcelComponent>;
  let raiz: HTMLElement;
  let servicio: ReportesMockService;

  beforeEach(() => {
    servicio = TestBed.inject(ReportesMockService);
    fixture = TestBed.createComponent(BotonExcelComponent);
    raiz = fixture.nativeElement;
    fixture.componentRef.setInput('tipo', 'RG.02');
    fixture.componentRef.setInput('filtro', { riesgo: 'ALTO' });
    fixture.detectChanges();
  });

  /** @returns Texto del boton, sin espacios de mas. */
  function texto(): string {
    return (raiz.querySelector('button')?.textContent ?? '').replace(/\s+/g, ' ').trim();
  }

  /** Pulsa el boton y refresca la vista. */
  function pulsar(): void {
    raiz.querySelector('button')?.click();
    fixture.detectChanges();
  }

  it('con la sesión simulada muestra «Disponible con sesión real» unos segundos', fakeAsync(() => {
    spyOn(servicio, 'descargarReporte').and.callThrough();
    expect(texto()).toBe('Descargar Excel');

    pulsar();
    expect(servicio.descargarReporte).toHaveBeenCalledOnceWith('RG.02', { riesgo: 'ALTO' });
    expect(texto()).toBe('Disponible con sesión real');
    expect(raiz.querySelector('button')?.classList).toContain('boton--aviso');

    pulsar();
    expect(servicio.descargarReporte).toHaveBeenCalledTimes(1);

    tick(4000);
    fixture.detectChanges();
    expect(texto()).toBe('Descargar Excel');
  }));

  it('mientras descarga: «Descargando…», ocupado y sin doble pedido; luego «Descargado ✓»', fakeAsync(() => {
    const respuesta = new Subject<ResultadoReporte>();

    spyOn(servicio, 'descargarReporte').and.returnValue(respuesta);
    pulsar();
    expect(texto()).toBe('Descargando…');
    expect(raiz.querySelector('button')?.getAttribute('aria-busy')).toBe('true');
    pulsar();
    expect(servicio.descargarReporte).toHaveBeenCalledTimes(1);

    respuesta.next({ estado: 'descargado', nombreArchivo: 'PNIP.CI.RG.02_2026-10-27.xlsx' });
    fixture.detectChanges();
    expect(texto()).toBe('Descargado ✓');
    tick(2000);
  }));

  it('si falla muestra el motivo y se puede volver a intentar', () => {
    spyOn(servicio, 'descargarReporte').and.returnValues(
      of<ResultadoReporte>({ estado: 'error', mensaje: 'No se pudo conectar con el servidor.' }),
      of<ResultadoReporte>({ estado: 'sin-backend' })
    );

    pulsar();
    expect(raiz.querySelector('[role="alert"]')?.textContent).toContain('No se pudo conectar con el servidor.');
    expect(texto()).toBe('Descargar Excel');

    pulsar();
    expect(servicio.descargarReporte).toHaveBeenCalledTimes(2);
    expect(raiz.querySelector('[role="alert"]')).toBeNull();
  });
});
