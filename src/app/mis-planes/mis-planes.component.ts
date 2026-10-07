import { Component, DestroyRef, OnInit, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { PARAMETRO_ESTADO, rutaPlanResponsable } from '../app.paths';
import { EstadoActividad, PlanDeResponsable } from '../models';
import { PerfilUsuarioService } from '../services/perfil-usuario.service';
import { PlanesMockService } from '../services/planes-mock.service';
import { BadgeComponent } from '../shared/badge/badge.component';
import { EmptyStateComponent } from '../shared/empty-state/empty-state.component';
import { OpcionPill, PillsComponent } from '../shared/pills/pills.component';
import { formatearFecha, parsearFecha } from '../utils/fechas.util';
import { textoEstadoPlan } from '../utils/planes.util';
import {
  FILTROS_ESTADO,
  FiltroEstado,
  actividadesDe,
  contarEstados,
  esFiltroEstado,
  ordenarPorUrgencia,
  planCoincideConFiltro
} from '../utils/responsable.util';
import { Tono, mapearEstadoActividadATono, mapearEstadoPlanATono } from '../utils/tono.util';

/** Un chip de conteo por estado en la tarjeta. */
export interface ChipEstado {
  texto: string;
  tono: Tono;
}

/** Una tarjeta de la Bandeja. */
export interface TarjetaPlanResponsable {
  planId: string;
  conflictoId: string;
  /** «Plan 02 · Nombre». */
  tituloPlan: string;
  textoEstado: string;
  tonoEstado: Tono;
  /** «dd/mm/aaaa», o vacio. */
  fechaInicio: string;
  /** «x de y de tus actividades aprobadas». */
  avance: string;
  chips: ChipEstado[];
  ruta: string;
  fuente: PlanDeResponsable;
}

/** Texto en singular y plural de cada estado para los chips. */
const TEXTO_CHIP: Readonly<Record<EstadoActividad, [string, string]>> = {
  pendiente: ['pendiente', 'pendientes'],
  vencida: ['vencida', 'vencidas'],
  rechazada: ['rechazada', 'rechazadas'],
  en_revision: ['en revisión', 'en revisión'],
  aprobada: ['aprobada', 'aprobadas']
};

/** Orden de los chips: lo urgente primero. */
const ORDEN_CHIPS: readonly EstadoActividad[] = ['rechazada', 'vencida', 'pendiente', 'en_revision', 'aprobada'];

/**
 * Bandeja de Tareas del Responsable (especificacion §6.12, lista).
 *
 * - Una tarjeta por plan con actividades suyas (sin borradores): conflicto,
 *   plan, estado, fecha de inicio, «x de y de tus actividades aprobadas»,
 *   conteo por estado y «Ver plan →».
 * - Filtro por estado de SUS actividades con conteos; un plan aparece si
 *   tiene al menos una actividad suya en ese estado. El filtro vive en la
 *   URL (`?estado=rechazada`), asi funcionan los clics del dashboard y el
 *   boton «atras».
 * - Primero los planes con algo por hacer (rechazadas, vencidas,
 *   pendientes); los cerrados al final.
 *
 * @author Elvis Flores
 */
@Component({
  selector: 'app-mis-planes',
  imports: [BadgeComponent, EmptyStateComponent, PillsComponent, RouterLink],
  templateUrl: './mis-planes.component.html',
  styleUrl: './mis-planes.component.scss'
})
export class MisPlanesComponent implements OnInit {
  /** Todavia no llego la respuesta. */
  cargando = true;

  /** Filtro elegido. */
  filtro: FiltroEstado = 'todas';

  /** Pildoras del filtro con sus conteos. */
  opciones: OpcionPill[] = [];

  /** Tarjetas que pasan el filtro. */
  visibles: TarjetaPlanResponsable[] = [];

  /** Todas las tarjetas, ya ordenadas. */
  private tarjetas: TarjetaPlanResponsable[] = [];

  private readonly planesServicio = inject(PlanesMockService);
  private readonly perfil = inject(PerfilUsuarioService);
  private readonly ruta = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  /** @returns Cuantos planes tiene en total. */
  get totalPlanes(): number {
    return this.tarjetas.length;
  }

  /** @returns Etiqueta del filtro elegido, para el estado vacio. */
  get etiquetaFiltro(): string {
    return FILTROS_ESTADO.find((f) => f.valor === this.filtro)?.etiqueta ?? '';
  }

  /**
   * Carga los planes y escucha el filtro de la URL.
   */
  ngOnInit(): void {
    const empleadoId = this.perfil.obtenerEmpleadoActualId();

    this.ruta.queryParamMap
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((parametros) => {
        const valor = parametros.get(PARAMETRO_ESTADO);

        this.filtro = esFiltroEstado(valor) ? valor : 'todas';
        this.aplicarFiltro();
      });

    if (empleadoId === null) {
      this.cargando = false;
      return;
    }

    this.planesServicio.obtenerPlanesDeResponsable(empleadoId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (planes) => {
          this.cargando = false;
          this.cargar(planes);
        },
        error: (err: unknown) => {
          this.cargando = false;
          console.error('[MisPlanesComponent.ngOnInit]', err);
        }
      });
  }

  /**
   * Cambia el filtro (en la URL; la suscripcion lo aplica).
   *
   * @param valor Filtro elegido.
   */
  elegirFiltro(valor: string): void {
    const filtro = esFiltroEstado(valor) ? valor : 'todas';

    this.router.navigate([], {
      relativeTo: this.ruta,
      queryParams: { [PARAMETRO_ESTADO]: filtro === 'todas' ? null : filtro },
      queryParamsHandling: 'merge'
    }).catch((err: unknown) => console.error('[MisPlanesComponent.elegirFiltro]', err));
  }

  /**
   * @param planes Planes del responsable.
   */
  private cargar(planes: PlanDeResponsable[]): void {
    const conteo = contarEstados(actividadesDe(planes));
    const total = actividadesDe(planes).length;

    this.tarjetas = ordenarPorUrgencia(planes).map((p) => this.crearTarjeta(p));
    this.opciones = FILTROS_ESTADO.map((f) => ({
      valor: f.valor,
      etiqueta: f.etiqueta,
      tono: f.tono,
      contador: f.valor === 'todas' ? total : conteo[f.valor]
    }));
    this.aplicarFiltro();
  }

  /**
   * Recalcula las tarjetas visibles con el filtro actual.
   */
  private aplicarFiltro(): void {
    this.visibles = this.tarjetas.filter((t) => planCoincideConFiltro(t.fuente, this.filtro));
  }

  /**
   * @param fuente Plan del responsable.
   * @returns Su tarjeta.
   */
  private crearTarjeta(fuente: PlanDeResponsable): TarjetaPlanResponsable {
    const plan = fuente.plan;
    const conteo = contarEstados(plan.actividades);

    return {
      planId: plan.id,
      conflictoId: plan.conflictoId,
      tituloPlan: 'Plan ' + String(plan.numero).padStart(2, '0') + ' · ' + plan.nombre,
      textoEstado: textoEstadoPlan(plan.estado),
      tonoEstado: mapearEstadoPlanATono(plan.estado),
      fechaInicio: this.fecha(plan.fechaInicio),
      avance: conteo.aprobada + ' de ' + plan.actividades.length + ' de tus actividades aprobadas',
      chips: ORDEN_CHIPS
        .filter((e) => conteo[e] > 0)
        .map((e) => ({
          texto: conteo[e] + ' ' + TEXTO_CHIP[e][conteo[e] === 1 ? 0 : 1],
          tono: mapearEstadoActividadATono(e, false)
        })),
      ruta: rutaPlanResponsable(plan.id),
      fuente
    };
  }

  /**
   * @param iso Fecha ISO.
   * @returns «dd/mm/aaaa», o vacio si no hay o no es valida.
   */
  private fecha(iso: string | undefined): string {
    if (!iso) {
      return '';
    }
    try {
      return formatearFecha(parsearFecha(iso));
    } catch (err) {
      console.error('[MisPlanesComponent.fecha] Fecha inválida:', iso, err);
      return '';
    }
  }
}
