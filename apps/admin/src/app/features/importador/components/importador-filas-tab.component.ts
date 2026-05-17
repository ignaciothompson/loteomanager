import { Component, EventEmitter, Input, Output, computed, inject, signal, OnChanges } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ImportacionFilasResponse } from '@loteomanager/shared-types';
import { POCKETBASE } from '@loteomanager/shared-pb-client';
import { MessageService } from 'primeng/api';
import { TableModule } from 'primeng/table';
import { ButtonModule } from 'primeng/button';
import { TagModule } from 'primeng/tag';
import { SelectModule } from 'primeng/select';
import { ToastModule } from 'primeng/toast';
import { TooltipModule } from 'primeng/tooltip';
import PocketBase from 'pocketbase';

export interface FilaExtendida extends ImportacionFilasResponse {
  tipo_fila: 'barrio' | 'unidad';
  mensajes: string[];
  registro_creado_id?: string;
  error_aplicacion?: string;
}

type TagSeverity = 'success' | 'info' | 'warn' | 'danger' | 'secondary' | 'contrast';

// Columns from datos_originales already shown as frozen-left — skip from dynamic cols
const FROZEN_LEFT_KEYS = new Set(['tipo', 'nombre', 'codigo_interno', 'slug']);

@Component({
  selector: 'app-importador-filas-tab',
  standalone: true,
  imports: [FormsModule, TableModule, ButtonModule, TagModule, SelectModule, ToastModule, TooltipModule],
  templateUrl: './importador-filas-tab.component.html',
})
export class ImportadorFilasTabComponent implements OnChanges {
  @Input() filas: FilaExtendida[] = [];
  @Input() importacionId = '';
  @Output() filaClick = new EventEmitter<FilaExtendida>();
  @Output() filasChanged = new EventEmitter<void>();

  private pb = inject(POCKETBASE) as PocketBase;
  private messageService = inject(MessageService);

  filtroEstado = signal<string>('todos');
  mostrarAplicadas = signal(false);

  /** All unique Excel column keys across all filas, excluding frozen-left ones. */
  columnasExtra = signal<string[]>([]);

  ngOnChanges(): void {
    const keys = new Set<string>();
    for (const fila of this.filas) {
      const raw = fila.datos_originales as Record<string, unknown> | null;
      if (raw) {
        for (const k of Object.keys(raw)) {
          if (!FROZEN_LEFT_KEYS.has(k.toLowerCase())) keys.add(k);
        }
      }
    }
    this.columnasExtra.set([...keys]);
  }

  getCellValue(fila: FilaExtendida, col: string): string {
    const raw = fila.datos_originales as Record<string, unknown> | null;
    const val = raw?.[col];
    if (val === null || val === undefined || val === '') return '—';
    return String(val);
  }

  readonly decisionOpciones = [
    { label: 'Pendiente', value: 'pendiente' },
    { label: 'Omitir', value: 'omitir' },
    { label: 'Crear', value: 'crear' },
    { label: 'Actualizar', value: 'actualizar' },
  ];

  readonly filtroOpciones = [
    { label: 'Todos', value: 'todos' },
    { label: 'OK', value: 'ok' },
    { label: 'Duplicados', value: 'duplicado' },
    { label: 'Errores', value: 'error' },
    { label: 'Advertencias', value: 'advertencia' },
  ];

  filasFiltradas = computed(() => {
    const filtro = this.filtroEstado();
    const mostrar = this.mostrarAplicadas();
    return this.filas.filter(f => {
      if (!mostrar && f.aplicada) return false;
      if (filtro === 'todos') return true;
      return f.estado_fila === filtro;
    });
  });

  getEstadoSeverity(estado: string): TagSeverity {
    const map: Record<string, TagSeverity> = {
      ok: 'success',
      duplicado: 'warn',
      error: 'danger',
      advertencia: 'contrast',
    };
    return map[estado] ?? 'secondary';
  }

  getNombre(fila: FilaExtendida): string {
    const d = fila.datos_normalizados as Record<string, unknown> | null;
    if (!d) return '—';
    return String(d['nombre'] ?? d['numero_unidad'] ?? d['codigo_interno'] ?? '—');
  }

  getMensajePrincipal(fila: FilaExtendida): string {
    return fila.mensajes?.[0] ?? fila.mensaje ?? '';
  }

  getMensajesExtra(fila: FilaExtendida): number {
    const total = fila.mensajes?.length ?? 0;
    return total > 1 ? total - 1 : 0;
  }

  async cambiarDecision(fila: FilaExtendida, decision: string): Promise<void> {
    try {
      await this.pb.collection('importacion_filas').update(fila.id, { decision_usuario: decision });
      fila.decision_usuario = decision as ImportacionFilasResponse['decision_usuario'];
      this.filasChanged.emit();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error al cambiar la decisión.';
      this.messageService.add({ severity: 'error', summary: 'Error', detail: msg });
      console.error('[ImportadorFilasTabComponent] cambiarDecision:', err);
    }
  }

  async accionMasiva(tipo: 'omitir_duplicados' | 'aceptar_ok'): Promise<void> {
    const toUpdate = this.filas.filter(f => {
      const isPending = !f.decision_usuario || f.decision_usuario === 'pendiente';
      if (tipo === 'omitir_duplicados') return f.estado_fila === 'duplicado' && isPending;
      return f.estado_fila === 'ok' && isPending;
    });

    if (toUpdate.length === 0) {
      this.messageService.add({ severity: 'info', summary: 'Sin cambios', detail: 'No hay filas que actualizar.' });
      return;
    }

    const nuevaDecision = tipo === 'omitir_duplicados' ? 'omitir' : 'crear';
    try {
      await Promise.all(
        toUpdate.map(f =>
          this.pb.collection('importacion_filas').update(f.id, { decision_usuario: nuevaDecision })
        )
      );
      for (const f of toUpdate) {
        f.decision_usuario = nuevaDecision as ImportacionFilasResponse['decision_usuario'];
      }
      this.filasChanged.emit();
      this.messageService.add({
        severity: 'success',
        summary: 'Listo',
        detail: `${toUpdate.length} filas actualizadas a "${nuevaDecision}".`,
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error al aplicar la acción masiva.';
      this.messageService.add({ severity: 'error', summary: 'Error', detail: msg });
      console.error('[ImportadorFilasTabComponent] accionMasiva:', err);
    }
  }
}
