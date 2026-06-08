import { Injectable, inject, signal } from '@angular/core';
import { POCKETBASE } from '../pocketbase.config';
import { AuthService } from '../auth.service';
import { SupervisorAccesoService } from './supervisor-acceso.service';

const TODO_SLUG = 'todo';

@Injectable({ providedIn: 'root' })
export class VendedorAccesoService {
  private pb = inject(POCKETBASE);
  private auth = inject(AuthService);
  private supervisorAcceso = inject(SupervisorAccesoService);

  readonly barriosVisibles = signal<string[] | null>(null);

  constructor() {
    this.pb.authStore.onChange(async (_token, model) => {
      if (model) {
        await this.loadCache().catch(() => undefined);
      } else {
        this.clear();
      }
    });
    if (this.pb.authStore.isValid) {
      void this.loadCache().catch(() => undefined);
    }
  }

  async getBarriosAccesibles(userId: string): Promise<string[]> {
    const [directos, zonasAsignadas] = await Promise.all([
      this.pb.collection('vendedor_barrios').getFullList({ filter: `vendedor_id="${userId}"` }),
      this.pb.collection('vendedor_zonas').getFullList({
        filter: `vendedor_id="${userId}"`,
        expand: 'zona_id',
      }),
    ]);

    const idsDirectos = directos.map((d) => d['barrio_id'] as string);

    if (zonasAsignadas.length === 0) {
      return [...new Set(idsDirectos)];
    }

    const zonaIds = zonasAsignadas.map((z) => z['zona_id'] as string);
    const zonas = await this.pb.collection('zonas').getFullList({
      filter: zonaIds.map((id) => `id="${id}"`).join(' || '),
    });

    if (zonas.some((z) => z['slug'] === TODO_SLUG)) {
      const all = await this.pb.collection('barrios').getFullList({ fields: 'id' });
      return [...new Set([...idsDirectos, ...all.map((b) => b.id)])];
    }

    const barriosPorZona = await this.pb.collection('barrios').getFullList({
      filter: zonaIds.map((id) => `zona_id="${id}"`).join(' || '),
      fields: 'id',
    });

    return [...new Set([...idsDirectos, ...barriosPorZona.map((b) => b.id)])];
  }

  async loadCache(): Promise<void> {
    const user = this.auth.currentUser();
    if (!user) {
      this.barriosVisibles.set(null);
      return;
    }
    const role = user['role'] as string;
    if (role === 'admin') {
      this.barriosVisibles.set(null);
      return;
    }
    if (role === 'supervisor') {
      const ids = await this.supervisorAcceso.getBarriosAccesibles(user['id'] as string);
      this.barriosVisibles.set(ids);
      return;
    }

    const ids = await this.getBarriosAccesibles(user['id'] as string);
    this.barriosVisibles.set(ids);
  }

  async refresh(): Promise<void> {
    return this.loadCache();
  }

  clear(): void {
    this.barriosVisibles.set(null);
  }
}
