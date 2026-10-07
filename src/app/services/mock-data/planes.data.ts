import { Archivo, PlanAccion } from '../../models';

/**
 * Crea la referencia a un PDF de ejemplo (la URL no existe todavia).
 *
 * @param nombre Nombre del archivo.
 * @param fechaSubida Fecha en que se subio (ISO 8601); los documentos
 * firmados la tienen, las evidencias la llevan en `Evidencia`.
 * @returns Archivo PDF simulado.
 */
function pdfSimulado(nombre: string, fechaSubida?: string): Archivo {
  return fechaSubida
    ? { nombre, url: '/mock/archivos/' + nombre, tipo: 'pdf', fechaSubida }
    : { nombre, url: '/mock/archivos/' + nombre, tipo: 'pdf' };
}

/**
 * Planes de accion de ejemplo. Cubren los cuatro `EstadoPlan`, actividades
 * en todos los `EstadoActividad`, evidencias aprobadas, rechazadas, en
 * revision y ausentes, y planes con y sin documento firmado.
 *
 * | Plan   | Conflicto | Estado          | Documento firmado |
 * |--------|-----------|-----------------|-------------------|
 * | PL-001 | C-001     | cerrado         | si                |
 * | PL-002 | C-001     | activo_vencidas | si                |
 * | PL-003 | C-002     | activo          | si                |
 * | PL-004 | C-003     | borrador        | no                |
 * | PL-005 | C-004     | cerrado         | si                |
 * | PL-006 | C-008     | cerrado         | si                |
 * | PL-007 | C-008     | borrador        | si                |
 *
 * Las fechas limite estan calculadas con `calcularFechaLimite` sobre
 * `fechaInicio`; los planes en borrador no tienen ni una ni otra.
 *
 * Revision de Evidencias (Dia 9): hay evidencias en revision en dos planes
 * activos, en PDF (A-005) y en imagen (A-008, A-016); un rechazo con
 * motivo (A-015); y a PL-003 le falta una sola aprobacion (A-008) para
 * cerrarse.
 *
 * Responsable (Dia 10): el empleado por defecto de la sesion simulada
 * (EMP-010, Fernando José Andrade Vela) tiene actividades en todos los
 * estados y en varios planes: pendiente (A-017) y vencida (A-018) en
 * PL-002, rechazada con motivo (A-015) y aprobada (A-004) en PL-002, en
 * revision (A-008) y aprobada (A-007) en PL-003, aprobada (A-013) en PL-006
 * (cerrado) y una en el borrador PL-007 (A-014), que no debe ver.
 *
 * @author Elvis Flores
 */
