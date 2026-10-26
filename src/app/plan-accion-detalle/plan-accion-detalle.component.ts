import { DOCUMENT } from '@angular/common';
import {
  ChangeDetectorRef,
  Component,
  DestroyRef,
  HostListener,
  OnDestroy,
  OnInit,
  inject
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  FormArray,
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  Validators
} from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import {
  Observable, Subject, debounceTime, distinctUntilChanged, forkJoin, map, switchMap
} from 'rxjs';
import { PLAN_NUEVO, RUTAS, rutaPlanAccion } from '../app.paths';
import { ConCambiosSinGuardar } from '../guards/cambios-sin-guardar.guard';
import { Actividad, Conflicto, Persona, PlanAccion } from '../models';
import { PlazoTextoPipe } from '../pipes/plazo-texto.pipe';
import { AnalisisMockService } from '../services/analisis-mock.service';
import { ConflictosMockService } from '../services/conflictos-mock.service';
import { PersonasMockService } from '../services/personas-mock.service';
import { PlanesMockService } from '../services/planes-mock.service';
import { validarDocumentoFirmado } from '../utils/documento.util';
import { RELOJ } from '../utils/reloj';
import { BadgeComponent } from '../shared/badge/badge.component';
import { DocumentViewerComponent } from '../shared/document-viewer/document-viewer.component';
import { EmptyStateComponent } from '../shared/empty-state/empty-state.component';
import { IconoComponent } from '../shared/icono/icono.component';
import { ModalComponent } from '../shared/modal/modal.component';
import { Pestana, TabsComponent } from '../shared/tabs/tabs.component';
import { rolesInvolucrados, textoClasificacion, textoRiesgo } from '../utils/analisis.util';
import { calcularFechaLimite, formatearFecha, parsearFecha } from '../utils/fechas.util';
import {
  ResponsablePlan,
  actividadCompleta,
  hayPlanActivo,
  responsablesDelPlan,
  textoEstadoPlan,
  textoTipoCierre,
  tieneActividadesVencidas
} from '../utils/planes.util';
import {
  Tono,
  mapearEstadoPlanATono,
  mapearEstadoSeguimientoATono,
  mapearRiesgoATono,
  textoEstadoSeguimiento
} from '../utils/tono.util';
import {
  ERROR_PLAZO_CERO,
  ERROR_PLAZO_ENTERO,
  plazoEnteroNoNegativo,
  plazoMayorQueCero
} from '../utils/validadores-plan';

/** Tiempo que se muestra «Borrador guardado», en ms. */
const DURACION_MENSAJE_MS = 3000;

/** Mensaje del boton «+ Nuevo plan» deshabilitado por un plan vigente. */
export const MENSAJE_PLAN_VIGENTE =
  'Solo puede haber un plan activo por conflicto. Cierra el plan actual para crear uno nuevo.';

/** Texto de la fecha limite mientras el plan no tiene fecha de inicio. */
export const TEXTO_SIN_FECHA_LIMITE = 'Se calcula al enviar y notificar';

/** Nota de «+ Nuevo plan» cuando el conflicto ya esta finalizado. */
export const NOTA_REABRE_CONFLICTO =
  'El conflicto está finalizado: crear un plan nuevo lo reabre (vuelve a «En planificación»).';

/** Explicacion del cierre anticipado deshabilitado por evidencias por revisar. */
export const MENSAJE_CIERRE_EN_REVISION =
  'Hay evidencias por revisar: apruébalas o recházalas en Revisión de Evidencias antes de cerrar el plan.';

/** Mensajes genericos si una accion falla sin motivo del servicio. */
const ERROR_GUARDADO = 'No se pudo guardar el borrador. Inténtalo de nuevo.';
const ERROR_ENVIO = 'No se pudo enviar el plan. Revisa que esté completo e inténtalo de nuevo.';
const ERROR_CIERRE_GENERICO = 'No se pudo cerrar el plan. Inténtalo de nuevo.';

/**
 * Clase que la pantalla pone en <body> mientras esta abierta: activa las
 * reglas de impresion de styles.scss que ocultan cabecera, menu y pie.
 */
export const CLASE_BODY_IMPRIMIBLE = 'con-plan-imprimible';

/** Aviso tras «Enviar y notificar» (firma y notificacion en un solo paso). */
export const AVISO_ENVIADO = 'Plan firmado y notificado a la bandeja de tareas de cada responsable. '
  + 'El plazo de las actividades corre desde hoy.';

/** Estado de la pantalla. */
type EstadoPantalla = 'cargando' | 'no-encontrado' | 'bloqueado' | 'listo';

/** Controles de una fila de actividad. */
interface FormActividad {
  id: FormControl<string>;
  descripcion: FormControl<string>;
  responsableId: FormControl<string>;
  plazoMeses: FormControl<number | null>;
  plazoDias: FormControl<number | null>;
}

/** Formulario del plan. */
interface FormPlan {
  nombre: FormControl<string>;
  actividades: FormArray<FormGroup<FormActividad>>;
}

/** Banner «Fecha de inicio del plan». */
interface BannerInicio {
  texto: string;
  tono: Tono;
}

/** Datos que se cargan al entrar. */
interface DatosPlan {
  conflicto: Conflicto | undefined;
  planes: PlanAccion[];
  personas: Persona[];
  analisisValidado: boolean;
}

