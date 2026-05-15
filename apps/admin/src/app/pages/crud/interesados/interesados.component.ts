import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { InteresadosService, UnidadesService, BarriosService, AuthService } from '@loteomanager/shared-pb-client';
import { InteresadosRecord, InteresadosResponse, UnidadesResponse, BarriosResponse } from '@loteomanager/shared-types';

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
    ToastModule
  ],
  providers: [MessageService],
  templateUrl: './interesados.component.html',
  styleUrls: ['./interesados.component.css']
})
export class InteresadosComponent implements OnInit {
  private interesadosService = inject(InteresadosService);
  private authService = inject(AuthService);
  private messageService = inject(MessageService);

  interesados = this.interesadosService.list();
  
  displayDialog = signal(false);
  isEdit = signal(false);
  currentInteresado: Partial<InteresadosRecord> = {};
  currentId = '';

  estados: { label: string, value: string }[] = [
    { label: 'Nuevo', value: 'nuevo' },
    { label: 'Contactado', value: 'contactado' },
    { label: 'Cerrado/Perdido', value: 'cerrado_perdido' },
    { label: 'Cerrado/Ganado', value: 'cerrado_ganado' }
  ];

  ngOnInit() {
  }

  openNew() {
    this.currentInteresado = {
      estado: 'nuevo',
      origen: 'manual',
      responsable_id: this.authService.currentUser()?.['id'] as string
    };
    this.isEdit.set(false);
    this.displayDialog.set(true);
  }

  editInteresado(interesado: InteresadosResponse) {
    this.currentInteresado = { ...interesado };
    this.currentId = interesado.id;
    this.isEdit.set(true);
    this.displayDialog.set(true);
  }

  async saveInteresado() {
    try {
      if (this.isEdit()) {
        await this.interesadosService.update(this.currentId, this.currentInteresado);
        this.messageService.add({ severity: 'success', summary: 'Éxito', detail: 'Interesado actualizado' });
      } else {
        await this.interesadosService.create(this.currentInteresado);
        this.messageService.add({ severity: 'success', summary: 'Éxito', detail: 'Interesado creado' });
      }
      this.displayDialog.set(false);
      this.interesados = this.interesadosService.list();
    } catch (err: any) {
      this.messageService.add({ severity: 'error', summary: 'Error', detail: err.message || 'Error al guardar' });
    }
  }

  async deleteInteresado(interesado: InteresadosResponse) {
    if (confirm(`¿Estás seguro de eliminar el lead ${interesado.nombre}?`)) {
      try {
        await this.interesadosService.delete(interesado.id);
        this.messageService.add({ severity: 'success', summary: 'Éxito', detail: 'Lead eliminado' });
        this.interesados = this.interesadosService.list();
      } catch (err: any) {
        this.messageService.add({ severity: 'error', summary: 'Error', detail: 'No se pudo eliminar' });
      }
    }
  }

  async markAsWon(interesado: InteresadosResponse) {
    const unidadId = prompt('Para cerrar como ganado, ingresá el ID de la unidad (en la Fase 4 esto será un modal con buscador):');
    if (unidadId) {
      try {
        await this.interesadosService.cerrarComoGanado(interesado.id, unidadId);
        this.messageService.add({ severity: 'success', summary: 'Cerrado Ganado', detail: 'Venta registrada exitosamente' });
        this.interesados = this.interesadosService.list();
      } catch (err: any) {
        this.messageService.add({ severity: 'error', summary: 'Error', detail: err.message || 'Error al cerrar venta' });
      }
    }
  }
}
