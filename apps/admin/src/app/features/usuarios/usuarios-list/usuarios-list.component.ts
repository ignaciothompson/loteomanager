import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { UsersService, PermisosService, POCKETBASE } from '@loteomanager/shared-pb-client';
import { UsersResponse } from '@loteomanager/shared-types';

import { TableModule } from 'primeng/table';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { ToastModule } from 'primeng/toast';
import { TagModule } from 'primeng/tag';
import { InputTextModule } from 'primeng/inputtext';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { IconFieldModule } from 'primeng/iconfield';
import { InputIconModule } from 'primeng/inputicon';
import { ProgressSpinnerModule } from 'primeng/progressspinner';
import { TooltipModule } from 'primeng/tooltip';
import { MessageService, ConfirmationService } from 'primeng/api';

import { UsuarioFormComponent } from '../usuario-form/usuario-form.component';
import { UsuarioAsignacionesComponent } from '../usuario-asignaciones/usuario-asignaciones.component';
import { PasswordTemporalDialogComponent, PasswordTemporalInfo } from '../components/password-temporal-dialog.component';

@Component({
  selector: 'app-usuarios-list',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    TableModule,
    ButtonModule,
    DialogModule,
    ToastModule,
    TagModule,
    InputTextModule,
    ConfirmDialogModule,
    IconFieldModule,
    InputIconModule,
    ProgressSpinnerModule,
    TooltipModule,
    UsuarioFormComponent,
    UsuarioAsignacionesComponent,
    PasswordTemporalDialogComponent,
  ],
  providers: [MessageService, ConfirmationService],
  templateUrl: './usuarios-list.component.html',
  styleUrls: ['./usuarios-list.component.css'],
})
export class UsuariosListComponent implements OnInit {
  private usersService = inject(UsersService);
  private messageService = inject(MessageService);
  private confirmationService = inject(ConfirmationService);
  private pb = inject(POCKETBASE);

  readonly permisosService = inject(PermisosService);

  usuarios = signal<UsersResponse[]>([]);
  loading = signal(false);
  showFormDialog = signal(false);
  showAsignacionesDialog = signal(false);
  showPasswordDialog = signal(false);
  editingUser = signal<UsersResponse | null>(null);
  asignandoUser = signal<UsersResponse | null>(null);
  passwordDialogInfo = signal<PasswordTemporalInfo | null>(null);

  ngOnInit(): void {
    void this.loadUsuarios();
  }

  async loadUsuarios(): Promise<void> {
    this.loading.set(true);
    try {
      const list = await this.usersService.listAsync();
      this.usuarios.set(list);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error al cargar usuarios.';
      this.messageService.add({ severity: 'error', summary: 'Error', detail: msg });
    } finally {
      this.loading.set(false);
    }
  }

  openNew(): void {
    this.editingUser.set(null);
    this.showFormDialog.set(true);
  }

  editUser(u: UsersResponse): void {
    this.editingUser.set(u);
    this.showFormDialog.set(true);
  }

  onUserCreated(info: PasswordTemporalInfo): void {
    this.passwordDialogInfo.set(info);
    this.showPasswordDialog.set(true);
  }

  onPasswordConfirmed(): void {
    this.showPasswordDialog.set(false);
    this.passwordDialogInfo.set(null);
    void this.loadUsuarios();
  }

  asignarUser(u: UsersResponse): void {
    this.asignandoUser.set(u);
    this.showAsignacionesDialog.set(true);
  }

  toggleActivo(u: UsersResponse): void {
    if (u.activo) {
      this.confirmationService.confirm({
        message: `¿Querés desactivar al usuario "${u.name || u.email}"? No podrá iniciar sesión.`,
        header: 'Confirmar desactivación',
        icon: 'pi pi-exclamation-triangle',
        acceptLabel: 'Sí, desactivar',
        rejectLabel: 'Cancelar',
        accept: () => void this.setActivo(u, false),
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
        detail: `Usuario ${activo ? 'activado' : 'desactivado'} correctamente.`,
      });
      await this.loadUsuarios();
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
        life: 5000,
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error al enviar el email.';
      this.messageService.add({ severity: 'error', summary: 'Error', detail: msg });
    }
  }

  /** ultimo_acceso not yet in generated types */
  getUltimoAcceso(u: UsersResponse): string | null {
    return (u as UsersResponse & { ultimo_acceso?: string }).ultimo_acceso ?? null;
  }
}