/**
 * Plan de Acción (PNIP.CI.FR.02).
 *
 * Ruta: `/rrhh/conflictos/:conflictoId/planes/:planId`. Con
 * `planId = nuevo` prepara un plan en borrador sin guardar, solo si el
 * caso esta confirmado, el analisis validado y el conflicto no tiene un
 * plan vigente; si no, muestra los motivos.
 *
 * DECISION: el conflicto se toma del ANALISIS ACTUAL
 * (`AnalisisMockService`), porque ahi estan su clasificacion y si el
 * analisis esta validado, que deciden si se puede crear un plan. Si el
 * caso no esta en el analisis actual (o no se ha generado ninguno), se usa
 * `ConflictosMockService` para poder mostrar igual sus planes existentes.
 *
 * Flujo (sin firma electronica): armar el plan, imprimirlo
 * («Imprimir formulario», con estilos @media print), firmarlo a mano,
 * escanearlo, subir el PDF («Documento del plan») y «Enviar y notificar».
 * El backend firma en un solo paso: el PDF elegido no se registra hasta
 * «Enviar y notificar», que firma el plan, avisa a los responsables y
 * arranca el plazo de las actividades ese dia.
 *
 * Cierre anticipado (RRHH): un plan `FIRMADO` con actividades vencidas y
 * sin evidencias por revisar se puede cerrar con un motivo; las no
 * aceptadas quedan «No cumplida» y el conflicto vuelve a planificacion.
 *
 * Los documentos (firmado o recien elegido) se ven en el visor
 * (`app-document-viewer`): el del backend se pide con token.
 *
 * @author Elvis Flores
 */
@Component({
  selector: 'app-plan-accion-detalle',
  imports: [
    BadgeComponent,
    DocumentViewerComponent,
    EmptyStateComponent,
    IconoComponent,
    ModalComponent,
    PlazoTextoPipe,
    ReactiveFormsModule,
    RouterLink,
    TabsComponent
  ],
  templateUrl: './plan-accion-detalle.component.html',
  styleUrl: './plan-accion-detalle.component.scss'
})
export class PlanAccionDetalleComponent implements OnInit, OnDestroy, ConCambiosSinGuardar {
  /** Estado de la pantalla. */
  estado: EstadoPantalla = 'cargando';

  /** Caso del plan. */
  conflicto: Conflicto | null = null;

  /** Planes guardados del conflicto, por numero. */
  planes: PlanAccion[] = [];

  /** Plan que se muestra (uno nuevo sin guardar tiene `id` vacio). */
  plan: PlanAccion | null = null;

  /** Empleados que pueden ser responsables. */
  personas: Persona[] = [];

  /** Resultado de la última búsqueda de responsables. */
  encontradas: Persona[] = [];

  /** Texto escrito en el buscador de responsables. */
  private readonly busqueda = new Subject<string>();

  /** Motivos por los que no se puede crear un plan nuevo. */
  motivosBloqueo: string[] = [];

  /** Pestanas de «Planes de este conflicto». */
  pestanas: Pestana[] = [];

  /** Guardado en curso. */
  guardando = false;

  /** Se intento guardar: muestra los errores de todos los campos. */
  intentoGuardar = false;

  /** «Borrador guardado» visible. */
  mensajeGuardado = false;

  /** Error del ultimo guardado. */
  errorGuardado: string | null = null;

  /** Modal «Cambios sin guardar» abierto. */
  confirmandoSalida = false;

  /** Error del ultimo documento elegido (tipo o tamano). */
  errorDocumento: string | null = null;

  /** Subida o retiro del documento en curso. */
  procesandoDocumento = false;

  /** Modal de confirmacion de «Enviar y notificar» abierto. */
  confirmandoEnvio = false;

  /** Envio en curso. */
  enviando = false;

  /** Error del ultimo envio. */
  errorEnvio: string | null = null;

  /** Se acaba de enviar el plan: muestra el aviso de notificacion. */
  enviado = false;

  /** Modal «Cerrar plan anticipadamente» abierto. */
  confirmandoCierre = false;

  /** Motivo escrito para el cierre anticipado. */
  motivoCierre = '';

  /** Se intento cerrar sin motivo. */
  motivoCierreFaltante = false;

  /** Cierre en curso. */
  cerrando = false;

  /** Error del ultimo cierre (se muestra en el modal). */
  errorCierre: string | null = null;

  /** Se acaba de cerrar el plan: muestra el aviso. */
  cerradoAhora = false;

  /** Visor del documento del plan abierto. */
  viendoDocumento = false;

  /** Fecha que sale en el formulario impreso (dd/mm/aaaa). */
  fechaImpresion = '';

  readonly avisoEnviado = AVISO_ENVIADO;

  readonly rutaAnalisis = RUTAS.rrhh.analisisConflictos;
  readonly mensajePlanVigente = MENSAJE_PLAN_VIGENTE;
  readonly notaReabreConflicto = NOTA_REABRE_CONFLICTO;
  readonly mensajeCierreEnRevision = MENSAJE_CIERRE_EN_REVISION;
  readonly textoSinFechaLimite = TEXTO_SIN_FECHA_LIMITE;
  readonly errorPlazoEntero = ERROR_PLAZO_ENTERO;
  readonly errorPlazoCero = ERROR_PLAZO_CERO;

