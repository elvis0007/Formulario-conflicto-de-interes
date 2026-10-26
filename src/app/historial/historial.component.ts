import { NgTemplateOutlet } from '@angular/common';
import { Component, DestroyRef, OnDestroy, OnInit, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute } from '@angular/router';
import { Subject, switchMap } from 'rxjs';
import { PARAMETRO_CONFLICTO } from '../app.paths';
import { Actividad, Conflicto, EventoHistorial, PlanAccion } from '../models';
import { FechaLargaPipe } from '../pipes/fecha-larga.pipe';
import { HistorialMockService } from '../services/historial-mock.service';
import { BadgeComponent } from '../shared/badge/badge.component';
import { EmptyStateComponent } from '../shared/empty-state/empty-state.component';
import { ExpandArrowButtonComponent } from '../shared/expand-arrow-button/expand-arrow-button.component';
import { IconoComponent } from '../shared/icono/icono.component';
import { ModalComponent } from '../shared/modal/modal.component';
import { OpcionPill, PillsComponent } from '../shared/pills/pills.component';
import { textoParentesco, textoRiesgo } from '../utils/analisis.util';
import { ConfirmacionTemporal } from '../utils/confirmacion-temporal';
import { formatearFecha, parsearFecha } from '../utils/fechas.util';
import {
  HistorialConflicto,
  ResumenHistorial,
  TIPOS_EVENTO,
  TipoEvento,
  textoEstadoConflicto,
  textoTipoEvento,
  todosLosEventos,
  tonoEstadoConflicto,
  tonoTipoEvento
} from '../utils/historial.util';
import {
  estadoVistaActividad,
  obtenerPlanActual,
  textoEstadoPlan,
  tieneActividadesVencidas
} from '../utils/planes.util';
import { RELOJ } from '../utils/reloj';
import { textoEstadoActividad } from '../utils/revision.util';
import { contieneTexto } from '../utils/texto.util';
import {
  Tono,
  mapearEstadoActividadATono,
  mapearEstadoPlanATono,
  mapearEstadoSeguimientoATono,
  mapearRiesgoATono,
  textoEstadoSeguimiento
} from '../utils/tono.util';

/** Filtro por tipo de evento (dentro del modal). */
export type FiltroTipoEvento = 'todos' | TipoEvento;

/** Filtro de las tarjetas. */
export type FiltroConflictos = 'todos' | 'activos' | 'cerrados';

/** Clave del nodo «Eventos del conflicto». */
const NODO_CONFLICTO = 'conflicto';

/**
 * Historial (especificacion §6.9).
 *
 * - Tarjetas en 4 columnas, una por conflicto: numero, estado, personas,
 *   parentesco, riesgo, estado de seguimiento, numero de planes y fecha de
 *   deteccion.
 * - Los planes cerrados dicen como se cerraron (cumplido o anticipado) y,
 *   si lo hay, el motivo.
 * - Buscador (numero o nombre) y filtro Todos / Activos / Cerrados.
 * - Al hacer clic se abre un modal con el arbol de eventos: los del
 *   conflicto, los de cada plan y los de cada actividad. Cada nivel se
 *   despliega y pliega (al abrir, los del conflicto y su plan actual);
 *   «Expandir todo» / «Contraer todo»; filtro por tipo de evento;
 *   «Descargar PDF» (solo confirmacion visual).
 * - `?conflicto=C-001` abre directamente su arbol (enlaces del dashboard).
 *
 * Los eventos los arma `HistorialMockService` con los datos vigentes cada
 * vez que se abre un conflicto: lo hecho en otras pantallas aparece sin
 * recargar.
 *
 * @author Elvis Flores
 */
@Component({
  selector: 'app-historial',
  imports: [
    BadgeComponent,
    EmptyStateComponent,
    ExpandArrowButtonComponent,
    FechaLargaPipe,
    IconoComponent,
    ModalComponent,
    NgTemplateOutlet,
    PillsComponent
  ],
  templateUrl: './historial.component.html',
  styleUrl: './historial.component.scss'
})
export class HistorialComponent implements OnInit, OnDestroy {
  /** Todavia no llegaron las tarjetas. */
  cargando = true;

  /** Texto del buscador. */
  busqueda = '';

  /** Filtro de las tarjetas. */
  filtro: FiltroConflictos = 'todos';

  /** Pildoras del filtro de tarjetas, con conteos. */
  opcionesFiltro: OpcionPill[] = [];

  /** Conflicto abierto en el modal; `null` con el modal cerrado. */
  abiertoId: string | null = null;

  /** Se esta pidiendo el historial del abierto. */
  cargandoHistorial = false;

  /** Historial del conflicto abierto. */
  historial: HistorialConflicto | null = null;

  /** Filtro por tipo de evento. */
  filtroTipo: FiltroTipoEvento = 'todos';

