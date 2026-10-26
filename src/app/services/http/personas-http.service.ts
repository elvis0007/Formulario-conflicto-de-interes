import { Injectable, inject } from '@angular/core';
import { Observable, map, of } from 'rxjs';
import { Persona } from '../../models';
import { BackendService } from '../backend.service';
import { PersonasMockService } from '../personas-mock.service';

/**
 * Empleados contra el backend. No hay un listado completo del personal: los
 * responsables se eligen buscando (`/sisgerh/personal/buscar`).
 *
 * @author Integración backend
 */
@Injectable({ providedIn: 'root' })
export class PersonasHttpService
  implements Pick<PersonasMockService, keyof PersonasMockService> {

  private readonly backend = inject(BackendService);

  /**
   * @returns Siempre vacía: el personal se busca, no se lista entero.
   */
  obtenerPersonas(): Observable<Persona[]> {
    return of([]);
  }

  /**
   * Busca personal activo por nombre o cédula.
   *
   * @param termino Texto buscado (mínimo 3 caracteres).
   * @returns Coincidencias con id = código de nómina (DMPER).
   */
  buscarPersonas(termino: string): Observable<Persona[]> {
    return this.backend.buscarPersonal(termino).pipe(
      map((lista) => lista
        .filter((p) => !!p.CODIGO)
        .map((p): Persona => ({
          id: p.CODIGO as string,
          nombres: p.NOMBRE_COMPLETO ?? '',
          cedula: p.CEDULA ?? '',
          cargo: '',
          departamento: ''
        })))
    );
  }

  /**
   * @param id Código de nómina.
   * @returns Siempre `undefined`: no hay consulta por código.
   */
  obtenerPersonaPorId(id: string): Observable<Persona | undefined> {
    void id;
    return of(undefined);
  }
}
