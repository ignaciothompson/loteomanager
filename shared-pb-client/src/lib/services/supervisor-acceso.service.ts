import { Injectable, inject } from '@angular/core';
import { POCKETBASE } from '../pocketbase.config';

const TODO_SLUG = 'todo';

@Injectable({ providedIn: 'root' })
export class SupervisorAccesoService {
  private pb = inject(POCKETBASE);

  async getBarriosAccesibles(userId: string): Promise<string[]> {
    const asignaciones = await this.pb
      .collection('supervisor_departamentos')
      .getFullList({ filter: `user_id="${userId}"`, expand: 'departamento_id' });

    if (asignaciones.length === 0) return [];

    const deptIds = asignaciones.map((a) => a['departamento_id'] as string);
    const deptos = await this.pb.collection('departamentos').getFullList({
      filter: deptIds.map((id) => `id="${id}"`).join(' || '),
    });

    if (deptos.some((d) => d['slug'] === TODO_SLUG)) {
      const all = await this.pb.collection('barrios').getFullList({ fields: 'id' });
      return all.map((b) => b.id);
    }

    const deptFilter = deptIds.map((id) => `departamento_id="${id}"`).join(' || ');
    const zonas = await this.pb.collection('zonas').getFullList({ filter: deptFilter });
    if (zonas.length === 0) return [];

    const zonaIds = zonas.map((z) => z.id);
    const barrios = await this.pb.collection('barrios').getFullList({
      filter: zonaIds.map((id) => `zona_id="${id}"`).join(' || '),
      fields: 'id',
    });
    return barrios.map((b) => b.id);
  }
}
