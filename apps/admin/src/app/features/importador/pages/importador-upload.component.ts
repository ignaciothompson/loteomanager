import { Component, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { ImportadorService } from '../services/importador.service';
import { PlantillaGeneratorService } from '../services/plantilla-generator.service';
import { MessageService } from 'primeng/api';
import { ToastModule } from 'primeng/toast';
import { ButtonModule } from 'primeng/button';
import { ProgressSpinnerModule } from 'primeng/progressspinner';
import { TooltipModule } from 'primeng/tooltip';

@Component({
  selector: 'app-importador-upload',
  standalone: true,
  imports: [ToastModule, ButtonModule, ProgressSpinnerModule, TooltipModule],
  providers: [MessageService],
  templateUrl: './importador-upload.component.html',
})
export class ImportadorUploadComponent {
  private importadorService = inject(ImportadorService);
  private plantillaService = inject(PlantillaGeneratorService);
  private messageService = inject(MessageService);
  private router = inject(Router);

  loading = signal(false);
  analizando = signal(false);
  progreso = signal('');
  archivoSeleccionado = signal<File | null>(null);
  archivoSize = signal('');

  async descargarPlantilla(): Promise<void> {
    this.loading.set(true);
    try {
      await this.plantillaService.generarYDescargar();
      this.messageService.add({ severity: 'success', summary: 'Listo', detail: 'Plantilla descargada.' });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error al generar la plantilla.';
      this.messageService.add({ severity: 'error', summary: 'Error', detail: msg });
      console.error('[ImportadorUploadComponent] Error descargando plantilla:', err);
    } finally {
      this.loading.set(false);
    }
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      this.setFile(input.files[0]);
    }
  }

  onDrop(event: DragEvent): void {
    event.preventDefault();
    const files = event.dataTransfer?.files;
    if (files && files.length > 0) {
      this.setFile(files[0]);
    }
  }

  onDragOver(event: DragEvent): void {
    event.preventDefault();
  }

  triggerFileInput(): void {
    const input = document.getElementById('file-input') as HTMLInputElement | null;
    input?.click();
  }

  limpiarArchivo(): void {
    this.archivoSeleccionado.set(null);
    this.archivoSize.set('');
    const input = document.getElementById('file-input') as HTMLInputElement | null;
    if (input) input.value = '';
  }

  async subirYAnalizar(): Promise<void> {
    const file = this.archivoSeleccionado();
    if (!file) {
      this.messageService.add({ severity: 'warn', summary: 'Sin archivo', detail: 'Seleccioná un archivo antes de continuar.' });
      return;
    }
    this.analizando.set(true);
    this.progreso.set('Analizando archivo…');
    try {
      const id = await this.importadorService.analizarExcel(file);
      this.messageService.add({ severity: 'success', summary: 'Análisis completado', detail: 'Redirigiendo a revisión…' });
      void this.router.navigate(['/importador', id, 'revision']);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error al analizar el archivo.';
      this.messageService.add({ severity: 'error', summary: 'Error', detail: msg });
      console.error('[ImportadorUploadComponent] Error analizando:', err);
    } finally {
      this.analizando.set(false);
      this.progreso.set('');
    }
  }

  irAtras(): void {
    void this.router.navigate(['/importador']);
  }

  private setFile(file: File): void {
    const ext = file.name.split('.').pop()?.toLowerCase();
    if (ext !== 'xlsx' && ext !== 'xls') {
      this.messageService.add({
        severity: 'error',
        summary: 'Archivo inválido',
        detail: 'Solo se aceptan archivos .xlsx o .xls.',
      });
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      this.messageService.add({
        severity: 'error',
        summary: 'Archivo muy grande',
        detail: 'El archivo no puede superar 10 MB.',
      });
      return;
    }
    this.archivoSeleccionado.set(file);
    this.archivoSize.set((file.size / 1024).toFixed(1) + ' KB');
  }
}
