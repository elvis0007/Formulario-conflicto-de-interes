import { Component, DestroyRef, OnInit, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  AbstractControl,
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  ValidationErrors,
  ValidatorFn,
  Validators
} from '@angular/forms';
import { CoincidenciaCandidato, ConsultaPrevia, DatosCandidato } from '../models';
import { FechaLargaPipe } from '../pipes/fecha-larga.pipe';
import { ConsultaPreviaMockService } from '../services/consulta-previa-mock.service';
import { BadgeComponent } from '../shared/badge/badge.component';
import { EmptyStateComponent } from '../shared/empty-state/empty-state.component';
import { IconoComponent } from '../shared/icono/icono.component';
import { textoGrado, textoRiesgo } from '../utils/analisis.util';
import { ERROR_CEDULA, ERROR_DATOS_MINIMOS } from '../utils/consulta-previa.util';
import { Tono, mapearRiesgoATono } from '../utils/tono.util';

/** Mensaje si la consulta falla. */
const ERROR_CONSULTA = 'No se pudo hacer la consulta. Inténtalo de nuevo.';

/** Aviso permanente de la pantalla. */
export const AVISO_INFORMATIVO = 'Consulta informativa. No crea un registro en el análisis ni un plan de acción.';

/** Formulario de la consulta. */
type FormularioConsulta = FormGroup<{
  cedula: FormControl<string>;
  nombres: FormControl<string>;
  apellidos: FormControl<string>;
}>;

/**
 * Exige la cedula, o los nombres y los apellidos.
 *
 * @returns Validador del grupo: `{ datosMinimos: true }` si falta.
 * @author Elvis Flores
 */
export function datosMinimosValidator(): ValidatorFn {
  return (grupo: AbstractControl): ValidationErrors | null => {
    const valor = grupo.value as Partial<DatosCandidato>;
    const cedula = (valor.cedula ?? '').trim();
    const completos = (valor.nombres ?? '').trim() !== '' && (valor.apellidos ?? '').trim() !== '';

    return cedula !== '' || completos ? null : { datosMinimos: true };
  };
}

/**
 * Consulta Previa a Contratación (especificacion §6.10): antes de
 * contratar a alguien, muestra si tiene posibles parientes entre los
 * empleados actuales.
 *
 * - Formulario: cedula (10 digitos), nombres y apellidos; «Consultar» exige
 *   la cedula o nombres y apellidos.
 * - Resultado: una tarjeta por coincidencia (empleado, cargo y
 *   departamento, parentesco y grado estimados, riesgo) o «Sin
 *   coincidencias con empleados actuales».
 * - Aviso: la consulta es informativa.
 * - «Nueva consulta» limpia el formulario y el resultado.
 * - «Consultas recientes» de la sesion.
 *
 * @author Elvis Flores
 */
@Component({
  selector: 'app-consulta-previa',
  imports: [BadgeComponent, EmptyStateComponent, FechaLargaPipe, IconoComponent, ReactiveFormsModule],
  templateUrl: './consulta-previa.component.html',
  styleUrl: './consulta-previa.component.scss'
})
export class ConsultaPreviaComponent implements OnInit {
  /** Formulario. */
  readonly formulario: FormularioConsulta = new FormGroup({
    cedula: new FormControl('', { nonNullable: true, validators: [Validators.pattern(/^\s*(\d{10})?\s*$/)] }),
    nombres: new FormControl('', { nonNullable: true }),
    apellidos: new FormControl('', { nonNullable: true })
  }, { validators: datosMinimosValidator() });

  /** Se pulso «Consultar» (muestra los errores). */
  intentado = false;

  /** Consulta en curso. */
  consultando = false;

  /** Resultado de la ultima consulta. */
  resultado: ConsultaPrevia | null = null;

  /** Error de la ultima consulta. */
  errorConsulta: string | null = null;

  /** Consultas de la sesion. */
  recientes: ConsultaPrevia[] = [];

  readonly aviso = AVISO_INFORMATIVO;
  readonly errorCedula = ERROR_CEDULA;
  readonly errorDatosMinimos = ERROR_DATOS_MINIMOS;

  private readonly servicio = inject(ConsultaPreviaMockService);
  private readonly destroyRef = inject(DestroyRef);

  /** @returns `true` si se debe mostrar el error de la cedula. */
  get cedulaInvalida(): boolean {
    return this.intentado && this.formulario.controls.cedula.hasError('pattern');
  }

  /** @returns `true` si faltan los datos minimos. */
  get faltanDatos(): boolean {
    return this.intentado && this.formulario.hasError('datosMinimos');
  }

  /**
   * Carga las consultas recientes.
   */
  ngOnInit(): void {
    this.cargarRecientes();
  }

  /**
   * «Consultar».
   */
  consultar(): void {
    this.intentado = true;
    this.formulario.markAllAsTouched();
    if (this.formulario.invalid || this.consultando) {
      return;
    }

    this.consultando = true;
    this.errorConsulta = null;
    this.servicio.consultarCandidato(this.formulario.getRawValue())
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (consulta) => {
          this.consultando = false;
          if (consulta === null) {
            this.errorConsulta = ERROR_CONSULTA;
            return;
          }
          this.resultado = consulta;
          this.cargarRecientes();
        },
        error: (err: unknown) => {
          this.consultando = false;
          this.errorConsulta = ERROR_CONSULTA;
          console.error('[ConsultaPreviaComponent.consultar]', err);
        }
      });
  }

  /**
   * «Nueva consulta»: limpia el formulario y el resultado.
   */
  nuevaConsulta(): void {
    this.formulario.reset();
    this.intentado = false;
    this.resultado = null;
    this.errorConsulta = null;
  }

  /**
   * @param datos Datos consultados.
   * @returns «Nombres Apellidos · C.I. 1800…» con lo que se haya escrito.
   */
  descripcion(datos: DatosCandidato): string {
    const nombre = (datos.nombres + ' ' + datos.apellidos).trim();
    const partes = [nombre, datos.cedula ? 'C.I. ' + datos.cedula : ''].filter((p) => p !== '');

    return partes.join(' · ');
  }

  /**
   * @param c Coincidencia.
   * @returns «Consanguinidad, 2do grado» o «Afinidad · No aplica».
   */
  relacion(c: CoincidenciaCandidato): string {
    return c.relacion + ', ' + textoGrado(c.grado);
  }

  /** @param c Coincidencia. @returns «Riesgo alto»... */
  textoRiesgo(c: CoincidenciaCandidato): string {
    return 'Riesgo ' + textoRiesgo(c.riesgo).toLowerCase();
  }

  /** @param c Coincidencia. @returns Tono del riesgo. */
  tonoRiesgo(c: CoincidenciaCandidato): Tono {
    return mapearRiesgoATono(c.riesgo);
  }

  /**
   * Vuelve a pedir las consultas de la sesion.
   */
  private cargarRecientes(): void {
    this.servicio.obtenerConsultasRecientes()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (consultas) => this.recientes = consultas,
        error: (err: unknown) => console.error('[ConsultaPreviaComponent.cargarRecientes]', err)
      });
  }
}
