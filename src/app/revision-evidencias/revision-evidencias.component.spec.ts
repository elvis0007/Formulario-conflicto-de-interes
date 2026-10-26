import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { LATENCIA_SIMULADA_MS } from '../services/mock-data/simular-respuesta';
import { PlanesMockService } from '../services/planes-mock.service';
import { PerfilUsuarioFalso, proveerPerfilFalso } from '../testing/perfil-usuario-falso';
import { RELOJ } from '../utils/reloj';
import { AVISO_PLAN_CERRADO, RevisionEvidenciasComponent } from './revision-evidencias.component';

describe('RevisionEvidenciasComponent', () => {
  /** «Hoy» fijo: 2 de octubre de 2026, 10:00. */
  const HOY = new Date(2026, 9, 2, 10, 0);
  let fixture: ComponentFixture<RevisionEvidenciasComponent>;
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
    fixture = TestBed.createComponent(RevisionEvidenciasComponent);
    raiz = fixture.nativeElement;
    fixture.detectChanges();
    tick(LATENCIA_SIMULADA_MS);
    fixture.detectChanges();
  }

  /** Espera una accion del servicio y refresca. */
  function esperar(): void {
    tick(LATENCIA_SIMULADA_MS * 2);
    fixture.detectChanges();
  }

  /** @returns Textos del resumen. */
  function resumen(): string[] {
    return Array.from(raiz.querySelectorAll('.resumen app-badge')).map((b) => limpio(b.textContent));
  }

  /** @returns Las tarjetas. */
  function tarjetas(): HTMLButtonElement[] {
    return Array.from(raiz.querySelectorAll<HTMLButtonElement>('.tarjeta'));
  }

  /**
   * @param conflictoId Conflicto de la tarjeta.
   */
  function abrir(conflictoId: string): void {
    tarjetas().find((t) => limpio(t.textContent).includes('Conflicto #' + conflictoId))?.click();
    fixture.detectChanges();
  }

  /**
   * @param descripcion Comienzo de la descripcion de la actividad.
   * @returns El elemento de la actividad en el modal.
   */
  function actividad(descripcion: string): HTMLElement {
    const encontrada = Array.from(raiz.querySelectorAll<HTMLElement>('.actividad'))
      .find((a) => limpio(a.querySelector('.actividad-descripcion')?.textContent).startsWith(descripcion));

    if (encontrada === undefined) {
      throw new Error('No hay actividad ' + descripcion);
    }
    return encontrada;
  }

  /**
   * @param contenedor Donde buscar.
   * @param texto Texto del boton.
   * @returns El boton, o `undefined`.
   */
  function boton(contenedor: HTMLElement, texto: string): HTMLButtonElement | undefined {
    return Array.from(contenedor.querySelectorAll('button')).find((b) => limpio(b.textContent) === texto);
  }

  /**
   * @param contenedor Donde buscar.
   * @param texto Texto del boton.
   */
  function pulsar(contenedor: HTMLElement, texto: string): void {
    const encontrado = boton(contenedor, texto);

    if (encontrado === undefined) {
      throw new Error('No hay botón ' + texto);
    }
    encontrado.click();
    fixture.detectChanges();
  }

  /** Cierra el modal con su boton. */
  function cerrarModal(): void {
    raiz.querySelector<HTMLButtonElement>('.boton-cerrar')?.click();
    fixture.detectChanges();
  }

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [RevisionEvidenciasComponent],
      providers: [
        provideRouter([]),
        { provide: RELOJ, useValue: () => new Date(HOY) },
        proveerPerfilFalso(new PerfilUsuarioFalso(['rrhh'], 'EMP-008', 'Lucía Fernanda Paredes Cando'))
      ]
    });
  });

  it('resumen y una tarjeta por conflicto con plan activo, primero las que tienen por revisar', fakeAsync(() => {
    crear();

    expect(resumen()).toEqual(['3 por revisar', '0 aprobadas hoy', '0 rechazadas hoy']);
    expect(tarjetas().map((t) => [
      limpio(t.querySelector('.tarjeta-conflicto')?.textContent),
      limpio(t.querySelector('.tarjeta-plan')?.textContent),
      limpio(t.querySelector('.tarjeta-revisar')?.textContent),
      limpio(t.querySelector('.tarjeta-avance')?.textContent)
    ])).toEqual([
      ['Conflicto #C-001', 'Plan 02 · Rotación del técnico de compras Activo · con vencidas', '2 por revisar', '1 de 7 aprobadas'],
      ['Conflicto #C-002', 'Plan 01 · Independencia de la cuadrilla Activo', '1 por revisar', '2 de 3 aprobadas']
    ]);
    expect(limpio(tarjetas()[0].querySelector('.tarjeta-personas')?.textContent)).toContain(' y ');
  }));

  it('?conflicto= abre directamente su modal (enlaces del dashboard)', fakeAsync(() => {
    TestBed.overrideProvider(ActivatedRoute, {
      useValue: { snapshot: { queryParamMap: convertToParamMap({ conflicto: 'C-002' }) } }
    });
    crear();

    expect(limpio(raiz.querySelector('.dialogo .titulo')?.textContent))
      .toBe('Conflicto #C-002 — Plan 01 · Independencia de la cuadrilla');
  }));

  it('sin planes activos muestra el estado vacío', fakeAsync(() => {
    spyOn(TestBed.inject(PlanesMockService), 'obtenerPlanes').and.returnValue(of([]));
    crear();

    expect(tarjetas().length).toBe(0);
    expect(limpio(raiz.querySelector('app-empty-state')?.textContent))
      .toContain('No hay planes activos con evidencias para revisar.');
  }));

  it('el modal agrupa las actividades por responsable y marca la fecha vencida', fakeAsync(() => {
    crear();
    abrir('C-001');

    expect(limpio(raiz.querySelector('.dialogo .titulo')?.textContent))
      .toBe('Conflicto #C-001 — Plan 02 · Rotación del técnico de compras');
    expect(limpio(raiz.querySelector('.cabecera app-badge')?.textContent)).toBe('Activo · con vencidas');

    const grupos = Array.from(raiz.querySelectorAll('.responsable')).map((g) => [
      limpio(g.querySelector('.avatar')?.textContent),
      limpio(g.querySelector('.responsable-nombre')?.textContent),
      g.querySelectorAll('.actividad').length
    ]);
    expect(grupos).toEqual([
      ['CM', 'Carlos Andrés Mayorga Sánchez', 2],
      ['FA', 'Fernando José Andrade Vela', 4],
      ['JM', 'Jorge Luis Mayorga Sánchez', 1]
    ]);

    const vencida = actividad('Rotar al técnico');
    expect(vencida.querySelector('.actividad-dato--vencida')).not.toBeNull();
    expect(limpio(vencida.textContent)).toContain('Sin evidencia todavía');
    expect(boton(vencida, 'Aprobar')).toBeUndefined();
  }));

  /**
   * «Aprobar» y luego «Confirmar aprobación».
   *
   * @param descripcion Comienzo de la descripcion de la actividad.
   */
  function aprobarConfirmando(descripcion: string): void {
    pulsar(actividad(descripcion), 'Aprobar');
    pulsar(actividad(descripcion), 'Confirmar aprobación');
    esperar();
  }

  it('aprobar pide confirmación (la revisión es definitiva) y se puede cancelar', fakeAsync(() => {
    crear();
    abrir('C-001');

    pulsar(actividad('Presentar el informe'), 'Aprobar');
    expect(limpio(actividad('Presentar el informe').textContent)).toContain('La revisión es definitiva: no se puede deshacer.');
    expect(resumen()[0]).withContext('aún no se aprobó').toBe('3 por revisar');

    pulsar(actividad('Presentar el informe'), 'Cancelar');
    expect(boton(actividad('Presentar el informe'), 'Confirmar aprobación')).toBeUndefined();
    expect(boton(actividad('Presentar el informe'), 'Aprobar')).toBeDefined();
  }));

  it('aprobar y rechazar (motivo obligatorio) actualizan el modal, la tarjeta y el resumen; sin «Deshacer»', fakeAsync(() => {
    crear();
    abrir('C-001');

    aprobarConfirmando('Presentar el informe');
    expect(limpio(actividad('Presentar el informe').querySelector('app-badge')?.textContent)).toBe('Aprobada · Cumplida');
    expect(limpio(actividad('Presentar el informe').textContent)).toContain('Revisada por Lucía Fernanda Paredes Cando el 02/10/2026');
    expect(resumen()).toEqual(['2 por revisar', '1 aprobadas hoy', '0 rechazadas hoy']);

    const acta = actividad('Entregar el acta');
    pulsar(acta, 'Rechazar');
    pulsar(actividad('Entregar el acta'), 'Confirmar rechazo');
    expect(limpio(actividad('Entregar el acta').querySelector('.error')?.textContent)).toBe('Escribe el motivo del rechazo.');
    expect(resumen()[2]).toBe('0 rechazadas hoy');

    const motivo = actividad('Entregar el acta').querySelector('textarea') as HTMLTextAreaElement;
    motivo.value = 'El acta no tiene firmas.';
    motivo.dispatchEvent(new Event('input'));
    pulsar(actividad('Entregar el acta'), 'Confirmar rechazo');
    esperar();
    expect(limpio(actividad('Entregar el acta').querySelector('.motivo')?.textContent))
      .toBe('Motivo del rechazo: El acta no tiene firmas.');
    expect(resumen()).toEqual(['1 por revisar', '1 aprobadas hoy', '1 rechazadas hoy']);
    expect(Array.from(raiz.querySelectorAll('.actividad button')).map((b) => limpio(b.textContent)))
      .not.toContain('Deshacer');
    expect(boton(actividad('Entregar el acta'), 'Aprobar')).toBeUndefined();

    cerrarModal();
    const c001 = tarjetas().find((t) => limpio(t.textContent).includes('Conflicto #C-001')) as HTMLElement;
    expect(limpio(c001.querySelector('.tarjeta-revisar')?.textContent)).toBe('0 por revisar');
    expect(limpio(c001.querySelector('.tarjeta-avance')?.textContent)).toBe('2 de 7 aprobadas');
  }));

  it('si la acción falla muestra el motivo del servicio (ultimoError) o el genérico', fakeAsync(() => {
    const servicio = TestBed.inject(PlanesMockService);
    const aprobar = spyOn(servicio, 'aprobarEvidencia').and.callFake(() => {
      servicio.ultimoError = 'La evidencia ya fue revisada (APROBADA) y no se puede revisar de nuevo';
      return of(null);
    });
    crear();
    abrir('C-001');

    aprobarConfirmando('Presentar el informe');
    expect(limpio(raiz.querySelector('.aviso--error')?.textContent))
      .toBe('La evidencia ya fue revisada (APROBADA) y no se puede revisar de nuevo');

    aprobar.and.callFake(() => {
      servicio.ultimoError = null;
      return of(null);
    });
    pulsar(actividad('Presentar el informe'), 'Confirmar aprobación');
    esperar();
    expect(limpio(raiz.querySelector('.aviso--error')?.textContent))
      .toBe('No se pudo completar la acción. Inténtalo de nuevo.');
  }));

  it('aprobar la última cierra el plan: aviso en el modal y la tarjeta desaparece al cerrarlo', fakeAsync(() => {
    crear();
    abrir('C-002');

    aprobarConfirmando('Retirar al superintendente');
    expect(limpio(raiz.querySelector('.aviso--cerrado')?.textContent)).toBe(AVISO_PLAN_CERRADO);
    expect(limpio(raiz.querySelector('.cabecera app-badge')?.textContent)).toBe('Cerrado');
    expect(tarjetas().length).toBe(2);

    cerrarModal();
    expect(tarjetas().length).toBe(1);
    expect(limpio(tarjetas()[0].textContent)).toContain('Conflicto #C-001');
  }));

  it('«Ver documento» ensancha el modal, muestra el visor y resalta la actividad', fakeAsync(() => {
    crear();
    abrir('C-001');
    expect(raiz.querySelector('.dialogo--medio')).not.toBeNull();

    pulsar(actividad('Presentar el informe'), 'Ver documento');
    expect(raiz.querySelector('.dialogo--ancho')).not.toBeNull();
    expect(raiz.querySelector('.revision--con-visor app-document-viewer')).not.toBeNull();
    expect(limpio(raiz.querySelector('app-document-viewer')?.textContent))
      .toContain('Vista previa no disponible (archivo de ejemplo)');
    expect(limpio(raiz.querySelector('.actividad--viendo .viendo')?.textContent)).toBe('Viendo documento');
    expect(limpio(raiz.querySelector('.actividad--viendo .actividad-descripcion')?.textContent))
      .toMatch(/^Presentar el informe/);

    raiz.querySelector<HTMLButtonElement>('app-document-viewer button[aria-label="Cerrar visor"]')?.click();
    fixture.detectChanges();
    expect(raiz.querySelector('app-document-viewer')).toBeNull();
    expect(raiz.querySelector('.dialogo--medio')).not.toBeNull();
  }));
});
