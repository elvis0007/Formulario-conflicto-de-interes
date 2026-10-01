import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { RUTAS } from '../app.paths';
import { IUsuario } from '../models';
import { AuthService } from '../services/auth.service';
import { HeaderComponent } from './header.component';

/** Pantalla vacía para las rutas de prueba. */
@Component({ template: '' })
class VaciaComponent {}

/**
 * Pruebas de lo que la gestión de conflictos agrega a la cabecera
 * ([PNIP-CI]): usuario y rol, íconos de administración en /rrhh/** y
 * /responsable/**, y acceso del Responsable.
 *
 * @author Elvis Flores
 */
describe('HeaderComponent (gestión de conflictos)', () => {
  let roles: string[] = [];
  const usuario = signal<IUsuario | null>(null);

  /**
   * Navega a una URL y crea la cabecera.
   *
   * @param url URL en la que se crea.
   * @returns Elemento raíz de la cabecera.
   */
  async function crearEn(url: string): Promise<HTMLElement> {
    await TestBed.inject(Router).navigateByUrl(url);
    const fixture = TestBed.createComponent(HeaderComponent);
    fixture.detectChanges();
    return fixture.nativeElement;
  }

  /**
   * @param raiz Elemento raíz.
   * @returns Títulos de los íconos visibles de la cabecera.
   */
  function iconos(raiz: HTMLElement): string[] {
    return Array.from(raiz.querySelectorAll('.header-icon-btn[title]'))
      .map((e) => e.getAttribute('title') ?? '');
  }

  beforeEach(() => {
    roles = [];
    usuario.set({ CEDULA: '0000000000', NOMBRES: 'Usuario', APELLIDOS: 'Desarrollo' });
    TestBed.configureTestingModule({
      providers: [
        provideRouter([{ path: '**', component: VaciaComponent }]),
        {
          provide: AuthService,
          useValue: {
            usuario,
            getCurrentUser: () => usuario(),
            hasRole: (r: string) => roles.includes(r),
            isAdminRole: () => roles.includes('A'),
            logout: () => undefined
          }
        }
      ]
    });
  });

  it('muestra el nombre y el rol del usuario logueado', async () => {
    roles = ['R', 'P'];
    const raiz = await crearEn('/admin');

    expect(raiz.querySelector('.header-usuario-nombre')?.textContent?.trim())
      .toBe('Usuario Desarrollo');
    expect(raiz.querySelector('.header-usuario-rol')?.textContent?.trim())
      .toBe('Jefe de RRHH');
  });

  it('sin usuario en sesión no muestra el bloque de usuario', async () => {
    usuario.set(null);
    const raiz = await crearEn('/');

    expect(raiz.querySelector('.header-usuario')).toBeNull();
  });

  it('A en /rrhh ve generar código y gestionar roles', async () => {
    roles = ['A'];
    const raiz = await crearEn(RUTAS.rrhh.dashboard);

    expect(iconos(raiz)).toEqual(['Generar código de acceso',
      'Gestionar Jefes de RRHH', 'Mis declaraciones', 'Cerrar sesión']);
  });

  it('R en /rrhh ve generar código pero no gestionar roles', async () => {
    roles = ['R'];
    const raiz = await crearEn(RUTAS.rrhh.historial);

    expect(iconos(raiz)).toContain('Generar código de acceso');
    expect(iconos(raiz)).not.toContain('Gestionar Jefes de RRHH');
  });

  it('en /admin sigue igual que antes', async () => {
    roles = ['A'];
    expect(iconos(await crearEn('/admin'))).toContain('Gestionar Jefes de RRHH');
  });

  it('fuera de /admin y de gestión no aparecen los íconos de administración', async () => {
    roles = ['A'];
    const raiz = await crearEn('/mis-formularios');

    expect(iconos(raiz)).not.toContain('Generar código de acceso');
    expect(iconos(raiz)).not.toContain('Gestionar Jefes de RRHH');
  });

  it('P ve «Mis actividades» y lleva a su dashboard; no ve administración', async () => {
    roles = ['P'];
    const raiz = await crearEn(RUTAS.responsable.dashboard);
    const navegar = spyOn(TestBed.inject(Router), 'navigate').and.resolveTo(true);
    const boton = raiz.querySelector<HTMLButtonElement>(
      '[title="Mis actividades de conflicto de interés"]');

    expect(boton).not.toBeNull();
    expect(iconos(raiz)).not.toContain('Generar código de acceso');
    boton?.click();
    expect(navegar).toHaveBeenCalledWith([RUTAS.responsable.dashboard]);
  });

  it('sin P no aparece «Mis actividades»', async () => {
    roles = ['I'];
    expect(iconos(await crearEn('/')))
      .not.toContain('Mis actividades de conflicto de interés');
  });
});
