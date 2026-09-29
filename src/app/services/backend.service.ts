import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { map, Observable, catchError, of } from 'rxjs';
import { AuthService } from './auth.service';
import { environment } from '../../environments/environment';

interface ApiResponse<T> {
  estado: string;
  mensaje?: string;
  datos: T;
}

export interface PlantillaLecturaItem {
  /** Codigo de la declaracion, para cruzarla con su fila en la tabla de admin. */
  codigo: number | null;
  personalInfo: {
    fullName: string | null;
    ci: string | null;
    unit: string | null;
    position: string | null;
    /** Inicial, Actualizacion o Final, tal como quedo en el formulario. */
    status: string | null;
    fechaGeneracion: string | null;
    /** Modalidad de contratación. El código y el régimen faltan en las
     *  declaraciones anteriores al selector, que solo guardaron el texto. */
    employmentType: string | null;
    employmentTypeCode: string | null;
    laborRegime: string | null;
  } | null;
  familyMembers: Array<{
    name: string | null;
    ci: string | null;
    relationship: string | null;
    position: string | null;
    department: string | null;
    section: string | null;
    area: string | null;
  }> | null;
  suppliers: Array<{
    name: string | null;
    ci: string | null;
    company: string | null;
    relationship: string | null;
    detail: string | null;
  }> | null;
  /**
   * Las respuestas de si/no llegan como texto "true"/"false", no como booleano:
   * es lo que devuelve JSON_VALUE en las vistas de Oracle.
   */
  hasFinancialInterest: string | null;
  hasFamilyInstitution: string | null;
  hasSupplierRelations: string | null;
  hasOtherSituations: string | null;
  financialInterestDetail: string | null;
  otherSituationsDetail: string | null;
  commitToReview: string | null;
  commitToInform: string | null;
}


export interface PersonalBusquedaDto {
  CODIGO: string | null;
  /**
   * Llega para todos los usuarios; el backend dejó de ocultarla a los externos.
   * Viaja en null solo cuando la persona no la tiene registrada en nómina.
   */
  CEDULA: string | null;
  NOMBRE_COMPLETO: string | null;
}

export interface PersonalUbicacionDto {
  DEPARTAMENTO: string | null;
  /** Nodo "SECCION ..." de la ruta organizacional; null si no aplica. */
  SECCION: string | null;
  /** Nodo "AREA ..." de la ruta organizacional; null si no aplica. */
  AREA: string | null;
  CARGO: string | null;
  /**
   * Modalidad de contratación según nómina. Llega en null cuando la persona no
   * tiene grupo de escala registrado, y entonces hay que preguntársela.
   */
  MODALIDAD_CODIGO: string | null;
  MODALIDAD: string | null;
  /** DRLAB1 Código del Trabajo, DRLAB2 LOEP. */
  REGIMEN_CODIGO: string | null;
  REGIMEN: string | null;
  /** Subrogando o encargada de otro puesto ahora. No es una modalidad. */
  ENCARGADO: boolean | null;
  /**
   * Fecha real de ingreso de DRI_MA_PERSONAL, en formato yyyy-MM-dd. Solo se
   * usa para precargar la del propio usuario interno; en un familiar el
   * formulario no tiene un campo de fecha de ingreso y este valor se ignora.
   */
  FECHA_INGRESO: string | null;
}

/** Una modalidad de contratación del catálogo de nómina. */
export interface ModalidadContratoDto {
  CODIGO: string | null;
  DESCRIPCION: string | null;
  REGIMEN_CODIGO: string | null;
  REGIMEN: string | null;
}

export interface IdentidadDto {
  CEDULA: string | null;
  NOMBRE_COMPLETO: string | null;
  APELLIDO_PATER: string | null;
  APELLIDO_MATER: string | null;
  NOMBRE_PRIMERO: string | null;
  NOMBRE_SEGUNDO: string | null;
  /**
   * Las cuatro partes se obtienen repartiendo el nombre completo, porque el
   * registro civil lo entrega como un unico texto. Puede fallar con apellidos
   * compuestos, asi que conviene que la persona revise lo que se precargo.
   */
  NOMBRE_DEDUCIDO: boolean;
}

export interface RolDto {
  CODIGO: number;
  ABREVIATURA: string;
  NOMBRE: string;
  ESTADO: string;
}

export interface RolUsuarioDto {
  CODIGO: number;
  ROL_CODIGO: number;
  PERSONAL_CODIGO: string;
  ESTADO: string;
}

