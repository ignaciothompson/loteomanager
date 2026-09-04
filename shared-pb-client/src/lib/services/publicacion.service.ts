import { Injectable, inject } from '@angular/core';
import type {
  BarrioWebSnapshot,
  BarrioWebSnapshotUnidad,
  BarriosResponse,
  CambioCampo,
  DiffUnidad,
  PublicacionHistorialResponse,
  TipoUnidadIngreso,
  UnidadesResponse,
  UsersResponse,
  VersionPublicacion,
} from '@loteomanager/shared-types';
import { formatPrecio, TIPO_UNIDAD_LABELS } from '@loteomanager/shared-utils';
import { BarriosService } from './barrios.service';
import { UnidadesService } from './unidades.service';
import { DefinicionesCacheService } from './definiciones-cache.service';
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

function fmtMoneda(precio: number | null | undefined, moneda: string): string {
  if (precio == null) return '—';
  const cur = moneda === 'UYU' || moneda === 'ARS' ? 'ARS' : 'USD';
  return formatPrecio(precio, cur);
}

function tipoLabel(tipo: string): string {
  return TIPO_UNIDAD_LABELS[tipo as TipoUnidadIngreso] ?? tipo;
}

type HistorialExpand = PublicacionHistorialResponse & {
  created?: string;
  expand?: { publicado_por?: Pick<UsersResponse, 'name' | 'email'> };
};

@Injectable({ providedIn: 'root' })
export class PublicacionService {
  private barriosSvc = inject(BarriosService);
  private unidadesSvc = inject(UnidadesService);
  private definiciones = inject(DefinicionesCacheService);
  private pb = inject(POCKETBASE);

