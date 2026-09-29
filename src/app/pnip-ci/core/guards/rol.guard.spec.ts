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
import { AuthService } from '../../../services/auth.service';
import { DATO_ROL_REQUERIDO, rolGuard } from './rol.guard';

/** Clave con la que se desactiva la simulacion de rol en desarrollo. */
const CLAVE_ROL_SIMULADO = 'PNIP-CI-ROL-SIMULADO';

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
        // Sin simulacion: el guard debe usar los roles reales.
        localStorage.setItem(CLAVE_ROL_SIMULADO, 'ninguno');

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

    afterEach(() => {
        localStorage.removeItem(CLAVE_ROL_SIMULADO);
    });

    describe('/pnip/responsable/** (sin rol requerido)', () => {
        const DATA_RESPONSABLE = { [DATO_ROL_REQUERIDO]: null };

        for (const rol of ['E', 'R', 'A', 'I']) {
            it('deja pasar a un autenticado con rol ' + rol, () => {
                roles = [rol];
                expect(ejecutar(DATA_RESPONSABLE)).toBeTrue();
            });
        }

        it('deja pasar a un autenticado sin ningún rol', () => {
            expect(ejecutar(DATA_RESPONSABLE)).toBeTrue();
        });

        it('sin sesión redirige a /login', () => {
            sesionActiva = false;
            expect(urlDe(ejecutar(DATA_RESPONSABLE))).toBe('/login');
        });
    });

    describe('/pnip/rrhh/** (rol rrhh)', () => {
        const DATA_RRHH = { [DATO_ROL_REQUERIDO]: 'rrhh' };

        it('deja pasar al Jefe de RRHH (R)', () => {
            roles = ['R'];
            expect(ejecutar(DATA_RRHH)).toBeTrue();
        });

        it('deja pasar al Administrador (A)', () => {
            roles = ['A'];
            expect(ejecutar(DATA_RRHH)).toBeTrue();
        });

        it('no deja pasar a E y lo envía al dashboard de responsable',
            () => {
                roles = ['E'];
                expect(urlDe(ejecutar(DATA_RRHH)))
                    .toBe('/pnip/responsable/dashboard');
            });

        it('sin sesión redirige a /login', () => {
            sesionActiva = false;
            roles = ['R'];
            expect(urlDe(ejecutar(DATA_RRHH))).toBe('/login');
        });
    });

    it('niega el paso si la ruta no declara el rol requerido', () => {
        roles = ['R'];
        spyOn(console, 'error');
        expect(urlDe(ejecutar({}))).toBe('/');
    });
});