export interface CrearRolUsuarioPayload {
  ROL_CODIGO: number;
  PERSONAL_CODIGO: string;
}

export interface PlantillaTemporalDto {
  CODIGO?: number;
  PLANTILLA_FK?: number;
  DMPER?: string | null;
  ESTADOPLANTILLA_FK?: number | null;
  CEDULA?: string;
  NOMBRE?: string;
  CARGO?: string;
  DEPARTAMENTO?: string;
  FECHA_GENERACION?: string | null;
  INGRESO_PERSONA?: string | null;
  FECHA_SALIDA?: string | null;
  JSON?: string | null;
  CLAVE_TEMPORAL?: string | null;
  ESTADO_PLANTILLA?: string | null;
  /** "ACTIVO" para la version vigente, "INACTIVO" para las historicas. */
  ESTADO?: string | null;
  LECTURA?: string | null;
  /** Porcentaje de avance (0-100) calculado por el backend a partir del JSON. */
  PORCENTAJE?: number | null;
  employmentType?: string | null;
  /** Código de la modalidad; falta en las declaraciones anteriores. */
  employmentTypeCode?: string | null;
}

export interface PlantillaTemporalPayload {
  CEDULA: string;
  NOMBRE: string;
  /**
   * Partes del nombre capturadas por separado. Solo las manda el formulario de
   * usuarios externos; para el personal interno el backend las toma de nomina.
   */
  APELLIDO_PATER?: string | null;
  APELLIDO_MATER?: string | null;
  NOMBRE_PRIMERO?: string | null;
  NOMBRE_SEGUNDO?: string | null;
  CARGO: string;
  DEPARTAMENTO: string;
  FECHA_GENERACION: string | null;
  JSON: string;
  ESTADO_PLANTILLA: string;
  DMPER?: string | null;
  LECTURA?: string | null;
}

export interface SinArchivoConflictoItem {
  DMPER?: string | null;
  CODIGO?: string | null;
  NOMBRES?: string | null;
  EMAIL?: string | null;
  CEDULA?: string | null;
  [key: string]: any;
}

@Injectable({
  providedIn: 'root'
})
export class BackendService {
  private readonly baseUrl = environment.urlSeguridad.replace('/auth/', '');

  constructor(
    private http: HttpClient,
    private authService: AuthService
  ) {}

  
  private mapStatusToCode(status: string): string {
    const statusMap: { [key: string]: string } = {
      'Inicial': 'I',
      'Actualización': 'A',
      'Final': 'F',
      'I': 'I',
      'A': 'A',
      'F': 'F',
      'P': 'P',
      'C': 'C'
    };
    return statusMap[status] || 'I';
  }

 
  private truncateString(value: string, maxLength: number): string {
    if (!value) return '';
    return value.length > maxLength ? value.substring(0, maxLength) : value;
  }

  /**
   * Longitud real de DCIPU_NOMBRE, DCIPU_CARGO y DCIPU_DEPARTAMENTO en
   * DRI_CI_PLANTILLA_TEMPORAL. Antes se recortaba a 30, que es el ancho de
   * DRI_CI_PLANTILLA_USUARIO (tabla que no está implementada), y eso cortaba
   * nombres reales de más de 30 caracteres.
   */
  private static readonly MAX_LONGITUD_CAMPO = 100;

