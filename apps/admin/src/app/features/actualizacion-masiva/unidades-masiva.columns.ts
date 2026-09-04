import type { EstadoDefinicion, TipoUnidadIngreso, UnidadesResponse } from '@loteomanager/shared-types';
import { TIPO_UNIDAD_LABELS } from '@loteomanager/shared-utils';
import type { ColumnDef } from '../../shared/listado-configurable/column-def';

export function areaM2(u: UnidadesResponse): number | null {
  return u.metros_cuadrados ?? u.area_m2 ?? null;
}

export function buildUnidadesMasivaCatalog(
  estados: EstadoDefinicion[],
): ColumnDef<UnidadesResponse>[] {
  const tipoOpts = (Object.keys(TIPO_UNIDAD_LABELS) as TipoUnidadIngreso[]).map((k) => ({
    label: TIPO_UNIDAD_LABELS[k],
    value: k,
  }));
  const estadoOpts = estados.map((e) => ({ label: e.nombre, value: e.code }));

  return [
    {
      id: 'codigo',
      label: 'Código',
      grupo: 'Básicos',
      tipo: 'text',
      ancho: 110,
      default: true,
      filtrable: true,
      ordenable: true,
      getValue: (r) => r.codigo,
    },
    {
      id: 'tipo',
      label: 'Tipo',
      grupo: 'Básicos',
      tipo: 'select',
      ancho: 150,
      default: true,
      filtrable: true,
      ordenable: true,
      opciones: tipoOpts,
      getValue: (r) => r.tipo_unidad,
      getSearchText: (r) => TIPO_UNIDAD_LABELS[r.tipo_unidad as TipoUnidadIngreso] ?? r.tipo_unidad,
    },
    {
      id: 'estado',
      label: 'Estado',
      grupo: 'Básicos',
      tipo: 'state',
      ancho: 130,
      default: true,
      filtrable: true,
      ordenable: true,
      opciones: estadoOpts,
      getValue: (r) => r.estado,
    },
    {
      id: 'precio',
      label: 'Precio',
      grupo: 'Básicos',
      tipo: 'number',
      formato: 'money',
      alineacion: 'right',
      ancho: 130,
      default: true,
      filtrable: true,
      ordenable: true,
      getValue: (r) => r.precio,
    },
    {
      id: 'm2',
      label: 'm²',
      grupo: 'Básicos',
      tipo: 'number',
      formato: 'm2',
      alineacion: 'right',
      ancho: 90,
      default: true,
      filtrable: true,
      ordenable: true,
      getValue: (r) => areaM2(r),
    },
    {
      id: 'web',
      label: 'Web',
      grupo: 'Publicación',
      tipo: 'bool',
      ancho: 80,
      default: true,
      filtrable: true,
      ordenable: true,
      getValue: (r) => !!r.web_visible,
    },
    {
      id: 'pendiente',
      label: 'Pendiente',
      grupo: 'Publicación',
      tipo: 'bool',
      ancho: 120,
      default: true,
      filtrable: true,
      ordenable: true,
      getValue: (r) => !!r.pendiente_publicar,
    },
  ];
}
