import { Component, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { Router } from '@angular/router';
import { ImportadorService } from '../services/importador.service';
import { ImportacionesResponse } from '@loteomanager/shared-types';
import { MessageService } from 'primeng/api';
import { ToastModule } from 'primeng/toast';
import { ButtonModule } from 'primeng/button';
import { TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';

interface ImportacionExtendida extends ImportacionesResponse {
  nombre_archivo?: string;
}

type TagSeverity = 'success' | 'info' | 'warn' | 'danger' | 'secondary' | 'contrast';

@Component({
  selector: 'app-importador-list',
  standalone: true,
  imports: [DatePipe, ToastModule, ButtonModule, TableModule, TagModule],
  providers: [MessageService],
  templateUrl: './importador-list.component.html',
})
export class ImportadorListComponent {
  private importadorService = inject(ImportadorService);
  private messageService = inject(MessageService);
  private router = inject(Router);

  importaciones = this.importadorService.listarImportaciones();
  loading = signal(false);

  verRevision(imp: ImportacionesResponse): void {
    void this.router.navigate(['/importador', imp.id, 'revision']);
  }

  nuevaImportacion(): void {
    void this.router.navigate(['/importador', 'nueva']);
  }

  getNombreArchivo(imp: ImportacionesResponse): string {
    return (imp as ImportacionExtendida).nombre_archivo || imp.archivo_origen || '—';
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
}
