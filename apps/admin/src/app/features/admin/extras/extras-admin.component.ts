import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  ExtrasDefinicionesService,
  DefinicionesCacheService
} from '@loteomanager/shared-pb-client';
import type { EntidadExtra, ExtrasDefinicion, ExtraTipo } from '@loteomanager/shared-types';

import { TableModule } from 'primeng/table';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { InputTextModule } from 'primeng/inputtext';
import { SelectModule } from 'primeng/select';
import { CheckboxModule } from 'primeng/checkbox';
import { ToastModule } from 'primeng/toast';
import { MessageService } from 'primeng/api';

@Component({
  selector: 'app-extras-admin',
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
        <h5 class="m-0">Definición de extras</h5>
        <button
          pButton
          icon="pi pi-plus"
          label="Nuevo extra"
          class="p-button-success"
          (click)="openNew()"
        ></button>
      </div>

      <p-table [value]="rows()" [rows]="15" [paginator]="true" responsiveLayout="scroll">
        <ng-template pTemplate="header">
          <tr>
            <th>Entidad</th>
            <th>Code</th>
            <th>Nombre</th>
            <th>Tipo</th>
            <th>Activo</th>
            <th></th>
          </tr>
        </ng-template>
        <ng-template pTemplate="body" let-row>
          <tr>
            <td>{{ row.entidad }}</td>
            <td><code>{{ row.code }}</code></td>
            <td>{{ row.nombre }}</td>
            <td>{{ row.tipo }}</td>
            <td>{{ row.activo ? 'Sí' : 'No' }}</td>
            <td>
              <button
                pButton
                icon="pi pi-pencil"
                class="p-button-rounded p-button-text"
                (click)="openEdit(row)"
              ></button>
            </td>
          </tr>
        </ng-template>
      </p-table>

      <p-dialog
        [visible]="dialogVisible()"
        (visibleChange)="dialogVisible.set($event)"
        [header]="editingId() ? 'Editar extra' : 'Nuevo extra'"
        [modal]="true"
        appendTo="body"
        [contentStyle]="{ overflow: 'visible' }"
        [style]="{ width: '520px' }"
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
              <label class="font-semibold">Code (snake_case, inmutable)</label>
              <input pInputText [(ngModel)]="form.code" [disabled]="!!editingId()" class="w-full" />
            </div>
            <div class="flex flex-col gap-1">
              <label class="font-semibold">Nombre visible</label>
              <input pInputText [(ngModel)]="form.nombre" class="w-full" />
            </div>
            <div class="flex flex-col gap-1">
              <label class="font-semibold">Descripción</label>
              <input pInputText [(ngModel)]="form.descripcion" class="w-full" />
            </div>
            <div class="flex flex-col gap-1">
              <label class="font-semibold">Tipo</label>
              <p-select [options]="tiposOpts" [(ngModel)]="form.tipo" optionLabel="label" optionValue="value" styleClass="w-full" appendTo="body" />
            </div>
            @if (form.tipo === 'opciones') {
              <div class="flex flex-col gap-1">
                <label class="font-semibold">Opciones (coma separadas)</label>
                <input pInputText [(ngModel)]="opcionesTexto" class="w-full" />
              </div>
            }
            <div class="flex flex-col gap-1">
              <label class="font-semibold">Grupo (opcional)</label>
              <input pInputText [(ngModel)]="form.grupo" class="w-full" />
            </div>
            <div class="flex flex-wrap gap-4">
              <p-checkbox [(ngModel)]="form.requerido" [binary]="true" inputId="req" />
              <label for="req">Requerido</label>
              <p-checkbox [(ngModel)]="form.visible_en_lista" [binary]="true" inputId="vl" />
              <label for="vl">Visible en lista</label>
              <p-checkbox [(ngModel)]="form.visible_en_comparativa" [binary]="true" inputId="vc" />
              <label for="vc">Visible en comparativa</label>
            </div>
            <div class="flex gap-2 items-center">
              <p-checkbox [(ngModel)]="form.activo" [binary]="true" inputId="act" />
              <label for="act">Activo</label>
            </div>
          </div>
        </ng-template>
        <ng-template pTemplate="footer">
          <button pButton label="Cancelar" class="p-button-text" (click)="dialogVisible.set(false)"></button>
          <button pButton label="Guardar" (click)="save()" [disabled]="!canSave()"></button>
        </ng-template>
      </p-dialog>
    </div>
  `
})
export class ExtrasAdminComponent {
  private svc = inject(ExtrasDefinicionesService);
  private cache = inject(DefinicionesCacheService);
  private toast = inject(MessageService);

  rows = this.svc.list();

  dialogVisible = signal(false);
  editingId = signal<string | null>(null);

  entidadesOpts = [
    { label: 'Barrios', value: 'barrios' as EntidadExtra },
    { label: 'Unidades', value: 'unidades' as EntidadExtra },
    { label: 'Interesados', value: 'interesados' as EntidadExtra }
  ];

  tiposOpts: { label: string; value: ExtraTipo }[] = [
    { label: 'Texto', value: 'texto' },
    { label: 'Número', value: 'numero' },
    { label: 'Opciones', value: 'opciones' },
    { label: 'Booleano', value: 'booleano' },
    { label: 'Fecha', value: 'fecha' }
  ];

  form: Partial<ExtrasDefinicion> & { entidad?: EntidadExtra; tipo?: ExtraTipo } = {};
  opcionesTexto = '';

  openNew() {
    this.editingId.set(null);
    this.form = {
      entidad: 'barrios',
      tipo: 'texto',
      requerido: false,
      visible_en_lista: false,
      visible_en_landing: false,
      visible_en_comparativa: false,
      activo: true,
      orden_display: 0
    };
    this.opcionesTexto = '';
    this.dialogVisible.set(true);
  }

  openEdit(row: ExtrasDefinicion) {
    this.editingId.set(row.id);
    this.form = { ...row };
    const o = row.opciones;
    this.opcionesTexto = Array.isArray(o) ? (o as string[]).join(', ') : '';
    this.dialogVisible.set(true);
  }

  canSave(): boolean {
    return !!(this.form.code?.trim() && this.form.nombre?.trim() && this.form.entidad && this.form.tipo);
  }

  async save() {
    const code = (this.form.code || '').trim();
    if (!/^[a-z][a-z0-9_]*$/.test(code)) {
      this.toast.add({
        severity: 'error',
        summary: 'Code inválido',
        detail: 'Usá snake_case: empieza con letra y solo minúsculas, números o _.'
      });
      return;
    }
    const payload: Record<string, unknown> = {
      code,
      entidad: this.form.entidad,
      nombre: (this.form.nombre || '').trim(),
      descripcion: this.form.descripcion || '',
      tipo: this.form.tipo,
      requerido: !!this.form.requerido,
      visible_en_lista: !!this.form.visible_en_lista,
      visible_en_landing: !!this.form.visible_en_landing,
      visible_en_comparativa: !!this.form.visible_en_comparativa,
      orden_display: this.form.orden_display ?? 0,
      grupo: this.form.grupo || '',
      activo: this.form.activo !== false
    };
    if (this.form.tipo === 'opciones') {
      payload['opciones'] = this.opcionesTexto
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
    } else {
      payload['opciones'] = null;
    }
    try {
      if (this.editingId()) {
        await this.svc.update(this.editingId()!, payload);
        this.toast.add({ severity: 'success', summary: 'Guardado' });
      } else {
        await this.svc.create(payload);
        this.toast.add({ severity: 'success', summary: 'Creado' });
      }
      this.dialogVisible.set(false);
      this.rows = this.svc.list();
      await this.cache.refresh();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Error al guardar';
      this.toast.add({ severity: 'error', summary: 'Error', detail: msg });
    }
  }
}
