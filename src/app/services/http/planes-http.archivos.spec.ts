import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { PerfilUsuarioFalso, proveerPerfilFalso } from '../../testing/perfil-usuario-falso';
import { ERROR_SIN_CONEXION, MENSAJE_SIN_PERMISO, urlApi } from './peticiones';
import { MENSAJE_DOCUMENTO_SOLO_RRHH, PlanesHttpService } from './planes-http.service';

describe('PlanesHttpService · descarga de archivos con error', () => {
  let servicio: PlanesHttpService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        proveerPerfilFalso(new PerfilUsuarioFalso(['responsable'], 'EMP-010', 'Fernando José Andrade Vela'))
      ]
    });
    servicio = TestBed.inject(PlanesHttpService);
    http = TestBed.inject(HttpTestingController);
    spyOn(console, 'error');
  });

  afterEach(() => http.verify());

  it('documento del plan con 403 (solo P): null y «solo lo puede ver RRHH»', () => {
    let resultado: Blob | null | undefined;

    servicio.obtenerDocumentoPlan('41').subscribe((r) => resultado = r);
    http.expectOne(urlApi('/planes/41/documento'))
      .flush(new Blob(['{}']), { status: 403, statusText: 'Forbidden' });

    expect(resultado).toBeNull();
    expect(servicio.ultimoError).toBe(MENSAJE_DOCUMENTO_SOLO_RRHH);
  });

  it('documento del plan que llega bien: limpia el motivo anterior', () => {
    servicio.ultimoError = 'viejo';
    servicio.obtenerDocumentoPlan('41').subscribe();
    http.expectOne(urlApi('/planes/41/documento')).flush(new Blob(['%PDF']));

    expect(servicio.ultimoError).toBeNull();
  });

  it('archivo de evidencia con 403 o sin conexión: null con el motivo general', () => {
    servicio.obtenerArchivoEvidencia('9').subscribe();
    http.expectOne(urlApi('/evidencias/9/archivo')).flush(new Blob(['{}']), { status: 403, statusText: 'Forbidden' });
    expect(servicio.ultimoError).toBe(MENSAJE_SIN_PERMISO);

    servicio.obtenerArchivoEvidencia('9').subscribe();
    http.expectOne(urlApi('/evidencias/9/archivo')).error(new ProgressEvent('error'));
    expect(servicio.ultimoError).toBe(ERROR_SIN_CONEXION);
  });
});
