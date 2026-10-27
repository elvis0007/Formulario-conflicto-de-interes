import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { of } from 'rxjs';
import { Archivo } from '../../models';
import { PlanesMockService } from '../../services/planes-mock.service';
import {
  DocumentViewerComponent,
  ERROR_CARGA_ARCHIVO,
  ZOOM_MAXIMO,
  ZOOM_MINIMO
} from './document-viewer.component';

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

  describe('archivo del backend (ruta de la API con token)', () => {
    let planes: PlanesMockService;
    let crearUrl: jasmine.Spy;
    let revocar: jasmine.Spy;

    beforeEach(() => {
      planes = TestBed.inject(PlanesMockService);
      crearUrl = spyOn(URL, 'createObjectURL').and.returnValue('blob:http://localhost/descargado');
      revocar = spyOn(URL, 'revokeObjectURL');
    });

    /**
     * @param archivo Archivo.
     * @param ids `planId` y/o `evidenciaId`.
     */
    function crearConId(archivo: Archivo, ids: { planId?: string; evidenciaId?: string }): void {
      fixture = TestBed.createComponent(DocumentViewerComponent);
      fixture.componentRef.setInput('archivo', archivo);
      for (const [clave, valor] of Object.entries(ids)) {
        fixture.componentRef.setInput(clave, valor);
      }
      fixture.detectChanges();
      raiz = fixture.nativeElement;
    }

    it('evidencia: pide el archivo, lo muestra con una URL local y la libera al destruir', () => {
      const contenido = new Blob(['png'], { type: 'image/png' });
      const pedir = spyOn(planes, 'obtenerArchivoEvidencia').and.returnValue(of(contenido));

      crearConId({ nombre: 'foto.png', url: '/evidencias/7/archivo', tipo: 'png' }, { evidenciaId: '7' });

      expect(pedir).toHaveBeenCalledOnceWith('7');
      expect(crearUrl).toHaveBeenCalledOnceWith(contenido);
      expect(raiz.querySelector('img')?.getAttribute('src')).toBe('blob:http://localhost/descargado');

      fixture.destroy();
      expect(revocar).toHaveBeenCalledOnceWith('blob:http://localhost/descargado');
    });

    it('documento del plan: lo pide con obtenerDocumentoPlan y lo muestra en el <iframe>', () => {
      const pedir = spyOn(planes, 'obtenerDocumentoPlan')
        .and.returnValue(of(new Blob(['%PDF'], { type: 'application/pdf' })));

      crearConId({ nombre: 'plan.pdf', url: '/planes/41/documento', tipo: 'pdf' }, { planId: '41' });

      expect(pedir).toHaveBeenCalledOnceWith('41');
      expect(raiz.querySelector('iframe')?.getAttribute('src')).toBe('blob:http://localhost/descargado');
    });

    it('si no llega (null): avisa y «Descargar» no hace nada', () => {
      spyOn(planes, 'obtenerArchivoEvidencia').and.returnValue(of(null));
      const clic = spyOn(HTMLAnchorElement.prototype, 'click');

      crearConId({ nombre: 'acta.pdf', url: '/evidencias/9/archivo', tipo: 'pdf' }, { evidenciaId: '9' });
      boton('Descargar').click();
      fixture.detectChanges();

      expect(raiz.querySelector('[role="alert"]')?.textContent).toContain(ERROR_CARGA_ARCHIVO);
      expect(raiz.querySelector('iframe')).toBeNull();
      expect(boton('Descargar').getAttribute('aria-disabled')).toBe('true');
      expect(clic).not.toHaveBeenCalled();
      expect(raiz.textContent).not.toContain('Descargado ✓');
    });

    it('si no llega y el servicio explica el motivo (p. ej. 403), muestra ese motivo', () => {
      spyOn(planes, 'obtenerDocumentoPlan').and.callFake(() => {
        planes.ultimoError = 'No tienes permiso para esta acción.';
        return of(null);
      });

      crearConId({ nombre: 'plan.pdf', url: '/planes/41/documento', tipo: 'pdf' }, { planId: '41' });

      expect(raiz.querySelector('[role="alert"]')?.textContent).toContain('No tienes permiso para esta acción.');
      expect(raiz.textContent).not.toContain(ERROR_CARGA_ARCHIVO);
    });

    it('la URL local del archivo recién subido se muestra directo, sin pedir nada ni liberarla', () => {
      const pedir = spyOn(planes, 'obtenerArchivoEvidencia');

      crearConId({ nombre: 'foto.png', url: 'blob:http://localhost/local', tipo: 'png' }, { evidenciaId: '7' });
      fixture.destroy();

      expect(pedir).not.toHaveBeenCalled();
      expect(revocar).not.toHaveBeenCalled();
    });
  });

  it('cerrar emite el evento', () => {
    crear({ nombre: 'x.pdf', url: '/mock/archivos/x.pdf', tipo: 'pdf' });
    let cerrado = false;
    fixture.componentInstance.cerrar.subscribe(() => cerrado = true);

    boton('Cerrar visor').click();
    expect(cerrado).toBeTrue();
  });
});
