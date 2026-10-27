import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { AvisosBackendService } from '../../services/http/avisos-backend.service';
import { AvisoBackendComponent, RECARGAR_PAGINA } from './aviso-backend.component';

describe('AvisoBackendComponent', () => {
  let fixture: ComponentFixture<AvisoBackendComponent>;
  let raiz: HTMLElement;
  let avisos: AvisosBackendService;
  let auth: jasmine.SpyObj<AuthService>;
  let recargar: jasmine.Spy;

  beforeEach(() => {
    auth = jasmine.createSpyObj<AuthService>('AuthService', ['logout']);
    recargar = jasmine.createSpy('reload');
    TestBed.configureTestingModule({
      imports: [AvisoBackendComponent],
      providers: [
        provideRouter([]),
        { provide: AuthService, useValue: auth },
        { provide: RECARGAR_PAGINA, useValue: recargar }
      ]
    });
    avisos = TestBed.inject(AvisosBackendService);
    fixture = TestBed.createComponent(AvisoBackendComponent);
    raiz = fixture.nativeElement;
    fixture.detectChanges();
  });

  /**
   * @param texto Texto del boton.
   * @returns El boton.
   */
  function boton(texto: string): HTMLButtonElement | undefined {
    return Array.from(raiz.querySelectorAll('button')).find((b) => b.textContent?.trim() === texto);
  }

  it('sin aviso no pinta nada', () => {
    expect(raiz.querySelector('[role="alert"]')).toBeNull();
  });

  it('sesión vencida: «Iniciar sesión» cierra la sesión y va al login', () => {
    const navegar = spyOn(TestBed.inject(Router), 'navigate').and.resolveTo(true);

    avisos.avisar('sesion');
    fixture.detectChanges();
    expect(raiz.querySelector('[role="alert"]')?.textContent).toContain('Tu sesión venció');
    expect(boton('Cerrar')).toBeUndefined();

    boton('Iniciar sesión')?.click();
    fixture.detectChanges();
    expect(auth.logout).toHaveBeenCalled();
    expect(navegar).toHaveBeenCalledWith(['/login']);
    expect(raiz.querySelector('[role="alert"]')).toBeNull();
  });

  it('sin conexión: «Reintentar» recarga la pantalla; «Cerrar» lo quita', () => {
    avisos.avisar('conexion');
    fixture.detectChanges();
    boton('Reintentar')?.click();
    expect(recargar).toHaveBeenCalled();

    avisos.avisar('conexion');
    fixture.detectChanges();
    boton('Cerrar')?.click();
    fixture.detectChanges();
    expect(raiz.querySelector('[role="alert"]')).toBeNull();
  });

  it('sin permiso: el mensaje y «Cerrar»', () => {
    avisos.avisar('permiso');
    fixture.detectChanges();
    expect(raiz.querySelector('[role="alert"]')?.textContent).toContain('No tienes permiso para esta acción.');
    expect(boton('Reintentar')).toBeUndefined();
  });
});
