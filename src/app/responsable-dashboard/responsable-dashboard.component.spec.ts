import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { LATENCIA_SIMULADA_MS } from '../services/mock-data/simular-respuesta';
import { PerfilUsuarioFalso, proveerPerfilFalso } from '../testing/perfil-usuario-falso';
import { RELOJ } from '../utils/reloj';
import { ResponsableDashboardComponent } from './responsable-dashboard.component';

describe('ResponsableDashboardComponent', () => {
  /** «Hoy» fijo: 2 de octubre de 2026, 10:00. */
  const HOY = new Date(2026, 9, 2, 10, 0);
  let fixture: ComponentFixture<ResponsableDashboardComponent>;
  let raiz: HTMLElement;
  let perfil: PerfilUsuarioFalso;

  /**
   * @param texto Texto.
   * @returns Sin espacios repetidos.
   */
  function limpio(texto: string | null | undefined): string {
    return (texto ?? '').replace(/\s+/g, ' ').trim();
  }

  /** Crea la pantalla y espera la carga. */
  function crear(): void {
    fixture = TestBed.createComponent(ResponsableDashboardComponent);
    raiz = fixture.nativeElement;
    fixture.detectChanges();
    tick(LATENCIA_SIMULADA_MS);
    fixture.detectChanges();
  }

  beforeEach(() => {
    perfil = new PerfilUsuarioFalso(['responsable'], 'EMP-010', 'Fernando José Andrade Vela');
    TestBed.configureTestingModule({
      imports: [ResponsableDashboardComponent],
      providers: [provideRouter([]), { provide: RELOJ, useValue: () => new Date(HOY) }, proveerPerfilFalso(perfil)]
    });
  });

  it('saluda con su nombre y muestra los indicadores de SUS actividades', fakeAsync(() => {
    crear();

    expect(limpio(raiz.querySelector('.titulo')?.textContent)).toBe('Hola, Fernando José Andrade Vela');
    expect(Array.from(raiz.querySelectorAll('app-kpi-card')).map((k) =>
      limpio(k.querySelector('.titulo')?.textContent) + ' ' + limpio(k.querySelector('.valor')?.textContent))).toEqual([
      'Pendientes 1',
      'En revisión 1',
      'Rechazadas (a corregir) 1',
      'Vencidas 1',
      'Aprobadas 3'
    ]);
    expect(limpio(raiz.querySelector('.alerta')?.textContent)).toContain('Tienes 1 actividad vencida.');
  }));

  it('«Próximas a vencer»: pendientes y rechazadas por fecha límite, con días y enlace al plan', fakeAsync(() => {
    crear();

    const filas = Array.from(raiz.querySelectorAll('.proxima')).map((li) => [
      limpio(li.querySelector('.fecha-dia')?.textContent) + ' ' + limpio(li.querySelector('.fecha-mes')?.textContent),
      limpio(li.querySelector('.proxima-descripcion')?.textContent).slice(0, 19),
      limpio(li.querySelector('.proxima-plan')?.textContent),
      limpio(li.querySelector('app-badge')?.textContent),
      limpio(li.querySelector('.dias')?.textContent),
      li.querySelector('.ver-plan')?.getAttribute('href')
    ]);

    expect(filas).toEqual([
      ['16 ago', 'Activar el registro', 'Conflicto #C-001 · Plan 02 · Rotación del técnico de compras', 'Rechazada',
        'Vencida hace 47 días', '/responsable/planes/PL-002'],
      ['26 oct', 'Capacitar al person', 'Conflicto #C-001 · Plan 02 · Rotación del técnico de compras', 'Pendiente',
        'Vence en 24 días', '/responsable/planes/PL-002']
    ]);
    expect(raiz.querySelector('.proxima .dias--vencida')).not.toBeNull();
  }));

  it('un indicador abre la Bandeja con ese filtro', fakeAsync(() => {
    crear();
    const navegar = spyOn(TestBed.inject(Router), 'navigate').and.resolveTo(true);

    raiz.querySelectorAll<HTMLButtonElement>('app-kpi-card button')[2].click();
    expect(navegar).toHaveBeenCalledWith(['/responsable/planes'], { queryParams: { estado: 'rechazada' } });

    Array.from(raiz.querySelectorAll<HTMLButtonElement>('.alerta button'))[0].click();
    expect(navegar).toHaveBeenCalledWith(['/responsable/planes'], { queryParams: { estado: 'vencida' } });
  }));

  it('sin actividades muestra el estado vacío', fakeAsync(() => {
    perfil.empleadoId = 'EMP-999';
    crear();

    expect(raiz.querySelector('app-kpi-card')).toBeNull();
    expect(limpio(raiz.querySelector('app-empty-state')?.textContent))
      .toContain('No tienes actividades asignadas en planes de acción.');
  }));

  it('las actividades de un borrador no cuentan', fakeAsync(() => {
    perfil.empleadoId = 'EMP-003';
    crear();

    // EMP-003 solo tiene A-010, en el borrador PL-004.
    expect(raiz.querySelector('app-empty-state')).not.toBeNull();
  }));
});