export const PLANES: readonly PlanAccion[] = [
  {
    id: 'PL-001',
    numero: 1,
    nombre: 'Separación de funciones en compras',
    conflictoId: 'C-001',
    estado: 'cerrado',
    fechaInicio: '2025-11-03',
    fechaCierre: '2026-03-20',
    documentoFirmado: pdfSimulado('PL-001-plan-firmado.pdf', '2025-10-30'),
    actividades: [
      {
        id: 'A-001',
        descripcion: 'Reasignar la aprobación de órdenes de compra '
          + 'del técnico a otro jefe de área.',
        responsableId: 'EMP-006',
        responsableNombre: 'Patricio Eduardo Barona Silva',
        plazoMeses: 1,
        plazoDias: 0,
        fechaLimite: '2025-12-03',
        estado: 'aprobada',
        evidencia: {
          archivo: pdfSimulado('A-001-memorando.pdf'),
          fechaSubida: '2025-11-28T10:42:00',
          estado: 'aprobada',
          revisadoPor: 'Lucía Alejandra Freire Ortiz',
          fechaRevision: '2025-11-29T09:00:00'
        }
      },
      {
        id: 'A-002',
        descripcion: 'Firmar la declaración de abstención en los '
          + 'procesos de contratación del técnico.',
        responsableId: 'EMP-001',
        responsableNombre: 'Carlos Andrés Mayorga Sánchez',
        plazoMeses: 0,
        plazoDias: 15,
        fechaLimite: '2025-11-18',
        estado: 'aprobada',
        evidencia: {
          archivo: {
            nombre: 'A-002-declaracion.jpg',
            url: '/mock/archivos/A-002-declaracion.jpg',
            tipo: 'jpg'
          },
          fechaSubida: '2025-11-14T16:05:00',
          estado: 'aprobada',
          revisadoPor: 'Lucía Alejandra Freire Ortiz',
          fechaRevision: '2025-11-15T10:00:00'
        }
      }
    ]
  },
  {
    id: 'PL-002',
    numero: 2,
    nombre: 'Rotación del técnico de compras',
    conflictoId: 'C-001',
    estado: 'activo_vencidas',
    fechaInicio: '2026-06-01',
    documentoFirmado: pdfSimulado('PL-002-plan-firmado.pdf', '2026-05-28'),
    actividades: [
      {
        id: 'A-003',
        descripcion: 'Rotar al técnico a la unidad de bodega.',
        responsableId: 'EMP-001',
        responsableNombre: 'Carlos Andrés Mayorga Sánchez',
        plazoMeses: 2,
        plazoDias: 0,
        fechaLimite: '2026-08-01',
        estado: 'vencida'
      },
      {
        id: 'A-004',
        descripcion: 'Restringir los permisos del técnico en el '
          + 'sistema de compras públicas.',
        responsableId: 'EMP-010',
        responsableNombre: 'Fernando José Andrade Vela',
        plazoMeses: 1,
        plazoDias: 0,
        fechaLimite: '2026-07-01',
        estado: 'aprobada',
        evidencia: {
          archivo: {
            nombre: 'A-004-captura-permisos.png',
            url: '/mock/archivos/A-004-captura-permisos.png',
            tipo: 'png'
          },
          fechaSubida: '2026-06-24T11:30:00',
          estado: 'aprobada',
          revisadoPor: 'Lucía Alejandra Freire Ortiz',
          fechaRevision: '2026-06-25T09:30:00'
        }
      },
      {
        id: 'A-005',
        descripcion: 'Presentar el informe trimestral de procesos '
          + 'adjudicados en el área.',
        responsableId: 'EMP-001',
        responsableNombre: 'Carlos Andrés Mayorga Sánchez',
        plazoMeses: 4,
        plazoDias: 0,
        fechaLimite: '2026-10-01',
        estado: 'en_revision',
        evidencia: {
          archivo: pdfSimulado('A-005-informe-trimestral.pdf'),
          fechaSubida: '2026-09-25T09:14:00',
          estado: 'pendiente'
        }
      },
      {
        id: 'A-015',
        descripcion: 'Activar el registro de auditoría de accesos al '
          + 'sistema de compras públicas.',
        responsableId: 'EMP-010',
        responsableNombre: 'Fernando José Andrade Vela',
        plazoMeses: 2,
        plazoDias: 15,
        fechaLimite: '2026-08-16',
        estado: 'rechazada',
        evidencia: {
          archivo: {
            nombre: 'A-015-registro-auditoria.png',
            url: '/mock/archivos/A-015-registro-auditoria.png',
            tipo: 'png'
          },
          fechaSubida: '2026-08-12T17:20:00',
          estado: 'rechazada',
          motivoRechazo: 'La captura no muestra la fecha en que se activó '
            + 'el registro.',
          revisadoPor: 'Lucía Alejandra Freire Ortiz',
          fechaRevision: '2026-08-14T09:05:00'
        }
      },
      {
        id: 'A-016',
        descripcion: 'Entregar el acta de entrega-recepción de la bodega '
          + 'firmada.',
        responsableId: 'EMP-002',
        responsableNombre: 'Jorge Luis Mayorga Sánchez',
        plazoMeses: 3,
        plazoDias: 15,
        fechaLimite: '2026-09-16',
        estado: 'en_revision',
        evidencia: {
          archivo: {
            nombre: 'A-016-acta-bodega.jpg',
            url: '/mock/archivos/A-016-acta-bodega.jpg',
            tipo: 'jpg'
          },
          fechaSubida: '2026-09-15T12:30:00',
          estado: 'pendiente'
        }
      },
      {
        id: 'A-017',
        descripcion: 'Capacitar al personal de bodega en el nuevo '
          + 'procedimiento de despacho.',
        responsableId: 'EMP-010',
        responsableNombre: 'Fernando José Andrade Vela',
        plazoMeses: 4,
        plazoDias: 25,
        fechaLimite: '2026-10-26',
        estado: 'pendiente'
      },
      {
        id: 'A-018',
        descripcion: 'Entregar el inventario de accesos del técnico a '
          + 'los sistemas de compras.',
        responsableId: 'EMP-010',
        responsableNombre: 'Fernando José Andrade Vela',
        plazoMeses: 3,
        plazoDias: 0,
        fechaLimite: '2026-09-01',
        estado: 'vencida'
      }
    ]
  },
  {
    id: 'PL-003',
    numero: 1,
    nombre: 'Independencia de la cuadrilla',
    conflictoId: 'C-002',
    estado: 'activo',
    fechaInicio: '2026-08-17',
    documentoFirmado: pdfSimulado('PL-003-plan-firmado.pdf', '2026-08-14'),
    actividades: [
      {
        id: 'A-006',
        descripcion: 'Cambiar al liniero a una cuadrilla que no '
          + 'dependa del superintendente.',
        responsableId: 'EMP-004',
        responsableNombre: 'Marco Vinicio Tamayo Guevara',
        plazoMeses: 0,
        plazoDias: 20,
        fechaLimite: '2026-09-06',
        estado: 'aprobada',
        evidencia: {
          archivo: pdfSimulado('A-006-orden-de-cambio.pdf'),
          fechaSubida: '2026-09-02T09:14:00',
          estado: 'aprobada',
          revisadoPor: 'Lucía Alejandra Freire Ortiz',
          fechaRevision: '2026-09-03T08:45:00'
        }
      },
      {
        id: 'A-007',
        descripcion: 'Actualizar la matriz de firmas de órdenes de '
          + 'trabajo.',
        responsableId: 'EMP-010',
        responsableNombre: 'Fernando José Andrade Vela',
        plazoMeses: 1,
        plazoDias: 15,
        fechaLimite: '2026-10-02',
        // Se rechazo el 19/09 (falta de firma, ver N-002) y el responsable
        // volvio a subirla corregida.
        estado: 'aprobada',
        evidencia: {
          archivo: pdfSimulado('A-007-matriz-firmas-v2.pdf'),
          fechaSubida: '2026-09-24T15:48:00',
          estado: 'aprobada',
          revisadoPor: 'Lucía Alejandra Freire Ortiz',
          fechaRevision: '2026-09-26T10:15:00'
        }
      },
      {
        id: 'A-008',
        descripcion: 'Retirar al superintendente de la aprobación de '
          + 'horas extra del liniero en el sistema.',
        responsableId: 'EMP-010',
        responsableNombre: 'Fernando José Andrade Vela',
        plazoMeses: 2,
        plazoDias: 0,
        fechaLimite: '2026-10-17',
        // La ultima que falta aprobar: al aprobarla, PL-003 se cierra.
        estado: 'en_revision',
        evidencia: {
          archivo: {
            nombre: 'A-008-captura-sistema.png',
            url: '/mock/archivos/A-008-captura-sistema.png',
            tipo: 'png'
          },
          fechaSubida: '2026-10-05T16:40:00',
          estado: 'pendiente'
        }
      }
    ]
  },
  {
    id: 'PL-004',
    numero: 1,
    nombre: 'Control cruzado de pagos',
    conflictoId: 'C-003',
    estado: 'borrador',
    actividades: [
      {
        id: 'A-009',
        descripcion: 'Trasladar la aprobación de pagos del contador '
          + 'a la subdirección financiera.',
        responsableId: 'EMP-006',
        responsableNombre: 'Patricio Eduardo Barona Silva',
        plazoMeses: 1,
        plazoDias: 0,
        estado: 'pendiente'
      },
      {
        id: 'A-010',
        descripcion: 'Auditar los pagos aprobados en el último '
          + 'semestre.',
        responsableId: 'EMP-003',
        responsableNombre: 'Diana Carolina Pérez López',
        plazoMeses: 3,
        plazoDias: 0,
        estado: 'pendiente'
      }
    ]
  },
  {
    id: 'PL-005',
    numero: 1,
    nombre: 'Exclusión de procesos de selección',
    conflictoId: 'C-004',
    estado: 'cerrado',
    fechaInicio: '2025-05-12',
    fechaCierre: '2025-07-30',
    documentoFirmado: pdfSimulado('PL-005-plan-firmado.pdf', '2025-05-08'),
    actividades: [
      {
        id: 'A-011',
        descripcion: 'Firmar la declaración de no intervención en '
          + 'procesos de selección de Comercialización.',
        responsableId: 'EMP-008',
        responsableNombre: 'Lucía Alejandra Freire Ortiz',
        plazoMeses: 0,
        plazoDias: 10,
        fechaLimite: '2025-05-22',
        estado: 'aprobada',
        evidencia: {
          archivo: pdfSimulado('A-011-declaracion.pdf'),
          fechaSubida: '2025-05-20T08:55:00',
          estado: 'aprobada',
          revisadoPor: 'Diana Carolina Pérez López',
          fechaRevision: '2025-05-21T09:10:00'
        }
      }
    ]
  },
  {
    id: 'PL-006',
    numero: 1,
    nombre: 'Restricción de expedientes de Distribución',
    conflictoId: 'C-008',
    estado: 'cerrado',
    fechaInicio: '2026-01-12',
    fechaCierre: '2026-04-15',
    documentoFirmado: pdfSimulado('PL-006-plan-firmado.pdf', '2026-01-09'),
    actividades: [
      {
        id: 'A-012',
        descripcion: 'Firmar el compromiso de excusa en trámites de '
          + 'personal de Distribución.',
        responsableId: 'EMP-008',
        responsableNombre: 'Lucía Alejandra Freire Ortiz',
        plazoMeses: 0,
        plazoDias: 15,
        fechaLimite: '2026-01-27',
        estado: 'aprobada',
        evidencia: {
          archivo: pdfSimulado('A-012-compromiso.pdf'),
          fechaSubida: '2026-01-22T14:20:00',
          estado: 'aprobada',
          revisadoPor: 'Diana Carolina Pérez López',
          fechaRevision: '2026-01-23T08:30:00'
        }
      },
      {
        id: 'A-013',
        descripcion: 'Bloquear el acceso de la analista a los '
          + 'expedientes de Distribución en el sistema.',
        responsableId: 'EMP-010',
        responsableNombre: 'Fernando José Andrade Vela',
        plazoMeses: 1,
        plazoDias: 0,
        fechaLimite: '2026-02-12',
        estado: 'aprobada',
        evidencia: {
          archivo: {
            nombre: 'A-013-captura-accesos.png',
            url: '/mock/archivos/A-013-captura-accesos.png',
            tipo: 'png'
          },
          fechaSubida: '2026-02-09T10:03:00',
          estado: 'aprobada',
          revisadoPor: 'Diana Carolina Pérez López',
          fechaRevision: '2026-02-10T09:00:00'
        }
      }
    ]
  },
  {
    id: 'PL-007',
    numero: 2,
    nombre: 'Seguimiento anual',
    conflictoId: 'C-008',
    estado: 'borrador',
    documentoFirmado: pdfSimulado('PL-007-plan-firmado.pdf', '2026-09-25'),
    actividades: [
      {
        id: 'A-014',
        descripcion: 'Revisar anualmente que la restricción de '
          + 'accesos siga vigente.',
        responsableId: 'EMP-010',
        responsableNombre: 'Fernando José Andrade Vela',
        plazoMeses: 12,
        plazoDias: 0,
        estado: 'pendiente'
      }
    ]
  }
];
