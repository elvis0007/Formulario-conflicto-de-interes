import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { ConflictosMockService } from '../services/conflictos-mock.service';
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
      ['01 sep', 'Entregar el inventa', 'Conflicto #C-001 · Plan 02 · Rotación del técnico de compras', 'Pendiente',
        'Vencida hace 31 días', '/responsable/planes/PL-002'],
      ['26 oct', 'Capacitar al person', 'Conflicto #C-001 · Plan 02 · Rotación del técnico de compras', 'Pendiente',
        'Vence en 24 días', '/responsable/planes/PL-002'],
      ['01 nov', 'Activar el registro', 'Conflicto #C-001 · Plan 02 · Rotación del técnico de compras', 'Rechazada',
        'Vence en 30 días', '/responsable/planes/PL-002']
    ]);
    expect(raiz.querySelector('.proxima .dias--vencida')).not.toBeNull();
  }));

  it('un indicador abre la Bandeja con ese filtro', fakeAsync(() => {
    crear();
    const navegar = spyOn(TestBed.inject(Router), 'navigate').and.resolveTo(true);

    raiz.querySelectorAll<HTMLButtonElement>('app-kpi-card button')[2].click();
    expect(navegar).toHaveBeenCalledWith(['/responsable/planes'], { queryParams: { estado: 'RECHAZADA' } });

    Array.from(raiz.querySelectorAll<HTMLButtonElement>('.alerta button'))[0].click();
    expect(navegar).toHaveBeenCalledWith(['/responsable/planes'], { queryParams: { estado: 'VENCIDA' } });
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
  it('en la sesión simulada saluda con el nombre del empleado elegido, no el de la sesión', fakeAsync(() => {
    perfil.nombre = 'Usuario Desarrollo';
    perfil.sesionSimulada = true;
    crear();
    expect(limpio(raiz.querySelector('h2.titulo')?.textContent)).toBe('Hola, Fernando José Andrade Vela');

    perfil.sesionSimulada = false;
    crear();
    expect(limpio(raiz.querySelector('h2.titulo')?.textContent)).toBe('Hola, Usuario Desarrollo');
  }));

  it('«Avance general»: barra de todas sus actividades y leyenda', fakeAsync(() => {
    crear();

    const bloque = raiz.querySelector('.avance-general') as HTMLElement;
    expect(bloque.querySelectorAll('app-barra-avance .segmento').length).toBe(7);
    expect(bloque.querySelector('.barra')?.getAttribute('aria-label')).toBe('3 de 7 cumplidas');
    expect(Array.from(bloque.querySelectorAll('.leyenda-avance li')).map((li) => limpio(li.textContent)))
      .toEqual(['Aprobadas 3', 'En revisión 1', 'Pendientes 2', 'Rechazadas 1']);
  }));

  it('«Mis actividades abiertas»: rechazadas y vencidas primero, con contexto y acción', fakeAsync(() => {
    crear();

    const filas = Array.from(raiz.querySelectorAll('.abierta')).map((li) => [
      li.getAttribute('data-actividad'),
      limpio(li.querySelector('.abierta-contexto')?.textContent),
      limpio(li.querySelector('app-badge')?.textContent),
      limpio(li.querySelector('.dias')?.textContent),
      limpio(li.querySelector('a')?.textContent),
      li.querySelector('a')?.getAttribute('href')
    ]);

    expect(filas.map((f) => f[0])).toEqual(['A-015', 'A-018', 'A-017', 'A-008']);
    expect(filas[0]).toEqual(['A-015',
      'Conflicto #C-001 · Carlos Andrés Mayorga Sánchez y Jorge Luis Mayorga Sánchez · Plan 02 · Rotación del técnico de compras',
      'Rechazada', 'Vence en 30 días', 'Volver a subir', '/responsable/planes/PL-002']);
    expect(filas[1].slice(2, 5)).toEqual(['Pendiente', 'Vencida hace 31 días', 'Subir evidencia']);
    expect(filas[3].slice(2, 5)).toEqual(['En revisión de RRHH', '', 'Ver plan']);
  }));

  it('los nombres del caso salen de la bandeja: no pide /conflictos (403 para el rol P)', fakeAsync(() => {
    const conflictos = spyOn(TestBed.inject(ConflictosMockService), 'obtenerConflictos').and.callThrough();
    crear();

    expect(conflictos).not.toHaveBeenCalled();
    expect(limpio(raiz.querySelector('.acordeon-personas')?.textContent))
      .toBe('Carlos Andrés Mayorga Sánchez y Jorge Luis Mayorga Sánchez');
  }));

  it('«Avance por conflicto»: acordeón conflicto › plan › actividades', fakeAsync(() => {
    crear();

    const items = Array.from(raiz.querySelectorAll<HTMLElement>('.acordeon-item'));
    expect(items.map((i) => i.getAttribute('data-conflicto'))).toEqual(['C-001', 'C-002', 'C-008']);
    expect(items[0].querySelector('.barra')?.getAttribute('aria-label')).toBe('1 de 4 cumplidas');
    expect(items[0].querySelector('.acordeon-cuerpo')).toBeNull();

    items[0].querySelector<HTMLButtonElement>('app-expand-arrow-button button')?.click();
    fixture.detectChanges();
    expect(limpio(items[0].querySelector('.acordeon-plan-titulo')?.textContent)).toBe('Plan 02 · Rotación del técnico de compras');
    expect(items[0].querySelectorAll('.acordeon-actividades li').length).toBe(4);
  }));
});
