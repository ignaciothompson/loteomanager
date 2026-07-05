import { Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { DatePipe } from '@angular/common';
import type { FilaExtendida, ImportacionExtendida } from '../importador-types';
import { ImportadorService } from '../services/importador.service';
import { MessageService, ConfirmationService } from 'primeng/api';
import { ToastModule } from 'primeng/toast';
import { ButtonModule } from 'primeng/button';
import { TagModule } from 'primeng/tag';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { TabsModule } from 'primeng/tabs';
import { ProgressSpinnerModule } from 'primeng/progressspinner';
import { ResumenTabComponent } from '../components/resumen-tab.component';
import { FilasTabComponent } from '../components/filas-tab.component';
import { DetalleDrawerComponent } from '../components/detalle-drawer.component';

@Component({
  selector: 'app-importador-review',
  standalone: true,
  imports: [
    DatePipe,
    ToastModule,
    ButtonModule,
    TagModule,
    ConfirmDialogModule,
    TabsModule,
    ProgressSpinnerModule,
    ResumenTabComponent,
    FilasTabComponent,
    DetalleDrawerComponent,
  ],
  providers: [MessageService, ConfirmationService],
  templateUrl: './importador-review.component.html',
})
export class ImportadorReviewComponent {
  private importadorService = inject(ImportadorService);
  private messageService = inject(MessageService);
  private confirmationService = inject(ConfirmationService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);

  readonly importacionId = signal('');
  readonly importacion = signal<ImportacionExtendida | null>(null);
  readonly filas = signal<FilaExtendida[]>([]);
  readonly loading = signal(true);
  readonly loadError = signal<string | null>(null);

  readonly activeTab = signal<string>('0');
  readonly loadingCommit = signal(false);
  readonly showDetalle = signal(false);
  readonly selectedFila = signal<FilaExtendida | null>(null);

  readonly puedeConfirmar = computed(() => {
    const imp = this.importacion();
    if (imp?.estado !== 'listo_para_confirmar') return false;
    return !this.filas().some((f) => f.estado_fila === 'error');
  });

  constructor() {
    const id = this.route.snapshot.paramMap.get('id') ?? '';
    this.importacionId.set(id);
    void this.cargarDatos(id);
  }

  getNombreArchivo(): string {
    return this.importacion()?.nombre_archivo ?? this.importacionId();
  }

  getEstadoSeverity(estado: string): 'success' | 'info' | 'warn' | 'danger' | 'secondary' {
    const map: Record<string, 'success' | 'info' | 'warn' | 'danger' | 'secondary'> = {
      analizando: 'info',
      listo_para_confirmar: 'warn',
      confirmada: 'success',
      confirmando: 'info',
      descartada: 'secondary',
      con_errores: 'danger',
    };
    return map[estado] ?? 'secondary';
  }

  verDetalle(fila: FilaExtendida): void {
    this.selectedFila.set(fila);
    this.showDetalle.set(true);
    this.activeTab.set('2');
  }

  async recargarDatos(): Promise<void> {
    await this.cargarDatos(this.importacionId());
  }

  private async cargarDatos(id: string): Promise<void> {
    if (!id) {
      this.loadError.set('Importación no encontrada.');
      this.loading.set(false);
      return;
    }
    this.loading.set(true);
    this.loadError.set(null);
    try {
      const [imp, filas] = await Promise.all([
        this.importadorService.obtenerImportacionAsync(id),
        this.importadorService.listarFilasAsync(id),
      ]);
      this.importacion.set(imp as ImportacionExtendida);
      this.filas.set(filas);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'No se pudo cargar la revisión';
      this.loadError.set(msg);
      this.messageService.add({ severity: 'error', summary: 'Error', detail: msg });
    } finally {
      this.loading.set(false);
    }
  }

  irAtras(): void {
    void this.router.navigate(['/importador']);
  }

  confirmarImportacion(): void {
    this.confirmationService.confirm({
      message: '¿Confirmar importación? Se crearán barrios y lotes según las filas OK.',
      header: 'Confirmar',
      icon: 'pi pi-check-circle',
      acceptLabel: 'Confirmar',
      rejectLabel: 'Cancelar',
      accept: () => void this.doConfirmar(),
    });
  }

  descartarImportacion(): void {
    this.confirmationService.confirm({
      message: '¿Descartar esta importación?',
      header: 'Descartar',
      icon: 'pi pi-exclamation-triangle',
      acceptLabel: 'Sí',
      rejectLabel: 'No',
      accept: () => void this.doDescartar(),
    });
  }

  private async doConfirmar(): Promise<void> {
    this.loadingCommit.set(true);
    try {
      const r = await this.importadorService.commitImportacion(this.importacionId());
      this.messageService.add({
        severity: 'success',
        summary: 'Importación confirmada',
        detail: `Aplicadas: ${r.filas_aplicadas} · Omitidas: ${r.filas_omitidas} · Fallidas: ${r.filas_fallidas}`,
        life: 8000,
      });
      void this.router.navigate(['/importador']);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error al confirmar';
      this.messageService.add({ severity: 'error', summary: 'Error', detail: msg });
    } finally {
      this.loadingCommit.set(false);
    }
  }

  private async doDescartar(): Promise<void> {
    this.loadingCommit.set(true);
    try {
      await this.importadorService.descartarImportacion(this.importacionId());
      void this.router.navigate(['/importador']);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error al descartar';
      this.messageService.add({ severity: 'error', summary: 'Error', detail: msg });
    } finally {
      this.loadingCommit.set(false);
    }
  }
}
