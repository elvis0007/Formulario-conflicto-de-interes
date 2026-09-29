import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AuthService, ClaveTemporalResponse } from '../services/auth.service';

@Component({
  selector: 'app-generate-code-modal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './generate-code-modal.component.html',
  styleUrl: './generate-code-modal.component.scss'
})
export class GenerateCodeModalComponent {
  @Output() closed = new EventEmitter<void>();

  codeCedula: string = '';
  generatedCode: string = '';
  codeLoading = false;
  codeError: string | null = null;

  constructor(private authService: AuthService) {}

  onClose(): void {
    this.closed.emit();
  }

  onCedulaInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    let value = input.value.replace(/\D/g, '');
    if (value.length > 10) {
      value = value.substring(0, 10);
    }
    this.codeCedula = value;
  }

  generarCodigoDesdeBackend(): void {
    const cedula = (this.codeCedula || '').trim();
    if (!cedula || cedula.length !== 10) {
      this.codeError = 'Ingrese una cédula válida de 10 dígitos.';
      return;
    }

    this.codeLoading = true;
    this.codeError = null;
    this.generatedCode = '';

    this.authService.generarClaveTemporal(cedula).subscribe({
      next: (resp: ClaveTemporalResponse) => {
        this.codeLoading = false;
        this.generatedCode = resp.claveTemporal;
      },
      error: (err) => {
        this.codeLoading = false;
        console.error('[GenerateCodeModalComponent] Error al generar clave temporal:', err);
        this.codeError =
          err?.error?.mensaje || err?.message || 'No se pudo generar el código. Intente nuevamente.';
      }
    });
  }
}

