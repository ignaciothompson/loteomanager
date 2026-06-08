import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AuthService, POCKETBASE } from '@loteomanager/shared-pb-client';
import {
  BarriosResponse,
  DepartamentosResponse,
  UsersRoleOptions,
  ZonasResponse,
} from '@loteomanager/shared-types';

import { CardModule } from 'primeng/card';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { PasswordModule } from 'primeng/password';
import { ToastModule } from 'primeng/toast';
import { TagModule } from 'primeng/tag';
import { DividerModule } from 'primeng/divider';
import { MessageService } from 'primeng/api';

interface PasswordForm {
  oldPassword: string;
  password: string;
  passwordConfirm: string;
}

@Component({
  selector: 'app-mi-perfil',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    CardModule,
    ButtonModule,
    InputTextModule,
    PasswordModule,
    ToastModule,
    TagModule,
    DividerModule,
  ],
  providers: [MessageService],
  templateUrl: './mi-perfil.component.html',
  styleUrls: ['./mi-perfil.component.css'],
})
export class MiPerfilComponent implements OnInit {
  private authService = inject(AuthService);
  private pb = inject(POCKETBASE);
  private messageService = inject(MessageService);

  readonly user = this.authService.currentUser;

  editName = '';
  editTelefono = '';
  editWhatsapp = '';

  savingDatos = signal(false);
  savingPass = signal(false);
  passError = signal('');

  passForm: PasswordForm = { oldPassword: '', password: '', passwordConfirm: '' };

  barriosAsignados = signal<BarriosResponse[]>([]);
  zonasAsignadas = signal<ZonasResponse[]>([]);
  departamentosAsignados = signal<DepartamentosResponse[]>([]);
  loadingAsignaciones = signal(false);

  ngOnInit(): void {
    const u = this.user();
    if (u) {
      this.editName = (u['name'] as string) ?? '';
      this.editTelefono = (u['telefono'] as string) ?? '';
      this.editWhatsapp = (u['whatsapp'] as string) ?? '';

      const role = u['role'] as UsersRoleOptions;
      if (role === 'vendedor' || role === 'supervisor') {
        void this.loadAsignaciones(u['id'] as string, role);
      }
    }
  }

  roleLabel(role?: string | unknown): string {
    const r = String(role ?? '');
    if (r === 'admin') return 'Admin';
    if (r === 'supervisor') return 'Supervisor';
    return 'Vendedor';
  }

  roleSeverity(role?: string | unknown): 'info' | 'warn' | 'success' {
    const r = String(role ?? '');
    if (r === 'admin') return 'info';
    if (r === 'supervisor') return 'warn';
    return 'success';
  }

  private async loadAsignaciones(userId: string, role: UsersRoleOptions): Promise<void> {
    this.loadingAsignaciones.set(true);
    try {
      if (role === 'supervisor') {
        const recs = await this.pb.collection('supervisor_departamentos').getFullList({
          filter: `user_id="${userId}"`,
          expand: 'departamento_id',
        });
        const deptos = recs
          .map((r) => (r as { expand?: { departamento_id?: DepartamentosResponse } }).expand?.departamento_id)
          .filter((d): d is DepartamentosResponse => !!d);
        this.departamentosAsignados.set(deptos);
        return;
      }

      const [directosRecs, zonasRecs] = await Promise.all([
        this.pb.collection('vendedor_barrios').getFullList({
          filter: `vendedor_id="${userId}"`,
        }),
        this.pb.collection('vendedor_zonas').getFullList({
          filter: `vendedor_id="${userId}"`,
          expand: 'zona_id',
        }),
      ]);

      if (directosRecs.length > 0) {
        const barrioIds = directosRecs.map((r) => `id="${r['barrio_id']}"`).join(' || ');
        const barrios = (await this.pb.collection('barrios').getFullList({
          filter: barrioIds,
          sort: 'nombre',
        })) as BarriosResponse[];
        this.barriosAsignados.set(barrios);
      }

      const zonas = zonasRecs
        .map((r) => (r as { expand?: { zona_id?: ZonasResponse } }).expand?.zona_id)
        .filter((z): z is ZonasResponse => !!z);
      this.zonasAsignadas.set(zonas);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error al cargar asignaciones.';
      this.messageService.add({ severity: 'error', summary: 'Error', detail: msg });
    } finally {
      this.loadingAsignaciones.set(false);
    }
  }

  async saveDatos(): Promise<void> {
    const u = this.user();
    if (!u) return;
    this.savingDatos.set(true);
    try {
      await this.pb.collection('users').update(u['id'] as string, {
        name: this.editName,
        telefono: this.editTelefono,
        whatsapp: this.editWhatsapp,
      });
      this.messageService.add({
        severity: 'success',
        summary: 'Guardado',
        detail: 'Tus datos fueron actualizados correctamente.',
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error al guardar datos.';
      this.messageService.add({ severity: 'error', summary: 'Error', detail: msg });
    } finally {
      this.savingDatos.set(false);
    }
  }

  async changePassword(): Promise<void> {
    this.passError.set('');
    const { oldPassword, password, passwordConfirm } = this.passForm;

    if (password !== passwordConfirm) {
      this.passError.set('Las contraseñas no coinciden.');
      return;
    }
    if (password.length < 8) {
      this.passError.set('La contraseña debe tener al menos 8 caracteres.');
      return;
    }

    const u = this.user();
    if (!u) return;
    this.savingPass.set(true);
    try {
      await this.pb.collection('users').update(u['id'] as string, {
        oldPassword,
        password,
        passwordConfirm,
      });
      this.passForm = { oldPassword: '', password: '', passwordConfirm: '' };
      this.messageService.add({
        severity: 'success',
        summary: 'Éxito',
        detail: 'Contraseña actualizada correctamente.',
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error al cambiar la contraseña.';
      this.messageService.add({ severity: 'error', summary: 'Error', detail: msg });
    } finally {
      this.savingPass.set(false);
    }
  }
}
