import { Component, EventEmitter, Input, Output, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import type { FilaExtendida } from '../importador-types';
import { ImportadorService } from '../services/importador.service';
import { MessageService } from 'primeng/api';
import { TableModule } from 'primeng/table';
import { ButtonModule } from 'primeng/button';
import { TagModule } from 'primeng/tag';
import { SelectModule } from 'primeng/select';
import { TooltipModule } from 'primeng/tooltip';

type TagSeverity = 'success' | 'info' | 'warn' | 'danger' | 'secondary';

@Component({
  selector: 'app-filas-tab',
  standalone: true,
  imports: [FormsModule, TableModule, ButtonModule, TagModule, SelectModule, TooltipModule],
  templateUrl: './filas-tab.component.html',
})
export class FilasTabComponent {
  @Input() filas: FilaExtendida[] = [];
  @Output() filaClick = new EventEmitter<FilaExtendida>();
  @Output() filasChanged = new EventEmitter<void>();

  private importadorService = inject(ImportadorService);
  private messageService = inject(MessageService);

  filtroTipo = signal<'todos' | 'barrio' | 'unidad'>('todos');
  filtroEstado = signal<string>('todos');

  readonly filtroTipoOpciones = [
    { label: 'Todos', value: 'todos' as const },
    { label: 'Barrios', value: 'barrio' as const },
    { label: 'Unidades', value: 'unidad' as const },
  ];

  readonly filtroEstadoOpciones = [
    { label: 'Todos', value: 'todos' },
    { label: 'OK', value: 'ok' },
    { label: 'Duplicados', value: 'duplicado' },
    { label: 'Errores', value: 'error' },
  ];

  readonly decisionUnidadDuplicada = [
    { label: 'Omitir', value: 'omitir' },
    { label: 'Crear igual', value: 'crear' },
  ];

  filasFiltradas = computed(() =>
    this.filas.filter((f) => {
      if (this.filtroTipo() !== 'todos' && f.tipo_fila !== this.filtroTipo()) return false;
      if (this.filtroEstado() !== 'todos' && f.estado_fila !== this.filtroEstado()) return false;
      return true;
    })
  );

  getEstadoSeverity(estado: string): TagSeverity {
    const map: Record<string, TagSeverity> = {
      ok: 'success',
      duplicado: 'warn',
      error: 'danger',
    };
    return map[estado] ?? 'secondary';
  }

  getCodigo(fila: FilaExtendida): string {
    if (fila.tipo_fila === 'barrio') {
      return fila.ref_barrio ?? (fila.datos_normalizados as { slug?: string })?.slug ?? '—';
    }
    return (fila.datos_normalizados as { codigo?: string })?.codigo ?? '—';
  }

  getNombre(fila: FilaExtendida): string {
    const d = fila.datos_normalizados as Record<string, unknown> | null;
    if (!d) return '—';
    if (fila.tipo_fila === 'barrio') return String(d['nombre'] ?? '—');
    return String(d['codigo'] ?? '—');
  }

  getMensaje(fila: FilaExtendida): string {
    return fila.mensajes?.[0] ?? fila.mensaje ?? '';
  }

  mensajeEsError(fila: FilaExtendida): boolean {
    return fila.estado_fila === 'error';
  }

  showDecisionDropdown(fila: FilaExtendida): boolean {
    return fila.tipo_fila === 'unidad' && fila.estado_fila === 'duplicado' && !fila.aplicada;
  }

  showBarrioDuplicadoChip(fila: FilaExtendida): boolean {
    return fila.tipo_fila === 'barrio' && fila.estado_fila === 'duplicado';
  }

  async cambiarDecision(fila: FilaExtendida, decision: string): Promise<void> {
    try {
      await this.importadorService.actualizarDecision(
        fila.id,
        decision as 'omitir' | 'crear'
      );
      fila.decision_usuario = decision as FilaExtendida['decision_usuario'];
      this.filasChanged.emit();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error al cambiar decisión';
      this.messageService.add({ severity: 'error', summary: 'Error', detail: msg });
    }
  }
}
