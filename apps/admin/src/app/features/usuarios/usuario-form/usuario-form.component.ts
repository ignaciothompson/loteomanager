import { Component, EventEmitter, Input, OnChanges, Output, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { POCKETBASE } from '@loteomanager/shared-pb-client';
import { UsersResponse, UsersRoleOptions, UsersLeadsVisibilityOptions } from '@loteomanager/shared-types';

import { DialogModule } from 'primeng/dialog';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { SelectModule } from 'primeng/select';
import { ToggleSwitchModule } from 'primeng/toggleswitch';
import { ToastModule } from 'primeng/toast';
import { MessageService } from 'primeng/api';
import { PasswordTemporalInfo } from '../components/password-temporal-dialog.component';

interface UserFormModel {
  name: string;
  email: string;
  role: UsersRoleOptions;
  telefono: string;
  whatsapp: string;
  leads_visibility: UsersLeadsVisibilityOptions | '';
  activo: boolean;
}

@Component({
  selector: 'app-usuario-form',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    DialogModule,
    ButtonModule,
    InputTextModule,
    SelectModule,
    ToggleSwitchModule,
    ToastModule,
  ],
  providers: [MessageService],
  templateUrl: './usuario-form.component.html',
  styleUrls: ['./usuario-form.component.css'],
})
export class UsuarioFormComponent implements OnChanges {
  @Input() visible = false;
  @Output() visibleChange = new EventEmitter<boolean>();
  @Input() user: UsersResponse | null = null;
  @Output() saved = new EventEmitter<void>();
  @Output() userCreatedWithPassword = new EventEmitter<PasswordTemporalInfo>();

  private pb = inject(POCKETBASE);
  private messageService = inject(MessageService);

  saving = signal(false);

  form: UserFormModel = this.emptyForm();

  readonly roleOptions = [
    { label: 'Admin', value: 'admin' },
    { label: 'Vendedor', value: 'vendedor' },
  ];

  readonly leadsVisibilityOptions = [
    { label: 'Solo míos', value: 'solo_mios' },
    { label: 'Míos + sin asignar', value: 'mios_mas_sin_asignar' },
    { label: 'Todos mis barrios', value: 'todos_mis_barrios' },
    { label: 'Todos', value: 'todos' },
  ];

  ngOnChanges(): void {
    if (this.visible) {
      this.form = this.user ? this.fromUser(this.user) : this.emptyForm();
    }
  }

  private emptyForm(): UserFormModel {
    return {
      name: '',
      email: '',
      role: 'vendedor',
      telefono: '',
      whatsapp: '',
      leads_visibility: 'solo_mios',
      activo: true,
    };
  }

  private fromUser(u: UsersResponse): UserFormModel {
    return {
      name: u.name ?? '',
      email: u.email,
      role: u.role,
      telefono: u.telefono ?? '',
      whatsapp: u.whatsapp ?? '',
      leads_visibility: u.leads_visibility ?? '',
      activo: u.activo ?? true,
    };
  }

  private generarPasswordTemporal(nombre: string): string | null {
    const primerNombre = nombre
      .trim()
      .split(' ')[0]
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]/g, '');

    if (primerNombre.length < 4) {
      return null;
    }

    return `${primerNombre}1234`;
  }

  async save(): Promise<void> {
    if (!this.form.name || !this.form.email || !this.form.role) return;
    this.saving.set(true);
    try {
      if (this.user) {
        const payload: Record<string, unknown> = {
          name: this.form.name,
          role: this.form.role,
          telefono: this.form.telefono,
          whatsapp: this.form.whatsapp,
          activo: this.form.activo,
        };
        if (this.form.role === 'vendedor') {
          payload['leads_visibility'] = this.form.leads_visibility || 'solo_mios';
        }
        await this.pb.collection('users').update(this.user.id, payload);
        this.messageService.add({ severity: 'success', summary: 'Éxito', detail: 'Usuario actualizado correctamente.' });
        this.visibleChange.emit(false);
        this.saved.emit();
      } else {
        const passwordTemporal = this.generarPasswordTemporal(this.form.name);

        if (!passwordTemporal) {
          this.messageService.add({
            severity: 'error',
            summary: 'Nombre inválido',
            detail: 'El primer nombre debe tener al menos 4 caracteres alfanuméricos para generar la contraseña automática.',
          });
          return;
        }

        const payload: Record<string, unknown> = {
          name: this.form.name,
          email: this.form.email,
          role: this.form.role,
          telefono: this.form.telefono,
          whatsapp: this.form.whatsapp,
          activo: this.form.activo,
          password: passwordTemporal,
          passwordConfirm: passwordTemporal,
          emailVisibility: true,
          verified: true,
        //   verifiedConfirm: true,
          must_change_password: true,
        };
        if (this.form.role === 'vendedor') {
          payload['leads_visibility'] = this.form.leads_visibility || 'solo_mios';
        }
        console.log('[usuario-form] CREATE payload:', JSON.stringify({ ...payload, password: '***', passwordConfirm: '***' }, null, 2));
        const userCreado = await this.pb.collection('users').create(payload) as UsersResponse;
        console.log('[usuario-form] CREATE response:', JSON.stringify(userCreado, null, 2));

        this.visibleChange.emit(false);
        this.userCreatedWithPassword.emit({
          name: userCreado.name ?? this.form.name,
          email: userCreado.email,
          password: passwordTemporal,
        });
      }
    } catch (err: unknown) {
      console.error('[usuario-form] ERROR:', err);
      const msg = err instanceof Error ? err.message : 'Error al guardar el usuario.';
      this.messageService.add({ severity: 'error', summary: 'Error', detail: msg });
    } finally {
      this.saving.set(false);
    }
  }
}
