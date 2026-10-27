import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { PerfilUsuarioFalso, proveerPerfilFalso } from '../testing/perfil-usuario-falso';
import { ActivatedRoute, ParamMap, Router, convertToParamMap, provideRouter } from '@angular/router';
import { BehaviorSubject, Observable, isObservable, map, of } from 'rxjs';
import { AnalisisMockService, LATENCIA_GENERACION_MS } from '../services/analisis-mock.service';
import { LATENCIA_SIMULADA_MS } from '../services/mock-data/simular-respuesta';
import { PlanesMockService } from '../services/planes-mock.service';
import { RELOJ } from '../utils/reloj';
import {
  AVISO_ENVIADO,
  MENSAJE_CIERRE_EN_REVISION,
  MENSAJE_PLAN_VIGENTE,
  NOTA_REABRE_CONFLICTO,
  PlanAccionDetalleComponent,
  TEXTO_SIN_FECHA_LIMITE,
  mensajeSugeridasCargadas
} from './plan-accion-detalle.component';

describe('PlanAccionDetalleComponent', () => {
  let fixture: ComponentFixture<PlanAccionDetalleComponent>;
  let raiz: HTMLElement;
  let parametros: BehaviorSubject<ParamMap>;
  let analisis: AnalisisMockService;

  /**
   * @param texto Texto con espacios.
   * @returns El texto normalizado.
   */
  function limpio(texto: string | null | undefined): string {
    return (texto ?? '').replace(/\s+/g, ' ').trim();
  }

  /**
   * @param selector Selector CSS.
   * @returns Texto normalizado del primer elemento.
   */
  function texto(selector: string): string {
    return limpio(raiz.querySelector(selector)?.textContent);
  }

  /**
   * @param selector Selector de los botones.
   * @param inicio Comienzo del texto.
   * @returns El boton.
   */
  function boton(selector: string, inicio: string): HTMLButtonElement {
    return Array.from(raiz.querySelectorAll<HTMLButtonElement>(selector))
      .find((b) => limpio(b.textContent).startsWith(inicio)) as HTMLButtonElement;
  }

  /**
   * @param fuente Observable de un servicio.
   * @param ms Latencia a esperar.
   */
  function esperar<T>(fuente: Observable<T>, ms = LATENCIA_SIMULADA_MS): void {
    fuente.subscribe();
    tick(ms);
  }

  /** Genera el analisis, confirma C-005, clasifica el resto y valida. */
  function analisisValidadoConC005Confirmado(): void {
    esperar(analisis.generarAnalisis(), LATENCIA_GENERACION_MS);
    esperar(analisis.actualizarClasificacion('C-005', 'D', ''));
    esperar(analisis.actualizarClasificacion('C-007', 'D', ''));
    // El homónimo exige comentario (regla del backend, ya en el mock).
    esperar(analisis.actualizarClasificacion('C-009', 'H', 'Homónimo: sin parentesco real.'));
    esperar(analisis.validarAnalisis());
  }

  /**
   * Crea la pantalla en una URL de plan y espera la carga.
   *
   * @param conflictoId `:conflictoId`.
   * @param planId `:planId`.
   */
  function abrir(conflictoId: string, planId: string): void {
    parametros.next(convertToParamMap({ conflictoId, planId }));
    fixture = TestBed.createComponent(PlanAccionDetalleComponent);
    raiz = fixture.nativeElement;
    fixture.detectChanges();
    tick(LATENCIA_SIMULADA_MS);
    fixture.detectChanges();
  }

  /**
   * Escribe en un input o select y lo marca como tocado.
   *
   * @param selector Selector del control.
   * @param valor Valor.
   * @param indice Cual de los que coinciden.
   */
  function escribir(selector: string, valor: string, indice = 0): void {
    const control = raiz.querySelectorAll<HTMLInputElement | HTMLSelectElement>(selector)[indice];

    control.value = valor;
    control.dispatchEvent(new Event(control.tagName === 'SELECT' ? 'change' : 'input'));
    control.dispatchEvent(new Event('blur'));
    fixture.detectChanges();
  }

  beforeEach(() => {
    parametros = new BehaviorSubject(convertToParamMap({}));
    TestBed.configureTestingModule({
      imports: [PlanAccionDetalleComponent],
      providers: [
        provideRouter([]),
        { provide: ActivatedRoute, useValue: { paramMap: parametros } },
        { provide: RELOJ, useValue: () => new Date(2026, 9, 2, 10, 0) },
        proveerPerfilFalso(new PerfilUsuarioFalso(['rrhh'], 'EMP-008', 'Lucía Alejandra Freire Ortiz'))
      ]
    });
    analisis = TestBed.inject(AnalisisMockService);
  });

  describe('entrada a la pantalla', () => {
    it('con un plan real lo carga, con su cabecera y pestañas', fakeAsync(() => {
      abrir('C-001', 'PL-002');

      expect(texto('.codigo')).toBe('PNIP.CI.FR.02 · Conflicto #C-001');
      expect(texto('.titulo')).toBe('Plan 02 · Rotación del técnico de compras (2 de 2)');
      expect(texto('.estado-plan')).toBe('Activo · con vencidas');
      expect(Array.from(raiz.querySelectorAll('app-tabs [role=tab]')).map((p) => limpio(p.textContent)))
        .toEqual(['Plan 01 Cerrado · Cumplido', 'Plan 02 Activo · con vencidas']);
      expect(texto('.estado-seguimiento')).withContext('estado de seguimiento del conflicto').toBe('En ejecución');
      expect(raiz.querySelector('app-tabs [aria-selected=true]')?.id).toBe('planes-pestana-PL-002');
    }));

    it('la tarjeta del caso muestra empleado, familiar, parentesco, departamento y riesgo', fakeAsync(() => {
      abrir('C-002', 'PL-003');

      expect(Array.from(raiz.querySelectorAll('.caso-dato'))
        .map((d) => limpio(d.querySelector('.caso-etiqueta')?.textContent) + ' '
          + limpio(d.querySelector('.caso-valor, app-badge')?.textContent))).toEqual([
        'Empleado Marco Vinicio Tamayo Guevara',
        'Familiar Andrés Sebastián Tamayo Ruiz',
        'Parentesco Tío – Sobrino',
        'Departamento Distribución · Distribución',
        'Riesgo Moderado'
      ]);
    }));

    it('«nuevo» permitido: plan en borrador sin guardar, pestaña «Nuevo plan»', fakeAsync(() => {
      analisisValidadoConC005Confirmado();
      abrir('C-005', 'nuevo');

      expect(texto('.titulo')).toBe('Plan 01 · Sin nombre (1 de 1)');
      expect(texto('.estado-plan')).toBe('Borrador');
      expect(texto('app-tabs [aria-selected=true]')).toBe('Nuevo plan Borrador');
      expect(raiz.querySelector('input[formcontrolname=nombre]')).not.toBeNull();
    }));

    it('«nuevo» bloqueado: caso sin confirmar y análisis sin validar', fakeAsync(() => {
      esperar(analisis.generarAnalisis(), LATENCIA_GENERACION_MS);
      abrir('C-005', 'nuevo');

      const motivos = Array.from(raiz.querySelectorAll('.aviso-motivos li')).map((m) => limpio(m.textContent));
      expect(motivos).toEqual([
        'El caso no está confirmado como conflicto de interés (hoy: «Pendiente de revisión»). '
          + 'Clasifícalo en Análisis de Conflictos.',
        'El análisis de conflictos no está validado. Valídalo en Análisis de Conflictos.'
      ]);
      expect(raiz.querySelector('form')).toBeNull();
      expect(raiz.querySelector('.aviso a')?.getAttribute('href')).toBe('/rrhh/analisis-conflictos');
    }));

    it('«nuevo» bloqueado: el conflicto ya tiene un plan vigente', fakeAsync(() => {
      analisisValidadoConC005Confirmado();
      abrir('C-001', 'nuevo');

      expect(Array.from(raiz.querySelectorAll('.aviso-motivos li')).map((m) => limpio(m.textContent))).toEqual([
        'El conflicto ya tiene un plan vigente (Plan 02 · Rotación del técnico de compras). '
          + MENSAJE_PLAN_VIGENTE
      ]);
    }));

    it('conflicto o plan inexistente: «No se encontró el plan»', fakeAsync(() => {
      abrir('C-999', 'PL-001');
      expect(texto('app-empty-state')).toBe('No se encontró el plan');

      fixture.destroy();
      abrir('C-001', 'PL-999');
      expect(texto('app-empty-state')).toBe('No se encontró el plan');

      fixture.destroy();
      abrir('C-002', 'PL-001');
      expect(texto('app-empty-state')).withContext('plan de otro conflicto').toBe('No se encontró el plan');
    }));
  });

  describe('«+ Nuevo plan»', () => {
    it('deshabilitado con su mensaje si hay un plan vigente', fakeAsync(() => {
      abrir('C-001', 'PL-001');

      expect(boton('.nuevo-plan button', '+ Nuevo plan').disabled).toBeTrue();
      expect(texto('#ayuda-nuevo-plan')).toBe(MENSAJE_PLAN_VIGENTE);
      expect(raiz.querySelector('#nota-reabre')).toBeNull();
    }));

    it('conflicto finalizado: avisa que un plan nuevo lo reabre', fakeAsync(() => {
      abrir('C-004', 'PL-005');

      expect(texto('.estado-seguimiento')).toBe('Finalizado');
      expect(texto('#nota-reabre')).toBe(NOTA_REABRE_CONFLICTO);
      expect(boton('.nuevo-plan button', '+ Nuevo plan').getAttribute('aria-describedby')).toBe('nota-reabre');
    }));

    it('habilitado si todos los planes están cerrados; navega a .../planes/nuevo', fakeAsync(() => {
      abrir('C-004', 'PL-005');
      const navegar = spyOn(TestBed.inject(Router), 'navigateByUrl').and.resolveTo(true);

      const nuevo = boton('.nuevo-plan button', '+ Nuevo plan');
      expect(nuevo.disabled).toBeFalse();
      expect(raiz.querySelector('#ayuda-nuevo-plan')).toBeNull();
      nuevo.click();
      expect(navegar).toHaveBeenCalledWith('/rrhh/conflictos/C-004/planes/nuevo');
    }));

    it('cambiar de pestaña navega a la URL de ese plan', fakeAsync(() => {
      abrir('C-001', 'PL-001');
      const navegar = spyOn(TestBed.inject(Router), 'navigateByUrl').and.resolveTo(true);

      boton('app-tabs [role=tab]', 'Plan 02').click();
      expect(navegar).toHaveBeenCalledWith('/rrhh/conflictos/C-001/planes/PL-002');
    }));
  });

  describe('banner «Fecha de inicio del plan»', () => {
    it('borrador: pendiente, en ámbar', fakeAsync(() => {
      abrir('C-003', 'PL-004');
      expect(texto('.banner-inicio')).toBe('Fecha de inicio del plan: Pendiente · se registra al enviar y notificar');
      expect(raiz.querySelector('.banner-inicio')?.classList).toContain('banner-inicio--ambar');
    }));

    it('activo: fecha y «plan enviado y notificado», en verde', fakeAsync(() => {
      abrir('C-002', 'PL-003');
      expect(texto('.banner-inicio')).toBe('Fecha de inicio del plan: 17/08/2026 · plan enviado y notificado');
      expect(raiz.querySelector('.banner-inicio')?.classList).toContain('banner-inicio--verde');
    }));

    it('cerrado: fecha de inicio y de cierre, en gris', fakeAsync(() => {
      abrir('C-001', 'PL-001');
      expect(texto('.banner-inicio')).toBe('Fecha de inicio del plan: 03/11/2025 · cerrado el 20/03/2026');
      expect(raiz.querySelector('.banner-inicio')?.classList).toContain('banner-inicio--gris');
    }));
  });

  describe('solo lectura', () => {
    for (const [conflicto, plan, estado] of [['C-002', 'PL-003', 'FIRMADO'], ['C-001', 'PL-001', 'CERRADO']]) {
      it(`un plan ${estado} se muestra como texto, sin inputs ni botones de edición`, fakeAsync(() => {
        abrir(conflicto, plan);

        expect(raiz.querySelectorAll('input, select, textarea').length).toBe(0);
        expect(boton('button', 'Guardar borrador')).toBeUndefined();
        expect(boton('button', '+ Agregar actividad')).toBeUndefined();
        expect(raiz.querySelector('.boton-icono--quitar')).toBeNull();
        expect(raiz.querySelectorAll('.tabla-actividades tbody tr.actividad').length).toBeGreaterThan(0);
        expect(boton('.acciones-encabezado button', 'Imprimir formulario').disabled)
          .withContext('activos y cerrados se pueden imprimir').toBeFalse();
        expect(boton('.acciones-encabezado button', 'Enviar y notificar')).toBeUndefined();
      }));
    }

    it('la fecha límite se calcula con la fecha de inicio, con «Plazo: …» debajo', fakeAsync(() => {
      abrir('C-002', 'PL-003');
      const celda = raiz.querySelector('.tabla-actividades tbody tr .fecha-limite') as HTMLElement;

      expect(Array.from(celda.querySelectorAll('span')).map((s) => limpio(s.textContent)))
        .withContext('inicio 17/08/2026 + 20 días').toEqual(['06/09/2026', 'Plazo: 20 días']);
    }));
  });

  describe('edición del borrador', () => {
    it('en borrador la fecha límite dice «Se calcula al enviar y notificar»', fakeAsync(() => {
      abrir('C-003', 'PL-004');
      expect(texto('.tabla-actividades tbody tr .fecha-limite')).toBe(TEXTO_SIN_FECHA_LIMITE);
    }));

    it('valida el plazo: enteros >= 0 y total distinto de 0', fakeAsync(() => {
      abrir('C-003', 'PL-004');
      escribir('input[formcontrolname=plazoMeses]', '-1');
      expect(texto('.tabla-actividades tbody tr .error')).toBe('Usa números enteros, 0 o más.');

      escribir('input[formcontrolname=plazoMeses]', '0');
      escribir('input[formcontrolname=plazoDias]', '0');
      expect(texto('.tabla-actividades tbody tr .error')).toBe('El plazo no puede ser 0.');
      expect(raiz.querySelector('.tabla-actividades tbody tr')?.classList).toContain('actividad--error');

      escribir('input[formcontrolname=plazoDias]', '10');
      expect(raiz.querySelector('.tabla-actividades tbody tr .error')).toBeNull();
    }));

    it('«Guardar borrador» solo exige el nombre; marca las filas incompletas', fakeAsync(() => {
      analisisValidadoConC005Confirmado();
      abrir('C-005', 'nuevo');

      boton('.acciones-encabezado button', 'Guardar borrador').click();
      fixture.detectChanges();
      expect(texto('#error-nombre')).toBe('Escribe el nombre del plan.');

      escribir('input[formcontrolname=nombre]', 'Plan de prueba');
      boton('button', '+ Agregar actividad').click();
      fixture.detectChanges();
      const navegar = spyOn(TestBed.inject(Router), 'navigateByUrl').and.resolveTo(true);
      boton('.acciones-encabezado button', 'Guardar borrador').click();
      fixture.detectChanges();
      expect(raiz.querySelector('.tabla-actividades tbody tr')?.classList)
        .withContext('la fila vacía se marca').toContain('actividad--error');

      tick(LATENCIA_SIMULADA_MS);
      fixture.detectChanges();
      expect(navegar).toHaveBeenCalledWith('/rrhh/conflictos/C-005/planes/PL-008', { replaceUrl: true });
      expect(texto('.mensaje--ok')).toBe('Borrador guardado');
      expect(fixture.componentInstance.formulario.dirty).toBeFalse();
      tick(3000);
    }));

    it('al guardar un plan nuevo le da el número correlativo del conflicto', fakeAsync(() => {
      analisisValidadoConC005Confirmado();
      const planes = TestBed.inject(PlanesMockService);
      abrir('C-005', 'nuevo');
      spyOn(TestBed.inject(Router), 'navigateByUrl').and.resolveTo(true);

      escribir('input[formcontrolname=nombre]', 'Primero');
      boton('.acciones-encabezado button', 'Guardar borrador').click();
      tick(LATENCIA_SIMULADA_MS);

      let numeros: number[] = [];
      planes.obtenerPlanesDeConflicto('C-005').subscribe((p) => numeros = p.map((x) => x.numero));
      tick(LATENCIA_SIMULADA_MS);
      expect(numeros).toEqual([1]);
      tick(3000);
    }));

    it('guardar un borrador existente lo actualiza sin cambiar la URL', fakeAsync(() => {
      abrir('C-003', 'PL-004');
      const navegar = spyOn(TestBed.inject(Router), 'navigateByUrl').and.resolveTo(true);

      escribir('input[formcontrolname=nombre]', 'Nombre actualizado');
      boton('.acciones-encabezado button', 'Guardar borrador').click();
      tick(LATENCIA_SIMULADA_MS);
      fixture.detectChanges();

      expect(navegar).not.toHaveBeenCalled();
      expect(texto('.titulo')).toBe('Plan 01 · Nombre actualizado (1 de 1)');
      expect(texto('.mensaje--ok')).toBe('Borrador guardado');
      tick(3000);
    }));
  });

  describe('cambios sin guardar', () => {
    it('sin cambios deja salir', fakeAsync(() => {
      abrir('C-003', 'PL-004');
      expect(fixture.componentInstance.puedeSalir()).toBeTrue();
    }));

    it('con cambios pide confirmación: «Seguir editando» se queda, «Salir sin guardar» sale', fakeAsync(() => {
      abrir('C-003', 'PL-004');
      escribir('input[formcontrolname=nombre]', 'Cambio sin guardar');

      const respuestas: boolean[] = [];
      let respuesta = fixture.componentInstance.puedeSalir();
      expect(isObservable(respuesta)).toBeTrue();
      (respuesta as Observable<boolean>).subscribe((r) => respuestas.push(r));
      fixture.detectChanges();
      expect(texto('app-modal .titulo')).toBe('Cambios sin guardar');
      boton('app-modal button', 'Seguir editando').click();
      fixture.detectChanges();

      respuesta = fixture.componentInstance.puedeSalir();
      (respuesta as Observable<boolean>).subscribe((r) => respuestas.push(r));
      fixture.detectChanges();
      boton('app-modal button', 'Salir sin guardar').click();
      fixture.detectChanges();

      expect(respuestas).toEqual([false, true]);
      expect(raiz.querySelector('app-modal .dialogo')).toBeNull();
    }));

    it('en un plan de solo lectura nunca hay cambios pendientes', fakeAsync(() => {
      abrir('C-001', 'PL-001');
      expect(fixture.componentInstance.puedeSalir()).toBeTrue();
    }));
  });

  describe('Día 8: imprimir', () => {
    it('se puede imprimir un borrador guardado con una actividad completa; no con cambios', fakeAsync(() => {
      abrir('C-003', 'PL-004');
      const imprimir = spyOn(window, 'print');

      expect(boton('.acciones-botones button', 'Imprimir formulario').disabled).toBeFalse();
      escribir('input[formcontrolname=nombre]', 'Cambio sin guardar');
      expect(boton('.acciones-botones button', 'Imprimir formulario').disabled).toBeTrue();

      escribir('input[formcontrolname=nombre]', 'Control cruzado de pagos');
      fixture.componentInstance.formulario.markAsPristine();
      fixture.detectChanges();
      boton('.acciones-botones button', 'Imprimir formulario').click();
      expect(imprimir).toHaveBeenCalled();
    }));

    it('un plan nuevo sin guardar no se puede imprimir', fakeAsync(() => {
      analisisValidadoConC005Confirmado();
      abrir('C-005', 'nuevo');
      expect(boton('.acciones-botones button', 'Imprimir formulario').disabled).toBeTrue();
    }));

    it('la versión impresa tiene encabezado, caso, actividades y una firma por responsable', fakeAsync(() => {
      abrir('C-003', 'PL-004');
      spyOn(window, 'print');
      boton('.acciones-botones button', 'Imprimir formulario').click();

      expect(texto('.impresion-codigo')).toBe('PNIP.CI.FR.02');
      expect(texto('.impresion-fecha')).toBe('Fecha de impresión: 02/10/2026');
      expect(texto('.impresion-empresa')).toBe('Empresa Eléctrica Ambato Regional Centro Norte S.A.');
      expect(raiz.querySelectorAll('.impresion-tabla tbody tr').length).withContext('5 datos + 2 actividades').toBe(7);
      expect(Array.from(raiz.querySelectorAll('.firma .firma-nombre')).map((f) => limpio(f.textContent))).toEqual([
        'Nombre: ______________________________',
        'Patricio Eduardo Barona Silva',
        'Diana Carolina Pérez López'
      ]);
    }));

    it('mientras la pantalla está abierta, <body> tiene la clase de impresión', fakeAsync(() => {
      abrir('C-003', 'PL-004');
      expect(document.body.classList).toContain('con-plan-imprimible');
      fixture.destroy();
      expect(document.body.classList).not.toContain('con-plan-imprimible');
    }));
  });

  describe('Día 8: documento del plan', () => {
    /**
     * Elige un archivo en el input oculto (como el selector del sistema).
     *
     * @param nombre Nombre del archivo.
     * @param tipo Tipo MIME.
     * @param bytes Tamano.
     */
    function elegir(nombre: string, tipo = 'application/pdf', bytes = 100): void {
      const input = raiz.querySelector('.documento input[type=file]') as HTMLInputElement;
      const dt = new DataTransfer();

      dt.items.add(new File([new Uint8Array(bytes)], nombre, { type: tipo }));
      input.files = dt.files;
      input.dispatchEvent(new Event('change'));
      fixture.detectChanges();
      tick(LATENCIA_SIMULADA_MS);
      fixture.detectChanges();
    }

    beforeEach(() => {
      let n = 0;
      spyOn(URL, 'createObjectURL').and.callFake(() => 'blob:prueba-' + (++n));
      spyOn(URL, 'revokeObjectURL');
    });

    it('sin documento: botón para subirlo y el aviso para habilitar el envío', fakeAsync(() => {
      abrir('C-003', 'PL-004');

      expect(boton('.documento button', 'Subir documento firmado (PDF)')).toBeDefined();
      expect(texto('.aviso-documento')).toBe('Sube el documento firmado para habilitar «Enviar y notificar».');
      expect(raiz.querySelector('.documento input[type=file]')?.getAttribute('accept')).toBe('.pdf,application/pdf');
    }));

    it('muestra el error si no es PDF o supera 5 MB', fakeAsync(() => {
      abrir('C-003', 'PL-004');

      elegir('foto.png', 'image/png');
      expect(texto('.error--documento')).toBe('El documento firmado debe ser un archivo PDF.');

      elegir('grande.pdf', 'application/pdf', 5 * 1024 * 1024 + 1);
      expect(texto('.error--documento')).toBe('El documento firmado no puede superar los 5 MB.');
      expect(raiz.querySelector('.documento-nombre')).toBeNull();
    }));

    it('sube, reemplaza y quita el PDF', fakeAsync(() => {
      abrir('C-003', 'PL-004');

      elegir('plan.pdf');
      expect(texto('.documento-nombre')).toBe('plan.pdf — subido el 02/10/2026');
      expect(texto('.aviso-documento--firma')).toContain('el plazo de las actividades empieza a correr ese día');
      boton('.documento button', 'Ver documento').click();
      fixture.detectChanges();
      expect(raiz.querySelector('app-document-viewer iframe')?.getAttribute('src'))
        .withContext('el recién elegido se ve con su URL local').toBe('blob:prueba-1');
      raiz.querySelector<HTMLButtonElement>('app-document-viewer button[aria-label="Cerrar visor"]')?.click();
      fixture.detectChanges();

      elegir('plan-v2.pdf');
      expect(texto('.documento-nombre')).toBe('plan-v2.pdf — subido el 02/10/2026');

      boton('.documento button', 'Quitar').click();
      tick(LATENCIA_SIMULADA_MS);
      fixture.detectChanges();
      expect(raiz.querySelector('.documento-nombre')).toBeNull();
      expect(boton('.documento button', 'Subir documento firmado (PDF)')).toBeDefined();
    }));

    it('en un plan activo, el documento es de solo lectura', fakeAsync(() => {
      abrir('C-002', 'PL-003');

      expect(texto('.documento-nombre')).toBe('PL-003-plan-firmado.pdf — subido el 14/08/2026');
      expect(boton('.documento button', 'Ver documento')).toBeDefined();
      expect(raiz.querySelector('.documento input[type=file]')).toBeNull();
      expect(boton('.documento button', 'Reemplazar')).toBeUndefined();
      expect(boton('.documento button', 'Quitar')).toBeUndefined();
    }));
  });

  describe('Día 8: enviar y notificar', () => {
    /** @returns Lo que dice que falta para enviar. */
    function faltas(): string[] {
      return Array.from(raiz.querySelectorAll('.faltas-envio li')).map((l) => limpio(l.textContent));
    }

    /** @returns El boton «Enviar y notificar». */
    function enviar(): HTMLButtonElement {
      return boton('.acciones-botones button', 'Enviar y notificar');
    }

    it('sin documento: deshabilitado con «Sube el documento firmado»', fakeAsync(() => {
      abrir('C-003', 'PL-004');
      expect(enviar().disabled).toBeTrue();
      expect(faltas()).toEqual(['Sube el documento firmado']);
    }));

    it('con cambios sin guardar: «Guarda los cambios»', fakeAsync(() => {
      abrir('C-008', 'PL-007');
      expect(faltas()).withContext('PL-007 ya tiene documento y está completo').toEqual([]);

      escribir('input[formcontrolname=nombre]', 'Otro nombre');
      expect(enviar().disabled).toBeTrue();
      expect(faltas()).toEqual(['Guarda los cambios']);
    }));

    it('con actividades incompletas guardadas: cuántas faltan', fakeAsync(() => {
      abrir('C-008', 'PL-007');
      spyOn(TestBed.inject(Router), 'navigateByUrl').and.resolveTo(true);

      boton('button', '+ Agregar actividad').click();
      boton('button', '+ Agregar actividad').click();
      fixture.detectChanges();
      boton('.acciones-botones button', 'Guardar borrador').click();
      tick(LATENCIA_SIMULADA_MS);
      fixture.detectChanges();
      expect(faltas()).toEqual(['Completa las 2 actividades con datos faltantes']);

      fixture.componentInstance.quitarActividad(2);
      boton('.acciones-botones button', 'Guardar borrador').click();
      tick(LATENCIA_SIMULADA_MS);
      fixture.detectChanges();
      expect(faltas()).toEqual(['Completa la actividad con datos faltantes']);
      tick(3000);
    }));

    it('sin actividades: «Agrega al menos una actividad»', fakeAsync(() => {
      abrir('C-008', 'PL-007');
      fixture.componentInstance.quitarActividad(0);
      boton('.acciones-botones button', 'Guardar borrador').click();
      tick(LATENCIA_SIMULADA_MS);
      fixture.detectChanges();

      expect(faltas()).toEqual(['Agrega al menos una actividad']);
      tick(3000);
    }));

    it('pide confirmación y deja el plan activo, en solo lectura, con fechas límite', fakeAsync(() => {
      abrir('C-008', 'PL-007');

      expect(enviar().disabled).toBeFalse();
      enviar().click();
      fixture.detectChanges();
      expect(texto('app-modal .confirmacion-texto')).toBe(
        'Al enviar, el plan queda firmado con el documento subido y se notifica a 1 responsable. '
        + 'El plazo de cada actividad empieza a correr hoy (02/10/2026): las fechas límite se calculan desde ese día. '
        + 'Después ya no podrás editar el plan.');

      boton('app-modal button', 'Enviar y notificar').click();
      fixture.detectChanges();
      tick(LATENCIA_SIMULADA_MS * 2);
      fixture.detectChanges();

      expect(texto('.estado-plan')).toBe('Activo');
      expect(texto('.banner-inicio')).toBe('Fecha de inicio del plan: 02/10/2026 · plan enviado y notificado');
      expect(Array.from(raiz.querySelectorAll('.tabla-actividades .fecha-limite span')).map((s) => limpio(s.textContent)))
        .toEqual(['02/10/2027', 'Plazo: 12 meses']);
      expect(raiz.querySelectorAll('input, select, textarea').length).toBe(0);
      expect(enviar()).toBeUndefined();
      expect(texto('.mensaje--ok')).toBe(AVISO_ENVIADO);
      expect(texto('app-tabs [aria-selected=true]')).toBe('Plan 02 Activo');
      expect(fixture.componentInstance.puedeSalir()).toBeTrue();
    }));

    it('si falla muestra el motivo del servicio (ultimoError) o el genérico', fakeAsync(() => {
      const planes = TestBed.inject(PlanesMockService);
      const enviarYNotificar = spyOn(planes, 'enviarYNotificar').and.callFake(() => {
        planes.ultimoError = 'El plan ya fue firmado';
        return of(null);
      });
      abrir('C-008', 'PL-007');

      enviar().click();
      fixture.detectChanges();
      boton('app-modal button', 'Enviar y notificar').click();
      fixture.detectChanges();
      expect(texto('.mensaje--error')).toBe('El plan ya fue firmado');

      enviarYNotificar.and.callFake(() => {
        planes.ultimoError = null;
        return of(null);
      });
      enviar().click();
      fixture.detectChanges();
      boton('app-modal button', 'Enviar y notificar').click();
      fixture.detectChanges();
      expect(texto('.mensaje--error')).toBe('No se pudo enviar el plan. Revisa que esté completo e inténtalo de nuevo.');
    }));
  });

  describe('guardar borrador: error', () => {
    it('muestra el motivo del servicio (p. ej. el 409 del backend)', fakeAsync(() => {
      const planes = TestBed.inject(PlanesMockService);
      spyOn(planes, 'guardarBorrador').and.callFake(() => {
        planes.ultimoError = 'El conflicto ya tiene un plan abierto';
        return of(null);
      });
      abrir('C-003', 'PL-004');

      escribir('input[formcontrolname=nombre]', 'Otro nombre');
      boton('.acciones-encabezado button', 'Guardar borrador').click();
      fixture.detectChanges();
      expect(texto('.mensaje--error')).toBe('El conflicto ya tiene un plan abierto');
    }));
  });

  describe('documento firmado del backend', () => {
    it('«Ver documento» lo pide con obtenerDocumentoPlan (no usa la ruta de la API como enlace)', fakeAsync(() => {
      const planes = TestBed.inject(PlanesMockService);
      const pedir = spyOn(planes, 'obtenerDocumentoPlan')
        .and.returnValue(of(new Blob(['%PDF'], { type: 'application/pdf' })));
      spyOn(URL, 'createObjectURL').and.returnValue('blob:documento');
      const revocar = spyOn(URL, 'revokeObjectURL');
      const original = planes.obtenerPlanesDeConflicto.bind(planes);
      spyOn(planes, 'obtenerPlanesDeConflicto').and.callFake((id: string) => original(id).pipe(
        map((lista) => lista.map((p) => p.documentoFirmado
          ? { ...p, documentoFirmado: { ...p.documentoFirmado, url: '/planes/' + p.id + '/documento' } }
          : p))));
      abrir('C-002', 'PL-003');

      expect(raiz.querySelector('.documento a')).toBeNull();
      boton('.documento button', 'Ver documento').click();
      fixture.detectChanges();
      expect(pedir).toHaveBeenCalledOnceWith('PL-003');
      expect(raiz.querySelector('app-document-viewer iframe')?.getAttribute('src')).toBe('blob:documento');

      raiz.querySelector<HTMLButtonElement>('app-document-viewer button[aria-label="Cerrar visor"]')?.click();
      fixture.detectChanges();
      expect(raiz.querySelector('app-document-viewer')).toBeNull();
      expect(revocar).toHaveBeenCalledWith('blob:documento');
    }));
  });

  describe('cierre anticipado', () => {
    /** @returns El boton «Cerrar plan anticipadamente», o `undefined`. */
    function botonCierre(): HTMLButtonElement | undefined {
      return boton('.acciones-botones button', 'Cerrar plan anticipadamente');
    }

    /** Rechaza las dos evidencias en revision de PL-002 (asi no queda ninguna). */
    function sinEvidenciasPorRevisar(): void {
      const planes = TestBed.inject(PlanesMockService);

      esperar(planes.rechazarEvidencia('PL-002', 'A-005', 'Ilegible.'), LATENCIA_SIMULADA_MS * 2);
      esperar(planes.rechazarEvidencia('PL-002', 'A-016', 'Ilegible.'), LATENCIA_SIMULADA_MS * 2);
    }

    it('no aparece en un plan sin vencidas, en borrador ni cerrado', fakeAsync(() => {
      for (const [conflicto, plan] of [['C-002', 'PL-003'], ['C-003', 'PL-004'], ['C-001', 'PL-001']]) {
        abrir(conflicto, plan);
        expect(botonCierre()).withContext(plan).toBeUndefined();
        fixture.destroy();
      }
    }));

    it('con evidencias por revisar se ve deshabilitado (aria-disabled) con la explicación y no abre el modal',
      fakeAsync(() => {
        abrir('C-001', 'PL-002');

        const cierre = botonCierre() as HTMLButtonElement;
        expect(cierre).toBeDefined();
        expect(cierre.getAttribute('aria-disabled')).toBe('true');
        expect(cierre.disabled).withContext('aria-disabled, no disabled').toBeFalse();
        expect(cierre.getAttribute('aria-describedby')).toBe('ayuda-cierre');
        expect(texto('#ayuda-cierre')).toBe(MENSAJE_CIERRE_EN_REVISION);

        cierre.click();
        fixture.detectChanges();
        expect(raiz.querySelector('app-modal .dialogo')).toBeNull();
      }));

    it('exige el motivo, llama a cerrarPlan y recarga el plan cerrado con su tipo y motivo', fakeAsync(() => {
      const planes = TestBed.inject(PlanesMockService);
      sinEvidenciasPorRevisar();
      const cerrar = spyOn(planes, 'cerrarPlan').and.callThrough();
      const recargar = spyOn(planes, 'obtenerPlanesDeConflicto').and.callThrough();
      abrir('C-001', 'PL-002');

      const cierre = botonCierre() as HTMLButtonElement;
      expect(cierre.getAttribute('aria-disabled')).toBe('false');
      cierre.click();
      fixture.detectChanges();
      expect(texto('app-modal .titulo')).toBe('Cerrar plan anticipadamente');
      expect(texto('app-modal .confirmacion-texto')).toContain('quedarán como «No cumplida»');
      expect(texto('app-modal .confirmacion-texto')).toContain('volverá a planificación');

      boton('app-modal button', 'Cerrar plan').click();
      fixture.detectChanges();
      expect(texto('#error-motivo-cierre')).toBe('Escribe el motivo del cierre.');
      expect(cerrar).not.toHaveBeenCalled();

      const motivo = raiz.querySelector('#motivo-cierre') as HTMLTextAreaElement;
      motivo.value = 'Venció el plazo sin avances.';
      motivo.dispatchEvent(new Event('input'));
      boton('app-modal button', 'Cerrar plan').click();
      fixture.detectChanges();
      tick(LATENCIA_SIMULADA_MS * 3);
      fixture.detectChanges();

      expect(cerrar).toHaveBeenCalledOnceWith('PL-002', 'Venció el plazo sin avances.');
      expect(recargar).toHaveBeenCalledTimes(2);
      expect(raiz.querySelector('app-modal .dialogo')).toBeNull();
      expect(texto('.estado-plan')).toBe('Cerrado · Cierre anticipado');
      expect(texto('.cierre-plan')).toBe('Tipo de cierre: Cierre anticipado Motivo: Venció el plazo sin avances.');
      expect(texto('.mensaje--ok')).toContain('Plan cerrado anticipadamente');
      expect(botonCierre()).toBeUndefined();
      expect(texto('app-tabs [aria-selected=true]')).toBe('Plan 02 Cerrado · Cierre anticipado');
    }));

    it('si el servicio no cierra, el modal muestra su motivo', fakeAsync(() => {
      const planes = TestBed.inject(PlanesMockService);
      sinEvidenciasPorRevisar();
      spyOn(planes, 'cerrarPlan').and.returnValue(of({ plan: null, error: 'Hay una evidencia por revisar' }));
      abrir('C-001', 'PL-002');

      (botonCierre() as HTMLButtonElement).click();
      fixture.detectChanges();
      const motivo = raiz.querySelector('#motivo-cierre') as HTMLTextAreaElement;
      motivo.value = 'Motivo';
      motivo.dispatchEvent(new Event('input'));
      boton('app-modal button', 'Cerrar plan').click();
      fixture.detectChanges();

      expect(texto('app-modal .mensaje--error')).toBe('Hay una evidencia por revisar');
      expect(raiz.querySelector('app-modal .dialogo')).not.toBeNull();
    }));
  });
  describe('«Cargar actividades sugeridas»', () => {
    /** @returns Descripciones de las filas de la tabla editable. */
    function descripciones(): string[] {
      return Array.from(raiz.querySelectorAll<HTMLTextAreaElement | HTMLInputElement>('[formcontrolname=descripcion]'))
        .map((c) => c.value);
    }

    it('plan nuevo vacío: carga las sugeridas sin responsable y avisa', fakeAsync(() => {
      analisisValidadoConC005Confirmado();
      abrir('C-005', 'nuevo');
      expect(descripciones()).toEqual([]);

      boton('button', 'Cargar actividades sugeridas').click();
      fixture.detectChanges();
      expect(boton('button', 'Cargando sugeridas')?.disabled).toBeTrue();
      tick(LATENCIA_SIMULADA_MS);
      fixture.detectChanges();

      expect(descripciones().length).toBe(2);
      expect(descripciones()[0]).toMatch(/^Firmar una declaración de excusa/);
      expect(fixture.componentInstance.actividades.controls.map((f) => f.controls.responsableId.value)).toEqual(['', '']);
      expect(fixture.componentInstance.actividades.controls[1].controls.plazoMeses.value).toBe(6);
      expect(texto('.aviso-sugeridas')).toBe(mensajeSugeridasCargadas(2));
      expect(fixture.componentInstance.formulario.dirty).toBeTrue();
    }));

    it('con actividades en la tabla pide confirmación; «Cancelar» no agrega nada', fakeAsync(() => {
      abrir('C-003', 'PL-004');
      const antes = descripciones();

      expect(antes.length).toBeGreaterThan(0);
      boton('button', 'Cargar actividades sugeridas').click();
      fixture.detectChanges();
      expect(texto('app-modal .confirmacion-texto')).toContain('Las sugeridas se agregan al final');

      boton('app-modal button', 'Cancelar').click();
      fixture.detectChanges();
      tick(LATENCIA_SIMULADA_MS);
      expect(descripciones()).toEqual(antes);
    }));

    it('al confirmar, las agrega al final sin tocar las que había', fakeAsync(() => {
      abrir('C-003', 'PL-004');
      const antes = descripciones();

      boton('button', 'Cargar actividades sugeridas').click();
      fixture.detectChanges();
      boton('app-modal button', 'Agregar las sugeridas').click();
      fixture.detectChanges();
      tick(LATENCIA_SIMULADA_MS);
      fixture.detectChanges();

      // C-003 es de riesgo Crítico: 4 sugeridas.
      expect(descripciones().slice(0, antes.length)).toEqual(antes);
      expect(descripciones().length).toBe(antes.length + 4);
      expect(texto('.aviso-sugeridas')).toBe(mensajeSugeridasCargadas(4));
    }));

    it('si falla muestra el motivo del servicio y no cambia la tabla', fakeAsync(() => {
      abrir('C-003', 'PL-004');
      const servicio = TestBed.inject(PlanesMockService);
      const antes = descripciones();

      spyOn(servicio, 'obtenerActividadesSugeridas').and.callFake(() => {
        servicio.ultimoError = 'No tienes permiso para esta acción.';
        return of(null);
      });
      fixture.componentInstance.cargarSugeridas();
      fixture.detectChanges();

      expect(texto('.error-sugeridas')).toBe('No tienes permiso para esta acción.');
      expect(descripciones()).toEqual(antes);
    }));

    it('en solo lectura no aparece el botón', fakeAsync(() => {
      abrir('C-001', 'PL-002');
      expect(boton('button', 'Cargar actividades sugeridas')).toBeUndefined();
    }));
  });
});
