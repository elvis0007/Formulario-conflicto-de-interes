import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { Archivo } from '../../models';
import { DocumentViewerComponent, ZOOM_MAXIMO, ZOOM_MINIMO } from './document-viewer.component';

describe('DocumentViewerComponent', () => {
  let fixture: ComponentFixture<DocumentViewerComponent>;
  let raiz: HTMLElement;

  /**
   * @param archivo Archivo a mostrar.
   */
  function crear(archivo: Archivo): void {
    fixture = TestBed.createComponent(DocumentViewerComponent);
    fixture.componentRef.setInput('archivo', archivo);
    fixture.componentRef.setInput('subidoPor', 'Carlos Andrés Mayorga Sánchez');
    fixture.componentRef.setInput('fechaSubida', '2026-09-30T10:00:00');
    fixture.detectChanges();
    raiz = fixture.nativeElement;
  }

  /**
   * @param etiqueta aria-label o texto del boton.
   * @returns El boton.
   */
  function boton(etiqueta: string): HTMLButtonElement {
    const encontrado = Array.from(raiz.querySelectorAll('button'))
      .find((b) => b.getAttribute('aria-label') === etiqueta || b.textContent?.includes(etiqueta));

    if (encontrado === undefined) {
      throw new Error('No hay botón ' + etiqueta);
    }
    return encontrado;
  }

  /** @returns Texto del porcentaje de zoom. */
  function porcentaje(): string {
    return raiz.textContent?.match(/\d+ %/)?.[0] ?? '';
  }

  it('archivo de ejemplo: aviso en lugar de vista previa, con nombre y quién lo subió', () => {
    crear({ nombre: 'A-005-informe.pdf', url: '/mock/archivos/A-005-informe.pdf', tipo: 'pdf' });

    expect(raiz.textContent).toContain('Vista previa no disponible (archivo de ejemplo)');
    expect(raiz.textContent).toContain('A-005-informe.pdf');
    expect(raiz.textContent).toContain('Carlos Andrés Mayorga Sánchez');
    expect(raiz.querySelector('iframe')).toBeNull();
    expect(raiz.querySelector('img')).toBeNull();
  });

  it('imagen con URL blob: se muestra en un <img>', () => {
    crear({ nombre: 'foto.png', url: 'blob:http://localhost/abc', tipo: 'png' });

    expect(raiz.querySelector('img')?.getAttribute('src')).toBe('blob:http://localhost/abc');
    expect(raiz.textContent).not.toContain('Vista previa no disponible');
  });

  it('PDF con URL blob: se muestra en un <iframe>', () => {
    crear({ nombre: 'plan.pdf', url: 'blob:http://localhost/def', tipo: 'pdf' });

    expect(raiz.querySelector('iframe')?.getAttribute('src')).toBe('blob:http://localhost/def');
  });

  it('zoom − / + por pasos, sin pasar de los límites', () => {
    crear({ nombre: 'foto.png', url: 'blob:http://localhost/abc', tipo: 'png' });
    expect(porcentaje()).toBe('100 %');

    boton('Acercar').click();
    fixture.detectChanges();
    expect(porcentaje()).toBe('125 %');

    for (let i = 0; i < 10; i++) {
      boton('Acercar').click();
    }
    fixture.detectChanges();
    expect(porcentaje()).toBe(ZOOM_MAXIMO + ' %');
    expect(boton('Acercar').disabled).toBeTrue();

    for (let i = 0; i < 20; i++) {
      boton('Alejar').click();
    }
    fixture.detectChanges();
    expect(porcentaje()).toBe(ZOOM_MINIMO + ' %');
    expect(boton('Alejar').disabled).toBeTrue();
  });

  it('«Descargar» cambia a «Descargado ✓» unos segundos (ejemplo: sin descargar nada)', fakeAsync(() => {
    crear({ nombre: 'x.pdf', url: '/mock/archivos/x.pdf', tipo: 'pdf' });
    const clic = spyOn(HTMLAnchorElement.prototype, 'click');

    boton('Descargar').click();
    fixture.detectChanges();
    expect(raiz.textContent).toContain('Descargado ✓');
    expect(clic).not.toHaveBeenCalled();

    tick(5000);
    fixture.detectChanges();
    expect(raiz.textContent).not.toContain('Descargado ✓');
  }));

  it('«Descargar» de un archivo real usa un enlace con el nombre', fakeAsync(() => {
    crear({ nombre: 'foto.png', url: 'blob:http://localhost/abc', tipo: 'png' });
    let descarga = '';
    spyOn(HTMLAnchorElement.prototype, 'click').and.callFake(function (this: HTMLAnchorElement) {
      descarga = this.download;
    });

    boton('Descargar').click();
    expect(descarga).toBe('foto.png');
    tick(5000);
  }));

  it('cerrar emite el evento', () => {
    crear({ nombre: 'x.pdf', url: '/mock/archivos/x.pdf', tipo: 'pdf' });
    let cerrado = false;
    fixture.componentInstance.cerrar.subscribe(() => cerrado = true);

    boton('Cerrar visor').click();
    expect(cerrado).toBeTrue();
  });
});
