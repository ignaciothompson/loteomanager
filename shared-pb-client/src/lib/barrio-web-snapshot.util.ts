import type {
  BarrioWebSnapshot,
  BarrioWebSnapshotUnidad,
  BarriosResponse,
  FileNameString,
  UnidadesResponse,
  UnidadesTipoUnidadOptions,
} from '@loteomanager/shared-types';

export type SnapshotCatalogStats = {
  unidadesCount: number;
  precioDesde: number | null;
  moneda: string | null;
  areaMin: number | null;
  areaMax: number | null;
};

export type BarrioConSnapshotCatalogo = BarriosResponse & SnapshotCatalogStats;

export function parseBarrioWebSnapshot(raw: unknown): BarrioWebSnapshot | null {
  if (!raw || typeof raw !== 'object') return null;
  const s = raw as BarrioWebSnapshot;
  if (!s.barrio || !Array.isArray(s.unidades)) return null;
  return s;
}

export function isBarrioWebReady(b: BarriosResponse): boolean {
  return !!b.publicado && !!parseBarrioWebSnapshot(b.snapshot);
}

export function catalogStatsFromSnapshot(snap: BarrioWebSnapshot): SnapshotCatalogStats {
  const disponibles = snap.unidades.filter((u) => u.estado === 'disponible');
  let precioDesde: number | null = null;
  let moneda: string | null = null;
  let areaMin: number | null = null;
  let areaMax: number | null = null;

  for (const u of disponibles) {
    if (u.precio != null && (precioDesde == null || u.precio < precioDesde)) {
      precioDesde = u.precio;
      moneda = u.moneda ?? 'USD';
    }
    if (u.area != null) {
      areaMin = areaMin == null ? u.area : Math.min(areaMin, u.area);
      areaMax = areaMax == null ? u.area : Math.max(areaMax, u.area);
    }
  }

  return {
    unidadesCount: disponibles.length,
    precioDesde,
    moneda,
    areaMin,
    areaMax,
  };
}

/** Overlay snapshot barrio fields onto PB record for landing display. */
export function barrioFromSnapshot(b: BarriosResponse, snap: BarrioWebSnapshot): BarriosResponse {
  const sb = snap.barrio;
  return {
    ...b,
    nombre: sb.nombre || b.nombre,
    slug: sb.slug || b.slug,
    descripcion: (sb.descripcion ?? b.descripcion) as BarriosResponse['descripcion'],
    ubicacion_texto: (sb.ubicacion_texto ?? b.ubicacion_texto) as BarriosResponse['ubicacion_texto'],
    // Live file names win: re-upload changes the suffix; snapshot stays stale until republish.
    imagen_portada: (b.imagen_portada || sb.imagen_portada) as BarriosResponse['imagen_portada'],
    plano_general: (b.plano_general || sb.plano_general) as BarriosResponse['plano_general'],
    lat: (sb.lat ?? b.lat) as BarriosResponse['lat'],
    lng: (sb.lng ?? b.lng) as BarriosResponse['lng'],
  };
}

export function snapUnidadToUnidadesResponse(
  u: BarrioWebSnapshotUnidad,
  barrioId: string,
): UnidadesResponse {
  return {
    id: u.id,
    codigo: u.codigo,
    codigo_interno: u.codigo,
    tipo_unidad: u.tipo as UnidadesTipoUnidadOptions,
    barrio_id: barrioId,
    metros_cuadrados: u.area ?? undefined,
    area_m2: u.area ?? undefined,
    orientacion: (u.orientacion ?? undefined) as UnidadesResponse['orientacion'],
    precio: u.precio ?? undefined,
    moneda: (u.moneda ?? 'USD') as UnidadesResponse['moneda'],
    estado: u.estado,
    en_oferta: u.en_oferta,
    precio_oferta: u.precio_oferta ?? undefined,
    extras: u.extras,
    descripcion: u.descripcion ?? undefined,
    galeria: (u.galeria ?? []) as FileNameString[],
    plano_unidad: (u.plano_unidad ?? undefined) as FileNameString | undefined,
    metros_construidos: u.metros_construidos ?? undefined,
    numero_unidad: u.numero_unidad ?? undefined,
    ambientes: u.ambientes ?? undefined,
    antiguedad_anios: u.antiguedad_anios ?? undefined,
    cocheras: u.cocheras ?? undefined,
    web_visible: true,
    pendiente_publicar: false,
    responsable_id: '',
  } as UnidadesResponse;
}

export function attachCatalogStatsFromSnapshots(
  barrios: BarriosResponse[],
): BarrioConSnapshotCatalogo[] {
  return barrios
    .map((b) => {
      const snap = parseBarrioWebSnapshot(b.snapshot);
      if (!snap) return null;
      const stats = catalogStatsFromSnapshot(snap);
      const overlay = barrioFromSnapshot(b, snap);
      return { ...overlay, ...stats };
    })
    .filter((b): b is BarrioConSnapshotCatalogo => b != null);
}
