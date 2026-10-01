import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { SidebarMenuComponent } from './sidebar-menu.component';
import { RUTAS } from '../app.paths';

/** Pantalla vacía para las rutas de prueba. */
@Component({ template: '' })
class VaciaComponent {}

/** Anfitrión que escucha los 3 eventos, como hace AdminComponent. */
@Component({
  imports: [SidebarMenuComponent],
  template: `
    <app-sidebar-menu activeSection="list" [canViewList]="true"
      (formClicked)="eventos.push('form')"
      (excuseClicked)="eventos.push('excuse')"
      (listClicked)="eventos.push('list')"></app-sidebar-menu>
  `
})
class ComoAdminComponent {
  eventos: string[] = [];
}

describe('SidebarMenuComponent (menú real ampliado)', () => {
  let roles: string[] = [];

  /**
   * @param raiz Elemento raíz del fixture.
   * @returns Textos de los ítems visibles del menú.
   */
  function textos(raiz: HTMLElement): string[] {
    return Array.from(raiz.querySelectorAll('.nav-btn .nav-text'))
      .map((e) => (e.textContent ?? '').trim());
  }

  /**
   * @param raiz Elemento raíz del fixture.
   * @param texto Texto del ítem.
   * @returns El botón o enlace con ese texto.
   */
  function item(raiz: HTMLElement, texto: string): HTMLElement {
    return Array.from(raiz.querySelectorAll<HTMLElement>('.nav-btn'))
      .find((e) => e.querySelector('.nav-text')?.textContent?.trim() === texto) as HTMLElement;
  }

  beforeEach(() => {
    roles = [];
    TestBed.configureTestingModule({
      providers: [
        provideRouter([{ path: '**', component: VaciaComponent }]),
        { provide: AuthService, useValue: { hasRole: (r: string) => roles.includes(r) } }
      ]
    });
  });

  describe('fuera de /admin (como lo pinta AppComponent en /rrhh y /responsable)', () => {
    let fixture: ComponentFixture<SidebarMenuComponent>;

    /** Crea el menú sin nadie escuchando sus eventos. */
    function crear(): HTMLElement {
      fixture = TestBed.createComponent(SidebarMenuComponent);
      fixture.componentRef.setInput('activeSection', null);
      fixture.componentRef.setInput('canViewList', roles.includes('R') || roles.includes('A'));
      fixture.detectChanges();
      return fixture.nativeElement;
    }

    it('RRHH (R) ve el menú completo en el orden pedido', () => {
      roles = ['R'];
      const raiz = crear();

      expect(textos(raiz)).toEqual(['Dashboard', 'Formularios', 'Conflicto',
        'Informe General', 'Revisión de Evidencias', 'Historial']);
      item(raiz, 'Formularios').click();
      item(raiz, 'Conflicto').click();
      fixture.detectChanges();
      expect(textos(raiz)).toEqual(['Dashboard', 'Formularios',
        'Formulario de conflicto de interés', 'Formulario de excusa', 'Ver Formularios',
        'Conflicto', 'Análisis de Conflictos', 'Consulta Previa',
        'Informe General', 'Revisión de Evidencias', 'Historial']);
    });

    it('Administrador (A) también ve el menú de RRHH', () => {
      roles = ['A'];
      expect(textos(crear())).toContain('Informe General');
    });

    for (const rol of ['E', 'I']) {
      it(`sin R/A (${rol}) solo ve Dashboard y Bandeja de Tareas`, () => {
        roles = [rol];
        expect(textos(crear())).toEqual(['Dashboard', 'Bandeja de Tareas']);
      });
    }

    it('los ítems nuevos son enlaces a las rutas del módulo', () => {
      roles = ['R'];
      const raiz = crear();

      expect(item(raiz, 'Historial').getAttribute('href')).toBe(RUTAS.rrhh.historial);
      expect(item(raiz, 'Dashboard').getAttribute('href')).toBe(RUTAS.rrhh.dashboard);
    });

    it('en Plan de Acción abre «Conflicto» y resalta Análisis', async () => {
      roles = ['R'];
      await TestBed.inject(Router).navigateByUrl(RUTAS.rrhh.conflictos + 'C-001/planes/PL-002');
      const raiz = crear();

      expect(item(raiz, 'Análisis de Conflictos').classList).toContain('active');
      expect(item(raiz, 'Conflicto').classList).toContain('grupo-activo');
      expect(textos(raiz)).not.toContain('Formulario de excusa');
    });

    it('«Formulario de conflicto» lleva a /admin?vista=formulario', () => {
      roles = ['R'];
      const raiz = crear();
      const navegar = spyOn(TestBed.inject(Router), 'navigate').and.resolveTo(true);

      item(raiz, 'Formularios').click();
      fixture.detectChanges();
      item(raiz, 'Formulario de conflicto de interés').click();
      expect(navegar).toHaveBeenCalledWith(['/admin'], { queryParams: { vista: 'formulario' } });
      item(raiz, 'Ver Formularios').click();
      expect(navegar).toHaveBeenCalledWith(['/admin']);
    });

    it('«Formulario de excusa» descarga el mismo PDF que AdminComponent', () => {
      roles = ['R'];
      const raiz = crear();
      let descargado = '';
      const clic = spyOn(HTMLAnchorElement.prototype, 'click').and.callFake(function (this: HTMLAnchorElement) {
        descargado = this.getAttribute('href') ?? '';
      });

      item(raiz, 'Formularios').click();
      fixture.detectChanges();
      item(raiz, 'Formulario de excusa').click();
      expect(clic).toHaveBeenCalled();
      expect(descargado).toBe('/sisci/assets/FORMULARIO_DE_EXCUSAS_EV_EEASA.pdf');
    });
  });

  describe('dentro de /admin (AdminComponent escucha los eventos)', () => {
    it('los 3 botones emiten como siempre y no navegan; el grupo abre solo', () => {
      roles = ['R'];
      const fixture = TestBed.createComponent(ComoAdminComponent);
      const navegar = spyOn(TestBed.inject(Router), 'navigate').and.resolveTo(true);
      fixture.detectChanges();
      const raiz: HTMLElement = fixture.nativeElement;

      item(raiz, 'Formulario de conflicto de interés').click();
      item(raiz, 'Formulario de excusa').click();
      item(raiz, 'Ver Formularios').click();
      expect(fixture.componentInstance.eventos).toEqual(['form', 'excuse', 'list']);
      expect(navegar).not.toHaveBeenCalled();
      expect(item(raiz, 'Ver Formularios').classList).toContain('active');
    });
  });
});
