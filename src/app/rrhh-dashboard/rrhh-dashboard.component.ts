import { Component, DestroyRef, OnInit, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Params, Router, RouterLink } from '@angular/router';
import { forkJoin } from 'rxjs';
import {
  PARAMETRO_CLASIFICACION,
  PARAMETRO_CONFLICTO,
  PARAMETRO_ESTADO,
  PARAMETRO_PLAN,
  PARAMETRO_RIESGO,
  RUTAS,
  VALOR_SIN_PLAN,
  rutaPlanAccion
} from '../app.paths';
import { AnalisisConflictos, PlanAccion } from '../models';
import { FechaLargaPipe } from '../pipes/fecha-larga.pipe';
import { AnalisisMockService } from '../services/analisis-mock.service';
import { HistorialMockService } from '../services/historial-mock.service';
import { PlanesMockService } from '../services/planes-mock.service';
import { BadgeComponent } from '../shared/badge/badge.component';
import { EmptyStateComponent } from '../shared/empty-state/empty-state.component';
import { KpiCardComponent } from '../shared/kpi-card/kpi-card.component';
import { textoEstadoAnalisis } from '../utils/analisis.util';
import {
  BarraDistribucion,
  IndicadoresRrhh,
  ItemAtencion,
  SegmentoEstado,
  calcularIndicadores,
  distribucionEstadoPlanes,
  distribucionPorRiesgo,
  estadoDeActividades,
  requiereAtencion
} from '../utils/dashboard-rrhh.util';
import { formatearFecha, parsearFecha } from '../utils/fechas.util';
import { EventoReciente, TipoEvento, tonoTipoEvento } from '../utils/historial.util';
import { RELOJ } from '../utils/reloj';
import { Tono, mapearEstadoAnalisisATono } from '../utils/tono.util';

/** Cuantos eventos muestra «Actividad reciente». */
export const EVENTOS_RECIENTES = 8;

/** Cuantas actividades de cada tipo muestra «Requiere atención». */
export const ITEMS_ATENCION = 4;

/** Un indicador clicable. */
export interface IndicadorDashboard {
  clave: keyof IndicadoresRrhh;
  titulo: string;
  valor: number;
  tono?: Tono;
  ruta: string;
  parametros: Params;
}

/** Filtro del Informe General para cada estado de plan del grafico. */
const FILTRO_INFORME_POR_ESTADO: Readonly<Record<string, string>> = {
  FIRMADO: 'en-ejecucion',
  FIRMADO_VENCIDAS: 'con-vencidas',
  CERRADO: 'cerrados'
};

/**
 * Dashboard de RRHH (especificacion §6.2).
 *
 * - Estado del analisis vigente (Borrador / Validado, fecha) con enlace.
 * - Indicadores clicables: cada uno abre su pantalla ya filtrada
 *   (Análisis con `?clasificacion`/`?plan`, Revisión de Evidencias,
 *   Informe General con `?estado`).
 * - Distribucion de conflictos por riesgo y de planes por estado (barras
 *   HTML/CSS clicables, con su numero y texto accesible) y estado de las
 *   actividades (barra apilada con leyenda).
 * - «Requiere atención»: vencidas y evidencias por revisar mas antiguas.
 * - «Actividad reciente»: ultimos eventos de `HistorialMockService`.
 *
 * Todo sale de los servicios mock existentes. Si nunca se genero el
 * analisis, muestra el estado vacio con «Generar análisis».
 *
 * La §6.2 propone ademas un selector de periodo, una tarjeta de formularios
 * y una tabla de conflictos filtrada por los indicadores; se siguio el
 * prompt del Dia 12 (los indicadores llevan a cada pantalla). Ver bitacora.
 *
 * @author Elvis Flores
 */
@Component({
  selector: 'app-rrhh-dashboard',
  imports: [BadgeComponent, EmptyStateComponent, FechaLargaPipe, KpiCardComponent, RouterLink],
  templateUrl: './rrhh-dashboard.component.html',
  styleUrl: './rrhh-dashboard.component.scss'
})
export class RrhhDashboardComponent implements OnInit {
  /** Todavia no llego la respuesta. */
  cargando = true;

  /** «Generar análisis» en curso. */
  generando = false;

  /** Analisis vigente. */
  analisis: AnalisisConflictos | null = null;

  /** Indicadores clicables. */
  indicadores: IndicadorDashboard[] = [];

