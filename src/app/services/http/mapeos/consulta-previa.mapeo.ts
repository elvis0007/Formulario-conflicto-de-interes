import { CoincidenciaCandidato, ConsultaPrevia, DatosCandidato, GradoParentesco, Relacion, Riesgo } from '../../../models';
import {
  CoincidenciaApi,
  ConsultaPreviaApi,
  CrearConsultaRequestApi,
  FuenteCoincidenciaApi,
  ParentescoApi
} from '../../../models/api';

/**
 * Funciones puras de la consulta previa: arman el pedido del backend y
 * convierten su respuesta al modelo de la pantalla.
 *
 * @author Sebas Constante
 */

/** El mismo vínculo visto desde la otra persona (los demás son simétricos). */
const INVERSO: Readonly<Partial<Record<ParentescoApi, ParentescoApi>>> = {
  PADRE: 'HIJO',
  HIJO: 'PADRE',
  SUEGRO: 'YERNO',
  YERNO: 'SUEGRO',
  ABUELO: 'NIETO',
  NIETO: 'ABUELO',
  BISABUELO: 'BISNIETO',
  BISNIETO: 'BISABUELO',
  TIO: 'SOBRINO',
  SOBRINO: 'TIO'
};

/** Texto de cada parentesco (sin distinguir sexo, que el backend no da). */
const TEXTO_PARENTESCO: Readonly<Record<ParentescoApi, string>> = {
  CONYUGE: 'Cónyuge',
  PADRE: 'Padre/Madre',
  HIJO: 'Hijo/a',
  SUEGRO: 'Suegro/a',
  YERNO: 'Yerno/Nuera',
  ABUELO: 'Abuelo/a',
  HERMANO: 'Hermano/a',
  NIETO: 'Nieto/a',
  CUNADO: 'Cuñado/a',
  BISABUELO: 'Bisabuelo/a',
  TIO: 'Tío/a',
  SOBRINO: 'Sobrino/a',
  BISNIETO: 'Bisnieto/a',
  PRIMO: 'Primo/a',
  OTRO: 'Otro parentesco'
};

/** Origen de cada coincidencia, para el motivo. */
const TEXTO_FUENTE: Readonly<Record<FuenteCoincidenciaApi, string>> = {
  NOMINA: 'Consta en la nómina.',
  DECLARACION: 'Consta en una declaración del personal.'
};

/**
 * El backend espera los apellidos primero, como en la nómina.
 *
 * @param datos Datos del formulario (la cédula puede ir vacía en la
 * pantalla, pero el backend la exige).
 * @returns Cuerpo de `POST /consultas-previas` (siempre un aspirante).
 * @author Sebas Constante
 */
export function crearPedidoConsulta(datos: DatosCandidato): CrearConsultaRequestApi {
  return {
    tipo: 'ASPIRANTE',
    cedula: datos.cedula.trim(),
    nombres: (datos.apellidos.trim() + ' ' + datos.nombres.trim()).trim().replace(/\s+/g, ' ')
  };
}

/**
 * `PARENTESCO` es lo que el empleado es para el candidato; la pantalla
 * muestra lo que el candidato sería del empleado, así que se invierte.
 *
 * @param api Coincidencia del backend.
 * @returns Coincidencia del modelo.
 * @author Sebas Constante
 */
export function mapearCoincidencia(api: CoincidenciaApi): CoincidenciaCandidato {
  const delEmpleado = api.PARENTESCO;
  const delCandidato = delEmpleado === null ? null : INVERSO[delEmpleado] ?? delEmpleado;
  const grado = api.GRADO !== null && api.GRADO >= 1 && api.GRADO <= 4 && api.PARENTESCO !== 'CONYUGE'
    ? api.GRADO as GradoParentesco
    : null;
  const relacion: Relacion = api.TIPO_GRADO === 'C' ? 'Consanguinidad' : 'Afinidad';
  const riesgo: Riesgo = api.RIESGO ?? 'BAJO';
  const origen = api.FUENTE === null ? '' : TEXTO_FUENTE[api.FUENTE];

  return {
    empleado: {
      id: api.DMPER_CODIGO ?? '',
      nombres: api.NOMBRE ?? '',
      cedula: api.CEDULA ?? '',
      cargo: api.CARGO ?? '',
      departamento: api.DEPARTAMENTO ?? ''
    },
    parentesco: delCandidato === null ? '' : TEXTO_PARENTESCO[delCandidato],
    relacion,
    grado,
    riesgo,
    motivo: [api.DETALLE, origen].filter((t): t is string => !!t).join(' ')
  };
}

/**
 * La consulta no se guarda en el backend, así que no tiene id propio: se
 * arma uno con la cédula y la fecha.
 *
 * @param api Respuesta de `POST /consultas-previas`.
 * @param datos Datos que se enviaron (se devuelven en `datos`).
 * @param ahora Fecha de respaldo si la respuesta no trae `FECHA`.
 * @returns Consulta del modelo, con sus coincidencias.
 * @author Sebas Constante
 */
export function mapearConsulta(api: ConsultaPreviaApi, datos: DatosCandidato, ahora: Date): ConsultaPrevia {
  const fecha = api.FECHA ?? ahora.toISOString();

  return {
    id: 'CP-' + (api.CEDULA ?? datos.cedula) + '-' + fecha,
    fecha,
    datos,
    coincidencias: (api.COINCIDENCIAS ?? []).map(mapearCoincidencia)
  };
}
