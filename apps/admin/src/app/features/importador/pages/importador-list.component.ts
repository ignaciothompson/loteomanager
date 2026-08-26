import { Component, computed, inject, OnInit, signal, ViewChild } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { ImportadorService } from '../services/importador.service';
import { PlantillaService } from '../services/plantilla.service';
import { ImportacionExtendida } from '../importador-types';
import { ImportacionesResponse } from '@loteomanager/shared-types';
import {
  formatAbsoluto,
  fraseBarriosLotes,
  labelEstadoImportacion,
  tiempoRelativo,
} from '../importador-ui';
import { ImportadorFormatoError } from '../parser/types';
import { ConfirmationService, MenuItem, MessageService } from 'primeng/api';
import { ToastModule } from 'primeng/toast';
import { ButtonModule } from 'primeng/button';
import { TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { TooltipModule } from 'primeng/tooltip';
import { Menu, MenuModule } from 'primeng/menu';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { PopoverModule } from 'primeng/popover';
import { ProgressSpinnerModule } from 'primeng/progressspinner';

type TagSeverity = 'success' | 'info' | 'warn' | 'danger' | 'secondary' | 'contrast';

@Component({
  selector: 'app-importador-list',
  standalone: true,
  imports: [
    ToastModule,
    ButtonModule,
    TableModule,
    TagModule,
    TooltipModule,
    MenuModule,
    ConfirmDialogModule,
    PopoverModule,
    ProgressSpinnerModule,
  ],
  providers: [MessageService, ConfirmationService],
  templateUrl: './importador-list.component.html',
  styleUrls: ['./importador-list.component.css'],
})
export class ImportadorListComponent implements OnInit {
  @ViewChild('rowMenu') rowMenu?: Menu;

  private importadorService = inject(ImportadorService);
  private plantillaService = inject(PlantillaService);
  private messageService = inject(MessageService);
  private confirmation = inject(ConfirmationService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);

  readonly importaciones = signal<ImportacionesResponse[]>([]);
  readonly loadingList = signal(true);
  loadingPlantilla = signal(false);
  mostrarUpload = signal(false);
  analizando = signal(false);
  progreso = signal('');
  archivoSeleccionado = signal<File | null>(null);
  archivoSize = signal('');
  errorFormato = signal<{ message: string; ofrecePlantilla: boolean } | null>(null);
  highlightId = signal<string | null>(null);
  rowMenuItems: MenuItem[] = [];

  readonly pendientes = computed(() =>
    this.importaciones().filter(
      (i) => i.estado === 'listo_para_confirmar' || i.estado === 'analizando'
    )
  );

  readonly historial = computed(() =>
    this.importaciones().filter(
      (i) => i.estado !== 'listo_para_confirmar' && i.estado !== 'analizando'
    )
  );

  ngOnInit(): void {
    const qp = this.route.snapshot.queryParamMap;
    const retomar = qp.get('retomar');
    if (retomar) this.highlightId.set(retomar);
    if (qp.get('nueva') === '1') this.mostrarUpload.set(true);
    void this.recargar();
  }

  async recargar(): Promise<void> {
    this.loadingList.set(true);
    try {
      const rows = await this.importadorService.listarImportacionesAsync();
      this.importaciones.set(rows);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'No se pudieron cargar las importaciones.';
      this.messageService.add({ severity: 'error', summary: 'Error', detail: msg });
    } finally {
      this.loadingList.set(false);
    }
  }

  toggleUpload(): void {
    const next = !this.mostrarUpload();
    this.mostrarUpload.set(next);
    if (!next) this.limpiarArchivo();
  }

  verRevision(imp: ImportacionesResponse): void {
    void this.router.navigate(['/importador', imp.id, 'revision']);
  }

  getNombreArchivo(imp: ImportacionesResponse): string {
    return (imp as ImportacionExtendida).nombre_archivo || imp.archivo_origen || '—';
  }

  labelEstado(estado: string): string {
    return labelEstadoImportacion(estado);
  }

  getEstadoSeverity(estado: string): TagSeverity {
    const map: Record<string, TagSeverity> = {
      analizando: 'info',
      listo_para_confirmar: 'warn',
      confirmada: 'success',
      descartada: 'secondary',
      con_errores: 'danger',
    };
    return map[estado] ?? 'secondary';
  }

  contenido(imp: ImportacionesResponse): string {
    const c = (imp as ImportacionExtendida).mapeo_geografia?.conteo;
    if (!c) return '—';
    return fraseBarriosLotes(c.barrios, c.lotes);
  }

  resultado(imp: ImportacionesResponse): string | null {
    const r = (imp as ImportacionExtendida).mapeo_geografia?.resultado;
    if (!r || (imp.estado !== 'confirmada' && imp.estado !== 'con_errores')) return null;
    const parts: string[] = [];
    if (r.lotes_creados) parts.push(`${r.lotes_creados} creados`);
    if (r.omitidos) parts.push(`${r.omitidos} omitidos`);
    return parts.length ? parts.join(' · ') : null;
  }

  fechaCreacion(imp: ImportacionesResponse): string | undefined {
    return (imp as ImportacionesResponse & { created?: string }).created;
  }

  fechaRelativa(iso: string | undefined): string {
    return tiempoRelativo(iso);
  }

  fechaAbsoluta(iso: string | undefined): string {
    return formatAbsoluto(iso);
  }

  puedeDescartar(imp: ImportacionesResponse): boolean {
    return imp.estado === 'listo_para_confirmar' || imp.estado === 'con_errores';
  }

  openRowMenu(event: Event, imp: ImportacionesResponse): void {
    this.rowMenuItems = [
      {
        label: 'Descartar',
        icon: 'pi pi-trash',
        command: () => this.pedirDescartar(imp),
      },
    ];
    this.rowMenu?.toggle(event);
  }

  pedirDescartar(imp: ImportacionesResponse): void {
    this.confirmation.confirm({
      message: `¿Descartar «${this.getNombreArchivo(imp)}»?`,
      header: 'Descartar importación',
      icon: 'pi pi-exclamation-triangle',
      acceptLabel: 'Descartar',
      rejectLabel: 'Cancelar',
      accept: () => void this.doDescartar(imp),
    });
  }

  async descargarPlantilla(): Promise<void> {
    this.loadingPlantilla.set(true);
    try {
      await this.plantillaService.generarYDescargar();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error al generar la plantilla.';
      this.messageService.add({ severity: 'error', summary: 'Error', detail: msg });
    } finally {
      this.loadingPlantilla.set(false);
    }
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) this.setFile(input.files[0]);
  }

  onDrop(event: DragEvent): void {
    event.preventDefault();
    const files = event.dataTransfer?.files;
    if (files && files.length > 0) this.setFile(files[0]);
  }

  onDragOver(event: DragEvent): void {
    event.preventDefault();
  }

  triggerFileInput(): void {
    if (this.analizando()) return;
    const input = document.getElementById('file-input-list') as HTMLInputElement | null;
    input?.click();
  }

  limpiarArchivo(): void {
    this.archivoSeleccionado.set(null);
    this.archivoSize.set('');
    this.errorFormato.set(null);
    const input = document.getElementById('file-input-list') as HTMLInputElement | null;
    if (input) input.value = '';
  }

  async subirYAnalizar(): Promise<void> {
    const file = this.archivoSeleccionado();
    if (!file) return;
    this.analizando.set(true);
    this.errorFormato.set(null);
    this.progreso.set('Analizando archivo…');
    try {
      const id = await this.importadorService.analizarExcel(file, {
        onProgress: (msg) => this.progreso.set(msg),
      });
      this.limpiarArchivo();
      this.mostrarUpload.set(false);
      await this.router.navigate(['/importador', id, 'revision']);
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

  private async doDescartar(imp: ImportacionesResponse): Promise<void> {
    try {
      await this.importadorService.descartarImportacion(imp.id);
      this.messageService.add({ severity: 'success', summary: 'Descartada', detail: this.getNombreArchivo(imp) });
      await this.recargar();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'No se pudo descartar';
      this.messageService.add({ severity: 'error', summary: 'Error', detail: msg });
    }
  }
}
