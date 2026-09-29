import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

@Component({
  selector: 'app-login',
  imports: [CommonModule, FormsModule],
  templateUrl: './login.component.html',
  styleUrl: './login.component.scss'
})
export class LoginComponent {
  cedula: string = '';
  codigo: string = '';
  loadingCodigo: boolean = false;
  errorCodigo: string = '';

  constructor(
    private authService: AuthService,
    private router: Router
  ) {}

  onCiInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    let value = input.value.replace(/\D/g, '');
    if (value.length > 10) {
      value = value.substring(0, 10);
    }
    this.cedula = value;
  }

  onSubmitCodigo(): void {
    const ci = (this.cedula || '').trim();
    const code = (this.codigo || '').trim();

    if (!ci || ci.length !== 10) {
      this.errorCodigo = 'Ingrese una cédula válida de 10 dígitos.';
      return;
    }
    if (!code) {
      this.errorCodigo = 'Ingrese el código temporal.';
      return;
    }

    this.loadingCodigo = true;
    this.errorCodigo = '';

    this.authService.loginConCedulaYCodigo(ci, code).subscribe({
      next: (success) => {
        this.loadingCodigo = false;
        if (success) {
          console.log('[LoginComponent] Autenticación por cédula y código exitosa. Redirigiendo...');
          const tieneRolAdmin = this.authService.hasRole('A');
          const tieneRolJefeRRHH = this.authService.hasRole('R');
          if (tieneRolAdmin || tieneRolJefeRRHH) {
            this.router.navigate(['/admin']);
          } else {
            this.router.navigate(['/inicio']);
          }
        } else {
          this.errorCodigo = 'Cédula o código inválidos o expirados.';
        }
      },
      error: (err) => {
        this.loadingCodigo = false;
        console.error('[LoginComponent] Error al autenticar con cédula y código:', err);
        this.errorCodigo = err?.error?.mensaje || err?.message || 'Error al verificar cédula y código.';
      }
    });
  }
}
