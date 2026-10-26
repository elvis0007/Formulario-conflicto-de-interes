import {
  Component,
  EventEmitter,
  Input,
  OnChanges,
  Output,
  SimpleChanges
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Clasificacion, Conflicto, Persona } from '../../models';
import { GradoParentescoPipe } from '../../pipes/grado-parentesco.pipe';
import { BadgeComponent } from '../../shared/badge/badge.component';
import { rolesInvolucrados } from '../../utils/analisis.util';
import { formatearFecha, parsearFecha } from '../../utils/fechas.util';
import { Tono, mapearEstadoSeguimientoATono, textoEstadoSeguimiento } from '../../utils/tono.util';

/** Texto de un dato que no se conoce. */
const SIN_DATO = '—';

/** Largo maximo de la observacion. */
export const LARGO_MAXIMO_OBSERVACION = 500;

/** Opcion de clasificacion (tarjeta seleccionable). */
interface OpcionClasificacion {
  /** `null` = sin clasificar (pendiente de revision). */
  valor: Clasificacion | null;
  titulo: string;
  descripcion: string;
}

/** Caso aun sin clasificar (solo se muestra en solo lectura). */
const OPCION_PENDIENTE: OpcionClasificacion = {
  valor: null,
  titulo: 'Pendiente de revisión',
  descripcion: 'Aún no se confirma el parentesco.'
};

/**
 * Las clasificaciones que se pueden elegir, en el orden en que se
 * muestran. No incluye «Pendiente de revisión»: en el backend clasificar es
 * definitivo y un caso no vuelve a «sin clasificar».
 */
const OPCIONES_CLASIFICACION: readonly OpcionClasificacion[] = [
  {
    valor: 'D',
    titulo: 'Declarado',
    descripcion: 'El parentesco es real y el empleado lo declaró. Se podrán crear planes de acción.'
  },
  {
    valor: 'N',
    titulo: 'No declarado (omisión)',
    descripcion: 'El parentesco es real pero el empleado no lo declaró. Se podrán crear planes de acción.'
  },
  {
    valor: 'H',
    titulo: 'Homónimo',
    descripcion: 'Coincidencia de nombres, sin parentesco. El caso se archiva.'
  }
];

/** Un dato de la tarjeta de una persona. */
interface DatoPersona {
  etiqueta: string;
  valor: string;
}

/** Tarjeta de una de las dos personas del caso. */
interface TarjetaPersona {
  nombre: string;
  rol: string;
  datos: DatoPersona[];
}

/** Error: se pulso «Guardar» sin elegir una clasificacion. */
export const ERROR_SIN_CLASIFICACION = 'Elige una clasificación para el caso.';

/** Error: un homonimo exige observacion (el backend exige comentario). */
export const ERROR_OBSERVACION_HOMONIMO = 'Escribe una observación: es obligatoria para marcar un homónimo.';

/** Lo que emite «Guardar clasificación». */
export interface ClasificacionElegida {
  /** Clasificacion elegida (nunca `null`: el formulario no deja guardar sin elegir). */
  clasificacion: Clasificacion;
  observacion: string;
}

/**
 * Contenido del modal «Ver detalles» de un caso del analisis: franja de
 * parentesco, una tarjeta por persona, riesgo identificado, como se
 * detecto y la clasificacion del caso.
 *
 * El modal (cabecera, cierre, foco) lo pone la pantalla con
 * `ModalComponent`; este componente es solo el cuerpo.
 *
 * - Editable (analisis en Borrador **y** caso en `DETECTADO`): tres
 *   tarjetas seleccionables (Declarado, No declarado, Homonimo),
 *   observacion (obligatoria para Homonimo, se valida antes de enviar),
 *   «Cancelar» y «Guardar clasificación».
 * - Solo lectura (analisis Validado, o caso que ya salio de `DETECTADO`:
 *   en el backend clasificar es definitivo): la clasificacion, su estado de
 *   seguimiento y la observacion, sin boton de guardar.
 *
 * @author Elvis Flores
 */
@Component({
  selector: 'app-detalle-conflicto',
  imports: [BadgeComponent, FormsModule, GradoParentescoPipe],
  templateUrl: './detalle-conflicto.component.html',
  styleUrl: './detalle-conflicto.component.scss'
})
export class DetalleConflictoComponent implements OnChanges {
  /** Caso a mostrar. */
  @Input({ required: true }) conflicto!: Conflicto;

  /**
   * Si el analisis esta en Borrador. Aun asi, el caso solo se puede
   * clasificar si sigue en `DETECTADO` (ver `puedeClasificar`).
   */
  @Input() editable = true;

  /** Guardado en curso: deshabilita los botones. */
  @Input() guardando = false;

  /** Mensaje de error del ultimo guardado, si lo hubo. */
  @Input() error: string | null = null;

  /** «Guardar clasificación». */
  @Output() guardar = new EventEmitter<ClasificacionElegida>();

  /** «Cancelar». */
  @Output() cancelar = new EventEmitter<void>();

  readonly opciones = OPCIONES_CLASIFICACION;
  readonly largoMaximo = LARGO_MAXIMO_OBSERVACION;

  /** Clasificacion elegida en las tarjetas. */
  seleccion: Clasificacion | null = null;

