import { Injectable, inject, signal } from '@angular/core';
import { POCKETBASE } from '../pocketbase.config';
import { AuthService } from '../auth.service';

@Injectable({ providedIn: 'root' })
export class VendedorAccesoService {
  private pb = inject(POCKETBASE);
  private auth = inject(AuthService);

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

  async loadCache(): Promise<void> {
    const user = this.auth.currentUser();
    if (!user) {
      this.barriosVisibles.set(null);
      return;
    }
    if (user['role'] === 'admin') {
      this.barriosVisibles.set(null); // null = all
      return;
    }

    const userId = user['id'] as string;
    const [directos, zonas] = await Promise.all([
      this.pb.collection('vendedor_barrios').getFullList({ filter: `vendedor_id="${userId}"` }),
      this.pb.collection('vendedor_zonas').getFullList({ filter: `vendedor_id="${userId}"` }),
    ]);

    const idsDirectos = new Set(directos.map(d => d['barrio_id'] as string));

    let idsPorZona = new Set<string>();
    if (zonas.length > 0) {
      const zonasFilter = zonas.map(z => `zona="${z['zona']}"`).join(' || ');
      const barriosPorZona = await this.pb.collection('barrios').getFullList({ filter: zonasFilter });
      idsPorZona = new Set(barriosPorZona.map(b => b.id));
    }

    this.barriosVisibles.set([...new Set([...idsDirectos, ...idsPorZona])]);
  }

  async refresh(): Promise<void> {
    return this.loadCache();
  }

  clear(): void {
    this.barriosVisibles.set(null);
  }
}
