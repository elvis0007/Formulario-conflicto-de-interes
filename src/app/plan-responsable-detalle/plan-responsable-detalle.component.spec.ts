import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { ActivatedRoute, ParamMap, convertToParamMap, provideRouter } from '@angular/router';
import { BehaviorSubject, map, of } from 'rxjs';
import { ConflictosMockService } from '../services/conflictos-mock.service';
import { LATENCIA_SIMULADA_MS } from '../services/mock-data/simular-respuesta';
import { PerfilUsuarioService } from '../services/perfil-usuario.service';
import { PlanesMockService } from '../services/planes-mock.service';
import { PerfilUsuarioFalso, proveerPerfilFalso } from '../testing/perfil-usuario-falso';
import { ERROR_EVIDENCIA_GRANDE, ERROR_EVIDENCIA_TIPO } from '../utils/documento.util';
import { RELOJ } from '../utils/reloj';
import { PlanResponsableDetalleComponent } from './plan-responsable-detalle.component';

describe('PlanResponsableDetalleComponent', () => {
  /** «Hoy» fijo: 2 de octubre de 2026, 10:00. */
  const HOY = new Date(2026, 9, 2, 10, 0);
  let fixture: ComponentFixture<PlanResponsableDetalleComponent>;
  let raiz: HTMLElement;
  let parametros: BehaviorSubject<ParamMap>;

  /**
   * @param texto Texto.
   * @returns Sin espacios repetidos.
   */
  function limpio(texto: string | null | undefined): string {
    return (texto ?? '').replace(/\s+/g, ' ').trim();
  }

  /**
   * @param planId Plan de la URL.
   */
  function crear(planId: string): void {
    parametros.next(convertToParamMap({ planId }));
    fixture = TestBed.createComponent(PlanResponsableDetalleComponent);
    raiz = fixture.nativeElement;
    document.body.appendChild(raiz);
    fixture.detectChanges();
    // Plan y, despues, su caso.
    tick(LATENCIA_SIMULADA_MS * 2);
    fixture.detectChanges();
  }

  /**
   * @param descripcion Comienzo de la descripcion.
   * @returns La tarjeta de la actividad.
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
   * @param texto Comienzo del texto del boton.
   * @returns El boton, o `undefined`.
   */
  function boton(contenedor: HTMLElement, texto: string): HTMLButtonElement | undefined {
    return Array.from(contenedor.querySelectorAll('button')).find((b) => limpio(b.textContent).startsWith(texto));
  }

  /**
   * Elige un archivo para una actividad (como lo haria el selector del
   * sistema) y espera la subida.
   *
   * @param descripcion Actividad.
   * @param archivo Archivo elegido.
   */
  function subir(descripcion: string, archivo: File): void {
    const input = raiz.querySelector('input[type=file]') as HTMLInputElement;
    const datos = new DataTransfer();

    if (!jasmine.isSpy(input.click)) {
      spyOn(input, 'click');
    }
    boton(actividad(descripcion), 'Subir evidencia')?.click()
      ?? boton(actividad(descripcion), 'Volver a subir')?.click();
    datos.items.add(archivo);
    input.files = datos.files;
    input.dispatchEvent(new Event('change'));
    tick(LATENCIA_SIMULADA_MS * 2);
    fixture.detectChanges();
  }

  beforeEach(() => {
    parametros = new BehaviorSubject(convertToParamMap({}));
    TestBed.configureTestingModule({
      imports: [PlanResponsableDetalleComponent],
      providers: [
        provideRouter([]),
        { provide: ActivatedRoute, useValue: { paramMap: parametros } },
        { provide: RELOJ, useValue: () => new Date(HOY) },
        proveerPerfilFalso(new PerfilUsuarioFalso(['responsable'], 'EMP-010', 'Fernando José Andrade Vela'))
      ]
    });
    spyOn(URL, 'createObjectURL').and.returnValue('blob:prueba');
  });

  afterEach(() => raiz?.remove());

  it('cabecera, tarjeta del caso y solo SUS actividades', fakeAsync(() => {
    crear('PL-002');

    expect(limpio(raiz.querySelector('.volver')?.textContent)).toBe('← Volver a Bandeja de Tareas');
    expect(raiz.querySelector('.volver')?.getAttribute('href')).toBe('/responsable/planes');
    expect(limpio(raiz.querySelector('.codigo')?.textContent)).toBe('PNIP.CI.FR.02 · Conflicto #C-001');
    expect(limpio(raiz.querySelector('h2.titulo')?.textContent)).toBe('Plan 02 · Rotación del técnico de compras Activo · con vencidas');
    expect(limpio(raiz.querySelector('.dato')?.textContent)).toBe('Inicio del plan: 01/06/2026');
    expect(limpio(raiz.querySelector('.aviso--info')?.textContent))
      .toBe('Solo ves las actividades que te corresponden (4 de 7).');

    // Solo sus actividades: ninguna de otros responsables.
    expect(raiz.querySelectorAll('.actividad').length).toBe(4);
    expect(raiz.querySelector('.actividades')?.textContent).not.toContain('Rotar al técnico');
  }));

  it('tarjeta compacta del caso con los datos de la bandeja: personas, parentesco y riesgo', fakeAsync(() => {
    const conflictos = spyOn(TestBed.inject(ConflictosMockService), 'obtenerConflictoPorId').and.callThrough();
    crear('PL-002');

    const caso = raiz.querySelector('.caso') as HTMLElement;
    expect(Array.from(caso.querySelectorAll('.caso-persona')).map((p) => [
      limpio(p.querySelector('.caso-rol')?.textContent),
      limpio(p.querySelector('.caso-nombre')?.textContent)
    ])).toEqual([
      ['Empleado', 'Carlos Andrés Mayorga Sánchez'],
      ['Familiar', 'Jorge Luis Mayorga Sánchez']
    ]);
    expect(caso.querySelector('.caso-cargo')).withContext('la bandeja no trae cargo ni departamento').toBeNull();
    expect(limpio(caso.querySelector('.caso-parentesco')?.textContent)).toBe('Hermanos · Consanguinidad, 2do grado');
    expect(limpio(caso.querySelector('app-badge')?.textContent)).toBe('Riesgo alto');
    expect(conflictos).withContext('el rol P recibe 403 en /conflictos').not.toHaveBeenCalled();
  }));

  it('sin datos del caso en la bandeja: «No disponible»', fakeAsync(() => {
    const planes = TestBed.inject(PlanesMockService);
    const original = planes.obtenerPlanDeResponsable.bind(planes);
    spyOn(planes, 'obtenerPlanDeResponsable').and.callFake((planId: string, empleadoId: string) =>
      original(planId, empleadoId).pipe(map((d) => d && { ...d, nombreB: '', parentesco: '', riesgo: null })));
    crear('PL-002');

    const caso = raiz.querySelector('.caso') as HTMLElement;
    expect(limpio(caso.querySelectorAll('.caso-nombre')[1]?.textContent)).toBe('No disponible');
    expect(limpio(caso.querySelector('.caso-parentesco')?.textContent)).toBe('No disponible');
    expect(caso.querySelector('app-badge')).toBeNull();
  }));

  it('tarjeta del caso con roles distintos (tío / sobrino)', fakeAsync(() => {
    crear('PL-003');

    expect(limpio(raiz.querySelector('.caso-parentesco')?.textContent)).toBe('Tío / Sobrino · Consanguinidad, 3er grado');
    expect(limpio(raiz.querySelector('.caso app-badge')?.textContent)).toBe('Riesgo moderado');
  }));

  it('estado con los textos del Responsable, plazo y fecha límite con días', fakeAsync(() => {
    crear('PL-002');

    const vencida = actividad('Entregar el inventario');
    expect(limpio(vencida.querySelector('app-badge')?.textContent)).toBe('Pendiente');
    expect(vencida.querySelector('.fecha-limite--vencida')).not.toBeNull();
    expect(limpio(vencida.querySelector('.fecha-limite')?.textContent)).toBe('01/09/2026 · Vencida hace 31 días');
    expect(boton(vencida, 'Subir evidencia')).toBeDefined();

    const pendiente = actividad('Capacitar al personal');
    expect(limpio(pendiente.querySelector('.datos')?.textContent)).toContain('4 meses y 25 días');
    expect(limpio(pendiente.querySelector('.fecha-limite')?.textContent)).toBe('26/10/2026 · Vence en 24 días');
    expect(pendiente.querySelector('.fecha-limite--vencida')).toBeNull();

    const rechazada = actividad('Activar el registro');
    expect(limpio(rechazada.querySelector('app-badge')?.textContent)).toBe('Rechazada');
    expect(limpio(rechazada.querySelector('.motivo')?.textContent))
      .toBe('Motivo del rechazo: La captura no muestra la fecha en que se activó el registro.');
    expect(boton(rechazada, 'Volver a subir')).toBeDefined();

    const aprobada = actividad('Restringir los permisos');
    expect(limpio(aprobada.querySelector('.aprobada')?.textContent)).toBe('Aprobada por Lucía Alejandra Freire Ortiz el 25/06/2026');
    expect(boton(aprobada, 'Subir evidencia')).toBeUndefined();
  }));

  it('en revisión: archivo, «En revisión de RRHH» y «Ver evidencia» en el visor', fakeAsync(() => {
    crear('PL-003');

    const enRevision = actividad('Retirar al superintendente');
    expect(limpio(enRevision.querySelector('app-badge')?.textContent)).toBe('En revisión de RRHH');
    expect(limpio(enRevision.querySelector('.archivo')?.textContent)).toContain('A-008-captura-sistema.png — subida el');
    expect(boton(enRevision, 'Subir evidencia')).toBeUndefined();

    boton(enRevision, 'Ver evidencia')?.click();
    fixture.detectChanges();
    expect(limpio(raiz.querySelector('.dialogo .titulo')?.textContent)).toBe('Evidencia de la actividad');
    expect(limpio(raiz.querySelector('app-document-viewer')?.textContent)).toContain('A-008-captura-sistema.png');
  }));

  /** Usuario R+P: ve el documento firmado del plan. */
  function comoRrhhYResponsable(): void {
    TestBed.overrideProvider(PerfilUsuarioService, {
      useValue: new PerfilUsuarioFalso(['rrhh', 'responsable'], 'EMP-010', 'Fernando José Andrade Vela')
    });
  }

  it('solo P: no ofrece «Ver documento del plan» (el backend solo deja a RRHH)', fakeAsync(() => {
    crear('PL-002');

    expect(boton(raiz, 'Ver documento del plan')).toBeUndefined();
    fixture.componentInstance.verDocumentoPlan();
    fixture.detectChanges();
    expect(raiz.querySelector('app-document-viewer')).toBeNull();
  }));

  it('R+P: «Ver documento del plan» abre el documento firmado', fakeAsync(() => {
    comoRrhhYResponsable();
    crear('PL-002');

    boton(raiz, 'Ver documento del plan')?.click();
    fixture.detectChanges();
    expect(limpio(raiz.querySelector('app-document-viewer')?.textContent)).toContain('PL-002-plan-firmado.pdf');
  }));

  it('subir evidencia a una pendiente la deja «En revisión de RRHH»', fakeAsync(() => {
    crear('PL-002');

    subir('Capacitar al personal', new File(['x'], 'capacitacion.pdf', { type: 'application/pdf' }));
    const tarjeta = actividad('Capacitar al personal');
    expect(limpio(tarjeta.querySelector('app-badge')?.textContent)).toBe('En revisión de RRHH');
    expect(limpio(tarjeta.querySelector('.archivo')?.textContent)).toContain('capacitacion.pdf');
    expect(boton(tarjeta, 'Subir evidencia')).toBeUndefined();
  }));

  it('volver a subir una rechazada la reemplaza', fakeAsync(() => {
    crear('PL-002');

    subir('Activar el registro', new File(['x'], 'auditoria-v2.png', { type: 'image/png' }));
    const tarjeta = actividad('Activar el registro');
    expect(limpio(tarjeta.querySelector('app-badge')?.textContent)).toBe('En revisión de RRHH');
    expect(tarjeta.querySelector('.motivo')).toBeNull();
    expect(limpio(tarjeta.querySelector('.archivo')?.textContent)).toContain('auditoria-v2.png');
  }));

  it('errores visibles si el archivo no es PDF/PNG/JPG o supera 5 MB', fakeAsync(() => {
    crear('PL-002');

    subir('Capacitar al personal', new File(['x'], 'notas.txt', { type: 'text/plain' }));
    expect(limpio(actividad('Capacitar al personal').querySelector('.error')?.textContent)).toBe(ERROR_EVIDENCIA_TIPO);

    const grande = new File([new Uint8Array(5 * 1024 * 1024 + 1)], 'foto.png', { type: 'image/png' });
    subir('Capacitar al personal', grande);
    expect(limpio(actividad('Capacitar al personal').querySelector('.error')?.textContent)).toBe(ERROR_EVIDENCIA_GRANDE);
    expect(limpio(actividad('Capacitar al personal').querySelector('app-badge')?.textContent)).toBe('Pendiente');
  }));

  it('R+P: «Ver documento del plan» pide el documento al servicio (no usa la URL directa)', fakeAsync(() => {
    comoRrhhYResponsable();
    const planes = TestBed.inject(PlanesMockService);
    const pedir = spyOn(planes, 'obtenerDocumentoPlan').and.returnValue(of(new Blob(['%PDF'])));
    const original = planes.obtenerPlanDeResponsable.bind(planes);
    spyOn(planes, 'obtenerPlanDeResponsable').and.callFake((planId: string, empleadoId: string) =>
      original(planId, empleadoId).pipe(map((d) => d && {
        ...d,
        plan: { ...d.plan, documentoFirmado: { nombre: 'plan.pdf', url: '/planes/PL-002/documento', tipo: 'pdf' as const } }
      })));
    crear('PL-002');

    boton(raiz, 'Ver documento del plan')?.click();
    fixture.detectChanges();
    expect(pedir).toHaveBeenCalledOnceWith('PL-002');
    expect(raiz.querySelector('app-document-viewer iframe')?.getAttribute('src')).toBe('blob:prueba');
  }));

  it('plan cerrado: solo lectura, con cómo se cerró', fakeAsync(() => {
    crear('PL-006');

    expect(limpio(raiz.querySelector('.aviso--cerrado')?.textContent)).toContain('Solo lectura');
    expect(limpio(raiz.querySelector('.aviso--cerrado')?.textContent)).toContain('todas las actividades fueron aprobadas');
    expect(limpio(raiz.querySelector('h2.titulo app-badge')?.textContent)).toBe('Cerrado · Cumplido');
    expect(boton(raiz, 'Subir evidencia')).toBeUndefined();
    expect(boton(raiz, 'Volver a subir')).toBeUndefined();
  }));

  it('un plan ajeno, en borrador o inexistente: «No se encontró el plan»', fakeAsync(() => {
    for (const planId of ['PL-001', 'PL-007', 'PL-999']) {
      crear(planId);
      expect(limpio(raiz.querySelector('.no-encontrado h2')?.textContent)).withContext(planId).toBe('No se encontró el plan');
      expect(raiz.querySelector('.actividad')).withContext(planId).toBeNull();
      expect(raiz.querySelector('.caso')).withContext(planId).toBeNull();
      raiz.remove();
    }
  }));
});