  saveConflictForm(formValue: any): Observable<any> {
    if (!this.authService.isAuthenticated()) {
      throw new Error('Usuario no autenticado. Por favor inicie sesión.');
    }

    const statusCode = this.mapStatusToCode(formValue.status || 'I');
    const nowIso = new Date().toISOString();

    const currentUser = this.authService.getCurrentUser();
    // DMPER_CODIGO viene en el campo CODIGO del usuario del token
    const dmperCodigo = currentUser?.DMPER_CODIGO || currentUser?.CODIGO || null;

    const hasFamilyRelations =
      !!formValue.personalInterests?.hasFamilyInstitution &&
      Array.isArray(formValue.personalInterests?.familyMembers) &&
      formValue.personalInterests.familyMembers.length > 0;

    const hasSupplierRelations =
      !!formValue.suppliers?.hasSupplierRelations &&
      Array.isArray(formValue.suppliers?.suppliersList) &&
      formValue.suppliers.suppliersList.length > 0;

    const lecturaFlag = hasFamilyRelations || hasSupplierRelations ? '1' : '0';

    const payload: PlantillaTemporalPayload = {
      CEDULA: this.truncateString(formValue.personalInfo?.ci ?? '', 10),
      NOMBRE: this.truncateString(formValue.personalInfo?.fullName ?? '', BackendService.MAX_LONGITUD_CAMPO),
      // Van vacias para el personal interno; el backend resuelve entonces desde
      // nomina en lugar de deducirlas.
      APELLIDO_PATER: formValue.personalInfo?.apellidoPaterno || null,
      APELLIDO_MATER: formValue.personalInfo?.apellidoMaterno || null,
      NOMBRE_PRIMERO: formValue.personalInfo?.nombrePrimero || null,
      NOMBRE_SEGUNDO: formValue.personalInfo?.nombreSegundo || null,
      CARGO: this.truncateString(formValue.personalInfo?.position ?? '', BackendService.MAX_LONGITUD_CAMPO),
      DEPARTAMENTO: this.truncateString(formValue.personalInfo?.unit ?? '', BackendService.MAX_LONGITUD_CAMPO),
      FECHA_GENERACION: nowIso,
      JSON: JSON.stringify(formValue),
      ESTADO_PLANTILLA: statusCode,
      DMPER: dmperCodigo,
      LECTURA: lecturaFlag
    };

    console.log('[BackendService] Payload:', payload);

    return this.http.post(`${this.baseUrl}/plantilla-temporal`, payload);
  }

  /**
   * Actualiza una plantilla temporal existente.
   * - Para usuarios externos (registro creado solo con cédula + clave temporal),
   *   se actualiza el mismo registro para no perder la clave temporal.
   * - Para usuarios internos, el backend decide si crea un nuevo registro y
   *   deja los anteriores en estado 0.
   */
  updateConflictForm(id: number, formValue: any): Observable<any> {
    if (!this.authService.isAuthenticated()) {
      throw new Error('Usuario no autenticado. Por favor inicie sesión.');
    }

    const statusCode = this.mapStatusToCode(formValue.status || 'I');
    const nowIso = new Date().toISOString();

    const currentUser = this.authService.getCurrentUser();
    // DMPER_CODIGO viene en el campo CODIGO del usuario del token 
    const dmperCodigo = currentUser?.DMPER_CODIGO || currentUser?.CODIGO || null;

    const hasFamilyRelations =
      !!formValue.personalInterests?.hasFamilyInstitution &&
      Array.isArray(formValue.personalInterests?.familyMembers) &&
      formValue.personalInterests.familyMembers.length > 0;

    const hasSupplierRelations =
      !!formValue.suppliers?.hasSupplierRelations &&
      Array.isArray(formValue.suppliers?.suppliersList) &&
      formValue.suppliers.suppliersList.length > 0;

    const lecturaFlag = hasFamilyRelations || hasSupplierRelations ? '1' : '0';

    const payload: any = {
      CEDULA: this.truncateString(formValue.personalInfo?.ci ?? '', 10),
      NOMBRE: this.truncateString(formValue.personalInfo?.fullName ?? '', BackendService.MAX_LONGITUD_CAMPO),
      // Van vacias para el personal interno; el backend resuelve entonces desde
      // nomina en lugar de deducirlas.
      APELLIDO_PATER: formValue.personalInfo?.apellidoPaterno || null,
      APELLIDO_MATER: formValue.personalInfo?.apellidoMaterno || null,
      NOMBRE_PRIMERO: formValue.personalInfo?.nombrePrimero || null,
      NOMBRE_SEGUNDO: formValue.personalInfo?.nombreSegundo || null,
      CARGO: this.truncateString(formValue.personalInfo?.position ?? '', BackendService.MAX_LONGITUD_CAMPO),
      DEPARTAMENTO: this.truncateString(formValue.personalInfo?.unit ?? '', BackendService.MAX_LONGITUD_CAMPO),
      FECHA_GENERACION: nowIso,
      JSON: JSON.stringify(formValue),
      ESTADO_PLANTILLA: statusCode,
      DMPER: dmperCodigo,
      LECTURA: lecturaFlag
      // No enviamos CLAVE_TEMPORAL para que el backend conserve la existente
    };

    console.log('[BackendService] Payload UPDATE:', payload, 'ID:', id);

    return this.http.patch(`${this.baseUrl}/plantilla-temporal/${id}`, payload);
  }

  
  getAllForms(): Observable<PlantillaTemporalDto[]> {
    return this.http
      .get<ApiResponse<PlantillaTemporalDto[]>>(
        `${this.baseUrl}/plantilla-temporal/todas`
      )
      .pipe(
        map((resp) => {
          if (resp.estado !== 'OK' || !resp.datos) {
            return [];
          }
          return resp.datos;
        })
      );
  }

