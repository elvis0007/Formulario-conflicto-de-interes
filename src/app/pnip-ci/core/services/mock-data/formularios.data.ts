import { FormularioCI, Persona } from '../../models';
import { buscarPersona } from './personas.data';

/**
 * Formularios de conflicto de interes de ejemplo: cinco de empleados
 * (`Interno`) y uno de un proveedor (`Externo`), con familiares que
 * trabajan y que no trabajan en la empresa.
 *
 * @author EEASA
 */
export const FORMULARIOS: readonly FormularioCI[] = [
    {
        id: 'F-001',
        nombre: 'Carlos Andrés Mayorga Sánchez',
        cedula: '1800000011',
        origen: 'Interno',
        tipo: 'Inicial',
        tipoContrato: 'Nombramiento definitivo',
        fecha: '2025-10-06',
        cargo: 'Jefe de Adquisiciones',
        departamento: 'Adquisiciones',
        estadoCivil: 'Casado',
        correo: 'carlos.mayorga@ejemplo.com',
        familiares: [
            {
                parentesco: 'Hermano',
                nombre: 'Jorge Luis Mayorga Sánchez',
                cedula: '1800000029',
                trabajaEnEmpresa: true
            },
            {
                parentesco: 'Cónyuge',
                nombre: 'Verónica Isabel Lara Cruz',
                cedula: '1800000300',
                trabajaEnEmpresa: false
            }
        ]
    },
    {
        id: 'F-002',
        nombre: 'Andrés Sebastián Tamayo Ruiz',
        cedula: '1800000052',
        origen: 'Interno',
        tipo: 'Inicial',
        tipoContrato: 'Código de Trabajo',
        fecha: '2026-07-21',
        cargo: 'Liniero',
        departamento: 'Distribución',
        estadoCivil: 'Soltero',
        correo: 'andres.tamayo@ejemplo.com',
        familiares: [
            {
                parentesco: 'Tío',
                nombre: 'Marco Vinicio Tamayo Guevara',
                cedula: '1800000045',
                trabajaEnEmpresa: true
            },
            {
                parentesco: 'Padre',
                nombre: 'Fausto Tamayo Guevara',
                cedula: '1800000318',
                trabajaEnEmpresa: false
            }
        ]
    },
    {
        id: 'F-003',
        nombre: 'Lucía Alejandra Freire Ortiz',
        cedula: '1800000086',
        origen: 'Interno',
        tipo: 'Actualización',
        tipoContrato: 'Nombramiento definitivo',
        fecha: '2025-12-02',
        cargo: 'Analista de Talento Humano',
        departamento: 'Talento Humano',
        estadoCivil: 'Casada',
        correo: 'lucia.freire@ejemplo.com',
        familiares: [
            {
                parentesco: 'Suegro',
                nombre: 'Marco Vinicio Tamayo Guevara',
                cedula: '1800000045',
                trabajaEnEmpresa: true
            },
            {
                parentesco: 'Prima',
                nombre: 'Paola Cristina Freire Naranjo',
                cedula: '1800000094',
                trabajaEnEmpresa: true
            },
            {
                parentesco: 'Cónyuge',
                nombre: 'Diego Tamayo Castillo',
                cedula: '1800000326',
                trabajaEnEmpresa: false
            }
        ]
    },
    {
        id: 'F-004',
        nombre: 'Esteban Javier Castro Mena',
        cedula: '1800000078',
        origen: 'Interno',
        tipo: 'Inicial',
        tipoContrato: 'Nombramiento provisional',
        fecha: '2026-09-08',
        cargo: 'Contador General',
        departamento: 'Financiero',
        estadoCivil: 'Casado',
        correo: 'esteban.castro@ejemplo.com',
        familiares: [
            {
                parentesco: 'Cónyuge',
                nombre: 'Gabriela Alejandra Barona Núñez',
                cedula: '1800000110',
                trabajaEnEmpresa: true
            },
            {
                parentesco: 'Suegro',
                nombre: 'Patricio Eduardo Barona Silva',
                cedula: '1800000060',
                trabajaEnEmpresa: true
            }
        ]
    },
    {
        id: 'F-005',
        nombre: 'Fernando José Andrade Vela',
        cedula: '1800000102',
        origen: 'Interno',
        tipo: 'Actualización',
        tipoContrato: 'Contrato de servicios ocasionales',
        fecha: '2026-09-19',
        cargo: 'Ingeniero de Sistemas',
        departamento: 'Tecnologías de la Información',
        estadoCivil: 'Casado',
        correo: 'fernando.andrade@ejemplo.com',
        familiares: [
            {
                parentesco: 'Cuñada',
                nombre: 'Diana Carolina Pérez López',
                cedula: '1800000037',
                trabajaEnEmpresa: true
            },
            {
                parentesco: 'Cónyuge',
                nombre: 'María José Pérez López',
                cedula: '1800000334',
                trabajaEnEmpresa: false
            }
        ]
    },
    {
        id: 'F-006',
        nombre: 'Verónica Alexandra Salazar Pinto',
        cedula: '1800000342',
        origen: 'Externo',
        tipo: 'Inicial',
        tipoContrato: 'Proveedor de servicios',
        fecha: '2026-08-05',
        cargo: 'Representante legal',
        departamento: 'Proveedor externo',
        estadoCivil: 'Soltera',
        correo: 'veronica.salazar@ejemplo.com',
        familiares: [
            {
                parentesco: 'Prima',
                nombre: 'Paola Cristina Freire Naranjo',
                cedula: '1800000094',
                trabajaEnEmpresa: true
            },
            {
                parentesco: 'Hermano',
                nombre: 'Cristian Salazar Pinto',
                cedula: '1800000359',
                trabajaEnEmpresa: false
            }
        ]
    }
];

/**
 * Empleados de ejemplo que todavia no han llenado el formulario (segunda
 * pestana de la pantalla de formularios).
 *
 * @author EEASA
 */
export const EMPLEADOS_SIN_FORMULARIO: readonly Persona[] = [
    buscarPersona('EMP-002'),
    buscarPersona('EMP-004'),
    buscarPersona('EMP-006'),
    buscarPersona('EMP-012')
];