  /** Conflictos por riesgo. */
  porRiesgo: BarraDistribucion[] = [];

  /** Planes por estado. */
  porEstadoPlan: BarraDistribucion[] = [];

  /** Barra apilada de actividades. */
  actividades: SegmentoEstado[] = [];

  /** Total de actividades de la barra apilada. */
  totalActividades = 0;

  /** Vencidas mas antiguas. */
  vencidas: ItemAtencion[] = [];

  /** Evidencias que mas esperan. */
  evidencias: ItemAtencion[] = [];

  /** Ultimos eventos. */
  recientes: EventoReciente[] = [];

  readonly rutaAnalisis = RUTAS.rrhh.analisisConflictos;
  readonly rutaHistorial = RUTAS.rrhh.historial;
  readonly rutaRevision = RUTAS.rrhh.revisionEvidencias;

  private readonly analisisServicio = inject(AnalisisMockService);
  private readonly planesServicio = inject(PlanesMockService);
  private readonly historialServicio = inject(HistorialMockService);
  private readonly router = inject(Router);
  private readonly reloj = inject(RELOJ);
  private readonly destroyRef = inject(DestroyRef);

  /** @returns `true` si ya hay un analisis generado. */
  get hayAnalisis(): boolean {
    return this.analisis?.estado != null;
  }

  /** @returns Texto del estado del analisis. */
  get textoEstadoAnalisis(): string {
    return this.analisis?.estado ? textoEstadoAnalisis(this.analisis.estado) : '';
  }

  /** @returns Tono del estado del analisis. */
  get tonoEstadoAnalisis(): Tono {
    return this.analisis?.estado ? mapearEstadoAnalisisATono(this.analisis.estado) : 'gris';
  }

  /**
   * Carga el analisis, los planes y los eventos recientes.
   */
  ngOnInit(): void {
    this.cargar();
  }

