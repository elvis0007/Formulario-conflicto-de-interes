import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { Persona } from '../models';
import { manejarError } from '../utils/manejar-error';
import { PERSONAS } from './mock-data/personas.data';
import { simularRespuesta } from './mock-data/simular-respuesta';

/**
 * Consulta de empleados con datos simulados. Se sustituira por un servicio
 * HTTP con los mismos metodos, sin cambiar los componentes.
 *
 * @author Elvis Flores
 */
@Injectable({
  providedIn: 'root'
})
export class PersonasMockService {

  /**
   * Obtiene todos los empleados.
   *
   * @returns Lista de personas; vacia si la consulta falla.
   */
  obtenerPersonas(): Observable<Persona[]> {
    return simularRespuesta([...PERSONAS]).pipe(
      manejarError<Persona[]>('PersonasMockService.obtenerPersonas', [])
    );
  }

  /**
   * Busca empleados por nombre o cedula, para elegir responsables.
   *
   * @param termino Texto buscado; con menos de 3 caracteres no busca.
   * @returns Coincidencias; vacia si la consulta falla.
   * @author Integración backend
   */
  buscarPersonas(termino: string): Observable<Persona[]> {
    const texto = termino.trim().toLowerCase();
    const encontradas = texto.length < 3 ? [] : PERSONAS.filter((p) =>
      p.nombres.toLowerCase().includes(texto) || p.cedula.includes(texto));

    return simularRespuesta(encontradas).pipe(
      manejarError<Persona[]>('PersonasMockService.buscarPersonas', [])
    );
  }

  /**
   * Obtiene un empleado por id.
   *
   * @param id Id de la persona.
   * @returns La persona, o `undefined` si no existe o la consulta falla.
   */
  obtenerPersonaPorId(id: string): Observable<Persona | undefined> {
    const persona = PERSONAS.find((p) => p.id === id);

    return simularRespuesta(persona).pipe(
      manejarError<Persona | undefined>(
        'PersonasMockService.obtenerPersonaPorId',
        undefined
      )
    );
  }
}
