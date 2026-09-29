import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { BackendService, PlantillaTemporalDto } from '../services/backend.service';
import { ConflictoPdfService } from '../services/conflicto-pdf.service';

/**
 * Historial de declaraciones del usuario que ha iniciado sesion.
 *
 * Los PDF no se guardan en ningun lado: se regeneran a partir del JSON que
 * quedo almacenado con cada envio, con la misma plantilla que uso el
 * formulario original.
 */
@Component({
  selector: 'app-mis-formularios',
  imports: [CommonModule],
  templateUrl: './mis-formularios.component.html',
  styleUrl: './mis-formularios.component.scss'
})
export class MisFormulariosComponent implements OnInit {

  formularios: PlantillaTemporalDto[] = [];
  cargando = true;
  error: string | null = null;

  constructor(
    private backendService: BackendService,
    private conflictoPdfService: ConflictoPdfService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.backendService.getMisFormularios().subscribe({
      next: (formularios) => {
        this.formularios = formularios;
        this.cargando = false;
      },
      error: (err) => {
        console.error('[MisFormularios] Error al cargar el historial:', err);
        this.error = 'No se pudo cargar el historial. Intente nuevamente más tarde.';
        this.cargando = false;
      }
    });
  }

  /** Traduce el codigo guardado en DCIPU_ESTADO_PLANTILLA. */
  getTipoDeclaracion(codigo: string | null | undefined): string {
    switch (codigo) {
      case 'I': return 'Inicial';
      case 'A': return 'Actualización';
      case 'F': return 'Final';
      default: return 'Sin especificar';
    }
  }

  /**
   * Solo una version esta vigente; las demas son el historial que se genera
   * cada vez que se vuelve a enviar el formulario.
   */
  esVigente(formulario: PlantillaTemporalDto): boolean {
    return String(formulario.ESTADO ?? '').trim().toUpperCase() === 'ACTIVO';
  }

  formatearFecha(fecha: string | null | undefined): string {
    if (!fecha) {
      return 'Sin fecha';
    }
    const valor = new Date(fecha);
    return isNaN(valor.getTime())
      ? 'Sin fecha'
      : valor.toLocaleString('es-EC', {
          day: '2-digit', month: '2-digit', year: 'numeric',
          hour: '2-digit', minute: '2-digit'
        });
  }

  verPdf(formulario: PlantillaTemporalDto): void {
    this.generarPdf(formulario, true);
  }

  descargarPdf(formulario: PlantillaTemporalDto): void {
    this.generarPdf(formulario, false);
  }

  volverAlFormulario(): void {
    this.router.navigate(['/']);
  }

  private generarPdf(formulario: PlantillaTemporalDto, previsualizar: boolean): void {
    if (!formulario.JSON) {
      this.error = 'Esta declaración no tiene datos para generar el PDF.';
      return;
    }

    try {
      this.conflictoPdfService.generar(JSON.parse(formulario.JSON), previsualizar);
    } catch (e) {
      console.error('[MisFormularios] JSON invalido en la plantilla', formulario.CODIGO, e);
      this.error = 'No se pudo generar el PDF de esta declaración.';
    }
  }
}
