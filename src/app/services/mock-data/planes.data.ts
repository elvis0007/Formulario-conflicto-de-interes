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
 * Planes de accion de ejemplo. Cubren los tres `EstadoPlan`, actividades
 * en todos los `EstadoActividad` (la «vencida» sale de la fecha limite), evidencias aprobadas, rechazadas, en
 * revision y ausentes, y planes con y sin documento firmado.
 *
 * | Plan   | Conflicto | Estado   | Documento firmado |
 * |--------|-----------|----------|-------------------|
 * | PL-001 | C-001     | CERRADO  | si                |
 * | PL-002 | C-001     | FIRMADO  | si (con vencidas) |
 * | PL-003 | C-002     | FIRMADO  | si                |
 * | PL-004 | C-003     | BORRADOR | no                |
 * | PL-005 | C-004     | CERRADO  | si                |
 * | PL-006 | C-008     | CERRADO  | si                |
 * | PL-007 | C-008     | BORRADOR | si                |
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
    fechaCreacion: '2025-10-20T10:30:00',
    creadoPor: 'Lucía Alejandra Freire Ortiz',
    estado: 'CERRADO',
    tipoCierre: 'CUMPLIDO',
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
        estado: 'ACEPTADA',
        evidencia: {
          id: 'EV-001',
          archivo: pdfSimulado('A-001-memorando.pdf'),
          fechaSubida: '2025-11-28T10:42:00',
          estado: 'APROBADA',
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
        estado: 'ACEPTADA',
        evidencia: {
          id: 'EV-002',
          archivo: {
            nombre: 'A-002-declaracion.jpg',
            url: '/mock/archivos/A-002-declaracion.jpg',
            tipo: 'jpg'
          },
          fechaSubida: '2025-11-14T16:05:00',
          estado: 'APROBADA',
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
    fechaCreacion: '2026-05-20T09:00:00',
    creadoPor: 'Lucía Alejandra Freire Ortiz',
    estado: 'FIRMADO',
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
        estado: 'PENDIENTE'
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
        estado: 'ACEPTADA',
        evidencia: {
          id: 'EV-003',
          archivo: {
            nombre: 'A-004-captura-permisos.png',
            url: '/mock/archivos/A-004-captura-permisos.png',
            tipo: 'png'
          },
          fechaSubida: '2026-06-24T11:30:00',
          estado: 'APROBADA',
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
        estado: 'EN_REVISION',
        evidencia: {
          id: 'EV-004',
          archivo: pdfSimulado('A-005-informe-trimestral.pdf'),
          fechaSubida: '2026-09-25T09:14:00',
          estado: 'PENDIENTE'
        }
      },
      {
        id: 'A-015',
        descripcion: 'Activar el registro de auditoría de accesos al '
          + 'sistema de compras públicas.',
        responsableId: 'EMP-010',
        responsableNombre: 'Fernando José Andrade Vela',
        plazoMeses: 5,
        plazoDias: 0,
        fechaLimite: '2026-11-01',
        estado: 'RECHAZADA',
        evidencia: {
          id: 'EV-005',
          archivo: {
            nombre: 'A-015-registro-auditoria.png',
            url: '/mock/archivos/A-015-registro-auditoria.png',
            tipo: 'png'
          },
          fechaSubida: '2026-08-12T17:20:00',
          estado: 'RECHAZADA',
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
        estado: 'EN_REVISION',
        evidencia: {
          id: 'EV-006',
          archivo: {
            nombre: 'A-016-acta-bodega.jpg',
            url: '/mock/archivos/A-016-acta-bodega.jpg',
            tipo: 'jpg'
          },
          fechaSubida: '2026-09-15T12:30:00',
          estado: 'PENDIENTE'
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
        estado: 'PENDIENTE'
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
        estado: 'PENDIENTE'
      }
    ]
  },
  {
    id: 'PL-003',
    numero: 1,
    nombre: 'Independencia de la cuadrilla',
    conflictoId: 'C-002',
    fechaCreacion: '2026-08-10T11:15:00',
    creadoPor: 'Lucía Alejandra Freire Ortiz',
    estado: 'FIRMADO',
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
        estado: 'ACEPTADA',
        evidencia: {
          id: 'EV-007',
          archivo: pdfSimulado('A-006-orden-de-cambio.pdf'),
          fechaSubida: '2026-09-02T09:14:00',
          estado: 'APROBADA',
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
        // Se rechazo el 19/09 (falta de firma) y el responsable volvio a
        // subirla corregida: la primera queda en evidenciasAnteriores.
        estado: 'ACEPTADA',
        evidenciasAnteriores: [{
          id: 'EV-008',
          archivo: pdfSimulado('A-007-matriz-firmas.pdf'),
          fechaSubida: '2026-09-18T16:05:00',
          estado: 'RECHAZADA',
          motivoRechazo: 'La matriz no tiene la firma del jefe de área.',
          revisadoPor: 'Lucía Alejandra Freire Ortiz',
          fechaRevision: '2026-09-19T08:40:00'
        }],
        evidencia: {
          id: 'EV-009',
          archivo: pdfSimulado('A-007-matriz-firmas-v2.pdf'),
          fechaSubida: '2026-09-24T15:48:00',
          estado: 'APROBADA',
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
        estado: 'EN_REVISION',
        evidencia: {
          id: 'EV-010',
          archivo: {
            nombre: 'A-008-captura-sistema.png',
            url: '/mock/archivos/A-008-captura-sistema.png',
            tipo: 'png'
          },
          fechaSubida: '2026-10-05T16:40:00',
          estado: 'PENDIENTE'
        }
      }
    ]
  },
  {
    id: 'PL-004',
    numero: 1,
    nombre: 'Control cruzado de pagos',
    conflictoId: 'C-003',
    fechaCreacion: '2026-09-28T15:20:00',
    creadoPor: 'Lucía Alejandra Freire Ortiz',
    estado: 'BORRADOR',
    actividades: [
      {
        id: 'A-009',
        descripcion: 'Trasladar la aprobación de pagos del contador '
          + 'a la subdirección financiera.',
        responsableId: 'EMP-006',
        responsableNombre: 'Patricio Eduardo Barona Silva',
        plazoMeses: 1,
        plazoDias: 0,
        estado: 'PENDIENTE'
      },
      {
        id: 'A-010',
        descripcion: 'Auditar los pagos aprobados en el último '
          + 'semestre.',
        responsableId: 'EMP-003',
        responsableNombre: 'Diana Carolina Pérez López',
        plazoMeses: 3,
        plazoDias: 0,
        estado: 'PENDIENTE'
      }
    ]
  },
  {
    id: 'PL-005',
    numero: 1,
    nombre: 'Exclusión de procesos de selección',
    conflictoId: 'C-004',
    fechaCreacion: '2025-05-02T08:45:00',
    creadoPor: 'Lucía Alejandra Freire Ortiz',
    estado: 'CERRADO',
    tipoCierre: 'CUMPLIDO',
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
        estado: 'ACEPTADA',
        evidencia: {
          id: 'EV-011',
          archivo: pdfSimulado('A-011-declaracion.pdf'),
          fechaSubida: '2025-05-20T08:55:00',
          estado: 'APROBADA',
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
    fechaCreacion: '2026-01-05T14:00:00',
    creadoPor: 'Lucía Alejandra Freire Ortiz',
    estado: 'CERRADO',
    tipoCierre: 'CUMPLIDO',
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
        estado: 'ACEPTADA',
        evidencia: {
          id: 'EV-012',
          archivo: pdfSimulado('A-012-compromiso.pdf'),
          fechaSubida: '2026-01-22T14:20:00',
          estado: 'APROBADA',
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
        estado: 'ACEPTADA',
        evidencia: {
          id: 'EV-013',
          archivo: {
            nombre: 'A-013-captura-accesos.png',
            url: '/mock/archivos/A-013-captura-accesos.png',
            tipo: 'png'
          },
          fechaSubida: '2026-02-09T10:03:00',
          estado: 'APROBADA',
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
    fechaCreacion: '2026-09-22T10:00:00',
    creadoPor: 'Lucía Alejandra Freire Ortiz',
    estado: 'BORRADOR',
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
        estado: 'PENDIENTE'
      }
    ]
  }
];
