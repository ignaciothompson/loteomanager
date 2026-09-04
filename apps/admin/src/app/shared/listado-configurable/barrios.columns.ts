import type { BarrioConUnidades } from '@loteomanager/shared-pb-client';
import type { ExtrasDefinicion, TipoUnidadIngreso } from '@loteomanager/shared-types';
import { TIPO_UNIDAD_LABELS } from '@loteomanager/shared-utils';
import type { ColumnDef } from './column-def';
import { extrasToColumns } from './listado-filter.util';

type ZonaExpand = {
  nombre?: string;
  departamento_id?: string;
  expand?: { departamento_id?: { id?: string; nombre?: string } };
};

function zonaExpand(row: BarrioConUnidades): ZonaExpand | undefined {
  return (row as BarrioConUnidades & { expand?: { zona_id?: ZonaExpand } }).expand?.zona_id;
}

export function zonaNombre(row: BarrioConUnidades): string {
  return zonaExpand(row)?.nombre ?? '';
}

export function departamentoNombre(row: BarrioConUnidades): string {
  const z = zonaExpand(row);
  return z?.expand?.departamento_id?.nombre ?? '';
}

export function departamentoId(row: BarrioConUnidades): string {
  const z = zonaExpand(row);
  return z?.departamento_id ?? z?.expand?.departamento_id?.id ?? '';
}

