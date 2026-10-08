import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { PerfilUsuarioFalso, proveerPerfilFalso } from '../testing/perfil-usuario-falso';
import { Router, provideRouter } from '@angular/router';
import { Observable } from 'rxjs';
import { AnalisisMockService, LATENCIA_GENERACION_MS } from '../services/analisis-mock.service';
import { LATENCIA_SIMULADA_MS } from '../services/mock-data/simular-respuesta';
import { AnalisisConflictoComponent } from './analisis-conflicto.component';

describe('AnalisisConflictoComponent', () => {
  let fixture: ComponentFixture<AnalisisConflictoComponent>;
  let raiz: HTMLElement;
  let servicio: AnalisisMockService;

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
   * @returns El boton (o enlace).
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

  /**
   * @param nombreA Inicio del nombre de la persona A.
   * @param nombreB Inicio del nombre de la persona B.
   * @returns La fila de ese caso (en la pagina visible).
   */
  function fila(nombreA: string, nombreB: string): HTMLTableRowElement {
    return filas().find((tr) =>
      limpio(tr.querySelector('.involucrado-nombre--a')?.textContent).startsWith(nombreA)
      && limpio(tr.querySelector('.involucrado-nombre--b')?.textContent).startsWith(nombreB)
    ) as HTMLTableRowElement;
  }

  /**
   * @param tr Fila de la tabla.
   * @returns Texto de su celda «Plan de acción».
   */
  function celdaPlanes(tr: HTMLTableRowElement): HTMLElement {
    return tr.querySelector('.celda-planes') as HTMLElement;
  }

  /**
   * Espera un observable del servicio (para preparar el estado).
   *
   * @param fuente Observable.
   * @param ms Latencia a esperar.
   */
  function esperar<T>(fuente: Observable<T>, ms = LATENCIA_SIMULADA_MS): void {
    fuente.subscribe();
    tick(ms);
  }

  /** Genera un analisis desde el servicio. */
  function generarEnServicio(): void {
    esperar(servicio.generarAnalisis(), LATENCIA_GENERACION_MS);
  }

  /** Clasifica los 3 pendientes de ejemplo y valida, desde el servicio. */
  function validarEnServicio(): void {
    esperar(servicio.actualizarClasificacion('C-005', 'confirmado', ''));
    esperar(servicio.actualizarClasificacion('C-007', 'confirmado', ''));
    esperar(servicio.actualizarClasificacion('C-009', 'homonimo', ''));
    esperar(servicio.validarAnalisis());
  }

  /** Crea la pantalla y espera la carga del analisis. */
  function crear(): void {
    fixture = TestBed.createComponent(AnalisisConflictoComponent);
    raiz = fixture.nativeElement;
    fixture.detectChanges();
    tick(LATENCIA_SIMULADA_MS);
    fixture.detectChanges();
  }

  /** Muestra 15 registros por pagina (todos los casos de ejemplo). */
  function verTodos(): void {
    const select = raiz.querySelector('app-data-table select') as HTMLSelectElement;

    select.value = '15';
    select.dispatchEvent(new Event('change'));
    fixture.detectChanges();
  }

  /** Pulsa «Generar análisis» en el estado vacio y espera el resultado. */
  function generarDesdeVacio(): void {
    boton('app-empty-state button', 'Generar análisis').click();
    fixture.detectChanges();
    tick(LATENCIA_GENERACION_MS + LATENCIA_SIMULADA_MS);
    fixture.detectChanges();
  }

  /**
   * Abre «Ver detalles» de un caso.
   *
   * @param tr Fila del caso.
   */
  function abrirDetalle(tr: HTMLTableRowElement): void {
    (Array.from(tr.querySelectorAll('button')).find((b) => limpio(b.textContent) === 'Ver detalles') as HTMLButtonElement)
      .click();
    fixture.detectChanges();
  }

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [AnalisisConflictoComponent],
      providers: [provideRouter([]), proveerPerfilFalso(new PerfilUsuarioFalso(['rrhh'], 'EMP-008', 'Lucía Alejandra Freire Ortiz'))]
    });
    servicio = TestBed.inject(AnalisisMockService);
  });

  describe('Día 5: encabezado, filtros y tabla', () => {
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

      boton('.acciones-encabezado button', 'Generar análisis').click();
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

    it('muestra relación, grado, departamentos, riesgo y estado', fakeAsync(() => {
      crear();
      generarDesdeVacio();
      const tr = filas()[1];
      const celdas = Array.from(tr.querySelectorAll('td')).map((td) => limpio(td.textContent));
      const departamentos = Array.from(tr.querySelectorAll('.departamento')).map((d) => limpio(d.textContent));

      expect(departamentos).toEqual(['Distribución', 'Distribución']);
      expect(celdas.slice(1, 7)).toEqual([
        'Consanguinidad',
        '3er grado',
        'DistribuciónDistribución',
        'Moderado',
        'Conflicto confirmado',
        'Ver detalles'
      ]);
    }));

    it('entre cónyuges el grado es «No aplica»', fakeAsync(() => {
      crear();
      generarDesdeVacio();
      verTodos();

      expect(limpio(fila('Esteban', 'Gabriela').querySelectorAll('td')[2].textContent)).toBe('No aplica');
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

  describe('Día 6: clasificación y validación', () => {
    it('clasificar desde «Ver detalles» actualiza el badge, la fila y el contador', fakeAsync(() => {
      crear();
      generarDesdeVacio();
      verTodos();

      abrirDetalle(fila('Esteban', 'Gabriela'));
      expect(limpio(raiz.querySelector('app-modal .titulo')?.textContent))
        .toBe('Conflicto #C-009 · Esteban Javier Castro Mena y Gabriela Alejandra Barona Núñez');

      const homonimo = Array.from(raiz.querySelectorAll<HTMLLabelElement>('app-detalle-conflicto .opcion'))
        .find((o) => limpio(o.textContent).startsWith('Homónimo')) as HTMLLabelElement;
      homonimo.querySelector('input')?.click();
      fixture.detectChanges();
      boton('app-detalle-conflicto button', 'Guardar clasificación').click();
      fixture.detectChanges();
      tick(LATENCIA_SIMULADA_MS * 2);
      fixture.detectChanges();

      const tr = fila('Esteban', 'Gabriela');
      expect(raiz.querySelector('app-detalle-conflicto')).withContext('cierra el modal').toBeNull();
      expect(limpio(tr.querySelectorAll('td')[5].textContent)).toBe('Homónimo');
      expect(tr.querySelector('td')?.classList).toContain('archivada');
      expect(limpio(celdaPlanes(tr).textContent)).toBe('Archivado');
      expect(limpio(raiz.querySelector('.resumen-pendientes')?.textContent))
        .toBe('2 casos pendientes de clasificar');
      expect(limpio(raiz.querySelector('.pagina')?.textContent))
        .withContext('se queda en la misma página').toBe('Página 1 de 1');
    }));

    it('los cambios siguen ahí al salir de la pantalla y volver', fakeAsync(() => {
      generarEnServicio();
      esperar(servicio.actualizarClasificacion('C-005', 'confirmado', 'Ok.'));
      crear();
      verTodos();

      expect(limpio(fila('Diana', 'Fernando').querySelectorAll('td')[5].textContent))
        .toBe('Conflicto confirmado');
    }));

    it('con pendientes, «Validar análisis» está deshabilitado y explica por qué', fakeAsync(() => {
      crear();
      generarDesdeVacio();

      expect(boton('.acciones-botones button', 'Validar análisis').disabled).toBeTrue();
      expect(limpio(raiz.querySelector('#ayuda-validar')?.textContent))
        .toBe('Clasifica los 3 casos pendientes para poder validar');
    }));

    it('sin pendientes, validar pide confirmación y deja el análisis Validado', fakeAsync(() => {
      generarEnServicio();
      esperar(servicio.actualizarClasificacion('C-005', 'confirmado', ''));
      esperar(servicio.actualizarClasificacion('C-007', 'confirmado', ''));
      esperar(servicio.actualizarClasificacion('C-009', 'homonimo', ''));
      crear();

      const validar = boton('.acciones-botones button', 'Validar análisis');
      expect(validar.disabled).toBeFalse();
      validar.click();
      fixture.detectChanges();
      expect(limpio(raiz.querySelector('.confirmacion-texto')?.textContent))
        .toBe('Una vez validado no se podrá cambiar la clasificación de ningún caso.');

      boton('.confirmacion-botones button', 'Validar análisis').click();
      fixture.detectChanges();
      tick(LATENCIA_SIMULADA_MS * 2);
      fixture.detectChanges();

      expect(limpio(raiz.querySelector('.estado-analisis')?.textContent)).toBe('Validado');
      expect(boton('.acciones-botones button', 'Validar análisis')).toBeUndefined();
    }));

    it('tras validar, la clasificación queda en solo lectura', fakeAsync(() => {
      generarEnServicio();
      validarEnServicio();
      crear();

      abrirDetalle(filas()[0]);

      expect(raiz.querySelectorAll('app-detalle-conflicto input[type=radio]').length).toBe(0);
      expect(boton('app-detalle-conflicto button', 'Guardar clasificación')).toBeUndefined();
      expect(limpio(raiz.querySelector('app-detalle-conflicto .opcion--lectura')?.textContent))
        .toContain('Conflicto confirmado');
    }));
  });

  describe('Día 6: columna «Plan de acción»', () => {
    it('homónimo: «Archivado»', fakeAsync(() => {
      crear();
      generarDesdeVacio();
      verTodos();

      expect(limpio(celdaPlanes(fila('Jorge', 'Ana')).textContent)).toBe('Archivado');
    }));

    it('pendiente: crear plan deshabilitado, «Clasifica el caso primero»', fakeAsync(() => {
      crear();
      generarDesdeVacio();
      verTodos();
      const celda = celdaPlanes(fila('Diana', 'Fernando'));

      expect(celda.querySelector('button')?.disabled).toBeTrue();
      expect(limpio(celda.querySelector('button')?.textContent)).toBe('+ Crear plan de acción');
      expect(limpio(celda.querySelector('.ayuda')?.textContent)).toBe('Clasifica el caso primero');
    }));

    it('confirmado sin planes: en Borrador deshabilitado; Validado navega a /planes/nuevo', fakeAsync(() => {
      generarEnServicio();
      esperar(servicio.actualizarClasificacion('C-005', 'confirmado', ''));
      crear();
      verTodos();

      let celda = celdaPlanes(fila('Diana', 'Fernando'));
      expect(celda.querySelector('button')?.disabled).toBeTrue();
      expect(limpio(celda.textContent)).toContain('Valida el análisis primero');

      esperar(servicio.actualizarClasificacion('C-007', 'confirmado', ''));
      esperar(servicio.actualizarClasificacion('C-009', 'homonimo', ''));
      esperar(servicio.validarAnalisis());
      fixture.destroy();
      crear();
      verTodos();
      const navegar = spyOn(TestBed.inject(Router), 'navigateByUrl').and.resolveTo(true);

      celda = celdaPlanes(fila('Diana', 'Fernando'));
      expect(celda.querySelector('button')?.disabled).toBeFalse();
      celda.querySelector('button')?.click();
      expect(navegar).toHaveBeenCalledWith('/rrhh/conflictos/C-005/planes/nuevo');
    }));

    it('un plan: «Ver plan de acción» abre ese plan', fakeAsync(() => {
      crear();
      generarDesdeVacio();
      const enlace = celdaPlanes(fila('Marco', 'Andrés')).querySelector('a');

      expect(limpio(enlace?.textContent)).toBe('Ver plan de acción');
      expect(enlace?.getAttribute('href')).toBe('/rrhh/conflictos/C-002/planes/PL-003');
    }));

    it('varios planes: tarjeta del actual y lista desplegable con «· actual»', fakeAsync(() => {
      crear();
      generarDesdeVacio();
      const tr = fila('Carlos', 'Jorge');
      const celda = celdaPlanes(tr);

      expect(limpio(celda.querySelector('.plan-actual-titulo')?.textContent))
        .toBe('Plan 02 · Rotación del técnico de compras');
      expect(limpio(celda.querySelector('app-badge')?.textContent)).toBe('Activo · con vencidas');

      celda.querySelector<HTMLButtonElement>('app-expand-arrow-button button')?.click();
      fixture.detectChanges();

      const planes = Array.from(raiz.querySelectorAll('.planes .plan'))
        .map((p) => Array.from(p.children).map((parte) => limpio(parte.textContent)));
      expect(planes).toEqual([
        ['Plan 01 · Separación de funciones en compras', 'Cerrado', 'Inicio: 03/11/2025',
          '2 de 2 actividades cumplidas', 'Abrir plan →'],
        ['Plan 02 · Rotación del técnico de compras · actual', 'Activo · con vencidas',
          'Inicio: 01/06/2026', '1 de 7 actividades cumplidas', 'Abrir plan →']
      ]);
      expect(raiz.querySelector('.planes .plan-abrir')?.getAttribute('href'))
        .toBe('/rrhh/conflictos/C-001/planes/PL-001');
    }));
  });

  describe('Día 6: historial', () => {
    it('generar sobre un Validado pide confirmación y deja el anterior en el historial', fakeAsync(() => {
      generarEnServicio();
      validarEnServicio();
      crear();

      boton('.acciones-botones button', 'Generar análisis').click();
      fixture.detectChanges();
      expect(limpio(raiz.querySelector('.confirmacion-texto')?.textContent))
        .toBe('Se creará un análisis nuevo en borrador. El actual quedará guardado en el historial.');

      boton('.confirmacion-botones button', 'Generar análisis').click();
      fixture.detectChanges();
      tick(LATENCIA_GENERACION_MS + LATENCIA_SIMULADA_MS);
      fixture.detectChanges();
      expect(limpio(raiz.querySelector('.estado-analisis')?.textContent)).toBe('Borrador');

      boton('.resumen .enlace', 'Análisis anteriores').click();
      fixture.detectChanges();
      tick(LATENCIA_SIMULADA_MS);
      fixture.detectChanges();

      const filasHistorial = Array.from(raiz.querySelectorAll('.historial tbody tr'))
        .map((tr) => Array.from(tr.querySelectorAll('td')).slice(1).map((td) => limpio(td.textContent)));
      expect(filasHistorial).toEqual([['Validado', '9', '7']]);
    }));

    it('sin análisis anteriores, el historial lo dice', fakeAsync(() => {
      crear();
      generarDesdeVacio();

      boton('.resumen .enlace', 'Análisis anteriores').click();
      fixture.detectChanges();
      tick(LATENCIA_SIMULADA_MS);
      fixture.detectChanges();

      expect(limpio(raiz.querySelector('.historial-vacio')?.textContent))
        .toBe('Aún no hay análisis anteriores.');
    }));
  });

  describe('Día 12: filtros por URL (desde el dashboard)', () => {
    /**
     * @param url URL con los filtros.
     */
    function abrirCon(url: string): void {
      TestBed.inject(Router).navigateByUrl(url);
      tick();
      crear();
    }

    it('?clasificacion=pendiente&plan=sin-plan filtra y muestra la franja «Filtrando»', fakeAsync(() => {
      generarEnServicio();
      abrirCon('/?clasificacion=pendiente&plan=sin-plan');

      expect(filas().length).toBe(3);
      expect(limpio(raiz.querySelector('.franja-filtros span')?.textContent))
        .toBe('Filtrando: Pendiente de revisión · Sin plan de acción');
    }));

    it('?riesgo= elige la píldora y se combina con la clasificación; «Limpiar filtros» los quita', fakeAsync(() => {
      generarEnServicio();
      abrirCon('/?riesgo=bajo&clasificacion=pendiente');

      expect(filas().length).toBe(2);
      expect(raiz.querySelector('app-pills button[aria-pressed="true"]')?.textContent).toContain('Bajo');
      Array.from(raiz.querySelectorAll('button')).find((b) => b.textContent?.includes('Limpiar filtros'))?.click();
      fixture.detectChanges();
      tick();
      expect(raiz.querySelector('.franja-filtros')).toBeNull();
      expect(filas().length).toBe(5);
    }));
  });
});
