import { ComponentFixture, TestBed } from '@angular/core/testing';
import { KpiCardComponent } from './kpi-card.component';

describe('KpiCardComponent', () => {
  let fixture: ComponentFixture<KpiCardComponent>;
  let emitidos = 0;

  beforeEach(() => {
    emitidos = 0;
    fixture = TestBed.createComponent(KpiCardComponent);
    fixture.componentRef.setInput('titulo', 'Riesgo alto');
    fixture.componentRef.setInput('valor', 3);
    fixture.componentInstance.seleccionado.subscribe(() => emitidos++);
    fixture.detectChanges();
  });

  it('muestra título y valor', () => {
    const texto = fixture.nativeElement.textContent as string;

    expect(texto).toContain('Riesgo alto');
    expect(texto).toContain('3');
  });

  it('no clicable: no es botón y no emite', () => {
    const tarjeta = fixture.nativeElement.querySelector('.tarjeta');

    expect(fixture.nativeElement.querySelector('button')).toBeNull();
    tarjeta.click();
    expect(emitidos).toBe(0);
  });

  it('clicable: es botón y emite seleccionado', () => {
    fixture.componentRef.setInput('clicable', true);
    fixture.detectChanges();
    fixture.nativeElement.querySelector('button').click();
    expect(emitidos).toBe(1);
  });

  it('activo: resalta y marca aria-pressed', () => {
    fixture.componentRef.setInput('clicable', true);
    fixture.componentRef.setInput('activo', true);
    fixture.detectChanges();
    const boton = fixture.nativeElement.querySelector('button');

    expect(boton.classList).toContain('activo');
    expect(boton.getAttribute('aria-pressed')).toBe('true');
  });

  it('colorea el número con el tono', () => {
    fixture.componentRef.setInput('tono', 'rojo');
    fixture.detectChanges();
    const valor = fixture.nativeElement.querySelector('.valor');

    expect(valor.style.color).toBe('var(--rojo)');
  });
});
