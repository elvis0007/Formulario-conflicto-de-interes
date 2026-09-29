import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { MENU_RESPONSABLE, MENU_RRHH } from '../../../pnip-ci.menus';
import { buscarItemActivo } from './item-menu';
import { SidebarPnipComponent } from './sidebar-pnip.component';

/** Pantalla vacia para las rutas de prueba. */
@Component({ template: '' })
class VaciaComponent {
}

describe('buscarItemActivo', () => {
    /**
     * @param url URL activa.
     * @returns Etiqueta del item activo en el menu de RRHH.
     */
    function activoRrhh(url: string): string | undefined {
        return buscarItemActivo(MENU_RRHH, url)?.etiqueta;
    }

    it('coincidencia exacta', () => {
        expect(activoRrhh('/pnip/rrhh/dashboard')).toBe('Dashboard');
        expect(activoRrhh('/pnip/rrhh/historial')).toBe('Historial');
    });

    it('Plan de Acción resalta Análisis de Conflictos', () => {
        expect(activoRrhh('/pnip/rrhh/conflictos/C-001/planes/PL-002'))
            .toBe('Análisis de Conflictos');
    });

    it('Consulta Previa no se confunde con el prefijo de Análisis', () => {
        expect(activoRrhh('/pnip/rrhh/conflictos/consulta-previa'))
            .toBe('Consulta Previa');
        expect(activoRrhh('/pnip/rrhh/conflictos/analisis'))
            .toBe('Análisis de Conflictos');
    });

    it('ignora query y fragmento', () => {
        expect(activoRrhh('/pnip/rrhh/historial?pagina=2#fila'))
            .toBe('Historial');
    });

    it('no confunde segmentos parecidos', () => {
        expect(activoRrhh('/pnip/rrhh/historial-viejo')).toBeUndefined();
    });

    it('detalle de plan del responsable resalta Bandeja de Tareas', () => {
        expect(buscarItemActivo(MENU_RESPONSABLE,
            '/pnip/responsable/planes/PL-003')?.etiqueta)
            .toBe('Bandeja de Tareas');
    });
});

describe('SidebarPnipComponent', () => {
    let fixture: ComponentFixture<SidebarPnipComponent>;

    /**
     * Navega y refresca la vista.
     *
     * @param url URL de destino.
     */
    async function navegar(url: string): Promise<void> {
        await TestBed.inject(Router).navigateByUrl(url);
        fixture.detectChanges();
    }

    /**
     * @returns Texto de los items resaltados.
     */
    function activos(): string[] {
        return Array.from<HTMLElement>(
            fixture.nativeElement.querySelectorAll('.item--activo')
        ).map((e) => e.textContent?.trim() ?? '');
    }

    beforeEach(() => {
        TestBed.configureTestingModule({
            providers: [provideRouter([
                { path: '**', component: VaciaComponent }
            ])]
        });
        fixture = TestBed.createComponent(SidebarPnipComponent);
        fixture.componentRef.setInput('menu', MENU_RRHH);
        fixture.componentRef.setInput('nombreUsuario', 'Lucía Freire Ortiz');
        fixture.componentRef.setInput('rolUsuario', 'Jefe de RRHH');
    });

    it('al cargar en Plan de Acción expande «Conflicto» y resalta Análisis',
        async () => {
        // Primera deteccion de cambios despues de navegar = carga directa.
        await navegar('/pnip/rrhh/conflictos/C-001/planes/PL-002');

        const menu = fixture.nativeElement.querySelector('.menu').textContent;

        expect(activos()).toEqual(['Análisis de Conflictos']);
        // «Conflicto» expandido; «Formularios» sigue cerrado.
        expect(menu).toContain('Consulta Previa');
        expect(menu).not.toContain('Conflicto de Interés');
    });

    it('al navegar se actualiza el item activo', async () => {
        fixture.detectChanges();
        await navegar('/pnip/rrhh/historial');
        expect(activos()).toEqual(['Historial']);
        await navegar('/pnip/rrhh/formularios/excusas');
        expect(activos()).toEqual(['Excusas']);
    });

    it('los grupos se abren y cierran con su botón', async () => {
        await navegar('/pnip/rrhh/dashboard');
        fixture.detectChanges();
        const grupo: HTMLButtonElement = fixture.nativeElement
            .querySelector('.grupo');

        expect(grupo.getAttribute('aria-expanded')).toBe('false');
        grupo.click();
        fixture.detectChanges();
        expect(grupo.getAttribute('aria-expanded')).toBe('true');
        expect(fixture.nativeElement.querySelector('.menu').textContent)
            .toContain('Conflicto de Interés');
    });

    it('muestra iniciales, nombre y rol al pie', () => {
        fixture.detectChanges();
        expect(fixture.nativeElement.querySelector('.avatar').textContent)
            .toContain('LF');
        expect(fixture.nativeElement.querySelector('.usuario').textContent)
            .toContain('Jefe de RRHH');
    });
});
