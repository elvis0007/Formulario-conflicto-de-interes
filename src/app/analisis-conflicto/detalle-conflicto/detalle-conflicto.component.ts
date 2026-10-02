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
import { rolesInvolucrados } from '../../utils/analisis.util';
import { formatearFecha, parsearFecha } from '../../utils/fechas.util';

/** Texto de un dato que no se conoce. */
const SIN_DATO = '—';

/** Largo maximo de la observacion. */
export const LARGO_MAXIMO_OBSERVACION = 500;

/** Opcion de clasificacion (tarjeta seleccionable). */
interface OpcionClasificacion {
  valor: Clasificacion;
  titulo: string;
  descripcion: string;
}

/** Las tres clasificaciones posibles, en el orden en que se muestran. */
const OPCIONES_CLASIFICACION: readonly OpcionClasificacion[] = [
  {
    valor: 'pendiente',
    titulo: 'Pendiente de revisión',
    descripcion: 'Aún no se confirma el parentesco.'
  },
  {
    valor: 'confirmado',
    titulo: 'Conflicto confirmado',
    descripcion: 'El parentesco es real. Se podrán crear planes de acción.'
  },
  {
    valor: 'homonimo',
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

/** Lo que emite «Guardar clasificación». */
export interface ClasificacionElegida {
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
 * - `editable` en `true` (analisis en Borrador): tres tarjetas
 *   seleccionables, observacion opcional, «Cancelar» y «Guardar
 *   clasificación».
 * - `editable` en `false` (analisis Validado): la opcion elegida y la
 *   observacion en solo lectura, sin boton de guardar.
 *
 * @author Elvis Flores
 */
@Component({
  selector: 'app-detalle-conflicto',
  imports: [FormsModule, GradoParentescoPipe],
  templateUrl: './detalle-conflicto.component.html',
  styleUrl: './detalle-conflicto.component.scss'
})
export class DetalleConflictoComponent implements OnChanges {
  /** Caso a mostrar. */
  @Input({ required: true }) conflicto!: Conflicto;

  /** Si se puede cambiar la clasificacion (analisis en Borrador). */
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
  seleccion: Clasificacion = 'pendiente';

  /** Texto del campo de observacion. */
  observacion = '';

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
   * @returns La opcion elegida (para la vista de solo lectura).
   */
  get opcionElegida(): OpcionClasificacion {
    return this.opciones.find((o) => o.valor === this.seleccion) ?? this.opciones[0];
  }

  /**
   * Emite la clasificacion elegida, si se puede editar.
   */
  alGuardar(): void {
    if (!this.editable || this.guardando) {
      return;
    }
    this.guardar.emit({
      clasificacion: this.seleccion,
      observacion: this.observacion.trim()
    });
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