  /**
   * Historial de declaraciones del usuario autenticado.
   *
   * No recibe cedula: el backend la deduce del token, de modo que nadie pueda
   * pedir el historial de otra persona. Devuelve tanto la version vigente como
   * las anteriores, de la mas reciente a la mas antigua.
   */
  getMisFormularios(): Observable<PlantillaTemporalDto[]> {
    return this.http
      .get<ApiResponse<PlantillaTemporalDto[]>>(`${this.baseUrl}/plantilla-temporal/mis-formularios`)
      .pipe(
        map((resp) => (resp?.estado === 'OK' && resp.datos ? resp.datos : [])),
        catchError((err) => {
          if (err.status === 404) {
            return of([]);
          }
          throw err;
        })
      );
  }

  getFormHistory(id: number): Observable<PlantillaTemporalDto[]> {
    return this.http
      .get<ApiResponse<PlantillaTemporalDto[]>>(
        `${this.baseUrl}/plantilla-temporal/${id}/history`
      )
      .pipe(
        map((resp) => {
          if (resp.estado !== 'OK' || !resp.datos) {
            return [];
          }
          return resp.datos;
        })
      );
  }

  /**
   * Obtiene las plantillas marcadas para lectura (LECTURA = '1') ya procesadas por el backend
   * con la estructura necesaria para los reportes.
   */
  getPlantillasParaLectura(): Observable<PlantillaLecturaItem[]> {
    return this.http
      .get<ApiResponse<PlantillaLecturaItem[]>>(
        `${this.baseUrl}/plantilla-temporal/lectura`
      )
      .pipe(
        map((resp) => {
          if (resp.estado !== 'OK' || !resp.datos) {
            return [];
          }
          return resp.datos;
        }),
        catchError((err) => {
          if (err.status === 404) {
            console.log(
              '[BackendService] No se encontraron plantillas para lectura'
            );
            return of([]);
          }
          console.error(
            '[BackendService] Error al obtener plantillas para lectura:',
            err
          );
          throw err;
        })
      );
  }

  /**
   * Catálogo de modalidades de contratación de nómina.
   *
   * Se pide una sola vez y solo cuando hay que mostrar el selector, que es
   * cuando la persona tiene que elegir su modalidad.
   */
  getModalidades(): Observable<ModalidadContratoDto[]> {
    return this.http
      .get<ApiResponse<ModalidadContratoDto[]>>(`${this.baseUrl}/sisgerh/modalidades`)
      .pipe(
        map((resp) => (resp.estado === 'OK' && resp.datos ? resp.datos : [])),
        catchError(() => of([]))
      );
  }

  getSinArchivoConflicto(
    pagina: number = 0,
    tamanoPagina: number = 500
  ): Observable<SinArchivoConflictoItem[]> {
    return this.http
      .get<ApiResponse<any>>(
        `${this.baseUrl}/sisgerh/personal-sin-formulario?pagina=${pagina}&tamanoPagina=${tamanoPagina}`
      )
      .pipe(
        map((resp) => {
          if (!resp || resp.estado !== 'OK' || !resp.datos) {
            return [];
          }
          const data = resp.datos || {};
          return (data.DATOS || data.datos || []) as SinArchivoConflictoItem[];
        }),
        catchError((err) => {
          if (err.status === 404) {
            return of([]);
          }
          throw err;
        })
      );
  }

  enviarCorreoSinArchivoIndividual(dmperCodigo: string): Observable<boolean> {
    return this.http
      .post(
        `${this.baseUrl}/email/notificar-sin-formulario/${encodeURIComponent(dmperCodigo)}`,
        {}
      )
      .pipe(
        map(() => true),
        catchError(() => of(false))
      );
  }

  enviarCorreoSinArchivoTodos(): Observable<boolean> {
    return this.http
      .post(
        `${this.baseUrl}/email/notificar-sin-formulario`,
        {}
      )
      .pipe(
        map(() => true),
        catchError(() => of(false))
      );
  }

  
  getFormsByCedula(cedula: string): Observable<PlantillaTemporalDto[]> {
    return this.http
      .get<ApiResponse<PlantillaTemporalDto[]>>(
        `${this.baseUrl}/plantilla-temporal/cedula/${cedula}`
      )
      .pipe(
        map((resp) => {
          if (resp.estado !== 'OK' || !resp.datos) {
            return [];
          }
          return resp.datos;
        }),
        catchError((err) => {
          if (err.status === 404) {
            console.log(
              '[BackendService] No se encontraron formularios previos para la cédula:',
              cedula
            );
            return of([]);
          }
          console.error(
            '[BackendService] Error al obtener formularios por cédula:',
            cedula,
            err
          );
          throw err;
        })
      );
  }


