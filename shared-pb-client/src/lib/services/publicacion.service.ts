import { Injectable, inject } from '@angular/core';
import type {
  BarrioWebSnapshot,
  BarrioWebSnapshotUnidad,
  BarriosResponse,
  PublicacionHistorialResponse,
  UnidadPublicacionDiff,
  UnidadesResponse,
} from '@loteomanager/shared-types';
import { BarriosService } from './barrios.service';
import { UnidadesService } from './unidades.service';
import { POCKETBASE } from '../pocketbase.config';

function mapUnidadSnapshot(u: UnidadesResponse): BarrioWebSnapshotUnidad {
  const extras =
    u.extras && typeof u.extras === 'object' && !Array.isArray(u.extras)
      ? (u.extras as Record<string, unknown>)
      : {};
  return {
    id: u.id,
    codigo: u.codigo,
    tipo: u.tipo_unidad,
    area: u.metros_cuadrados ?? u.area_m2 ?? null,
    orientacion: u.orientacion ?? null,
    precio: u.precio ?? null,
    moneda: u.moneda ?? 'USD',
    estado: u.estado,
    en_oferta: !!(u.en_oferta || u.oferta),
    precio_oferta: u.precio_oferta ?? null,
    extras,
    descripcion: u.descripcion ?? null,
    galeria: u.galeria ?? [],
    plano_unidad: u.plano_unidad ?? null,
    metros_construidos: u.metros_construidos ?? null,
    numero_unidad: u.numero_unidad ?? null,
    ambientes: u.ambientes ?? null,
    antiguedad_anios: u.antiguedad_anios ?? null,
    cocheras: u.cocheras ?? null,
  };
}

function unidadComparableKey(u: BarrioWebSnapshotUnidad): string {
  return JSON.stringify({
    codigo: u.codigo,
    tipo: u.tipo,
    area: u.area,
    orientacion: u.orientacion,
    precio: u.precio,
    moneda: u.moneda,
    estado: u.estado,
    en_oferta: u.en_oferta,
    precio_oferta: u.precio_oferta,
    extras: u.extras,
  });
}

function fmtPrecio(precio: number | null | undefined, moneda: string): string {
  if (precio == null) return '—';
  return `${moneda} ${precio.toLocaleString('es-UY')}`;
}

@Injectable({ providedIn: 'root' })
export class PublicacionService {
  private barriosSvc = inject(BarriosService);
  private unidadesSvc = inject(UnidadesService);
  private pb = inject(POCKETBASE);

  async publicarBarrio(barrioId: string): Promise<void> {
    const barrio = await this.barriosSvc.getAsync(barrioId);
    const unidades = await this.unidadesSvc.listAsync(
      `barrio_id="${barrioId}" && web_visible = true`,
      { sort: 'codigo' },
    );

    if (barrio.snapshot) {
      await this.guardarHistorial(barrio);
    }

    const snapshot: BarrioWebSnapshot = {
      barrio: {
        id: barrio.id,
        nombre: barrio.nombre,
        slug: barrio.slug,
        zona: barrio.zona_id ?? null,
        descripcion: barrio.descripcion ?? null,
        ubicacion_texto: barrio.ubicacion_texto ?? null,
        imagen_portada: barrio.imagen_portada ?? null,
        plano_general: barrio.plano_general ?? null,
        lat: barrio.lat ?? null,
        lng: barrio.lng ?? null,
      },
      unidades: unidades.map(mapUnidadSnapshot),
      generado_at: new Date().toISOString(),
    };

    await this.barriosSvc.update(barrioId, {
      snapshot,
      publicado: true,
      publicado_at: new Date().toISOString(),
    } as Partial<BarriosResponse>);

    await Promise.all(
      unidades.map((u) =>
        this.unidadesSvc.update(u.id, { pendiente_publicar: false }),
      ),
    );
  }

  async publicarTodo(barrioIds?: string[]): Promise<void> {
    const ids = barrioIds?.length
      ? barrioIds
      : await this.getBarriosConCambiosPendientes();
    for (const id of ids) {
      await this.publicarBarrio(id);
    }
  }

  async getBarriosConCambiosPendientes(): Promise<string[]> {
    const [barrios, unidadesPendientes] = await Promise.all([
      this.barriosSvc.listAsync(undefined, { sort: 'nombre' }),
      this.unidadesSvc.listAsync('pendiente_publicar = true'),
    ]);

    const ids = new Set<string>();
    for (const u of unidadesPendientes) {
      if (u.barrio_id) ids.add(u.barrio_id);
    }

    for (const b of barrios) {
      if (ids.has(b.id)) continue;
      // Diff solo si ya publicó alguna vez o está marcado publicado (snapshot stale/null)
      if (!b.publicado && !b.snapshot) continue;
      const diffs = await this.diffBarrio(b.id, b);
      if (diffs.length) ids.add(b.id);
    }

    return [...ids];
  }

