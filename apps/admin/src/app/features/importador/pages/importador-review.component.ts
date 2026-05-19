import {
  Component,
  Signal,
  computed,
  inject,
  signal,
} from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { ImportacionesResponse, ImportacionFilasResponse } from '@loteomanager/shared-types';
import { ImportadorService } from '../services/importador.service';
import { MapeoColumnas, MapeoExtras } from '../parser/types';
import { DatePipe } from '@angular/common';
import { MessageService, ConfirmationService } from 'primeng/api';
import { ToastModule } from 'primeng/toast';
import { ButtonModule } from 'primeng/button';
import { TagModule } from 'primeng/tag';
import { ProgressSpinnerModule } from 'primeng/progressspinner';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { TabsModule } from 'primeng/tabs';
import { TooltipModule } from 'primeng/tooltip';
import { ImportadorResumenTabComponent } from '../components/importador-resumen-tab.component';
import {
  ImportadorFilasTabComponent,
  FilaExtendida,
} from '../components/importador-filas-tab.component';
import { ImportadorFilaDetailComponent } from '../components/importador-fila-detail.component';
import { MapeoColumnasDialogComponent } from '../components/mapeo-columnas-dialog.component';
import { MapeoExtrasDialogComponent } from '../components/mapeo-extras-dialog.component';

interface ImportacionExtendida extends ImportacionesResponse {
  nombre_archivo?: string;
  mapeo_columnas?: Record<string, string | null>;
  mapeo_extras?: Record<string, string | null>;
}

@Component({
  selector: 'app-importador-review',
  standalone: true,
  imports: [
    DatePipe,
    ToastModule,
    ButtonModule,
    TagModule,
    ProgressSpinnerModule,
    ConfirmDialogModule,
    TabsModule,
    TooltipModule,
    ImportadorResumenTabComponent,
    ImportadorFilasTabComponent,
    ImportadorFilaDetailComponent,
    MapeoColumnasDialogComponent,
    MapeoExtrasDialogComponent,
  ],
  providers: [MessageService, ConfirmationService],
  templateUrl: './importador-review.component.html',
})
export class ImportadorReviewComponent {
  private importadorService = inject(ImportadorService);
  private messageService = inject(MessageService);
  private confirmationService = inject(ConfirmationService);
  private router = inject(Router);

  importacionId = signal('');

  // Signal-of-signals: reassignable references to service live signals
  private _importacionSig = signal<Signal<ImportacionesResponse | null> | null>(null);
  private _filasSig = signal<Signal<ImportacionFilasResponse[]> | null>(null);

  importacion = computed(() => this._importacionSig()?.() ?? null);
  filas = computed(() => this._filasSig()?.() ?? []);

  activeTabIndex = signal(0);
  loadingCommit = signal(false);
  showMapeoColumnas = signal(false);
  showMapeoExtras = signal(false);
  showFilaDetail = signal(false);
  selectedFila = signal<FilaExtendida | null>(null);

  puedeConfirmar = computed(() => {
    const imp = this.importacion();
    if (imp?.estado !== 'listo_para_confirmar') return false;
    const filasData = this.filas() as FilaExtendida[];
    const hayErroresPendientes = filasData.some(
      f => f.estado_fila === 'error' && (!f.decision_usuario || f.decision_usuario === 'pendiente')
    );
    return !hayErroresPendientes;
  });

  tieneMapeoPendiente = computed(() => {
    const imp = this.importacion() as ImportacionExtendida | null;
    const mapeo = imp?.mapeo_columnas;
    if (!mapeo) return false;
    return Object.values(mapeo).some(v => v === null);
  });

  tieneExtrasPendientes = computed(() => {
    const imp = this.importacion() as ImportacionExtendida | null;
    const mapeo = imp?.mapeo_extras;
    if (!mapeo) return false;
    return Object.values(mapeo).some(v => v === null);
  });

  constructor() {
    const route = inject(ActivatedRoute);
    const id = route.snapshot.paramMap.get('id') ?? '';
    this.importacionId.set(id);
    this._importacionSig.set(this.importadorService.obtenerImportacion(id));
    this._filasSig.set(this.importadorService.listarFilas(id));
  }

  getNombreArchivo(): string {
    const imp = this.importacion() as ImportacionExtendida | null;
    return imp?.nombre_archivo || imp?.id || '—';
  }