  async publicarBarrio(barrioId: string): Promise<void> {
    const barrio = await this.barriosSvc.getAsync(barrioId);
    const unidades = await this.unidadesSvc.listAsync(
      `barrio_id="${barrioId}" && web_visible = true`,
      { sort: 'codigo' },
    );

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
      publicado_at: snapshot.generado_at,
    } as Partial<BarriosResponse>);

    try {
      await this.guardarVersion(barrioId, snapshot, unidades.length);
    } catch (err) {
      console.error('[publicacion] no se pudo guardar la versión', err);
    }

    await Promise.all(
      (
        await this.unidadesSvc.listAsync(
          `barrio_id="${barrioId}" && pendiente_publicar = true`,
        )
      ).map((u) => this.unidadesSvc.update(u.id, { pendiente_publicar: false })),
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
      if (!b.publicado && !b.snapshot) continue;
      const diffs = await this.diffBarrio(b.id, b);
      if (diffs.length) ids.add(b.id);
    }

    return [...ids];
  }

  async diffBarrio(
    barrioId: string,
    barrioPreloaded?: BarriosResponse,
  ): Promise<DiffUnidad[]> {
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

    const diffs: DiffUnidad[] = [];
    const liveIds = new Set<string>();

    for (const u of visibles) {
      liveIds.add(u.id);
      const mapped = mapUnidadSnapshot(u);
      const prev = snapById.get(u.id);
      if (!prev) {
        diffs.push({
          unidadId: u.id,
          codigo: u.codigo,
          tipo: 'nueva',
          campos: [{ campo: 'Cambio', antes: '—', despues: 'Entra al catálogo' }],
        });
        continue;
      }
      if (unidadComparableKey(prev) !== unidadComparableKey(mapped)) {
        diffs.push({
          unidadId: u.id,
          codigo: u.codigo,
          tipo: 'modificada',
          campos: this.camposCambiados(prev, mapped),
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
          tipo: 'oculta',
          campos: [
            {
              campo: 'Cambio',
              antes: '—',
              despues: 'Sale del catálogo (Web = No)',
            },
          ],
        });
      } else {
        diffs.push({
          unidadId: prev.id,
          codigo: prev.codigo,
          tipo: 'eliminada',
          campos: [
            { campo: 'Cambio', antes: '—', despues: 'Ya no existe en el admin' },
          ],
        });
      }
    }

    return diffs;
  }

  async listarVersiones(barrioId: string): Promise<VersionPublicacion[]> {
    const rows = (await this.pb.collection('publicacion_historial').getFullList({
      filter: `barrio_id="${barrioId}"`,
      sort: '-publicado_at',
      expand: 'publicado_por',
    })) as HistorialExpand[];

    return rows.map((r) => {
      const user = r.expand?.publicado_por;
      const nombre = user?.name?.trim() || user?.email || 'Usuario';
      const snap = this.parseSnapshot(r.snapshot);
      return {
        id: r.id,
        barrioId: r.barrio_id,
        publicadoEn: r.publicado_at || r.created || '',
        publicadoPor: nombre,
        unidadesCount: r.unidades_count ?? snap?.unidades.length ?? 0,
      };
    });
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

  async listHistorial(barrioId: string): Promise<PublicacionHistorialResponse[]> {
    return this.pb.collection('publicacion_historial').getFullList({
      filter: `barrio_id="${barrioId}"`,
      sort: '-publicado_at',
    }) as unknown as Promise<PublicacionHistorialResponse[]>;
  }

  /** Restaura un snapshot histórico como el snapshot vigente del barrio. */
  async rollback(barrioId: string, historialId: string): Promise<void> {
    const entry = (await this.pb
      .collection('publicacion_historial')
      .getOne(historialId)) as unknown as PublicacionHistorialResponse;
    if (entry.barrio_id !== barrioId) {
      throw new Error('El registro de historial no pertenece a este barrio.');
    }

    const barrio = await this.barriosSvc.getAsync(barrioId);
    if (barrio.snapshot) {
      const snap = this.parseSnapshot(barrio.snapshot);
      try {
        await this.guardarVersion(
          barrioId,
          snap ?? (barrio.snapshot as BarrioWebSnapshot),
          snap?.unidades.length ?? 0,
        );
      } catch (err) {
        console.error('[publicacion] no se pudo archivar el snapshot vigente', err);
      }
    }

    await this.barriosSvc.update(barrioId, {
      snapshot: entry.snapshot,
      publicado: true,
      publicado_at: new Date().toISOString(),
    } as Partial<BarriosResponse>);
  }

  private async guardarVersion(
    barrioId: string,
    snapshot: BarrioWebSnapshot,
    unidadesCount: number,
  ): Promise<void> {
    const userId = this.pb.authStore.model?.['id'] as string | undefined;
    await this.pb.collection('publicacion_historial').create({
      barrio_id: barrioId,
      snapshot,
      publicado_at: snapshot.generado_at,
      publicado_por: userId || undefined,
      unidades_count: unidadesCount,
    });
  }

  private estadoLabel(code: string): string {
    return this.definiciones.estadoPorCode('unidades', code)?.nombre ?? code;
  }

  private camposCambiados(
    prev: BarrioWebSnapshotUnidad,
    next: BarrioWebSnapshotUnidad,
  ): CambioCampo[] {
    const pairs: Array<[string, string, string]> = [
      ['Precio', fmtMoneda(prev.precio, prev.moneda), fmtMoneda(next.precio, next.moneda)],
      ['Estado', this.estadoLabel(prev.estado), this.estadoLabel(next.estado)],
      ['En oferta', prev.en_oferta ? 'Sí' : 'No', next.en_oferta ? 'Sí' : 'No'],
      [
        'Precio oferta',
        fmtMoneda(prev.precio_oferta, prev.moneda),
        fmtMoneda(next.precio_oferta, next.moneda),
      ],
        [
        'm²',
        prev.area != null ? prev.area.toLocaleString('es-UY') : '—',
        next.area != null ? next.area.toLocaleString('es-UY') : '—',
      ],
      ['Orientación', prev.orientacion ?? '—', next.orientacion ?? '—'],
      ['Tipo', tipoLabel(prev.tipo), tipoLabel(next.tipo)],
      ['Código', prev.codigo, next.codigo],
    ];
    const out: CambioCampo[] = [];
    for (const [campo, antes, despues] of pairs) {
      if (antes !== despues) out.push({ campo, antes, despues });
    }
    const extrasPrev = JSON.stringify(prev.extras ?? {});
    const extrasNext = JSON.stringify(next.extras ?? {});
    if (extrasPrev !== extrasNext) {
      out.push({ campo: 'Extras', antes: 'valores anteriores', despues: 'valores nuevos' });
    }
    if (!out.length) {
      out.push({ campo: 'Datos', antes: '…', despues: '…' });
    }
    return out;
  }
}
