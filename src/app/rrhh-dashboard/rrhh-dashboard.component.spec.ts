import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { AnalisisMockService, LATENCIA_GENERACION_MS } from '../services/analisis-mock.service';
import { LATENCIA_SIMULADA_MS } from '../services/mock-data/simular-respuesta';
import { PerfilUsuarioFalso, proveerPerfilFalso } from '../testing/perfil-usuario-falso';
import { RELOJ } from '../utils/reloj';
import { RrhhDashboardComponent } from './rrhh-dashboard.component';

describe('RrhhDashboardComponent', () => {
  const HOY = new Date(2026, 9, 2, 10, 0);
  let fixture: ComponentFixture<RrhhDashboardComponent>;
  let raiz: HTMLElement;
  let navegar: jasmine.Spy;

  /**
   * @param texto Texto.
   * @returns Sin espacios repetidos.
   */
  function limpio(texto: string | null | undefined): string {
    return (texto ?? '').replace(/\s+/g, ' ').trim();
  }

  /** Espera las respuestas simuladas y refresca. */
  function esperar(): void {
    tick(LATENCIA_GENERACION_MS + LATENCIA_SIMULADA_MS * 3);
    fixture.detectChanges();
  }

  /** Genera el analisis en el servicio (como si RRHH ya lo hubiera hecho). */
  function generarAntes(): void {
    TestBed.inject(AnalisisMockService).generarAnalisis().subscribe();
    tick(LATENCIA_GENERACION_MS + LATENCIA_SIMULADA_MS);
  }

  /** Crea la pantalla. */
  function crear(): void {
    fixture = TestBed.createComponent(RrhhDashboardComponent);
    raiz = fixture.nativeElement;
    fixture.detectChanges();
    esperar();
  }

  /**
   * @param clave Indicador.
   * @returns Su tarjeta.
   */
  function indicador(clave: string): HTMLElement {
    return raiz.querySelector('app-kpi-card[data-indicador="' + clave + '"]') as HTMLElement;
  }

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [RrhhDashboardComponent],
      providers: [
        provideRouter([]),
        { provide: RELOJ, useValue: () => new Date(HOY) },
        proveerPerfilFalso(new PerfilUsuarioFalso(['rrhh'], 'EMP-008', 'Lucía Alejandra Freire Ortiz'))
      ]
    });
    navegar = spyOn(TestBed.inject(Router), 'navigate').and.resolveTo(true);
  });

  it('sin análisis generado: estado vacío con «Generar análisis», que lo genera', fakeAsync(() => {
    crear();

    expect(limpio(raiz.querySelector('app-empty-state')?.textContent)).toContain('Aún no se ha generado un análisis');
    expect(raiz.querySelector('app-kpi-card')).toBeNull();
    raiz.querySelector<HTMLButtonElement>('app-empty-state button')?.click();
    esperar();
    expect(raiz.querySelectorAll('app-kpi-card').length).toBe(7);
    expect(limpio(raiz.querySelector('.estado-analisis')?.textContent)).toContain('Análisis AN-001 Borrador');
  }));

  it('indicadores calculados desde los servicios', fakeAsync(() => {
    generarAntes();
    crear();

    expect(Array.from(raiz.querySelectorAll('app-kpi-card')).map((k) =>
      limpio(k.querySelector('.titulo')?.textContent) + ' ' + limpio(k.querySelector('.valor')?.textContent))).toEqual([
      'Conflictos detectados 9',
      'Pendientes de clasificar 3',
      'Confirmados sin plan 0',
      'Planes activos 2',
      'Actividades vencidas 2',
      'Evidencias por revisar 3',
      'Planes cerrados 3'
    ]);
  }));

  it('cada indicador lleva a su pantalla ya filtrada', fakeAsync(() => {
    generarAntes();
    crear();

    const esperados: [string, string, object][] = [
      ['detectados', '/rrhh/analisis-conflictos', {}],
      ['pendientes', '/rrhh/analisis-conflictos', { clasificacion: 'pendiente' }],
      ['confirmadosSinPlan', '/rrhh/analisis-conflictos', { clasificacion: 'confirmado', plan: 'sin-plan' }],
      ['planesActivos', '/rrhh/informe-general', { estado: 'en-ejecucion' }],
      ['actividadesVencidas', '/rrhh/informe-general', { estado: 'con-vencidas' }],
      ['evidenciasPorRevisar', '/rrhh/revision-evidencias', {}],
      ['planesCerrados', '/rrhh/informe-general', { estado: 'cerrados' }]
    ];
    for (const [clave, ruta, parametros] of esperados) {
      indicador(clave).querySelector('button')?.click();
      expect(navegar).withContext(clave).toHaveBeenCalledWith([ruta], { queryParams: parametros });
    }
  }));

  it('gráficos: barras con número y texto accesible; las de riesgo y estado de plan filtran', fakeAsync(() => {
    generarAntes();
    crear();

    const riesgo = Array.from(raiz.querySelectorAll<HTMLButtonElement>('[data-riesgo]'));
    expect(riesgo.map((b) => b.getAttribute('aria-label'))).toEqual([
      'Alto: 2 conflictos. Ver en Análisis', 'Moderado: 3 conflictos. Ver en Análisis',
      'Bajo: 3 conflictos. Ver en Análisis', 'Ninguno: 1 conflicto. Ver en Análisis'
    ]);
    expect(limpio(riesgo[0].querySelector('.barra-valor')?.textContent)).toBe('2');
    riesgo[0].click();
    expect(navegar).toHaveBeenCalledWith(['/rrhh/analisis-conflictos'], { queryParams: { riesgo: 'alto' } });

    raiz.querySelector<HTMLButtonElement>('button[data-estado-plan="cerrado"]')?.click();
    expect(navegar).toHaveBeenCalledWith(['/rrhh/informe-general'], { queryParams: { estado: 'cerrados' } });
    expect(raiz.querySelector('button[data-estado-plan="borrador"]')).withContext('borrador no filtra').toBeNull();

    expect(Array.from(raiz.querySelectorAll('.leyenda-item')).map((l) =>
      limpio(l.querySelector('.leyenda-texto')?.textContent) + ' ' + limpio(l.querySelector('.leyenda-valor')?.textContent))).toEqual([
      'Aprobada · Cumplida 8', 'En revisión 3', 'Pendiente de evidencia 1', 'Vencida 2', 'Rechazada 1'
    ]);
    expect(raiz.querySelector('.apilada-segmento')?.getAttribute('title')).toBe('Aprobada · Cumplida: 8 actividades');
  }));

  it('«Requiere atención» y «Actividad reciente» con sus enlaces', fakeAsync(() => {
    generarAntes();
    crear();

    const vencidas = Array.from(raiz.querySelectorAll('.atencion-vencidas .item'));
    expect(vencidas.length).toBe(2);
    expect(limpio(vencidas[0].querySelector('.item-titulo')?.textContent)).toBe('Rotar al técnico a la unidad de bodega.');
    expect(vencidas[0].querySelector('a')?.getAttribute('href')).toBe('/rrhh/conflictos/C-001/planes/PL-002');
    const evidencias = Array.from(raiz.querySelectorAll('.atencion-evidencias .item'));
    expect(evidencias[0].querySelector('a')?.getAttribute('href')).toBe('/rrhh/revision-evidencias?conflicto=C-001');

    const eventos = Array.from(raiz.querySelectorAll('.eventos .evento'));
    const textos = eventos.map((e) => limpio(e.querySelector('.evento-texto')?.textContent));
    expect(eventos.length).toBe(8);
    // El analisis incluyo los 9 casos: se ve una sola vez, sin enlace.
    expect(textos.filter((t) => t === 'Incluido en el análisis AN-001.').length).toBe(1);
    expect(limpio(eventos[0].querySelector('.evento-meta')?.textContent)).toContain('Varios conflictos');
    const conEnlace = eventos.find((e) => e.querySelector('a'));
    expect(conEnlace?.querySelector('a')?.getAttribute('href')).toMatch(/^\/rrhh\/historial\?conflicto=C-\d{3}$/);
  }));
});
