import {
  Component,
  EventEmitter,
  Input,
  OnChanges,
  Output,
  inject,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  POCKETBASE,
  VendedorAccesoService,
  ZonasService,
  buildVendedorZonaCreatePayload,
} from '@loteomanager/shared-pb-client';
import { BarriosResponse, UsersResponse, ZonasResponse } from '@loteomanager/shared-types';

import { DialogModule } from 'primeng/dialog';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { ToastModule } from 'primeng/toast';
import { TabsModule } from 'primeng/tabs';
import { PickListModule } from 'primeng/picklist';
import { MultiSelectModule } from 'primeng/multiselect';
import { MessageService } from 'primeng/api';
import { ProgressSpinnerModule } from 'primeng/progressspinner';

type BarrioRow = BarriosResponse & {
  expand?: { zona_id?: ZonasResponse };
};

@Component({
  selector: 'app-usuario-asignaciones',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    DialogModule,
    ButtonModule,
    InputTextModule,
    ToastModule,
    TabsModule,
    PickListModule,
    MultiSelectModule,
    ProgressSpinnerModule,
  ],
  providers: [MessageService],
  templateUrl: './usuario-asignaciones.component.html',
  styleUrls: ['./usuario-asignaciones.component.css'],
})
export class UsuarioAsignacionesComponent implements OnChanges {
  @Input() visible = false;
  @Output() visibleChange = new EventEmitter<boolean>();
  @Input() user: UsersResponse | null = null;
  @Output() saved = new EventEmitter<void>();

  private pb = inject(POCKETBASE);
  private zonasSvc = inject(ZonasService);
  private vendedorAccesoService = inject(VendedorAccesoService);
  private messageService = inject(MessageService);

  loading = signal(false);
  savingDirectos = signal(false);
  savingZonas = signal(false);

  activeTab = 'directos';

  barriosDisponibles = signal<BarrioRow[]>([]);
  barriosAsignados = signal<BarrioRow[]>([]);
  zonasOpts = signal<{ label: string; value: string }[]>([]);
  zonasSeleccionadas: string[] = [];

  private originalDirectosIds = new Set<string>();
  private originalZonaIds = new Map<string, string>();

  ngOnChanges(): void {
    if (this.visible && this.user?.role === 'vendedor') {
      void this.loadData();
    }
  }

  getZonaNombre(barrio: BarrioRow): string | undefined {
    return barrio.expand?.zona_id?.nombre;
  }

  private async loadData(): Promise<void> {
    if (!this.user) return;
    this.loading.set(true);
    try {
      const [todosBarrios, asignadosRecs, zonasRecs, zonasCatalog] = await Promise.all([
        this.pb.collection('barrios').getFullList({
          sort: 'nombre',
          expand: 'zona_id',
        }) as Promise<BarrioRow[]>,
        this.pb.collection('vendedor_barrios').getFullList({
          filter: `vendedor_id="${this.user.id}"`,
        }),
        this.pb.collection('vendedor_zonas').getFullList({
          filter: `vendedor_id="${this.user.id}"`,
        }),
        this.zonasSvc.listAsync(undefined),
      ]);

      const barrioIds = new Set(asignadosRecs.map((r) => r['barrio_id'] as string));

      this.barriosAsignados.set(todosBarrios.filter((b) => barrioIds.has(b.id)));
      this.barriosDisponibles.set(todosBarrios.filter((b) => !barrioIds.has(b.id)));
      this.originalDirectosIds = new Set(barrioIds);

      this.zonasOpts.set(
        (zonasCatalog as ZonasResponse[]).map((z) => ({ label: z.nombre, value: z.id }))
      );

      this.originalZonaIds = new Map(
        zonasRecs.map((r) => [r['zona_id'] as string, r.id])
      );
      this.zonasSeleccionadas = [...this.originalZonaIds.keys()];
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error al cargar datos.';
      this.messageService.add({ severity: 'error', summary: 'Error', detail: msg });
    } finally {
      this.loading.set(false);
    }
  }

