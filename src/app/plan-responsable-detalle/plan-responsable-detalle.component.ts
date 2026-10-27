import { Component, DestroyRef, ElementRef, OnInit, ViewChild, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { EMPTY, switchMap } from 'rxjs';
import { RUTAS } from '../app.paths';
import { Actividad, Archivo, PlanAccion, PlanDeResponsable } from '../models';
import { FechaLargaPipe } from '../pipes/fecha-larga.pipe';
import { PerfilUsuarioService } from '../services/perfil-usuario.service';
import { ESTADOS_CON_SUBIDA, PlanesMockService } from '../services/planes-mock.service';
import { BadgeComponent } from '../shared/badge/badge.component';
import { DocumentViewerComponent } from '../shared/document-viewer/document-viewer.component';
import { IconoComponent } from '../shared/icono/icono.component';
import { ModalComponent } from '../shared/modal/modal.component';
import { textoRiesgo } from '../utils/analisis.util';
import { ACCEPT_EVIDENCIA, validarEvidencia } from '../utils/documento.util';
import { DiasRestantes, calcularDiasRestantes, formatearFecha, parsearFecha } from '../utils/fechas.util';
import { estaVencida, textoEstadoPlan, tieneActividadesVencidas } from '../utils/planes.util';
import { RELOJ } from '../utils/reloj';
import { textoPlazo } from '../utils/responsable.util';
import { textoEstadoActividad } from '../utils/revision.util';
import { Tono, mapearEstadoActividadATono, mapearEstadoPlanATono, mapearRiesgoATono } from '../utils/tono.util';

/** Lo que la pantalla muestra de una actividad. */
export interface VistaActividadResponsable {
  actividad: Actividad;
  /** Textos de la vista del Responsable (una vencida dice «Pendiente»). */
  textoEstado: string;
  tonoEstado: Tono;
  plazo: string;
  /** «dd/mm/aaaa», o vacio. */
  fechaLimite: string;
  /** Dias restantes; solo si tiene algo por hacer. */
  dias: DiasRestantes | null;
  /** Plazo en rojo: vencida, o paso la fecha sin evidencia. */
  vencida: boolean;
  /** Se puede subir (o volver a subir) la evidencia. */
  puedeSubir: boolean;
}

/** Documento abierto en el visor. */
export interface DocumentoAbierto {
  titulo: string;
  archivo: Archivo;
  subidoPor: string;
  fechaSubida: string;
  /** Id del plan si es su documento firmado (para pedirlo con token). */
  planId: string;
  /** Id de la evidencia si es una evidencia (para pedirla con token). */
  evidenciaId: string;
}

/** Mensaje si la carga falla. */
const ERROR_CARGA = 'No se pudo cargar el plan. Inténtalo de nuevo.';

/** Mensaje si la subida falla sin que el servicio diga por que. */
const ERROR_SUBIDA = 'No se pudo subir la evidencia. Inténtalo de nuevo.';

/**
 * Detalle de un plan visto por el Responsable (especificacion §6.12,
 * detalle).
 *
 * - Cabecera con PNIP.CI.FR.02, conflicto, plan, estado y fecha de inicio.
 * - Tarjeta compacta del caso: las dos personas, el parentesco y el riesgo
 *   (especificacion §6.12; mockups aprobados por RRHH). Salen de la bandeja
 *   (`PlanDeResponsable`): el rol P no puede pedir `/conflictos` (403). La
 *   bandeja no trae el papel, el cargo ni el departamento de cada persona,
 *   asi que ya no se muestran.
 * - «Ver documento del plan» y «Ver evidencia» en el visor de documentos.
 * - Solo las actividades del responsable, con plazo, fecha limite y dias
 *   restantes, estado y evidencia; «Subir evidencia» / «Volver a subir»
 *   (PDF, PNG o JPG de hasta 5 MB).
 * - Plan cerrado: solo lectura.
 * - Plan inexistente, en borrador o sin actividades suyas: «No se encontró
 *   el plan» (no se ven planes ajenos escribiendo la URL).
 *
 * Las reglas de la subida las aplica tambien `PlanesMockService`.
 *
 * @author Elvis Flores
 */
@Component({
  selector: 'app-plan-responsable-detalle',
  imports: [
    BadgeComponent,
    DocumentViewerComponent,
    FechaLargaPipe,
    IconoComponent,
    ModalComponent,
    RouterLink
  ],
  templateUrl: './plan-responsable-detalle.component.html',
  styleUrl: './plan-responsable-detalle.component.scss'
})
export class PlanResponsableDetalleComponent implements OnInit {
  /** Input oculto para elegir la evidencia. */
  @ViewChild('selectorArchivo') selectorArchivo?: ElementRef<HTMLInputElement>;

  /** Todavia no llego la respuesta. */
  cargando = true;

  /** Plan del responsable; `null` si no se encontro. */
  datos: PlanDeResponsable | null = null;

  /** Error al cargar. */
  errorCarga: string | null = null;

  /** Actividades listas para la vista. */
  actividades: VistaActividadResponsable[] = [];

  /** Errores de subida por actividad. */
  errores: Record<string, string> = {};

  /** Actividad cuya evidencia se esta subiendo. */
  subiendoId: string | null = null;

  /** Documento abierto en el visor; `null` con el modal cerrado. */
  documento: DocumentoAbierto | null = null;

  readonly rutaBandeja = RUTAS.responsable.planes;
  readonly acceptEvidencia = ACCEPT_EVIDENCIA;

  /** Actividad para la que se abrio el selector de archivos. */
  private objetivoId: string | null = null;

  private readonly planesServicio = inject(PlanesMockService);
  private readonly perfil = inject(PerfilUsuarioService);
  private readonly ruta = inject(ActivatedRoute);
  private readonly reloj = inject(RELOJ);
  private readonly destroyRef = inject(DestroyRef);

  /** @returns El plan, o `null`. */
  get plan(): PlanAccion | null {
    return this.datos?.plan ?? null;
  }

  /** @returns «Plan 02 · Nombre». */
  get tituloPlan(): string {
    const plan = this.plan;

    return plan ? 'Plan ' + String(plan.numero).padStart(2, '0') + ' · ' + plan.nombre : '';
  }

  /** @returns Texto del estado del plan (con el tipo de cierre si se sabe). */
  get textoEstado(): string {
    const plan = this.plan;

    return plan ? textoEstadoPlan(plan.estado, tieneActividadesVencidas(plan, this.reloj()), plan.tipoCierre) : '';
  }

  /** @returns Tono del estado del plan. */
  get tonoEstado(): Tono {
    const plan = this.plan;

    return plan
      ? mapearEstadoPlanATono(plan.estado, tieneActividadesVencidas(plan, this.reloj()), plan.tipoCierre)
      : 'gris';
  }

  /** @returns `true` si la bandeja trajo algun dato del caso. */
  get hayCaso(): boolean {
    const d = this.datos;

    return d !== null && (d.nombreA !== '' || d.nombreB !== '' || d.parentesco !== '' || d.riesgo !== null);
  }

  /** @returns Parentesco del caso en una linea (el que trae la bandeja). */
  get parentesco(): string {
    return this.datos?.parentesco ?? '';
  }

  /** @returns «Riesgo alto», «Riesgo moderado»...; vacio si no se sabe. */
  get textoRiesgo(): string {
    const riesgo = this.datos?.riesgo ?? null;

    return riesgo === null ? '' : 'Riesgo ' + textoRiesgo(riesgo).toLowerCase();
  }

  /** @returns Tono del riesgo del caso. */
  get tonoRiesgo(): Tono {
    const riesgo = this.datos?.riesgo ?? null;

    return riesgo === null ? 'gris' : mapearRiesgoATono(riesgo);
  }

  /**
   * @returns Texto del aviso de solo lectura de un plan cerrado: dice como
   * se cerro solo si se sabe (la bandeja del backend no lo trae).
   */
  get avisoCerrado(): string {
    const tipo = this.plan?.tipoCierre;

    if (tipo === 'CUMPLIDO') {
      return 'Plan cerrado: todas las actividades fueron aprobadas. Solo lectura.';
    }
    if (tipo === 'ANTICIPADO') {
      return 'Plan cerrado por RRHH antes de cumplirse (cierre anticipado): las actividades sin aprobar '
        + 'quedaron como «No cumplida». Solo lectura.';
    }

    return 'Plan cerrado. Solo lectura.';
  }

  /** @returns `true` si el plan esta cerrado (solo lectura). */
  get soloLectura(): boolean {
    return this.plan?.estado === 'CERRADO';
  }

  /**
   * Carga el plan de la URL (y lo vuelve a cargar si cambia `:planId`).
   */
  ngOnInit(): void {
    this.ruta.paramMap
      .pipe(
        switchMap((parametros) => {
          const planId = parametros.get('planId') ?? '';
          const empleadoId = this.perfil.obtenerEmpleadoActualId();

          this.cargando = true;
          this.errorCarga = null;
          this.errores = {};
          this.documento = null;
          if (empleadoId === null || planId === '') {
            this.mostrar(null);
            return EMPTY;
          }
          // El caso viene en la misma bandeja: no se pide /conflictos.
          return this.planesServicio.obtenerPlanDeResponsable(planId, empleadoId);
        }),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe({
        next: (datos) => this.mostrar(datos),
        error: (err: unknown) => {
          this.cargando = false;
          this.errorCarga = ERROR_CARGA;
          console.error('[PlanResponsableDetalleComponent.ngOnInit]', err);
        }
      });
  }

  /**
   * Abre el selector de archivos para una actividad.
   *
   * @param actividad Actividad que admite evidencia.
   */
  elegirArchivo(actividad: Actividad): void {
    if (this.soloLectura || this.subiendoId !== null) {
      return;
    }
    this.objetivoId = actividad.id;
    this.selectorArchivo?.nativeElement.click();
  }

  /**
   * Valida el archivo elegido y lo sube.
   *
   * @param evento `change` del input.
   */
  alElegirArchivo(evento: Event): void {
    const input = evento.target as HTMLInputElement;
    const archivo = input.files?.[0];
    const actividadId = this.objetivoId;
    const plan = this.plan;

    input.value = '';
    this.objetivoId = null;
    if (archivo === undefined || actividadId === null || plan === null) {
      return;
    }

    const error = validarEvidencia(archivo);

    this.errores = { ...this.errores, [actividadId]: error ?? '' };
    if (error !== null) {
      return;
    }

    this.subiendoId = actividadId;
    this.planesServicio.subirEvidencia(plan.id, actividadId, archivo)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (resultado) => {
          this.subiendoId = null;
          if (resultado.plan === null) {
            this.errores = { ...this.errores, [actividadId]: resultado.error || ERROR_SUBIDA };
            return;
          }
          this.mostrar(resultado.plan);
        },
        error: (err: unknown) => {
          this.subiendoId = null;
          this.errores = { ...this.errores, [actividadId]: ERROR_SUBIDA };
          console.error('[PlanResponsableDetalleComponent.alElegirArchivo]', err);
        }
      });
  }

  /**
   * El documento firmado del plan solo lo ve RRHH (`GET /planes/{id}/documento`
   * es solo para A y R, confirmado por Sebas). Un R+P si lo ve.
   *
   * @returns `true` si el usuario tiene el rol `rrhh`.
   * @author Elvis Flores
   */
  get puedeVerDocumentoPlan(): boolean {
    return this.perfil.tieneRol('rrhh');
  }

  /**
   * Abre el documento firmado del plan (solo RRHH).
   */
  verDocumentoPlan(): void {
    const archivo = this.plan?.documentoFirmado;

    if (archivo && this.plan && this.puedeVerDocumentoPlan) {
      this.documento = {
        titulo: 'Documento del plan',
        archivo,
        subidoPor: 'RRHH',
        fechaSubida: archivo.fechaSubida ?? '',
        planId: this.plan.id,
        evidenciaId: ''
      };
    }
  }

  /**
   * Abre la evidencia de una actividad.
   *
   * @param actividad Actividad con evidencia.
   */
  verEvidencia(actividad: Actividad): void {
    const evidencia = actividad.evidencia;

    if (evidencia) {
      this.documento = {
        titulo: 'Evidencia de la actividad',
        archivo: evidencia.archivo,
        subidoPor: actividad.responsableNombre,
        fechaSubida: evidencia.fechaSubida,
        planId: '',
        evidenciaId: evidencia.id
      };
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
      console.error('[PlanResponsableDetalleComponent.fecha] Fecha inválida:', iso, err);
      return '';
    }
  }

  /**
   * @param datos Plan recibido, o `null` si no se encontro.
   */
  private mostrar(datos: PlanDeResponsable | null): void {
    this.cargando = false;
    this.datos = datos;
    this.actividades = datos ? datos.plan.actividades.map((a) => this.crearVista(a, datos.plan)) : [];
  }

  /**
   * @param actividad Actividad del responsable.
   * @param plan Su plan.
   * @returns Lo que muestra la pantalla.
   */
  private crearVista(actividad: Actividad, plan: PlanAccion): VistaActividadResponsable {
    const porHacer = ESTADOS_CON_SUBIDA.includes(actividad.estado);
    let dias: DiasRestantes | null = null;

    if (porHacer && actividad.fechaLimite) {
      try {
        dias = calcularDiasRestantes(actividad.fechaLimite, this.reloj());
      } catch (err) {
        console.error('[PlanResponsableDetalleComponent.crearVista]', err);
      }
    }

    return {
      actividad,
      textoEstado: textoEstadoActividad(actividad.estado, true),
      tonoEstado: mapearEstadoActividadATono(actividad.estado, true),
      plazo: textoPlazo(actividad),
      fechaLimite: this.fecha(actividad.fechaLimite),
      dias,
      vencida: estaVencida(actividad, this.reloj()) || (dias?.vencida ?? false),
      puedeSubir: porHacer && plan.estado !== 'CERRADO' && plan.estado !== 'BORRADOR'
    };
  }
}