  /** Texto del campo de observacion. */
  observacion = '';

  /** Error de validacion previo al envio; `null` si no hay. */
  errorLocal: string | null = null;

  /** Texto de la franja «Parentesco». */
  parentesco = '';

  /** Tarjetas de las dos personas. */
  personas: TarjetaPersona[] = [];

  /** Nombre del grupo de radios (unico por caso). */
  nombreGrupo = '';

  /**
   * Al cambiar de caso, vuelve a su clasificacion y observacion guardadas.
   *
   * @param cambios Cambios de inputs.
   */
  ngOnChanges(cambios: SimpleChanges): void {
    if (cambios['conflicto']) {
      const roles = rolesInvolucrados(this.conflicto);

      this.seleccion = this.conflicto.clasificacion;
      this.errorLocal = null;
      this.observacion = this.conflicto.observacionClasificacion ?? '';
      this.nombreGrupo = 'clasificacion-' + this.conflicto.id;
      this.parentesco = roles.tipo === 'simetrica'
        ? roles.etiqueta
        : roles.rolA + ' – ' + roles.rolB;
      this.personas = [
        this.crearTarjeta(this.conflicto.personaA, this.conflicto.rolA),
        this.crearTarjeta(this.conflicto.personaB, this.conflicto.rolB)
      ];
    }
  }

  /**
   * @returns `true` si se puede clasificar el caso: analisis en Borrador y
   * caso todavia en `DETECTADO`.
   */
  get puedeClasificar(): boolean {
    return this.editable && this.conflicto.estado === 'DETECTADO';
  }

  /**
   * @returns La opcion guardada del caso (para la vista de solo lectura).
   */
  get opcionElegida(): OpcionClasificacion {
    return OPCIONES_CLASIFICACION.find((o) => o.valor === this.seleccion) ?? OPCION_PENDIENTE;
  }

  /** @returns Por que la clasificacion esta en solo lectura. */
  get motivoSoloLectura(): string {
    return this.editable
      ? 'La clasificación es definitiva: el caso ya salió de «Detectado» y no se puede cambiar.'
      : 'El análisis está validado: la clasificación ya no se puede cambiar.';
  }

  /** @returns Texto del estado de seguimiento del caso. */
  get textoEstado(): string {
    return textoEstadoSeguimiento(this.conflicto.estado);
  }

  /** @returns Tono del estado de seguimiento del caso. */
  get tonoEstado(): Tono {
    return mapearEstadoSeguimientoATono(this.conflicto.estado);
  }

  /** @returns Error a mostrar: el de validacion o el del guardado. */
  get errorVisible(): string | null {
    return this.errorLocal ?? this.error;
  }

  /**
   * Elige una clasificacion y limpia el aviso de validacion.
   *
   * @param valor Clasificacion elegida.
   */
  elegir(valor: Clasificacion | null): void {
    this.seleccion = valor;
    this.errorLocal = null;
  }

  /**
   * Emite la clasificacion elegida si se puede clasificar y es valida:
   * hay una opcion elegida y, para Homonimo, una observacion.
   */
  alGuardar(): void {
    if (!this.puedeClasificar || this.guardando) {
      return;
    }

    const observacion = this.observacion.trim();

    if (this.seleccion === null) {
      this.errorLocal = ERROR_SIN_CLASIFICACION;
      return;
    }
    if (this.seleccion === 'H' && observacion === '') {
      this.errorLocal = ERROR_OBSERVACION_HOMONIMO;
      return;
    }
    this.errorLocal = null;
    this.guardar.emit({ clasificacion: this.seleccion, observacion });
  }

  /**
   * @param persona Persona del caso.
   * @param rol Su rol en el parentesco.
   * @returns Su tarjeta, con «—» en los datos que faltan.
   */
  private crearTarjeta(persona: Persona, rol: string): TarjetaPersona {
    return {
      nombre: persona.nombres,
      rol,
      datos: [
        { etiqueta: 'Cédula', valor: this.texto(persona.cedula) },
        { etiqueta: 'Cargo', valor: this.texto(persona.cargo) },
        { etiqueta: 'Departamento', valor: this.texto(persona.departamento) },
        { etiqueta: 'Jefe inmediato', valor: this.texto(persona.jefeInmediato) },
        { etiqueta: 'Fecha de ingreso', valor: this.fecha(persona.fechaIngreso) },
        { etiqueta: 'Padre', valor: this.texto(persona.padre) },
        { etiqueta: 'Madre', valor: this.texto(persona.madre) },
        { etiqueta: 'Cónyuge', valor: this.texto(persona.conyuge) }
      ]
    };
  }

  /**
   * @param valor Dato opcional.
   * @returns El dato, o «—» si falta.
   */
  private texto(valor: string | undefined): string {
    return (valor ?? '').trim() || SIN_DATO;
  }

  /**
   * @param iso Fecha ISO opcional.
   * @returns La fecha en dd/mm/aaaa, o «—» si falta o no es valida.
   */
  private fecha(iso: string | undefined): string {
    if (!iso) {
      return SIN_DATO;
    }
    try {
      return formatearFecha(parsearFecha(iso));
    } catch (err) {
      console.error('[DetalleConflictoComponent.fecha] Fecha inválida:', iso, err);
      return SIN_DATO;
    }
  }
}
