import { Persona } from '../../models';

/**
 * Empleados de ejemplo. Nombres, cedulas y datos son ficticios.
 *
 * Parentescos que se usan en `conflictos.data.ts`:
 * - EMP-001 y EMP-002: hermanos (mismos padres).
 * - EMP-004 es tio de EMP-005.
 * - EMP-006 es padre de EMP-011 y suegro de EMP-007 (esposo de EMP-011).
 * - EMP-008 y EMP-009: primas.
 * - EMP-003 y EMP-010: cunados (EMP-010 esta casado con la hermana de
 *   EMP-003).
 * - EMP-004 es suegro de EMP-008 (casada con su hijo).
 * - EMP-012 comparte apellidos con EMP-002 pero no es pariente (homonimo).
 *
 * @author Elvis Flores
 */
export const PERSONAS: readonly Persona[] = [
    {
        id: 'EMP-001',
        nombres: 'Carlos Andrés Mayorga Sánchez',
        cedula: '1800000011',
        cargo: 'Jefe de Adquisiciones',
        departamento: 'Adquisiciones',
        jefeInmediato: 'Patricio Eduardo Barona Silva',
        fechaIngreso: '2012-03-01',
        padre: 'Luis Alberto Mayorga Paredes',
        madre: 'Rosa Elena Sánchez Vaca'
    },
    {
        id: 'EMP-002',
        nombres: 'Jorge Luis Mayorga Sánchez',
        cedula: '1800000029',
        cargo: 'Técnico de Compras Públicas',
        departamento: 'Adquisiciones',
        jefeInmediato: 'Carlos Andrés Mayorga Sánchez',
        fechaIngreso: '2019-07-15',
        padre: 'Luis Alberto Mayorga Paredes',
        madre: 'Rosa Elena Sánchez Vaca'
    },
    {
        id: 'EMP-003',
        nombres: 'Diana Carolina Pérez López',
        cedula: '1800000037',
        cargo: 'Analista de Presupuesto',
        departamento: 'Financiero',
        jefeInmediato: 'Patricio Eduardo Barona Silva',
        fechaIngreso: '2016-02-01',
        padre: 'Hernán Pérez Villalba',
        madre: 'Martha López Cevallos'
    },
    {
        id: 'EMP-004',
        nombres: 'Marco Vinicio Tamayo Guevara',
        cedula: '1800000045',
        cargo: 'Superintendente de Distribución',
        departamento: 'Distribución',
        fechaIngreso: '2005-09-12',
        padre: 'Segundo Tamayo Ortiz',
        madre: 'Blanca Guevara Lara',
        conyuge: 'Inés Castillo Moya'
    },
    {
        id: 'EMP-005',
        nombres: 'Andrés Sebastián Tamayo Ruiz',
        cedula: '1800000052',
        cargo: 'Liniero',
        departamento: 'Distribución',
        jefeInmediato: 'Marco Vinicio Tamayo Guevara',
        fechaIngreso: '2021-01-04',
        padre: 'Fausto Tamayo Guevara',
        madre: 'Silvia Ruiz Naranjo'
    },
    {
        id: 'EMP-006',
        nombres: 'Patricio Eduardo Barona Silva',
        cedula: '1800000060',
        cargo: 'Director Financiero',
        departamento: 'Financiero',
        fechaIngreso: '2008-05-19',
        conyuge: 'Teresa Núñez Paredes'
    },
    {
        id: 'EMP-007',
        nombres: 'Esteban Javier Castro Mena',
        cedula: '1800000078',
        cargo: 'Contador General',
        departamento: 'Financiero',
        jefeInmediato: 'Patricio Eduardo Barona Silva',
        fechaIngreso: '2017-10-02',
        conyuge: 'Gabriela Alejandra Barona Núñez'
    },
    {
        id: 'EMP-008',
        nombres: 'Lucía Alejandra Freire Ortiz',
        cedula: '1800000086',
        cargo: 'Analista de Talento Humano',
        departamento: 'Talento Humano',
        fechaIngreso: '2018-04-16',
        padre: 'Ramiro Freire Acosta',
        madre: 'Gloria Ortiz Pazmiño',
        conyuge: 'Diego Tamayo Castillo'
    },
    {
        id: 'EMP-009',
        nombres: 'Paola Cristina Freire Naranjo',
        cedula: '1800000094',
        cargo: 'Asistente de Comercialización',
        departamento: 'Comercialización',
        fechaIngreso: '2022-08-01',
        padre: 'Wilson Freire Acosta',
        madre: 'Mónica Naranjo Díaz'
    },
    {
        id: 'EMP-010',
        nombres: 'Fernando José Andrade Vela',
        cedula: '1800000102',
        cargo: 'Ingeniero de Sistemas',
        departamento: 'Tecnologías de la Información',
        fechaIngreso: '2015-11-23',
        conyuge: 'María José Pérez López'
    },
    {
        id: 'EMP-011',
        nombres: 'Gabriela Alejandra Barona Núñez',
        cedula: '1800000110',
        cargo: 'Ejecutiva de Atención al Cliente',
        departamento: 'Comercialización',
        fechaIngreso: '2020-06-08',
        padre: 'Patricio Eduardo Barona Silva',
        madre: 'Teresa Núñez Paredes',
        conyuge: 'Esteban Javier Castro Mena'
    },
    {
        id: 'EMP-012',
        nombres: 'Ana Lucía Mayorga Sánchez',
        cedula: '1800000128',
        cargo: 'Operadora de Centro de Llamadas',
        departamento: 'Comercialización',
        fechaIngreso: '2023-02-13',
        padre: 'Julio César Mayorga Toapanta',
        madre: 'Norma Sánchez Freire'
    }
];

/**
 * Empleado que se simula por defecto en desarrollo
 * (`RolPnipCiService.obtenerEmpleadoActualId`). EMP-010 es responsable de
 * actividades en varios planes y en varios estados.
 */
export const EMPLEADO_SIMULADO_POR_DEFECTO = 'EMP-010';

/**
 * Busca una persona de ejemplo por id.
 *
 * @param id Id de la persona.
 * @returns La persona.
 * @throws Error si el id no existe (error de programacion en los datos).
 */
export function buscarPersona(id: string): Persona {
    const persona = PERSONAS.find((p) => p.id === id);

    if (persona === undefined) {
        throw new Error('[personas.data] No existe la persona ' + id);
    }

    return persona;
}