  /** Pildoras del filtro por tipo, con conteos del abierto. */
  opcionesTipo: OpcionPill[] = [];

  /** Confirmacion de «Descargar PDF». */
  readonly descargado = new ConfirmacionTemporal();

  /** Un resumen por conflicto. */
  private resumenes: ResumenHistorial[] = [];

  /** Nodos abiertos: `conflicto`, `plan:PL-1`, `actividad:A-1`. */
  private readonly abiertos = new Set<string>();

  /** Pide el historial de un conflicto (cancela el anterior). */
  private readonly pedir$ = new Subject<string>();

  private readonly servicio = inject(HistorialMockService);
  private readonly ruta = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);
  private readonly reloj = inject(RELOJ);

  /** @returns Tarjetas que pasan el buscador y el filtro. */
  get visibles(): ResumenHistorial[] {
    return this.resumenes
      .filter((r) => this.filtro === 'todos'
        || (this.filtro === 'activos' && r.estado === 'activo')
        || (this.filtro === 'cerrados' && r.estado === 'cerrado'))
      .filter((r) => contieneTexto([r.conflicto.id, r.conflicto.personaA.nombres, r.conflicto.personaB.nombres], this.busqueda));
  }

  /** @returns Titulo del modal. */
  get tituloModal(): string {
    return this.abiertoId ? 'Historial · Conflicto #' + this.abiertoId : '';
  }

  /**
   * Carga las tarjetas y, si la URL lo pide, abre un conflicto.
   */
  ngOnInit(): void {
    this.pedir$
      .pipe(
        switchMap((id) => this.servicio.obtenerHistorial(id)),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe({
        next: (historial) => this.mostrar(historial),
        error: (err: unknown) => {
          this.cargandoHistorial = false;
          console.error('[HistorialComponent.pedir$]', err);
        }
      });

    this.servicio.obtenerResumenes()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (resumenes) => {
          this.resumenes = resumenes;
          this.cargando = false;
          this.opcionesFiltro = [
            { valor: 'todos', etiqueta: 'Todos', contador: resumenes.length },
            { valor: 'activos', etiqueta: 'Activos', contador: resumenes.filter((r) => r.estado === 'activo').length },
            { valor: 'cerrados', etiqueta: 'Cerrados', contador: resumenes.filter((r) => r.estado === 'cerrado').length }
          ];
          const pedido = this.ruta.snapshot.queryParamMap.get(PARAMETRO_CONFLICTO);
          if (pedido !== null && resumenes.some((r) => r.conflicto.id === pedido)) {
            this.abrir(pedido);
          }
        },
        error: (err: unknown) => {
          this.cargando = false;
          console.error('[HistorialComponent.ngOnInit]', err);
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
   * @param evento `input` del buscador.
   */
  buscar(evento: Event): void {
    this.busqueda = (evento.target as HTMLInputElement).value;
  }

  /**
   * @param valor Filtro elegido.
   */
  elegirFiltro(valor: string): void {
    this.filtro = valor === 'activos' || valor === 'cerrados' ? valor : 'todos';
  }

  /**
   * Abre el modal de un conflicto y pide su historial.
   *
   * @param conflictoId Conflicto.
   */
  abrir(conflictoId: string): void {
    this.abiertoId = conflictoId;
    this.historial = null;
    this.filtroTipo = 'todos';
    this.cargandoHistorial = true;
    this.descargado.cancelar();
    this.pedir$.next(conflictoId);
  }

  /**
   * Cierra el modal.
   */
  cerrar(): void {
    this.abiertoId = null;
    this.historial = null;
  }

  /**
   * @param valor Tipo elegido.
   */
  elegirTipo(valor: string): void {
    this.filtroTipo = valor === 'todos' || (TIPOS_EVENTO as readonly string[]).includes(valor)
      ? valor as FiltroTipoEvento
      : 'todos';
  }

  /**
   * @param clave Clave del nodo.
   * @returns `true` si esta abierto.
   */
  estaAbierto(clave: string): boolean {
    return this.abiertos.has(clave);
  }

  /**
   * Abre o cierra un nodo.
   *
   * @param clave Clave del nodo.
   */
  alternar(clave: string): void {
    if (this.abiertos.has(clave)) {
      this.abiertos.delete(clave);
    } else {
      this.abiertos.add(clave);
    }
  }

  /**
   * «Expandir todo» / «Contraer todo».
   *
   * @param expandir `true` para abrir todos los nodos.
   */
  expandirTodo(expandir: boolean): void {
    this.abiertos.clear();
    if (expandir && this.historial) {
      this.abiertos.add(NODO_CONFLICTO);
      for (const p of this.historial.planes) {
        this.abiertos.add(this.clavePlan(p.plan.id));
        for (const a of p.actividades) {
          this.abiertos.add(this.claveActividad(a.actividad.id));
        }
      }
    }
  }

  /**
   * «Descargar PDF»: por ahora solo la confirmacion.
   */
  descargarPdf(): void {
    if (!this.descargado.activa) {
      this.descargado.disparar();
    }
  }

  /**
   * @param eventos Eventos de un nodo.
   * @returns Los que pasan el filtro por tipo.
   */
  eventosVisibles(eventos: readonly EventoHistorial[]): EventoHistorial[] {
    return this.filtroTipo === 'todos' ? [...eventos] : eventos.filter((e) => e.tipo === this.filtroTipo);
  }

  /** @param planId Plan. @returns Clave de su nodo. */
  clavePlan(planId: string): string {
    return 'plan:' + planId;
  }

  /** @param actividadId Actividad. @returns Clave de su nodo. */
  claveActividad(actividadId: string): string {
    return 'actividad:' + actividadId;
  }

  /** @returns Clave del nodo del conflicto. */
  get claveConflicto(): string {
    return NODO_CONFLICTO;
  }

  /** @param r Resumen. @returns Texto del estado. */
  textoEstado(r: ResumenHistorial): string {
    return textoEstadoConflicto(r.estado);
  }

  /** @param r Resumen. @returns Tono del estado. */
  tonoEstado(r: ResumenHistorial): Tono {
    return tonoEstadoConflicto(r.estado);
  }

  /** @param r Resumen. @returns «1 plan», «2 planes» o «Sin planes». */
  textoPlanes(r: ResumenHistorial): string {
    const n = r.planes.length;

    return n === 0 ? 'Sin planes' : n === 1 ? '1 plan' : n + ' planes';
  }

  /** @param iso Fecha. @returns «dd/mm/aaaa». */
  fecha(iso: string): string {
    try {
      return formatearFecha(parsearFecha(iso));
    } catch (err) {
      console.error('[HistorialComponent.fecha] Fecha inválida:', iso, err);
      return iso;
    }
  }

  /** @param tipo Tipo. @returns Color del punto. */
  tonoEvento(tipo: TipoEvento): Tono {
    return tonoTipoEvento(tipo);
  }

  /** @param c Conflicto. @returns Parentesco en una linea. */
  parentesco(c: Conflicto): string {
    return textoParentesco(c);
  }

  /** @param c Conflicto. @returns «Riesgo alto»... */
  textoRiesgo(c: Conflicto): string {
    return 'Riesgo ' + textoRiesgo(c.riesgo).toLowerCase();
  }

  /** @param c Conflicto. @returns Tono del riesgo. */
  tonoRiesgo(c: Conflicto): Tono {
    return mapearRiesgoATono(c.riesgo);
  }

  /** @param plan Plan. @returns «Plan 02 · Nombre». */
  tituloPlan(plan: PlanAccion): string {
    return 'Plan ' + String(plan.numero).padStart(2, '0') + ' · ' + plan.nombre;
  }

  /** @param plan Plan. @returns Texto de su estado (con el tipo de cierre). */
  textoEstadoPlan(plan: PlanAccion): string {
    return textoEstadoPlan(plan.estado, tieneActividadesVencidas(plan, this.reloj()), plan.tipoCierre);
  }

  /** @param plan Plan. @returns Tono de su estado. */
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

  /** @param actividad Actividad. @returns Texto de su estado con la vista de RRHH. */
  textoEstadoActividad(actividad: Actividad): string {
    return textoEstadoActividad(estadoVistaActividad(actividad, this.reloj()), false);
  }

  /** @param actividad Actividad. @returns Tono de su estado. */
  tonoEstadoActividad(actividad: Actividad): Tono {
    return mapearEstadoActividadATono(estadoVistaActividad(actividad, this.reloj()), false);
  }

  /**
   * Muestra un historial: abre los eventos del conflicto y su plan
   * actual, y recalcula los conteos del filtro por tipo.
   *
   * @param historial Historial recibido.
   */
  private mostrar(historial: HistorialConflicto | null): void {
    const actual = historial ? obtenerPlanActual(historial.planes.map((p) => p.plan)) : null;
    const eventos = historial ? todosLosEventos(historial) : [];

    this.cargandoHistorial = false;
    this.historial = historial;
    this.abiertos.clear();
    this.abiertos.add(NODO_CONFLICTO);
    if (actual !== null) {
      this.abiertos.add(this.clavePlan(actual.id));
    }
    this.opcionesTipo = [
      { valor: 'todos', etiqueta: 'Todos', contador: eventos.length },
      ...TIPOS_EVENTO.map((t) => ({
        valor: t,
        etiqueta: textoTipoEvento(t),
        tono: tonoTipoEvento(t),
        contador: eventos.filter((e) => e.tipo === t).length
      }))
    ];
  }
}
