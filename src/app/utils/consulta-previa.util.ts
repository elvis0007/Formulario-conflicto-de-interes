import {
  CoincidenciaCandidato,
  DatosCandidato,
  FormularioCI,
  GradoParentesco,
  Persona,
  Relacion,
  Riesgo
} from '../models';
import { normalizarTexto } from './texto.util';

/**
 * Utilidades puras de la Consulta Previa a Contratación: estiman si un
 * candidato tiene parientes entre los empleados actuales.
 *
 * Es una estimacion para orientar a RRHH: el analisis de conflictos real
 * se hace con los formularios declarados.
 *
 * @author Elvis Flores
 */

/** Error: no se indico ni la cedula ni nombres y apellidos. */
export const ERROR_DATOS_MINIMOS = 'Escribe la cédula, o los nombres y los apellidos del candidato.';

/** Error: la cedula no tiene 10 digitos. */
export const ERROR_CEDULA = 'La cédula debe tener 10 dígitos.';

/** Parentesco declarado → relacion y grado. */
const GRADO_POR_PARENTESCO: Readonly<Record<string, { relacion: Relacion; grado: GradoParentesco | null }>> = {
  padre: { relacion: 'Consanguinidad', grado: 1 },
  madre: { relacion: 'Consanguinidad', grado: 1 },
  hijo: { relacion: 'Consanguinidad', grado: 1 },
  hija: { relacion: 'Consanguinidad', grado: 1 },
  hermano: { relacion: 'Consanguinidad', grado: 2 },
  hermana: { relacion: 'Consanguinidad', grado: 2 },
  abuelo: { relacion: 'Consanguinidad', grado: 2 },
  abuela: { relacion: 'Consanguinidad', grado: 2 },
  nieto: { relacion: 'Consanguinidad', grado: 2 },
  nieta: { relacion: 'Consanguinidad', grado: 2 },
  tio: { relacion: 'Consanguinidad', grado: 3 },
  tia: { relacion: 'Consanguinidad', grado: 3 },
  sobrino: { relacion: 'Consanguinidad', grado: 3 },
  sobrina: { relacion: 'Consanguinidad', grado: 3 },
  primo: { relacion: 'Consanguinidad', grado: 4 },
  prima: { relacion: 'Consanguinidad', grado: 4 },
  conyuge: { relacion: 'Afinidad', grado: null },
  suegro: { relacion: 'Afinidad', grado: 1 },
  suegra: { relacion: 'Afinidad', grado: 1 },
  yerno: { relacion: 'Afinidad', grado: 1 },
  nuera: { relacion: 'Afinidad', grado: 1 },
  cunado: { relacion: 'Afinidad', grado: 2 },
  cunada: { relacion: 'Afinidad', grado: 2 }
};

/**
 * Valida los datos minimos: la cedula (10 digitos) o nombres y apellidos.
 *
 * @param datos Datos escritos.
 * @returns El mensaje de error, o `null` si se puede consultar.
 * @author Elvis Flores
 */
export function validarDatosCandidato(datos: DatosCandidato): string | null {
  const cedula = datos.cedula.trim();

  if (cedula !== '' && !/^\d{10}$/.test(cedula)) {
    return ERROR_CEDULA;
  }
  if (cedula === '' && (datos.nombres.trim() === '' || datos.apellidos.trim() === '')) {
    return ERROR_DATOS_MINIMOS;
  }

  return null;
}

/**
 * Riesgo estimado: 1er grado o conyuge → alto; 2do → moderado; 3ro y 4to →
 * bajo.
 *
 * @param grado Grado (`null` = conyuge).
 * @returns Riesgo estimado.
 * @author Elvis Flores
 */
export function riesgoEstimado(grado: GradoParentesco | null): Riesgo {
  if (grado === null || grado === 1) {
    return 'alto';
  }
  return grado === 2 ? 'medio' : 'bajo';
}

/**
 * Busca empleados con posible parentesco con el candidato. Por empleado se
 * queda la coincidencia mas fuerte, en este orden:
 *
 * 1. La cedula o el nombre del candidato estan en el formulario declarado
 *    del empleado (parentesco declarado).
 * 2. El nombre del candidato es el del padre, la madre o el conyuge del
 *    empleado en su ficha.
 * 3. Comparten los dos apellidos (posible hermano/a, 2do grado).
 * 4. Comparten el primer apellido (posible pariente paterno, estimado en
 *    3er grado).
 *
 * @param datos Datos del candidato (ya validados).
 * @param empleados Empleados actuales.
 * @param formularios Formularios de conflicto de interes declarados.
 * @returns Coincidencias, de mayor a menor riesgo.
 * @author Elvis Flores
 */
