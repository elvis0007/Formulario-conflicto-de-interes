import { Component, DestroyRef, OnInit, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { forkJoin } from 'rxjs';
import { PARAMETRO_ESTADO, rutaPlanAccion } from '../app.paths';
import { Actividad, Conflicto, FiltroReporte, PlanAccion, Riesgo } from '../models';
import { ConflictosMockService } from '../services/conflictos-mock.service';
import { PlanesMockService } from '../services/planes-mock.service';
import { BadgeComponent } from '../shared/badge/badge.component';
import { BarraAvanceComponent } from '../shared/barra-avance/barra-avance.component';
import { BotonExcelComponent } from '../shared/boton-excel/boton-excel.component';
import { EmptyStateComponent } from '../shared/empty-state/empty-state.component';
import { ExpandArrowButtonComponent } from '../shared/expand-arrow-button/expand-arrow-button.component';
import { OpcionPill, PillsComponent } from '../shared/pills/pills.component';
import { RIESGOS, textoParentesco, textoRiesgo } from '../utils/analisis.util';
import { calcularDiasRestantes, formatearFecha, parsearFecha } from '../utils/fechas.util';
import { TODOS } from '../utils/filtros-listados.util';
import {
  ESTADOS_INFORME,
  FiltrosInforme,
  GrupoInforme,
  ResponsableInforme,
  armarGruposInforme,
  cumpleEstado,
  esEstadoInforme,
  filtrarInforme,
  filtrosInformeVacios,
  responsablesDelInforme
} from '../utils/informe.util';
import {
  calcularAvance,
  estadoVistaActividad,
  textoEstadoPlan,
  tieneActividadesVencidas
} from '../utils/planes.util';
import { RELOJ } from '../utils/reloj';
import { textoPlazo } from '../utils/responsable.util';
import { textoEstadoActividad } from '../utils/revision.util';
import {
  Tono,
  mapearEstadoActividadATono,
  mapearEstadoPlanATono,
  mapearEstadoSeguimientoATono,
  mapearRiesgoATono,
  textoEstadoSeguimiento
} from '../utils/tono.util';

/** Grupos (conflictos) por pagina. */
export const GRUPOS_POR_PAGINA = 5;

/**
 * Informe General (PNIP.CI.RG.03, especificacion §6.7): todas las personas
 * con plan de accion enviado.
 *
 * - Filtros: Todos / En ejecución / Con vencidas / Cerrados (tambien por
 *   URL, `?estado=`), riesgo, responsable y buscador; se combinan.
 * - Tabla agrupada por conflicto: chevron, Conflicto, Empleado / Familiar,
 *   Parentesco, Riesgo, Planes, Avance (barra segmentada del plan actual)
 *   y Estado. Bajo el numero, el estado de seguimiento del conflicto.
 * - Los planes cerrados dicen como se cerraron (cumplido o anticipado) y,
 *   si lo hay, el motivo.
 * - Al desplegar: un bloque por CADA plan enviado del conflicto, con su
 *   cabecera (nombre, estado, inicio, «x de y cumplidas») y su tabla de
 *   actividades (fecha limite en rojo si vencio).
 * - «Expandir todo» / «Contraer todo»; paginacion por grupos; el numero
 *   del conflicto lleva a su plan actual en Plan de Acción.
 * - «Descargar Excel» (RG.03 del backend): con el estado y el riesgo
 *   elegidos; la busqueda y el responsable no los filtra el backend.
 *
 * No usa `DataTableComponent` porque esa tabla pagina por filas.
 *
 * @author Elvis Flores
 */
@Component({
  selector: 'app-informe-general',
  imports: [
    BadgeComponent,
    BarraAvanceComponent,
    BotonExcelComponent,
    EmptyStateComponent,
    ExpandArrowButtonComponent,
    PillsComponent,
    RouterLink
  ],
  templateUrl: './informe-general.component.html',
  styleUrl: './informe-general.component.scss'
})
export class InformeGeneralComponent implements OnInit {
  /** Todavia no llego la respuesta. */
  cargando = true;

  /** Filtros elegidos. */
  filtros: FiltrosInforme = filtrosInformeVacios();

  /** Pildoras de estado con sus conteos. */
  opcionesEstado: OpcionPill[] = [];

  /** Grupos que pasan los filtros. */
  filtrados: GrupoInforme[] = [];

  /** Responsables para el filtro. */
  responsables: ResponsableInforme[] = [];

  /** Pagina actual (desde 1). */
  pagina = 1;

  readonly riesgos = RIESGOS;
  readonly todos = TODOS;

  /** Conflictos desplegados (por defecto, ninguno). */
  private readonly expandidos = new Set<string>();

  /** Todos los grupos. */
  private grupos: GrupoInforme[] = [];

  private readonly conflictosServicio = inject(ConflictosMockService);
  private readonly planesServicio = inject(PlanesMockService);
  private readonly ruta = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly reloj = inject(RELOJ);
  private readonly destroyRef = inject(DestroyRef);

  /** @returns Cuantas paginas hay (al menos 1). */
  get totalPaginas(): number {
    return Math.max(1, Math.ceil(this.filtrados.length / GRUPOS_POR_PAGINA));
  }

  /** @returns Grupos de la pagina actual. */
  get visibles(): GrupoInforme[] {
    const inicio = (this.pagina - 1) * GRUPOS_POR_PAGINA;

    return this.filtrados.slice(inicio, inicio + GRUPOS_POR_PAGINA);
  }

  /** @returns `true` si hay algun filtro aplicado. */
  get hayFiltros(): boolean {
    const f = this.filtros;

    return f.estado !== TODOS || f.riesgo !== TODOS || f.responsableId !== TODOS || f.texto.trim() !== '';
  }

  /**
   * Carga conflictos y planes; el estado puede venir en la URL.
   */
  ngOnInit(): void {
    const estado = this.ruta.snapshot.queryParamMap.get(PARAMETRO_ESTADO);

    if (esEstadoInforme(estado)) {
      this.filtros = { ...this.filtros, estado };
    }

    forkJoin({
      conflictos: this.conflictosServicio.obtenerConflictos(),
      planes: this.planesServicio.obtenerPlanes()
    })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: ({ conflictos, planes }) => {
          this.grupos = armarGruposInforme(conflictos, planes);
          this.responsables = responsablesDelInforme(this.grupos);
          this.opcionesEstado = [
            { valor: TODOS, etiqueta: 'Todos', contador: this.grupos.length },
            ...ESTADOS_INFORME.map((e) => ({
              valor: e.valor,
              etiqueta: e.etiqueta,
              contador: this.grupos.filter((g) => cumpleEstado(g.plan, e.valor, this.reloj())).length
            }))
          ];
          this.cargando = false;
          this.aplicar();
        },
        error: (err: unknown) => {
          this.cargando = false;
          console.error('[InformeGeneralComponent.ngOnInit]', err);
        }
      });
  }

  /**
   * Pildora de estado: filtra y deja el filtro en la URL.
   *
   * @param valor Estado elegido (`''` = Todos).
   */
  elegirEstado(valor: string): void {
    const estado = esEstadoInforme(valor) ? valor : TODOS;

    this.filtros = { ...this.filtros, estado };
    this.pagina = 1;
    this.aplicar();
    this.router.navigate([], {
      relativeTo: this.ruta,
      queryParams: { [PARAMETRO_ESTADO]: estado === TODOS ? null : estado },
      queryParamsHandling: 'merge'
    }).catch((err: unknown) => console.error('[InformeGeneralComponent.elegirEstado]', err));
  }

  /**
   * Cambia un filtro (riesgo, responsable o texto) y vuelve a la primera
   * pagina.
   *
   * @param campo Filtro.
   * @param evento `change` o `input` del control.
   */
  cambiarFiltro(campo: 'riesgo' | 'responsableId' | 'texto', evento: Event): void {
    const valor = (evento.target as HTMLInputElement | HTMLSelectElement).value;

    this.filtros = { ...this.filtros, [campo]: valor } as FiltrosInforme;
    this.pagina = 1;
    this.aplicar();
  }

  /**
   * Quita todos los filtros.
   */
  limpiarFiltros(): void {
    this.filtros = filtrosInformeVacios();
    this.elegirEstado(TODOS);
  }

  /**
   * @param conflictoId Conflicto.
   * @returns `true` si su grupo esta desplegado.
   */
  estaExpandido(conflictoId: string): boolean {
    return this.expandidos.has(conflictoId);
  }

  /**
   * Despliega o pliega un grupo.
   *
   * @param conflictoId Conflicto.
   */
  alternar(conflictoId: string): void {
    if (this.expandidos.has(conflictoId)) {
      this.expandidos.delete(conflictoId);
    } else {
      this.expandidos.add(conflictoId);
    }
  }

  /**
   * «Expandir todo» / «Contraer todo» (todos los grupos, de todas las
   * paginas).
   *
   * @param expandir `true` para desplegar.
   */
  expandirTodo(expandir: boolean): void {
    this.expandidos.clear();
    if (expandir) {
      for (const g of this.grupos) {
        this.expandidos.add(g.conflicto.id);
      }
    }
  }

  /**
   * @param paso -1 anterior, 1 siguiente.
   */
  irAPagina(paso: 1 | -1): void {
    this.pagina = Math.min(this.totalPaginas, Math.max(1, this.pagina + paso));
  }

  /**
   * Filtros del Excel (RG.03). La pildora de estado pasa al estado del
   * conflicto: «En ejecución» → `EN_EJECUCION`, «Con vencidas» →
   * `vencido`, «Cerrados» → `FINALIZADO`.
   *
   * @returns Filtros para `GET /conflictos/reporte`.
   * @author Elvis Flores
   */
  get filtroExcel(): FiltroReporte {
    const { estado, riesgo } = this.filtros;

    return {
      ...(riesgo !== TODOS ? { riesgo } : {}),
      ...(estado === 'en-ejecucion' ? { estado: 'EN_EJECUCION' as const } : {}),
      ...(estado === 'cerrados' ? { estado: 'FINALIZADO' as const } : {}),
      ...(estado === 'con-vencidas' ? { vencido: true } : {})
    };
  }

  /** @param g Grupo. @returns URL de su plan actual en Plan de Acción. */
  rutaPlan(g: GrupoInforme): string {
    return rutaPlanAccion(g.conflicto.id, g.plan.id);
  }

  /** @param c Conflicto. @returns Parentesco en una linea. */
  parentesco(c: Conflicto): string {
    return textoParentesco(c);
  }

  /** @param g Grupo. @returns «1 plan», «2 planes». */
  textoPlanes(g: GrupoInforme): string {
    return g.bloques.length === 1 ? '1 plan' : g.bloques.length + ' planes';
  }

  /** @param plan Plan. @returns «Plan 02 · Nombre». */
  tituloPlan(plan: PlanAccion): string {
    return 'Plan ' + String(plan.numero).padStart(2, '0') + ' · ' + plan.nombre;
  }

  /** @param plan Plan. @returns «x de y cumplidas». */
  avance(plan: PlanAccion): string {
    const a = calcularAvance(plan.actividades);

    return a.cumplidas + ' de ' + a.total + ' cumplidas';
  }

  /** @param plan Plan. @returns Texto del estado del plan (con el tipo de cierre). */
  textoEstadoPlan(plan: PlanAccion): string {
    return textoEstadoPlan(plan.estado, tieneActividadesVencidas(plan, this.reloj()), plan.tipoCierre);
  }

  /** @param plan Plan. @returns Tono del estado del plan. */
  tonoEstadoPlan(plan: PlanAccion): Tono {
    return mapearEstadoPlanATono(plan.estado, tieneActividadesVencidas(plan, this.reloj()), plan.tipoCierre);
  }

  /** @param c Conflicto. @returns Texto de su estado de seguimiento. */
  textoSeguimiento(c: Conflicto): string {
    return textoEstadoSeguimiento(c.estado);
  }

  /** @param c Conflicto. @returns Tono de su estado de seguimiento. */
  tonoSeguimiento(c: Conflicto): Tono {
    return mapearEstadoSeguimientoATono(c.estado);
  }

  /** @param riesgo Riesgo. @returns Texto del riesgo. */
  textoRiesgo(riesgo: Riesgo): string {
    return textoRiesgo(riesgo);
  }

  /** @param riesgo Riesgo. @returns Tono del riesgo. */
  tonoRiesgo(riesgo: Riesgo): Tono {
    return mapearRiesgoATono(riesgo);
  }

  /** @param a Actividad. @returns Estado con los textos de RRHH. */
  textoEstadoActividad(a: Actividad): string {
    return textoEstadoActividad(estadoVistaActividad(a, this.reloj()), false);
  }

  /** @param a Actividad. @returns Tono de su estado. */
  tonoEstadoActividad(a: Actividad): Tono {
    return mapearEstadoActividadATono(estadoVistaActividad(a, this.reloj()), false);
  }

  /** @param a Actividad. @returns Plazo legible. */
  plazo(a: Actividad): string {
    return textoPlazo(a);
  }

  /**
   * @param a Actividad.
   * @returns `true` si la fecha limite paso sin aprobacion.
   */
  vencida(a: Actividad): boolean {
    if (a.estado === 'ACEPTADA' || a.estado === 'NO_CUMPLIDA' || !a.fechaLimite) {
      return false;
    }
    try {
      return calcularDiasRestantes(a.fechaLimite, this.reloj()).vencida;
    } catch (err) {
      console.error('[InformeGeneralComponent.vencida]', err);
      return false;
    }
  }

  /**
   * @param iso Fecha ISO.
   * @returns «dd/mm/aaaa», o vacio si no hay o no es valida.
   */
  fecha(iso: string | undefined): string {
    if (!iso) {
      return '';
    }
    try {
      return formatearFecha(parsearFecha(iso));
    } catch (err) {
      console.error('[InformeGeneralComponent.fecha] Fecha inválida:', iso, err);
      return '';
    }
  }

  /**
   * Recalcula los grupos filtrados.
   */
  private aplicar(): void {
    this.filtrados = filtrarInforme(this.grupos, this.filtros, this.reloj());
    this.pagina = Math.min(this.pagina, this.totalPaginas);
  }
}