  /** Formulario del plan (solo se usa si es editable). */
  readonly formulario = new FormGroup<FormPlan>({
    nombre: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.maxLength(150)] }),
    actividades: new FormArray<FormGroup<FormActividad>>([])
  });

  /** Respuesta pendiente del modal de salida. */
  private respuestaSalida: Subject<boolean> | null = null;

  /** Temporizador de «Borrador guardado». */
  private temporizadorMensaje: ReturnType<typeof setTimeout> | null = null;

  private readonly ruta = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private readonly analisisServicio = inject(AnalisisMockService);
  private readonly conflictosServicio = inject(ConflictosMockService);
  private readonly planesServicio = inject(PlanesMockService);
  private readonly personasServicio = inject(PersonasMockService);
  private readonly reloj = inject(RELOJ);
  private readonly documento = inject(DOCUMENT);
  private readonly cdr = inject(ChangeDetectorRef);

  /** @returns Filas de actividades del formulario. */
  get actividades(): FormArray<FormGroup<FormActividad>> {
    return this.formulario.controls.actividades;
  }

  /** @returns `true` si el plan es nuevo (aun no se guardo). */
  get esNuevo(): boolean {
    return this.plan !== null && this.plan.id === '';
  }

  /** @returns `true` si el plan se puede editar (solo en borrador). */
  get editable(): boolean {
    return this.plan?.estado === 'BORRADOR';
  }

  /** @returns `true` si hay un plan vigente en el conflicto. */
  get hayPlanVigente(): boolean {
    return hayPlanActivo(this.planes);
  }

  /** @returns `true` si «+ Nuevo plan» esta habilitado. */
  get puedeCrearPlan(): boolean {
    return !this.hayPlanVigente && !this.esNuevo;
  }

  /** @returns «Plan 02 · Nombre (2 de 2)». */
  get tituloPlan(): string {
    const plan = this.plan;
    const total = this.planes.length + (this.esNuevo ? 1 : 0);
    const nombre = (this.editable ? this.formulario.controls.nombre.value : plan?.nombre ?? '').trim();

    if (plan === null) {
      return '';
    }

    return 'Plan ' + String(plan.numero).padStart(2, '0') + ' · ' + (nombre || 'Sin nombre')
      + ' (' + plan.numero + ' de ' + total + ')';
  }

  /** @returns Texto de la insignia de estado del plan (con el tipo de cierre). */
  get textoEstado(): string {
    return this.plan ? textoEstadoPlan(this.plan.estado, this.conVencidas(this.plan), this.plan.tipoCierre) : '';
  }

  /** @returns Tono de la insignia de estado del plan. */
  get tonoEstado(): Tono {
    return this.plan
      ? mapearEstadoPlanATono(this.plan.estado, this.conVencidas(this.plan), this.plan.tipoCierre)
      : 'gris';
  }

  /** @returns Texto del estado de seguimiento del conflicto. */
  get textoSeguimiento(): string {
    return this.conflicto ? textoEstadoSeguimiento(this.conflicto.estado) : '';
  }

  /** @returns Tono del estado de seguimiento del conflicto. */
  get tonoSeguimiento(): Tono {
    return this.conflicto ? mapearEstadoSeguimientoATono(this.conflicto.estado) : 'gris';
  }

  /**
   * @returns `true` si «+ Nuevo plan» reabriria el conflicto (esta
   * `FINALIZADO` y se puede crear un plan).
   */
  get nuevoPlanReabre(): boolean {
    return this.conflicto?.estado === 'FINALIZADO' && this.puedeCrearPlan;
  }

  /**
   * «Cerrar plan anticipadamente» se ofrece en un plan `FIRMADO` con
   * actividades vencidas (mismas reglas que el backend).
   *
   * @returns `true` si se muestra el boton.
   */
  get muestraCierreAnticipado(): boolean {
    return this.plan !== null && tieneActividadesVencidas(this.plan, this.reloj());
  }

  /**
   * @returns `true` si el cierre esta bloqueado porque alguna actividad
   * esta en revision (el boton se ve deshabilitado, con la explicacion).
   */
  get cierreBloqueadoPorRevision(): boolean {
    return this.plan?.actividades.some((a) => a.estado === 'EN_REVISION') ?? false;
  }

  /** @returns Texto de como se cerro el plan; vacio si no esta cerrado. */
  get textoCierre(): string {
    return this.plan?.estado === 'CERRADO' ? textoTipoCierre(this.plan.tipoCierre) : '';
  }

  /**
   * @param plan Plan.
   * @returns `true` si esta en ejecucion con actividades vencidas hoy.
   */
  private conVencidas(plan: PlanAccion): boolean {
    return tieneActividadesVencidas(plan, this.reloj());
  }

  /** @returns Valor de la pestana activa. */
  get pestanaActiva(): string {
    return this.plan?.id || PLAN_NUEVO;
  }

  /** @returns Banner «Fecha de inicio del plan». */
  get bannerInicio(): BannerInicio {
    const plan = this.plan;

    if (plan === null || plan.estado === 'BORRADOR' || !plan.fechaInicio) {
      return { texto: 'Pendiente · se registra al enviar y notificar', tono: 'ambar' };
    }
    if (plan.estado === 'CERRADO') {
      return {
        texto: this.fecha(plan.fechaInicio) + ' · cerrado el ' + this.fecha(plan.fechaCierre),
        tono: 'gris'
      };
    }

    return { texto: this.fecha(plan.fechaInicio) + ' · plan enviado y notificado', tono: 'verde' };
  }

  /** @returns Texto «Parentesco» de la tarjeta del caso. */
  get parentesco(): string {
    if (this.conflicto === null) {
      return '';
    }

    const roles = rolesInvolucrados(this.conflicto);

    return roles.tipo === 'simetrica' ? roles.etiqueta : roles.rolA + ' – ' + roles.rolB;
  }

  /** @returns Texto del riesgo del caso. */
  get textoRiesgo(): string {
    return this.conflicto ? textoRiesgo(this.conflicto.riesgo) : '';
  }

  /** @returns Tono del riesgo del caso. */
  get tonoRiesgo(): Tono {
    return this.conflicto ? mapearRiesgoATono(this.conflicto.riesgo) : 'gris';
  }

  /** @returns `true` si hay cambios sin guardar. */
  get tieneCambiosSinGuardar(): boolean {
    return this.editable && this.formulario.dirty;
  }

  /**
   * «Imprimir formulario»: en borrador, guardado, sin cambios pendientes y
   * con al menos una actividad completa; activos y cerrados, siempre.
   *
   * @returns `true` si se puede imprimir.
   */
  get puedeImprimir(): boolean {
    const plan = this.plan;

    if (plan === null) {
      return false;
    }
    if (!this.editable) {
      return true;
    }

    return !this.esNuevo && !this.formulario.dirty && plan.actividades.some((a) => actividadCompleta(a));
  }

  /**
   * Lo que falta para «Enviar y notificar» (se evalua sobre el plan
   * guardado). Vacio si se puede enviar.
   *
   * @returns Mensajes, en el orden en que conviene resolverlos.
   */
  get faltasParaEnviar(): string[] {
    const plan = this.plan;
    const faltas: string[] = [];
    let incompletas = 0;

    if (plan === null || !this.editable) {
      return faltas;
    }
    if (this.esNuevo || this.formulario.dirty) {
      faltas.push('Guarda los cambios');
    }

    incompletas = plan.actividades.filter((a) => !actividadCompleta(a)).length;
    if (plan.actividades.length === 0) {
      faltas.push('Agrega al menos una actividad');
    } else if (incompletas === 1) {
      faltas.push('Completa la actividad con datos faltantes');
    } else if (incompletas > 1) {
      faltas.push('Completa las ' + incompletas + ' actividades con datos faltantes');
    }
    if (!plan.documentoFirmado) {
      faltas.push('Sube el documento firmado');
    }

    return faltas;
  }

  /** @returns `true` si «Enviar y notificar» esta habilitado. */
  get puedeEnviar(): boolean {
    return this.editable && !this.enviando && this.faltasParaEnviar.length === 0;
  }

  /** @returns Responsables distintos del plan guardado. */
  get responsables(): ResponsablePlan[] {
    return this.plan ? responsablesDelPlan(this.plan.actividades) : [];
  }

  /**
   * Texto de la confirmacion de «Enviar y notificar». El backend firma y
   * notifica en un solo paso, y el plazo de las actividades corre desde
   * ese dia.
   *
   * @returns El texto.
   */
  get textoConfirmacionEnvio(): string {
    const n = this.responsables.length;

    return 'Al enviar, el plan queda firmado con el documento subido y se notifica a ' + n
      + (n === 1 ? ' responsable' : ' responsables') + '. El plazo de cada actividad empieza a correr hoy ('
      + formatearFecha(this.reloj()) + '): las fechas límite se calculan desde ese día. '
      + 'Después ya no podrás editar el plan.';
  }

  /** @returns «archivo.pdf — subido el dd/mm/aaaa». */
  get textoDocumento(): string {
    const doc = this.plan?.documentoFirmado;

    if (!doc) {
      return '';
    }

    return doc.fechaSubida ? doc.nombre + ' — subido el ' + this.fecha(doc.fechaSubida) : doc.nombre;
  }

  /**
   * Carga el conflicto, sus planes y los empleados cada vez que cambia la
   * URL (la pantalla se reutiliza al cambiar de pestana).
   */
  ngOnInit(): void {
    this.busqueda
      .pipe(
        debounceTime(300),
        distinctUntilChanged(),
        switchMap((t) => this.personasServicio.buscarPersonas(t)),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe((lista) => this.encontradas = lista);

    this.documento.body.classList.add(CLASE_BODY_IMPRIMIBLE);
    this.ruta.paramMap
      .pipe(
        switchMap((parametros) => {
          const conflictoId = parametros.get('conflictoId') ?? '';
          const planId = parametros.get('planId') ?? '';

          this.estado = 'cargando';
          return this.cargarDatos(conflictoId).pipe(map((datos) => ({ datos, planId })));
        }),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe({
        next: ({ datos, planId }) => this.aplicarDatos(datos, planId),
        error: (err: unknown) => {
          this.estado = 'no-encontrado';
          console.error('[PlanAccionDetalleComponent.ngOnInit]', err);
        }
      });
  }

  /**
   * Detiene el temporizador y responde «quedarse» si el modal de salida
   * seguia abierto.
   */
  ngOnDestroy(): void {
    this.documento.body.classList.remove(CLASE_BODY_IMPRIMIBLE);
    this.limpiarMensaje();
    this.responderSalida(false);
  }

  /**
   * Avisa del navegador al recargar o cerrar la pestana con cambios.
   *
   * @param evento Evento `beforeunload`.
   */
  @HostListener('window:beforeunload', ['$event'])
  alSalirDelNavegador(evento: BeforeUnloadEvent): void {
    if (this.tieneCambiosSinGuardar) {
      evento.preventDefault();
    }
  }

  /**
   * Guard `canDeactivate`: sin cambios sale; con cambios abre el modal y
   * responde cuando el usuario elige.
   *
   * @returns `true` para salir, `false` para quedarse.
   */
  puedeSalir(): boolean | Observable<boolean> {
    if (!this.tieneCambiosSinGuardar) {
      return true;
    }

    this.responderSalida(false);
    this.respuestaSalida = new Subject<boolean>();
    this.confirmandoSalida = true;
    return this.respuestaSalida.asObservable();
  }

  /**
   * Respuesta del modal «Cambios sin guardar».
   *
   * @param salir `true` = salir sin guardar; `false` = seguir editando.
   */
  responderSalida(salir: boolean): void {
    const respuesta = this.respuestaSalida;

    this.confirmandoSalida = false;
    this.respuestaSalida = null;
    if (respuesta !== null) {
      respuesta.next(salir);
      respuesta.complete();
    }
  }

  /**
   * Cambio de pestana: navega a la URL de ese plan.
   *
   * @param valor Id del plan, o `PLAN_NUEVO`.
   */
  irAPlan(valor: string): void {
    if (this.conflicto !== null) {
      this.router.navigateByUrl(rutaPlanAccion(this.conflicto.id, valor));
    }
  }

  /**
   * «+ Nuevo plan»: navega a `.../planes/nuevo` si esta permitido.
   */
  nuevoPlan(): void {
    if (this.puedeCrearPlan) {
      this.irAPlan(PLAN_NUEVO);
    }
  }

  /**
   * «+ Agregar actividad».
   */
  agregarActividad(): void {
    this.actividades.push(this.crearFilaActividad());
    this.formulario.markAsDirty();
  }

  /**
   * Quita una actividad.
   *
   * @param indice Posicion de la fila.
   */
  quitarActividad(indice: number): void {
    this.actividades.removeAt(indice);
    this.formulario.markAsDirty();
  }

  /**
   * @param fila Fila de actividad.
   * @returns `true` si la fila tiene errores y ya se deben mostrar.
   */
  filaConErrores(fila: FormGroup<FormActividad>): boolean {
    return fila.invalid && (fila.touched || this.intentoGuardar);
  }

  /**
   * @param control Control del formulario.
   * @returns `true` si su error ya se debe mostrar.
   */
  mostrarError(control: FormControl<unknown>): boolean {
    return control.invalid && (control.touched || this.intentoGuardar);
  }

  /**
   * @param fila Fila de actividad.
   * @returns `true` si el error «el plazo no puede ser 0» se debe mostrar.
   */
  mostrarPlazoCero(fila: FormGroup<FormActividad>): boolean {
    return fila.hasError(ERROR_PLAZO_CERO)
      && (fila.controls.plazoMeses.touched || fila.controls.plazoDias.touched || this.intentoGuardar);
  }

  /**
   * Fecha limite de una actividad del plan mostrado.
   *
   * @param meses Meses de plazo.
   * @param dias Dias de plazo.
   * @returns `dd/mm/aaaa` si el plan tiene fecha de inicio y el plazo es
   * valido; `TEXTO_SIN_FECHA_LIMITE` si aun no tiene inicio; `—` si el
   * plazo no es valido.
   */
  fechaLimite(meses: number | null, dias: number | null): string {
    if (!this.plan?.fechaInicio) {
      return TEXTO_SIN_FECHA_LIMITE;
    }
    try {
      return calcularFechaLimite(this.plan.fechaInicio, Number(meses ?? 0), Number(dias ?? 0));
    } catch (err) {
      console.error('[PlanAccionDetalleComponent.fechaLimite]', err);
      return '—';
    }
  }

  /**
   * «Guardar borrador». Solo exige el nombre del plan; las actividades
   * pueden quedar incompletas (se marcan las filas con errores). Al
   * guardar por primera vez un plan nuevo, la URL pasa a su id real.
   */
  guardarBorrador(): void {
    const plan = this.plan;
    const nombre = this.formulario.controls.nombre;

    if (plan === null || !this.editable || this.guardando) {
      return;
    }

    this.intentoGuardar = true;
    this.formulario.markAllAsTouched();
    this.errorGuardado = null;
    if (nombre.invalid) {
      return;
    }

    this.guardando = true;
    this.planesServicio.guardarBorrador(this.planDesdeFormulario(plan))
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (guardado) => {
          this.guardando = false;
          if (guardado === null) {
            this.errorGuardado = this.planesServicio.ultimoError ?? ERROR_GUARDADO;
            return;
          }
          this.alGuardar(plan, guardado);
        },
        error: (err: unknown) => {
          this.guardando = false;
          this.errorGuardado = ERROR_GUARDADO;
          console.error('[PlanAccionDetalleComponent.guardarBorrador]', err);
        }
      });
  }

  /**
   * «Imprimir formulario»: abre la impresion del navegador. Los estilos
   * @media print dejan solo la version para firmar (`.impresion`).
   */
  imprimir(): void {
    if (!this.puedeImprimir) {
      return;
    }
    this.fechaImpresion = formatearFecha(this.reloj());
    this.cdr.detectChanges();
    window.print();
  }

  /**
   * El usuario eligio un archivo: lo valida y, si es valido, lo sube.
   *
   * @param evento `change` del input de archivo.
   */
  alElegirDocumento(evento: Event): void {
    const input = evento.target as HTMLInputElement;
    const archivo = input.files?.[0] ?? null;
    const plan = this.plan;

    input.value = '';
    if (archivo === null || plan === null || !this.editable || this.esNuevo) {
      return;
    }

    this.errorDocumento = validarDocumentoFirmado(archivo);
    if (this.errorDocumento !== null) {
      return;
    }

    this.procesandoDocumento = true;
    this.planesServicio.subirDocumentoFirmado(plan.id, archivo)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (resultado) => {
          this.procesandoDocumento = false;
          this.errorDocumento = resultado.error;
          if (resultado.plan && this.plan) {
            this.plan = { ...this.plan, documentoFirmado: resultado.plan.documentoFirmado };
          }
        },
        error: (err: unknown) => {
          this.procesandoDocumento = false;
          this.errorDocumento = 'No se pudo subir el documento. Inténtalo de nuevo.';
          console.error('[PlanAccionDetalleComponent.alElegirDocumento]', err);
        }
      });
  }

  /**
   * «Quitar» el documento firmado (solo en borrador).
   */
  quitarDocumento(): void {
    const plan = this.plan;

    if (plan === null || !this.editable || this.procesandoDocumento) {
      return;
    }

    this.procesandoDocumento = true;
    this.errorDocumento = null;
    this.planesServicio.quitarDocumentoFirmado(plan.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (actualizado) => {
          this.procesandoDocumento = false;
          if (actualizado === null) {
            this.errorDocumento = this.planesServicio.ultimoError ?? 'No se pudo quitar el documento. Inténtalo de nuevo.';
            return;
          }
          if (this.plan) {
            const { documentoFirmado: _quitado, ...sinDocumento } = this.plan;
            this.plan = sinDocumento;
          }
        },
        error: (err: unknown) => {
          this.procesandoDocumento = false;
          this.errorDocumento = 'No se pudo quitar el documento. Inténtalo de nuevo.';
          console.error('[PlanAccionDetalleComponent.quitarDocumento]', err);
        }
      });
  }

  /**
   * «Enviar y notificar»: pide confirmacion (si se puede enviar).
   */
  pedirEnvio(): void {
    if (this.puedeEnviar) {
      this.errorEnvio = null;
      this.confirmandoEnvio = true;
    }
  }

  /**
   * Confirma el envio: el plan pasa a activo, queda en solo lectura y se
   * avisa a los responsables.
   */
  confirmarEnvio(): void {
    const plan = this.plan;

    if (plan === null || !this.puedeEnviar) {
      return;
    }

    this.enviando = true;
    this.planesServicio.enviarYNotificar(plan.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (activo) => {
          this.enviando = false;
          this.confirmandoEnvio = false;
          if (activo === null) {
            this.errorEnvio = this.planesServicio.ultimoError ?? ERROR_ENVIO;
            return;
          }
          this.plan = activo;
          this.planes = this.planes.map((p) => p.id === activo.id ? activo : p);
          this.pestanas = this.crearPestanas();
          this.cargarFormulario(activo);
          this.enviado = true;
          // Firmar pasa el conflicto a EN_EJECUCION: se vuelve a pedir.
          this.conflictosServicio.obtenerConflictoPorId(activo.conflictoId)
            .pipe(takeUntilDestroyed(this.destroyRef))
            .subscribe((c) => this.conflicto = c ?? this.conflicto);
        },
        error: (err: unknown) => {
          this.enviando = false;
          this.confirmandoEnvio = false;
          this.errorEnvio = 'No se pudo enviar el plan. Inténtalo de nuevo.';
          console.error('[PlanAccionDetalleComponent.confirmarEnvio]', err);
        }
      });
  }

  /**
   * «Cerrar plan anticipadamente»: abre el modal del motivo. No hace nada
   * si el boton esta deshabilitado (evidencias por revisar).
   *
   * @author Sebas Constante
   */
  pedirCierre(): void {
    if (!this.muestraCierreAnticipado || this.cierreBloqueadoPorRevision) {
      return;
    }
    this.motivoCierre = '';
    this.motivoCierreFaltante = false;
    this.errorCierre = null;
    this.confirmandoCierre = true;
  }

  /**
   * Cierra el modal del cierre anticipado sin cerrar el plan.
   *
   * @author Sebas Constante
   */
  cancelarCierre(): void {
    if (!this.cerrando) {
      this.confirmandoCierre = false;
    }
  }

  /**
   * Guarda el motivo escrito.
   *
   * @param evento `input` del textarea.
   * @author Sebas Constante
   */
  alEscribirMotivoCierre(evento: Event): void {
    this.motivoCierre = (evento.target as HTMLTextAreaElement).value;
    if (this.motivoCierre.trim() !== '') {
      this.motivoCierreFaltante = false;
    }
  }

  /**
   * Confirma el cierre anticipado (motivo obligatorio). Si sale bien,
   * vuelve a cargar el conflicto y sus planes: el backend cambia el plan,
   * sus actividades y el estado del conflicto.
   *
   * @author Sebas Constante
   */
  confirmarCierre(): void {
    const plan = this.plan;
    const motivo = this.motivoCierre.trim();

    if (plan === null || this.cerrando) {
      return;
    }
    if (motivo === '') {
      this.motivoCierreFaltante = true;
      return;
    }

    this.cerrando = true;
    this.errorCierre = null;
    this.planesServicio.cerrarPlan(plan.id, motivo)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (resultado) => {
          this.cerrando = false;
          if (resultado.plan === null) {
            this.errorCierre = resultado.error || ERROR_CIERRE_GENERICO;
            return;
          }
          this.confirmandoCierre = false;
          this.recargar(plan.conflictoId, resultado.plan.id);
        },
        error: (err: unknown) => {
          this.cerrando = false;
          this.errorCierre = ERROR_CIERRE_GENERICO;
          console.error('[PlanAccionDetalleComponent.confirmarCierre]', err);
        }
      });
  }

  /**
   * @param persona Empleado.
   * @returns Texto de la opcion del select de responsables.
   */
  textoPersona(persona: Persona): string {
    return persona.cargo ? persona.nombres + ' · ' + persona.cargo : persona.nombres;
  }

  /**
   * @param conflicto Caso del plan.
   * @returns Departamentos de A y B, sin separadores sueltos cuando falta
   *   alguno (p. ej. personal sin unidad en nómina).
   * @author Sebas Constante
   */
  departamentos(conflicto: Conflicto): string {
    return [conflicto.personaA.departamento, conflicto.personaB.departamento]
      .filter((d) => d.trim() !== '')
      .join(' · ') || 'No disponible';
  }

  /**
   * Opciones del select de responsables: los que ya tiene el plan, los
   * cargados al abrir y los de la última búsqueda (con el backend no hay
   * listado completo del personal: se busca).
   *
   * @returns Personas sin repetir.
   * @author Sebas Constante
   */
  get opcionesResponsable(): Persona[] {
    const vistas = new Map<string, Persona>();
    for (const a of this.plan?.actividades ?? []) {
      if (a.responsableId) {
        vistas.set(a.responsableId, {
          id: a.responsableId, nombres: a.responsableNombre,
          cedula: '', cargo: '', departamento: ''
        });
      }
    }
    for (const p of [...this.personas, ...this.encontradas]) {
      vistas.set(p.id, p);
    }
    return [...vistas.values()];
  }

  /**
   * @param termino Texto del buscador de responsables.
   * @author Sebas Constante
   */
  buscarResponsable(termino: string): void {
    this.busqueda.next(termino);
  }

  /**
   * Tras guardar: confirma, deja el formulario sin cambios pendientes y, si
   * era nuevo, cambia la URL al id real.
   *
   * @param antes Plan antes de guardar.
   * @param guardado Plan guardado por el servicio.
   */
  private alGuardar(antes: PlanAccion, guardado: PlanAccion): void {
    const eraNuevo = antes.id === '';

    this.mostrarMensajeGuardado();
    this.plan = guardado;
    this.formulario.markAsPristine();
    this.intentoGuardar = false;

    if (eraNuevo && this.conflicto !== null) {
      this.router.navigateByUrl(rutaPlanAccion(this.conflicto.id, guardado.id), { replaceUrl: true });
      return;
    }

    this.planes = this.planes.map((p) => p.id === guardado.id ? guardado : p);
    this.pestanas = this.crearPestanas();
  }

  /**
   * @param conflictoId Id del conflicto.
   * @returns Todo lo que necesita la pantalla, en paralelo.
   */
  private cargarDatos(conflictoId: string): Observable<DatosPlan> {
    return forkJoin({
      analisis: this.analisisServicio.obtenerAnalisisActual(),
      conflicto: this.conflictosServicio.obtenerConflictoPorId(conflictoId),
      planes: this.planesServicio.obtenerPlanesDeConflicto(conflictoId),
      personas: this.personasServicio.obtenerPersonas()
    }).pipe(
      map(({ analisis, conflicto, planes, personas }) => ({
        conflicto: analisis.conflictos.find((c) => c.id === conflictoId) ?? conflicto,
        planes,
        personas,
        analisisValidado: analisis.estado === 'VALIDADO'
      }))
    );
  }

  /**
   * Tras el cierre anticipado: vuelve a pedir el conflicto y sus planes
   * (el plan, sus actividades y el estado del conflicto cambiaron) y avisa
   * que se cerro.
   *
   * @param conflictoId Conflicto del plan.
   * @param planId Plan que se cerro.
   * @author Sebas Constante
   */
  private recargar(conflictoId: string, planId: string): void {
    this.cargarDatos(conflictoId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (datos) => {
          this.aplicarDatos(datos, planId);
          this.cerradoAhora = true;
        },
        error: (err: unknown) => {
          this.estado = 'no-encontrado';
          console.error('[PlanAccionDetalleComponent.recargar]', err);
        }
      });
  }

  /**
   * Decide que mostrar segun lo cargado y el `planId` de la URL.
   *
   * @param datos Datos cargados.
   * @param planId `:planId` de la URL.
   */
  private aplicarDatos(datos: DatosPlan, planId: string): void {
    this.conflicto = datos.conflicto ?? null;
    this.planes = datos.planes;
    this.personas = datos.personas;
    this.motivosBloqueo = [];
    this.intentoGuardar = false;
    this.errorGuardado = null;
    this.errorDocumento = null;
    this.errorEnvio = null;
    this.enviado = false;
    this.cerradoAhora = false;
    this.confirmandoCierre = false;
    this.viendoDocumento = false;
    this.plan = null;

    if (this.conflicto === null) {
      this.estado = 'no-encontrado';
      return;
    }

    if (planId === PLAN_NUEVO) {
      this.motivosBloqueo = this.motivosParaNoCrear(this.conflicto, datos);
      if (this.motivosBloqueo.length > 0) {
        this.estado = 'bloqueado';
        return;
      }
      this.plan = this.crearPlanNuevo(this.conflicto.id);
    } else {
      this.plan = this.planes.find((p) => p.id === planId) ?? null;
      if (this.plan === null) {
        this.estado = 'no-encontrado';
        return;
      }
    }

    this.pestanas = this.crearPestanas();
    this.cargarFormulario(this.plan);
    this.estado = 'listo';
  }

  /**
   * @param conflicto Caso.
   * @param datos Datos cargados.
   * @returns Motivos por los que no se puede crear un plan (vacio si se
   * puede).
   */
  private motivosParaNoCrear(conflicto: Conflicto, datos: DatosPlan): string[] {
    const motivos: string[] = [];
    const vigente = datos.planes.find((p) => hayPlanActivo([p]));

    if (conflicto.clasificacion !== 'D' && conflicto.clasificacion !== 'N') {
      motivos.push('El caso no está confirmado como conflicto de interés (hoy: «'
        + textoClasificacion(conflicto.clasificacion) + '»). Clasifícalo en Análisis de Conflictos.');
    }
    if (!datos.analisisValidado) {
      motivos.push('El análisis de conflictos no está validado. Valídalo en Análisis de Conflictos.');
    }
    if (vigente !== undefined) {
      motivos.push('El conflicto ya tiene un plan vigente (Plan '
        + String(vigente.numero).padStart(2, '0') + ' · ' + vigente.nombre + '). ' + MENSAJE_PLAN_VIGENTE);
    }

    return motivos;
  }

  /**
   * @param conflictoId Id del conflicto.
   * @returns Plan nuevo en borrador, sin guardar (`id` vacio).
   */
  private crearPlanNuevo(conflictoId: string): PlanAccion {
    return {
      id: '',
      numero: this.planes.reduce((max, p) => Math.max(max, p.numero), 0) + 1,
      nombre: '',
      conflictoId,
      estado: 'BORRADOR',
      actividades: []
    };
  }

  /**
   * @returns Una pestana por plan (con su estado) y «Nuevo plan» si se
   * esta creando uno.
   */
  private crearPestanas(): Pestana[] {
    const pestanas: Pestana[] = this.planes.map((p) => ({
      valor: p.id,
      etiqueta: 'Plan ' + String(p.numero).padStart(2, '0'),
      atenuada: p.estado === 'CERRADO',
      insignia: {
        texto: textoEstadoPlan(p.estado, this.conVencidas(p), p.tipoCierre),
        tono: mapearEstadoPlanATono(p.estado, this.conVencidas(p), p.tipoCierre)
      }
    }));

    if (this.esNuevo) {
      pestanas.push({
        valor: PLAN_NUEVO,
        etiqueta: 'Nuevo plan',
        insignia: { texto: textoEstadoPlan('BORRADOR'), tono: mapearEstadoPlanATono('BORRADOR') }
      });
    }

    return pestanas;
  }

  /**
   * Llena el formulario con el plan y lo deja sin cambios pendientes.
   *
   * @param plan Plan mostrado.
   */
  private cargarFormulario(plan: PlanAccion): void {
    this.actividades.clear();
    this.formulario.controls.nombre.setValue(plan.nombre);
    for (const actividad of plan.actividades) {
      this.actividades.push(this.crearFilaActividad(actividad));
    }
    this.formulario.markAsPristine();
    this.formulario.markAsUntouched();
  }

  /**
   * @param actividad Actividad existente (o ninguna para una fila vacia).
   * @returns Fila del formulario con sus validaciones.
   */
  private crearFilaActividad(actividad?: Actividad): FormGroup<FormActividad> {
    return new FormGroup<FormActividad>({
      id: new FormControl(actividad?.id ?? '', { nonNullable: true }),
      descripcion: new FormControl(actividad?.descripcion ?? '', {
        nonNullable: true,
        validators: [Validators.required, Validators.maxLength(500)]
      }),
      responsableId: new FormControl(actividad?.responsableId ?? '', {
        nonNullable: true,
        validators: [Validators.required]
      }),
      plazoMeses: new FormControl<number | null>(actividad?.plazoMeses ?? 0, [plazoEnteroNoNegativo]),
      plazoDias: new FormControl<number | null>(actividad?.plazoDias ?? 0, [plazoEnteroNoNegativo])
    }, { validators: [plazoMayorQueCero('plazoMeses', 'plazoDias')] });
  }

  /**
   * @param plan Plan antes de guardar.
   * @returns El plan con el nombre y las actividades del formulario.
   */
  private planDesdeFormulario(plan: PlanAccion): PlanAccion {
    const valor = this.formulario.getRawValue();
    const previas = new Map(plan.actividades.map((a) => [a.id, a]));

    return {
      ...plan,
      nombre: valor.nombre.trim(),
      actividades: valor.actividades.map((fila): Actividad => {
        const responsable = this.opcionesResponsable.find((p) => p.id === fila.responsableId);

        return {
          ...(previas.get(fila.id) ?? { estado: 'PENDIENTE' as const }),
          id: fila.id,
          descripcion: fila.descripcion.trim(),
          responsableId: fila.responsableId,
          responsableNombre: responsable?.nombres ?? '',
          plazoMeses: this.entero(fila.plazoMeses),
          plazoDias: this.entero(fila.plazoDias)
        };
      })
    };
  }

  /**
   * @param valor Valor de un input numerico.
   * @returns El numero, o 0 si esta vacio o no es un numero.
   */
  private entero(valor: number | null): number {
    const numero = Number(valor);

    return valor === null || !Number.isFinite(numero) ? 0 : numero;
  }

  /**
   * @param iso Fecha ISO opcional.
   * @returns `dd/mm/aaaa`, o `—` si falta o no es valida.
   */
  private fecha(iso: string | undefined): string {
    if (!iso) {
      return '—';
    }
    try {
      return formatearFecha(parsearFecha(iso));
    } catch (err) {
      console.error('[PlanAccionDetalleComponent.fecha] Fecha inválida:', iso, err);
      return '—';
    }
  }

  /**
   * Muestra «Borrador guardado» unos segundos.
   */
  private mostrarMensajeGuardado(): void {
    this.limpiarMensaje();
    this.mensajeGuardado = true;
    this.temporizadorMensaje = setTimeout(() => {
      this.mensajeGuardado = false;
      this.temporizadorMensaje = null;
    }, DURACION_MENSAJE_MS);
  }

  /**
   * Detiene el temporizador de «Borrador guardado».
   */
  private limpiarMensaje(): void {
    if (this.temporizadorMensaje !== null) {
      clearTimeout(this.temporizadorMensaje);
      this.temporizadorMensaje = null;
    }
  }
}