  /** Minimo exigido por el backend; por debajo no vale la pena llamar. */
  private static readonly MIN_CARACTERES_BUSQUEDA = 3;

  /**
   * Busca personal activo por nombre o cedula para el autocompletado de
   * familiares. Devuelve lista vacia ante cualquier error: el buscador es una
   * ayuda y nunca debe impedir que se llene el formulario a mano.
   */
  buscarPersonal(termino: string): Observable<PersonalBusquedaDto[]> {
    const limpio = (termino || '').trim();
    if (limpio.length < BackendService.MIN_CARACTERES_BUSQUEDA) {
      return of([]);
    }

    return this.http
      .get<ApiResponse<PersonalBusquedaDto[]>>(
        `${this.baseUrl}/sisgerh/personal/buscar?termino=${encodeURIComponent(limpio)}`
      )
      .pipe(
        map((resp) => (resp?.estado === 'OK' && resp.datos ? resp.datos : [])),
        catchError(() => of([]))
      );
  }

  /**
   * Obtiene departamento y cargo de una persona de nomina.
   *
   * Devuelve null si no se puede resolver: el procedimiento de la base usa
   * INNER JOIN sobre zona y estructura organizacional, asi que no ubica a todo
   * el personal que aparece en el buscador. En ese caso el campo simplemente
   * se deja para que lo escriban a mano.
   */
  obtenerUbicacionPersonal(codigo: string): Observable<PersonalUbicacionDto | null> {
    if (!codigo) {
      return of(null);
    }

    return this.http
      .get<ApiResponse<PersonalUbicacionDto>>(
        `${this.baseUrl}/sisgerh/personal/${encodeURIComponent(codigo)}/ubicacion`
      )
      .pipe(
        map((resp) => (resp?.estado === 'OK' && resp.datos ? resp.datos : null)),
        catchError(() => of(null))
      );
  }

  /**
   * Consulta los datos de una persona por su cedula en el registro civil.
   *
   * Devuelve null si no se encuentra o si el servicio no responde: es una ayuda
   * para precargar el formulario, nunca un requisito para llenarlo.
   */
  consultarIdentidad(cedula: string): Observable<IdentidadDto | null> {
    const limpia = (cedula || '').trim();
    if (!limpia) {
      return of(null);
    }

    return this.http
      .get<ApiResponse<IdentidadDto>>(`${this.baseUrl}/identidad/${encodeURIComponent(limpia)}`)
      .pipe(
        map((resp) => (resp?.estado === 'OK' && resp.datos ? resp.datos : null)),
        catchError(() => of(null))
      );
  }

  getRoles(): Observable<RolDto[]> {
    return this.http
      .get<ApiResponse<RolDto[]>>(`${this.baseUrl}/roles`)
      .pipe(
        map((resp) => {
          if (resp.estado !== 'OK' || !resp.datos) {
            console.warn('[BackendService] Respuesta de roles no exitosa:', resp);
            return [];
          }
          return resp.datos;
        }),
        catchError((err) => {
          console.error('[BackendService] Error al obtener roles:', err);
          console.error('[BackendService] Status:', err?.status);
          console.error('[BackendService] Error completo:', err);
          throw err;
        })
      );
  }

  getRolUsuariosByRol(rolCodigo: number): Observable<RolUsuarioDto[]> {
    return this.http
      .get<ApiResponse<RolUsuarioDto[]>>(`${this.baseUrl}/rol-usuario/rol/${rolCodigo}`)
      .pipe(
        map((resp) => {
          if (resp.estado !== 'OK') {
            console.warn('[BackendService] Respuesta de rol-usuarios no exitosa:', resp);
            return [];
          }
          // Si datos es null o undefined, devolver array vacío en lugar de error
          return resp.datos || [];
        }),
        catchError((err) => {
          console.error('[BackendService] Error al obtener usuarios por rol:', err);
          console.error('[BackendService] Status:', err?.status);
          console.error('[BackendService] Error completo:', err);
          // En caso de error, devolver array vacío en lugar de lanzar excepción
          return of([]);
        })
      );
  }