  getEstadoSeverity(estado: string): 'success' | 'info' | 'warn' | 'danger' | 'secondary' {
    const map: Record<string, 'success' | 'info' | 'warn' | 'danger' | 'secondary'> = {
      analizando: 'info',
      listo_para_confirmar: 'warn',
      confirmada: 'success',
      descartada: 'secondary',
      con_errores: 'danger',
    };
    return map[estado] ?? 'secondary';
  }

  verDetalleFila(fila: FilaExtendida): void {
    this.selectedFila.set(fila);
    this.showFilaDetail.set(true);
  }

  confirmarImportacion(): void {
    this.confirmationService.confirm({
      message: '¿Confirmás la importación? Se crearán/actualizarán los registros en el sistema.',
      header: 'Confirmar importación',
      icon: 'pi pi-check-circle',
      acceptLabel: 'Sí, confirmar',
      rejectLabel: 'Cancelar',
      accept: () => void this.doConfirmar(),
    });
  }

  descartarImportacion(): void {
    this.confirmationService.confirm({
      message: '¿Descartás esta importación? Esta acción no se puede deshacer.',
      header: 'Descartar importación',
      icon: 'pi pi-exclamation-triangle',
      acceptLabel: 'Sí, descartar',
      rejectLabel: 'Cancelar',
      accept: () => void this.doDescartar(),
    });
  }

  async onMapeoColumnasGuardado(mapeo: MapeoColumnas): Promise<void> {
    const id = this.importacionId();
    this.showMapeoColumnas.set(false);
    this.loadingCommit.set(true);
    try {
      await this.importadorService.guardarMapeoColumnas(id, mapeo);
      await this.importadorService.reAnalizarConMapeo(id);
      this.recargarDatos();
      this.messageService.add({
        severity: 'success',
        summary: 'Mapeo aplicado',
        detail: 'El re-análisis con el nuevo mapeo de columnas se completó correctamente.',
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error al aplicar el mapeo.';
      this.messageService.add({ severity: 'error', summary: 'Error', detail: msg });
      console.error('[ImportadorReviewComponent] onMapeoColumnasGuardado:', err);
    } finally {
      this.loadingCommit.set(false);
    }
  }

  async onMapeoExtrasGuardado(mapeo: MapeoExtras): Promise<void> {
    const id = this.importacionId();
    this.showMapeoExtras.set(false);
    this.loadingCommit.set(true);
    try {
      await this.importadorService.guardarMapeoExtras(id, mapeo);
      await this.importadorService.reAnalizarConMapeo(id);
      this.recargarDatos();
      this.messageService.add({
        severity: 'success',
        summary: 'Mapeo aplicado',
        detail: 'El re-análisis con el nuevo mapeo de extras se completó correctamente.',
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error al aplicar el mapeo de extras.';
      this.messageService.add({ severity: 'error', summary: 'Error', detail: msg });
      console.error('[ImportadorReviewComponent] onMapeoExtrasGuardado:', err);
    } finally {
      this.loadingCommit.set(false);
    }
  }

  recargarDatos(): void {
    const id = this.importacionId();
    this._importacionSig.set(this.importadorService.obtenerImportacion(id));
    this._filasSig.set(this.importadorService.listarFilas(id));
  }

  irAtras(): void {
    void this.router.navigate(['/importador']);
  }

  private async doConfirmar(): Promise<void> {
    this.loadingCommit.set(true);
    try {
      const resultado = await this.importadorService.commitImportacion(this.importacionId());
      console.info('[ImportadorReviewComponent] Commit resultado:', resultado);
      this.messageService.add({
        severity: 'success',
        summary: 'Importación confirmada',
        detail: `Filas aplicadas: ${resultado.filas_aplicadas} | Fallidas: ${resultado.filas_fallidas} | Omitidas: ${resultado.filas_omitidas}`,
        life: 6000,
      });
      void this.router.navigate(['/importador']);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error al confirmar la importación.';
      this.messageService.add({ severity: 'error', summary: 'Error', detail: msg });
      console.error('[ImportadorReviewComponent] doConfirmar:', err);
    } finally {
      this.loadingCommit.set(false);
    }
  }

  private async doDescartar(): Promise<void> {
    this.loadingCommit.set(true);
    try {
      await this.importadorService.descartarImportacion(this.importacionId());
      this.messageService.add({ severity: 'info', summary: 'Importación descartada', detail: 'La importación fue descartada.' });
      void this.router.navigate(['/importador']);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error al descartar la importación.';
      this.messageService.add({ severity: 'error', summary: 'Error', detail: msg });
      console.error('[ImportadorReviewComponent] doDescartar:', err);
    } finally {
      this.loadingCommit.set(false);
    }
  }
}
