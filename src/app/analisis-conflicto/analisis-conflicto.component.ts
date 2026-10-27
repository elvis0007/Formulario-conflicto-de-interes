import { Component, DestroyRef, OnInit, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { of, switchMap } from 'rxjs';
import {
  PARAMETRO_CLASIFICACION,
  PARAMETRO_PLAN,
  PARAMETRO_RIESGO,
  PLAN_NUEVO,
  VALOR_SIN_PLAN,
  rutaPlanAccion
} from '../app.paths';
import { AnalisisConflictos, Conflicto, FiltroReporte, PlanAccion, ResumenAnalisis } from '../models';
import { FechaLargaPipe } from '../pipes/fecha-larga.pipe';
import { GradoParentescoPipe } from '../pipes/grado-parentesco.pipe';
import { AnalisisMockService } from '../services/analisis-mock.service';
import { BadgeComponent } from '../shared/badge/badge.component';
import { BotonExcelComponent } from '../shared/boton-excel/boton-excel.component';
import { ColumnaTabla, DataTableComponent } from '../shared/data-table/data-table.component';
import { DetalleTablaDirective, FilaTablaDirective } from '../shared/data-table/plantillas-tabla';
import { EmptyStateComponent } from '../shared/empty-state/empty-state.component';
import {
  ExpandArrowButtonComponent
} from '../shared/expand-arrow-button/expand-arrow-button.component';
import { IconoComponent } from '../shared/icono/icono.component';
import { ModalComponent } from '../shared/modal/modal.component';
import { OpcionPill, PillsComponent } from '../shared/pills/pills.component';
import {
  FiltroClasificacion,
  FiltroRiesgo,
  RIESGOS,
  RolesInvolucrados,
  contarPendientes,
  contarPorRiesgo,
  cumpleFiltroClasificacion,
  esFiltroClasificacion,
  filtrarPorRiesgo,
  rolesInvolucrados,
  textoClasificacion,
  textoFiltroClasificacion,
  textoEstadoAnalisis,
  textoRiesgo
} from '../utils/analisis.util';
import { formatearFecha, parsearFecha } from '../utils/fechas.util';
import { TODOS } from '../utils/filtros-listados.util';
import { RELOJ } from '../utils/reloj';
import {
  calcularAvance,
  obtenerPlanActual,
  textoEstadoPlan,
  tieneActividadesVencidas
} from '../utils/planes.util';
import {
  Tono,
  mapearClasificacionATono,
  mapearEstadoAnalisisATono,
  mapearEstadoPlanATono,
  mapearRiesgoATono
} from '../utils/tono.util';
import {
  ClasificacionElegida,
  DetalleConflictoComponent
} from './detalle-conflicto/detalle-conflicto.component';

/** Registros por pagina de la tabla. */
const TAMANO_PAGINA = 5;

/** Opciones de «Mostrar n registros». */
const TAMANOS_PAGINA: readonly number[] = [5, 10, 15];

/** Ruta de la lista real de formularios recibidos (pantalla del host). */
const RUTA_FORMULARIOS = '/admin';

/** Mensaje si no se pudo guardar una clasificacion. */
const ERROR_CLASIFICACION = 'No se pudo guardar la clasificación. Inténtalo de nuevo.';

/** Mensaje si no se pudo validar el analisis. */
const ERROR_VALIDACION = 'No se pudo validar el análisis. Inténtalo de nuevo.';

/** Mensaje si no se pudo generar el analisis. */
const ERROR_GENERACION = 'No se pudo generar el análisis. Inténtalo de nuevo.';

/**
 * Como se muestra la columna «Plan de acción» de un caso:
 * - `archivado`: homonimo.
 * - `pendiente`: sin clasificar; crear plan deshabilitado.
 * - `crear`: confirmado sin planes; crear plan (si el analisis esta
 *   validado).
 * - `uno`: un plan; «Ver plan de acción».
 * - `varios`: tarjeta del plan actual y la lista desplegable.
 */
export type TipoColumnaPlanes = 'archivado' | 'pendiente' | 'crear' | 'uno' | 'varios';

/** Un plan de la columna «Plan de acción», listo para la plantilla. */
export interface VistaPlan {
  plan: PlanAccion;
  /** «Plan 02 · Nombre». */
  titulo: string;
  textoEstado: string;
  tonoEstado: Tono;
  /** «dd/mm/aaaa», o «Sin iniciar» si aun no se envio. */
  inicio: string;
  /** «x de y actividades cumplidas». */
  avance: string;
  /** Si es el plan actual del conflicto. */
  actual: boolean;
  /** URL del plan. */
  ruta: string;
}

/**
 * Una fila de la tabla: el conflicto y lo que la plantilla muestra de el,
 * ya calculado (asi la plantilla no llama funciones en cada deteccion de
 * cambios).
 */
export interface FilaAnalisis {
  conflicto: Conflicto;
  roles: RolesInvolucrados;
  textoRiesgo: string;
  tonoRiesgo: Tono;
  textoClasificacion: string;
  tonoClasificacion: Tono;
  /** Homonimo: la fila se ve atenuada. */
  archivado: boolean;
  tipoPlanes: TipoColumnaPlanes;
  /** Todos los planes del conflicto (del mas antiguo al mas reciente). */
  planes: VistaPlan[];
  /** Plan actual (el no cerrado, o el mas reciente); `null` sin planes. */
  planActual: VistaPlan | null;
}

/**
 * Analisis de Conflictos (PNIP.CI.RG.02):
 *
 * - Encabezado: titulo, codigo, insignia Borrador / Validado, fecha de
 *   generacion, casos pendientes y «Análisis anteriores» (historial).
 *   Botones «Generar análisis» (pide confirmacion si el actual esta
 *   Validado), «Ver formularios», «Descargar Excel» (RG.02 del backend,
 *   con el analisis y el riesgo elegido) y «Validar análisis» (solo sin
 *   pendientes, con confirmacion).
 * - Filtro por riesgo en pildoras con conteos (sobre todos los casos).
 * - Tabla paginada de involucrados con «Ver detalles» (modal con la
 *   clasificacion) y la columna «Plan de acción».
 * - Si nunca se genero un analisis, estado vacio con «Generar análisis».
 *
 * @author Elvis Flores
 */
@Component({
  selector: 'app-analisis-conflicto',
  imports: [
    BadgeComponent,
    BotonExcelComponent,
    DataTableComponent,
    DetalleConflictoComponent,
    DetalleTablaDirective,
    EmptyStateComponent,
    ExpandArrowButtonComponent,
    FechaLargaPipe,
    FilaTablaDirective,
    GradoParentescoPipe,
    IconoComponent,
    ModalComponent,
    PillsComponent,
    RouterLink
  ],
  templateUrl: './analisis-conflicto.component.html',
  styleUrl: './analisis-conflicto.component.scss'
})
export class AnalisisConflictoComponent implements OnInit {
  /** Analisis cargado; `null` mientras llega la primera respuesta. */
  analisis: AnalisisConflictos | null = null;

  /** «Generar análisis» en curso. */
  generando = false;

  /** Riesgo elegido en las pildoras. */
  filtroRiesgo: FiltroRiesgo = TODOS;

  /**
   * Filtro por clasificacion que llega por URL (`?clasificacion=`), p. ej.
   * desde el dashboard de RRHH; `null` = sin filtro.
   */
  filtroClasificacion: FiltroClasificacion | null = null;

  /** Solo casos sin ningun plan (`?plan=sin-plan`). */
  filtroSinPlan = false;

  /** Pildoras de riesgo con sus conteos. */
  opcionesRiesgo: OpcionPill[] = [];

  /** Filas del filtro actual. */
  filasFiltradas: FilaAnalisis[] = [];

  /** Casos pendientes de clasificar (de todo el analisis). */
  pendientes = 0;

  /** Caso abierto en «Ver detalles»; `null` con el modal cerrado. */
  detalle: FilaAnalisis | null = null;

  /** Guardado de la clasificacion en curso. */
  guardandoClasificacion = false;

  /** Error del ultimo guardado de clasificacion. */
  errorClasificacion: string | null = null;

  /**
   * Motivo del ultimo fallo de «Validar análisis» o «Generar análisis»
   * (p. ej. «quedan 2 conflicto(s) sin clasificar»); `null` si no hay.
   */
  errorAccion: string | null = null;

  /** Modal de confirmacion de «Validar análisis». */
  confirmandoValidar = false;

  /** Validacion en curso. */
  validando = false;

  /** Modal de confirmacion de «Generar análisis» sobre un Validado. */
  confirmandoGenerar = false;

  /** Modal «Análisis anteriores». */
  historialAbierto = false;

  /** Analisis anteriores; `null` mientras se cargan. */
  historial: ResumenAnalisis[] | null = null;

  /** Cabeceras de la tabla. */
  readonly columnas: readonly ColumnaTabla[] = [
    { titulo: 'Involucrados', ancho: '28%' },
    { titulo: 'Relación' },
    { titulo: 'Grado' },
    { titulo: 'Departamentos' },
    { titulo: 'Riesgo' },
    { titulo: 'Estado' },
    { titulo: 'Detalles', alinear: 'center' },
    { titulo: 'Plan de acción' }
  ];

  readonly tamanoPagina = TAMANO_PAGINA;
  readonly tamanosPagina = TAMANOS_PAGINA;

  /** Clave de cada fila para la tabla. */
  readonly claveFila = (fila: FilaAnalisis): string => fila.conflicto.id;

  /** Todas las filas del analisis, sin filtrar. */
  private filas: FilaAnalisis[] = [];

  private readonly servicio = inject(AnalisisMockService);
  private readonly router = inject(Router);
  private readonly ruta = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);
  private readonly reloj = inject(RELOJ);

  /**
   * @returns `true` si ya se genero algun analisis.
   */
  get hayAnalisis(): boolean {
    return this.analisis !== null && this.analisis.estado !== null;
  }

  /**
   * @returns `true` si el analisis vigente esta Validado.
   */
  get estaValidado(): boolean {
    return this.analisis?.estado === 'VALIDADO';
  }

  /**
   * @returns `true` si se puede validar: Borrador y sin pendientes.
   */
  get puedeValidar(): boolean {
    return this.analisis?.estado === 'BORRADOR' && this.pendientes === 0 && !this.validando;
  }

  /**
   * @returns Texto de la insignia de estado; `''` si no hay analisis.
   */
  get textoEstado(): string {
    return this.analisis?.estado ? textoEstadoAnalisis(this.analisis.estado) : '';
  }

  /**
   * @returns Tono de la insignia de estado.
   */
  get tonoEstado(): Tono {
    return this.analisis?.estado ? mapearEstadoAnalisisATono(this.analisis.estado) : 'gris';
  }

  /**
   * @returns «n casos pendientes de clasificar», en singular o plural.
   */
  get textoPendientes(): string {
    if (this.pendientes === 0) {
      return 'Todos los casos están clasificados';
    }

    return this.pendientes === 1
      ? '1 caso pendiente de clasificar'
      : this.pendientes + ' casos pendientes de clasificar';
  }

  /**
   * @returns Por que «Validar análisis» esta deshabilitado.
   */
  get ayudaValidar(): string {
    return this.pendientes === 1
      ? 'Clasifica el caso pendiente para poder validar'
      : 'Clasifica los ' + this.pendientes + ' casos pendientes para poder validar';
  }

  /**
   * @returns Titulo del modal «Ver detalles».
   */
  get tituloDetalle(): string {
    const c = this.detalle?.conflicto;

    return c ? 'Conflicto #' + c.id + ' · ' + c.personaA.nombres + ' y ' + c.personaB.nombres : '';
  }

  /**
   * Carga el analisis vigente.
   */
  ngOnInit(): void {
    this.leerFiltrosDeUrl();
    this.servicio.obtenerAnalisisActual()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (analisis) => this.aplicarAnalisis(analisis),
        error: (err: unknown) => console.error('[AnalisisConflictoComponent.ngOnInit]', err)
      });
  }

  /**
   * «Generar análisis»: si el actual esta Validado, primero pide
   * confirmacion; si no, genera directamente.
   */
  generarAnalisis(): void {
    if (this.generando) {
      return;
    }
    if (this.estaValidado) {
      this.confirmandoGenerar = true;
      return;
    }
    this.ejecutarGeneracion();
  }

  /**
   * Confirma «Generar análisis» sobre un analisis Validado.
   */
  confirmarGenerar(): void {
    this.confirmandoGenerar = false;
    this.ejecutarGeneracion();
  }

  /**
   * Abre la lista real de formularios recibidos.
   */
  verFormularios(): void {
    this.router.navigate([RUTA_FORMULARIOS]);
  }

  /**
   * Filtros del Excel (RG.02): el analisis actual y el riesgo elegido. El
   * backend no filtra por clasificacion ni por «sin plan».
   *
   * @returns Filtros para `GET /conflictos/reporte`.
   * @author Elvis Flores
   */
  get filtroExcel(): FiltroReporte {
    return {
      ...(this.analisis?.id ? { analisisId: this.analisis.id } : {}),
      ...(this.filtroRiesgo !== TODOS ? { riesgo: this.filtroRiesgo } : {})
    };
  }

  /**
   * Cambia el filtro de riesgo y filtra la tabla.
   *
   * @param valor Valor de la pildora elegida (`''` = Todos).
   */
  cambiarFiltro(valor: string): void {
    this.filtroRiesgo = valor as FiltroRiesgo;
    this.aplicarFiltro();
  }

  /** @returns Textos de los filtros que llegaron por URL (la franja «Filtrando»). */
  get filtrosUrl(): string[] {
    const textos: string[] = [];

    if (this.filtroClasificacion !== null) {
      textos.push(textoFiltroClasificacion(this.filtroClasificacion));
    }
    if (this.filtroSinPlan) {
      textos.push('Sin plan de acción');
    }
    return textos;
  }

  /**
   * «Limpiar filtros»: quita los filtros de la URL y el de riesgo.
   */
  limpiarFiltros(): void {
    this.filtroClasificacion = null;
    this.filtroSinPlan = false;
    this.filtroRiesgo = TODOS;
    this.aplicarFiltro();
    this.router.navigate([], { relativeTo: this.ruta, queryParams: {} })
      .catch((err: unknown) => console.error('[AnalisisConflictoComponent.limpiarFiltros]', err));
  }

  /**
   * Abre «Ver detalles» de un caso.
   *
   * @param fila Fila del caso.
   */
  abrirDetalle(fila: FilaAnalisis): void {
    this.errorClasificacion = null;
    this.detalle = fila;
  }

  /**
   * Cierra «Ver detalles» (salvo mientras se guarda).
   */
  cerrarDetalle(): void {
    if (this.guardandoClasificacion) {
      return;
    }
    this.detalle = null;
  }

  /**
   * Guarda la clasificacion elegida en el modal, cierra el modal y
   * actualiza la fila, los conteos y los pendientes.
   *
   * @param elegida Clasificacion y observacion.
   */
  guardarClasificacion(elegida: ClasificacionElegida): void {
    const fila = this.detalle;

    if (fila === null || this.guardandoClasificacion || this.estaValidado) {
      return;
    }

    this.guardandoClasificacion = true;
    this.errorClasificacion = null;
    this.servicio.actualizarClasificacion(fila.conflicto.id, elegida.clasificacion, elegida.observacion)
      .pipe(
        switchMap((guardado) => guardado ? this.servicio.obtenerAnalisisActual() : of(null)),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe({
        next: (analisis) => {
          this.guardandoClasificacion = false;
          if (analisis === null) {
            this.errorClasificacion = this.servicio.ultimoError ?? ERROR_CLASIFICACION;
            this.refrescarTrasFallo();
            return;
          }
          this.actualizarAnalisis(analisis);
          this.detalle = null;
        },
        error: (err: unknown) => {
          this.guardandoClasificacion = false;
          this.errorClasificacion = ERROR_CLASIFICACION;
          console.error('[AnalisisConflictoComponent.guardarClasificacion]', err);
        }
      });
  }

  /**
   * «Validar análisis»: pide confirmacion (solo si se puede validar).
   */
  pedirValidacion(): void {
    if (this.puedeValidar) {
      this.confirmandoValidar = true;
    }
  }

  /**
   * Confirma la validacion: el analisis pasa a Validado y la
   * clasificacion queda bloqueada.
   */
  confirmarValidacion(): void {
    if (!this.puedeValidar) {
      return;
    }

    this.validando = true;
    this.errorAccion = null;
    this.servicio.validarAnalisis()
      .pipe(
        switchMap((validado) => validado ? this.servicio.obtenerAnalisisActual() : of(null)),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe({
        next: (analisis) => {
          this.validando = false;
          this.confirmandoValidar = false;
          if (analisis !== null) {
            this.actualizarAnalisis(analisis);
            return;
          }
          this.errorAccion = this.servicio.ultimoError ?? ERROR_VALIDACION;
          this.refrescarTrasFallo();
        },
        error: (err: unknown) => {
          this.validando = false;
          this.confirmandoValidar = false;
          this.errorAccion = ERROR_VALIDACION;
          console.error('[AnalisisConflictoComponent.confirmarValidacion]', err);
        }
      });
  }

  /**
   * Abre «Análisis anteriores» y carga la lista.
   */
  abrirHistorial(): void {
    this.historialAbierto = true;
    this.historial = null;
    this.servicio.obtenerHistorialAnalisis()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (lista) => this.historial = lista,
        error: (err: unknown) => {
          this.historial = [];
          console.error('[AnalisisConflictoComponent.abrirHistorial]', err);
        }
      });
  }

  /**
   * @param estado Estado de un analisis anterior.
   * @returns Texto de su insignia.
   */
  textoEstadoHistorial(estado: ResumenAnalisis['estado']): string {
    return textoEstadoAnalisis(estado);
  }

  /**
   * @param estado Estado de un analisis anterior.
   * @returns Tono de su insignia.
   */
  tonoEstadoHistorial(estado: ResumenAnalisis['estado']): Tono {
    return mapearEstadoAnalisisATono(estado);
  }

  /**
   * «+ Crear plan de acción»: abre la pantalla del plan para crear uno.
   * Solo hace algo si el caso esta confirmado, sin planes, y el analisis
   * esta Validado.
   *
   * @param fila Fila del caso.
   */
  crearPlan(fila: FilaAnalisis): void {
    if (fila.tipoPlanes !== 'crear' || !this.estaValidado) {
      return;
    }
    this.router.navigateByUrl(rutaPlanAccion(fila.conflicto.id, PLAN_NUEVO));
  }

  /**
   * Corre el algoritmo y recarga la tabla. Mientras corre, el boton queda
   * deshabilitado con su estado de carga.
   */
  private ejecutarGeneracion(): void {
    this.generando = true;
    this.errorAccion = null;
    this.servicio.generarAnalisis()
      .pipe(
        switchMap(() => this.servicio.obtenerAnalisisActual()),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe({
        next: (analisis) => {
          this.generando = false;
          this.errorAccion = this.servicio.ultimoError;
          this.aplicarAnalisis(analisis);
        },
        error: (err: unknown) => {
          this.generando = false;
          this.errorAccion = ERROR_GENERACION;
          console.error('[AnalisisConflictoComponent.ejecutarGeneracion]', err);
        }
      });
  }

  /**
   * Tras una accion rechazada por el backend (p. ej. un caso que otro
   * usuario ya clasifico) vuelve a pedir el analisis para que la pantalla
   * muestre lo que realmente hay; el aviso del error se conserva.
   */
  private refrescarTrasFallo(): void {
    this.servicio.obtenerAnalisisActual()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (analisis) => {
          if (analisis.estado !== null) {
            this.actualizarAnalisis(analisis);
          }
        },
        error: (err: unknown) => console.error('[AnalisisConflictoComponent.refrescarTrasFallo]', err)
      });
  }

  /**
   * Guarda un analisis nuevo y recalcula todo (vuelve a la pagina 1).
   *
   * @param analisis Analisis recibido del servicio.
   */
  private aplicarAnalisis(analisis: AnalisisConflictos): void {
    this.analisis = analisis;
    this.filas = analisis.conflictos.map((c) => this.crearFila(c));
    this.recalcularResumen();
    this.aplicarFiltro();
  }

  /**
   * Actualiza el MISMO analisis tras clasificar o validar, sin cambiar de
   * pagina: cada fila existente se actualiza en su lugar (la tabla sigue
   * mostrando los mismos objetos), en vez de reconstruir la lista.
   *
   * @param analisis Analisis recibido del servicio.
   */
  private actualizarAnalisis(analisis: AnalisisConflictos): void {
    const porId = new Map(this.filas.map((f) => [f.conflicto.id, f]));
    const mismosCasos = analisis.conflictos.length === this.filas.length
      && analisis.conflictos.every((c) => porId.has(c.id));

    this.analisis = analisis;
    if (!mismosCasos) {
      this.aplicarAnalisis(analisis);
      return;
    }
    for (const conflicto of analisis.conflictos) {
      Object.assign(porId.get(conflicto.id) as FilaAnalisis, this.crearFila(conflicto));
    }
    this.recalcularResumen();
  }

  /**
   * Recalcula pendientes y pildoras (los conteos son de todos los casos).
   */
  private recalcularResumen(): void {
    const conflictos = this.analisis?.conflictos ?? [];
    const conteo = contarPorRiesgo(conflictos);

    this.pendientes = contarPendientes(conflictos);
    this.opcionesRiesgo = [
      { valor: TODOS, etiqueta: 'Todos', contador: conteo.total },
      ...RIESGOS.map((riesgo): OpcionPill => ({
        valor: riesgo,
        etiqueta: textoRiesgo(riesgo),
        contador: conteo[riesgo],
        tono: mapearRiesgoATono(riesgo)
      }))
    ];
  }

  /**
   * Recalcula las filas visibles segun el filtro de riesgo.
   */
  private aplicarFiltro(): void {
    const ids = new Set(
      filtrarPorRiesgo(this.filas.map((f) => f.conflicto), this.filtroRiesgo)
        .map((c) => c.id)
    );

    this.filasFiltradas = this.filas.filter((f) => ids.has(f.conflicto.id)
      && (this.filtroClasificacion === null || cumpleFiltroClasificacion(f.conflicto, this.filtroClasificacion))
      && (!this.filtroSinPlan || f.conflicto.planes.length === 0));
  }

  /**
   * Lee los filtros de la URL (`?riesgo`, `?clasificacion`, `?plan`); los
   * valores desconocidos se ignoran.
   */
  private leerFiltrosDeUrl(): void {
    const parametros = this.ruta.snapshot.queryParamMap;
    const riesgo = parametros.get(PARAMETRO_RIESGO);
    const clasificacion = parametros.get(PARAMETRO_CLASIFICACION);

    if (RIESGOS.some((r) => r === riesgo)) {
      this.filtroRiesgo = riesgo as FiltroRiesgo;
    }
    if (esFiltroClasificacion(clasificacion)) {
      this.filtroClasificacion = clasificacion;
    }
    this.filtroSinPlan = parametros.get(PARAMETRO_PLAN) === VALOR_SIN_PLAN;
  }

  /**
   * @param conflicto Caso del analisis.
   * @returns La fila de la tabla para ese caso.
   */
  private crearFila(conflicto: Conflicto): FilaAnalisis {
    const actual = obtenerPlanActual(conflicto.planes);
    const planes = [...conflicto.planes]
      .sort((a, b) => a.numero - b.numero)
      .map((plan) => this.crearVistaPlan(conflicto.id, plan, plan === actual));

    return {
      conflicto,
      roles: rolesInvolucrados(conflicto),
      textoRiesgo: textoRiesgo(conflicto.riesgo),
      tonoRiesgo: mapearRiesgoATono(conflicto.riesgo),
      textoClasificacion: textoClasificacion(conflicto.clasificacion),
      tonoClasificacion: mapearClasificacionATono(conflicto.clasificacion),
      archivado: conflicto.clasificacion === 'H',
      tipoPlanes: this.tipoColumnaPlanes(conflicto),
      planes,
      planActual: planes.find((p) => p.actual) ?? null
    };
  }

  /**
   * @param conflicto Caso del analisis.
   * @returns Como se muestra su columna «Plan de acción».
   */
  private tipoColumnaPlanes(conflicto: Conflicto): TipoColumnaPlanes {
    if (conflicto.clasificacion === 'H') {
      return 'archivado';
    }
    if (conflicto.planes.length > 1) {
      return 'varios';
    }
    if (conflicto.planes.length === 1) {
      return 'uno';
    }

    return conflicto.clasificacion === null ? 'pendiente' : 'crear';
  }

  /**
   * @param conflictoId Id del conflicto.
   * @param plan Plan de accion.
   * @param actual Si es el plan actual del conflicto.
   * @returns Lo que la columna muestra del plan.
   */
  private crearVistaPlan(conflictoId: string, plan: PlanAccion, actual: boolean): VistaPlan {
    const avance = calcularAvance(plan.actividades);
    const conVencidas = tieneActividadesVencidas(plan, this.reloj());

    return {
      plan,
      titulo: 'Plan ' + String(plan.numero).padStart(2, '0') + ' · ' + plan.nombre,
      textoEstado: textoEstadoPlan(plan.estado, conVencidas),
      tonoEstado: mapearEstadoPlanATono(plan.estado, conVencidas),
      inicio: this.textoInicio(plan.fechaInicio),
      avance: avance.cumplidas + ' de ' + avance.total + ' actividades cumplidas',
      actual,
      ruta: rutaPlanAccion(conflictoId, plan.id)
    };
  }

  /**
   * @param fechaInicio Fecha de inicio del plan (ISO), si ya se envio.
   * @returns «dd/mm/aaaa» o «Sin iniciar».
   */
  private textoInicio(fechaInicio: string | undefined): string {
    if (!fechaInicio) {
      return 'Sin iniciar';
    }
    try {
      return formatearFecha(parsearFecha(fechaInicio));
    } catch (err) {
      console.error('[AnalisisConflictoComponent.textoInicio] Fecha inválida:', fechaInicio, err);
      return fechaInicio;
    }
  }
}