  async diffBarrio(
    barrioId: string,
    barrioPreloaded?: BarriosResponse,
  ): Promise<UnidadPublicacionDiff[]> {
    const barrio = barrioPreloaded ?? (await this.barriosSvc.getAsync(barrioId));
    const snapshot = this.parseSnapshot(barrio.snapshot);
    const snapUnidades = snapshot?.unidades ?? [];
    const snapById = new Map(snapUnidades.map((u) => [u.id, u]));

    const [visibles, ocultas] = await Promise.all([
      this.unidadesSvc.listAsync(
        `barrio_id="${barrioId}" && web_visible = true`,
        { sort: 'codigo' },
      ),
      this.unidadesSvc.listAsync(
        `barrio_id="${barrioId}" && web_visible = false`,
        { sort: 'codigo' },
      ),
    ]);

    const diffs: UnidadPublicacionDiff[] = [];
    const liveIds = new Set<string>();

    for (const u of visibles) {
      liveIds.add(u.id);
      const mapped = mapUnidadSnapshot(u);
      const prev = snapById.get(u.id);
      if (!prev) {
        diffs.push({
          unidadId: u.id,
          codigo: u.codigo,
          kind: 'nueva',
          despues: `${u.tipo_unidad} · ${fmtPrecio(u.precio, u.moneda)}`,
        });
        continue;
      }
      if (unidadComparableKey(prev) !== unidadComparableKey(mapped)) {
        const campo = this.firstChangedField(prev, mapped);
        diffs.push({
          unidadId: u.id,
          codigo: u.codigo,
          kind: 'modificada',
          campo: campo.name,
          antes: campo.antes,
          despues: campo.despues,
        });
      }
    }

    for (const prev of snapUnidades) {
      if (liveIds.has(prev.id)) continue;
      const oculta = ocultas.find((o) => o.id === prev.id);
      if (oculta) {
        diffs.push({
          unidadId: prev.id,
          codigo: prev.codigo,
          kind: 'oculta',
          campo: 'web_visible',
          antes: 'Sí',
          despues: 'No',
        });
      } else {
        diffs.push({
          unidadId: prev.id,
          codigo: prev.codigo,
          kind: 'eliminada',
        });
      }
    }

    return diffs;
  }

  parseSnapshot(raw: unknown): BarrioWebSnapshot | null {
    if (!raw || typeof raw !== 'object') return null;
    const s = raw as BarrioWebSnapshot;
    if (!s.barrio || !Array.isArray(s.unidades)) return null;
    return s;
  }

  /** Solo barrio_id de una unidad (lookup liviano para /lotes/:id). */
  async getBarrioIdOfUnidad(unidadId: string): Promise<string | null> {
    try {
      const rec = await this.pb.collection('unidades').getOne(unidadId, {
        fields: 'barrio_id',
      });
      return (rec['barrio_id'] as string) || null;
    } catch {
      return null;
    }
  }

  /** Guarda el snapshot vigente de un barrio como entrada de historial antes de sobreescribirlo. */
  private async guardarHistorial(barrio: BarriosResponse): Promise<void> {
    const userId = this.pb.authStore.model?.['id'] as string | undefined;
    await this.pb.collection('publicacion_historial').create({
      barrio_id: barrio.id,
      snapshot: barrio.snapshot,
      publicado_at: barrio.publicado_at || new Date().toISOString(),
      publicado_por: userId || undefined,
    });
  }

  /** Lista el historial de publicaciones de un barrio, más reciente primero. */
  async listHistorial(barrioId: string): Promise<PublicacionHistorialResponse[]> {
    return this.pb.collection('publicacion_historial').getFullList({
      filter: `barrio_id="${barrioId}"`,
      sort: '-created',
    }) as unknown as Promise<PublicacionHistorialResponse[]>;
  }

  /** Restaura un snapshot histórico como el snapshot vigente del barrio (rollback). */
  async rollback(barrioId: string, historialId: string): Promise<void> {
    const entry = await this.pb
      .collection('publicacion_historial')
      .getOne(historialId) as unknown as PublicacionHistorialResponse;
    if (entry.barrio_id !== barrioId) {
      throw new Error('El registro de historial no pertenece a este barrio.');
    }

    const barrio = await this.barriosSvc.getAsync(barrioId);
    if (barrio.snapshot) {
      await this.guardarHistorial(barrio);
    }

    await this.barriosSvc.update(barrioId, {
      snapshot: entry.snapshot,
      publicado: true,
      publicado_at: new Date().toISOString(),
    } as Partial<BarriosResponse>);
  }

  private firstChangedField(
    prev: BarrioWebSnapshotUnidad,
    next: BarrioWebSnapshotUnidad,
  ): { name: string; antes: string; despues: string } {
    const pairs: Array<[string, string, string]> = [
      ['precio', fmtPrecio(prev.precio, prev.moneda), fmtPrecio(next.precio, next.moneda)],
      ['estado', prev.estado, next.estado],
      ['en_oferta', prev.en_oferta ? 'Sí' : 'No', next.en_oferta ? 'Sí' : 'No'],
      ['precio_oferta', fmtPrecio(prev.precio_oferta, prev.moneda), fmtPrecio(next.precio_oferta, next.moneda)],
      ['area', prev.area != null ? `${prev.area}` : '—', next.area != null ? `${next.area}` : '—'],
      ['orientacion', prev.orientacion ?? '—', next.orientacion ?? '—'],
      ['tipo', prev.tipo, next.tipo],
      ['codigo', prev.codigo, next.codigo],
    ];
    for (const [name, antes, despues] of pairs) {
      if (antes !== despues) return { name, antes, despues };
    }
    return { name: 'datos', antes: '…', despues: '…' };
  }
}
