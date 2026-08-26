import { Component, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { ImportadorService } from '../services/importador.service';
import { PlantillaService } from '../services/plantilla.service';
import { BarriosService, DepartamentosService, ZonasService } from '@loteomanager/shared-pb-client';
import { MessageService } from 'primeng/api';
import { ToastModule } from 'primeng/toast';
import { ButtonModule } from 'primeng/button';
import { TooltipModule } from 'primeng/tooltip';
import { PopoverModule } from 'primeng/popover';
import { ImportadorFormatoError } from '../parser/types';

@Component({
  selector: 'app-importador-upload',
  standalone: true,
  imports: [ToastModule, ButtonModule, TooltipModule, PopoverModule, RouterLink],
  providers: [MessageService],
  templateUrl: './importador-upload.component.html',
  styleUrls: ['./importador-upload.component.css'],
})
export class ImportadorUploadComponent {
  private importadorService = inject(ImportadorService);
  private plantillaService = inject(PlantillaService);
  private barriosSvc = inject(BarriosService);
  private zonasSvc = inject(ZonasService);
  private departamentosSvc = inject(DepartamentosService);
  private messageService = inject(MessageService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);

  loading = signal(false);
  analizando = signal(false);
  progreso = signal('');
  archivoSeleccionado = signal<File | null>(null);
  archivoSize = signal('');
  barrioDestinoId = signal<string | null>(null);
  barrioDestinoNombre = signal<string | null>(null);
  errorFormato = signal<{ message: string; ofrecePlantilla: boolean } | null>(null);
  private barrioPlantilla: {
    nombre: string;
    departamento: string;
    zona: string;
    tipos_unidad?: string[];
    descripcion?: string;
    ubicacion_texto?: string;
  } | null = null;

  constructor() {
    const barrioId = this.route.snapshot.queryParamMap.get('barrio');
    if (barrioId) {
      this.barrioDestinoId.set(barrioId);
      void this.cargarBarrio(barrioId);
    }
  }

  private async cargarBarrio(id: string): Promise<void> {
    try {
      const barrio = await this.barriosSvc.getAsync(id);
      this.barrioDestinoNombre.set(barrio.nombre);
      let departamento = '';
      let zonaNombre = '';
      if (barrio.zona_id) {
        const zona = await this.zonasSvc.getAsync(barrio.zona_id);
        zonaNombre = zona.nombre;
        if (zona.departamento_id) {
          const depto = await this.departamentosSvc.getAsync(zona.departamento_id);
          departamento = depto.nombre;
        }
      }
      this.barrioPlantilla = {
        nombre: barrio.nombre,
        departamento,
        zona: zonaNombre,
        tipos_unidad: barrio.tipos_unidad,
        descripcion: barrio.descripcion ?? undefined,
        ubicacion_texto: barrio.ubicacion_texto ?? undefined,
      };
    } catch {
      this.messageService.add({
        severity: 'error',
        summary: 'Barrio',
        detail: 'No se pudo cargar el barrio destino.',
      });
    }
  }

  async descargarPlantilla(): Promise<void> {
    this.loading.set(true);
    try {
      await this.plantillaService.generarYDescargar(
        this.barrioPlantilla ? { barrio: this.barrioPlantilla } : undefined
      );
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error al generar la plantilla.';
      this.messageService.add({ severity: 'error', summary: 'Error', detail: msg });
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
    if (this.analizando()) return;
    const input = document.getElementById('file-input') as HTMLInputElement | null;
    input?.click();
  }

  limpiarArchivo(): void {
    this.archivoSeleccionado.set(null);
    this.archivoSize.set('');
    this.errorFormato.set(null);
    const input = document.getElementById('file-input') as HTMLInputElement | null;
    if (input) input.value = '';
  }

  cambiarBarrio(): void {
    void this.router.navigate(['/importador', 'nueva']);
  }

  async subirYAnalizar(): Promise<void> {
    const file = this.archivoSeleccionado();
    if (!file) return;
    this.analizando.set(true);
    this.errorFormato.set(null);
    this.progreso.set('Analizando archivo…');
    try {
      const destId = this.barrioDestinoId();
      const id = await this.importadorService.analizarExcel(file, {
        barrioDestinoId: destId ?? undefined,
        onProgress: (msg) => this.progreso.set(msg),
      });
      this.limpiarArchivo();
      const navigated = await this.router.navigate(['/importador', id, 'revision']);
      if (!navigated) {
        await this.router.navigateByUrl(`/importador/${id}/revision`, { replaceUrl: true });
      }
    } catch (err: unknown) {
      if (err instanceof ImportadorFormatoError) {
        this.errorFormato.set({
          message: err.message,
          ofrecePlantilla: err.codigo === 'V2' || err.codigo === 'EXPORTADOR' || err.codigo === 'VACIO',
        });
      } else {
        const msg = err instanceof Error ? err.message : 'Error al analizar el archivo.';
        this.errorFormato.set({ message: msg, ofrecePlantilla: false });
      }
    } finally {
      this.analizando.set(false);
      this.progreso.set('');
    }
  }

  irAtras(): void {
    const dest = this.barrioDestinoId();
    if (dest) {
      void this.router.navigate(['/barrios', dest]);
      return;
    }
    void this.router.navigate(['/importador']);
  }

  private setFile(file: File): void {
    this.errorFormato.set(null);
    const ext = file.name.split('.').pop()?.toLowerCase();
    if (ext !== 'xlsx' && ext !== 'xls') {
      this.errorFormato.set({
        message: 'Solo se aceptan archivos .xlsx o .xls.',
        ofrecePlantilla: false,
      });
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      this.errorFormato.set({
        message: `El archivo supera 10 MB (${(file.size / 1024 / 1024).toFixed(1)} MB).`,
        ofrecePlantilla: false,
      });
      return;
    }
    this.archivoSeleccionado.set(file);
    this.archivoSize.set((file.size / 1024).toFixed(1) + ' KB');
  }
}
