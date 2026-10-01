import { TestBed } from '@angular/core/testing';
import {
    ActivatedRouteSnapshot,
    GuardResult,
    MaybeAsync,
    Router,
    RouterStateSnapshot,
    UrlTree,
    provideRouter
} from '@angular/router';
import { RUTAS } from '../app.paths';
import { AuthService } from '../services/auth.service';
import { DATO_ROL_REQUERIDO, rolGuard } from './rol.guard';

describe('rolGuard', () => {
    let sesionActiva = true;
    let roles: string[] = [];

    /**
     * Ejecuta el guard para una ruta con el `data` indicado.
     *
     * @param data `Route.data` de la ruta.
     * @returns Resultado del guard.
     */
    function ejecutar(data: Record<string, unknown>): MaybeAsync<GuardResult> {
        const ruta = { data } as unknown as ActivatedRouteSnapshot;
        const estado = {} as RouterStateSnapshot;

        return TestBed.runInInjectionContext(() => rolGuard(ruta, estado));
    }

    /**
     * @param resultado Resultado del guard.
     * @returns URL de la redireccion.
     */
    function urlDe(resultado: MaybeAsync<GuardResult>): string {
        const router = TestBed.inject(Router);

        expect(resultado).toBeInstanceOf(UrlTree);
        return router.serializeUrl(resultado as UrlTree);
    }

    beforeEach(() => {
        sesionActiva = true;
        roles = [];

        TestBed.configureTestingModule({
            providers: [
                provideRouter([]),
                {
                    provide: AuthService,
                    useValue: {
                        isAuthenticated: () => sesionActiva,
                        hasRole: (rol: string) => roles.includes(rol),
                        getCurrentUser: () => null
                    }
                }
            ]
        });
    });

    describe('/responsable/** (cualquier empleado)', () => {
        const DATA_RESPONSABLE = { [DATO_ROL_REQUERIDO]: null };

        for (const rol of ['R', 'A', 'I']) {
            it('deja pasar a un empleado con rol ' + rol, () => {
                roles = [rol];
                expect(ejecutar(DATA_RESPONSABLE)).toBeTrue();
            });
        }

        it('deja pasar a un empleado sin ningún rol', () => {
            expect(ejecutar(DATA_RESPONSABLE)).toBeTrue();
        });

        it('no deja pasar a un externo (E) y lo saca del módulo', () => {
            roles = ['E'];
            expect(urlDe(ejecutar(DATA_RESPONSABLE))).toBe('/');
        });

        it('sin sesión redirige a /login', () => {
            sesionActiva = false;
            expect(urlDe(ejecutar(DATA_RESPONSABLE))).toBe('/login');
        });
    });

    describe('/rrhh/** (rol rrhh)', () => {
        const DATA_RRHH = { [DATO_ROL_REQUERIDO]: 'rrhh' };

        it('deja pasar al Jefe de RRHH (R)', () => {
            roles = ['R'];
            expect(ejecutar(DATA_RRHH)).toBeTrue();
        });

        it('deja pasar al Administrador (A)', () => {
            roles = ['A'];
            expect(ejecutar(DATA_RRHH)).toBeTrue();
        });

        it('no deja pasar a un empleado sin R/A: va a su dashboard', () => {
            roles = ['I'];
            expect(urlDe(ejecutar(DATA_RRHH)))
                .toBe(RUTAS.responsable.dashboard);
        });

        it('no deja pasar a un externo (E) y lo saca del módulo', () => {
            roles = ['E'];
            expect(urlDe(ejecutar(DATA_RRHH))).toBe('/');
        });

        it('sin sesión redirige a /login', () => {
            sesionActiva = false;
            roles = ['R'];
            expect(urlDe(ejecutar(DATA_RRHH))).toBe('/login');
        });

        it('ignora la simulación de rol antigua (PNIP-CI-ROL-SIMULADO)',
            () => {
                // Clave eliminada: si quedo guardada en algun navegador, ya
                // no debe convertir a nadie en RRHH.
                localStorage.setItem('PNIP-CI-ROL-SIMULADO', 'rrhh');
                roles = ['E'];
                try {
                    expect(urlDe(ejecutar(DATA_RRHH))).toBe('/');
                } finally {
                    localStorage.removeItem('PNIP-CI-ROL-SIMULADO');
                }
            });
    });

    it('niega el paso si la ruta no declara el rol requerido', () => {
        roles = ['R'];
        spyOn(console, 'error');
        expect(urlDe(ejecutar({}))).toBe('/');
    });
});
