import { ActividadSugerida, Conflicto } from '../models';

/** Plazo por defecto de una actividad sugerida (plan maestro, P4). */
export const PLAZO_SUGERIDO_MESES = 1;

/** Plazo de la actividad de seguimiento. */
export const PLAZO_SEGUIMIENTO_MESES = 6;

/**
 * Actividades sugeridas para el plan de un conflicto familiar, con las
 * mismas reglas que el backend (`SugerenciaPlan.generar`, wssisci r4093):
 *
 * - siempre, la declaracion de excusa de la persona A;
 * - con riesgo Alto o Critico, reasignar la linea de supervision;
 * - con riesgo Critico, evaluar la reubicacion;
 * - siempre, el seguimiento a seis meses.
 *
 * Bajo y Moderado dan 2 actividades; Alto, 3; Critico, 4. Las relaciones
 * con proveedores no existen en los datos simulados.
 *
 * @param conflicto Caso del plan.
 * @returns Las actividades, en orden. El responsable lo elige RRHH.
 * @author Elvis Flores
 */
export function sugerirActividades(conflicto: Conflicto): ActividadSugerida[] {
  const a = conflicto.personaA.nombres;
  const b = conflicto.personaB.nombres;
  const lista: ActividadSugerida[] = [];
  const agregar = (descripcion: string, plazoMeses = PLAZO_SUGERIDO_MESES): void => {
    lista.push({ descripcion, responsableSugeridoId: null, plazoMeses, plazoDias: 0 });
  };

  agregar('Firmar una declaración de excusa: ' + a + ' se abstendrá de intervenir en procesos '
    + 'de selección, contratación, evaluación, ascenso o pago que involucren a ' + b + '.');
  if (conflicto.riesgo === 'ALTO' || conflicto.riesgo === 'CRITICO') {
    agregar('Reasignar la línea de supervisión para que ni ' + a + ' ni ' + b
      + ' evalúen, autoricen o aprueben el trabajo de la otra persona.');
  }
  if (conflicto.riesgo === 'CRITICO') {
    agregar('Evaluar la reubicación de una de las dos personas a una unidad distinta y '
      + 'documentar la decisión.');
  }
  agregar('Seguimiento: verificar que las medidas se cumplen y que la situación no cambió.',
    PLAZO_SEGUIMIENTO_MESES);

  return lista;
}
