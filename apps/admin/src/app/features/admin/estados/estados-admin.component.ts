import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  EstadosDefinicionesService,
  DefinicionesCacheService
} from '@loteomanager/shared-pb-client';
import type { EntidadEstado, EstadoDefinicion } from '@loteomanager/shared-types';

import { TableModule } from 'primeng/table';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { InputTextModule } from 'primeng/inputtext';
import { SelectModule } from 'primeng/select';
import { CheckboxModule } from 'primeng/checkbox';
import { ToastModule } from 'primeng/toast';
import { MessageService } from 'primeng/api';

@Component({
  selector: 'app-estados-admin',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    TableModule,
    ButtonModule,
    DialogModule,
    InputTextModule,
    SelectModule,
    CheckboxModule,
    ToastModule
  ],
  providers: [MessageService],
  template: `
    <div class="card">
      <p-toast />
      <div class="flex justify-between items-center mb-4">
        <h5 class="m-0">Estados configurables</h5>
        <button
          pButton
          icon="pi pi-plus"
          label="Nuevo estado"
          class="p-button-success"
          (click)="openNew()"
        ></button>
      </div>

      <p-table [value]="rows()" [rows]="20" [paginator]="true" responsiveLayout="scroll">
        <ng-template pTemplate="header">
          <tr>
            <th>Entidad</th>
            <th>Code</th>
            <th>Nombre</th>
            <th>Core</th>
            <th>Activo</th>
            <th></th>
          </tr>
        </ng-template>
        <ng-template pTemplate="body" let-row>
          <tr>
            <td>{{ row.entidad }}</td>
            <td><code>{{ row.code }}</code></td>
            <td>{{ row.nombre }}</td>
            <td>{{ row.es_core ? 'Sí' : 'No' }}</td>
            <td>{{ row.activo ? 'Sí' : 'No' }}</td>
            <td>
              <button
                pButton
                icon="pi pi-pencil"
                class="p-button-rounded p-button-text mr-1"
                (click)="openEdit(row)"
              ></button>
              @if (!row.es_core) {
                <button
                  pButton
                  icon="pi pi-trash"
                  class="p-button-rounded p-button-danger p-button-text"
                  (click)="tryDelete(row)"
                ></button>
              }
            </td>
          </tr>
        </ng-template>
      </p-table>

      <p-dialog
        [visible]="formVisible()"
        (visibleChange)="formVisible.set($event)"
        [header]="editingId() ? 'Editar estado' : 'Nuevo estado'"
        [modal]="true"
        appendTo="body"
        [contentStyle]="{ overflow: 'visible' }"
        [style]="{ width: '480px' }"
      >
        <ng-template pTemplate="content">
          <div class="flex flex-col gap-3 mt-2">
            <div class="flex flex-col gap-1">
              <label class="font-semibold">Entidad</label>
              <p-select
                [options]="entidadesOpts"
                [(ngModel)]="form.entidad"
                [disabled]="!!editingId()"
                optionLabel="label"
                optionValue="value"
                styleClass="w-full"
                appendTo="body"
              />
            </div>
            <div class="flex flex-col gap-1">
              <label class="font-semibold">Code</label>
              <input pInputText [(ngModel)]="form.code" [disabled]="!!editingId()" class="w-full" />
            </div>
            <div class="flex flex-col gap-1">
              <label class="font-semibold">Nombre</label>
              <input pInputText [(ngModel)]="form.nombre" class="w-full" />
            </div>
            <div class="flex flex-col gap-1">
              <label class="font-semibold">Color (hex)</label>
              <input pInputText [(ngModel)]="form.color" class="w-full" />
            </div>
            <div class="flex flex-col gap-1">
              <label class="font-semibold">Icono PrimeIcons (opcional)</label>
              <input pInputText [(ngModel)]="form.icono" placeholder="pi pi-flag" class="w-full" />
            </div>
            <div class="flex flex-col gap-1">
              <label class="font-semibold">Orden</label>
              <input pInputText type="number" [(ngModel)]="ordenNum" class="w-full" />
            </div>
            <div class="flex gap-2 items-center">
              <p-checkbox [(ngModel)]="form.activo" [binary]="true" inputId="act2" />
              <label for="act2">Activo</label>
            </div>
          </div>
        </ng-template>
        <ng-template pTemplate="footer">
          <button pButton label="Cancelar" class="p-button-text" (click)="formVisible.set(false)"></button>
          <button pButton label="Guardar" (click)="saveForm()" [disabled]="!canSaveForm()"></button>
        </ng-template>
      </p-dialog>

      <p-dialog
        [visible]="replaceVisible()"
        (visibleChange)="replaceVisible.set($event)"
        header="Reemplazar estado antes de borrar"
        [modal]="true"
        appendTo="body"
        [contentStyle]="{ overflow: 'visible' }"
        [style]="{ width: '440px' }"
      >
        <ng-template pTemplate="content">
          <p class="mb-3">
            Hay registros usando este estado. Elegí el estado de reemplazo (misma entidad).
          </p>
          <p-select
            [options]="reemplazoOpts()"
            [(ngModel)]="reemplazoId"
            optionLabel="label"
            optionValue="value"
            placeholder="Estado reemplazo"
            styleClass="w-full"
            appendTo="body"
          />
        </ng-template>
        <ng-template pTemplate="footer">
          <button pButton label="Cancelar" class="p-button-text" (click)="replaceVisible.set(false)"></button>
          <button
            pButton
            label="Reemplazar y borrar"
            [disabled]="!reemplazoId"
            (click)="confirmReplace()"
          ></button>
        </ng-template>
      </p-dialog>
    </div>
  `
})
export class EstadosAdminComponent {
  private svc = inject(EstadosDefinicionesService);
  private cache = inject(DefinicionesCacheService);
  private toast = inject(MessageService);

