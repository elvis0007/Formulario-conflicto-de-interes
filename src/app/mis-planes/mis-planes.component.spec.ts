import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { ActivatedRoute, ParamMap, Router, convertToParamMap, provideRouter } from '@angular/router';
import { BehaviorSubject } from 'rxjs';
import { LATENCIA_SIMULADA_MS } from '../services/mock-data/simular-respuesta';
import { PerfilUsuarioFalso, proveerPerfilFalso } from '../testing/perfil-usuario-falso';
import { RELOJ } from '../utils/reloj';
import { MisPlanesComponent } from './mis-planes.component';

describe('MisPlanesComponent', () => {
  const HOY = new Date(2026, 9, 2, 10, 0);
  let fixture: ComponentFixture<MisPlanesComponent>;
  let raiz: HTMLElement;
  let perfil: PerfilUsuarioFalso;
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
    fixture = TestBed.createComponent(MisPlanesComponent);
    raiz = fixture.nativeElement;
    fixture.detectChanges();
    tick(LATENCIA_SIMULADA_MS);
    fixture.detectChanges();
  }

  /** @returns Id de los planes visibles, por su enlace. */
  function planes(): string[] {
    return Array.from(raiz.querySelectorAll('.tarjeta .ver-plan'))
      .map((a) => (a.getAttribute('href') ?? '').split('/').pop() ?? '');
  }

  /**
   * @param estado Valor de `?estado=`.
   */
  function filtrarPorUrl(estado: string): void {
    consulta.next(convertToParamMap({ estado }));
    fixture.detectChanges();
  }

  beforeEach(() => {
    perfil = new PerfilUsuarioFalso(['responsable'], 'EMP-010');
    consulta = new BehaviorSubject(convertToParamMap({}));
    TestBed.configureTestingModule({
      imports: [MisPlanesComponent],
      providers: [
        provideRouter([]),
        { provide: ActivatedRoute, useValue: { queryParamMap: consulta } },
        { provide: RELOJ, useValue: () => new Date(HOY) },
        proveerPerfilFalso(perfil)
      ]
    });
  });

  it('una tarjeta por plan, primero los que tienen algo por hacer y los cerrados al final', fakeAsync(() => {
    crear();

    expect(planes()).toEqual(['PL-002', 'PL-003', 'PL-006']);
    const primera = raiz.querySelector('.tarjeta') as HTMLElement;
    expect(limpio(primera.querySelector('.tarjeta-conflicto')?.textContent)).toBe('Conflicto #C-001');
    expect(limpio(primera.querySelector('.tarjeta-plan')?.textContent)).toBe('Plan 02 · Rotación del técnico de compras');
    expect(limpio(primera.querySelector('.tarjeta-cabecera app-badge')?.textContent)).toBe('Activo · con vencidas');
    expect(limpio(primera.querySelector('.tarjeta-dato')?.textContent)).toBe('Inicio: 01/06/2026');
    expect(limpio(primera.querySelector('.tarjeta-avance')?.textContent)).toBe('1 de 4 de tus actividades aprobadas');
    expect(Array.from(primera.querySelectorAll('.chips app-badge')).map((c) => limpio(c.textContent)))
      .toEqual(['1 rechazada', '1 vencida', '1 pendiente', '1 aprobada']);
    expect(primera.querySelector('.ver-plan')?.textContent).toContain('Ver plan →');
    expect(limpio(primera.querySelector('.tarjeta-personas')?.textContent))
      .withContext('nombres del caso de la bandeja')
      .toBe('Carlos Andrés Mayorga Sánchez y Jorge Luis Mayorga Sánchez');
    expect(limpio(raiz.querySelectorAll('.tarjeta')[2].querySelector('.tarjeta-cabecera app-badge')?.textContent))
      .withContext('cerrado: con el tipo de cierre')
      .toBe('Cerrado · Cumplido');
  }));

  it('el filtro tiene conteos de SUS actividades', fakeAsync(() => {
    crear();

    expect(Array.from(raiz.querySelectorAll('app-pills button')).map((b) => limpio(b.textContent))).toEqual([
      'Todas (7)', 'Pendientes (1)', 'En revisión (1)', 'Rechazadas (1)', 'Vencidas (1)', 'Aprobadas (3)'
    ]);
  }));

  it('filtra por estado desde la URL: un plan aparece si tiene una actividad suya en ese estado', fakeAsync(() => {
    crear();

    filtrarPorUrl('EN_REVISION');
    expect(planes()).toEqual(['PL-003']);
    filtrarPorUrl('ACEPTADA');
    expect(planes()).toEqual(['PL-002', 'PL-003', 'PL-006']);
    filtrarPorUrl('VENCIDA');
    expect(planes()).toEqual(['PL-002']);
    expect(raiz.querySelector('app-pills button[aria-pressed="true"]')?.textContent).toContain('Vencidas');
    filtrarPorUrl('desconocido');
    expect(planes().length).toBe(3);
  }));

  it('abrir con ?estado= ya filtrado (clic del dashboard)', fakeAsync(() => {
    consulta.next(convertToParamMap({ estado: 'RECHAZADA' }));
    crear();

    expect(planes()).toEqual(['PL-002']);
  }));

  it('elegir una píldora cambia la URL', fakeAsync(() => {
    crear();
    const navegar = spyOn(TestBed.inject(Router), 'navigate').and.resolveTo(true);

    Array.from(raiz.querySelectorAll<HTMLButtonElement>('app-pills button'))
      .find((b) => b.textContent?.includes('Rechazadas'))?.click();
    expect(navegar).toHaveBeenCalledWith([], jasmine.objectContaining({
      queryParams: { estado: 'RECHAZADA' },
      queryParamsHandling: 'merge'
    }));
  }));

  it('sin coincidencias: estado vacío con «Ver todas»', fakeAsync(() => {
    perfil.empleadoId = 'EMP-002';
    consulta.next(convertToParamMap({ estado: 'RECHAZADA' }));
    crear();

    expect(planes()).toEqual([]);
    expect(limpio(raiz.querySelector('app-empty-state')?.textContent))
      .toContain('Ningún plan tiene actividades tuyas en «Rechazadas».');
  }));

  it('sin planes: estado vacío (los borradores no cuentan)', fakeAsync(() => {
    perfil.empleadoId = 'EMP-003';
    crear();

    expect(raiz.querySelector('app-pills')).toBeNull();
    expect(limpio(raiz.querySelector('app-empty-state')?.textContent)).toContain('No tienes planes de acción asignados.');
  }));
});