export function buildBarriosCatalog(
  extras: ExtrasDefinicion[],
  opts: {
    hasFechaLanzamiento: boolean;
    canPublishWeb: boolean;
    zonaOptions: { label: string; value: string }[];
    departamentoOptions: { label: string; value: string }[];
  }
): ColumnDef<BarrioConUnidades>[] {
  const tipoOpts = (Object.keys(TIPO_UNIDAD_LABELS) as TipoUnidadIngreso[]).map((k) => ({
    label: TIPO_UNIDAD_LABELS[k],
    value: k
  }));

  const base: ColumnDef<BarrioConUnidades>[] = [
    {
      id: 'nombre',
      label: 'Nombre',
      grupo: 'Básicos',
      tipo: 'text',
      flex: true,
      ancho: 220,
      default: true,
      filtrable: true,
      ordenable: true,
      getValue: (r) => r.nombre
    },
    {
      id: 'zona',
      label: 'Zona',
      grupo: 'Básicos',
      tipo: 'select',
      ancho: 140,
      default: true,
      filtrable: true,
      ordenable: true,
      opciones: opts.zonaOptions,
      getValue: (r) => r.zona_id,
      getSearchText: (r) => zonaNombre(r),
      getSortValue: (r) => zonaNombre(r)
    },
    {
      id: 'departamento',
      label: 'Departamento',
      grupo: 'Básicos',
      tipo: 'select',
      ancho: 170,
      default: true,
      filtrable: true,
      ordenable: true,
      opciones: opts.departamentoOptions,
      getValue: (r) => departamentoId(r),
      getSearchText: (r) => departamentoNombre(r),
      getSortValue: (r) => departamentoNombre(r)
    },
    {
      id: 'tipos_unidad',
      label: 'Tipos de unidad',
      grupo: 'Básicos',
      tipo: 'tags',
      ancho: 180,
      default: true,
      filtrable: true,
      ordenable: false,
      opciones: tipoOpts,
      getValue: (r) => r.tipos_unidad ?? [],
      getSearchText: (r) =>
        (r.tipos_unidad ?? []).map((t) => TIPO_UNIDAD_LABELS[t as TipoUnidadIngreso] ?? t).join(' ')
    },
    {
      id: 'unidades',
      label: 'Unidades',
      grupo: 'Inventario',
      tipo: 'compuesta',
      ancho: 140,
      default: true,
      filtrable: false,
      ordenable: true,
      getValue: (r) => r.unidadesCount,
      getSortValue: (r) => r.unidadesCount
    },
    {
      id: 'total',
      label: 'Total',
      grupo: 'Inventario',
      tipo: 'number',
      ancho: 90,
      alineacion: 'right',
      default: false,
      filtrable: true,
      ordenable: true,
      getValue: (r) => r.unidadesCount
    },
    {
      id: 'disponibles',
      label: 'Disponibles',
      grupo: 'Inventario',
      tipo: 'number',
      ancho: 110,
      alineacion: 'right',
      default: false,
      filtrable: true,
      ordenable: true,
      getValue: (r) => r.unidadesDisponiblesCount
    },
    {
      id: 'reservadas',
      label: 'Reservadas',
      grupo: 'Inventario',
      tipo: 'number',
      ancho: 110,
      alineacion: 'right',
      default: false,
      filtrable: true,
      ordenable: true,
      getValue: (r) => r.unidadesReservadasCount
    },
    {
      id: 'vendidas',
      label: 'Vendidas',
      grupo: 'Inventario',
      tipo: 'number',
      ancho: 100,
      alineacion: 'right',
      default: false,
      filtrable: true,
      ordenable: true,
      getValue: (r) => r.unidadesVendidasCount
    },
    {
      id: 'precio_desde',
      label: 'Precio desde',
      grupo: 'Inventario',
      tipo: 'number',
      formato: 'money',
      ancho: 130,
      alineacion: 'right',
      default: true,
      filtrable: true,
      ordenable: true,
      getValue: (r) => r.precioDesde
    },
    {
      id: 'web',
      label: 'Web',
      grupo: 'Publicación',
      tipo: 'bool',
      ancho: 200,
      default: opts.canPublishWeb,
      filtrable: true,
      ordenable: true,
      getValue: (r) => !!r.publicado
    },
    {
      id: 'sin_publicar',
      label: 'Sin publicar',
      grupo: 'Publicación',
      tipo: 'number',
      ancho: 110,
      alineacion: 'right',
      default: opts.canPublishWeb,
      filtrable: true,
      ordenable: true,
      getValue: (r) => r.pendientePublicarCount
    },
    {
      id: 'publicado_at',
      label: 'Publicado el',
      grupo: 'Publicación',
      tipo: 'date',
      ancho: 120,
      default: false,
      filtrable: true,
      ordenable: true,
      getValue: (r) => r.publicado_at ?? null
    },
    {
      id: 'ubicacion',
      label: 'Ubicación',
      grupo: 'Ubicación',
      tipo: 'text',
      ancho: 180,
      default: false,
      filtrable: true,
      ordenable: true,
      getValue: (r) => r.ubicacion_texto ?? ''
    },
    {
      id: 'tiene_mapa',
      label: 'Tiene mapa',
      grupo: 'Ubicación',
      tipo: 'bool',
      ancho: 110,
      default: false,
      filtrable: true,
      ordenable: true,
      getValue: (r) => r.lat != null && r.lng != null
    },
    {
      id: 'portada',
      label: 'Portada',
      grupo: 'Media',
      tipo: 'bool',
      ancho: 90,
      default: false,
      filtrable: true,
      ordenable: true,
      getValue: (r) => !!r.imagen_portada
    },
    {
      id: 'plano',
      label: 'Plano',
      grupo: 'Media',
      tipo: 'bool',
      ancho: 90,
      default: false,
      filtrable: true,
      ordenable: true,
      getValue: (r) => !!r.plano_general
    },
    {
      id: 'created',
      label: 'Creado',
      grupo: 'Fechas',
      tipo: 'date',
      ancho: 110,
      default: true,
      filtrable: true,
      ordenable: true,
      getValue: (r) => (r as { created?: string }).created ?? null
    },
    {
      id: 'descripcion',
      label: 'Descripción',
      grupo: 'Texto libre',
      grupoHint: 'ocupan mucho ancho',
      tipo: 'text',
      ancho: 220,
      default: false,
      filtrable: true,
      ordenable: false,
      getValue: (r) => {
        const html = String(r.descripcion ?? '');
        return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
      }
    }
  ];

  if (opts.hasFechaLanzamiento) {
    base.splice(
      base.findIndex((c) => c.id === 'created') + 1,
      0,
      {
        id: 'fecha_lanzamiento',
        label: 'Fecha de lanzamiento',
        grupo: 'Fechas',
        tipo: 'date',
        ancho: 140,
        default: true,
        filtrable: true,
        ordenable: true,
        getValue: (r) => (r as { fecha_lanzamiento?: string }).fecha_lanzamiento ?? null
      }
    );
  }

  return [...base, ...extrasToColumns<BarrioConUnidades>(extras, 'Extras del barrio')];
}
