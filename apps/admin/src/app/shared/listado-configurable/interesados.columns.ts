import type { InteresadosResponse, ExtrasDefinicion } from '@loteomanager/shared-types';
import type { ColumnDef } from './column-def';
import { extrasToColumns } from './listado-filter.util';

type Expand = {
  barrio_id?: { nombre?: string };
  unidad_id?: { codigo?: string; codigo_interno?: string };
  comparativa_id?: { titulo?: string };
  responsable_id?: { name?: string; email?: string };
};

function expandOf(row: InteresadosResponse): Expand | undefined {
  return (row as InteresadosResponse & { expand?: Expand }).expand;
}

export function buildInteresadosCatalog(
  extras: ExtrasDefinicion[],
  opts: {
    estadoOptions: { label: string; value: string }[];
    origenOptions: { label: string; value: string }[];
    barrioOptions: { label: string; value: string }[];
    syncOptions: { label: string; value: string }[];
  }
): ColumnDef<InteresadosResponse>[] {
  const base: ColumnDef<InteresadosResponse>[] = [
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
      id: 'email',
      label: 'Email',
      grupo: 'Básicos',
      tipo: 'text',
      ancho: 180,
      default: true,
      filtrable: true,
      ordenable: true,
      getValue: (r) => r.email ?? ''
    },
    {
      id: 'telefono',
      label: 'Teléfono',
      grupo: 'Básicos',
      tipo: 'text',
      ancho: 130,
      default: true,
      filtrable: true,
      ordenable: true,
      getValue: (r) => r.telefono ?? ''
    },
    {
      id: 'estado',
      label: 'Estado',
      grupo: 'Pipeline',
      tipo: 'state',
      ancho: 140,
      default: true,
      filtrable: true,
      ordenable: true,
      opciones: opts.estadoOptions,
      getValue: (r) => r.estado,
      getSortValue: (r) =>
        opts.estadoOptions.find((o) => o.value === r.estado)?.label ?? r.estado
    },
    {
      id: 'origen',
      label: 'Origen',
      grupo: 'Pipeline',
      tipo: 'select',
      ancho: 110,
      default: true,
      filtrable: true,
      ordenable: true,
      opciones: opts.origenOptions,
      getValue: (r) => r.origen
    },
    {
      id: 'responsable',
      label: 'Responsable',
      grupo: 'Pipeline',
      tipo: 'text',
      ancho: 150,
      default: false,
      filtrable: true,
      ordenable: true,
      getValue: (r) => r.responsable_id ?? '',
      getSearchText: (r) => {
        const e = expandOf(r)?.responsable_id;
        return e?.name || e?.email || '';
      },
      getSortValue: (r) => {
        const e = expandOf(r)?.responsable_id;
        return e?.name || e?.email || '';
      }
    },
    {
      id: 'barrio',
      label: 'Barrio de interés',
      grupo: 'Contexto',
      tipo: 'select',
      ancho: 160,
      default: true,
      filtrable: true,
      ordenable: true,
      opciones: opts.barrioOptions,
      getValue: (r) => r.barrio_id ?? '',
      getSearchText: (r) => expandOf(r)?.barrio_id?.nombre ?? '',
      getSortValue: (r) => expandOf(r)?.barrio_id?.nombre ?? ''
    },
    {
      id: 'unidad',
      label: 'Unidad',
      grupo: 'Contexto',
      tipo: 'text',
      ancho: 120,
      default: false,
      filtrable: true,
      ordenable: true,
      getValue: (r) => r.unidad_id ?? '',
      getSearchText: (r) => {
        const u = expandOf(r)?.unidad_id;
        return u?.codigo_interno || u?.codigo || '';
      },
      getSortValue: (r) => {
        const u = expandOf(r)?.unidad_id;
        return u?.codigo_interno || u?.codigo || '';
      }
    },
    {
      id: 'comparativa',
      label: 'Comparativa',
      grupo: 'Contexto',
      tipo: 'text',
      ancho: 160,
      default: false,
      filtrable: true,
      ordenable: true,
      getValue: (r) => r.comparativa_id ?? '',
      getSearchText: (r) => expandOf(r)?.comparativa_id?.titulo ?? '',
      getSortValue: (r) => expandOf(r)?.comparativa_id?.titulo ?? ''
    },
    {
      id: 'created',
      label: 'Ingresó',
      grupo: 'Fechas',
      tipo: 'date',
      ancho: 110,
      default: true,
      filtrable: true,
      ordenable: true,
      getValue: (r) => (r as { created?: string }).created ?? null
    },
    {
      id: 'sync_status',
      label: 'HubSpot',
      grupo: 'Integraciones',
      tipo: 'select',
      ancho: 110,
      default: false,
      filtrable: true,
      ordenable: true,
      opciones: opts.syncOptions,
      getValue: (r) => r.sync_status ?? ''
    },
    {
      id: 'mensaje',
      label: 'Mensaje',
      grupo: 'Texto libre',
      grupoHint: 'ocupan mucho ancho',
      tipo: 'text',
      ancho: 220,
      default: false,
      filtrable: true,
      ordenable: false,
      getValue: (r) => r.mensaje ?? ''
    }
  ];

  return [...base, ...extrasToColumns<InteresadosResponse>(extras, 'Extras de contacto')];
}
