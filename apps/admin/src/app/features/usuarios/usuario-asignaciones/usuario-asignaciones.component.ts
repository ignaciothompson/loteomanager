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
import { POCKETBASE, VendedorAccesoService } from '@loteomanager/shared-pb-client';
import { UsersResponse, BarriosResponse } from '@loteomanager/shared-types';

import { DialogModule } from 'primeng/dialog';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { ToastModule } from 'primeng/toast';
import { TabsModule } from 'primeng/tabs';
import { PickListModule } from 'primeng/picklist';
import { MultiSelectModule } from 'primeng/multiselect';
import { MessageService } from 'primeng/api';
import { ProgressSpinnerModule } from 'primeng/progressspinner';

type BarrioWithZona = BarriosResponse & { zona?: string };

interface ZonaAsignada {
  zona: string;
  id?: string;
}

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
  private vendedorAccesoService = inject(VendedorAccesoService);
  private messageService = inject(MessageService);

  loading = signal(false);
  savingDirectos = signal(false);
  savingZonas = signal(false);

  activeTab = 'directos';

  barriosDisponibles = signal<BarrioWithZona[]>([]);
  barriosAsignados = signal<BarrioWithZona[]>([]);
  zonasDisponibles = signal<{ zona: string }[]>([]);
  zonasSeleccionadas: string[] = [];
  nuevaZona = '';

  private originalDirectosIds = new Set<string>();
  private originalZonaIds = new Map<string, string>();

  ngOnChanges(): void {
    if (this.visible && this.user) {
      void this.loadData();
    }
  }

  getZona(barrio: BarrioWithZona): string | undefined {
    return (barrio as BarrioWithZona).zona;
  }

  private async loadData(): Promise<void> {
    if (!this.user) return;
    this.loading.set(true);
    try {
      const [todosBarrios, asignadosRecs, zonasRecs] = await Promise.all([
        this.pb.collection('barrios').getFullList({ sort: 'nombre' }) as Promise<BarrioWithZona[]>,
        this.pb.collection('vendedor_barrios').getFullList({
          filter: `vendedor_id="${this.user.id}"`,
        }),
        this.pb.collection('vendedor_zonas').getFullList({
          filter: `vendedor_id="${this.user.id}"`,
        }),
      ]);

      const asignadosIds = new Set(asignadosRecs.map((r) => r['barrio_id'] as string));
      this.originalDirectosIds = new Set(asignadosIds);

      const asignados = todosBarrios.filter((b) => asignadosIds.has(b.id));
      const disponibles = todosBarrios.filter((b) => !asignadosIds.has(b.id));

      this.barriosAsignados.set(asignados);
      this.barriosDisponibles.set(disponibles);

      const zonasSet = new Set<string>();
      for (const b of todosBarrios) {
        const z = (b as BarrioWithZona).zona;
        if (z) zonasSet.add(z);
      }
      this.zonasDisponibles.set([...zonasSet].map((z) => ({ zona: z })));

      this.originalZonaIds = new Map(
        zonasRecs.map((r) => [r['zona'] as string, r.id])
      );
      this.zonasSeleccionadas = [...this.originalZonaIds.keys()];

    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error al cargar datos.';
      this.messageService.add({ severity: 'error', summary: 'Error', detail: msg });
    } finally {
      this.loading.set(false);
    }
  }

  onMoveToTarget(event: { items: BarrioWithZona[] }): void {
    this.barriosAsignados.update((prev) => [...prev, ...event.items]);
    this.barriosDisponibles.update((prev) =>
      prev.filter((b) => !event.items.some((i) => i.id === b.id))
    );
  }

  onMoveToSource(event: { items: BarrioWithZona[] }): void {
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

  agregarZona(): void {
    const z = this.nuevaZona.trim();
    if (!z) return;
    if (!this.zonasDisponibles().some((zd) => zd.zona === z)) {
      this.zonasDisponibles.update((prev) => [...prev, { zona: z }]);
    }
    if (!this.zonasSeleccionadas.includes(z)) {
      this.zonasSeleccionadas = [...this.zonasSeleccionadas, z];
    }
    this.nuevaZona = '';
  }

  async saveZonas(): Promise<void> {
    if (!this.user) return;
    this.savingZonas.set(true);
    try {
      const currentSet = new Set(this.zonasSeleccionadas);
      const originalSet = new Set(this.originalZonaIds.keys());

      const toDelete = [...originalSet].filter((z) => !currentSet.has(z));
      await Promise.all(
        toDelete.map((z) => {
          const id = this.originalZonaIds.get(z);
          return id ? this.pb.collection('vendedor_zonas').delete(id) : Promise.resolve();
        })
      );

      const toAdd = [...currentSet].filter((z) => !originalSet.has(z));
      const created = await Promise.all(
        toAdd.map((z) =>
          this.pb.collection('vendedor_zonas').create({
            vendedor_id: this.user!.id,
            zona: z,
          })
        )
      );

      for (const z of toDelete) this.originalZonaIds.delete(z);
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