export function buscarCoincidencias(
  datos: DatosCandidato,
  empleados: readonly Persona[],
  formularios: readonly FormularioCI[]
): CoincidenciaCandidato[] {
  const cedula = datos.cedula.trim();
  const nombre = normalizarTexto(datos.nombres + ' ' + datos.apellidos);
  const apellidos = palabras(datos.apellidos);
  const coincidencias: CoincidenciaCandidato[] = [];

  for (const empleado of empleados) {
    if (cedula !== '' && empleado.cedula === cedula) {
      continue;
    }

    const encontrada = porDeclaracion(empleado, formularios, cedula, nombre)
      ?? porFicha(empleado, nombre)
      ?? porApellidos(empleado, apellidos);

    if (encontrada !== null) {
      coincidencias.push(encontrada);
    }
  }

  const orden: Record<Riesgo, number> = { alto: 0, medio: 1, bajo: 2, ninguno: 3 };

  return coincidencias.sort((a, b) => orden[a.riesgo] - orden[b.riesgo]
    || a.empleado.nombres.localeCompare(b.empleado.nombres));
}

/**
 * @param empleado Empleado.
 * @param formularios Formularios declarados.
 * @param cedula Cedula del candidato.
 * @param nombre Nombre completo normalizado del candidato.
 * @returns Coincidencia por el formulario del empleado, o `null`.
 */
function porDeclaracion(
  empleado: Persona,
  formularios: readonly FormularioCI[],
  cedula: string,
  nombre: string
): CoincidenciaCandidato | null {
  const formulario = formularios.find((f) => f.cedula === empleado.cedula);
  const familiar = formulario?.familiares.find((f) =>
    (cedula !== '' && f.cedula === cedula) || (nombre.trim() !== '' && normalizarTexto(f.nombre) === nombre));

  if (familiar === undefined) {
    return null;
  }

  const porCedula = cedula !== '' && familiar.cedula === cedula;

  return crear(empleado, familiar.parentesco,
    'Declarado como ' + familiar.parentesco.toLowerCase() + ' en el formulario de conflicto de interés del empleado'
      + (porCedula ? ' (misma cédula).' : ' (mismo nombre).'));
}

/**
 * @param empleado Empleado.
 * @param nombre Nombre completo normalizado del candidato.
 * @returns Coincidencia por padre, madre o conyuge de su ficha, o `null`.
 */
function porFicha(empleado: Persona, nombre: string): CoincidenciaCandidato | null {
  const campos: [string | undefined, string, string][] = [
    [empleado.padre, 'Padre', 'Es el nombre del padre del empleado en su ficha.'],
    [empleado.madre, 'Madre', 'Es el nombre de la madre del empleado en su ficha.'],
    [empleado.conyuge, 'Cónyuge', 'Es el nombre del cónyuge del empleado en su ficha.']
  ];
  const campo = campos.find(([valor]) => valor !== undefined && normalizarTexto(valor) === nombre);

  return campo ? crear(empleado, campo[1], campo[2]) : null;
}

/**
 * @param empleado Empleado.
 * @param apellidos Apellidos normalizados del candidato.
 * @returns Coincidencia por apellidos compartidos, o `null`.
 */
function porApellidos(empleado: Persona, apellidos: string[]): CoincidenciaCandidato | null {
  const delEmpleado = palabras(empleado.nombres).slice(-2);

  if (apellidos.length === 0 || delEmpleado.length < 2) {
    return null;
  }
  if (apellidos.length >= 2 && apellidos[0] === delEmpleado[0] && apellidos[1] === delEmpleado[1]) {
    return {
      empleado,
      parentesco: 'Hermano/a (estimado)',
      relacion: 'Consanguinidad',
      grado: 2,
      riesgo: riesgoEstimado(2),
      motivo: 'Comparten los dos apellidos.'
    };
  }
  if (apellidos[0] === delEmpleado[0]) {
    return {
      empleado,
      parentesco: 'Pariente por línea paterna (estimado)',
      relacion: 'Consanguinidad',
      grado: 3,
      riesgo: riesgoEstimado(3),
      motivo: 'Comparten el primer apellido.'
    };
  }

  return null;
}

/**
 * @param empleado Empleado.
 * @param parentesco Parentesco (lo que el candidato es del empleado).
 * @param motivo Por que coincide.
 * @returns La coincidencia con relacion, grado y riesgo.
 */
function crear(empleado: Persona, parentesco: string, motivo: string): CoincidenciaCandidato {
  const clave = normalizarTexto(parentesco).replace(/\s+/g, '');
  const datos = GRADO_POR_PARENTESCO[clave] ?? { relacion: 'Consanguinidad' as Relacion, grado: 4 as GradoParentesco };

  return {
    empleado,
    parentesco,
    relacion: datos.relacion,
    grado: datos.grado,
    riesgo: riesgoEstimado(datos.grado),
    motivo
  };
}

/**
 * @param texto Texto.
 * @returns Sus palabras normalizadas.
 */
function palabras(texto: string): string[] {
  return normalizarTexto(texto).split(/\s+/).filter((p) => p !== '');
}
