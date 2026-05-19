import { Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { UsersService, PermisosService, POCKETBASE } from '@loteomanager/shared-pb-client';
import { UsersResponse } from '@loteomanager/shared-types';
import { TableModule } from 'primeng/table';
import { ButtonModule } from 'primeng/button';
import { ToastModule } from 'primeng/toast';
import { TagModule } from 'primeng/tag';
import { InputTextModule } from 'primeng/inputtext';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { TooltipModule } from 'primeng/tooltip';
import { MessageService, ConfirmationService } from 'primeng/api';
import { UsuarioFormComponent } from '../usuario-form/usuario-form.component';
import { UsuarioAsignacionesComponent } from '../usuario-asignaciones/usuario-asignaciones.component';

@Component({
  selector: 'app-usuarios-list',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    TableModule,
    ButtonModule,
    ToastModule,
    TagModule,
    InputTextModule,
    ConfirmDialogModule,
    TooltipModule,
    UsuarioFormComponent,
    UsuarioAsignacionesComponent
  ],
  providers: [MessageService, ConfirmationService],
  templateUrl: './usuarios-list.component.html',
  styleUrl: './usuarios-list.component.css'
})
export class UsuariosListComponent {
  private usersService = inject(UsersService);
  private messageService = inject(MessageService);
  private confirmationService = inject(ConfirmationService);
  private pb = inject(POCKETBASE);

  readonly permisosService = inject(PermisosService);

  usuarios = this.usersService.list(undefined, { sort: '-created' });

  filterNombre = signal('');
  filterEmail = signal('');

  usuariosFiltrados = computed(() => {
    let rows = this.usuarios();
    const nombre = this.filterNombre().trim().toLowerCase();
    const email = this.filterEmail().trim().toLowerCase();
    if (nombre) rows = rows.filter((u) => (u.name || '').toLowerCase().includes(nombre));
    if (email) rows = rows.filter((u) => u.email.toLowerCase().includes(email));
    return rows;
  });

  hasActiveFilters = computed(
    () => !!this.filterNombre().trim() || !!this.filterEmail().trim()
  );

  showFormDialog = signal(false);
  showAsignacionesDialog = signal(false);
  editingUser = signal<UsersResponse | null>(null);
  asignandoUser = signal<UsersResponse | null>(null);

  clearFilters(): void {
    this.filterNombre.set('');
    this.filterEmail.set('');
  }

  openNew(): void {
    this.editingUser.set(null);
    this.showFormDialog.set(true);
  }

  editUser(u: UsersResponse): void {
    this.editingUser.set(u);
    this.showFormDialog.set(true);
  }

  asignarUser(u: UsersResponse): void {
    this.asignandoUser.set(u);
    this.showAsignacionesDialog.set(true);
  }

  onUsuariosSaved(): void {
    this.usuarios.reload();
  }

  toggleActivo(u: UsersResponse): void {
    if (u.activo) {
      this.confirmationService.confirm({
        message: `¿Querés desactivar al usuario "${u.name || u.email}"? No podrá iniciar sesión.`,
        header: 'Confirmar desactivación',
        icon: 'pi pi-exclamation-triangle',
        acceptLabel: 'Sí, desactivar',
        rejectLabel: 'Cancelar',
        accept: () => void this.setActivo(u, false)
      });
    } else {
      void this.setActivo(u, true);
    }
  }

  private async setActivo(u: UsersResponse, activo: boolean): Promise<void> {
    try {
      await this.pb.collection('users').update(u.id, { activo });
      this.messageService.add({
        severity: 'success',
        summary: 'Éxito',
        detail: `Usuario ${activo ? 'activado' : 'desactivado'} correctamente.`
      });
      this.usuarios.reload();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error al actualizar el usuario.';
      this.messageService.add({ severity: 'error', summary: 'Error', detail: msg });
    }
  }

  async resetPassword(u: UsersResponse): Promise<void> {
    try {
      await this.pb.collection('users').requestPasswordReset(u.email);
      this.messageService.add({
        severity: 'success',
        summary: 'Email enviado',
        detail: `Se envió el email de reseteo de contraseña a ${u.email}.`,
        life: 5000
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error al enviar el email.';
      this.messageService.add({ severity: 'error', summary: 'Error', detail: msg });
    }
  }

  getUltimoAcceso(u: UsersResponse): string | null {
    return (u as UsersResponse & { ultimo_acceso?: string }).ultimo_acceso ?? null;
  }
}
