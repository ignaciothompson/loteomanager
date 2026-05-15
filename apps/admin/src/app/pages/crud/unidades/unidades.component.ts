import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { UnidadesService, BarriosService, ArquitectosService, AuthService } from '@loteomanager/shared-pb-client';
import { UnidadesRecord, UnidadesResponse, UnidadesEstadoOptions, BarriosResponse, ArquitectosResponse } from '@loteomanager/shared-types';

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
    ToastModule
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

  unidades = this.unidadesService.list();
  barrios = this.barriosService.list();
  arquitectos = this.arquitectosService.list();
  
  displayDialog = signal(false);
  isEdit = signal(false);
  currentUnidad: Partial<UnidadesRecord> = {};
  currentId = '';

  // Quick Barrio creation state
  displayBarrioDialog = signal(false);
  newBarrioName = signal('');

  estados: { label: string, value: UnidadesEstadoOptions }[] = [
    { label: 'Disponible', value: 'disponible' },
    { label: 'Bloqueado', value: 'bloqueado' },
    { label: 'Reservado', value: 'reservado' },
    { label: 'Seña', value: 'sena' },
    { label: 'Vendido', value: 'vendido' },
    { label: 'Escriturado', value: 'escriturado' }
  ];

  tipos: { label: string, value: string }[] = [
    { label: 'Lote', value: 'lote' },
    { label: 'Casa', value: 'casa' },
    { label: 'Departamento', value: 'departamento' }
  ];

  monedas: { label: string, value: string }[] = [
    { label: 'USD', value: 'USD' },
    { label: 'ARS', value: 'ARS' }
  ];

  ngOnInit() {
  }

  getBarrioName(id: string): string {
    const barrio = this.barrios().find(b => b.id === id);
    return barrio ? barrio.nombre : 'Sin Barrio';
  }

  openNew() {
    this.currentUnidad = {
      tipo_unidad: 'lote',
      moneda: 'USD',
      estado: 'disponible',
      responsable_id: this.authService.currentUser()?.['id'] as string
    };
    this.isEdit.set(false);
    this.displayDialog.set(true);
  }

  editUnidad(unidad: UnidadesResponse) {
    this.currentUnidad = { ...unidad };
    this.currentId = unidad.id;
    this.isEdit.set(true);
    this.displayDialog.set(true);
  }

  async saveUnidad() {
    try {
      if (this.isEdit()) {
        await this.unidadesService.update(this.currentId, this.currentUnidad);
        this.messageService.add({ severity: 'success', summary: 'Éxito', detail: 'Unidad actualizada' });
      } else {
        await this.unidadesService.create(this.currentUnidad);
        this.messageService.add({ severity: 'success', summary: 'Éxito', detail: 'Unidad creada' });
      }
      this.displayDialog.set(false);
      this.unidades = this.unidadesService.list();
    } catch (err: any) {
      this.messageService.add({ severity: 'error', summary: 'Error', detail: err.message || 'Error al guardar' });
    }
  }

  async deleteUnidad(unidad: UnidadesResponse) {
    if (confirm(`¿Estás seguro de eliminar la unidad ${unidad.codigo_interno}?`)) {
      try {
        await this.unidadesService.delete(unidad.id);
        this.messageService.add({ severity: 'success', summary: 'Éxito', detail: 'Unidad eliminada' });
        this.unidades = this.unidadesService.list();
      } catch (err: any) {
        this.messageService.add({ severity: 'error', summary: 'Error', detail: 'No se pudo eliminar la unidad' });
      }
    }
  }

  async quickCambiarEstado(unidad: UnidadesResponse, nuevoEstado: UnidadesEstadoOptions) {
    try {
      await this.unidadesService.cambiarEstado(unidad.id, nuevoEstado);
      this.messageService.add({ severity: 'success', summary: 'Estado actualizado', detail: `La unidad ahora está en estado ${nuevoEstado}` });
      this.unidades = this.unidadesService.list();
    } catch (err: any) {
      this.messageService.add({ severity: 'error', summary: 'Acción Denegada', detail: err.message });
      // reload to revert local changes if any
      this.unidades = this.unidadesService.list();
    }
  }

  // Quick Barrio Creation
  openNewBarrio() {
    this.newBarrioName.set('');
    this.displayBarrioDialog.set(true);
  }

  async saveNewBarrio() {
    const nombre = this.newBarrioName().trim();
    if (!nombre) return;
    
    // Auto-generate a simple slug
    const slug = nombre.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '');
    
    try {
      const response = await this.barriosService.create({ 
        nombre, 
        slug 
      });
      this.messageService.add({ severity: 'success', summary: 'Éxito', detail: 'Barrio creado rápidamente' });
      this.barrios = this.barriosService.list(); // reload list
      this.currentUnidad.barrio_id = response.id; // auto-select
      this.displayBarrioDialog.set(false);
    } catch (err: any) {
      this.messageService.add({ severity: 'error', summary: 'Error', detail: err.message || 'Error al crear barrio' });
    }
  }
}
