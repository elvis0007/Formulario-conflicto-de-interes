import { Component, DestroyRef, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { AbstractControl, FormControl, FormGroup, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';
import { CoincidenciaCandidato, ConsultaPrevia, DatosCandidato } from '../models';
import { ConsultaPreviaMockService } from '../services/consulta-previa-mock.service';
import { BadgeComponent } from '../shared/badge/badge.component';
import { EmptyStateComponent } from '../shared/empty-state/empty-state.component';
import { IconoComponent } from '../shared/icono/icono.component';
import { textoGrado, textoRiesgo } from '../utils/analisis.util';
import {
  ERROR_APELLIDOS_OBLIGATORIOS,
  ERROR_CEDULA,
  ERROR_CEDULA_OBLIGATORIA,
  ERROR_NOMBRES_OBLIGATORIOS
} from '../utils/consulta-previa.util';
import { Tono, mapearRiesgoATono } from '../utils/tono.util';

/** Mensaje si la consulta falla. */
const ERROR_CONSULTA = 'No se pudo hacer la consulta. Inténtalo de nuevo.';

/** Aviso permanente de la pantalla. */
export const AVISO_INFORMATIVO = 'Consulta informativa. No crea un registro en el análisis ni un plan de acción.';

/**
 * El campo debe tener algo mas que espacios.
 *
 * @param control Campo de texto.
 * @returns `{ vacio: true }` si esta vacio o solo tiene espacios.
 * @author Elvis Flores
 */
export function sinEspacios(control: AbstractControl): ValidationErrors | null {
  return String(control.value ?? '').trim() === '' ? { vacio: true } : null;
}

/** Formulario de la consulta. */
type FormularioConsulta = FormGroup<{
  cedula: FormControl<string>;
  nombres: FormControl<string>;
  apellidos: FormControl<string>;
}>;

/**
 * Consulta Previa a Contratación (especificacion §6.10): antes de
 * contratar a alguien, muestra si tiene posibles parientes entre los
 * empleados actuales.
 *
 * - Formulario: cedula (10 digitos), nombres y apellidos; el backend exige
 *   los tres, asi que «Consultar» los valida antes de enviar y avisa cual
 *   falta.
 * - Resultado: una tarjeta por coincidencia (empleado, cargo y
 *   departamento, parentesco y grado estimados, riesgo) o «Sin
 *   coincidencias con empleados actuales».
 * - Aviso: la consulta es informativa.
 * - «Nueva consulta» limpia el formulario y el resultado.
 *
 * @author Elvis Flores
 */
@Component({
  selector: 'app-consulta-previa',
  imports: [BadgeComponent, EmptyStateComponent, IconoComponent, ReactiveFormsModule],
  templateUrl: './consulta-previa.component.html',
  styleUrl: './consulta-previa.component.scss'
})
export class ConsultaPreviaComponent {
  /** Formulario. */
  readonly formulario: FormularioConsulta = new FormGroup({
    cedula: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.pattern(/^\s*\d{10}\s*$/)] }),
    nombres: new FormControl('', { nonNullable: true, validators: [sinEspacios] }),
    apellidos: new FormControl('', { nonNullable: true, validators: [sinEspacios] })
  });

  /** Se pulso «Consultar» (muestra los errores). */
  intentado = false;

  /** Consulta en curso. */
  consultando = false;

  /** Resultado de la ultima consulta. */
  resultado: ConsultaPrevia | null = null;

  /** Error de la ultima consulta. */
  errorConsulta: string | null = null;

  readonly aviso = AVISO_INFORMATIVO;
  readonly errorCedula = ERROR_CEDULA;
  readonly errorCedulaObligatoria = ERROR_CEDULA_OBLIGATORIA;
  readonly errorNombres = ERROR_NOMBRES_OBLIGATORIOS;
  readonly errorApellidos = ERROR_APELLIDOS_OBLIGATORIOS;

  private readonly servicio = inject(ConsultaPreviaMockService);
  private readonly destroyRef = inject(DestroyRef);

  /** @returns `true` si se debe mostrar que falta la cedula. */
  get cedulaVacia(): boolean {
    return this.intentado && this.formulario.controls.cedula.hasError('required');
  }

  /** @returns `true` si se debe mostrar que la cedula no tiene 10 digitos. */
  get cedulaInvalida(): boolean {
    return this.intentado && this.formulario.controls.cedula.hasError('pattern');
  }

  /** @returns `true` si se debe mostrar que falta un nombre. */
  get faltanNombres(): boolean {
    return this.intentado && this.formulario.controls.nombres.invalid;
  }

  /** @returns `true` si se debe mostrar que falta un apellido. */
  get faltanApellidos(): boolean {
    return this.intentado && this.formulario.controls.apellidos.invalid;
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
            this.errorConsulta = this.servicio.ultimoError ?? ERROR_CONSULTA;
            return;
          }
          this.resultado = consulta;
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
}
