import { TestBed } from '@angular/core/testing';
import { RUTAS } from '../app.paths';
import { AuthService } from './auth.service';
import { PerfilUsuarioService } from './perfil-usuario.service';

describe('PerfilUsuarioService', () => {
  let roles: string[] = [];
  let servicio: PerfilUsuarioService;

  beforeEach(() => {
    roles = [];
    TestBed.configureTestingModule({
      providers: [
        {
          provide: AuthService,
          useValue: {
            hasRole: (rol: string) => roles.includes(rol),
            getCurrentUser: () => null
          }
        }
      ]
    });
    servicio = TestBed.inject(PerfilUsuarioService);
  });

  describe('obtenerRoles', () => {
    const CASOS: [string[], string[]][] = [
      [['A'], ['rrhh']],
      [['R'], ['rrhh']],
      [['P'], ['responsable']],
      [['R', 'P'], ['rrhh', 'responsable']],
      [['A', 'P'], ['rrhh', 'responsable']],
      [['I'], []],
      [['E'], []],
      [[], []]
    ];

    for (const [delBackend, esperados] of CASOS) {
      it(`[${delBackend}] → [${esperados}]`, () => {
        roles = delBackend;
        expect(servicio.obtenerRoles()).toEqual(esperados as never);
      });
    }
  });

  describe('obtenerRutaInicio', () => {
    it('R o A (con o sin P) → dashboard de RRHH', () => {
      for (const r of [['R'], ['A'], ['R', 'P'], ['A', 'P']]) {
        roles = r;
        expect(servicio.obtenerRutaInicio()).toBe(RUTAS.rrhh.dashboard);
      }
    });

    it('solo P → dashboard de responsable', () => {
      roles = ['P'];
      expect(servicio.obtenerRutaInicio()).toBe(RUTAS.responsable.dashboard);
    });

    it('sin R, A ni P → /', () => {
      for (const r of [['I'], ['E'], []]) {
        roles = r;
        expect(servicio.obtenerRutaInicio()).toBe('/');
      }
    });
  });

  describe('obtenerEtiquetaRol', () => {
    const CASOS: [string[], string][] = [
      [['A', 'R', 'P'], 'Administrador'],
      [['R', 'P'], 'Jefe de RRHH'],
      [['P'], 'Responsable'],
      [['E'], 'Usuario externo'],
      [['I'], 'Empleado'],
      [[], 'Empleado']
    ];

    for (const [delBackend, etiqueta] of CASOS) {
      it(`[${delBackend}] → ${etiqueta}`, () => {
        roles = delBackend;
        expect(servicio.obtenerEtiquetaRol()).toBe(etiqueta);
      });
    }
  });
});
