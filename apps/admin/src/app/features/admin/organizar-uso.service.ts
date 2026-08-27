import { Injectable, inject } from '@angular/core';
import { POCKETBASE } from '@loteomanager/shared-pb-client';
import type { EntidadExtra, ExtraValor } from '@loteomanager/shared-types';

export type DeptUso = { zonas: number; barrios: number };
export type ExtraUso = number | 'over';

const EXTRA_LIMIT = 5000;

function extraValorNoVacio(valor: ExtraValor | unknown): boolean {
  if (valor == null || valor === '') return false;
  if (Array.isArray(valor) && valor.length === 0) return false;
  return true;
}

function extraUsado(extras: unknown, extraId: string, code: string): boolean {
  if (Array.isArray(extras)) {
    const row = extras.find(
      (x) =>
        x &&
        typeof x === 'object' &&
        ((x as { extra_id?: string }).extra_id === extraId ||
          (x as { code?: string }).code === code)
    ) as { valor?: unknown } | undefined;
    return extraValorNoVacio(row?.valor);
  }
  if (extras && typeof extras === 'object') {
    const rec = extras as Record<string, unknown>;
    if (code in rec) return extraValorNoVacio(rec[code]);
    if (extraId in rec) return extraValorNoVacio(rec[extraId]);
  }
  return false;
}

@Injectable({ providedIn: 'root' })
export class OrganizarUsoService {
  private pb = inject(POCKETBASE);

  async geoUso(): Promise<{ dept: Record<string, DeptUso>; zona: Record<string, number> }> {
    const [zonas, barrios] = await Promise.all([
      this.pb.collection('zonas').getFullList<{ id: string; departamento_id: string }>({
        fields: 'id,departamento_id'
      }),
      this.pb.collection('barrios').getFullList<{ id: string; zona_id: string }>({
        fields: 'id,zona_id'
      })
    ]);

    const zonaToDept = new Map(zonas.map((z) => [z.id, z.departamento_id]));
    const dept: Record<string, DeptUso> = {};
    const zona: Record<string, number> = {};

    for (const z of zonas) {
      dept[z.departamento_id] ??= { zonas: 0, barrios: 0 };
      dept[z.departamento_id].zonas += 1;
    }
    for (const b of barrios) {
      zona[b.zona_id] = (zona[b.zona_id] ?? 0) + 1;
      const deptId = zonaToDept.get(b.zona_id);
      if (!deptId) continue;
      dept[deptId] ??= { zonas: 0, barrios: 0 };
      dept[deptId].barrios += 1;
    }
    return { dept, zona };
  }

  async estadoUso(): Promise<Record<string, number>> {
    const [unidades, interesados] = await Promise.all([
      this.pb.collection('unidades').getFullList<{ estado: string }>({ fields: 'estado' }),
      this.pb.collection('interesados').getFullList<{ estado: string }>({ fields: 'estado' })
    ]);
    const counts: Record<string, number> = {};
    for (const u of unidades) {
      const k = `unidades:${u.estado}`;
      counts[k] = (counts[k] ?? 0) + 1;
    }
    for (const i of interesados) {
      const k = `interesados:${i.estado}`;
      counts[k] = (counts[k] ?? 0) + 1;
    }
    return counts;
  }

  async extraUso(
    defs: { id: string; code: string; entidad: EntidadExtra }[]
  ): Promise<Record<string, ExtraUso>> {
    const result: Record<string, ExtraUso> = {};
    const entidades: EntidadExtra[] = ['barrios', 'unidades', 'interesados'];
    await Promise.all(
      entidades.map(async (col) => {
        const group = defs.filter((d) => d.entidad === col);
        if (!group.length) return;
        for (const d of group) result[d.id] = 0;
        try {
          const probe = await this.pb.collection(col).getList(1, 1, { fields: 'id' });
          if (probe.totalItems > EXTRA_LIMIT) {
            for (const d of group) result[d.id] = 'over';
            return;
          }
          if (probe.totalItems === 0) return;
          const recs = await this.pb
            .collection(col)
            .getFullList<{ extras?: unknown }>({ fields: 'extras' });
          for (const r of recs) {
            for (const d of group) {
              if (extraUsado(r.extras, d.id, d.code)) {
                result[d.id] = (result[d.id] as number) + 1;
              }
            }
          }
        } catch {
          for (const d of group) result[d.id] = 'over';
        }
      })
    );
    return result;
  }

  async zonasDeDepto(deptId: string): Promise<{ id: string; nombre: string }[]> {
    return this.pb.collection('zonas').getFullList<{ id: string; nombre: string }>({
      filter: `departamento_id="${deptId}"`,
      fields: 'id,nombre',
      sort: 'nombre'
    });
  }

  async barriosDeZona(zonaId: string): Promise<{ id: string; nombre: string }[]> {
    return this.pb.collection('barrios').getFullList<{ id: string; nombre: string }>({
      filter: `zona_id="${zonaId}"`,
      fields: 'id,nombre',
      sort: 'nombre'
    });
  }

  async registrosDeEstado(
    entidad: 'unidades' | 'interesados',
    code: string
  ): Promise<{ id: string; label: string; link: (string | number)[]; query?: Record<string, string> }[]> {
    if (entidad === 'unidades') {
      const list = await this.pb
        .collection('unidades')
        .getList<{ id: string; codigo: string; barrio_id?: string }>(1, 8, {
          filter: `estado="${code}"`,
          fields: 'id,codigo,barrio_id',
          sort: '-updated'
        });
      return list.items.map((u) => ({
        id: u.id,
        label: u.codigo || u.id,
        link: u.barrio_id ? ['/barrios', u.barrio_id] : ['/barrios'],
        query: u.barrio_id ? { unidad: u.id } : undefined
      }));
    }
    const list = await this.pb
      .collection('interesados')
      .getList<{ id: string; nombre: string }>(1, 8, {
        filter: `estado="${code}"`,
        fields: 'id,nombre',
        sort: '-updated'
      });
    return list.items.map((i) => ({
      id: i.id,
      label: i.nombre || i.id,
      link: ['/contactos']
    }));
  }
}
