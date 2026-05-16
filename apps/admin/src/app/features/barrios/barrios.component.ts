import { Component, OnInit, inject, model, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { BarriosService } from '@loteomanager/shared-pb-client';
import { BarriosRecord, BarriosResponse, ExtraPersistido, sanitizeExtrasPayload } from '@loteomanager/shared-types';
import { ExtrasEditorComponent } from '@loteomanager/shared-ui';

import { TableModule } from 'primeng/table';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { InputTextModule } from 'primeng/inputtext';
import { ToastModule } from 'primeng/toast';
import { MessageService } from 'primeng/api';

@Component({
  selector: 'app-barrios',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    TableModule,
    ButtonModule,
    DialogModule,
    InputTextModule,
    ToastModule,
    ExtrasEditorComponent
  ],
  providers: [MessageService],
  templateUrl: './barrios.component.html',
  styleUrls: ['./barrios.component.css']
})
export class BarriosComponent implements OnInit {
  private barriosService = inject(BarriosService);
  private messageService = inject(MessageService);

  barrios = this.barriosService.list();

  displayDialog = signal(false);
  isEdit = signal(false);
  currentBarrio: Partial<BarriosRecord> = {};
  currentId = '';

  extrasModel = model<ExtraPersistido[]>([]);

  ngOnInit() {
    // Service handles loading via signal
  }

  private parseExtras(raw: unknown): ExtraPersistido[] {
    if (!Array.isArray(raw) || raw.length === 0) return [];
    const first = raw[0] as { extra_id?: string };
    if (first && typeof first.extra_id === 'string') {
      return raw as ExtraPersistido[];
    }
    return [];
  }

  openNew() {
    this.currentBarrio = {};
    this.currentId = '';
    this.extrasModel.set([]);
    this.isEdit.set(false);
    this.displayDialog.set(true);
  }

  editBarrio(barrio: BarriosResponse) {
    this.currentBarrio = { ...barrio };
    this.currentId = barrio.id;
    this.extrasModel.set(this.parseExtras(barrio.extras));
    this.isEdit.set(true);
    this.displayDialog.set(true);
  }

  async saveBarrio() {
    try {
      this.currentBarrio.extras = sanitizeExtrasPayload(this.extrasModel()) as unknown as BarriosRecord['extras'];

      if (this.isEdit()) {
        await this.barriosService.update(this.currentId, this.currentBarrio);
        this.messageService.add({ severity: 'success', summary: 'Éxito', detail: 'Barrio actualizado' });
      } else {
        await this.barriosService.create(this.currentBarrio);
        this.messageService.add({ severity: 'success', summary: 'Éxito', detail: 'Barrio creado' });
      }
      this.displayDialog.set(false);
      this.barrios = this.barriosService.list();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error al guardar';
      this.messageService.add({ severity: 'error', summary: 'Error', detail: msg });
    }
  }

  async deleteBarrio(barrio: BarriosResponse) {
    if (confirm(`¿Estás seguro de eliminar el barrio ${barrio.nombre}?`)) {
      try {
        await this.barriosService.delete(barrio.id);
        this.messageService.add({ severity: 'success', summary: 'Éxito', detail: 'Barrio eliminado' });
        this.barrios = this.barriosService.list();
      } catch {
        this.messageService.add({ severity: 'error', summary: 'Error', detail: 'No se pudo eliminar el barrio' });
      }
    }
  }
}
