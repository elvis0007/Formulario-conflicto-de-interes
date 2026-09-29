export interface IUsuario {
  CUENTA?: string;
  CODIGO?: string;
  CEDULA?: string;
  CARGO?: string;
  NOMBRES?: string;
  DEPARTAMENTO?: string;
  UBICACION_INTERNA?: string;
  DSGUS_CUENTA?: string;
  DMPER_NUMERO_ROL?: string;
  APELLIDOS?: string;
  CODIGO_DEPARTAMENTO?: string;
  DMPER_CODIGO?: string;
  DMPER_FOTOGRAFIA?: string;
  CORREO?: string;
  // Lista de abreviaturas de roles que viene desde backend (A, R, I, E, etc.)
  roles?: string[];
  ROLES?: string[];
}
