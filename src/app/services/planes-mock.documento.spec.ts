import { TestBed, fakeAsync, tick } from '@angular/core/testing';
import { RolGestion } from '../models/rol-gestion';
import { PerfilUsuarioFalso, proveerPerfilFalso } from '../testing/perfil-usuario-falso';
import { MENSAJE_SIN_PERMISO } from './http/peticiones';
import { LATENCIA_SIMULADA_MS } from './mock-data/simular-respuesta';
import { PlanesMockService } from './planes-mock.service';

describe('PlanesMockService · documento firmado del plan (solo RRHH)', () => {
  /**
   * @param roles Roles de gestion del usuario.
   * @returns Lo que devuelve obtenerDocumentoPlan('PL-002') y el motivo.
   */
  function pedirComo(roles: RolGestion[]): { contenido: Blob | null | undefined; error: string | null } {
    TestBed.configureTestingModule({
      providers: [proveerPerfilFalso(new PerfilUsuarioFalso(roles, 'EMP-010', 'Fernando José Andrade Vela'))]
    });
    const servicio = TestBed.inject(PlanesMockService);
    let contenido: Blob | null | undefined;

    servicio.obtenerDocumentoPlan('PL-002').subscribe((r) => contenido = r);
    tick(LATENCIA_SIMULADA_MS);
    return { contenido, error: servicio.ultimoError };
  }

  it('solo P: null con «No tienes permiso…», como el 403 del backend', fakeAsync(() => {
    expect(pedirComo(['responsable'])).toEqual({ contenido: null, error: MENSAJE_SIN_PERMISO });
  }));

  it('R+P: devuelve el documento', fakeAsync(() => {
    const { contenido, error } = pedirComo(['rrhh', 'responsable']);

    expect(contenido).toBeInstanceOf(Blob);
    expect(error).toBeNull();
  }));
});
