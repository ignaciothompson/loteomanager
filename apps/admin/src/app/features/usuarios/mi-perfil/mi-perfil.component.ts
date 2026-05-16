import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AuthService, VendedorAccesoService, POCKETBASE } from '@loteomanager/shared-pb-client';
import { BarriosResponse } from '@loteomanager/shared-types';

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
  private vendedorAccesoService = inject(VendedorAccesoService);
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
  zonasAsignadas = signal<string[]>([]);
  loadingAsignaciones = signal(false);

  ngOnInit(): void {
    const u = this.user();
    if (u) {
      this.editName = (u['name'] as string) ?? '';
      this.editTelefono = (u['telefono'] as string) ?? '';
      this.editWhatsapp = (u['whatsapp'] as string) ?? '';

      if (u['role'] === 'vendedor') {
        void this.loadAsignaciones(u['id'] as string);
      }
    }
  }

  private async loadAsignaciones(userId: string): Promise<void> {
    this.loadingAsignaciones.set(true);
    try {
      const [directosRecs, zonasRecs] = await Promise.all([
        this.pb.collection('vendedor_barrios').getFullList({
          filter: `vendedor_id="${userId}"`,
        }),
        this.pb.collection('vendedor_zonas').getFullList({
          filter: `vendedor_id="${userId}"`,
        }),
      ]);

      if (directosRecs.length > 0) {
        const barrioIds = directosRecs.map((r) => `id="${r['barrio_id']}"`).join(' || ');
        const barrios = await this.pb.collection('barrios').getFullList({
          filter: barrioIds,
          sort: 'nombre',
        }) as BarriosResponse[];
        this.barriosAsignados.set(barrios);
      }

      this.zonasAsignadas.set(zonasRecs.map((r) => r['zona'] as string));
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
