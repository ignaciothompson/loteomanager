import { Component, computed, inject, signal, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { MultiSelectModule } from 'primeng/multiselect';
import { ToastModule } from 'primeng/toast';
import { MessageService } from 'primeng/api';
import type { BarriosResponse } from '@loteomanager/shared-types';
import { ExportadorService } from './services/exportador.service';

@Component({
  selector: 'app-exportador-page',
  standalone: true,
  imports: [FormsModule, ButtonModule, MultiSelectModule, ToastModule],
  providers: [MessageService],
  templateUrl: './exportador-page.component.html',
})
export class ExportadorPageComponent implements OnInit {
  private exportadorSvc = inject(ExportadorService);
  private messages = inject(MessageService);

  readonly loading = signal(false);
  readonly exporting = signal(false);
  readonly barrios = signal<BarriosResponse[]>([]);
  readonly barrioIdsSeleccionados = signal<string[]>([]);

  readonly barrioOpts = computed(() =>
    this.barrios().map((b) => ({ label: b.nombre, value: b.id })),
  );

  ngOnInit(): void {
    void this.load();
  }

  async load(): Promise<void> {
    this.loading.set(true);
    try {
      const rows = await this.exportadorSvc.listarBarriosAccesibles();
      rows.sort((a, b) => a.nombre.localeCompare(b.nombre));
      this.barrios.set(rows);
      this.barrioIdsSeleccionados.set(rows.map((b) => b.id));
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error al cargar barrios';
      this.messages.add({ severity: 'error', summary: 'Error', detail: msg });
    } finally {
      this.loading.set(false);
    }
  }

  seleccionarTodos(): void {
    this.barrioIdsSeleccionados.set(this.barrios().map((b) => b.id));
  }

  limpiarSeleccion(): void {
    this.barrioIdsSeleccionados.set([]);
  }

  async exportar(): Promise<void> {
    const ids = this.barrioIdsSeleccionados();
    if (!ids.length) {
      this.messages.add({
        severity: 'warn',
        summary: 'Atención',
        detail: 'Seleccioná al menos un barrio para exportar.',
      });
      return;
    }
    this.exporting.set(true);
    try {
      await this.exportadorSvc.exportarExcel(ids);
      this.messages.add({
        severity: 'success',
        summary: 'Exportado',
        detail: 'El archivo Excel se descargó correctamente.',
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error al exportar';
      this.messages.add({ severity: 'error', summary: 'Error', detail: msg });
    } finally {
      this.exporting.set(false);
    }
  }
}
