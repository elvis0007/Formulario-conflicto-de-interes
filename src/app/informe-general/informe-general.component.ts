import { Component, DestroyRef, OnDestroy, OnInit, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { forkJoin } from 'rxjs';
import { PARAMETRO_ESTADO, rutaPlanAccion } from '../app.paths';
import { Actividad, Conflicto, PlanAccion, Riesgo } from '../models';
import { ConflictosMockService } from '../services/conflictos-mock.service';
import { PlanesMockService } from '../services/planes-mock.service';
import { BadgeComponent } from '../shared/badge/badge.component';
import { BarraAvanceComponent } from '../shared/barra-avance/barra-avance.component';
import { EmptyStateComponent } from '../shared/empty-state/empty-state.component';
import { ExpandArrowButtonComponent } from '../shared/expand-arrow-button/expand-arrow-button.component';
import { IconoComponent } from '../shared/icono/icono.component';
import { OpcionPill, PillsComponent } from '../shared/pills/pills.component';
import { RIESGOS, textoParentesco, textoRiesgo } from '../utils/analisis.util';
import { ConfirmacionTemporal } from '../utils/confirmacion-temporal';
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
import { calcularAvance, textoEstadoPlan } from '../utils/planes.util';
import { RELOJ } from '../utils/reloj';
import { textoPlazo } from '../utils/responsable.util';
import { textoEstadoActividad } from '../utils/revision.util';
import {
  Tono,
  mapearEstadoActividadATono,
  mapearEstadoPlanATono,
  mapearRiesgoATono
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
 *   y Estado.
 * - Al desplegar: un bloque por CADA plan enviado del conflicto, con su
 *   cabecera (nombre, estado, inicio, «x de y cumplidas») y su tabla de
 *   actividades (fecha limite en rojo si vencio).
 * - «Expandir todo» / «Contraer todo»; paginacion por grupos; el numero
 *   del conflicto lleva a su plan actual en Plan de Acción.
 * - «Descargar Excel»: solo confirmacion visual (sin archivo todavia).
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
    EmptyStateComponent,
    ExpandArrowButtonComponent,
    IconoComponent,
    PillsComponent,
    RouterLink
  ],
  templateUrl: './informe-general.component.html',
  styleUrl: './informe-general.component.scss'
})
export class InformeGeneralComponent implements OnInit, OnDestroy {
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

  /** Confirmacion de «Descargar Excel». */
  readonly descargado = new ConfirmacionTemporal();

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
              contador: this.grupos.filter((g) => cumpleEstado(g.plan, e.valor)).length
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
   * Detiene el temporizador de la confirmacion.
   */
  ngOnDestroy(): void {
    this.descargado.cancelar();
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
   * «Descargar Excel»: por ahora solo la confirmacion.
   */
  descargarExcel(): void {
    if (!this.descargado.activa) {
      this.descargado.disparar();
    }
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

  /** @param estado Estado. @returns Texto del estado del plan. */
  textoEstadoPlan(estado: PlanAccion['estado']): string {
    return textoEstadoPlan(estado);
  }

  /** @param estado Estado. @returns Tono del estado del plan. */
  tonoEstadoPlan(estado: PlanAccion['estado']): Tono {
    return mapearEstadoPlanATono(estado);
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
    return textoEstadoActividad(a.estado, false);
  }

  /** @param a Actividad. @returns Tono de su estado. */
  tonoEstadoActividad(a: Actividad): Tono {
    return mapearEstadoActividadATono(a.estado, false);
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
    if (a.estado === 'vencida') {
      return true;
    }
    if (a.estado === 'aprobada' || !a.fechaLimite) {
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
    this.filtrados = filtrarInforme(this.grupos, this.filtros);
    this.pagina = Math.min(this.pagina, this.totalPaginas);
  }
}
