import { TestBed, fakeAsync, tick } from '@angular/core/testing';
import { Notificacion } from '../models';
import { RELOJ } from '../utils/reloj';
import { NOTIFICACIONES } from './mock-data/notificaciones.data';
import { LATENCIA_SIMULADA_MS } from './mock-data/simular-respuesta';
import { NotificacionesMockService } from './notificaciones-mock.service';

describe('NotificacionesMockService', () => {
  const AHORA = new Date(2026, 9, 2, 10, 0);
  let servicio: NotificacionesMockService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [{ provide: RELOJ, useValue: () => new Date(AHORA) }]
    });
    servicio = TestBed.inject(NotificacionesMockService);
  });

  it('agregar crea notificaciones sin leer, con fecha y destinatario, y avisa del cambio', fakeAsync(() => {
    let avisos = 0;
    let lista: Notificacion[] = [];

    servicio.cambios.subscribe(() => avisos++);
    servicio.agregarNotificaciones([
      { titulo: 'Nuevo plan', texto: 'Texto', tipo: 'info', destinatarioId: 'EMP-001' }
    ]).subscribe();
    tick(LATENCIA_SIMULADA_MS);
    servicio.obtenerNotificaciones().subscribe((l) => lista = l);
    tick(LATENCIA_SIMULADA_MS);

    expect(avisos).toBe(1);
    expect(lista.length).toBe(NOTIFICACIONES.length + 1);
    expect(lista.find((n) => n.titulo === 'Nuevo plan')).toEqual(jasmine.objectContaining({
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
