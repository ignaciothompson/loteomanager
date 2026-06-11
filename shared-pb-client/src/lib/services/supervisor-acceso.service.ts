import { Injectable, inject } from '@angular/core';
import { POCKETBASE } from '../pocketbase.config';

const TODO_SLUG = 'todo';

@Injectable({ providedIn: 'root' })
export class SupervisorAccesoService {
  private pb = inject(POCKETBASE);

  async getDepartamentosAccesibles(supervisorId: string): Promise<string[] | null> {
    const asignaciones = await this.pb
      .collection('supervisor_departamentos')
      .getFullList({ filter: `user_id="${supervisorId}"` });

    if (asignaciones.length === 0) return null;
    return asignaciones.map((a) => a['departamento_id'] as string);
  }

  async tieneAccesoTotal(supervisorId: string): Promise<boolean> {
    const deptIds = await this.getDepartamentosAccesibles(supervisorId);
    if (!deptIds) return false;

    const deptos = await this.pb.collection('departamentos').getFullList({
      filter: deptIds.map((id) => `id="${id}"`).join(' || '),
      fields: 'slug',
    });
    return deptos.some((d) => d['slug'] === TODO_SLUG);
  }

  async getZonasAccesibles(supervisorId: string): Promise<string[]> {
    const deptIds = await this.getDepartamentosAccesibles(supervisorId);
    if (!deptIds) return [];

    if (await this.tieneAccesoTotal(supervisorId)) {
      const all = await this.pb.collection('zonas').getFullList({ fields: 'id' });
      return all.map((z) => z.id);
    }

    const zonas = await this.pb.collection('zonas').getFullList({
      filter: deptIds.map((id) => `departamento_id="${id}"`).join(' || '),
      fields: 'id',
    });
    return zonas.map((z) => z.id);
  }

  async getBarriosAccesibles(supervisorId: string): Promise<string[]> {
    const deptIds = await this.getDepartamentosAccesibles(supervisorId);
    if (!deptIds) return [];

    if (await this.tieneAccesoTotal(supervisorId)) {
      const all = await this.pb.collection('barrios').getFullList({ fields: 'id' });
      return all.map((b) => b.id);
    }

    const zonaIds = await this.getZonasAccesibles(supervisorId);
    if (zonaIds.length === 0) return [];

    const barrios = await this.pb.collection('barrios').getFullList({
      filter: zonaIds.map((id) => `zona_id="${id}"`).join(' || '),
      fields: 'id',
    });
    return barrios.map((b) => b.id);
  }
}
