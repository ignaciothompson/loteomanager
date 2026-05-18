import type {
  ComparativasResponse,
  UnidadesResponse,
  BarriosResponse,
  ComparativaSnapshot,
  ComparativaSnapshotUnidad,
} from '@loteomanager/shared-types';

const TIPO_LABEL: Record<string, string> = {
  lote: 'Lote',
  casa: 'Casa',
  departamento: 'Departamento',
};

function formatPrecio(precio: number, moneda: string): string {
  const num = new Intl.NumberFormat('es-AR', { maximumFractionDigits: 0 }).format(precio);
  return `${moneda} ${num}`;
}

function buildFileUrl(collection: string, recordId: string, fileName: string | undefined | null, pbUrl: string): string | null {
  if (!fileName) return null;
  return `${pbUrl}/api/files/${collection}/${recordId}/${fileName}`;
}

export function buildSnapshot(
  comp: ComparativasResponse,
  unidades: UnidadesResponse[],
  barriosMap: Map<string, BarriosResponse>,
  pbUrl: string,
): ComparativaSnapshot {
  const snapshotUnidades: ComparativaSnapshotUnidad[] = unidades.map(u => {
    const barrio = u.barrio_id ? barriosMap.get(u.barrio_id) : null;
    const enOferta = !!(u.oferta && u.precio_oferta && u.precio_oferta < u.precio);
    const precioDisplay = enOferta ? u.precio_oferta! : u.precio;

    const galerias = (u.galeria ?? []).map(f => buildFileUrl('unidades', u.id, f, pbUrl) ?? '').filter(Boolean);
    const [imagenHero, ...galeriaRest] = galerias;

    return {
      id: u.id,
      codigoInterno: u.codigo_interno,
      tipoUnidad: u.tipo_unidad,
      tipoUnidadLabel: TIPO_LABEL[u.tipo_unidad] ?? u.tipo_unidad,
      precio: precioDisplay,
      moneda: u.moneda,
      precioFormateado: formatPrecio(precioDisplay, u.moneda),
      enOferta,
      precioOriginal: enOferta ? u.precio : null,
      precioOriginalFormateado: enOferta ? formatPrecio(u.precio, u.moneda) : null,
      metrosCuadrados: u.metros_cuadrados,
      metrosConstruidos: u.metros_construidos ?? null,
      ambientes: u.ambientes ?? null,
      antiguedadAnios: u.antiguedad_anios ?? null,
      cocheras: u.cocheras ?? null,
      barrioId: barrio?.id ?? null,
      barrioNombre: barrio?.nombre ?? null,
      lat: barrio?.lat ?? null,
      lng: barrio?.lng ?? null,
      ubicacionTexto: barrio?.ubicacion_texto ?? null,
      imagenHero: imagenHero ?? null,
      galeria: galeriaRest,
      urlPlano: buildFileUrl('unidades', u.id, u.plano_unidad, pbUrl),
    };
  });

  return {
    titulo: comp.titulo,
    mensajePersonalizado: comp.mensaje_personalizado ?? null,
    unidades: snapshotUnidades,
    generadoEn: new Date().toISOString(),
  };
}
