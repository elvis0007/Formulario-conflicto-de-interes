import { TestBed, fakeAsync, tick } from '@angular/core/testing';
import { Observable } from 'rxjs';
import { Notificacion } from '../models';
import { PerfilUsuarioFalso, proveerPerfilFalso } from '../testing/perfil-usuario-falso';
import { RELOJ } from '../utils/reloj';
import { NOTIFICACIONES } from './mock-data/notificaciones.data';
import { LATENCIA_SIMULADA_MS } from './mock-data/simular-respuesta';
import { NotificacionesMockService } from './notificaciones-mock.service';

describe('NotificacionesMockService', () => {
  const AHORA = new Date(2026, 9, 2, 10, 0);
  const DE_RRHH = NOTIFICACIONES.filter((n) => !n.destinatarioId);
  const DE_EMP_010 = NOTIFICACIONES.filter((n) => n.destinatarioId === 'EMP-010');
  let servicio: NotificacionesMockService;
  let perfil: PerfilUsuarioFalso;

  /**
   * @param fuente Observable del servicio.
   * @returns Lo emitido tras la latencia simulada.
   */
  function esperar<T>(fuente: Observable<T>): T | undefined {
    let valor: T | undefined;

    fuente.subscribe((v) => valor = v);
    tick(LATENCIA_SIMULADA_MS);
    return valor;
  }

  /** @returns Ids que ve el usuario actual. */
  function idsVisibles(): string[] {
    return (esperar(servicio.obtenerNotificaciones()) ?? []).map((n) => n.id);
  }

  beforeEach(() => {
    perfil = new PerfilUsuarioFalso(['rrhh'], 'EMP-008');
    TestBed.configureTestingModule({
      providers: [
        { provide: RELOJ, useValue: () => new Date(AHORA) },
        proveerPerfilFalso(perfil)
      ]
    });
    servicio = TestBed.inject(NotificacionesMockService);
  });

  it('los datos de ejemplo tienen notificaciones de RRHH y de un responsable', () => {
    expect(DE_RRHH.length).toBeGreaterThan(0);
    expect(DE_EMP_010.length).toBeGreaterThan(0);
  });

  describe('filtro por usuario', () => {
    it('RRHH ve solo las que no tienen destinatario', fakeAsync(() => {
      expect(idsVisibles()).toEqual(jasmine.arrayWithExactContents(DE_RRHH.map((n) => n.id)));
    }));

    it('un Responsable ve solo las dirigidas a él', fakeAsync(() => {
      perfil.roles = ['responsable'];
      perfil.empleadoId = 'EMP-010';

      expect(idsVisibles()).toEqual(jasmine.arrayWithExactContents(DE_EMP_010.map((n) => n.id)));
    }));

    it('RRHH que también es Responsable ve las de RRHH y las suyas', fakeAsync(() => {
      perfil.roles = ['rrhh', 'responsable'];
      perfil.empleadoId = 'EMP-010';

      expect(idsVisibles()).toEqual(jasmine.arrayWithExactContents([...DE_RRHH, ...DE_EMP_010].map((n) => n.id)));
    }));

    it('el contador de no leídas y «marcar todas» solo afectan a las visibles', fakeAsync(() => {
      const noLeidasRrhh = DE_RRHH.filter((n) => !n.leida).length;

      expect(esperar(servicio.contarNoLeidas())).toBe(noLeidasRrhh);
      esperar(servicio.marcarTodasComoLeidas());
      expect(esperar(servicio.contarNoLeidas())).toBe(0);

      perfil.roles = ['responsable'];
      perfil.empleadoId = 'EMP-010';
      expect(esperar(servicio.contarNoLeidas())).toBe(DE_EMP_010.filter((n) => !n.leida).length);
    }));
  });

  it('agregar crea notificaciones sin leer, con fecha y destinatario, y avisa del cambio', fakeAsync(() => {
    let avisos = 0;
    let lista: Notificacion[] = [];

    perfil.roles = ['responsable'];
    perfil.empleadoId = 'EMP-001';
    servicio.cambios.subscribe(() => avisos++);
    servicio.agregarNotificaciones([
      { titulo: 'Nuevo plan', texto: 'Texto', tipo: 'info', destinatarioId: 'EMP-001' }
    ]).subscribe();
    tick(LATENCIA_SIMULADA_MS);
    servicio.obtenerNotificaciones().subscribe((l) => lista = l);
    tick(LATENCIA_SIMULADA_MS);

    expect(avisos).toBe(1);
    expect(lista.length).toBe(1);
    expect(lista[0]).toEqual(jasmine.objectContaining({
      titulo: 'Nuevo plan',
      texto: 'Texto',
      tipo: 'info',
      destinatarioId: 'EMP-001',
      leida: false,
      fecha: AHORA.toISOString()
    }));
  }));

  it('marcar todas como leídas también avisa del cambio', fakeAsync(() => {
    let avisos = 0;

    servicio.cambios.subscribe(() => avisos++);
    servicio.marcarTodasComoLeidas().subscribe();
    tick(LATENCIA_SIMULADA_MS);

    expect(avisos).toBe(1);
  }));
});