  onMoveToTarget(event: { items: BarrioRow[] }): void {
    this.barriosAsignados.update((prev) => [...prev, ...event.items]);
    this.barriosDisponibles.update((prev) =>
      prev.filter((b) => !event.items.some((i) => i.id === b.id))
    );
  }

  onMoveToSource(event: { items: BarrioRow[] }): void {
    this.barriosDisponibles.update((prev) => [...prev, ...event.items]);
    this.barriosAsignados.update((prev) =>
      prev.filter((b) => !event.items.some((i) => i.id === b.id))
    );
  }

  onMoveAllToTarget(): void {
    const all = [...this.barriosDisponibles(), ...this.barriosAsignados()];
    this.barriosAsignados.set(all);
    this.barriosDisponibles.set([]);
  }

  onMoveAllToSource(): void {
    const all = [...this.barriosDisponibles(), ...this.barriosAsignados()];
    this.barriosDisponibles.set(all);
    this.barriosAsignados.set([]);
  }

  async saveDirectos(): Promise<void> {
    if (!this.user) return;
    this.savingDirectos.set(true);
    try {
      const currentIds = new Set(this.barriosAsignados().map((b) => b.id));

      const existingRecs = await this.pb.collection('vendedor_barrios').getFullList({
        filter: `vendedor_id="${this.user.id}"`,
      });

      const toDelete = existingRecs.filter((r) => !currentIds.has(r['barrio_id'] as string));
      await Promise.all(toDelete.map((r) => this.pb.collection('vendedor_barrios').delete(r.id)));

      const existingBarrioIds = new Set(existingRecs.map((r) => r['barrio_id'] as string));
      const toAdd = this.barriosAsignados().filter((b) => !existingBarrioIds.has(b.id));
      await Promise.all(
        toAdd.map((b) =>
          this.pb.collection('vendedor_barrios').create({
            vendedor_id: this.user!.id,
            barrio_id: b.id,
          })
        )
      );

      this.originalDirectosIds = new Set(currentIds);
      await this.vendedorAccesoService.refresh();

      this.messageService.add({
        severity: 'success',
        summary: 'Éxito',
        detail: 'Asignación de barrios guardada.',
      });
      this.saved.emit();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error al guardar asignaciones.';
      this.messageService.add({ severity: 'error', summary: 'Error', detail: msg });
    } finally {
      this.savingDirectos.set(false);
    }
  }

  async saveZonas(): Promise<void> {
    if (!this.user) return;
    this.savingZonas.set(true);
    try {
      const currentSet = new Set(this.zonasSeleccionadas);
      const originalSet = new Set(this.originalZonaIds.keys());

      const toDelete = [...originalSet].filter((id) => !currentSet.has(id));
      await Promise.all(
        toDelete.map((id) => {
          const recId = this.originalZonaIds.get(id);
          return recId ? this.pb.collection('vendedor_zonas').delete(recId) : Promise.resolve();
        })
      );

      const toAdd = [...currentSet].filter((id) => !originalSet.has(id));
      const zonaNombreById = new Map(this.zonasOpts().map((z) => [z.value, z.label]));
      const created = await Promise.all(
        toAdd.map((zona_id) =>
          this.pb.collection('vendedor_zonas').create(
            buildVendedorZonaCreatePayload(this.user!.id, zona_id, zonaNombreById.get(zona_id))
          )
        )
      );

      for (const id of toDelete) this.originalZonaIds.delete(id);
      for (let i = 0; i < toAdd.length; i++) {
        this.originalZonaIds.set(toAdd[i], created[i].id);
      }

      await this.vendedorAccesoService.refresh();

      this.messageService.add({
        severity: 'success',
        summary: 'Éxito',
        detail: 'Asignación de zonas guardada.',
      });
      this.saved.emit();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error al guardar zonas.';
      this.messageService.add({ severity: 'error', summary: 'Error', detail: msg });
    } finally {
      this.savingZonas.set(false);
    }
  }
}
