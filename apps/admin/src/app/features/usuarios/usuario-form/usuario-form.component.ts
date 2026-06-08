import { Component, EventEmitter, Input, OnChanges, Output, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  DepartamentosService,
  POCKETBASE,
  VendedorAccesoService,
  ZonasService,
  buildVendedorZonaCreatePayload,
} from '@loteomanager/shared-pb-client';
import {
  BarriosResponse,
  DepartamentosResponse,
  UsersResponse,
  UsersRoleOptions,
  UsersLeadsVisibilityOptions,
  ZonasResponse
} from '@loteomanager/shared-types';

import { DialogModule } from 'primeng/dialog';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { SelectModule } from 'primeng/select';
import { MultiSelectModule } from 'primeng/multiselect';
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
    MultiSelectModule,
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
  private deptSvc = inject(DepartamentosService);
  private zonasSvc = inject(ZonasService);
  private vendedorAcceso = inject(VendedorAccesoService);

  saving = signal(false);
  loadingGeo = signal(false);

  form: UserFormModel = this.emptyForm();

  departamentosOpts: { label: string; value: string }[] = [];
  zonasOpts: { label: string; value: string }[] = [];
  barriosOpts: { label: string; value: string }[] = [];

  selectedDepartamentos: string[] = [];
  selectedZonas: string[] = [];
  selectedBarrios: string[] = [];

  readonly roleOptions = [
    { label: 'Admin', value: 'admin' as UsersRoleOptions },
    { label: 'Supervisor', value: 'supervisor' as UsersRoleOptions },
    { label: 'Vendedor', value: 'vendedor' as UsersRoleOptions },
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
      void this.loadGeoData();
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

  private async loadGeoData(): Promise<void> {
    this.loadingGeo.set(true);
    try {
      const [deptos, zonas, barrios] = await Promise.all([
        this.deptSvc.listAsync(undefined),
        this.zonasSvc.listAsync(undefined),
        this.pb.collection('barrios').getFullList({ sort: 'nombre' }) as Promise<BarriosResponse[]>,
      ]);

      this.departamentosOpts = (deptos as DepartamentosResponse[]).map((d) => ({
        label: d.nombre,
        value: d.id,
      }));
      this.zonasOpts = (zonas as ZonasResponse[]).map((z) => ({
        label: z.nombre,
        value: z.id,
      }));
      this.barriosOpts = barrios.map((b) => ({ label: b.nombre, value: b.id }));

      if (this.user) {
        await this.loadUserAssignments(this.user.id, this.user.role);
      } else {
        this.selectedDepartamentos = [];
        this.selectedZonas = [];
        this.selectedBarrios = [];
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error al cargar datos geográficos.';
      this.messageService.add({ severity: 'error', summary: 'Error', detail: msg });
    } finally {
      this.loadingGeo.set(false);
    }
  }

  private async loadUserAssignments(userId: string, role: UsersRoleOptions): Promise<void> {
    this.selectedDepartamentos = [];
    this.selectedZonas = [];
    this.selectedBarrios = [];

    if (role === 'supervisor') {
      const recs = await this.pb.collection('supervisor_departamentos').getFullList({
        filter: `user_id="${userId}"`,
      });
      this.selectedDepartamentos = recs.map((r) => r['departamento_id'] as string);
    }

    if (role === 'vendedor') {
      const [zonasRecs, barriosRecs] = await Promise.all([
        this.pb.collection('vendedor_zonas').getFullList({ filter: `vendedor_id="${userId}"` }),
        this.pb.collection('vendedor_barrios').getFullList({ filter: `vendedor_id="${userId}"` }),
      ]);
      this.selectedZonas = zonasRecs.map((r) => r['zona_id'] as string);
      this.selectedBarrios = barriosRecs.map((r) => r['barrio_id'] as string);
    }
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

  private async syncSupervisorDepts(userId: string): Promise<void> {
    const existing = await this.pb.collection('supervisor_departamentos').getFullList({
      filter: `user_id="${userId}"`,
    });
    const current = new Set(this.selectedDepartamentos);
    const existingMap = new Map(existing.map((r) => [r['departamento_id'] as string, r.id]));

    await Promise.all(
      [...existingMap.keys()]
        .filter((id) => !current.has(id))
        .map((id) => this.pb.collection('supervisor_departamentos').delete(existingMap.get(id)!))
    );

    await Promise.all(
      [...current]
        .filter((id) => !existingMap.has(id))
        .map((departamento_id) =>
          this.pb.collection('supervisor_departamentos').create({ user_id: userId, departamento_id })
        )
    );
  }

  private async syncVendedorGeo(userId: string): Promise<void> {
    const [zonasExisting, barriosExisting] = await Promise.all([
      this.pb.collection('vendedor_zonas').getFullList({ filter: `vendedor_id="${userId}"` }),
      this.pb.collection('vendedor_barrios').getFullList({ filter: `vendedor_id="${userId}"` }),
    ]);

    const zonasCurrent = new Set(this.selectedZonas);
    const barriosCurrent = new Set(this.selectedBarrios);

    const zonasMap = new Map(zonasExisting.map((r) => [r['zona_id'] as string, r.id]));
    const barriosMap = new Map(barriosExisting.map((r) => [r['barrio_id'] as string, r.id]));

    await Promise.all(
      [...zonasMap.keys()]
        .filter((id) => !zonasCurrent.has(id))
        .map((id) => this.pb.collection('vendedor_zonas').delete(zonasMap.get(id)!))
    );
    await Promise.all(
      [...barriosMap.keys()]
        .filter((id) => !barriosCurrent.has(id))
        .map((id) => this.pb.collection('vendedor_barrios').delete(barriosMap.get(id)!))
    );

    const zonaNombreById = new Map(this.zonasOpts.map((z) => [z.value, z.label]));

    await Promise.all(
      [...zonasCurrent]
        .filter((id) => !zonasMap.has(id))
        .map((zona_id) =>
          this.pb.collection('vendedor_zonas').create(
            buildVendedorZonaCreatePayload(userId, zona_id, zonaNombreById.get(zona_id))
          )
        )
    );
    await Promise.all(
      [...barriosCurrent]
        .filter((id) => !barriosMap.has(id))
        .map((barrio_id) => this.pb.collection('vendedor_barrios').create({ vendedor_id: userId, barrio_id }))
    );

    await this.vendedorAcceso.refresh();
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

        if (this.form.role === 'supervisor') {
          await this.syncSupervisorDepts(this.user.id);
        } else if (this.form.role === 'vendedor') {
          await this.syncVendedorGeo(this.user.id);
        }

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
          verifiedConfirm: true,
          must_change_password: true,
        };
        if (this.form.role === 'vendedor') {
          payload['leads_visibility'] = this.form.leads_visibility || 'solo_mios';
        }

        const userCreado = (await this.pb.collection('users').create(payload)) as UsersResponse;

        if (this.form.role === 'supervisor') {
          await this.syncSupervisorDepts(userCreado.id);
        } else if (this.form.role === 'vendedor') {
          await this.syncVendedorGeo(userCreado.id);
        }

        this.visibleChange.emit(false);
        this.userCreatedWithPassword.emit({
          name: userCreado.name ?? this.form.name,
          email: userCreado.email,
          password: passwordTemporal,
        });
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error al guardar el usuario.';
      this.messageService.add({ severity: 'error', summary: 'Error', detail: msg });
    } finally {
      this.saving.set(false);
    }
  }
}
