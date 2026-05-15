import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { BarriosService } from '@loteomanager/shared-pb-client';
import { BarriosRecord, BarriosResponse } from '@loteomanager/shared-types';

import { TableModule } from 'primeng/table';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { InputTextModule } from 'primeng/inputtext';
import { SelectModule } from 'primeng/select';
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
    SelectModule
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

  amenityOptions = [
    { label: 'Incluida', value: 'incluida' },
    { label: 'Socios', value: 'socios' },
    { label: 'No', value: 'no' }
  ];
  currentExtras: { nombre: string, estado: string }[] = [];

  ngOnInit() {
    // Service handles loading via signal
  }

  openNew() {
    this.currentBarrio = {};
    this.currentExtras = [];
    this.isEdit.set(false);
    this.displayDialog.set(true);
  }

  editBarrio(barrio: BarriosResponse) {
    this.currentBarrio = { ...barrio };
    this.currentId = barrio.id;
    this.currentExtras = Array.isArray(barrio.extras) ? [...barrio.extras] : [];
    this.isEdit.set(true);
    this.displayDialog.set(true);
  }

  addExtra() {
    this.currentExtras.push({ nombre: '', estado: 'incluida' });
  }

  removeExtra(index: number) {
    this.currentExtras.splice(index, 1);
  }

  async saveBarrio() {
    try {
      this.currentBarrio.extras = this.currentExtras as any; // Cast as json expects any

      if (this.isEdit()) {
        await this.barriosService.update(this.currentId, this.currentBarrio);
        this.messageService.add({ severity: 'success', summary: 'Éxito', detail: 'Barrio actualizado' });
      } else {
        await this.barriosService.create(this.currentBarrio);
        this.messageService.add({ severity: 'success', summary: 'Éxito', detail: 'Barrio creado' });
      }
      this.displayDialog.set(false);
      // Reload list
      this.barrios = this.barriosService.list();
    } catch (err: any) {
      this.messageService.add({ severity: 'error', summary: 'Error', detail: err.message || 'Error al guardar' });
    }
  }

  async deleteBarrio(barrio: BarriosResponse) {
    if (confirm(`¿Estás seguro de eliminar el barrio ${barrio.nombre}?`)) {
      try {
        await this.barriosService.delete(barrio.id);
        this.messageService.add({ severity: 'success', summary: 'Éxito', detail: 'Barrio eliminado' });
        this.barrios = this.barriosService.list();
      } catch (err: any) {
        this.messageService.add({ severity: 'error', summary: 'Error', detail: 'No se pudo eliminar el barrio' });
      }
    }
  }
}