  assignRolToUsuario(payload: CrearRolUsuarioPayload): Observable<RolUsuarioDto> {
    return this.http
      .post<ApiResponse<RolUsuarioDto>>(`${this.baseUrl}/rol-usuario`, payload)
      .pipe(
        map((resp) => {
          if (resp.estado !== 'OK' || !resp.datos) {
            throw new Error(resp.mensaje || 'No se pudo asignar el rol al usuario');
          }
          return resp.datos;
        })
      );
  }

  deleteRolUsuario(id: number): Observable<void> {
    return this.http
      .delete<ApiResponse<void>>(`${this.baseUrl}/rol-usuario/${id}`)
      .pipe(
        map((resp) => {
          if (resp.estado !== 'OK') {
            throw new Error(resp.mensaje || 'No se pudo eliminar la asignación de rol');
          }
          return;
        })
      );
  }

  getPersonal(pagina: number = 0, tamanoPagina: number = 20): Observable<PaginatedPersonalResponse> {
    return this.http
      .get<ApiResponse<any>>(
        `${this.baseUrl}/sisgerh/personal?pagina=${pagina}&tamanoPagina=${tamanoPagina}`
      )
      .pipe(
        map((resp) => {
          // El backend devuelve un ApiResponse con la paginación dentro de "datos"
          if (!resp || resp.estado !== 'OK' || !resp.datos) {
            console.warn('[BackendService] Respuesta de personal no exitosa o sin datos:', resp);
            return {
              datos: [],
              paginaActual: 0,
              tamanoPagina,
              totalElementos: 0,
              totalPaginas: 0,
              esPrimera: true,
              esUltima: true
            } as PaginatedPersonalResponse;
          }

          const data = resp.datos || {};
          const fuenteDatos = data.DATOS && Array.isArray(data.DATOS) ? data.DATOS : [];

          const personal: PersonalDto[] = [];
          fuenteDatos.forEach((item: any) => {
              personal.push({
                CODIGO: item.CODIGO || item.codigo,
              NOMBRE_COMPLETO:
                item.NOMBRE_COMPLETO ||
                item.nombreCompleto ||
                                ((item.APELLIDOS || '') + ' ' + (item.NOMBRES || '')).trim(),
                CARGO: item.CARGO || item.cargo,
                DEPARTAMENTO: item.DEPARTAMENTO || item.departamento
              });
            });
          
          return {
            datos: personal,
            paginaActual: data.PAGINA_ACTUAL || data.paginaActual || 0,
            tamanoPagina: data.TAMAÑO_PAGINA || data.TAMANO_PAGINA || data.tamanoPagina || tamanoPagina,
            totalElementos: data.TOTAL_ELEMENTOS || data.totalElementos || personal.length,
            totalPaginas: data.TOTAL_PAGINAS || data.totalPaginas || 1,
            esPrimera: data.ES_PRIMERA ?? data.esPrimera ?? true,
            esUltima: data.ES_ULTIMA ?? data.esUltima ?? true
          } as PaginatedPersonalResponse;
        }),
        catchError((err) => {
          console.error('[BackendService] Error al obtener personal:', err);
          console.error('[BackendService] Status:', err.status);
          console.error('[BackendService] StatusText:', err.statusText);
          console.error('[BackendService] Error completo:', JSON.stringify(err, null, 2));
          throw err;
        })
      );
  }

  getDepartamentos(): Observable<DepartamentoDto[]> {
    return this.http
      .get<any>(`${this.baseUrl}/sisgerh/selectDepartamentos`)
      .pipe(
        map((resp) => {
          if (resp && resp.DATOS && Array.isArray(resp.DATOS)) {
            return resp.DATOS.map((item: any) => ({
              CODIGO: item.CODIGO || item.codigo,
              NOMBRE: item.NOMBRE || item.nombre || item.DEPARTAMENTO || item.departamento
            }));
          }
          return [];
        }),
        catchError((err) => {
          console.error('[BackendService] Error al obtener departamentos:', err);
          throw err;
        })
      );
  }
}

export interface PersonalDto {
  CODIGO: string;
  NOMBRE_COMPLETO: string;
  CARGO: string;
  DEPARTAMENTO: string;
}

export interface PaginatedPersonalResponse {
  datos: PersonalDto[];
  paginaActual: number;
  tamanoPagina: number;
  totalElementos: number;
  totalPaginas: number;
  esPrimera: boolean;
  esUltima: boolean;
}

export interface DepartamentoDto {
  CODIGO: string;
  NOMBRE: string;
}
