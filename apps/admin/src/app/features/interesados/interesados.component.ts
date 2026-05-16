import { Component, OnInit, computed, inject, model, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { InteresadosService, AuthService, DefinicionesCacheService } from '@loteomanager/shared-pb-client';
import { InteresadosRecord, InteresadosResponse, ExtraPersistido, sanitizeExtrasPayload } from '@loteomanager/shared-types';
import { EstadoBadgeComponent, ExtrasEditorComponent } from '@loteomanager/shared-ui';

import { TableModule } from 'primeng/table';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { InputTextModule } from 'primeng/inputtext';
import { SelectModule } from 'primeng/select';
import { ToastModule } from 'primeng/toast';
import { MessageService } from 'primeng/api';

@Component({
  selector: 'app-interesados',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    TableModule,
    ButtonModule,
    DialogModule,
    InputTextModule,
    SelectModule,
    ToastModule,
    EstadoBadgeComponent,
    ExtrasEditorComponent
  ],
  providers: [MessageService],
  templateUrl: './interesados.component.html',
  styleUrls: ['./interesados.component.css']
})
export class InteresadosComponent implements OnInit {
  private interesadosService = inject(InteresadosService);
  private authService = inject(AuthService);
  private messageService = inject(MessageService);
  private definicionesCache = inject(DefinicionesCacheService);

  interesados = this.interesadosService.list();

  displayDialog = signal(false);
  isEdit = signal(false);
  currentInteresado: Partial<InteresadosRecord> = {};
  currentId = '';

  extrasModel = model<ExtraPersistido[]>([]);

  interesadoEstadoOpts = computed(() =>
    this.definicionesCache.estadosActivosPara('interesados').map((s) => ({
      label: s.nombre,
      value: s.code
    }))
  );

  ngOnInit() {}

  private parseExtras(raw: unknown): ExtraPersistido[] {
    if (!Array.isArray(raw) || raw.length === 0) return [];
    const first = raw[0] as { extra_id?: string };
    if (first && typeof first.extra_id === 'string') {
      return raw as ExtraPersistido[];
    }
    return [];
  }

  openNew() {
    this.currentInteresado = {
      estado: 'nuevo',
      origen: 'manual',
      responsable_id: this.authService.currentUser()?.['id'] as string
    };
    this.extrasModel.set([]);
    this.isEdit.set(false);
    this.displayDialog.set(true);
  }

  editInteresado(interesado: InteresadosResponse) {
    this.currentInteresado = { ...interesado };
    this.currentId = interesado.id;
    this.extrasModel.set(this.parseExtras((interesado as { extras?: unknown }).extras));
    this.isEdit.set(true);
    this.displayDialog.set(true);
  }

  async saveInteresado() {
    try {
      const payload = { ...this.currentInteresado, extras: sanitizeExtrasPayload(this.extrasModel()) } as Partial<InteresadosResponse>;
      if (this.isEdit()) {
        await this.interesadosService.update(this.currentId, payload);
        this.messageService.add({ severity: 'success', summary: 'Éxito', detail: 'Interesado actualizado' });
      } else {
        await this.interesadosService.create(payload);
        this.messageService.add({ severity: 'success', summary: 'Éxito', detail: 'Interesado creado' });
      }
      this.displayDialog.set(false);
      this.interesados = this.interesadosService.list();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error al guardar';
      this.messageService.add({ severity: 'error', summary: 'Error', detail: msg });
    }
  }

  async deleteInteresado(interesado: InteresadosResponse) {
    if (confirm(`¿Estás seguro de eliminar el lead ${interesado.nombre}?`)) {
      try {
        await this.interesadosService.delete(interesado.id);
        this.messageService.add({ severity: 'success', summary: 'Éxito', detail: 'Lead eliminado' });
        this.interesados = this.interesadosService.list();
      } catch {
        this.messageService.add({ severity: 'error', summary: 'Error', detail: 'No se pudo eliminar' });
      }
    }
  }

  async markAsWon(interesado: InteresadosResponse) {
    const unidadId = prompt(
      'Para cerrar como ganado, ingresá el ID de la unidad (en la Fase 4 esto será un modal con buscador):'
    );
    if (unidadId) {
      try {
        await this.interesadosService.cerrarComoGanado(interesado.id, unidadId);
        this.messageService.add({
          severity: 'success',
          summary: 'Cerrado ganado',
          detail: 'Venta registrada exitosamente'
        });
        this.interesados = this.interesadosService.list();
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Error al cerrar venta';
        this.messageService.add({ severity: 'error', summary: 'Error', detail: msg });
      }
    }
  }
}