  /**
   * «Generar análisis» desde el estado vacio.
   */
  generarAnalisis(): void {
    if (this.generando) {
      return;
    }
    this.generando = true;
    this.analisisServicio.generarAnalisis()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.generando = false;
          this.cargar();
        },
        error: (err: unknown) => {
          this.generando = false;
          console.error('[RrhhDashboardComponent.generarAnalisis]', err);
        }
      });
  }

  /**
   * Abre la pantalla de un indicador con su filtro.
   *
   * @param indicador Indicador elegido.
   */
  irA(indicador: IndicadorDashboard): void {
    this.navegar(indicador.ruta, indicador.parametros);
  }

  /**
   * Barra de riesgo: Análisis filtrado por ese riesgo.
   *
   * @param barra Barra elegida.
   */
  irARiesgo(barra: BarraDistribucion): void {
    this.navegar(this.rutaAnalisis, { [PARAMETRO_RIESGO]: barra.clave });
  }

  /**
   * @param barra Barra de estado de plan.
   * @returns `true` si lleva a un filtro del Informe General.
   */
  esEstadoNavegable(barra: BarraDistribucion): boolean {
    return FILTRO_INFORME_POR_ESTADO[barra.clave] !== undefined;
  }

  /**
   * Barra de estado de plan: Informe General con ese estado.
   *
   * @param barra Barra elegida.
   */
  irAEstadoPlan(barra: BarraDistribucion): void {
    const estado = FILTRO_INFORME_POR_ESTADO[barra.clave];

    if (estado !== undefined) {
      this.navegar(RUTAS.rrhh.informeGeneral, { [PARAMETRO_ESTADO]: estado });
    }
  }

  /** @param item Vencida. @returns URL de su plan en Plan de Acción. */
  rutaPlan(item: ItemAtencion): string {
    return rutaPlanAccion(item.plan.conflictoId, item.plan.id);
  }

  /** @param conflictoId Conflicto. @returns Parametros que abren su modal. */
  parametrosConflicto(conflictoId: string): Params {
    return { [PARAMETRO_CONFLICTO]: conflictoId };
  }

  /** @param plan Plan. @returns «Conflicto #C-001 · Plan 02». */
  referencia(plan: PlanAccion): string {
    return 'Conflicto #' + plan.conflictoId + ' · Plan ' + String(plan.numero).padStart(2, '0');
  }

  /** @param iso Fecha. @returns «dd/mm/aaaa». */
  fecha(iso: string): string {
    try {
      return formatearFecha(parsearFecha(iso));
    } catch (err) {
      console.error('[RrhhDashboardComponent.fecha] Fecha inválida:', iso, err);
      return iso;
    }
  }

  /** @param tipo Tipo de evento. @returns Color de su punto. */
  tonoEvento(tipo: TipoEvento): Tono {
    return tonoTipoEvento(tipo);
  }

  /** @param s Segmento. @returns Texto accesible y tooltip. */
  textoSegmento(s: SegmentoEstado): string {
    return s.etiqueta + ': ' + this.cantidad(s.valor, 'actividad', 'actividades');
  }

  /**
   * @param n Cantidad.
   * @param singular Palabra en singular.
   * @param plural Palabra en plural.
   * @returns «1 plan», «3 planes».
   */
  cantidad(n: number, singular: string, plural: string): string {
    return n + ' ' + (n === 1 ? singular : plural);
  }

  /**
   * Pide todo y recalcula.
   */
  private cargar(): void {
    forkJoin({
      analisis: this.analisisServicio.obtenerAnalisisActual(),
      planes: this.planesServicio.obtenerPlanes(),
      recientes: this.historialServicio.obtenerEventosRecientes(EVENTOS_RECIENTES)
    })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: ({ analisis, planes, recientes }) => {
          this.cargando = false;
          this.analisis = analisis;
          this.recientes = recientes;
          this.calcular(analisis, planes);
        },
        error: (err: unknown) => {
          this.cargando = false;
          console.error('[RrhhDashboardComponent.cargar]', err);
        }
      });
  }

  /**
   * @param analisis Analisis vigente.
   * @param planes Todos los planes.
   */
  private calcular(analisis: AnalisisConflictos, planes: PlanAccion[]): void {
    const i = calcularIndicadores(analisis.conflictos, planes, this.reloj());
    const atencion = requiereAtencion(planes, this.reloj(), ITEMS_ATENCION);
    const analisisR = this.rutaAnalisis;
    const informe = RUTAS.rrhh.informeGeneral;

    this.indicadores = [
      { clave: 'detectados', titulo: 'Conflictos detectados', valor: i.detectados, ruta: analisisR, parametros: {} },
      { clave: 'pendientes', titulo: 'Pendientes de clasificar', valor: i.pendientes, tono: 'ambar', ruta: analisisR,
        parametros: { [PARAMETRO_CLASIFICACION]: 'SIN_CLASIFICAR' } },
      { clave: 'confirmadosSinPlan', titulo: 'Confirmados sin plan', valor: i.confirmadosSinPlan, tono: 'naranja', ruta: analisisR,
        parametros: { [PARAMETRO_CLASIFICACION]: 'D_O_N', [PARAMETRO_PLAN]: VALOR_SIN_PLAN } },
      { clave: 'planesActivos', titulo: 'Planes activos', valor: i.planesActivos, tono: 'azul', ruta: informe,
        parametros: { [PARAMETRO_ESTADO]: 'en-ejecucion' } },
      { clave: 'actividadesVencidas', titulo: 'Actividades vencidas', valor: i.actividadesVencidas, tono: 'rojo', ruta: informe,
        parametros: { [PARAMETRO_ESTADO]: 'con-vencidas' } },
      { clave: 'evidenciasPorRevisar', titulo: 'Evidencias por revisar', valor: i.evidenciasPorRevisar, tono: 'azul',
        ruta: this.rutaRevision, parametros: {} },
      { clave: 'planesCerrados', titulo: 'Planes cerrados', valor: i.planesCerrados, tono: 'verde', ruta: informe,
        parametros: { [PARAMETRO_ESTADO]: 'cerrados' } }
    ];
    this.porRiesgo = distribucionPorRiesgo(analisis.conflictos);
    this.porEstadoPlan = distribucionEstadoPlanes(planes, this.reloj());
    this.actividades = estadoDeActividades(planes, this.reloj());
    this.totalActividades = this.actividades.reduce((suma, s) => suma + s.valor, 0);
    this.vencidas = atencion.vencidas;
    this.evidencias = atencion.evidencias;
  }

  /**
   * @param ruta Pantalla.
   * @param parametros Filtros de la URL.
   */
  private navegar(ruta: string, parametros: Params): void {
    this.router.navigate([ruta], { queryParams: parametros })
      .catch((err: unknown) => console.error('[RrhhDashboardComponent.navegar]', err));
  }
}
