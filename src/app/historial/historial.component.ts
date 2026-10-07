import { NgTemplateOutlet } from '@angular/common';
import { Component, DestroyRef, OnDestroy, OnInit, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Subject, switchMap } from 'rxjs';
import { Conflicto, EventoHistorial, PlanAccion } from '../models';
import { FechaLargaPipe } from '../pipes/fecha-larga.pipe';
import { HistorialMockService } from '../services/historial-mock.service';
import { BadgeComponent } from '../shared/badge/badge.component';
import { EmptyStateComponent } from '../shared/empty-state/empty-state.component';
import { ExpandArrowButtonComponent } from '../shared/expand-arrow-button/expand-arrow-button.component';
import { IconoComponent } from '../shared/icono/icono.component';
import { OpcionPill, PillsComponent } from '../shared/pills/pills.component';
import { textoParentesco, textoRiesgo } from '../utils/analisis.util';
import { ConfirmacionTemporal } from '../utils/confirmacion-temporal';
import {
  HistorialConflicto,
  TIPOS_EVENTO,
  TipoEvento,
  textoTipoEvento,
  todosLosEventos,
  tonoTipoEvento
} from '../utils/historial.util';
import { obtenerPlanActual, textoEstadoPlan } from '../utils/planes.util';
import { textoEstadoActividad } from '../utils/revision.util';
import { contieneTexto } from '../utils/texto.util';
import {
  Tono,
  mapearEstadoActividadATono,
  mapearEstadoPlanATono,
  mapearRiesgoATono
} from '../utils/tono.util';

/** Filtro por tipo de evento. */
export type FiltroTipoEvento = 'todos' | TipoEvento;

/** Clave del nodo «Eventos del conflicto». */
const NODO_CONFLICTO = 'conflicto';

/**
 * Historial (especificacion §6.9): linea de tiempo por conflicto.
 *
 * - Selector de conflicto con buscador (numero o nombre de una persona) y
 *   la linea de tiempo del elegido.
 * - Arbol de tres niveles: eventos del conflicto, de cada plan y de cada
 *   actividad. Cada nivel se despliega y pliega; al elegir un conflicto se
 *   ven abiertos sus eventos y su plan actual. «Expandir todo» y «Contraer
 *   todo».
 * - Cada evento: punto de color por tipo, texto y «fecha · autor».
 * - Filtro por tipo de evento.
 * - «Descargar PDF»: solo confirmacion visual (sin archivo todavia).
 *
 * Los eventos los arma `HistorialMockService` con los datos vigentes; al
 * entrar a la pantalla o elegir otro conflicto se vuelven a pedir, asi lo
 * hecho en otras pantallas aparece sin recargar.
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
    NgTemplateOutlet,
    PillsComponent
  ],
  templateUrl: './historial.component.html',
  styleUrl: './historial.component.scss'
})
export class HistorialComponent implements OnInit, OnDestroy {
  /** Todavia no llego la lista de conflictos. */
  cargando = true;

  /** Se esta pidiendo el historial del elegido. */
  cargandoHistorial = false;

  /** Texto del buscador de conflictos. */
  busqueda = '';

  /** Conflicto elegido. */
  seleccionadoId: string | null = null;

  /** Historial del elegido. */
  historial: HistorialConflicto | null = null;

  /** Filtro por tipo de evento. */
  filtroTipo: FiltroTipoEvento = 'todos';

  /** Pildoras del filtro, con conteos del conflicto elegido. */
  opcionesTipo: OpcionPill[] = [];

  /** Confirmacion de «Descargar PDF». */
  readonly descargado = new ConfirmacionTemporal();

  /** Todos los conflictos. */
  private conflictos: Conflicto[] = [];

  /** Nodos abiertos: `conflicto`, `plan:PL-1`, `actividad:A-1`. */
  private readonly abiertos = new Set<string>();

  /** Pide el historial de un conflicto (cancela el anterior). */
  private readonly pedir$ = new Subject<string>();

  private readonly servicio = inject(HistorialMockService);
  private readonly destroyRef = inject(DestroyRef);

  /** @returns Conflictos que pasan el buscador. */
  get conflictosFiltrados(): Conflicto[] {
    return this.conflictos.filter((c) =>
      contieneTexto([c.id, c.personaA.nombres, c.personaB.nombres], this.busqueda));
  }

  /**
   * Carga los conflictos y elige el primero.
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

    this.servicio.obtenerConflictos()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (conflictos) => {
          this.conflictos = conflictos;
          this.cargando = false;
          if (conflictos.length > 0) {
            this.elegir(conflictos[0].id);
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
   * Elige un conflicto y pide su historial.
   *
   * @param conflictoId Conflicto.
   */
  elegir(conflictoId: string): void {
    this.seleccionadoId = conflictoId;
    this.cargandoHistorial = true;
    this.pedir$.next(conflictoId);
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
  visibles(eventos: readonly EventoHistorial[]): EventoHistorial[] {
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

  /** @param plan Plan. @returns Texto de su estado. */
  textoEstadoPlan(plan: PlanAccion): string {
    return textoEstadoPlan(plan.estado);
  }

  /** @param plan Plan. @returns Tono de su estado. */
  tonoEstadoPlan(plan: PlanAccion): Tono {
    return mapearEstadoPlanATono(plan.estado);
  }

  /** @param estado Estado. @returns Texto con la vista de RRHH. */
  textoEstadoActividad(estado: Parameters<typeof textoEstadoActividad>[0]): string {
    return textoEstadoActividad(estado, false);
  }

  /** @param estado Estado. @returns Tono. */
  tonoEstadoActividad(estado: Parameters<typeof mapearEstadoActividadATono>[0]): Tono {
    return mapearEstadoActividadATono(estado, false);
  }

  /**
   * Muestra un historial: abre los eventos del conflicto y su plan
   * actual, y recalcula los conteos del filtro.
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
