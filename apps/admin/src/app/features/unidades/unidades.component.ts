import { Component, OnInit, computed, inject, model, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  UnidadesService,
  BarriosService,
  ArquitectosService,
  AuthService,
  DefinicionesCacheService
} from '@loteomanager/shared-pb-client';
import { UnidadesRecord, UnidadesResponse, BarriosResponse, ExtraPersistido, sanitizeExtrasPayload } from '@loteomanager/shared-types';
import { EstadoBadgeComponent, ExtrasEditorComponent } from '@loteomanager/shared-ui';

import { TableModule } from 'primeng/table';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { InputTextModule } from 'primeng/inputtext';
import { InputNumberModule } from 'primeng/inputnumber';
import { SelectModule } from 'primeng/select';
import { ToastModule } from 'primeng/toast';
import { MessageService } from 'primeng/api';

@Component({
  selector: 'app-unidades',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    TableModule,
    ButtonModule,
    DialogModule,
    InputTextModule,
    InputNumberModule,
    SelectModule,
    ToastModule,
    EstadoBadgeComponent,
    ExtrasEditorComponent
  ],
  providers: [MessageService],
  templateUrl: './unidades.component.html',
  styleUrls: ['./unidades.component.css']
})
export class UnidadesComponent implements OnInit {
  private unidadesService = inject(UnidadesService);
  private barriosService = inject(BarriosService);
  private arquitectosService = inject(ArquitectosService);
  private authService = inject(AuthService);
  private messageService = inject(MessageService);
  definicionesCache = inject(DefinicionesCacheService);

  unidades = this.unidadesService.list();
  barrios = this.barriosService.list();
  arquitectos = this.arquitectosService.list();

  displayDialog = signal(false);
  isEdit = signal(false);
  currentUnidad: Partial<UnidadesRecord> = {};
  currentId = '';

  extrasModel = model<ExtraPersistido[]>([]);

  displayBarrioDialog = signal(false);
  newBarrioName = signal('');

  unidadEstadoOpts = computed(() =>
    this.definicionesCache.estadosActivosPara('unidades').map((s) => ({
      label: s.nombre,
      value: s.code
    }))
  );

  tipos: { label: string; value: string }[] = [
    { label: 'Lote', value: 'lote' },
    { label: 'Casa', value: 'casa' },
    { label: 'Departamento', value: 'departamento' }
  ];

  monedas: { label: string; value: string }[] = [
    { label: 'USD', value: 'USD' },
    { label: 'ARS', value: 'ARS' }
  ];

  ngOnInit() {}

  getBarrioName(id: string): string {
    const barrio = this.barrios().find((b) => b.id === id);
    return barrio ? barrio.nombre : 'Sin Barrio';
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
    this.currentUnidad = {
      tipo_unidad: 'lote',
      moneda: 'USD',
      estado: 'disponible',
      responsable_id: this.authService.currentUser()?.['id'] as string
    };
    this.extrasModel.set([]);
    this.isEdit.set(false);
    this.displayDialog.set(true);
  }

  editUnidad(unidad: UnidadesResponse) {
    this.currentUnidad = { ...unidad };
    this.currentId = unidad.id;
    this.extrasModel.set(this.parseExtras((unidad as { extras?: unknown }).extras));
    this.isEdit.set(true);
    this.displayDialog.set(true);
  }

  async saveUnidad() {
    try {
      const payload = { ...this.currentUnidad, extras: sanitizeExtrasPayload(this.extrasModel()) } as Partial<UnidadesResponse>;
      console.log('[unidades] saveUnidad payload:', JSON.stringify({
        estado: payload.estado,
        tipo_unidad: payload.tipo_unidad,
        moneda: payload.moneda,
        estadoOpts: this.unidadEstadoOpts(),
        cacheEstadosCount: this.definicionesCache.estadosActivosPara('unidades').length
      }));
      if (this.isEdit()) {
        await this.unidadesService.update(this.currentId, payload);
        this.messageService.add({ severity: 'success', summary: 'Éxito', detail: 'Unidad actualizada' });
      } else {
        await this.unidadesService.create(payload);
        this.messageService.add({ severity: 'success', summary: 'Éxito', detail: 'Unidad creada' });
      }
      this.displayDialog.set(false);
      this.unidades = this.unidadesService.list();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error al guardar';
      this.messageService.add({ severity: 'error', summary: 'Error', detail: msg });
    }
  }

  async deleteUnidad(unidad: UnidadesResponse) {
    if (confirm(`¿Estás seguro de eliminar la unidad ${unidad.codigo_interno}?`)) {
      try {
        await this.unidadesService.delete(unidad.id);
        this.messageService.add({ severity: 'success', summary: 'Éxito', detail: 'Unidad eliminada' });
        this.unidades = this.unidadesService.list();
      } catch {
        this.messageService.add({ severity: 'error', summary: 'Error', detail: 'No se pudo eliminar la unidad' });
      }
    }
  }

  async quickCambiarEstado(unidad: UnidadesResponse, nuevoEstado: string) {
    console.log('[unidades] quickCambiarEstado:', unidad.id, 'nuevoEstado:', JSON.stringify(nuevoEstado), 'typeof:', typeof nuevoEstado);
    try {
      await this.unidadesService.cambiarEstado(unidad.id, nuevoEstado);
      this.messageService.add({
        severity: 'success',
        summary: 'Estado actualizado',
        detail: `La unidad ahora está en estado ${nuevoEstado}`
      });
      this.unidades = this.unidadesService.list();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error';
      this.messageService.add({ severity: 'error', summary: 'Acción denegada', detail: msg });
      this.unidades = this.unidadesService.list();
    }
  }

  openNewBarrio() {
    this.newBarrioName.set('');
    this.displayBarrioDialog.set(true);
  }

  async saveNewBarrio() {
    const nombre = this.newBarrioName().trim();
    if (!nombre) return;

    const slug = nombre
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)+/g, '');

    try {
      const response = await this.barriosService.create({
        nombre,
        slug
      });
      this.messageService.add({ severity: 'success', summary: 'Éxito', detail: 'Barrio creado rápidamente' });
      this.barrios = this.barriosService.list();
      this.currentUnidad.barrio_id = response.id;
      this.displayBarrioDialog.set(false);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error al crear barrio';
      this.messageService.add({ severity: 'error', summary: 'Error', detail: msg });
    }
  }
}
