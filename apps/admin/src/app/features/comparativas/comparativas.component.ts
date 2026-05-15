import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ComparativasService, InteresadosService, UnidadesService, AuthService } from '@loteomanager/shared-pb-client';
import { ComparativasRecord, ComparativasResponse, UnidadesResponse } from '@loteomanager/shared-types';

import { TableModule } from 'primeng/table';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { InputTextModule } from 'primeng/inputtext';
import { SelectModule } from 'primeng/select';
import { MultiSelectModule } from 'primeng/multiselect';
import { ToastModule } from 'primeng/toast';
import { MessageService } from 'primeng/api';
import { TextareaModule } from 'primeng/textarea';

@Component({
  selector: 'app-comparativas',
  standalone: true,
  imports: [
    CommonModule, 
    FormsModule, 
    TableModule, 
    ButtonModule, 
    DialogModule, 
    InputTextModule,
    SelectModule,
    MultiSelectModule,
    ToastModule,
    TextareaModule
  ],
  providers: [MessageService],
  templateUrl: './comparativas.component.html',
  styleUrls: ['./comparativas.component.css']
})
export class ComparativasComponent implements OnInit {
  private comparativasService = inject(ComparativasService);
  private interesadosService = inject(InteresadosService);
  private unidadesService = inject(UnidadesService);
  private authService = inject(AuthService);
  private messageService = inject(MessageService);

  comparativas = this.comparativasService.list();
  interesados = this.interesadosService.list();
  unidades = this.unidadesService.list();
  
  displayDialog = signal(false);
  currentComparativa: Partial<ComparativasRecord> = {};

  unidadesDisponibles = computed(() => {
    return this.unidades().filter(u => u.estado === 'disponible');
  });

  ngOnInit() {
  }

  getInteresadoName(id: string): string {
    const int = this.interesados().find(i => i.id === id);
    return int ? int.nombre : 'Sin Interesado';
  }

  selectedInteresadoId = '';

  openNew() {
    this.currentComparativa = {
      creado_por: this.authService.currentUser()?.['id'] as string,
      tipo: 'comparacion_multiple',
      unidades_ids: [],
      titulo: 'Comparativa de Lotes'
    };
    this.selectedInteresadoId = '';
    this.displayDialog.set(true);
  }

  async saveComparativa() {
    try {
      if (this.selectedInteresadoId) {
        const int = this.interesados().find(i => i.id === this.selectedInteresadoId);
        if (int) {
          this.currentComparativa.cliente_destinatario_nombre = int.nombre;
          this.currentComparativa.cliente_destinatario_email = int.email;
        }
      }

      this.currentComparativa.token_publico = Math.random().toString(36).substring(2, 15);

      const response = await this.comparativasService.crear(this.currentComparativa as Omit<ComparativasRecord, "id">);
      
      if (this.selectedInteresadoId) {
        await this.interesadosService.update(this.selectedInteresadoId, { comparativa_id: response.record.id });
      }

      this.messageService.add({ severity: 'success', summary: 'Éxito', detail: 'Comparativa generada' });
      this.displayDialog.set(false);
      this.comparativas = this.comparativasService.list();

      alert(`Comparativa lista. URL Pública:\n${response.url}`);
      
    } catch (err: any) {
      this.messageService.add({ severity: 'error', summary: 'Error', detail: err.message || 'Error al generar' });
    }
  }

  async deleteComparativa(comp: ComparativasResponse) {
    if (confirm(`¿Estás seguro de eliminar este enlace comparativo?`)) {
      try {
        await this.comparativasService.delete(comp.id);
        this.messageService.add({ severity: 'success', summary: 'Éxito', detail: 'Comparativa eliminada' });
        this.comparativas = this.comparativasService.list();
      } catch (err: any) {
        this.messageService.add({ severity: 'error', summary: 'Error', detail: 'No se pudo eliminar' });
      }
    }
  }

  copyLink(token: string) {
    navigator.clipboard.writeText(this.publicUrl(token)).then(() => {
      this.messageService.add({ severity: 'info', summary: 'Copiado', detail: 'Enlace copiado al portapapeles' });
    });
  }

  publicUrl(token: string): string {
    const baseUrl = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:4200';
    return `${baseUrl}/c/${token}`;
  }
}