  rows = this.svc.list();

  formVisible = signal(false);
  replaceVisible = signal(false);
  editingId = signal<string | null>(null);
  deleteTarget = signal<EstadoDefinicion | null>(null);

  entidadesOpts = [
    { label: 'Unidades', value: 'unidades' as EntidadEstado },
    { label: 'Interesados', value: 'interesados' as EntidadEstado }
  ];

  form: Partial<EstadoDefinicion> & { entidad?: EntidadEstado } = {};
  ordenNum = 0;
  reemplazoId: string | null = null;

  openNew() {
    this.editingId.set(null);
    this.form = {
      entidad: 'unidades',
      nombre: '',
      code: '',
      color: '#6366f1',
      icono: '',
      activo: true,
      es_core: false
    };
    this.ordenNum = 0;
    this.formVisible.set(true);
  }

  openEdit(row: EstadoDefinicion) {
    this.editingId.set(row.id);
    this.form = { ...row };
    this.ordenNum = row.orden_display ?? 0;
    this.formVisible.set(true);
  }

  canSaveForm(): boolean {
    return !!(this.form.code?.trim() && this.form.nombre?.trim() && this.form.entidad);
  }

  async saveForm() {
    const code = (this.form.code || '').trim();
    if (!this.editingId() && !/^[a-z][a-z0-9_]*$/.test(code)) {
      this.toast.add({
        severity: 'error',
        summary: 'Code inválido',
        detail: 'snake_case: letra minúscula inicial, luego letras/números/_'
      });
      return;
    }
    const payload: Record<string, unknown> = {
      entidad: this.form.entidad,
      code,
      nombre: (this.form.nombre || '').trim(),
      color: this.form.color || '#6366f1',
      icono: this.form.icono || '',
      orden_display: Number(this.ordenNum) || 0,
      activo: this.form.activo !== false
    };
    try {
      if (this.editingId()) {
        await this.svc.update(this.editingId()!, payload);
        this.toast.add({ severity: 'success', summary: 'Guardado' });
      } else {
        payload['es_core'] = false;
        await this.svc.create(payload);
        this.toast.add({ severity: 'success', summary: 'Creado' });
      }
      this.formVisible.set(false);
      this.rows = this.svc.list();
      await this.cache.refresh();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Error al guardar';
      this.toast.add({ severity: 'error', summary: 'Error', detail: msg });
    }
  }

  async tryDelete(row: EstadoDefinicion) {
    this.deleteTarget.set(row);
    this.reemplazoId = null;
    try {
      await this.svc.delete(row.id);
      this.toast.add({ severity: 'success', summary: 'Eliminado' });
      this.rows = this.svc.list();
      await this.cache.refresh();
    } catch (e: unknown) {
      const any = e as { response?: { message?: string }; message?: string; data?: { message?: string } };
      const msg =
        any.response?.message || any.data?.message || any.message || String(e);
      if (msg.includes('registros') || msg.includes('replace-and-delete')) {
        this.replaceVisible.set(true);
      } else {
        this.toast.add({ severity: 'error', summary: 'No se pudo borrar', detail: msg });
      }
    }
  }

  reemplazoOpts() {
    const t = this.deleteTarget();
    if (!t) return [];
    return this.cache
      .estados()
      .filter((s) => s.entidad === t.entidad && s.id !== t.id && s.activo !== false)
      .map((s) => ({ label: `${s.nombre} (${s.code})${s.es_core ? ' [core]' : ''}`, value: s.id }));
  }

  async confirmReplace() {
    const t = this.deleteTarget();
    const rid = this.reemplazoId;
    if (!t || !rid) return;
    try {
      const res = await this.svc.replaceAndDelete(t.id, rid);
      this.toast.add({
        severity: 'success',
        summary: 'Estado reemplazado',
        detail: `${res.registros_actualizados} registros actualizados`
      });
      this.replaceVisible.set(false);
      this.rows = this.svc.list();
      await this.cache.refresh();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Error';
      this.toast.add({ severity: 'error', summary: 'Error', detail: msg });
    }
  }
}
